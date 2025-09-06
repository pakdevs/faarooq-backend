#!/usr/bin/env node
// Simple smoke test for the API (RLS + Supabase Auth path)
// Usage: node scripts/smoke.mjs https://your-service.onrender.com

const BASE = process.argv[2] || process.env.BASE
if (!BASE) {
  console.error('Usage: node scripts/smoke.mjs <BASE_URL>')
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

const rand = () => Math.random().toString(36).slice(2, 10)

async function main() {
  const out = { base: BASE }
  // Health
  out.health = await req('GET', '/health')

  // A signup
  const emailA = `${rand()}@ex.com`
  const handleA = `smokeA_${rand()}`
  const signupA = await req('POST', '/api/auth/signup', {
    email: emailA,
    password: 'Password#123',
    handle: handleA,
  })
  const tokenA = signupA.token
  const userA = signupA.user

  // A me
  const meA0 = await req('GET', '/api/users/me', null, tokenA)
  // A update display name
  const newName = `Tester ${rand()}`
  const meA1 = await req('PUT', '/api/users/me', { display_name: newName }, tokenA)

  // A post
  const postA = await req('POST', '/api/posts', { text: 'Hello from smoke A' }, tokenA)

  // B signup
  const emailB = `${rand()}@ex.com`
  const handleB = `smokeB_${rand()}`
  const signupB = await req('POST', '/api/auth/signup', {
    email: emailB,
    password: 'Password#123',
    handle: handleB,
  })
  const tokenB = signupB.token

  // B follow A
  await req('POST', `/api/follows/${userA.id}/follow`, null, tokenB)
  const feedB = await req('GET', '/api/posts', null, tokenB)

  // B like A's post
  await req('POST', `/api/likes/${postA.id}/like`, null, tokenB)

  // A notifications
  const notifsA = await req('GET', '/api/notifications', null, tokenA)

  const summary = {
    base: BASE,
    health: out.health.ok,
    userA: { id: userA.id, handle: userA.handle },
    meUpdatedName: meA1.display_name,
    postA: postA.id,
    feedBCount: feedB.items?.length ?? 0,
    notifsA: notifsA.items
      ?.map((n) => ({ kind: n.kind, hasActor: !!n.actor, hasPost: !!n.post }))
      .slice(0, 3),
  }
  console.log(JSON.stringify(summary, null, 2))
}

main().catch((e) => {
  console.error('SMOKE FAILED:', e.message, e.data || '')
  process.exit(1)
})
