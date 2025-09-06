import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth'
import { supabase } from '../lib/supabase'

export const router = Router()

router.post('/:id/follow', requireAuth, async (req: Request, res: Response) => {
  if (!supabase || !req.user) return res.status(201).json({ ok: true })
  const followeeId = req.params.id
  try {
    const { error } = await supabase
      .from('follows')
      .upsert(
        { follower_id: req.user.sub, followee_id: followeeId },
        { onConflict: 'follower_id,followee_id' }
      )
    if (error) return res.status(400).json({ error: 'Failed to follow' })
    // Create a follow notification for the followee
    await supabase
      .from('notifications')
      .insert({ user_id: followeeId, kind: 'follow', actor_id: req.user.sub })
    return res.status(201).json({ ok: true })
  } catch {
    return res.status(500).json({ error: 'Server error' })
  }
})

router.post('/:id/unfollow', requireAuth, async (req: Request, res: Response) => {
  if (!supabase || !req.user) return res.status(200).json({ ok: true })
  const followeeId = req.params.id
  try {
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', req.user.sub)
      .eq('followee_id', followeeId)
    if (error) return res.status(400).json({ error: 'Failed to unfollow' })
    return res.status(200).json({ ok: true })
  } catch {
    return res.status(500).json({ error: 'Server error' })
  }
})
