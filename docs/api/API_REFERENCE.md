# Center Estates ERP API reference

The live OpenAPI schema is the authoritative, complete endpoint catalogue. It is generated from the Django REST Framework routes and serializers, so it remains current as endpoints evolve.

| Resource | URL |
| --- | --- |
| Interactive API console (Swagger) | `https://api.centerestates.com/console/` |
| OpenAPI schema | `https://api.centerestates.com/api/v1/schema/` |
| Existing documentation alias | `https://api.centerestates.com/api/v1/docs/` |
| ReDoc reference | `https://api.centerestates.com/redoc/` |
| Health check | `https://api.centerestates.com/api/v1/health/` |

## Authentication and tenant scope

Browser clients use secure cookie authentication. Obtain the CSRF token at `GET /api/v1/auth/csrf/`, then sign in with `POST /api/v1/auth/login/`. Requests which change data must include the returned CSRF token. The active organization is sent through the existing `X-Organization-Id` header; property-scoped data additionally uses `X-Property-Id` where applicable. The API console exposes each endpoint's parameters, request body, response schema and authorization requirements.

## Endpoint groups

- `/api/v1/auth/` — session, login, refresh, logout, password reset and identity.
- `/api/v1/access/` and `/api/v1/organizations/` — memberships, roles, permissions, branding and subscriptions.
- `/api/v1/property/` — property onboarding, buildings, units, tenancy, billing, receipting, reports and owner workflows.
- `/api/v1/facility/` — assets, PPM, meters, tickets, incidents, work orders, procurement, providers and FM reporting.
- `/api/v1/companion/` — tasks, messages, AI companion, campaigns and performance.
- `/api/v1/documents/`, `/api/v1/notifications/`, `/api/v1/audit/` — shared records.
- `/api/v1/testing/checklist/` — administrator release-checklist progress.

Use the console rather than this prose document to obtain the full endpoint list, required fields and response examples for the deployed release.
