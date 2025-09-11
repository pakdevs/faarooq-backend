# Twitter-Like App Master Blueprint (Phased for AI)

---

<!-- PHASE 1 / MVP -->

## 1. Core MVP Scope (Updated / Hardening)

- **Auth:**

  - Email/password signup + login.
  - **Account recovery:** email verification + password reset.
  - JWT-based authentication.
  - Optional OAuth.

- **User Profiles:** username, display name, bio, avatar.

- **Posts:**

  - Text + optional images (1–4).
  - **Soft-delete:** only author can delete posts.
  - Standardized error schema (code/message/details) per action.

- **Follow/Unfollow:** simple relationships.

- **Timeline/Feed:**

  - Reverse-chronological from followed users.
  - Include repost activities from followees in the feed.
  - **Cursor-based pagination** enforced.

- **Interactions:**

  - Likes and reposts.
  - Basic notifications: likes/replies/follows.
  - Pull-based notifications for MVP.

- **Moderation (MVP):**

  - Block/mute/report.
  - Auth rules: only authors can edit/delete own posts.

- **Testing / Seeds:**

  - Tiny seed script for users, posts, and follows for dev/testing.

- **Rate Limiting:**
  - Basic rate limits per IP + user for write actions.

---

## 2. Backend Stack

- **Node.js + Express** (start MVP), optional NestJS later.
- **Database:** Supabase (PostgreSQL) with proper FKs and constraints.
- **Real-time:** Supabase Realtime or WebSockets for posts/likes/replies (later phases).
- **Caching/Queues (optional):** Redis / Upstash for feed scaling later.
- **Media Storage:** S3/Cloudinary with presigned URLs.
- **API Contract & Docs:** OpenAPI 3.0 file; serve spec at `/openapi.json` and human docs at `/docs` (Redoc). Validate spec in CI and auto-generate Postman artifacts.

---

## 3. Core API Endpoints & Schemas

### Users

- `POST /api/auth/signup` → { email, password, handle }
- `POST /api/auth/login` → { email, password }
- `POST /api/auth/verify-email` → email verification
- `POST /api/auth/password-reset` → reset password
- `GET /api/users/:id` → user profile

### Posts

- `POST /api/posts` → { text, media[] }
- `GET /api/posts?cursor=` → feed (reverse-chronological, includes repost activities; cursor-based pagination)
- `PUT /api/posts/:id` → update post (author only)
- `DELETE /api/posts/:id` → soft-delete (author only)

### Likes/Reposts

- Likes:
  - `POST /api/likes` → { post_id } (idempotent)
  - `DELETE /api/likes` → { post_id } (idempotent)
- Reposts:
  - `POST /api/reposts` → { post_id } (idempotent)
  - `DELETE /api/reposts` → { post_id } (idempotent)

### Follows

- `POST /api/follows/:id/follow`
- `POST /api/follows/:id/unfollow`

### Notifications

- `GET /api/notifications?cursor=` → feed notifications (likes/replies/follows, pull-based)
- Mark read

### Docs & Contract

- `GET /openapi.json` → OpenAPI spec
- `GET /docs` → Redoc-based docs UI

**Notes:** Cursor-based pagination everywhere, rate limits, minimal logging/error schemas, deduplication for likes/reposts.

---

## 4. Feed Strategy

- **MVP:** fan-in reverse-chronological from followed users.
- **Later:** fan-out-on-write, Redis caching, basic ranking.

---

## 5. Media Upload Flow

- Upload via **presigned URLs** to S3/Cloudinary.
- Validate size/type (JPEG/PNG, max 5MB).
- Sanitize inputs, generate thumbnails.

---

<!-- PHASE 2 / CORE BACKEND & MODERATION -->

## 6. Moderation & Safety

- Block/mute/report users.
- Banned-word filters, soft-delete, shadowban.
- Keep audit flags for admins.
- Reputation system optional for scaling.

---

## 7. Security

- Input validation, output encoding.
- JWT rotation/expiration.
- HTTPS enforced.
- CORS/CSRF for web frontend.
- Avoid SQL injection.
- Rate limits per IP + user + token.
- Password breach checks.
- Device/session management.
- Field-level encryption for PII.

---

## 8. Data Model (Tables)

- **users:** id, handle, display_name, bio, avatar_url, created_at
- **follows:** follower_id, followee_id, created_at (unique pair)
- **posts:** id, author_id, text, reply_to_post_id, created_at
  - optional: deleted_at (soft-delete)
- **media:** id, post_id, url, type
- **likes:** user_id, post_id, created_at (unique)
- **reposts:** user_id, post_id, created_at (unique)
- **notifications:** id, user_id, kind, actor_id, post_id, created_at, read_at

- Proper foreign keys, indexes:
  - posts: `(created_at, id)`
  - follows: `(follower_id, followee_id)` unique
  - likes/reposts: `(user_id, post_id)` unique
- Optional fields: bookmarks, threads (reply depth), edited_at, moderation_state, soft_delete_at.

---

<!-- PHASE 3 / FRONTEND, DEPLOYMENT & TESTING -->

## 9. Deployment

- **Web frontend:** Next.js on Vercel
- **API/Backend:** Node.js/Express on Render/Fly.io
- **Database:** Supabase/Postgres or Neon
- **Cache/Queues:** Upstash Redis
- **Media Storage:** Cloudinary / S3
- **Observability:** Sentry, logging, metrics
- **API Docs:** expose `/openapi.json` and `/docs` publicly (read-only)

---

## 10. Quality & Testing

- Postman/Insomnia collections for API testing.
- Unit tests for services.
- Contract tests (OpenAPI).
- End-to-end tests (Playwright).
- Load testing (k6).
- Seed data and fixture factories.
- Linting & code formatting.
- CI/CD from day one.
- CI: build + typecheck + OpenAPI spec validation. Generate and upload Postman collection + environment as build artifacts; optional publish to Postman with secrets.

---

<!-- PHASE 4 / OPTIONAL & ADVANCED FEATURES -->

## 11. Roadmap

**Phase 1 (2–3 weeks):**

- Auth, profiles, posts, feed, follow/unfollow, likes, basic notifications, Phase 1 hardening.

**Phase 2:**

- Media uploads, search, block/mute, reporting, admin tools.

**Phase 3:**

- Ranking, trending, hashtags, DMs, premium features.

---

## 12–17. Optional & Advanced Features

- AI-Assisted Coding Tips
- Error schemas & per-endpoint auth/permissions
- Idempotency & 429 rate-limit policies
- Backup/restore & data retention policies
- Advanced Production & Reliability
- Progressive Delivery & Operational Excellence
- Supabase Best Practices
- Additional Advanced Recommendations (security, scaling, UX, analytics, monetization, chaos testing, optional innovations)

---

**Usage Tip:**

- Start with **PHASE 1** sections first for Copilot to scaffold core features.
- Move sequentially to PHASE 2–4 as app grows.
- Optional/advanced features can be implemented gradually.
