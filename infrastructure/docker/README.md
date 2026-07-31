# Docker deployment

The production-like VM deployment uses PostgreSQL, Gunicorn/Django and the Next.js standalone server. Only loopback ports `4300` and `4301` are published; shared Caddy provides public TLS.

```bash
docker compose up -d --build
docker compose ps
curl https://erp.169-58-102-217.sslip.io/api/v1/health/
```

Secrets are generated locally in `infrastructure/docker/secrets/` and ignored by Git. Back up the PostgreSQL and media volumes before upgrades. The seed command is idempotent and runs at startup while `SEED_DEMO_DATA=true`; disable it after acceptance fixtures are no longer wanted.

The active shared-Caddy site is mirrored in `infrastructure/docker/Caddyfile`. Validate and reload after changing it:

```bash
docker exec caddy-caddy-1 caddy validate --config /etc/caddy/Caddyfile
docker exec caddy-caddy-1 caddy reload --config /etc/caddy/Caddyfile
```
