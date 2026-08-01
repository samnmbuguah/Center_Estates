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
| mobile JWT tenant | bearer JWT with `client_kind=mobile`; active membership resolves the organization |

The backend port retains the mature construction entities: projects,
controlled documents and approvals, lifecycle records, devices, progress,
immutable evidence, observations, daily logs, materials, safety, risks, issues,
quality, programme, BoQ, variations, provisional sums, contingency, advances,
subcontractors, BIM/drone/satellite records, RFIs, calendar, chat and audit data.
Later parity slices add document revision history, issue discussions, project
team assignments, audited requirement waivers, second-party progress
verification, statutory approval decisions, inventory, material requisitions,
purchase orders and an append-only stock ledger.
Construction finance now also preserves the source workflow state machines for
variation approval, requisition review/decision, disbursement payment/voiding,
and document/valuation-controlled funding drawdowns.
Provisional sums, contingency drawdowns, and advance recovery now use the same
controlled cost lifecycle: ascertain before close, enforce the remaining
contingency allowance, and retain append-only recovery events.
Reporting compatibility includes dynamic weekly/monthly summaries and
tenant-scoped BoQ, cost, and milestone CSV exports. Chat and notification APIs
also expose recipient-scoped unread counters and server-authored read actions.

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

- Unified backend: 102 tests passing, including organization isolation,
  subscription denial, hierarchy validation, evidence immutability, controlled
  approval/verification decisions, procurement controls and append-only audit
  records.
- MonitoringERP desktop: 17 suites / 125 tests passing.
- MonitoringERP mobile: 12 suites / 52 tests passing.
- Next.js lint and a clean Docker production build pass.
- Live HTTPS construction dashboard returns seeded project, issue, risk,
  milestone and approved-variation metrics through shared Caddy. Live desktop
  and mobile Playwright checks also cover construction procurement, controlled
  documents, issue discussion and governance registers.

The unified API now includes incremental offline pull/push, mobile-authoritative
write gates, content-hash/idempotent media upload, server geofence classification,
audit seal recomputation and Ed25519 verification. The source Expo client now
defaults to the unified construction API. Remaining parity work is real-time
notification delivery, broader mobile endpoint compatibility, and final data
reconciliation/rollback rehearsal. The standalone source is retained until
those checks pass.
