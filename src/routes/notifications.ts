import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth'
import { supabase } from '../lib/supabase'
import { buildPage } from '../utils/pagination'
import { z } from 'zod'

export const router = Router()

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const { cursor } = req.query as { cursor?: string }
  if (!supabase || !req.user) return res.json(buildPage([], null))
  try {
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', req.user.sub)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(20)

    if (cursor) {
      query = query.lt('created_at', cursor)
    }

    const { data, error } = await query
    if (error) return res.status(500).json({ error: 'Failed to load notifications' })
    const items = data ?? []
    const nextCursor = items.length ? items[items.length - 1].created_at : null
    return res.json(buildPage(items, nextCursor))
  } catch {
    return res.status(500).json({ error: 'Server error' })
  }
})

const markReadSchema = z.object({
  ids: z.array(z.string()).min(1).optional(),
})

router.post('/read', requireAuth, async (req: Request, res: Response) => {
  const parsed = markReadSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' })
  if (!supabase || !req.user) return res.json({ ok: true })
  try {
    let builder = supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', req.user.sub)

    if (parsed.data.ids) {
      builder = builder.in('id', parsed.data.ids)
    } else {
      builder = builder.is('read_at', null)
    }

    const { error } = await builder
    if (error) return res.status(500).json({ error: 'Failed to mark read' })
    return res.json({ ok: true })
  } catch {
    return res.status(500).json({ error: 'Server error' })
  }
})
