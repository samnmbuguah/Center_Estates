# Center Estates ERP — Deployment Guide

## Prerequisites

- Docker Engine 24+ and Docker Compose v2
- A Linux VM with at least 2 vCPU / 4 GB RAM
- A domain name (or `sslip.io` for dynamic IP staging)
- DNS A record pointing to the VM public IP
- Open ports 80 and 443 (Caddy reverse proxy)

## 1. Clone and configure

```bash
git clone <repo-url> /opt/center-estates
cd /opt/center-estates
```

Create the Docker secrets directory and populate passwords:

```bash
mkdir -p infrastructure/docker/secrets
tr -dc 'A-Za-z0-9!@#$%^&*()' < /dev/urandom | head -c 50 > infrastructure/docker/secrets/django_secret
tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 24  > infrastructure/docker/secrets/db_password
tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 20  > infrastructure/docker/secrets/seed_admin_password
chmod 600 infrastructure/docker/secrets/*
```

## 2. Environment variables

The backend reads configuration from environment variables (or Docker secrets).
The key variables in `docker-compose.yml` are:

| Variable | Example | Purpose |
|---|---|---|
| `DJANGO_SECRET_KEY` | (auto from secret) | Cryptographic signing |
| `DJANGO_ALLOWED_HOSTS` | `erp.example.com` | Host header validation |
| `DB_HOST` | `db` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `CORS_ALLOWED_ORIGINS` | `https://erp.example.com` | CORS allowlist |
| `CSRF_TRUSTED_ORIGINS` | `https://erp.example.com` | CSRF allowlist |
| `SEED_DEMO_DATA` | `true`/`false` | Seed demo fixtures |
| `GUNICORN_WORKERS` | `3` | Gunicorn worker count |

Update `docker-compose.yml` with your production domain and set `SEED_DEMO_DATA: "false"` once live client data is entered.

## 3. Initial deployment

```bash
# Build images
docker compose build backend web

# Start the stack (db, backend, web)
docker compose up -d --remove-orphans

# Verify containers are healthy
docker compose ps
```

The backend entrypoint automatically:
1. Applies database migrations (`python manage.py migrate --noinput`)
2. Collects static files (`python manage.py collectstatic --noinput`)
3. Seeds demo data when `SEED_DEMO_DATA=true`

## 4. Caddy reverse proxy

Caddy runs on the `caddy_default` Docker network and terminates TLS.

A shared Caddy instance proxies:
- `/api/*`, `/admin/*`, `/static/*`, `/media/*` → Django (`backend:8000`)
- All other traffic → Next.js (`web:3000`)

Ensure Caddy is running and the `caddy_default` network exists:

```bash
docker network ls | grep caddy_default || \
  docker network create caddy_default
```

Add your site to the Caddyfile:

```
erp.example.com {
    reverse_proxy /api/* /admin/* /static/* /media/* center-estates-backend:8000
    reverse_proxy center-estates-web:3000
}
```

Reload Caddy:

```bash
docker exec caddy-caddy-1 caddy validate --config /etc/caddy/Caddyfile
docker exec caddy-caddy-1 caddy reload --config /etc/caddy/Caddyfile
```

## 5. Health checks

```bash
# Backend health endpoint
curl -fsS https://erp.example.com/api/v1/health/

# Django deploy checks
docker compose exec -T backend python manage.py check --deploy

# Container health status
docker compose ps
```

Backend healthcheck runs every 20s with a 40s start-period grace window.
Web healthcheck runs every 20s with a 20s start-period.

## 6. Seed data

Set `SEED_DEMO_DATA: "true"` in `docker-compose.yml` during acceptance testing.
Set to `"false"` before entering live client data.

Seeded data includes:
- Platform admin user and role-based demo users
- Property, building, unit, tenant, lease, invoice data
- Facility work orders, assets, inspections, preventive schedules
- Sales listings, buyers, payments, commissions
- Tender pipeline with requirements and proposals
- Valuation instructions, inspections, draft/final reports
- Companion tasks and event history
- Construction monitoring projects, milestones, BoQ, risks, tickets

## 7. Backup procedures

```bash
# Run the backup script (captures PostgreSQL + media with SHA-256 checksums)
./infrastructure/docker/backup.sh
```

Backups include:
- PostgreSQL database dump
- Media files volume

Store backup copies off the VM. Test restoration regularly on a separate database.

### Restore rehearsal

```bash
# 1. Create a temporary database
docker compose exec -T db psql -U center_estates -c "CREATE DATABASE center_estates_rehearsal;"

# 2. Load the dump into the temporary database
docker compose exec -T db psql -U center_estates -d center_estates_rehearsal < backups/latest/database.dump

# 3. Validate representative table counts
docker compose exec -T db psql -U center_estates -d center_estates_rehearsal \
  -c "SELECT 'properties' AS t, count(*) FROM properties_property UNION ALL
      SELECT 'leases', count(*) FROM properties_lease UNION ALL
      SELECT 'work_orders', count(*) FROM facilities_workorder;"

# 4. Drop the temporary database
docker compose exec -T db psql -U center_estates -c "DROP DATABASE center_estates_rehearsal;"
```

**Never point a rehearsal at the production `center_estates` database.**

## 8. Rollback procedures

1. Preserve failing release logs; take a fresh backup if writes occurred.
2. Check out the last known-good commit and rebuild both images:
   ```bash
   git checkout <last-good-commit>
   docker compose build backend web
   docker compose up -d --remove-orphans
   ```
3. If the release included a backwards-incompatible migration, use the matching pre-deploy database/media backup. **Do not improvise a reverse migration against production data.**
4. Start the stack and repeat health, security, and module smoke checks.

## 9. Scaling considerations

- **Gunicorn workers**: Adjust `GUNICORN_WORKERS` (default 3). Rule of thumb: `2 × CPU cores + 1`.
- **Database**: PostgreSQL runs on a single volume. For high availability, consider pgBouncer + read replicas.
- **Media storage**: The `media_data` Docker volume can be replaced with S3-compatible object storage for horizontal scaling.
- **Caching**: Redis or Memcached can be added for session and query caching.
- **CDN**: Serve `/static/` and `/media/` through a CDN for lower latency.
- **Multiple web replicas**: Next.js can be scaled horizontally behind a load balancer. API calls go through the shared backend.

## 10. Security notes

- Secrets remain ignored by Git and restricted to root plus the container's Django group.
- Rotate the Django signing key only during announced maintenance (existing sessions become invalid).
- Rotate database credentials by coordinating PostgreSQL, the Docker secret, and an application restart.
- Replace the acceptance admin password with named staff accounts before launch.
- Authentication endpoints are CSRF-protected and rate-limited; tokens are stored in secure, HTTP-only cookies.

## Routine operations

| Frequency | Task |
|---|---|
| Daily | Automated off-VM database/media backup and health alerting |
| Weekly | Inspect container restarts, application errors, expiring compliance documents, overdue workflows |
| Monthly | Restore rehearsal, dependency/security update review, access review |
| Every release | Backup, migration check, backend tests, frontend lint/build, E2E tests, Caddy validation |
