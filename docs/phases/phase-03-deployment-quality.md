# Phase 03: Deployment, Quality & Scaling Foundations

## 1. Blueprint (Planned Scope)

### Deployment & Runtime

- Production-grade deployment (Render/Fly) with staging + prod environments.
- CI/CD pipeline: build, lint, type-check, test, spec validate, artifact publish.
- Infrastructure as code stub (render.yaml already; extend or introduce Terraform later optional).

### Frontend Integration

- Public API consumption by Next.js frontend (basic timeline, post composer, profile, auth flows).
- CORS hardened with explicit allowlist.

### Quality & Test Coverage

- Integration test suite expansion (end-to-end flows: signup -> post -> like -> notification -> block concealment).
- Contract tests auto-generated from OpenAPI (ensure parity).
- Load test baseline (k6) for feed & post creation endpoints.

### Observability Expansion

- Tracing scaffold (OpenTelemetry instrumentation stub).
- Structured application events (user_signup, post_created, media_attached) emitted.
- Log sampling strategy documented.

### Performance & Scaling

- Introduce basic caching for hot profile lookups & rate limit configs.
- Evaluate feed query plans; add missing composite indexes if needed.

### Documentation & Developer Experience

- CONTRIBUTING.md (setup, workflows, commit conventions).
- Architecture overview diagram (request lifecycle, data flow).
- Runbooks: incident response basics, rate limit tuning.

## 2. Success Criteria

- Green CI for full pipeline (tests + spec + lint) on every PR.
- Median API response <150ms under baseline load; 95th <400ms (goal, not hard fail).
- > 80% integration test coverage for critical user journeys.
- Frontend consumes stable OpenAPI without breaking changes for 2 consecutive sprints.

## 3. Implementation Outline

1. Add integration tests for multi-step scenarios.
2. Wire initial tracing (OpenTelemetry) with no vendor lock-in.
3. Add caching layer (in-memory or Redis) for profiles and user relationship checks.
4. Introduce k6 load test scripts (document run locally / optional CI job).
5. Create CONTRIBUTING.md & architecture diagram.
6. Add runbooks (rate limiting, media failures, auth revocation backlog).
7. Enhance CI pipeline configuration to block merges on failing tests/spec drift.

## 4. Risks & Mitigations

- Test flakiness: deterministic seed data + isolated test DB.
- Caching inconsistency: short TTL + cache bust on profile update.
- Tracing overhead: keep sampling low initially.

## 5. Out of Scope

- Advanced ranking algorithms.
- Multi-region replication.
- Full real-time streaming features.

## 6. Entry Criteria for Phase 04

- CI pipeline stable & trusted.
- Load/perf baseline documented with action items.
- Core user journeys fully covered by automated tests.

-- End Phase 03 Blueprint --
## 7. Actionable Checklist

### CI/CD & Automation
- [ ] Full pipeline: lint → typecheck → tests → spec validate → artifact.
- [ ] Spec drift guard (generated client diff) fails build.
- [ ] SBOM + vuln scan gating.

### Environments
- [ ] Ephemeral preview env per PR.
- [ ] Rollback script & artifact retention.

### Testing & Quality
- [ ] >80% integration coverage for core flows.
- [ ] k6 baseline (rps, p95, error rate) stored.
- [ ] Contract tests auto-generated & passing.

### Observability
- [ ] OpenTelemetry tracing (HTTP + DB spans).
- [ ] Trace ID → logs propagation.
- [ ] Cache metrics (hit/miss/evict) exported.

### Performance
- [ ] Feed & notifications EXPLAIN ANALYZE review.
- [ ] Index optimization doc.
- [ ] Cache invalidation strategy doc.

### Docs / DX
- [ ] CONTRIBUTING.md added.
- [ ] Request lifecycle diagram.
- [ ] Runbooks: rate limit, media failures, token revocation.

-- End Phase 03 Blueprint --
