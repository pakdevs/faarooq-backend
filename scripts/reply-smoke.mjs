#!/usr/bin/env node
// Reply flow smoke test: signup A -> post -> signup B -> reply -> A notifications include 'reply'

const BASE = process.argv[2] || process.env.BASE
if (!BASE) {
  console.error('Usage: node scripts/reply-smoke.mjs <BASE_URL>')
  process.exit(1)
}

const j = (o) => JSON.stringify(o)

async function req(method, path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? j(body) : undefined,
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) {
    const err = new Error(`${method} ${path} -> ${res.status}`)
    err.data = data
    throw err
  }
  return data
}

const rand = () => Math.random().toString(36).slice(2, 8)

;(async () => {
  // A signup
  const a = rand()
  const sa = await req('POST', '/api/auth/signup', { email: `a_${a}@ex.com`, password: 'Password#123', handle: `a_${a}` })
  const tokenA = sa.token
  // A creates root post
  const postA = await req('POST', '/api/posts', { text: 'root post' }, tokenA)
  // B signup
  const b = rand()
  const sb = await req('POST', '/api/auth/signup', { email: `b_${b}@ex.com`, password: 'Password#123', handle: `b_${b}` })
  const tokenB = sb.token
  // B replies to A
  await req('POST', `/api/posts/${postA.id}/reply`, { text: 'a reply' }, tokenB)
  // A notifications
  const notifsA = await req('GET', '/api/notifications', null, tokenA)
  const summary = {
    base: BASE,
    replyKinds: notifsA.items?.filter((n) => n.kind === 'reply').length || 0,
  }
  console.log(JSON.stringify(summary, null, 2))
})().catch((e) => {
  console.error('REPLY SMOKE FAILED:', e.message, e.data || '')
  process.exit(1)
})
