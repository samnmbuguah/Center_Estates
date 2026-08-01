# Property Management development plan

1. Implement property/building/unit hierarchy, property wizard, bulk units and shared references.
2. Implement tenant onboarding, validation, duplicate checks, documents and organization-scoped search.
3. Implement leases, deposits, rent schedules, escalation, renewal, termination and occupancy updates.
4. Implement invoicing, allocations, receipts, credit notes, arrears, aging and reconciliation controls.
5. Implement service-charge configuration, allocation, budget, tenant schedules and reconciliation.
6. Implement budgets, expenses, supplier invoices and approval workflows.
7. Build tenant portal and notification preferences.
8. Build dashboards/reports, imports/exports, permissions, audit and cross-tenant security tests.

Implemented workflow evidence:

- Lease activation/termination/expiry uses controlled endpoints, rejects double occupancy, and synchronizes unit and tenant status.
- Draft invoices are issued explicitly, balances are server-calculated, paid/partial invoices cannot be voided, and only issued invoices accept receipts.
- Rent schedules generate one tenant invoice idempotently and preserve the schedule-to-invoice link.
- Expenses follow draft → pending → approved/rejected → paid controls; non-draft financial records are locked from generic edits.
- Receipt allocations and credit notes update invoice balances atomically; tenant documents retain audited verification controls.
- Seed data includes actionable lease, invoice, schedule, expense and arrears examples; API and browser tests exercise the workflows.

All 17 references in [UI_REFERENCE.md](docs/UI_REFERENCE.md) are acceptance checkpoints.
