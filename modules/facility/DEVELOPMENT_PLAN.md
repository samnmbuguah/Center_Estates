# Facility Management development plan

1. Model buildings, spaces, asset categories, assets and identifiers; implement organization-scoped imports.
2. Implement work-order state machine, priority/SLA rules, assignment, costs, parts, attachments and audit events.
3. Add preventive schedules, recurrence generation, calendar and overdue escalation.
4. Add inspection templates, mobile-friendly execution, findings and work-order conversion.
5. Add service-request portal, communication timeline, satisfaction and SLA reporting.
6. Add meter readings, consumption/cost calculations, anomaly rules and dashboards.
7. Add contractor compliance, performance and document expiry notifications.
8. Build reports/exports, permission matrix, tenant-isolation tests and end-to-end workflows.

Acceptance is traced to all 12 screens in [UI_REFERENCE.md](docs/UI_REFERENCE.md). Maps, charts and calendars are dynamically loaded.

## Implemented control evidence

- Preventive schedules generate idempotent work orders and advance recurrence only through a completion action.
- Failed inspections retain score/findings evidence and can create an audited corrective work order.
- Service requests convert once to maintenance work and retain resolution and satisfaction state.
- Utility readings are immutable; consumption, tariff cost, and anomaly state are calculated server-side.
- These workflows are organization/subscription scoped, backend tested, and exercised in the live desktop UI.
