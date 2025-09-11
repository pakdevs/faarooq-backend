## Implementation Log

This file tracks significant implementation milestones and updates.

### Core Phase

- Express + TypeScript project scaffold
- Supabase integration (RLS + admin client)
- Auth: signup, login, JWT issuance
- Profiles: /api/users/me get/update
- Posts: create, feed, replies, update, soft-delete, single post fetch (conceal on block/mute)
- Interactions: likes, follows, reposts, notifications (like/follow/reply/repost)
- Moderation: block, mute, report
- Rate limiting: per-user sliding window (Redis optional) + global express-rate-limit
- Media: signed upload URL + attach endpoint

### Hardening & Observability

- Structured logging (pino) + request IDs
- Metrics middleware (JSON + Prometheus exposition)
- Audit logging (Redis list)
- Security: helmet CSP, dynamic CORS, body size limits
- Token revocation via JWT jti + Redis; logout endpoint

### Enhancements

- Repost notifications & merged feed activities
- Avatar update endpoint
- Password reset request/complete flows
- Resend email verification endpoint
- Email verify confirm endpoint (/api/auth/verify/confirm)
- Media validation (MIME whitelist, size cap) + metadata & thumbnail pending flag
- Thumbnail worker scaffold using Sharp
- Auth middleware standardized error codes (auth_missing_token, auth_invalid_token, etc.)

### Documentation & Spec

- OpenAPI spec (openapi.json) with reused error schema & security scheme
- Redoc docs route /docs
- Implemented.md (this file) introduced for change tracking

### Testing

- Jest + ts-jest + supertest harness
- Tests added: rate limiter, auth error shapes, basic posts guard

### Pending / Next

- Deeper integration tests (media attach, follows, moderation filters)
- Thumbnail generation orchestration & media row update
- OAuth provider (optional)
- Extended media transformations & size enforcement server-side
- More OpenAPI coverage for new media metadata fields
