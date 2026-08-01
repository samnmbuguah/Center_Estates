# Role and user-story coverage ledger

This is the release source of truth for role-based acceptance. A story is only `PASS` when its positive and negative API authorization tests pass and its user-facing browser journey passes. `ADMIN-PASS` means the workflow is proven only through the acceptance administrator and is not role-complete.

## Required evidence

| Evidence | Meaning |
|---|---|
| API allow | The intended role can perform the action in an organization it belongs to. |
| API deny | A viewer, unrelated role, unsubscribed organization and foreign tenant cannot perform it. |
| UI allow | The intended role sees and can complete the action in the browser. |
| UI deny | Users without permission do not see the action and direct navigation/API attempts fail. |
| Audit | The successful or rejected controlled action leaves the required audit evidence. |

## Current baseline

The established live suite has 34 passing browser scenarios and 10 intentional alternate-viewport skips. It proves administrator workflows across all modules and tenant self-service. The desktop role-control slice includes one-module visibility for viewers, Sales separation, and named business-role control visibility. These checks are useful evidence, but a role remains `PARTIAL` until its complete allow/deny workflow and audit trail are exercised.

## Passing role-control slice

| Story | Evidence currently passing |
|---|---|
| `ROLE-PROPERTY-VIEW` | Property viewer sees only Property and can open its dynamic dashboard. |
| `ROLE-FACILITY-VIEW` | Facility viewer sees only Facility and can open its dynamic dashboard. |
| `ROLE-SALES-VIEW` | Sales viewer sees only Sales and can open its dynamic dashboard. |
| `ROLE-TENDER-VIEW` | Tender viewer sees only Tender and can open its dynamic dashboard. |
| `ROLE-VALUATION-VIEW` | Valuation viewer sees only Valuation and can open its dynamic dashboard. |
| `ROLE-MONITORING-VIEW` | Monitoring viewer sees only Monitoring and can open its dynamic dashboard. |
| `ROLE-SALES-DENY` | Sales viewer cannot see buyer-registration or payment-verification controls. |
| `ROLE-SALES-MANAGE` | Sales operator can register a buyer but cannot verify payments. |
| `ROLE-SALES-FINANCE` | Sales financier can verify payments but cannot register a buyer. |
| `ROLE-LEASING-OFFICER` | Leasing officer cannot administer property inventory or post receipts. |
| `ROLE-PROPERTY-ACCOUNTANT` | Accountant can post receipts but cannot administer property inventory. |
| `ROLE-FACILITY-TECHNICIAN` | Technician can create work orders under the facility work permission. |
| `ROLE-FACILITY-INSPECTOR` | Inspector can create corrective work orders as part of inspection follow-up. |
| `ROLE-TECHNICAL-AUTHOR` | Technical author cannot register tender invitations. |
| `ROLE-VALUATION-COORDINATOR` | Coordinator can register valuation instructions. |
| `ROLE-VALUER-INSPECTOR` | Field valuer cannot register instructions. |
| `ROLE-CONSTRUCTION-AUDITOR` | Auditor can export reports but cannot create project workspaces. |

The backend permission suite independently covers safe-read allow, mutation deny, manage allow and approve separation for all six modules. It currently passes as part of the 120-test backend suite.

| Module | Role | Representative user story | Current state |
|---|---|---|---|
| Platform | Organization administrator | Subscribe modules, manage organization-scoped access and use every subscribed module | ADMIN-PASS |
| Property | Property manager | Manage properties, units, leases, service charges and operational reports | ADMIN-PASS |
| Property | Leasing officer | Onboard tenants, verify documents, activate and renew leases without finance approval rights | PARTIAL |
| Property | Accountant | Issue invoices, allocate receipts, reconcile bank entries, approve/pay expenses and export finance reports | PARTIAL |
| Property | Tenant | View own lease/invoices/receipts/notices and submit a maintenance request | PASS |
| Facility | Facility manager | Plan maintenance, assign/transition work, manage assets/contractors and review BI | ADMIN-PASS |
| Facility | Technician | View assigned work, update progress, labour/parts/media, but cannot approve or administer | PARTIAL |
| Facility | Inspector | Execute inspections and create corrective work without finance/contractor administration | PARTIAL |
| Facility | Occupant | Submit and follow only own service requests | PARTIAL |
| Sales | Developer/owner | Manage inventory, sales governance, commission approval and portfolio reports | ADMIN-PASS |
| Sales | Sales agent | Manage assigned buyers/sales/visits and view own performance without payment approval | MISSING |
| Sales | Site clerk | Register visits and buyer leads without pricing, legal or commission approval access | MISSING |
| Sales | Buyer | View own unit, installments, payments and legal documents | MISSING |
| Sales | Financier | Read financed sales/progress and verify permitted payment evidence | MISSING |
| Sales | Advocate | Upload immutable legal evidence without sales/payment administration | MISSING |
| Sales | Relationship manager | Review governance/compliance without operational editing | MISSING |
| Tender | Tender manager | Register invitations, plan work and progress the gated bid workflow | ADMIN-PASS |
| Tender | Analyst | Confirm AI extraction and maintain compliance requirements | MISSING |
| Tender | Technical author | Edit assigned proposal sections without seeing restricted pricing | PARTIAL |
| Tender | Pricing officer | Maintain BOQ/pricing without proposal or board-decision administration | MISSING |
| Tender | Board approver/reviewer | Decide bid/no-bid and approval gates without editing source evidence | MISSING |
| Valuation | Coordinator | Register/assign instructions and schedule inspections | PARTIAL |
| Valuation | Valuer/inspector | Complete field evidence, comparables and draft reports | PARTIAL |
| Valuation | Reviewer | Request changes/approve drafts and issue controlled final reports | MISSING |
| Valuation | Finance officer | Issue invoices, allocate payments and access fee aging without editing valuations | MISSING |
| Valuation | Client | Read delivered reports and own fee records | MISSING |
| Construction | Project administrator | Configure project teams, controls and all project registers | ADMIN-PASS |
| Construction | Clerk of works/site engineer | Submit progress and evidence through offline/mobile sync | PARTIAL |
| Construction | Quantity surveyor | Manage BoQ, variations, certificates and commercial evidence | ADMIN-PASS |
| Construction | Certifier/approver | Verify milestones and approve controlled financial/governance actions | MISSING |
| Construction | Finance officer | Process approved disbursements/recoveries without changing technical evidence | MISSING |
| Construction | Auditor | Read immutable audit, document and finance evidence without mutations | PARTIAL |

## Tracking rules

1. Every role fixture has a named user, organization membership, one or more roles and explicit permission keys.
2. Browser tests are tagged `@role:<slug>`, `@module:<slug>` and `@story:<id>` so CI can run or report a slice.
3. Each story ID appears in the specification traceability matrix, backend permission test and browser test title.
4. CI publishes JUnit and HTML results; skipped role stories are treated as coverage debt, not passes.
5. The release summary reports `PASS / PARTIAL / MISSING` totals by module and role, separately from raw test count.

## Running and retaining evidence

```bash
# Complete browser acceptance suite
E2E_ADMIN_PASSWORD=... E2E_ROLE_PASSWORD=... npm run e2e

# Role-control regression slice
E2E_ADMIN_PASSWORD=... E2E_ROLE_PASSWORD=... npm run e2e:roles

# One traceable story
npm run e2e:story -- 'ROLE-SALES-APPROVE'
```

Playwright writes the human-readable report to `artifacts/playwright-report`, machine-readable JUnit to `artifacts/playwright-results.xml`, and failure traces/screenshots/videos to `artifacts/test-results`. The Acceptance workflow retains all three on every run, including failures.
