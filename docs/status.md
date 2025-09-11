# Project Status Dashboard

This dashboard summarizes progress across phases. Update checkboxes in the phase files; this page is a roll-up view.

## Phase 01 (Core Platform)

Reference: `docs/phases/phase-01-core.md`

Key Post-Phase Hardening Items:

- [ ] SLOs defined & published
- [ ] Threat model & secret rotation policy
- [ ] Idempotency keys implemented (posts/interactions)
- [ ] Event naming catalog documented
- [ ] x-api-version header shipped
- [ ] Chaos flag (staging) in place
- [ ] Central rate limit config JSON
- [ ] Error code catalog added
- [ ] Data retention matrix added
- [ ] CSP report-only analysis completed
- [ ] JWT dual-secret rotation strategy doc
- [ ] Repost feed ordering test
- [ ] Block/mute concealment test

## Phase 02 (Moderation & Security)

Reference: `docs/phases/phase-02-moderation-security.md`

- [ ] Moderation enums (posts/users)
- [ ] moderation_actions table
- [ ] Reports enrichment + dedupe
- [ ] Thumbnail queue + worker
- [ ] Post-upload probe
- [ ] Session/device endpoints
- [ ] Password breach check
- [ ] Hardened CSP deployed
- [ ] Histograms (request duration)
- [ ] Rate limit hit counter
- [ ] 5xx per-route counter
- [ ] Audit pagination endpoint
- [ ] RBAC role enforcement
- [ ] Audit retention trimming
- [ ] OpenAPI moderation/report schemas
- [ ] Moderation flow diagram
- [ ] Block/mute filtering tests
- [ ] Audit pagination test
- [ ] Thumbnail lifecycle test
- [ ] Reputation hook (stretch)

## Phase 03 (Deployment & Quality)

Reference: `docs/phases/phase-03-deployment-quality.md`

- [ ] Full CI pipeline stages
- [ ] Spec drift guard
- [ ] SBOM + vuln scan gating
- [ ] Ephemeral preview env
- [ ] Rollback script + artifacts
- [ ] > 80% integration coverage
- [ ] k6 baseline captured
- [ ] Contract tests passing
- [ ] OpenTelemetry tracing
- [ ] Trace IDs in logs
- [ ] Cache metrics exported
- [ ] Feed/notifications EXPLAIN review
- [ ] Index optimization doc
- [ ] Cache invalidation doc
- [ ] CONTRIBUTING.md
- [ ] Request lifecycle diagram
- [ ] Runbooks (rate limit/media/auth)

## Phase 04 (Advanced Roadmap)

Reference: `docs/phases/phase-04-advanced-roadmap.md`

- [ ] Flag store + audit
- [ ] Percentage rollout + kill switch
- [ ] Ranking prototype behind flag
- [ ] Exposure logging
- [ ] Engagement delta metrics
- [ ] Data inventory & classification
- [ ] Export endpoint
- [ ] Deletion workflow
- [ ] Audit archival script
- [ ] Event schema registry
- [ ] Lightweight event sink
- [ ] Daily DAU/MAU job
- [ ] Versioned OpenAPI releases
- [ ] Generated TS client publish
- [ ] Deprecation/Sunset header policy
- [ ] Backup automation + restore drill
- [ ] Feature rollback drill
- [ ] Chaos scenarios validated
- [ ] Rate anomaly detector
- [ ] Abuse alerting rules

## Legend

Unchecked items roll forward; update only in original phase files then sync here if needed.

-- End Status Dashboard --
