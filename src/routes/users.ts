import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase'
import { requireAuth } from '../middleware/auth'
import { z } from 'zod'

export const router = Router()

router.get('/:id', async (req: Request, res: Response) => {
  const id = req.params.id
  if (!supabase) return res.json({ id, handle: 'stub', display_name: 'Stub' })
  const { data, error } = await supabase.from('users').select('*').eq('id', id).single()
  if (error || !data) return res.status(404).json({ error: 'User not found' })
  return res.json(data)
})

// Get current user's profile
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' })
  if (!supabase) return res.json({ id: req.user.sub, handle: 'stub', display_name: 'Stub' })
  const { data, error } = await supabase.from('users').select('*').eq('id', req.user.sub).single()
  if (error || !data) return res.status(404).json({ error: 'User not found' })
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
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' })
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' })
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
        return res.status(409).json({ error: 'Handle already taken' })
      }
      return res.status(500).json({ error: 'Failed to update profile' })
    }
    if (!data) return res.status(404).json({ error: 'User not found' })
    return res.json(data)
  } catch {
    return res.status(500).json({ error: 'Server error' })
  }
})
