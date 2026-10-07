# Security Policy

## Reporting Security Issues

We take the security and integrity of Center Estates ERP seriously. If you discover a potential vulnerability, sensitive information exposure, or security weakness, please report it to us responsibly.

**Please do not report security vulnerabilities via public GitHub issues or discussions.**

Instead, please report security vulnerabilities using one of the following methods:

1. **GitHub Private Vulnerability Reporting**: Go to the **Security** tab of the repository and click **"Report a vulnerability"**.
2. **Email**: Send your findings directly to `samnmbuguah@gmail.com`.

### What to Include in Your Report

To help us triage and resolve the issue quickly, please include:
- A clear description of the vulnerability and its potential impact.
- Step-by-step instructions or proof-of-concept to reproduce the behavior.
- Affected endpoints, parameters, models, or components.
- Any suggestions for remediation, if applicable.

We will acknowledge receipt of your report within 48 hours and provide updates as the issue is investigated and addressed.

## Supported Versions

Only the current `main` branch receives active security updates and patches.

## Security Practices

- **Zero Credentials in Git**: Secrets, tokens, and database passwords must never be committed. All local secrets belong in `.env` or `.env.local` which are ignored by `.gitignore`.
- **Tenant Isolation**: All database operations and queries must be strictly scoped to the active organization (`OrganizationOwnedModel`).
- **Authentication**: JWT authentication uses HttpOnly cookies with CSRF protection and rate limiting.
