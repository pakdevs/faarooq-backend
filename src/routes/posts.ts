import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth'
import { buildPage } from '../utils/pagination'
import { getRlsClient } from '../lib/supabase'
import { z } from 'zod'

export const router = Router()

const createSchema = z.object({
  text: z.string().min(1).max(280),
  media: z.array(z.string().url()).max(4).optional(),
})
const updateSchema = z.object({
  text: z.string().min(1).max(280).optional(),
})

const replySchema = z.object({
  text: z.string().min(1).max(280),
})

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' })
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' })
  const supabase = getRlsClient(req.user.sb)
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' })
  try {
    const { data, error } = await supabase
      .from('posts')
      .insert({ text: parsed.data.text, author_id: req.user.sub })
      .select('id')
      .single()
    if (error) return res.status(400).json({ error: 'Failed to create post' })
    return res.status(201).json({ id: data?.id })
  } catch {
    return res.status(500).json({ error: 'Server error' })
  }
})

// Reply to a post
router.post('/:id/reply', requireAuth, async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' })
  const parsed = replySchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' })
  const supabase = getRlsClient(req.user.sb)
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' })
  const parentId = req.params.id
  try {
    // Ensure parent exists and find its author
    const parent = await supabase.from('posts').select('id, author_id').eq('id', parentId).single()
    if (parent.error || !parent.data)
      return res.status(404).json({ error: 'Parent post not found' })

    // Create reply post
    const inserted = await supabase
      .from('posts')
      .insert({ text: parsed.data.text, author_id: req.user.sub, reply_to_post_id: parentId })
      .select('id')
      .single()
    if (inserted.error || !inserted.data)
      return res.status(400).json({ error: 'Failed to create reply' })

    // Notify parent author (skip self-reply)
    if (parent.data.author_id && parent.data.author_id !== req.user.sub) {
      await supabase.from('notifications').insert({
        user_id: parent.data.author_id,
        kind: 'reply',
        actor_id: req.user.sub,
        post_id: inserted.data.id,
      })
    }

    return res.status(201).json({ id: inserted.data.id })
  } catch {
    return res.status(500).json({ error: 'Server error' })
  }
})

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const { cursor } = req.query as { cursor?: string }
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' })
  const supabase = getRlsClient(req.user.sb)
  if (!supabase) return res.json(buildPage([], null))
  try {
    // 1) Get followed user IDs
    const followsResp = await supabase
      .from('follows')
      .select('followee_id')
      .eq('follower_id', req.user.sub)

    if (followsResp.error) return res.status(500).json({ error: 'Failed to load follows' })
    const followeeIds = (followsResp.data ?? []).map((r: any) => r.followee_id)

    if (!followeeIds.length) {
      return res.json(buildPage([], null))
    }

    // 2) Fetch posts from followed users (simple cursor on created_at)
    let query = supabase
      .from('posts')
      .select('*')
      .in('author_id', followeeIds)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(20)

    if (cursor) {
      query = query.lt('created_at', cursor)
    }

    const { data, error } = await query
    if (error) return res.status(500).json({ error: 'Failed to load posts' })
    const items = data ?? []
    const nextCursor = items.length ? items[items.length - 1].created_at : null
    return res.json(buildPage(items, nextCursor))
  } catch {
    return res.status(500).json({ error: 'Server error' })
  }
})

router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' })
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' })
  const supabase = getRlsClient(req.user.sb)
  if (!supabase) return res.json({ ok: true })
  try {
    const { data, error } = await supabase
      .from('posts')
      .update({ text: parsed.data.text })
      .eq('id', req.params.id)
      .eq('author_id', req.user.sub)
      .select('id')
      .single()
    if (error || !data) return res.status(403).json({ error: 'Not allowed' })
    return res.json({ ok: true })
  } catch {
    return res.status(500).json({ error: 'Server error' })
  }
})

router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' })
  const supabase = getRlsClient(req.user.sb)
  if (!supabase) return res.status(204).send()
  try {
    const { data, error } = await supabase
      .from('posts')
      .delete()
      .eq('id', req.params.id)
      .eq('author_id', req.user.sub)
      .select('id')
      .single()
    if (error || !data) return res.status(403).json({ error: 'Not allowed' })
    return res.status(204).send()
  } catch {
    return res.status(500).json({ error: 'Server error' })
  }
})
