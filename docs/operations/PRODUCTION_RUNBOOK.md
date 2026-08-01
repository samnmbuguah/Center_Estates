# Center Estates ERP production runbook

## Topology

- Public URL: `https://erp.169-58-102-217.sslip.io`
- Shared Caddy terminates TLS and proxies `/api/*`, `/admin/*`, `/static/*` and `/media/*` to Django; all other traffic goes to Next.js.
- Docker publishes Next.js and Django only on VM loopback ports `4300` and `4301`. PostgreSQL is not published.
- One PostgreSQL database and one Django API serve every organization and subscribed module. Organization ownership and subscription permissions are enforced at the API boundary.

## Deploy

From the repository root:

```bash
./infrastructure/docker/backup.sh
docker compose build backend web
docker compose up -d --remove-orphans
docker compose ps
curl -fsS https://erp.169-58-102-217.sslip.io/api/v1/health/
docker compose exec -T backend python manage.py check --deploy
```

The backend entrypoint applies migrations, collects static files and starts Gunicorn. During acceptance, it also idempotently refreshes demo fixtures. Set `SEED_DEMO_DATA: "false"` in `docker-compose.yml` before entering live client data.

## Release verification

```bash
apps/backend/.venv/bin/python apps/backend/manage.py makemigrations --check --dry-run
apps/backend/.venv/bin/python apps/backend/manage.py test audit construction core documents facilities notifications organizations properties sales subscriptions tenders valuations
(cd apps/web && npm run lint && npm run build)
E2E_ADMIN_PASSWORD="$(tr -d '\n' < infrastructure/docker/secrets/seed_admin_password)" npx playwright test
docker exec caddy-caddy-1 caddy validate --config /etc/caddy/Caddyfile
```

Also confirm login, organization switching, subscription-limited navigation, one dynamic register per module, tenant portal visibility, a CSV download and browser console cleanliness.

## Backup and restore

See [Docker deployment](../../infrastructure/docker/README.md). `backup.sh` captures PostgreSQL and media with SHA-256 checksums. Store copies outside the VM and test restoration regularly.

A safe restore rehearsal creates a separate database, loads `database.dump`, validates representative table counts, and drops only that temporary database. Never point a rehearsal at `center_estates`.

## Rollback

1. Preserve the failing release logs and take a fresh backup if writes occurred.
2. Check out the last known-good commit and rebuild both images.
3. If the release included a backwards-incompatible migration, use the matching pre-deploy database/media backup; do not improvise a reverse migration against production data.
4. Start the stack and repeat health, security and module smoke checks.

## Secrets and access

- Secret source files remain ignored by Git and restricted to root plus the container's Django group.
- Rotate the Django signing key only during announced maintenance because existing sessions become invalid.
- Rotate database credentials by coordinating PostgreSQL, the Docker secret and an application restart.
- Replace the acceptance admin password, use named staff accounts and remove unused memberships before launch.
- Authentication endpoints are CSRF protected and rate limited; application tokens are stored in secure, HTTP-only cookies.

## Routine operations

- Daily: automated off-VM database/media backup and health alerting.
- Weekly: inspect container restarts, application errors, expiring compliance documents and overdue workflows.
- Monthly: restore rehearsal, dependency/security update review and access review.
- Before every release: backup, migration check, 117 backend tests, frontend lint/build, desktop/mobile E2E and Caddy validation.
