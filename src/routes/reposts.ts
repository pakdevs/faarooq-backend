import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth'
import { getRlsClient } from '../lib/supabase'
import { z } from 'zod'
import { rateUser } from '../middleware/rateUser'

export const router = Router()

const bodySchema = z.object({ post_id: z.string().uuid() })

const err = (res: Response, status: number, code: string, message?: string, details?: any) =>
  res.status(status).json({ error: { code, message: message ?? code, details } })

// Repost a post (idempotent via PK (user_id, post_id))
router.post(
  '/',
  requireAuth,
  rateUser({ action: 'repost', limit: 60, windowMs: 60_000 }),
  async (req: Request, res: Response) => {
    if (!req.user) return err(res, 401, 'unauthorized')
    const parsed = bodySchema.safeParse(req.body)
    if (!parsed.success) return err(res, 400, 'invalid_payload')
    const supabase = getRlsClient(req.user.sb)
    if (!supabase) return err(res, 500, 'supabase_not_configured')
    try {
      const { error } = await supabase
        .from('reposts')
        .upsert(
          { user_id: req.user.sub, post_id: parsed.data.post_id },
          { onConflict: 'user_id,post_id' }
        )
      if (error) return err(res, 400, 'repost_failed')
      // Notify original post author (skip self)
      const postAuthor = await supabase
        .from('posts')
        .select('author_id')
        .eq('id', parsed.data.post_id)
        .single()
      if (
        !postAuthor.error &&
        postAuthor.data?.author_id &&
        postAuthor.data.author_id !== req.user.sub
      ) {
        await supabase.from('notifications').insert({
          user_id: postAuthor.data.author_id,
          kind: 'repost',
          actor_id: req.user.sub,
          post_id: parsed.data.post_id,
        })
      }
      return res.status(201).json({ ok: true })
    } catch {
      return err(res, 500, 'server_error')
    }
  }
)

// Remove a repost
router.delete(
  '/',
  requireAuth,
  rateUser({ action: 'repost', limit: 60, windowMs: 60_000 }),
  async (req: Request, res: Response) => {
    if (!req.user) return err(res, 401, 'unauthorized')
    const parsed = bodySchema.safeParse(req.body)
    if (!parsed.success) return err(res, 400, 'invalid_payload')
    const supabase = getRlsClient(req.user.sb)
    if (!supabase) return res.status(204).send()
    try {
      const { error } = await supabase
        .from('reposts')
        .delete()
        .eq('user_id', req.user.sub)
        .eq('post_id', parsed.data.post_id)
      if (error) return err(res, 400, 'unrepost_failed')
      return res.status(200).json({ ok: true })
    } catch {
      return err(res, 500, 'server_error')
    }
  }
)
