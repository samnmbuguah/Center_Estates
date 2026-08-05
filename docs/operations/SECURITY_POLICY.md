# Security Policy

## Authentication

- JWT-based authentication using HttpOnly cookies (`ce_access`, `ce_refresh`).
- Password validation enforces: attribute similarity, minimum length, common password check, and numeric password check.
- Access tokens expire after 15 minutes; refresh tokens after 7 days.
- Refresh token rotation is enabled.

## Authorization

- Role-Based Access Control (RBAC) enforced via DRF permission classes.
- All data access is scoped to the authenticated user's organization.
- Default permission class: `IsAuthenticated`.

## Data Protection

- **CSRF**: Enabled via Django middleware; cookie set to secure in non-debug mode.
- **CORS**: Restricted to configured allowed origins via `django-cors-headers`.
- **HSTS**: Strict-Transport-Security header set to 1 year with subdomains and preload (non-debug).
- **CSP**: Content-Security-Policy header applied to all `/api/` responses.
- **Secure Headers**: X-Content-Type-Options, X-Frame-Options, Referrer-Policy, and Permissions-Policy headers set on API responses.

## Rate Limiting

- Login endpoint throttled (default: 10/minute).
- Token refresh endpoint throttled (default: 30/minute).
- Rates configurable via `AUTH_LOGIN_RATE` and `AUTH_REFRESH_RATE` environment variables.

## Audit Logging

- Structured logging configured with verbose formatter (level, timestamp, module, message).
- Log levels configurable via `DJANGO_LOG_LEVEL` and `DJANGO_DB_LOG_LEVEL` environment variables.
- Database query logging default: WARNING level.

## Vulnerability Reporting

Report security vulnerabilities privately by opening an issue with the `security` label on the project repository. Do not disclose vulnerabilities publicly.

## Incident Response

1. Identify and confirm the security incident.
2. Contain the incident (isolate affected systems, revoke compromised credentials).
3. Eradicate root cause and restore services.
4. Conduct post-incident review and update security controls.
