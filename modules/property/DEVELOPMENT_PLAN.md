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
- Area/equal service-charge apportionment is server-calculated with exact annual totals, persistent unit schedules and YTD reconciliation evidence.
- Budget lines follow draft/pending/approved/rejected controls and expose live approved-expense actuals and variance.
- Arrears aging, income/expense analytics and six organization-scoped CSV report families are generated from live ledger data.
- Property intake can generate a bounded, idempotent unit mix; building, unit and project registers are exposed in the shared UI.
- User-to-tenant portal access is organization-scoped and serves the same leases, invoices, receipts, documents, notices and Facility service requests as staff workflows.
- Renewals preserve lease lineage and occupancy, reminders persist delivery evidence and portal notices, and bank transactions enforce one-to-one equal-amount receipt matching.

All 17 references in [UI_REFERENCE.md](docs/UI_REFERENCE.md) are acceptance checkpoints.
