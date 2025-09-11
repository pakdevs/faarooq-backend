import request from 'supertest'
import express from 'express'
import { rateUser } from '../src/middleware/rateUser'

// Minimal app for test
const app = express()
app.use((req, _res, next) => {
  ;(req as any).user = { sub: 'user1' }
  next()
})
app.post('/action', rateUser({ action: 'test_action', limit: 3, windowMs: 1000 }), (_req, res) => {
  res.json({ ok: true })
})

describe('rateUser middleware', () => {
  it('enforces limit and returns 429 after threshold', async () => {
    const r1 = await request(app).post('/action')
    expect(r1.status).toBe(200)
    await request(app).post('/action')
    await request(app).post('/action')
    const r4 = await request(app).post('/action')
    expect(r4.status).toBe(429)
    expect(r4.headers['x-ratelimit-remaining']).toBe('0')
  })
})
