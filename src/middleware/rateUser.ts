import { Request, Response, NextFunction } from 'express'
import { getRedis } from '../lib/redis'
import { incRateLimitHit } from './metrics'

interface Bucket {
  ts: number[] // millisecond timestamps
}

// In-memory map (fallback): userId -> action -> timestamps
const store: Map<string, Map<string, Bucket>> = new Map()

interface Options {
  action: string
  limit: number
  windowMs: number
  keyFn?: (req: Request) => string // optional additional dimension (e.g., per resource id)
  setHeaders?: boolean // default true to emit standard rate limit headers
}

const now = () => Date.now()

export function rateUser(opts: Options) {
  const redis = getRedis()
  const useRedis = !!redis
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.sub
    if (!userId) return res.status(401).json({ error: { code: 'unauthorized' } })
    const actionBase = opts.action
    const key = opts.keyFn ? `${actionBase}:${opts.keyFn(req)}` : actionBase
    const limit = opts.limit
    const windowMs = opts.windowMs
    const cutoff = now() - windowMs
    if (useRedis) {
      try {
        const redisKey = `rl:${userId}:${key}`
        const nowMs = now()
        // Use a Redis sorted set of timestamps
        // Remove old
        await redis!.zremrangebyscore(redisKey, 0, cutoff)
        const count = await redis!.zcard(redisKey)
        if (count >= limit) {
          const oldest = await redis!
            .zrange(redisKey, 0, 0)
            .then((r: string[]) => (r.length ? Number(r[0]) : nowMs))
          const retryMs = oldest + windowMs - nowMs
          if (opts.setHeaders ?? true) {
            res.setHeader('Retry-After', Math.ceil(retryMs / 1000))
            res.setHeader('X-RateLimit-Limit', String(limit))
            res.setHeader('X-RateLimit-Remaining', '0')
            res.setHeader('X-RateLimit-Reset', String(Math.ceil((oldest + windowMs) / 1000)))
          }
          incRateLimitHit()
          return res.status(429).json({
            error: {
              code: 'rate_limited',
              message: 'Too many requests',
              details: { action: actionBase, limit, windowMs },
            },
          })
        }
        // Add current timestamp with score = timestamp
        await redis!.zadd(redisKey, nowMs, String(nowMs))
        // Set expiry slightly larger than window
        await redis!.pexpire(redisKey, windowMs + 5000)
        const remaining = Math.max(0, limit - (count + 1))
        if (opts.setHeaders ?? true) {
          const firstTs = await redis!
            .zrange(redisKey, 0, 0)
            .then((r: string[]) => (r.length ? Number(r[0]) : nowMs))
          res.setHeader('X-RateLimit-Limit', String(limit))
          res.setHeader('X-RateLimit-Remaining', String(remaining))
          res.setHeader('X-RateLimit-Reset', String(Math.ceil((firstTs + windowMs) / 1000)))
        }
        return next()
      } catch (e) {
        // Fallback to in-memory on Redis error
        req.log?.warn({ err: e }, 'rate_limit_redis_error')
      }
    }
    // In-memory fallback path
    let userMap = store.get(userId)
    if (!userMap) {
      userMap = new Map()
      store.set(userId, userMap)
    }
    let bucket = userMap.get(key)
    if (!bucket) {
      bucket = { ts: [] }
      userMap.set(key, bucket)
    }
    bucket.ts = bucket.ts.filter((t) => t > cutoff)
    if (bucket.ts.length >= limit) {
      const retryMs = bucket.ts[0] + windowMs - now()
      if (opts.setHeaders ?? true) {
        res.setHeader('Retry-After', Math.ceil(retryMs / 1000))
        res.setHeader('X-RateLimit-Limit', String(limit))
        res.setHeader('X-RateLimit-Remaining', '0')
        res.setHeader('X-RateLimit-Reset', String(Math.ceil((bucket.ts[0] + windowMs) / 1000)))
      }
      incRateLimitHit()
      return res.status(429).json({
        error: {
          code: 'rate_limited',
          message: 'Too many requests',
          details: { action: actionBase, limit, windowMs },
        },
      })
    }
    bucket.ts.push(now())
    if (opts.setHeaders ?? true) {
      res.setHeader('X-RateLimit-Limit', String(limit))
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, limit - bucket.ts.length)))
      res.setHeader('X-RateLimit-Reset', String(Math.ceil((bucket.ts[0] + windowMs) / 1000)))
    }
    next()
  }
}

// Utility to expose current approximate usage (optional future endpoint)
export function _rateUserDebug() {
  return store
}
