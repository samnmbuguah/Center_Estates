# PostHog analytics access

The authenticated command center exposes **Usage Analytics** in the left
sidebar to platform and organization administrators only. The page embeds a
PostHog shared dashboard and also provides a direct PostHog link.

Configure these variables before building the web image:

```env
NEXT_PUBLIC_POSTHOG_KEY=phc_project_key
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
NEXT_PUBLIC_POSTHOG_DASHBOARD_URL=https://app.posthog.com/embedded/your-shared-dashboard-token
```

The dashboard URL must be a PostHog shared/embedded dashboard URL, not a
personal session URL. Treat the shared token as read-only but sensitive: limit
the dashboard to operational metrics appropriate for client administrators and
rotate the link if it is disclosed. Do not include session recordings or
personally sensitive event properties unless the client has approved them.

Rebuild the web service after changing any `NEXT_PUBLIC_*` variable because
Next.js includes these values at build time:

```bash
docker compose up -d --build web
```
