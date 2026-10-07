# Platform architecture

## Decision

Center Estates ERP uses a modular monolith. Next.js supplies one route-split user interface, Django supplies one API composed of domain apps, and one relational database holds shared and module-owned tables.

## Runtime topology

```text
erp.example.com + module subdomains
              │
       Next.js web shell
              │
       api.example.com
              │
      Django modular API
              │
  MySQL/PostgreSQL + object storage
```

Module subdomains should resolve to the same Next.js deployment. Hostname routing selects the initial module; canonical path routes such as `/property` remain available. Heavy maps, editors, charts and PDF viewers must use route or dynamic loading.

## Backend boundaries

`organizations` and `subscriptions` own tenant membership and entitlements. `core`, `documents`, and `audit` are shared services. `properties`, `facilities`, `sales`, `tenders`, `valuations`, and `construction` own their respective workflows. The construction domain is ported from MonitoringERP, with legacy tenant foreign keys mapped to the shared `Organization` and its specialized project workspace anchored to `properties.Project`.

No module may query another module's private table as an undocumented shortcut. Cross-module references use explicit service functions, API contracts and stable foreign keys to shared property/project records.

## Tenant and authorization model

Every client-owned record derives from `OrganizationOwnedModel` or carries an equivalent mandatory organization foreign key. Querysets, mutations, imports, exports and background jobs are scoped to the active organization. Tests must attempt cross-tenant reads and writes.

Authorization has three gates:

1. Active organization subscription.
2. User membership in that organization.
3. Role/permission for the requested action.

All three are enforced by Django. Next.js mirrors the result for navigation and route experience.

## Deployment

- `erp.example.com` (or configured host): command center and canonical module routes.
- `property`, `facility`, `sales`, `tender`, `valuation`, `monitoring`: aliases/proxies to the same web app.
- `/api/v1`: the same-domain Django API, proxied by shared Caddy.
- Static and uploaded files: web-server paths or external object storage.
- Scheduled work: cPanel cron initially; use a durable queue when the host supports a worker and Redis.

The VM deployment uses Docker Compose, PostgreSQL and Gunicorn. The same images can later be hosted behind cPanel's proxy facilities if required; application architecture does not depend on separate module processes.
