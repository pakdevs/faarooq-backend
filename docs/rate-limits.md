# Rate Limiting

User-scoped sliding window limits are enforced per action using either:

1. Redis (production) - enabled when `REDIS_URL` env var is set.
2. In-memory fallback (development / absence of Redis).

Headers returned on limited routes:

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset` (unix seconds epoch when bucket resets)
- On 429: `Retry-After` in seconds.

Implementation details:

- Redis uses a sorted set `rl:<userId>:<actionKey>` with timestamps (ms) as score & member.
- Expiry is set to `windowMs + 5s` for cleanup.
- In-memory map structure mirrors behavior but is not shared across instances.

If Redis errors occur during a request, the middleware logs a warning and falls back to memory for that request.

## Metrics Integration

The middleware increments a global counter `rate_limit_hits_total` whenever a 429 is issued. All requests increment `requests_total` after completion. These counters, along with rolling 60s latency averages per route, are exposed at `/metrics` as JSON:

```
{
	"windowSeconds": 60,
	"counters": { "requests_total": 1234, "rate_limit_hits_total": 7 },
	"routes": [
		{ "key": "POST /api/posts", "count": 42, "avgMs": 18.5 }
	]
}
```

This lightweight endpoint is intended for quick debugging; for production-grade monitoring, adapt it to Prometheus exposition format or push metrics to an external system.
