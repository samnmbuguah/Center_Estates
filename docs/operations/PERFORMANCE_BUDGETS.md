# Performance budgets

These budgets turn performance work into release gates rather than subjective
review. Measurements were refreshed on 8 August 2026 against the Docker VM and
the `centerestates.com` cPanel runtime.

## Runtime request budgets

| Path | Budget | Automated evidence |
|---|---:|---|
| Facility workspace initial load | At most one scoped Facility dashboard GET | `tests/e2e/runtime-performance.spec.ts` |
| Property selector initial load | At most one property-list GET | `tests/e2e/runtime-performance.spec.ts` |
| Companion sidebar KPI load | At most one Companion dashboard GET | `tests/e2e/runtime-performance.spec.ts` |
| Local interaction telemetry | At most one POST during initial 5.5 seconds | `tests/e2e/runtime-performance.spec.ts` |
| Telemetry batch | 1–100 events, flushed every 5 seconds or at 20 queued events | Companion API tests |

Identical GETs are coalesced in flight and retained for 750 ms. Any mutation
invalidates that short-lived cache. The cache key includes organization and
property scope, so records cannot cross tenant or property boundaries.

## Backend query budgets

The Companion operational and staff-performance dashboards must each execute
no more than 10 SQL queries, including authentication, subscription and role
checks. They previously used 16 and 17 queries respectively. Request-local
organization, membership and property caches are deliberately discarded at
the end of every HTTP request.

The complete backend release gate currently contains 160 passing tests.

## Build and deployment budgets

| Release type | Budget | Latest measurement |
|---|---:|---:|
| Warm Next.js compile | 30 seconds | 20.6 seconds |
| Next.js TypeScript phase | 70 seconds | 61 seconds |
| Full cPanel release | 210 seconds | 189.6 seconds |
| Backend-only cPanel release | 40 seconds | 26–27 seconds |

Use a full release whenever frontend assets change. Use `DEPLOY_SCOPE=backend`
only when the committed slice changes Django or deployment files exclusively.

## Current bundle baseline

- Total emitted browser chunks: approximately 3.6 MB uncompressed.
- Largest route chunk: Monitoring, approximately 338 KB uncompressed.
- Largest shared/vendor chunk: approximately 413 KB uncompressed.

The next frontend performance pass should split the Monitoring charts and
detail tooling at tab boundaries, then add compressed route-level budgets to
CI. These sizes are diagnostic baselines, not completion targets.
