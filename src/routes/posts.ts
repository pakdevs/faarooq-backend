import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth'
import { buildPage } from '../utils/pagination'
import { getRlsClient } from '../lib/supabase'
import { z } from 'zod'

export const router = Router()

const err = (res: Response, status: number, code: string, message?: string, details?: any) =>
  res.status(status).json({ error: { code, message: message ?? code, details } })

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
  if (!parsed.success) return err(res, 400, 'invalid_payload')
  if (!req.user) return err(res, 401, 'unauthorized')
  const supabase = getRlsClient(req.user.sb)
  if (!supabase) return err(res, 500, 'supabase_not_configured')
  try {
    const { data, error } = await supabase
      .from('posts')
      .insert({ text: parsed.data.text, author_id: req.user.sub })
      .select('id')
      .single()
    if (error) return err(res, 400, 'create_post_failed')
    return res.status(201).json({ id: data?.id })
  } catch {
    return err(res, 500, 'server_error')
  }
})

// Reply to a post
router.post('/:id/reply', requireAuth, async (req: Request, res: Response) => {
  if (!req.user) return err(res, 401, 'unauthorized')
  const parsed = replySchema.safeParse(req.body)
  if (!parsed.success) return err(res, 400, 'invalid_payload')
  const supabase = getRlsClient(req.user.sb)
  if (!supabase) return err(res, 500, 'supabase_not_configured')
  const parentId = req.params.id
  try {
    // Ensure parent exists and find its author
    const parent = await supabase
      .from('posts')
      .select('id, author_id, deleted_at')
      .eq('id', parentId)
      .is('deleted_at', null)
      .single()
    if (parent.error || !parent.data) return err(res, 404, 'parent_not_found')

    // Create reply post
    const inserted = await supabase
      .from('posts')
      .insert({ text: parsed.data.text, author_id: req.user.sub, reply_to_post_id: parentId })
      .select('id')
      .single()
    if (inserted.error || !inserted.data) return err(res, 400, 'create_reply_failed')

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
    return err(res, 500, 'server_error')
  }
})

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const { cursor } = req.query as { cursor?: string }
  if (!req.user) return err(res, 401, 'unauthorized')
  const supabase = getRlsClient(req.user.sb)
  if (!supabase) return res.json(buildPage([], null))
  try {
    // 1) Get followed user IDs
    const followsResp = await supabase
      .from('follows')
      .select('followee_id')
      .eq('follower_id', req.user.sub)

    if (followsResp.error) return err(res, 500, 'load_follows_failed')
    const followeeIds = (followsResp.data ?? []).map((r: any) => r.followee_id)

    if (!followeeIds.length) {
      return res.json(buildPage([], null))
    }

    // 2) Fetch authored posts by followees
    let postsQ = supabase
      .from('posts')
      .select('*')
      .in('author_id', followeeIds)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(50)

    // 3) Fetch reposts by followees
    let repostsQ = supabase
      .from('reposts')
      .select('created_at, post_id, user_id')
      .in('user_id', followeeIds)
      .order('created_at', { ascending: false })
      .limit(50)

    const [postsResp, repostsResp] = await Promise.all([postsQ, repostsQ])
    if (postsResp.error) return err(res, 500, 'load_posts_failed')
    if (repostsResp.error) return err(res, 500, 'load_reposts_failed')

    const posts = (postsResp.data ?? []).map((p: any) => ({
      type: 'post' as const,
      id: p.id,
      post: p,
      activity_at: p.created_at,
    }))

    const reposts = (repostsResp.data ?? []).map((r: any) => ({
      type: 'repost' as const,
      id: `${r.user_id}:${r.post_id}`,
      repost: r,
      activity_at: r.created_at,
    }))

    // Merge and sort by activity_at desc
    const merged = [...posts, ...reposts].sort((a, b) => (a.activity_at < b.activity_at ? 1 : -1))

    // Cursor: use activity_at (ISO string). If cursor provided, filter older.
    const filtered = cursor ? merged.filter((i) => i.activity_at < String(cursor)) : merged
    const page = filtered.slice(0, 20)
    const nextCursor = page.length ? page[page.length - 1].activity_at : null
    return res.json(buildPage(page, nextCursor))
  } catch {
    return res.status(500).json({ error: 'Server error' })
  }
})

router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) return err(res, 400, 'invalid_payload')
  if (!req.user) return err(res, 401, 'unauthorized')
  const supabase = getRlsClient(req.user.sb)
  if (!supabase) return res.json({ ok: true })
  try {
    const { data, error } = await supabase
      .from('posts')
      .update({ text: parsed.data.text })
      .eq('id', req.params.id)
      .eq('author_id', req.user.sub)
      .is('deleted_at', null)
      .select('id')
      .single()
    if (error || !data) return err(res, 403, 'not_allowed')
    return res.json({ ok: true })
  } catch {
    return err(res, 500, 'server_error')
  }
})

router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  if (!req.user) return err(res, 401, 'unauthorized')
  const supabase = getRlsClient(req.user.sb)
  if (!supabase) return res.status(204).send()
  try {
    const { data, error } = await supabase
      .from('posts')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('author_id', req.user.sub)
      .is('deleted_at', null)
      .select('id')
      .single()
    if (error || !data) return err(res, 403, 'not_allowed')
    return res.status(204).send()
  } catch {
    return err(res, 500, 'server_error')
  }
})

// Get replies for a post (reverse-chronological, cursor-based)
router.get('/:id/replies', requireAuth, async (req: Request, res: Response) => {
  if (!req.user) return err(res, 401, 'unauthorized')
  const { cursor } = req.query as { cursor?: string }
  const supabase = getRlsClient(req.user.sb)
  if (!supabase) return res.json(buildPage([], null))
  try {
    let query = supabase
      .from('posts')
      .select('*')
      .eq('reply_to_post_id', req.params.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(20)

    if (cursor) {
      query = query.lt('created_at', cursor)
    }

    const { data, error } = await query
    if (error) return err(res, 500, 'load_replies_failed')
    const items = data ?? []
    const nextCursor = items.length ? items[items.length - 1].created_at : null
    return res.json(buildPage(items, nextCursor))
  } catch {
    return err(res, 500, 'server_error')
  }
})
