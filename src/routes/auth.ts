import { Router, Request, Response } from 'express'
import { z } from 'zod'
import jwt from 'jsonwebtoken'
import { supabaseAdmin, getRlsClient } from '../lib/supabase'

export const router = Router()

const err = (res: Response, status: number, code: string, message?: string, details?: any) =>
  res.status(status).json({ error: { code, message: message ?? code, details } })

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
  if (!parsed.success) return err(res, 400, 'invalid_payload')
  const secret = process.env.JWT_SECRET
  if (!secret) return err(res, 500, 'jwt_not_configured')
  // Create auth user, then profile row with the same id
  if (!supabaseAdmin) return err(res, 500, 'supabase_not_configured')
  try {
    const created = await supabaseAdmin.auth.admin.createUser({
      email: parsed.data.email,
      password: parsed.data.password,
      email_confirm: true,
    })
    const authUser = created.data?.user
    if (!authUser) {
      const msg = created.error?.message || 'auth create failed'
      return err(res, 500, 'auth_create_failed', undefined, msg)
    }
    const authUserId = authUser.id
    // Sign in to obtain a Supabase access token for RLS-bound profile insert
    const signIn = await supabaseAdmin.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    })
    const accessToken = signIn.data?.session?.access_token
    const supabaseRls = getRlsClient(accessToken)
    const insertProfile = await supabaseRls
      ?.from('users')
      .insert({ id: authUserId, handle: parsed.data.handle, display_name: parsed.data.handle })
      .select('id, handle')
      .single()
    const insertErr = (insertProfile as any)?.error
    const insertData = (insertProfile as any)?.data
    if (insertErr || !insertData) {
      const msg = insertErr?.message || 'profile insert failed'
      // Roll back auth user to avoid orphan if handle conflict or other failure
      try {
        await supabaseAdmin.auth.admin.deleteUser(authUserId)
      } catch {}
      if (msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('unique')) {
        return err(res, 409, 'handle_taken')
      }
      return err(res, 500, 'profile_create_failed', undefined, msg)
    }
    const userId = String(insertData.id)
    const token = jwt.sign({ sub: userId, handle: insertData.handle, sb: accessToken }, secret, {
      expiresIn: '7d',
    })
    return res.status(201).json({
      token,
      user: { id: userId, handle: insertData.handle, email: parsed.data.email },
    })
  } catch (e) {
    console.error('Signup with Supabase Auth failed:', e)
    return err(res, 500, 'signup_failed', undefined, String(e))
  }
})

router.post('/login', async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) return err(res, 400, 'invalid_payload')
  const secret = process.env.JWT_SECRET
  if (!secret) return err(res, 500, 'jwt_not_configured')
  if (!supabaseAdmin) return err(res, 500, 'supabase_not_configured')
  try {
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    })
    if (error || !data?.user) return err(res, 401, 'invalid_credentials')
    const userId = data.user.id
    // Ensure profile row exists (idempotent upsert by id with minimal defaults)
    await supabaseAdmin.from('users').upsert(
      {
        id: userId,
        handle: parsed.data.email.split('@')[0],
        display_name: parsed.data.email.split('@')[0],
      },
      { onConflict: 'id' }
    )
    const token = jwt.sign(
      { sub: userId, handle: parsed.data.email.split('@')[0], sb: data.session?.access_token },
      secret,
      {
        expiresIn: '7d',
      }
    )
    return res.json({ token })
  } catch (e) {
    return err(res, 500, 'login_failed', undefined, String(e))
  }
})
