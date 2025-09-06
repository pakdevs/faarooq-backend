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
  // Create or fetch a user row; use its id in the token
  let userId: string = randomUUID()
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('users')
        .upsert({ handle: parsed.data.handle, display_name: parsed.data.handle }, { onConflict: 'handle' })
        .select('id, handle')
        .single()
        if (error || !data) {
          console.error('Supabase users upsert failed:', error?.message)
          return res.status(500).json({ error: 'DB user create failed', detail: error?.message })
      }
  userId = String(data.id)
    } catch (e) {
        console.error('Supabase users upsert threw:', e)
        return res.status(500).json({ error: 'DB user create failed', detail: String(e) })
    }
  }
  const token = jwt.sign({ sub: userId, handle: parsed.data.handle }, secret, { expiresIn: '7d' })
  return res.status(201).json({ token, user: { id: userId, handle: parsed.data.handle, email: parsed.data.email } })
})

router.post('/login', (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' })
  const secret = process.env.JWT_SECRET
  if (!secret) return res.status(500).json({ error: 'JWT secret not configured' })
  // Stub login; replace with Supabase user lookup + bcrypt compare
  const userId = randomUUID()
  const token = jwt.sign({ sub: userId, handle: parsed.data.email.split('@')[0] }, secret, {
    expiresIn: '7d',
  })
  return res.json({ token })
})
