# Center Estates ERP production runbook

## Topology

- Public app URL: `https://centerestates.com`
- API subdomain: `https://api.centerestates.com` (Django via Passenger/LiteSpeed WSGI)
- Main domain serves the Next.js standalone bundle via Passenger (Node).
- The frontend calls the API at `https://api.centerestates.com/api/v1` (set as `NEXT_PUBLIC_API_BASE_URL` at build time).
- One MySQL database and one Django API serve every organization and subscribed module. Organization ownership and subscription permissions are enforced at the API boundary.
- PostHog (US Cloud) collects pageviews, clicks and task events; the Usage Analytics page (`/analytics`, admin only) embeds the PostHog dashboard and shows per-user activity from the backend telemetry feed.

## Deploy

From the repository root (local build, cPanel push):

```bash
./scripts/deploy_cpanel.sh host centerestates.com
```

The script:
1. Builds the Next.js production bundle locally (reads `apps/web/.env.local` for `NEXT_PUBLIC_*` values).
2. Packages the backend, frontend bundle, `passenger_wsgi.py` and `app.js`.
3. Uploads to `/home2/monitori/centerestates.com`, runs `migrate`, `collectstatic` and `check --deploy`.
4. Touches `tmp/restart.txt` and terminates stale LiteSpeed workers.

Backend-only hotfixes skip the frontend rebuild:

```bash
DEPLOY_SCOPE=backend ./scripts/deploy_cpanel.sh host centerestates.com
```

Seed data (demo roles, properties, tenants) is refreshed by running the seed command on the API server:

```bash
cd /home2/monitori/api.centerestates.com/apps/backend
SEED_ADMIN_PASSWORD='<admin>' SEED_ROLE_PASSWORD='<role>' \
  /home2/monitori/virtualenv/api.centerestates.com/3.9/bin/python manage.py seed_platform
```

## Release verification

```bash
apps/backend/.venv/bin/python apps/backend/manage.py makemigrations --check --dry-run
apps/backend/.venv/bin/python apps/backend/manage.py test audit companion construction core documents facilities organizations properties sales subscriptions tenders valuations
(cd apps/web && npm run lint && npx tsc --noEmit && npm run build)
E2E_ADMIN_PASSWORD="<admin>" E2E_ROLE_PASSWORD="<role>" npx playwright test --project=desktop-chromium
E2E_ADMIN_PASSWORD="<admin>" E2E_ROLE_PASSWORD="<role>" npx playwright test --project=mobile-chromium
curl -fsS https://api.centerestates.com/api/v1/health/
```

Also confirm login, organization switching, subscription-limited navigation, one dynamic register per module, tenant portal visibility, a CSV download, the PostHog embed on `/analytics`, and browser console cleanliness.

## Backup and restore

See `scripts/backup_cpanel.sh`. The script archives the database dump, uploaded media and the frontend bundle with checksums to a remote location. Store copies outside the account and test restoration regularly.

A safe restore rehearsal creates a separate database, loads the dump, validates representative table counts, and drops only that temporary database. Never point a rehearsal at the production database.

## Rollback

1. Preserve the failing release logs and take a fresh backup if writes occurred.
2. Check out the last known-good commit and rerun `./scripts/deploy_cpanel.sh host centerestates.com`.
3. If the release included a backwards-incompatible migration, use the matching pre-deploy database/media backup; do not improvise a reverse migration against production data.
4. Repeat health, security and module smoke checks after rollback.

## Secrets and access

- `apps/web/.env.local` holds `NEXT_PUBLIC_*` values (PostHog key, API base URL, dashboard embed). It is Git-ignored and inlined at build time.
- Backend secrets (Django signing key, DB credentials, API keys) live in `passenger_wsgi.py` / cPanel environment variables, not in the repository.
- Rotate the Django signing key only during announced maintenance because existing sessions become invalid.
- Replace the acceptance admin password, use named staff accounts and remove unused memberships before launch.
- Authentication endpoints are CSRF protected and rate limited; application tokens are stored in secure, HTTP-only cookies.

## Routine operations

- Daily: automated off-server database/media backup and health alerting (`curl https://api.centerestates.com/api/v1/health/`).
- Weekly: inspect application errors (`stderr.log` on the API account), expiring compliance documents and overdue workflows.
- Monthly: restore rehearsal, dependency/security update review and access review.
- Before every release: backup, migration check, the complete backend suite, frontend type/build checks, focused desktop/mobile E2E, and LiteSpeed worker-health confirmation.
- Enforce the request, query, bundle and deployment limits in [Performance budgets](PERFORMANCE_BUDGETS.md).
