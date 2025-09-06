import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth'
import { getRlsClient } from '../lib/supabase'

export const router = Router()

const err = (res: Response, status: number, code: string, message?: string, details?: any) =>
  res.status(status).json({ error: { code, message: message ?? code, details } })

router.post('/:id/follow', requireAuth, async (req: Request, res: Response) => {
  if (!req.user) return err(res, 401, 'unauthorized')
  const supabase = getRlsClient(req.user.sb)
  if (!supabase) return res.status(201).json({ ok: true })
  const followeeId = req.params.id
  try {
    const { error } = await supabase
      .from('follows')
      .upsert(
        { follower_id: req.user.sub, followee_id: followeeId },
        { onConflict: 'follower_id,followee_id' }
      )
    if (error) return err(res, 400, 'follow_failed')
    // Create a follow notification for the followee
    await supabase
      .from('notifications')
      .insert({ user_id: followeeId, kind: 'follow', actor_id: req.user.sub })
    return res.status(201).json({ ok: true })
  } catch {
    return err(res, 500, 'server_error')
  }
})

router.post('/:id/unfollow', requireAuth, async (req: Request, res: Response) => {
  if (!req.user) return err(res, 401, 'unauthorized')
  const supabase = getRlsClient(req.user.sb)
  if (!supabase) return res.status(200).json({ ok: true })
  const followeeId = req.params.id
  try {
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', req.user.sub)
      .eq('followee_id', followeeId)
    if (error) return err(res, 400, 'unfollow_failed')
    return res.status(200).json({ ok: true })
  } catch {
    return err(res, 500, 'server_error')
  }
})
