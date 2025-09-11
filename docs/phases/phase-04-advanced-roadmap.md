# Phase 04: Advanced & Optional Features Roadmap

## 1. Blueprint (Planned Scope)

### Feature Expansion

- Ranking & trending (engagement + recency hybrid).
- Hashtags & topic surfacing.
- Direct messages (private threads) – separate service candidate.
- Premium / monetization hooks (subscription flag, feature gating).

### Reliability & Operations

- Progressive delivery (feature flags, canary releases).
- Chaos testing basics (latency/failure injection plan).
- Backup/restore automation & verification playbook.

### Data & Analytics

- Event pipeline (Kafka/Redpanda or lightweight queue) for analytics.
- Aggregations: DAU/MAU, retention cohorts, engagement funnels.
- Anomaly detection (later experiment).

### Security & Compliance

- Advanced abuse detection (rate anomalies, rapid follow/like bursts).
- Privacy tools (user data export/delete workflow).
- Audit log retention & archival policy.

### Developer Experience

- API versioning strategy (v1 freeze + changelog process).
- SDK clients generation (TypeScript, maybe Go/Python).

## 2. Success Criteria

- Feature flag system controlling at least one user-facing feature.
- Data export/delete workflow defined & tested for a user account.
- Basic ranking prototype measurable vs pure recency.
- Backup restore drill documented with recovery timing.

## 3. Implementation Outline (Representative)

1. Introduce feature flag module (env + Redis toggle or lightweight library).
2. Add analytics event emitters & sink prototype (file/Redis -> future pipeline).
3. Build ranking experiment path (parallel endpoint or query param) for A/B.
4. Implement privacy endpoints (export request, delete request with grace period).
5. Add backup cron documentation & restore simulation script.
6. Generate SDK clients from OpenAPI and publish internal package.

## 4. Risks & Mitigations

- Scope creep: enforce phased gating (prototype → evaluate → adopt).
- Ranking fairness: transparent heuristic & adjustable weights.
- Privacy deletions: use soft-delete with delayed hard purge queue.

## 5. Out of Scope

- Full ML recommendation system (would be Phase 05+).
- Multi-tenant isolation.
- Federated protocol support (ActivityPub) for now.

## 6. Completion Signals

- Core advanced modules (flags, ranking prototype, privacy ops) stable & documented.
- Operational drills executed at least once (backup/restore, feature rollback).

-- End Phase 04 Blueprint --
## 7. Actionable Checklist

### Feature Flags & Delivery
- [ ] Flag store + change audit.
- [ ] Percentage rollout + kill switch.

### Ranking & Experiments
- [ ] Ranking prototype behind flag.
- [ ] Exposure logging (variant assignments).
- [ ] Engagement delta metrics.

### Privacy & Compliance
- [ ] Data inventory & classification.
- [ ] Export (async job + signed URL) endpoint.
- [ ] Deletion workflow (soft → delayed purge).
- [ ] Audit archival & cold storage script.

### Analytics Pipeline
- [ ] Event schema registry.
- [ ] Lightweight event sink.
- [ ] Daily DAU/MAU & retention cohort job.

### SDK & Versioning
- [ ] Versioned OpenAPI releases.
- [ ] Generated TS client publish.
- [ ] Deprecation & Sunset header policy.

### Reliability / Ops
- [ ] Backup automation + restore drill log.
- [ ] Feature rollback drill.
- [ ] Chaos scenarios validated.

### Abuse Detection
- [ ] Rate anomaly detector (follows/likes per min thresholds).
- [ ] Alerting rules configured.

-- End Phase 04 Blueprint --
