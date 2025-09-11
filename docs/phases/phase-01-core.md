# Phase 01: Core Platform

## 1. Blueprint (Original / Planned)

(Extracted from early master blueprint; trimmed to Phase 1 surface.)

- Auth: email/password signup & login; email verification; password reset; JWT auth; optional future OAuth.
- Profiles: username, display name, bio, avatar.
- Posts: text + up to 4 images; soft delete (author only); consistent error schema.
- Follows: follow / unfollow relationships.
- Feed: reverse-chronological from followed users; include repost activities; cursor pagination.
- Interactions: likes, reposts; notifications for likes, replies, follows (pull-based).
- Moderation (MVP): block, mute, report; authors can edit/delete own posts.
- Media Uploads: presigned URLs; validate size/type; thumbnail generation (planned stub initially).
- Rate Limiting: per-user & per-IP basic limits on write actions.
- Documentation: OpenAPI spec + Redoc docs.
- Testing: foundational test harness + initial critical path tests.

## 2. Architecture Snapshot

- Express + TypeScript backend.
- Supabase Postgres (RLS policies) as primary DB.
- Redis (optional) for rate limiting + audit log + future caching.
- S3/Cloudinary style presigned upload flow (abstracted; implementation stubs provided).
- JWT with jti for revocation; Redis-backed blacklist.
- OpenAPI-driven contract; Postman artifacts generated from spec.

## 3. Data Model (Implemented Tables)

users, posts (reply_to_post_id, deleted_at), follows, likes, reposts, notifications, media, blocks, mutes, reports.

Indexes: posts(created_at,id), posts(reply_to_post_id,created_at), posts(deleted_at,created_at), follows(follower_id,followee_id), notifications(user_id,created_at), likes(post_id,created_at), reposts(post_id,created_at).

## 4. Implemented (Final Deliverables)

- Project scaffold (Express + TS) & Supabase integration (RLS enabled).
- Auth: signup, login, JWT (7d), jti revocation (logout), resend verification, email verify confirm, password reset (request + complete).
- Profiles: /api/users/me get/update, avatar update.
- Posts: create, feed merge (posts + reposts), replies, update, soft-delete, single post fetch with concealment on block/mute.
- Interactions: likes, follows, reposts; notifications (like/follow/reply/repost) with self-reply skip logic.
- Moderation: block, mute, report (affects feed, reply visibility, notifications, single post view concealment).
- Media: signed upload URL, attach endpoint, metadata (MIME whitelist, size cap, dimensions/duration placeholders), thumb_pending flag; validation layer.
- Rate Limiting: per-user sliding window (Redis sorted set w/ in-memory fallback) + global IP limiter; standard headers & 429 schema.
- Observability: structured logging (pino), request IDs, metrics (JSON + Prometheus endpoints), audit log (Redis list) for moderation & key events.
- Security: helmet CSP, dynamic CORS, body size limit, standardized error schema; JWT revocation.
- Documentation: OpenAPI spec (auth, posts, interactions, moderation, media, metrics), Redoc UI, Postman collection/environment generation.
- Testing: Jest + ts-jest + supertest harness; tests for rate limiting, auth error shapes, basic posts guard; nanoid ESM mock.
- Deployment: render.yaml; env var contract documented; build script (tsc) to dist.
- Tooling: smoke scripts (scripts/smoke.mjs, scripts/reply-smoke.mjs); spec validation & Postman export scripts.

## 5. Deviations / Additions vs Initial Blueprint

- Added repost notifications & merged feed activities earlier than originally scoped.
- Added audit logging (not strictly Phase 1 baseline) for future moderation traceability.
- Introduced metrics & Prometheus exporter earlier (observability uplift).
- Standardized error schema across all routes (was a stretch goal initially).
- Implemented jti-based JWT revocation + logout endpoint (enhanced security beyond baseline).
- Added single post concealment logic for block/mute symmetry.

## 6. Pending / Deferred to Phase 2+

- Thumbnail generation orchestration (worker invocation, storage, updating media.meta.thumb_url, clearing thumb_pending).
- Deeper integration & behavior test suite (follows -> notifications, repost ordering, concealment assertions, media attach path, rate limit headers coverage).
- OAuth provider integration (GitHub/Google via Supabase Auth).
- Admin/audit retrieval endpoint (paginated, RBAC).
- Server-side post-upload media introspection & multi-size variants.
- OpenAPI refinements (document media metadata fields explicitly, rate limit headers, moderation/report schemas).
- Advanced metrics (p95 latency, error rate, per-action counters, rate limit hit/export details).
- Enhanced security: optional IP-based layered limiter, stricter CSP adjustments.
- Caching layer (profile & handle lookups).
- RBAC for audit/admin endpoints.

## 7. Entry Criteria for Phase 02 Start

Proceed when:

- Core endpoints stable (no schema churn for posts/auth/media basics).
- OpenAPI spec validated in CI (baseline pass) & used by consumers.
- Minimum test coverage on auth, posts creation/reply, rate limiting smoke.
- Deployment environment variables validated in staging.

## 8. Quality & Observability Snapshot

- Logging: structured JSON with request IDs.
- Metrics: request counters + latency sampling; Prometheus exposition ready for scrape.
- Rate Limiting: headers + structured 429 error schema in place.
- Audit Trail: append-only Redis list (write-only Phase 1).

## 9. Next Steps (Recommended Order)

1. Expand integration tests (stabilize behavior).
2. Implement thumbnail processing pipeline.
3. Add audit retrieval + RBAC.
4. Extend OpenAPI (metadata & moderation schemas, rate limit headers).
5. Add advanced metrics (p95/error rates).
6. Optional OAuth + caching layer.

## 10. Appendix

- Schema DDL: `sql/schema.sql`
- Seed Data: `sql/seed.sql`
- Spec: `openapi.json`
- Tests: `tests/`
- Scripts: `scripts/`

### Appendix A: Initial Project Structure Snapshot (Legacy)

```
faarook/
	backend/
		sql/
			schema.sql
			seed.sql
		src/
			server.ts
			lib/supabase.ts
			middleware/auth.ts
			routes/
				auth.ts
				users.ts
				posts.ts
				follows.ts
				likes.ts
				notifications.ts
			utils/pagination.ts
			types/models.ts
```

This snapshot originated from the deprecated `zebraCrossing/tree.md` and is retained here for historical context only.

-- End Phase 01 Document --
## 11. Actionable Checklist (Operationalized)

### Immediate Hardening
- [ ] Define SLOs (availability %, p95 latency target) & publish.
- [ ] Threat model & secret rotation policy doc.
- [ ] Idempotency key support for POST /api/posts & interactions.
- [ ] Event naming catalog (user.signup, post.created, post.liked, follow.created).
- [ ] x-api-version (v1) header + OpenAPI extension.

### Reliability Prep
- [ ] Chaos flag (CHAOS_PROB) in staging only.
- [ ] Central rate limit config JSON (source of truth for code + docs).

### Documentation
- [ ] Error code catalog table.
- [ ] Data retention matrix.

### Security
- [ ] CSP report-only week & analyze violations.
- [ ] JWT dual-secret rotation strategy.

### Testing
- [ ] Repost feed merge ordering test.
- [ ] Block/mute concealment test.

Unfinished items escalate to Phase 02 backlog if still open at cutover.

-- End Phase 01 Document --
