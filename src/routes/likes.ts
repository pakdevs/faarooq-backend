import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth'
import { getRlsClient } from '../lib/supabase'
import { rateUser } from '../middleware/rateUser'

export const router = Router()

const err = (res: Response, status: number, code: string, message?: string, details?: any) =>
  res.status(status).json({ error: { code, message: message ?? code, details } })

router.post(
  '/:postId/like',
  requireAuth,
  rateUser({ action: 'like', limit: 120, windowMs: 60_000 }),
  async (req: Request, res: Response) => {
    if (!req.user) return err(res, 401, 'unauthorized')
    const supabase = getRlsClient(req.user.sb)
    if (!supabase) return res.status(201).json({ ok: true })
    const postId = req.params.postId
    try {
      const { error } = await supabase
        .from('likes')
        .upsert({ user_id: req.user.sub, post_id: postId }, { onConflict: 'user_id,post_id' })
      if (error) return err(res, 400, 'like_failed')
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
      return err(res, 500, 'server_error')
    }
  }
)
