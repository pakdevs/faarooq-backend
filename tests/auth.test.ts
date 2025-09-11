import request from 'supertest'
import express from 'express'
// Mock nanoid before importing auth router to avoid ESM parsing of nanoid in test env
jest.mock('nanoid', () => ({ nanoid: () => 'test-jti' }))
import { router as authRouter } from '../src/routes/auth'
import { requireAuth } from '../src/middleware/auth'

// Minimal JWT secret for tests
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret'

const app = express()
// Cast to any to bypass transient Express type inference issue in isolated test context
app.use(express.json() as any)
app.use('/api/auth', authRouter)

// NOTE: These tests assume Supabase admin client is not configured; signup/login will 500.
// We focus on middleware error shape without real Supabase.

describe('auth middleware & routes basic', () => {
  it('rejects missing bearer token', async () => {
    const secured = express()
    secured.get('/secure', requireAuth as any, (_req, res) => res.json({ ok: true }))
    const resp = await request(secured).get('/secure')
    expect(resp.status).toBe(401)
    expect(resp.body?.error?.code).toBe('auth_missing_token')
  })

  it('rejects invalid token', async () => {
    const secured = express()
    secured.get('/secure', requireAuth as any, (_req, res) => res.json({ ok: true }))
    const resp = await request(secured).get('/secure').set('Authorization', 'Bearer badtoken')
    expect(resp.status).toBe(401)
    expect(resp.body?.error?.code).toBe('auth_invalid_token')
  })
})
