## Implementation Log

This file tracks significant implementation milestones and updates.

### Core Phase

- Express + TypeScript project scaffold
- Supabase integration (RLS + admin client)
- Auth: signup, login, JWT issuance (7d expiry, jti for revocation)
- Profiles: /api/users/me get/update
- Posts: create, feed, replies, update, soft-delete, single post fetch (conceal on block/mute)
- Interactions: likes, follows, reposts, notifications (like/follow/reply/repost)
- Moderation: block, mute, report
- Rate limiting: per-user sliding window (Redis optional) + global express-rate-limit
- Media: signed upload URL + attach endpoint

### Database Schema & RLS

- Tables: users, posts (with reply_to_post_id, deleted_at), follows, likes, reposts, notifications, media, blocks, mutes, reports.
- RLS enabled across all user-generated content tables.
- Representative policies (naming may vary in SQL):
  - users: read_all, insert_own (auth.uid() = id), update_own.
  - posts: read_all (exclude soft-deleted), insert_own, update_own, soft_delete_own.
  - follows / likes / reposts: read_all, write_own (auth.uid() matches actor columns).
  - notifications: read_own (user_id), insert_actor (actor_id = auth.uid()).
  - media: insert_own via post ownership, read_all public.
  - moderation tables (blocks, mutes, reports): write_own & read_own as appropriate.
- Indexes (from schema): posts(created_at,id), posts(reply_to_post_id,created_at), posts(deleted_at,created_at), follows(follower_id,followee_id), notifications(user_id,created_at), likes(post_id,created_at), reposts(post_id,created_at).
- Seed scripts: `sql/schema.sql` (idempotent DDL) + `sql/seed.sql` (demo users, sample relationships).

### Hardening & Observability

- Structured logging (pino) + request IDs
- Metrics middleware (JSON + Prometheus exposition via /metrics & /metrics.prom)
- Audit logging (Redis list)
- Security: helmet CSP, dynamic CORS, body size limits
- Token revocation via JWT jti + Redis; logout endpoint
- Standardized error schema across routes
- Request/response redaction of Authorization header
- Audit log (Redis list) for moderation events, extensible to auth/media.

### Enhancements

- Repost notifications & merged feed activities
- Avatar update endpoint
- Password reset request/complete flows
- Resend email verification endpoint
- Email verify confirm endpoint (/api/auth/verify/confirm)
- Media validation (MIME whitelist, size cap) + metadata & thumbnail pending flag
- Thumbnail worker scaffold using Sharp
- Auth middleware standardized error codes (auth_missing_token, auth_invalid_token, etc.)
- Feed excludes blocked, blocked-me, muted users (posts & reposts)
- Single post concealment if either direction block/mute
- Reply notifications (skip self-reply)
- Repost notifications
- Avatar update endpoint (/api/users/me/avatar)
- Global JSON body size limit (env configurable)
- OpenAPI spec expanded (auth, posts, interactions, moderation, media, metrics, email verify confirm, logout)
- Smoke scripts (scripts/smoke.mjs, scripts/reply-smoke.mjs)
- Redis fallback to in-memory for rate limiting and audit (graceful degradation)

### Rate Limiting Details

- Per-user sliding window implemented via Redis sorted sets `rl:<userId>:<action>`; fallback to in-memory map when Redis unavailable.
- Headers on every limited route: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` (epoch seconds), and `Retry-After` on 429.
- 429 JSON body: `{ error: { code: 'rate_limited', message, details: { action, limit, windowMs } } }`.
- Global IP limiter (express-rate-limit) still active (120 req/min default).

### Documentation & Spec

- OpenAPI spec (openapi.json) with reused error schema & security scheme
- Redoc docs route /docs
- Implemented.md (this file) introduced for change tracking
- Postman collection & environment generated from OpenAPI (see `postman_collection.json`, `postman_environment.json`).
- JSON spec validation script `npm run spec:check`.

### Testing

- Jest + ts-jest + supertest harness
- Tests added: rate limiter, auth error shapes, basic posts guard
- Mocking nanoid in tests to avoid ESM import issue
- CI-friendly single-threaded test run (--runInBand)

### Deployment & Environment

- `render.yaml` config for Render deployment; health endpoint `/health`.
- Required env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `JWT_SECRET`, optional `REDIS_URL`, optional `GLOBAL_JSON_LIMIT`, `CORS_ORIGINS`.
- Production start command: `node dist/server.js` after `npm run build`.

### Tooling & CI

- Scripts: `scripts/exec-sql.mjs` (apply schema/seed), smoke tests (`scripts/smoke.mjs`, `scripts/reply-smoke.mjs`).
- OpenAPI to Postman & types generation: `npm run spec:postman`, `npm run spec:types`.
- Planned CI steps: lint, type-check, test, spec validation, Postman artifact generation (some configured locally, extend in pipeline).

### Pending / Next

- Deeper integration & behavior tests (follows flow, notifications enrichment assertions, media attach success path, block/mute filtration, repost merge ordering, single post concealment, rate limit headers)
- Thumbnail generation orchestration: invoke worker, upload/store thumbnail, update media.meta (thumb_url, thumb_pending=false)
- OAuth provider support (optional) – e.g., GitHub/Google via Supabase Auth
- Admin/audit retrieval endpoint (paginated read of audit:events)
- Media: server-side size/MIME verification post-upload (head fetch or storage metadata) & optional multi-size variants
- OpenAPI: document media metadata fields & rate limit headers, add schemas for moderation/report endpoints
- Additional metrics (p95 latency, error rate, per-action rate limit counters)
- Enhanced security: optional IP-based rate limit, stricter CSP refine, helmet updates
- Caching layer (e.g., user handle/id lookups) if needed for scaling
- Admin endpoint for audit log retrieval with pagination & RBAC
- OAuth provider integration (GitHub/Google) via Supabase Auth social providers
