import { Router, Request, Response } from 'express'
import { getRlsClient } from '../lib/supabase'
import { requireAuth } from '../middleware/auth'
import { z } from 'zod'

export const router = Router()

const err = (res: Response, status: number, code: string, message?: string, details?: any) =>
  res.status(status).json({ error: { code, message: message ?? code, details } })

// Get current user's profile
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  if (!req.user) return err(res, 401, 'unauthorized')
  const supabase = getRlsClient(req.user.sb)
  if (!supabase) return res.json({ id: req.user.sub, handle: 'stub', display_name: 'Stub' })
  const { data, error } = await supabase.from('users').select('*').eq('id', req.user.sub).single()
  if (error || !data) return err(res, 404, 'user_not_found')
  return res.json(data)
})

// Update current user's profile
const updateSchema = z.object({
  handle: z.string().min(3).max(30).optional(),
  display_name: z.string().min(1).max(80).optional(),
  bio: z.string().max(280).optional(),
  avatar_url: z.string().url().optional(),
})

router.put('/me', requireAuth, async (req: Request, res: Response) => {
  if (!req.user) return err(res, 401, 'unauthorized')
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) return err(res, 400, 'invalid_payload')
  const supabase = getRlsClient(req.user.sb)
  if (!supabase) return res.json({ ok: true })
  try {
    const { data, error } = await supabase
      .from('users')
      .update(parsed.data)
      .eq('id', req.user.sub)
      .select('*')
      .single()
    if (error) {
      const msg = error.message || ''
      if (msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('unique')) {
        return err(res, 409, 'handle_taken')
      }
      return err(res, 500, 'update_failed')
    }
    if (!data) return err(res, 404, 'user_not_found')
    return res.json(data)
  } catch {
    return err(res, 500, 'server_error')
  }
})

// Get user by id (keep after /me to avoid route shadowing)
router.get('/:id', async (req: Request, res: Response) => {
  const id = req.params.id
  const supabase = getRlsClient() // anon client; users_read_all policy allows public read
  if (!supabase) return res.json({ id, handle: 'stub', display_name: 'Stub' })
  const { data, error } = await supabase.from('users').select('*').eq('id', id).single()
  if (error || !data) return err(res, 404, 'user_not_found')
  return res.json(data)
})
