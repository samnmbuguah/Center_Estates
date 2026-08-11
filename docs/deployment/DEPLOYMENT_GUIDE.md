# Center Estates ERP — Deployment Guide

## Topology

- Main domain `https://centerestates.com` serves the Next.js standalone bundle (Passenger/Node).
- API subdomain `https://api.centerestates.com` serves Django (Passenger/LiteSpeed WSGI).
- The frontend calls `https://api.centerestates.com/api/v1` (`NEXT_PUBLIC_API_BASE_URL`, inlined at build time from `apps/web/.env.local`).
- One MySQL database serves every organization; organization ownership and subscriptions are enforced at the API boundary.

## Prerequisites

- A cPanel account with Node.js + Passenger and a Python 3.9 virtualenv.
- SSH access configured for the `host` alias used by the deploy scripts.
- DNS: `centerestates.com` → app document root; `api.centerestates.com` → API document root.

## 1. Environment configuration

`apps/web/.env.local` (Git-ignored) supplies the frontend build-time values:

| Variable | Example | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `https://api.centerestates.com/api/v1` | API origin for all fetches |
| `NEXT_PUBLIC_POSTHOG_KEY` | `phc_...` | PostHog capture key |
| `NEXT_PUBLIC_POSTHOG_HOST` | `https://us.posthog.com` | PostHog capture + dashboard origin |
| `NEXT_PUBLIC_POSTHOG_DASHBOARD_URL` | `https://us.posthog.com/embedded/...` | Embedded analytics dashboard on `/analytics` |

Backend configuration (Django settings) is driven by environment variables:

| Variable | Example | Purpose |
|---|---|---|
| `DJANGO_SECRET_KEY` | (from `passenger_wsgi.py`) | Cryptographic signing |
| `DJANGO_ALLOWED_HOSTS` | `centerestates.com,api.centerestates.com` | Host header validation |
| `CORS_ALLOWED_ORIGINS` | `https://centerestates.com` | CORS allowlist |
| `CSRF_TRUSTED_ORIGINS` | `https://centerestates.com` | CSRF allowlist |

## 2. Initial deployment

Run the automated cPanel deployment from the repository root:

```bash
./scripts/deploy_cpanel.sh host centerestates.com
curl -fsS https://api.centerestates.com/api/v1/health/
```

The script builds the Next.js bundle locally, packages backend + frontend, uploads to `/home2/monitori/centerestates.com`, runs `migrate`/`collectstatic`/`check --deploy`, touches `tmp/restart.txt` and terminates stale LiteSpeed workers.

Seed demo data (roles, properties, tenants, telemetry fixture) is refreshed explicitly:

```bash
cd /home2/monitori/api.centerestates.com/apps/backend
SEED_ADMIN_PASSWORD='<admin>' SEED_ROLE_PASSWORD='<role>' \
  /home2/monitori/virtualenv/api.centerestates.com/3.9/bin/python manage.py seed_platform
```

## 3. Release verification

```bash
apps/backend/.venv/bin/python apps/backend/manage.py makemigrations --check --dry-run
apps/backend/.venv/bin/python apps/backend/manage.py test audit companion construction core documents facilities organizations properties sales subscriptions tenders valuations
(cd apps/web && npm run lint && npx tsc --noEmit && npm run build)
E2E_BASE_URL=https://centerestates.com \
E2E_ADMIN_PASSWORD='<admin>' E2E_ROLE_PASSWORD='<role>' \
  npx playwright test --project=desktop-chromium
E2E_BASE_URL=https://centerestates.com \
E2E_ADMIN_PASSWORD='<admin>' E2E_ROLE_PASSWORD='<role>' \
  npx playwright test --project=mobile-chromium
```

Also confirm login, organization switching, subscription-limited navigation, tenant portal visibility, a CSV download, the PostHog embed on `/analytics`, and browser console cleanliness.

## 4. Backup and restore

```bash
./scripts/backup_cpanel.sh host centerestates.com
```

The backup captures the database dump, uploaded media and frontend bundle with checksums. Store copies off-account and test restoration regularly. A restore rehearsal uses a separate database and drops only that temporary database — never point a rehearsal at production.

## 5. Rollback

1. Preserve the failing release logs and take a fresh backup if writes occurred.
2. Check out the last known-good commit and rerun `./scripts/deploy_cpanel.sh host centerestates.com`.
3. If the release included a backwards-incompatible migration, use the matching pre-deploy database/media backup; do not improvise a reverse migration against production data.
4. Repeat health, security and module smoke checks after rollback.

## 6. Security and operations

- Secrets stay out of Git: frontend values in `apps/web/.env.local`, backend values in `passenger_wsgi.py`/cPanel environment.
- Authentication is JWT in HttpOnly cookies (15-minute access, 7-day refresh), CSRF-protected and rate limited.
- Rotate the Django signing key only during announced maintenance (existing sessions become invalid).
- Replace the acceptance admin password and remove unused memberships before live client data.
- See the [Production runbook](PRODUCTION_RUNBOOK.md) for routine operations, backup cadence and release checks.
