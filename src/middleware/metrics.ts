import { Request, Response, NextFunction } from 'express'

interface Sample { path: string; method: string; status: number; ms: number }

// Simple latency histogram buckets (ms)
const LAT_BUCKETS = [50, 100, 200, 400, 800, 1600]
const histogram: Record<string, number> = {}
for (const b of LAT_BUCKETS) histogram[String(b)] = 0
histogram['+Inf'] = 0

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
      const routePath = req.route?.path || req.path
      samples.push({ path: routePath, method: req.method, status: res.statusCode, ms })
      counters.requests_total++
      // histogram bucket increment
      let bucketed = false
      for (const b of LAT_BUCKETS) {
        if (ms <= b) {
          histogram[String(b)]++
          bucketed = true
          break
        }
      }
      if (!bucketed) histogram['+Inf']++
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
  return { routes: perRoute, counters, histogram }
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
  lines.push('# HELP app_request_latency_ms Histogram of request latency (ms)')
  lines.push('# TYPE app_request_latency_ms histogram')
  let cumulative = 0
  for (const b of [...LAT_BUCKETS.map(String), '+Inf']) {
    cumulative += histogram[b]
    lines.push(`app_request_latency_ms_bucket{le="${b}"} ${cumulative}`)
  }
  // sum and count
  const totalCount = Object.values(histogram).reduce((a, b) => a + b, 0)
  // approximate sum using average of bucket upper bound (rough; refine later)
  let approxSum = 0
  let prev = 0
  for (const b of LAT_BUCKETS) {
    const c = histogram[String(b)]
    approxSum += c * b
    prev += c
  }
  approxSum += histogram['+Inf'] * (LAT_BUCKETS[LAT_BUCKETS.length - 1] * 1.5)
  lines.push(`app_request_latency_ms_sum ${approxSum.toFixed(2)}`)
  lines.push(`app_request_latency_ms_count ${totalCount}`)
  return lines.join('\n') + '\n'
}
