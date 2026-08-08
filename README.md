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
- Construction Monitoring (integrated domain port from `MonitoringERP`)

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

## Production deployment

The primary cPanel/Passenger release is served at
[`https://centerestates.com`](https://centerestates.com). The deployment script
preserves cPanel's generated `.htaccess`, production environment, database and
media while publishing only the Django runtime and compiled Next.js assets.

```bash
scripts/deploy_cpanel.sh host centerestates.com
```

The Docker VM remains the pre-production/fallback environment.

## VM deployment

The production-like VM stack is defined in `docker-compose.yml`: PostgreSQL 17,
one Django API and one route-split Next.js application. It joins the existing
`caddy_default` network; shared Caddy terminates TLS for
`https://erp.169-58-102-217.sslip.io`.

Production deployment, verification, backup, restore and rollback procedures are documented in [the production runbook](docs/operations/PRODUCTION_RUNBOOK.md) and [Docker deployment guide](infrastructure/docker/README.md).

```bash
docker compose up -d --build
docker compose ps
```

Container startup applies migrations, collects static assets, seeds every
subscribed module idempotently, and then starts Gunicorn. Secrets are mounted
from `infrastructure/docker/secrets` and must never be committed or printed.

## Dependency advisory note

As of this scaffold, npm reports upstream high-severity advisories in the `postcss` and `sharp` versions bundled transitively by Next.js 16.2.12. npm's proposed automatic fix incorrectly downgrades Next.js to 9.3.3, so it has not been applied. Recheck the advisory on every Next.js patch upgrade and before production deployment.
