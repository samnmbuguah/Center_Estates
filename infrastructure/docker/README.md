# Docker deployment

The production-like VM deployment uses PostgreSQL, Gunicorn/Django and the Next.js standalone server. Only loopback ports `4300` and `4301` are published; shared Caddy provides public TLS.

```bash
docker compose up -d --build
docker compose ps
curl https://erp.example.com/api/v1/health/
```

Secrets are generated locally in `infrastructure/docker/secrets/` and ignored by Git. The seed command is idempotent and runs at startup while `SEED_DEMO_DATA=true`; disable it after acceptance fixtures are no longer wanted.

## Backup and restore

Create a timestamped database and media backup (the default destination is the ignored `backups/` directory):

```bash
./infrastructure/docker/backup.sh
```

Each backup contains a PostgreSQL custom-format dump, compressed media archive and SHA-256 manifest. Copy backups off the VM according to the client's retention policy; a local volume is not disaster recovery.

Restore is intentionally guarded and stops application traffic while replacing the live database and media:

```bash
./infrastructure/docker/restore.sh /absolute/path/to/backups/20260801T120000Z RESTORE-CENTER-ESTATES
```

Before a production restore, take another backup, verify the selected directory and announce downtime. Afterward, check container health, API health, login, organization selection and one record from every subscribed module.

The active shared-Caddy site is mirrored in `infrastructure/docker/Caddyfile`. Validate and reload after changing it:

```bash
docker exec caddy-caddy-1 caddy validate --config /etc/caddy/Caddyfile
docker exec caddy-caddy-1 caddy reload --config /etc/caddy/Caddyfile
```
