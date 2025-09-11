import { Request, Response, NextFunction } from 'express'

interface Sample {
  path: string
  method: string
  status: number
  ms: number
}

// Simple counters (increment only) — not window trimmed except for latency samples
const counters: Record<string, number> = {
  requests_total: 0,
  rate_limit_hits_total: 0,
}

const WINDOW = 60_000
const samples: Sample[] = []

export function metricsMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = performance.now()
    res.on('finish', () => {
      const ms = performance.now() - start
      samples.push({
        path: req.route?.path || req.path,
        method: req.method,
        status: res.statusCode,
        ms,
      })
      counters.requests_total++
      // drop old
      const cutoff = Date.now() - WINDOW
      while (samples.length && Date.now() - WINDOW > cutoff) {
        samples.shift()
      }
    })
    next()
  }
}

export function metricsSnapshot() {
  // Aggregate avg latency per method+path last WINDOW
  const cutoff = Date.now() - WINDOW
  const recent = samples.filter((s) => Date.now() - cutoff <= WINDOW)
  const keyAgg: Record<string, { count: number; total: number }> = {}
  for (const s of recent) {
    const k = `${s.method} ${s.path}`
    keyAgg[k] ||= { count: 0, total: 0 }
    keyAgg[k].count++
    keyAgg[k].total += s.ms
  }
  const perRoute = Object.entries(keyAgg).map(([k, v]) => ({
    key: k,
    count: v.count,
    avgMs: v.total / v.count,
  }))
  return { routes: perRoute, counters }
}

export function incRateLimitHit() {
  counters.rate_limit_hits_total++
}

export function metricsPrometheus() {
  const snap = metricsSnapshot()
  const lines: string[] = []
  lines.push('# HELP app_requests_total Total HTTP requests processed')
  lines.push('# TYPE app_requests_total counter')
  lines.push(`app_requests_total ${snap.counters.requests_total}`)
  lines.push('# HELP app_rate_limit_hits_total Total rate limit (429) responses')
  lines.push('# TYPE app_rate_limit_hits_total counter')
  lines.push(`app_rate_limit_hits_total ${snap.counters.rate_limit_hits_total}`)
  lines.push('# HELP app_route_avg_ms Average latency ms over rolling window per route')
  lines.push('# TYPE app_route_avg_ms gauge')
  for (const r of snap.routes) {
    const [method, path] = r.key.split(' ')
    const safePath = path.replace(/"/g, '')
    lines.push(`app_route_avg_ms{method="${method}",path="${safePath}"} ${r.avgMs.toFixed(2)}`)
  }
  return lines.join('\n') + '\n'
}
