# Property billing and reporting specification coverage

This matrix is the release contract for the three client specifications dated August 2026. A row is `PASS` only when the current implementation has scoped API evidence, an interactive browser journey, every required export format, and the relevant role allow/deny checks.

## Evidence levels

- `PASS`: API, browser, export, property/role scope, and audit evidence all exist.
- `PARTIAL`: useful implementation exists but one or more release gates are missing.
- `MISSING`: the specified workflow or authoritative dataset is not implemented.

## Scheduled invoicing and billing

| Requirement | Current evidence | Status | Remaining release gate |
|---|---|---:|---|
| Monthly queue derived from active lease and billing terms | `BillingRun`, `BillingCandidate`, billing dashboard, backend tests | PARTIAL | Browser coverage for multiple periods/properties and queue pagination/filtering |
| Readiness exceptions remain visible and actionable | readiness issue records and prepare action | PARTIAL | Complete UI resolution links for every issue code |
| Review, authorize, generate, issue, collect | candidate selection and run actions | PARTIAL | Enforce universal no-self-approval and test interrupted/retried batch generation |
| Effective-dated recurring billing and rent escalation | billing profiles and `Lease.effective_rent()` | PARTIAL | Role/E2E evidence for annual, biennial, custom, and mid-period changes |
| Manual single invoice | invoice card and API | PARTIAL | Browser allow/deny plus credit/debit correction journey |
| Unique immutable invoice and adjustment sequences | organization-scoped constraints and generated numbers | PARTIAL | Concurrency test for sequence allocation |
| Water reading to tariff to invoice traceability | meter reading approval and metered profiles | PARTIAL | Full approved-reading-to-generated-invoice browser assertion |
| Bulk/check-meter reconciliation and variance exception | facility reconciliation records/readiness | PARTIAL | Complete property UI and approval E2E |
| Smart-meter ingestion | authenticated idempotent ingestion endpoint | PARTIAL | Vendor/device registry, signature policy, retry/dead-letter monitoring |
| Invoice register/status/filter coverage | invoice register | PARTIAL | All specification filters and saved views |
| Cancellation, credit note and audit trail | void/credit models and endpoints | PARTIAL | Universal immutable posted-ledger and no-self-approval tests |
| Tenant issue/receipt/statement access | tenant portal documents | PARTIAL | Full tenant-role browser acceptance and delivery audit |

## Tenancy and occupancy reports

| Report/tab | Live scoped data | Required detail | PDF/XLSX/CSV | Saved/scheduled | Status |
|---|---:|---:|---:|---:|---:|
| Overview | Yes | KPIs and distribution | Yes | Yes | PARTIAL |
| Tenancy schedule | Yes | floor, unit, use, area, financial terms, escalation, status, comments | Yes | Yes | PARTIAL |
| Vacancy | Yes | ageing, expected rent, reason, marketing status | Yes | Yes | PARTIAL |
| Move ins / move outs | Yes | separate dates, rent and exit reason | Yes | Yes | PARTIAL |
| Income analysis | Yes | current/projected income and escalation | Yes | Yes | PARTIAL |
| Lease expiry | Yes | expiry days, rent, tenant/unit/status | Yes | Yes | PARTIAL |
| Custom reports | Saved filters | configurable definition | Yes | Yes | PARTIAL |

All rows remain `PARTIAL` until tab-specific browser exports, landlord scope, and filter-refresh behavior have direct acceptance evidence.

## Financial reports

| Report/tab | Ledger-derived | Required detail | PDF/XLSX/CSV | Saved/scheduled | Status |
|---|---:|---:|---:|---:|---:|
| Overview | Yes | billed, collected, rate, arrears, expenses, net income | Yes | Yes | PARTIAL |
| Billing and collection | Yes | invoice, tenant/unit, dates, VAT, paid, balance, status | Yes | Yes | PARTIAL |
| Arrears | Yes | actual due-date ageing and last payment | Yes | Yes | PARTIAL |
| Income and expense | Yes | categorized income/expense and net result | Yes | Yes | PARTIAL |
| VAT and statutory | Yes | output/input VAT transaction schedule | Yes | Yes | PARTIAL |
| Expenses | Yes | supplier, reference, tax, budget/cost centre and status | Yes | Yes | PARTIAL |
| Service charge performance | Yes | budget, billed, expenditure, variance, utilization | Yes | Yes | PARTIAL |
| Budgets | Yes | approved/versioned budget, actual, amount/% variance | Yes | Yes | PARTIAL |
| Reports library | Yes | definitions, executions and delivery history | Yes | Yes | PARTIAL |

## Cross-cutting gates

| Gate | Status | Evidence still required |
|---|---:|---|
| Property and organization scope | PARTIAL | allow/deny tests for manager, landlord, accountant and unauthorized property across all three surfaces |
| Auditability | PARTIAL | exports and schedules are audited; dashboard view/export filter parity needs broader assertions |
| Seed history | PARTIAL | twelve-month ledgers exist; verify every property has movements, vacancies, budgets, VAT, service charge and meter history |
| Accessibility/responsiveness | PARTIAL | desktop and mobile browser coverage for dense tables, filters, menus and downloads |
| Export fidelity | PARTIAL | golden visual samples and reconciliation assertions for every critical PDF family |
| Failure/retry behavior | PARTIAL | scheduled delivery retry, partial batch failure and duplicate-generation tests |

