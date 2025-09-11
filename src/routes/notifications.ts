import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth'
import { getRlsClient } from '../lib/supabase'
import { buildPage } from '../utils/pagination'
import { z } from 'zod'

export const router = Router()

const err = (res: Response, status: number, code: string, message?: string, details?: any) =>
  res.status(status).json({ error: { code, message: message ?? code, details } })

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const { cursor } = req.query as { cursor?: string }
  if (!req.user) return err(res, 401, 'unauthorized')
  const supabase = getRlsClient(req.user.sb)
  if (!supabase) return res.json(buildPage([], null))
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
    if (error) return err(res, 500, 'load_notifications_failed')
    const items = (data ?? []) as Array<any>

    // Load block & mute lists to filter out unwanted notifications
    const [blocksResp, blockedMeResp, mutesResp] = await Promise.all([
      supabase.from('blocks').select('blocked_id').eq('blocker_id', req.user.sub),
      supabase.from('blocks').select('blocker_id').eq('blocked_id', req.user.sub),
      supabase.from('mutes').select('muted_id').eq('muter_id', req.user.sub),
    ])
    const blockedIds = (blocksResp.data ?? []).map((r: any) => r.blocked_id)
    const blockedMeIds = (blockedMeResp.data ?? []).map((r: any) => r.blocker_id)
    const mutedIds = (mutesResp.data ?? []).map((r: any) => r.muted_id)
    const excluded = new Set([...blockedIds, ...blockedMeIds, ...mutedIds])
    const filteredItems = items.filter((n) => !n.actor_id || !excluded.has(String(n.actor_id)))

    // Enrich with actor and post details (best-effort; ignore failures) – supports like/follow/reply/repost
    let enriched = filteredItems
    if (filteredItems.length) {
      const actorIds = Array.from(
        new Set(filteredItems.map((n) => n.actor_id).filter((v) => !!v))
      ) as string[]
      const postIds = Array.from(
        new Set(filteredItems.map((n) => n.post_id).filter((v) => !!v))
      ) as string[]

      const [actorsResp, postsResp] = await Promise.all([
        actorIds.length
          ? supabase.from('users').select('id, handle, display_name').in('id', actorIds)
          : Promise.resolve({ data: [], error: null } as any),
        postIds.length
          ? supabase.from('posts').select('id, text, author_id').in('id', postIds)
          : Promise.resolve({ data: [], error: null } as any),
      ])

      const actorsById: Record<string, any> = {}
      const postsById: Record<string, any> = {}
      if (!actorsResp.error && Array.isArray(actorsResp.data)) {
        for (const u of actorsResp.data as any[]) actorsById[String(u.id)] = u
      }
      if (!postsResp.error && Array.isArray(postsResp.data)) {
        for (const p of postsResp.data as any[]) postsById[String(p.id)] = p
      }

      enriched = filteredItems.map((n) => ({
        ...n,
        actor: n.actor_id ? actorsById[String(n.actor_id)] ?? null : null,
        post: n.post_id ? postsById[String(n.post_id)] ?? null : null,
      }))
    }

    const nextCursor = enriched.length ? enriched[enriched.length - 1].created_at : null
    return res.json(buildPage(enriched, nextCursor))
  } catch {
    return err(res, 500, 'server_error')
  }
})

const markReadSchema = z.object({
  ids: z.array(z.string()).min(1).optional(),
})

router.post('/read', requireAuth, async (req: Request, res: Response) => {
  const parsed = markReadSchema.safeParse(req.body)
  if (!parsed.success) return err(res, 400, 'invalid_payload')
  if (!req.user) return err(res, 401, 'unauthorized')
  const supabase = getRlsClient(req.user.sb)
  if (!supabase) return res.json({ ok: true })
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
    if (error) return err(res, 500, 'mark_read_failed')
    return res.json({ ok: true })
  } catch {
    return err(res, 500, 'server_error')
  }
})
