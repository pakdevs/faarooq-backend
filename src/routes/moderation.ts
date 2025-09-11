import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/auth'
import { getRlsClient } from '../lib/supabase'
import { z } from 'zod'
import { rateUser } from '../middleware/rateUser'
import { audit } from '../lib/audit'
import { getRedis } from '../lib/redis'

export const router = Router()

const err = (res: Response, status: number, code: string, message?: string, details?: any) =>
  res.status(status).json({ error: { code, message: message ?? code, details } })

const targetSchema = z.object({ user_id: z.string().uuid() })
const reportSchema = z
  .object({
    user_id: z.string().uuid().optional(),
    post_id: z.string().uuid().optional(),
    reason: z.string().min(3).max(500),
  })
  .refine((d) => d.user_id || d.post_id, { message: 'user_id or post_id required' })

// Block a user
router.post(
  '/block',
  requireAuth,
  rateUser({ action: 'block', limit: 30, windowMs: 60_000 }),
  async (req: Request, res: Response) => {
    if (!req.user) return err(res, 401, 'unauthorized')
    const supabase = getRlsClient(req.user.sb)
    if (!supabase) return err(res, 500, 'supabase_not_configured')
    const parsed = targetSchema.safeParse(req.body)
    if (!parsed.success) return err(res, 400, 'invalid_payload')
    if (parsed.data.user_id === req.user.sub) return err(res, 400, 'cannot_block_self')
    try {
      const { error } = await supabase
        .from('blocks')
        .upsert(
          { blocker_id: req.user.sub, blocked_id: parsed.data.user_id },
          { onConflict: 'blocker_id,blocked_id' }
        )
      if (error) return err(res, 400, 'block_failed')
      audit('block_user', { actor: req.user.sub, target: parsed.data.user_id })
      // Insert moderation action (best effort)
      try {
        await supabase.from('moderation_actions').insert({
          action_type: 'block',
          actor_id: req.user.sub,
          target_type: 'user',
          target_id: parsed.data.user_id,
          context_json: { source: 'api' },
        })
      } catch {}
      return res.status(201).json({ ok: true })
    } catch {
      return err(res, 500, 'server_error')
    }
  }
)

router.post('/unblock', requireAuth, async (req: Request, res: Response) => {
  if (!req.user) return err(res, 401, 'unauthorized')
  const supabase = getRlsClient(req.user.sb)
  if (!supabase) return res.status(200).json({ ok: true })
  const parsed = targetSchema.safeParse(req.body)
  if (!parsed.success) return err(res, 400, 'invalid_payload')
  try {
    const { error } = await supabase
      .from('blocks')
      .delete()
      .eq('blocker_id', req.user.sub)
      .eq('blocked_id', parsed.data.user_id)
    if (error) return err(res, 400, 'unblock_failed')
    audit('unblock_user', { actor: req.user.sub, target: parsed.data.user_id })
    try {
      await supabase.from('moderation_actions').insert({
        action_type: 'unblock',
        actor_id: req.user.sub,
        target_type: 'user',
        target_id: parsed.data.user_id,
        context_json: { source: 'api' },
      })
    } catch {}
    return res.status(200).json({ ok: true })
  } catch {
    return err(res, 500, 'server_error')
  }
})

// Mute a user
router.post(
  '/mute',
  requireAuth,
  rateUser({ action: 'mute', limit: 60, windowMs: 60_000 }),
  async (req: Request, res: Response) => {
    if (!req.user) return err(res, 401, 'unauthorized')
    const supabase = getRlsClient(req.user.sb)
    if (!supabase) return err(res, 500, 'supabase_not_configured')
    const parsed = targetSchema.safeParse(req.body)
    if (!parsed.success) return err(res, 400, 'invalid_payload')
    if (parsed.data.user_id === req.user.sub) return err(res, 400, 'cannot_mute_self')
    try {
      const { error } = await supabase
        .from('mutes')
        .upsert(
          { muter_id: req.user.sub, muted_id: parsed.data.user_id },
          { onConflict: 'muter_id,muted_id' }
        )
      if (error) return err(res, 400, 'mute_failed')
  audit('mute_user', { actor: req.user.sub, target: parsed.data.user_id })
      try {
        await supabase.from('moderation_actions').insert({
          action_type: 'mute',
          actor_id: req.user.sub,
          target_type: 'user',
          target_id: parsed.data.user_id,
          context_json: { source: 'api' },
        })
      } catch {}
      return res.status(201).json({ ok: true })
    } catch {
      return err(res, 500, 'server_error')
    }
  }
)

