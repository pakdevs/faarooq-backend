import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface JwtUser {
  sub: string // user id
  handle?: string
  sb?: string // Supabase access token for RLS
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

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : undefined
  if (!token) return res.status(401).json({ error: 'Missing bearer token' })
  const secret = process.env.JWT_SECRET
  if (!secret) return res.status(500).json({ error: 'JWT secret not configured' })
  try {
    const payload = jwt.verify(token, secret) as JwtUser
    req.user = payload
    return next()
  } catch {
    return res.status(401).json({ error: 'Invalid token' })
  }
}
