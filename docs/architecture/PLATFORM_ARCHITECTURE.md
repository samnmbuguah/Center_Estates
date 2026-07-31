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

`organizations` and `subscriptions` own tenant membership and entitlements. `core`, `documents`, and `audit` are shared services. `properties`, `facilities`, `sales`, `tenders`, and `valuations` own their respective workflows. Monitoring is introduced after its existing models have been mapped.

No module may query another module's private table as an undocumented shortcut. Cross-module references use explicit service functions, API contracts and stable foreign keys to shared property/project records.

## Tenant and authorization model

Every client-owned record derives from `OrganizationOwnedModel` or carries an equivalent mandatory organization foreign key. Querysets, mutations, imports, exports and background jobs are scoped to the active organization. Tests must attempt cross-tenant reads and writes.

Authorization has three gates:

1. Active organization subscription.
2. User membership in that organization.
3. Role/permission for the requested action.

All three are enforced by Django. Next.js mirrors the result for navigation and route experience.

## Deployment

- `erp.example.com`: command center.
- `property`, `facility`, `sales`, `tender`, `valuation`, `monitoring`: aliases/proxies to the same web app.
- `api.example.com`: Django under Passenger/WSGI.
- Static and uploaded files: web-server paths or external object storage.
- Scheduled work: cPanel cron initially; use a durable queue when the host supports a worker and Redis.

Confirm cPanel Node, Python, database, wildcard TLS, proxy, process and cron capabilities before production configuration.

