# Performance budgets

These budgets turn performance work into release gates rather than subjective
review. Measurements were refreshed on 8 August 2026 against the Docker VM and
the `centerestates.com` cPanel runtime.

## Runtime request budgets

| Path | Budget | Automated evidence |
|---|---:|---|
| Command center portfolio KPIs | Exactly one aggregate GET; zero per-module dashboard GETs | `tests/e2e/runtime-performance.spec.ts` |
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

The complete backend release gate currently contains 162 tests. The latest
full-suite run passed all 160 tests that existed before the two aggregate-pulse
regressions were added; both new pulse tests also pass independently.

## Build and deployment budgets

| Release type | Budget | Latest measurement |
|---|---:|---:|
| Warm Next.js compile | 30 seconds | 20.6 seconds |
| Next.js TypeScript phase | 70 seconds | 61 seconds |
| Full cPanel release | 210 seconds | 189.6–203.0 seconds |
| Prebuilt full cPanel release | 60 seconds | 40.94 seconds |
| Backend-only cPanel release | 40 seconds | 26.49 seconds |

Use a full release whenever frontend assets change. Use `DEPLOY_SCOPE=backend`
only when the committed slice changes Django or deployment files exclusively.
After the exact frontend build has passed lint, TypeScript, bundle budgets and
Docker acceptance, `SKIP_BUILD=1` publishes that verified `.next` output as a
full frontend release without compiling it a second time.
The deployment restarts only the exact Center Estates LiteSpeed worker set and
tolerates workers exiting while that set is being drained.

The reduced browser request fan-out does not remove the hosting account's
LiteSpeed process ceiling: the latest production acceptance run emitted 60
`Reached max children process limit` warnings without application errors. Treat
that counter as an infrastructure-capacity signal and raise the account's
process allowance before increasing concurrent production traffic.

## Current bundle baseline

- Total emitted browser chunks: approximately 3.6 MB uncompressed.
- Monitoring's initial route chunk is 55.8 KB raw and 9.7 KB gzip, reduced
  from approximately 338 KB raw by loading workspace pages at tab boundaries.
- The largest deferred/shared chunk is approximately 401 KB uncompressed.

`npm run check:bundles` enforces an 80 KB raw and 15 KB gzip ceiling for the
Monitoring route after a production build. Both frontend CI workflows run this
gate. Heavy charts and specialist registers remain available as deferred
chunks and are fetched only when their workspace surface is opened.
