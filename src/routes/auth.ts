import { Router, Request, Response } from 'express'
import { z } from 'zod'
import jwt from 'jsonwebtoken'
import { supabase } from '../lib/supabase'
import { randomUUID } from 'crypto'

export const router = Router()

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  handle: z.string().min(3).max(30),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

router.post('/signup', async (req: Request, res: Response) => {
  const parsed = signupSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' })
  const secret = process.env.JWT_SECRET
  if (!secret) return res.status(500).json({ error: 'JWT secret not configured' })
  // Create auth user, then profile row with the same id
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' })
  try {
    const created = await supabase.auth.admin.createUser({
      email: parsed.data.email,
      password: parsed.data.password,
      email_confirm: true,
    })
    const authUser = created.data?.user
    if (!authUser) {
      const msg = created.error?.message || 'auth create failed'
      return res.status(500).json({ error: 'Auth create failed', detail: msg })
    }
    const authUserId = authUser.id
    const insertProfile = await supabase
      .from('users')
      .insert({ id: authUserId, handle: parsed.data.handle, display_name: parsed.data.handle })
      .select('id, handle')
      .single()
    if (insertProfile.error || !insertProfile.data) {
      const msg = insertProfile.error?.message || 'profile insert failed'
      // Roll back auth user to avoid orphan if handle conflict or other failure
      try {
        await supabase.auth.admin.deleteUser(authUserId)
      } catch {}
      if (msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('unique')) {
        return res.status(409).json({ error: 'Handle already taken' })
      }
      return res.status(500).json({ error: 'DB user create failed', detail: msg })
    }
    const userId = String(insertProfile.data.id)
    const token = jwt.sign({ sub: userId, handle: insertProfile.data.handle }, secret, {
      expiresIn: '7d',
    })
    return res
      .status(201)
      .json({
        token,
        user: { id: userId, handle: insertProfile.data.handle, email: parsed.data.email },
      })
  } catch (e) {
    console.error('Signup with Supabase Auth failed:', e)
    return res.status(500).json({ error: 'Signup failed', detail: String(e) })
  }
})

router.post('/login', async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' })
  const secret = process.env.JWT_SECRET
  if (!secret) return res.status(500).json({ error: 'JWT secret not configured' })
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' })
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    })
    if (error || !data?.user) return res.status(401).json({ error: 'Invalid credentials' })
    const userId = data.user.id
    // Ensure profile row exists (idempotent upsert by id with minimal defaults)
    await supabase
      .from('users')
      .upsert(
        {
          id: userId,
          handle: parsed.data.email.split('@')[0],
          display_name: parsed.data.email.split('@')[0],
        },
        { onConflict: 'id' }
      )
    const token = jwt.sign({ sub: userId, handle: parsed.data.email.split('@')[0] }, secret, {
      expiresIn: '7d',
    })
    return res.json({ token })
  } catch (e) {
    return res.status(500).json({ error: 'Login failed', detail: String(e) })
  }
})
