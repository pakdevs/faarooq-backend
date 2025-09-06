import { Router, Request, Response } from 'express'
import { z } from 'zod'
import jwt from 'jsonwebtoken'
import { customAlphabet } from 'nanoid'

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

router.post('/signup', (req: Request, res: Response) => {
  const parsed = signupSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' })
  const secret = process.env.JWT_SECRET
  if (!secret) return res.status(500).json({ error: 'JWT secret not configured' })
  // Stub user creation; replace with Supabase insert + password hashing
  const nano = customAlphabet('1234567890abcdef', 16)
  const userId = nano()
  const token = jwt.sign({ sub: userId, handle: parsed.data.handle }, secret, { expiresIn: '7d' })
  return res
    .status(201)
    .json({ token, user: { id: userId, handle: parsed.data.handle, email: parsed.data.email } })
})

router.post('/login', (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' })
  const secret = process.env.JWT_SECRET
  if (!secret) return res.status(500).json({ error: 'JWT secret not configured' })
  // Stub login; replace with Supabase user lookup + bcrypt compare
  const nano = customAlphabet('1234567890abcdef', 16)
  const userId = nano()
  const token = jwt.sign({ sub: userId, handle: parsed.data.email.split('@')[0] }, secret, {
    expiresIn: '7d',
  })
  return res.json({ token })
})
