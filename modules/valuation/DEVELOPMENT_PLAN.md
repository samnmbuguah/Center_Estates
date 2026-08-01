# Valuation development plan

1. Model instructions, purposes/types, client/property links, assignment, SLA and fee quote.
2. Implement inspection scheduling and field-friendly evidence/checklist capture.
3. Implement comparable evidence, valuation methods and calculation review controls.
4. Implement report templates, draft versions, comments and reviewer approval.
5. Implement final signing, immutable issue versions, delivery and document access logs.
6. Implement invoices, tax, receipts, allocation, outstanding aging and reminders.
7. Build dashboards/analytics, exports, permissions, audit and end-to-end instruction tests.

## Implemented control evidence

- Instruction progression is an audited state machine gated by scheduled and evidence-backed completed inspections, draft review, final issue and delivery.
- Inspection completion requires checklist, findings and evidence; completed field evidence and checksum-signed final reports are immutable.
- Comparable rates and adjusted values, invoice totals and payment balances are calculated server-side and protected from over-allocation.
- Draft review, changes, approval, invoice issue/void, final issue/delivery and payment allocation use explicit controlled actions with audit evidence.
- Team analytics, fee aging and five organization-scoped CSV reports cover instruction SLA, inspections, comparables, final reports and fees.
