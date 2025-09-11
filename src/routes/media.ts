import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth'
import { rateUser } from '../middleware/rateUser'
import { getRlsClient, supabaseAdmin } from '../lib/supabase'
import { z } from 'zod'
import { enqueueMediaJob } from '../lib/jobQueue'

export const router = Router()

const err = (res: Response, status: number, code: string, message?: string, details?: any) =>
  res.status(status).json({ error: { code, message: message ?? code, details } })

const bucket = process.env.MEDIA_BUCKET || 'media'

// Request a signed upload URL (client will upload using Supabase storage signed method)
// We accept client-declared mime & size for early validation; server still trusts storage rules.
const uploadReqSchema = z.object({
  file_name: z.string().min(1).max(120),
  mime_type: z.string().min(3).max(120),
  size_bytes: z
    .number()
    .int()
    .positive()
    .max(25 * 1024 * 1024)
    .optional(), // soft 25MB guard
})

const ALLOWED_MIME_PREFIXES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4']
router.post(
  '/upload-url',
  requireAuth,
  rateUser({ action: 'media_upload_url', limit: 30, windowMs: 60_000 }),
  async (req: Request, res: Response) => {
    if (!req.user) return err(res, 401, 'unauthorized')
    if (!supabaseAdmin) return err(res, 500, 'supabase_not_configured')
    const parsed = uploadReqSchema.safeParse(req.body)
    if (!parsed.success) return err(res, 400, 'invalid_payload', undefined, parsed.error.flatten())
    // Basic sanitization: strip path separators
    const cleanName = parsed.data.file_name.replace(/\\|\//g, '_')
    if (!ALLOWED_MIME_PREFIXES.some((p) => parsed.data.mime_type.startsWith(p))) {
      return err(res, 400, 'unsupported_media_type')
    }
    const path = `${req.user.sub}/${Date.now()}-${cleanName}`
    try {
      // createSignedUploadUrl available in supabase-js v2; fallback if missing
      // @ts-ignore - type may differ across versions
      const { data, error } = await (supabaseAdmin as any).storage
        .from(bucket)
        .createSignedUploadUrl(path)
      if (error || !data) return err(res, 500, 'signed_url_failed')
      return res.status(200).json({ path: data.path, token: data.token })
    } catch {
      return err(res, 500, 'signed_url_failed')
    }
  }
)

// Attach media record to a post after successful upload
const attachSchema = z.object({
  post_id: z.string().uuid(),
  path: z.string().min(1),
  media_type: z.enum(['image', 'video', 'gif']).default('image'),
  width: z.number().int().positive().max(10000).optional(),
  height: z.number().int().positive().max(10000).optional(),
  duration_ms: z
    .number()
    .int()
    .positive()
    .max(10 * 60 * 1000)
    .optional(),
})
router.post(
  '/',
  requireAuth,
  rateUser({ action: 'media_attach', limit: 60, windowMs: 60_000 }),
  async (req: Request, res: Response) => {
    if (!req.user) return err(res, 401, 'unauthorized')
    const supabase = getRlsClient(req.user.sb)
    if (!supabase) return err(res, 500, 'supabase_not_configured')
    const parsed = attachSchema.safeParse(req.body)
    if (!parsed.success) return err(res, 400, 'invalid_payload', undefined, parsed.error.flatten())
    try {
      // Verify post ownership to prevent attaching media to others' posts
      const postResp = await supabase
        .from('posts')
        .select('author_id')
        .eq('id', parsed.data.post_id)
        .single()
      if (postResp.error || !postResp.data) return err(res, 404, 'post_not_found')
      if (postResp.data.author_id !== req.user.sub) return err(res, 403, 'forbidden')

      const publicBase = `${process.env.SUPABASE_URL?.replace(
        /\/$/,
        ''
      )}/storage/v1/object/public/${bucket}`
      const url = `${publicBase}/${parsed.data.path}`

      // Placeholder for thumbnail generation trigger: if image and large dimensions provided.
      const needsThumb =
        parsed.data.media_type === 'image' &&
        (parsed.data.width || 0) > 0 &&
        (parsed.data.width || 0) * (parsed.data.height || 0) > 1500 * 1500 // ~2.25MP

      const { data, error } = await supabase
        .from('media')
        .insert({
          post_id: parsed.data.post_id,
          url,
          media_type: parsed.data.media_type,
          meta: {
            w: parsed.data.width,
            h: parsed.data.height,
            d_ms: parsed.data.duration_ms,
            thumb_pending: needsThumb || undefined,
          },
        })
        .select('id,url,media_type,meta')
        .single()
      if (error || !data) return err(res, 500, 'media_insert_failed')
      // Enqueue thumbnail + probe jobs if needed
      if (needsThumb) enqueueMediaJob({ type: 'thumbnail', mediaId: data.id, url })
      enqueueMediaJob({ type: 'probe', mediaId: data.id, url })
      return res.status(201).json({ media: data })
    } catch {
      return err(res, 500, 'server_error')
    }
  }
)
