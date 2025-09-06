import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth'
import { getRlsClient } from '../lib/supabase'

export const router = Router()

router.post('/:postId/like', requireAuth, async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' })
  const supabase = getRlsClient(req.user.sb)
  if (!supabase) return res.status(201).json({ ok: true })
  const postId = req.params.postId
  try {
    const { error } = await supabase
      .from('likes')
      .upsert({ user_id: req.user.sub, post_id: postId }, { onConflict: 'user_id,post_id' })
    if (error) return res.status(400).json({ error: 'Failed to like' })
    // Notify the post author (if exists)
    const postResp = await supabase.from('posts').select('author_id').eq('id', postId).single()
    if (!postResp.error && postResp.data && postResp.data.author_id !== req.user.sub) {
      await supabase.from('notifications').insert({
        user_id: postResp.data.author_id,
        kind: 'like',
        actor_id: req.user.sub,
        post_id: postId,
      })
    }
    return res.status(201).json({ ok: true })
  } catch {
    return res.status(500).json({ error: 'Server error' })
  }
})

router.post('/:postId/repost', requireAuth, async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' })
  const supabase = getRlsClient(req.user.sb)
  if (!supabase) return res.status(201).json({ ok: true })
  const postId = req.params.postId
  try {
    const { error } = await supabase
      .from('reposts')
      .upsert({ user_id: req.user.sub, post_id: postId }, { onConflict: 'user_id,post_id' })
    if (error) return res.status(400).json({ error: 'Failed to repost' })
    return res.status(201).json({ ok: true })
  } catch {
    return res.status(500).json({ error: 'Server error' })
  }
})
