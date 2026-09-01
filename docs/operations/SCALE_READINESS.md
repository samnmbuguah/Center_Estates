# Capacity and scale readiness

## Current conclusion

The current cPanel deployment is appropriate for demonstration, pilot use and a controlled early rollout. It is **not** a configuration on which to promise 4,000 simultaneously active users. Four thousand registered client accounts is a different and much lower demand than four thousand people concurrently making API requests.

The live host has considerable shared machine resources, but the application remains a single cPanel/Passenger-style backend deployment and the account process file-descriptor limit is 1,024. It has no demonstrated application autoscaling, queue worker fleet, cache tier, database connection pooler, CDN-backed media tier, or completed concurrency benchmark. Recent production timeouts also make a concurrency claim inappropriate until measured.

## Capacity decision gate

Before selling a 4,000-concurrent-user commitment, execute a load test against a production-like environment and meet these acceptance criteria:

| Measure | Target |
| --- | --- |
| Critical API success rate | >= 99.9% |
| Login / session p95 | <= 1.5 seconds |
| Common read p95 | <= 800 ms |
| Write p95 | <= 2 seconds |
| Error rate | < 0.1% |
| No database pool exhaustion, worker saturation or queue backlog | Required |

Model the actual peaks: sign-in, command-centre/dashboard reads, property switching, invoice generation, receipt posting, PDF download, meter capture and evidence upload. Run the test using k6 or Locust, step from 100 through 500, 1,000, 2,000 and 4,000 active virtual users, and retain the result with the release checklist.

## Target architecture for 4,000 concurrent users

1. Run at least two stateless Django application instances behind a managed load balancer, with autoscaling and health checks.
2. Use managed PostgreSQL with backups, monitoring, connection pooling (PgBouncer) and read replicas where measured reads require them.
3. Use Redis for cache, throttling/session support and Celery task state; move PDFs, email, invoice batches and imports to queue workers.
4. Put uploads and generated documents in object storage and distribute public/static assets through a CDN.
5. Add APM, centralized logs, error tracking, database slow-query monitoring and availability alerts.
6. Maintain tested backup restoration, deployment rollback and an incident runbook.

The frontend should keep role/module code splitting and request caching; the backend should enforce organization scoping and move long-running work out of web requests.
