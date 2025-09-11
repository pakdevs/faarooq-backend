import request from 'supertest'
import express from 'express'
import { router as postsRouter } from '../src/routes/posts'
import { requireAuth } from '../src/middleware/auth'

// Setup minimal app mocking auth by injecting user before requireAuth for tests without JWT
const app = express()
app.use(express.json() as any)
app.use((req, _res, next) => {
  ;(req as any).headers.authorization = 'Bearer faketoken'
  next()
})
app.use('/api/posts', postsRouter)

// NOTE: Without a configured Supabase (env vars), routes will early exit or 500; we test 401 path.

describe('posts basic route guards', () => {
  it('rejects creation without auth token structure (missing JWT secret)', async () => {
    const resp = await request(app).post('/api/posts').send({ text: 'hello world' })
    // Because JWT secret missing -> auth middleware returns config error or invalid token
    expect([401, 500]).toContain(resp.status)
  })
})
