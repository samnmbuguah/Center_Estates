# Contributing to Center Estates ERP

## Development environment setup

### Backend (Django)

```bash
cd apps/backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # edit with local DB credentials
python manage.py migrate
python manage.py seed_platform
python manage.py seed_construction
python manage.py runserver
```

### Frontend (Next.js)

```bash
cd apps/web
npm install
npm run dev
```

The frontend proxies API requests to `http://localhost:8000` in development.

### Running tests

```bash
# Backend
cd apps/backend && .venv/bin/python manage.py test

# Frontend lint + build
cd apps/web && npm run lint && npm run build
```

## Code style conventions

### Python / Django

- Follow PEP 8 with 120-character line length.
- Use `OrganizationOwnedModel` as the base for organization-scoped models.
- Model validation goes in `clean()` methods; API-layer validation in serializers.
- Prefer `update_or_create` for idempotent seed data.
- Never hard-code organization slugs in business logic.

### TypeScript / React

- Use TypeScript strict mode.
- Prefer named exports over default exports.
- Use the design system tokens (badge, pill, modal CSS) from `apps/web/styles/`.
- One component per file; co-locate related components.

## Testing requirements

- All model changes require `python manage.py test <app>` to pass.
- All API changes require at least one serializer and view test.
- Frontend changes require `npm run lint` and `npm run build` to succeed.
- New features must include integration or E2E tests where practical.

## Pull request workflow

1. Create a feature branch from `main`.
2. Make changes in small, focused commits.
3. Run `python manage.py test` (backend) or `npm run lint && npm run build` (frontend).
4. Open a PR with a clear description and link to the relevant issue.
5. Request review from at least one maintainer.
6. Address review feedback; push new commits (do not force-push during review).
7. Merge after approval and green CI.

## Commit message format

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

[optional body]

[optional footer(s)]
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`

**Scopes**: `properties`, `facilities`, `sales`, `tenders`, `valuations`, `construction`, `companion`, `organizations`, `web`, `api`, `infra`

**Examples**:

```
feat(construction): add BoQ cost state tracking
fix(sales): correct installment amount calculation
docs(deployment): add backup and restore procedures
chore(web): update Next.js to 15.3
```
