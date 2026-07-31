# Center Estates ERP

Unified, subscription-aware estate and property ERP. The platform is a modular monolith: one Next.js web application, one Django API, and one relational database with organization-scoped records.

## Workspaces

| Path | Purpose |
|---|---|
| `apps/web` | Next.js 16 command center and lazily routed module UI |
| `apps/backend` | Django 6 API and domain applications |
| `modules/*` | Product requirements, original PDFs and labeled UI references |
| `packages/*` | Reserved for shared UI, API client and configuration packages |
| `MonitoringERP` | Existing implementation retained as a migration source |
| `Visitor_Management` | Existing adjacent system retained unchanged |
| `docs` | Architecture, deployment and migration decisions |

## Modules

- Property Management
- Facility Management
- Sales Management
- Tender Management
- Valuation
- Construction Monitoring (staged migration from `MonitoringERP`)

## Local setup

```bash
npm install
npm run dev

python3 -m venv apps/backend/.venv
apps/backend/.venv/bin/pip install -r apps/backend/requirements.txt
apps/backend/.venv/bin/python apps/backend/manage.py migrate
apps/backend/.venv/bin/python apps/backend/manage.py runserver
```

Web: `http://localhost:3000`. API health: `http://localhost:8000/api/v1/health/`.

## Guardrails

- A subscription grants an organization access to a module; roles determine what a user may do inside it.
- Tenant isolation is enforced by the API, never just by hidden navigation.
- Shared entities live in platform apps; module internals remain within their domain app.
- Monitoring is migrated incrementally. Its offline sync, evidence integrity and mobile workflows must not be rewritten without a parity test.

See [architecture](docs/architecture/PLATFORM_ARCHITECTURE.md) and [Monitoring migration](docs/migration/MONITORING_ERP.md).

## Dependency advisory note

As of this scaffold, npm reports upstream high-severity advisories in the `postcss` and `sharp` versions bundled transitively by Next.js 16.2.12. npm's proposed automatic fix incorrectly downgrades Next.js to 9.3.3, so it has not been applied. Recheck the advisory on every Next.js patch upgrade and before production deployment.
