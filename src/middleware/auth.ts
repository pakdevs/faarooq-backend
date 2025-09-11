import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { getRedis } from '../lib/redis'

export interface JwtUser {
  sub: string // user id
  handle?: string
  sb?: string // Supabase access token for RLS
  role?: string // 'admin' | 'user'
  iat?: number
  exp?: number
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtUser
    }
  }
}

const authErr = (res: Response, code: string, status = 401, message?: string, details?: any) =>
  res.status(status).json({ error: { code, message: message ?? code, details } })

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : undefined
  if (!token) return authErr(res, 'auth_missing_token')
  const secret = process.env.JWT_SECRET
  if (!secret) return authErr(res, 'auth_misconfigured', 500, 'JWT secret not configured')
  try {
    const payload = jwt.verify(token, secret) as JwtUser & { jti?: string }
    const redis = getRedis()
    if (redis && payload?.jti) {
      try {
        const exists = await redis.get(`jti:${payload.jti}`)
        if (!exists) return authErr(res, 'auth_token_revoked')
      } catch (e) {
        // Redis failure should not hard fail auth; log to console and continue
        console.warn('Redis error during token revocation check', e)
      }
    }
    req.user = payload
    return next()
  } catch {
    return authErr(res, 'auth_invalid_token')
  }
}
