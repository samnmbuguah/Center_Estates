# MonitoringERP migration strategy

## Principle

Migrate working code; do not rebuild it. `MonitoringERP` remains runnable until the unified platform passes behavioral parity checks.

## Reuse map

| Existing area | Treatment |
|---|---|
| `apps/backend/sync` | Move into a monitoring domain package in slices; preserve migrations and API behavior |
| `apps/backend/accounts` | Reconcile Tenant/Membership with shared organizations and identity; migrate data once |
| `apps/backend/finance` | Retain monitoring-specific certification logic; promote truly shared payment primitives later |
| `apps/backend/comms` | Adapt behind the platform notification interface |
| `apps/backend/store` | Keep monitoring inventory behavior; evaluate later overlap with facilities |
| `apps/backend/ai` | Keep gateway abstractions; centralize credentials and audit controls |
| `apps/desktop` | Initially link from the command center; migrate Vite routes incrementally to Next.js |
| `apps/mobile` | Keep as a separate Expo app and point it to the unified API when compatible |
| `packages/shared-types` | Preserve sync contracts and expose them through a shared package |

## Non-negotiable parity

- Offline mobile capture and conflict-safe sync.
- Immutable submitted evidence.
- Client-kind write gating.
- Media hashing and idempotent upload.
- Audit seals and signature verification.
- Geofence classification.
- Reports, issues, finance and role behavior.
- Existing automated tests remain green before and after each slice.

## Phases

1. Freeze and document current APIs, models, migrations and tests.
2. Introduce shared organization IDs and central authentication compatibility.
3. Add the legacy web client to platform SSO/navigation without moving logic.
4. Move backend services by bounded area with compatibility routes.
5. Migrate desktop routes screen-by-screen to Next.js where worthwhile.
6. Cut mobile clients to the unified API after sync contract tests pass.
7. Archive the old deployable only after data reconciliation, rollback rehearsal and parity sign-off.

