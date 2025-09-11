import { Router, Request, Response } from 'express'
import { z } from 'zod'
import jwt from 'jsonwebtoken'
import { nanoid } from 'nanoid'
import { getRedis } from '../lib/redis'
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
    const jti = nanoid()
    const token = jwt.sign(
      { sub: userId, handle: insertData.handle, sb: accessToken, jti },
      secret,
      {
        expiresIn: '7d',
      }
    )
    const redis = getRedis()
    if (redis) await redis.set(`jti:${jti}`, '1', 'EX', 7 * 24 * 3600)
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
    const jti = nanoid()
    const token = jwt.sign(
      { sub: userId, handle: parsed.data.email.split('@')[0], sb: data.session?.access_token, jti },
      secret,
      { expiresIn: '7d' }
    )
    const redis = getRedis()
    if (redis) await redis.set(`jti:${jti}`, '1', 'EX', 7 * 24 * 3600)
    return res.json({ token })
  } catch (e) {
    return err(res, 500, 'login_failed', undefined, String(e))
  }
})

// Request password reset (Supabase will email magic link if configured)
const resetRequestSchema = z.object({ email: z.string().email() })
router.post('/password/reset/request', async (req: Request, res: Response) => {
  const parsed = resetRequestSchema.safeParse(req.body)
  if (!parsed.success) return err(res, 400, 'invalid_payload')
  if (!supabaseAdmin) return err(res, 500, 'supabase_not_configured')
  try {
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: process.env.PASSWORD_RESET_REDIRECT_URL,
    })
    if (error) return err(res, 400, 'reset_request_failed')
    return res.status(200).json({ ok: true })
  } catch (e) {
    return err(res, 500, 'reset_request_failed', undefined, String(e))
  }
})

// Complete password reset (after user comes back with access token from email)
const resetCompleteSchema = z.object({
  access_token: z.string().min(10),
  new_password: z.string().min(8),
})
router.post('/password/reset/complete', async (req: Request, res: Response) => {
  const parsed = resetCompleteSchema.safeParse(req.body)
  if (!parsed.success) return err(res, 400, 'invalid_payload')
  if (!supabaseAdmin) return err(res, 500, 'supabase_not_configured')
  try {
    // Create a temporary client with the provided access token to update password
    const tempClient = getRlsClient(parsed.data.access_token)
    if (!tempClient) return err(res, 500, 'supabase_not_configured')
    // @ts-ignore - supabase-js v2: updateUser
    const { error } = await tempClient.auth.updateUser({ password: parsed.data.new_password })
    if (error) return err(res, 400, 'reset_failed')
    return res.status(200).json({ ok: true })
  } catch (e) {
    return err(res, 500, 'reset_failed', undefined, String(e))
  }
})

// Logout: revoke token by deleting jti (if using Redis) – client should discard token regardless
router.post('/logout', async (req: Request, res: Response) => {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : undefined
  if (!token) return err(res, 401, 'missing_token')
  const secret = process.env.JWT_SECRET
  if (!secret) return err(res, 500, 'jwt_not_configured')
  try {
    const payload = jwt.verify(token, secret) as any
    const jti = payload.jti
    const redis = getRedis()
    if (redis && jti) await redis.del(`jti:${jti}`)
    return res.json({ ok: true })
  } catch {
    return err(res, 401, 'invalid_token')
  }
})

// Resend email verification (Supabase handles email sending)
const resendSchema = z.object({ email: z.string().email() })
router.post('/verify/resend', async (req: Request, res: Response) => {
  const parsed = resendSchema.safeParse(req.body)
  if (!parsed.success) return err(res, 400, 'invalid_payload')
  if (!supabaseAdmin) return err(res, 500, 'supabase_not_configured')
  try {
    // Supabase does not expose a direct resend endpoint in v2 SDK; workaround:
    // attempt signInWithOtp which (if email not confirmed) re-sends a magic link / verification depending on project settings.
    const { error } = await supabaseAdmin.auth.signInWithOtp({ email: parsed.data.email })
    if (error) return err(res, 400, 'resend_failed')
    return res.status(200).json({ ok: true })
  } catch (e) {
    return err(res, 500, 'resend_failed', undefined, String(e))
  }
})

// Finalize email verification (optional convenience endpoint). Client posts the access token they
// received from the Supabase verification link redirect (if configured). We simply validate it.
const verifyCompleteSchema = z.object({ access_token: z.string().min(10) })
router.post('/verify/confirm', async (req: Request, res: Response) => {
  const parsed = verifyCompleteSchema.safeParse(req.body)
  if (!parsed.success) return err(res, 400, 'invalid_payload')
  if (!supabaseAdmin) return err(res, 500, 'supabase_not_configured')
  try {
    const temp = getRlsClient(parsed.data.access_token)
    if (!temp) return err(res, 500, 'supabase_not_configured')
    // Fetch current user using the provided token to ensure it is valid and email confirmed.
    // @ts-ignore - supabase-js v2 shape
    const { data, error } = await temp.auth.getUser()
    if (error || !data?.user) return err(res, 401, 'invalid_token')
    if (!(data.user as any).email_confirmed_at) {
      return err(res, 400, 'email_not_confirmed')
    }
    return res.json({ ok: true })
  } catch (e) {
    return err(res, 500, 'verify_failed', undefined, String(e))
  }
})
