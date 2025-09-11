# Phase 02: Moderation & Security Hardening

## 1. Blueprint (Planned Scope)

Focus: Trust & Safety, Security depth, richer data model usage.

### Moderation & Safety
- Block / mute / report users (expand with persistence & querying /status).
- Banned-word filters (content preprocessing layer).
- Shadowban & soft-delete propagation.
- Audit flags + event journaling (read interface planned here; write exists Phase 1).
- Reputation / risk scoring (placeholder design only if time).

### Security Enhancements
- JWT rotation & shorter lifetimes + refresh strategy (evaluate necessity with Supabase tokens).
- Session/device management (list + revoke sessions).
- Password breach (HIBP or local compromised hash list) check on signup/reset.
- Field-level encryption candidates (PII) threat model doc.
- Harden CSP (remove unsafe-inline if present; hash-based nonces).

### Media & Content Integrity
- Post-upload introspection (fetch HEAD / probe) to verify size & MIME.
- Thumbnail generation pipeline completion (worker invocation & metadata update).
- Multi-size media variants (deferred if time allows).

### Data Model Extensions
- Moderation state fields (posts.moderation_state, users.moderation_state).
- reports table enrichment (category, status, resolver_id, resolved_at, notes).

### Metrics & Observability Additions
- p95 / p99 latency tracking.
- Error rate (5xx) counter & per-route breakdown.
- Rate limit hit counter per action + Prometheus exposition.

### Documentation Updates
- Expand OpenAPI: moderation/report schemas, media metadata fields, rate limit headers globally documented.
- Architecture diagram (moderation flow, request pipeline) in /docs.

## 2. Success Criteria
- All moderation actions auditable & retrievable via admin endpoint.
- Media thumbnails generated automatically within acceptable latency (<30s async SLA).
- Enhanced metrics visible (latency percentiles, error & rate limit counters).
- OpenAPI fully reflects added schemas & headers.
- Security review checklist completed (CSP tightened, JWT decisions documented).

## 3. Implementation Outline
1. Extend DB schema (moderation fields, report enrichment).
2. Add thumbnail worker orchestration (queue or direct invocation + poll/update).
3. Implement admin audit retrieval (paginated, RBAC stub roles).
4. Introduce percentile metrics (histogram or manual reservoir sampling).
5. Add rate limit hit & error counters, update Prometheus exporter.
6. Integrate post-upload verification step before attaching media.
7. Harden CSP & document configuration.
8. Update OpenAPI & regenerate Postman artifacts.
9. Add integration tests for moderation filtering & audit retrieval.

## 4. Risks & Mitigations
- Redis unavailability: fall back to best-effort thumbnail status (mark pending longer).
- Large media: enforce strict size checks upfront + asynchronous probe.
- Abuse of report endpoint: basic rate limit or cooldown per user.

## 5. Out of Scope (Push to Later)
- Full text search / indexing (Phase 3+).
- Reputation scoring algorithm implementation.
- Real-time streaming of moderation events.

## 6. Entry Criteria for Phase 03
- Thumbnail pipeline stable & documented.
- Moderation endpoints + audit listing functional with tests.
- Updated OpenAPI published & consumed without regressions.

-- End Phase 02 Blueprint --
