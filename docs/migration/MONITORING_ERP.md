# MonitoringERP to construction module migration

## Final architecture decision

MonitoringERP is a source implementation, not a second production service. Its
construction domain is being copied into the modular monolith and adapted at
the boundaries. Production remains one Next.js UI, one Django backend and one
PostgreSQL database. The source baseline used for the port is nested-repository
commit `b2fb952`.

## Ownership mapping

| MonitoringERP concept | Unified platform concept |
|---|---|
| `accounts.Tenant` | `organizations.Organization` |
| `TenantMembership` | `organizations.Membership` and roles |
| package/module plan | `subscriptions.Subscription(module="monitoring")` |
| monitoring `Project` | `construction.Project`, anchored by `portfolio_project` to `properties.Project` |
| desktop routes | `/monitoring` routes inside the Next.js platform shell |
| mobile JWT tenant | active organization claim/header under the unified authentication contract |

The first backend port retains 50 mature construction entities: projects,
controlled documents and approvals, lifecycle records, devices, progress,
immutable evidence, observations, daily logs, materials, safety, risks, issues,
quality, programme, BoQ, variations, provisional sums, contingency, advances,
subcontractors, BIM/drone/satellite records, RFIs, calendar, chat and audit data.

## Preserved invariants

- Organization scoping and subscription checks are server-side.
- Submitted milestone and evidence records are immutable.
- Mobile-authoritative writes require the mobile client kind.
- Evidence metadata retains hashes, signature/device provenance, geofence state
  and immutable submission seals.
- Construction workspaces link upward to the shared property project rather
  than creating an unrelated platform hierarchy.
- Seed data is idempotent and all dashboard cards/registers read API data.

## Migration sequence

1. Freeze and verify the source implementation and its automated tests.
2. Port models and organization ownership into `apps/backend/construction`.
3. Expose subscription-scoped compatibility and platform APIs.
4. Port desktop workflows into `/monitoring` in bounded, tested slices.
5. Point the Expo offline client at the unified auth/sync API after contract
   tests prove pull/push, idempotency, media hashing and conflict behavior.
6. Reconcile production data, rehearse rollback, and archive the standalone
   deployable only after parity sign-off.

## Current verification

- Unified backend: 45 tests passing, including organization isolation,
  subscription denial, hierarchy validation and evidence immutability.
- MonitoringERP desktop: 17 suites / 125 tests passing.
- MonitoringERP mobile: 12 suites / 52 tests passing.
- Next.js lint and production build pass.
- Live HTTPS construction dashboard returns seeded project, issue, risk,
  milestone and approved-variation metrics through shared Caddy.

Remaining port work is tracked against the non-negotiable parity list: offline
sync endpoints, media upload/hash idempotency, audit seal/signature verification,
geofence classification, reporting/finance workflows, WebSockets, and mobile
contract cutover. The standalone source is retained until those checks pass.
