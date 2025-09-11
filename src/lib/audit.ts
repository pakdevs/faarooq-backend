import { getRedis } from './redis'

// Lightweight append-only audit log stored in Redis list (if available)
export async function audit(event: string, payload: Record<string, any>) {
  const redis = getRedis()
  if (!redis) return
  const entry = JSON.stringify({ ts: new Date().toISOString(), event, ...payload })
  try {
    await redis.lpush('audit:events', entry)
    await redis.ltrim('audit:events', 0, 5000) // keep last 5001 entries
  } catch {
    // swallow errors to avoid impacting request path
  }
}
