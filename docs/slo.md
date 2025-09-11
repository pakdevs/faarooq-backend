# Service Level Objectives (Initial)

Scope: Core API (Auth, Posts, Interactions, Moderation, Media metadata) v1.

## Availability

- SLO: 99.5% monthly (<= 216 min error budget).
- Measurement: Successful 2xx/3xx responses over total requests (excluding maintenance windows <15m pre-announced).

## Latency

- p95 overall request latency < 400ms.
- p99 overall request latency < 900ms (best effort; not enforced initially).
- Feed fetch p95 < 500ms.

## Correctness

- Auth & write endpoints error rate (5xx) < 0.5% over rolling 24h.

## Rate Limiting UX

- < 1% of legitimate (non-abusive) requests receive 429 (sample via logs + user reports).

## Logging & Tracing

- 100% of requests have request ID.
- Target: Add trace IDs Phase 03.

## Review Cadence

- Monthly SLO review and adjust targets post baseline collection.

## Breach Policy

1. Identify cause (infra vs code regression).
2. If sustained >25% of remaining error budget consumed in 24h, trigger incident doc.
3. Postmortem required for any single outage >30m or latency breach sustained >6h.

## Next Improvements

- Add synthetic ping monitor.
- Per-endpoint latency SLO candidates after 30 days metrics.