router.post('/unmute', requireAuth, async (req: Request, res: Response) => {
  if (!req.user) return err(res, 401, 'unauthorized')
  const supabase = getRlsClient(req.user.sb)
  if (!supabase) return res.status(200).json({ ok: true })
  const parsed = targetSchema.safeParse(req.body)
  if (!parsed.success) return err(res, 400, 'invalid_payload')
  try {
    const { error } = await supabase
      .from('mutes')
      .delete()
      .eq('muter_id', req.user.sub)
      .eq('muted_id', parsed.data.user_id)
    if (error) return err(res, 400, 'unmute_failed')
    audit('unmute_user', { actor: req.user.sub, target: parsed.data.user_id })
    try {
      await supabase.from('moderation_actions').insert({
        action_type: 'unmute',
        actor_id: req.user.sub,
        target_type: 'user',
        target_id: parsed.data.user_id,
        context_json: { source: 'api' },
      })
    } catch {}
    return res.status(200).json({ ok: true })
  } catch {
    return err(res, 500, 'server_error')
  }
})

// Report content
router.post(
  '/report',
  requireAuth,
  rateUser({ action: 'report', limit: 30, windowMs: 60_000 }),
  async (req: Request, res: Response) => {
    if (!req.user) return err(res, 401, 'unauthorized')
    const supabase = getRlsClient(req.user.sb)
    if (!supabase) return err(res, 500, 'supabase_not_configured')
    const parsed = reportSchema.safeParse(req.body)
    if (!parsed.success) return err(res, 400, 'invalid_payload')
    if (parsed.data.user_id === req.user.sub) return err(res, 400, 'cannot_report_self')
    try {
      const { error } = await supabase.from('reports').insert({
        reporter_id: req.user.sub,
        target_user_id: parsed.data.user_id ?? null,
        post_id: parsed.data.post_id ?? null,
        reason: parsed.data.reason,
      })
      if (error) return err(res, 400, 'report_failed')
      audit('report', { actor: req.user.sub, user: parsed.data.user_id, post: parsed.data.post_id })
      try {
        await supabase.from('moderation_actions').insert({
          action_type: 'report',
          actor_id: req.user.sub,
          target_type: parsed.data.post_id ? 'post' : 'user',
          target_id: parsed.data.post_id || parsed.data.user_id,
          context_json: { reason: parsed.data.reason },
        })
      } catch {}
      return res.status(201).json({ ok: true })
    } catch {
      return err(res, 500, 'server_error')
    }
  }
)

// Admin: fetch audit events from Redis list (simple pagination via start offset)
router.get('/audit', requireAuth, async (req: Request, res: Response) => {
  if (!req.user) return err(res, 401, 'unauthorized')
  if (req.user.role !== 'admin') return err(res, 403, 'forbidden')
  const redis = getRedis()
  if (!redis) return res.json({ events: [], nextOffset: null })
  const limit = Math.min( Number(req.query.limit) || 50, 200)
  const offset = Number(req.query.offset) || 0
  try {
    const raw = await redis.lrange('audit:events', offset, offset + limit - 1)
    const events = raw
      .map((r: string) => {
        try {
          return JSON.parse(r)
        } catch {
          return null
        }
      })
      .filter(Boolean)
    const nextOffset = raw.length === limit ? offset + limit : null
    return res.json({ events, nextOffset })
  } catch {
    return err(res, 500, 'audit_fetch_failed')
  }
})
