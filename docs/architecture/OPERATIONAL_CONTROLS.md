# Operational controls: notifications, approvals, reports and meters

This document is the implementation contract for Center Estates operational hierarchy. UI visibility never grants authority; every decision is enforced by organization, module, property scope and permission at the API.

## Authority hierarchy

1. **Organization administrator** configures subscriptions, roles, properties, approval assignments and integrations.
2. **Module manager / approver** reviews exceptions and commits controlled business records.
3. **Preparer / operations officer** creates and submits records but cannot approve their own work where segregation is required.
4. **Field user / caretaker / technician** captures evidence and readings for an assigned property. Entries remain unapproved until reviewed.
5. **Tenant / occupant** sees only their own lease, documents, invoices, receipts, statements and requests.

All controlled records retain preparer/reviewer timestamps and are immutable after financial posting. Rejections require a reason. Reversals create history instead of deleting the original.

## Approval register

| Domain | Prepared or submitted by | Reviewed or approved by | Committed outcome |
|---|---|---|---|
| Tenant application and lease | Leasing officer | Property manager | Active tenant and lease |
| Tenant/property documents | Leasing or property officer | Property approver | Verified compliance document |
| Scheduled billing run | Billing officer | Property approver | Generated/issued invoice batch |
| Manual invoice | Billing officer | Property approver | Issued tenant invoice |
| Credit note | Billing officer | Property approver | Applied credit or void history |
| Expense | Property accountant | Property approver | Approved then paid expense |
| Bank reconciliation | Collections officer | Property approver | Matched receipt/bank transaction |
| Manual or imported meter reading | Caretaker/technician/integration | Facility approver | Approved consumption available to billing |
| Meter reset/replacement | Facility administrator | Facility approver | Immutable reset baseline |
| Bulk/check-meter variance | Facility officer | Facility approver | Approved reconciliation or documented exception |
| Service request | Occupant/caretaker | Facility officer | Accepted/rejected and optionally converted to work order |
| Work order completion | Technician | Facility manager | Completed job with evidence/costs |
| Sales payment | Sales officer | Sales approver | Verified/rejected/reversed payment |
| Commission | Sales officer | Sales approver | Approved/paid commission |
| Tender evaluation/award | Evaluator | Tender committee/approver | Decision and award audit trail |
| Valuation report/invoice | Valuer | Valuation approver | Approved/delivered report or issued invoice |
| Construction requisition/variation/IPC | Site/consultant preparer | Project approver | Approved, rejected, issued or paid record |

## Notification policy

Notifications appear in the global bell and link to their source record. They are organization- and recipient-scoped.

- **Immediate:** approval assigned, approved/rejected, invoice/receipt issued, payment matched/reversed, work order assigned/escalated, meter anomaly, ingestion failure.
- **Calendar-derived:** lease expiry, invoice/rent due, document expiry, inspections, planned maintenance, work-order/SLA deadlines and assigned Companion tasks.
- **Reminder cadence:** normal events seven days before; high priority within fourteen days; overdue items remain urgent until the source record is resolved.
- **Deduplication:** one notification per recipient and source event key; synchronization updates it rather than producing alert storms.
- **Channels:** in-app is authoritative. Email is used for scheduled-report delivery and external tenant documents. SMS/WhatsApp remain optional configured delivery channels, never the system of record.

## Report library grouping

The client-agreed top-level groups are:

1. **Financial** — critical financial reports, collections and reconciliation, aging, budgets, service charge and statutory outputs.
2. **Tenants & Occupancy** — tenancy schedule, vacancies, movements, occupancy, income and lease expiry.
3. **Service Providers** — provider expiry, contract/service performance and work-order spend.
4. **Compliance & Risk** — tenant/property document compliance, critical dates and exception registers.

Use PDF for signed, branded or management-facing documents; use XLSX for reviewable operational workbooks; use CSV for machine-readable extracts and integrations. A PDF export must show the Center Estates logo, management entity/address/contact, property, report title, reporting period, preparer, generation timestamp, page number and totals. Financial figures must reconcile to their source ledgers.

## Utility meter lifecycle

1. Facility administrator registers active water/electricity meters against a property, unit or common area and configures tariff and bulk/check-meter relationships.
2. Caretaker records a manual/mobile reading, or an authenticated integration posts an IoT/import reading with an idempotent source reference.
3. The backend derives previous value, consumption, cost and anomaly status. Reverse or out-of-sequence readings are blocked/rejected.
4. The reading remains **Pending review** (operational draft) and cannot feed billing.
5. A user with `facility.approve` approves or rejects it with review notes.
6. Approved readings feed utility billing; bulk/check-meter variance requires a separate reconciliation approval.

The dedicated `/caretaker-portal` opens the property-scoped active meter register. `/companion?tab=meter-readings` remains an alternate entry point for staff already working in Companion.
