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

The established live suite proves administrator workflows across all modules and tenant self-service. The desktop role-control slice covers one-module visibility for viewers, Sales separation, construction certifier/finance controls, tender board and valuation reviewer gates, plus admin demo-identity switching.

Demo identity switching (super-admin profile menu) is available for all seeded `role-*` users and `admin`.

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
| `ROLE-SALES-AGENT` | Sales agent can register buyers but cannot verify payments. |
| `ROLE-SALES-CLERK` | Site clerk cannot register buyers and opens site visits. |
| `ROLE-SALES-ADVOCATE` | Advocate reaches legal documents without sales mutations. |
| `ROLE-LEASING-OFFICER` | Leasing officer cannot administer property inventory or post receipts. |
| `ROLE-PROPERTY-ACCOUNTANT` | Accountant can post receipts but cannot administer property inventory. |
| `ROLE-FACILITY-TECHNICIAN` | Technician can create work orders under the facility work permission. |
| `ROLE-FACILITY-INSPECTOR` | Inspector can create corrective work orders as part of inspection follow-up. |
| `ROLE-TECHNICAL-AUTHOR` | Technical author cannot register tender invitations. |
| `ROLE-TENDER-BOARD` | Board reviewer cannot register invitations and can open review gates. |
| `ROLE-VALUATION-COORDINATOR` | Coordinator can register valuation instructions. |
| `ROLE-VALUER-INSPECTOR` | Field valuer cannot register instructions. |
| `ROLE-VALUATION-REVIEW` | Reviewer cannot create instructions and can open draft reports. |
| `ROLE-CONSTRUCTION-AUDITOR` | Auditor can export reports but cannot create project workspaces. |
| `ROLE-CONSTRUCTION-CERTIFY` | Certifier cannot create workspaces and sees progress Verify actions. |
| `ROLE-CONSTRUCTION-FINANCE` | Finance officer cannot create workspaces and opens payment controls. |
| `ROLE-CONSTRUCTION-ADMIN` | Construction admin can create project workspaces and export reports. |
| `ROLE-ADMIN-SWITCH` | Super admin profile menu exposes demo identity switching. |

The backend permission suite independently covers safe-read allow, mutation deny, manage allow and approve separation for all six modules.

### Core demo acceptance gate

The Property, Facility and Companion release slice was last verified on 22 August 2026. The role gate passed 17/17 desktop browser journeys, the critical workflow gate passed 38/38 executed journeys with one intentionally skipped duplicate mobile mutation, and the complete backend suite passed 224/224 tests. Backend coverage is 65.3% for the active core domains and the frontend unit/component gate passed 29/29 tests. The role gate covers the four core roles (Portfolio Manager, Operations Staff, Finance Officer and Read Only), module viewers, Leasing Officer, Property Accountant, Facility Technician, Facility Inspector, Facility Occupant and Companion Viewer. The scheduled acceptance workflow runs this traceable slice before the full browser suite.

| Module | Role | Representative user story | Current state |
|---|---|---|---|
| Platform | Super / organization administrator | Subscribe modules, manage access, demo-switch identities | PASS |
| Property | Property manager | Manage properties, units, leases, service charges and operational reports | ADMIN-PASS |
| Property | Leasing officer | Onboard property-scoped tenants with validated organization cards, verify documents, activate and renew leases without finance approval rights | PARTIAL |
| Property | Accountant / approver | Prepare VAT invoices, submit for independent review, approve/issue with tenant notification, allocate receipts, reconcile bank entries, approve/pay expenses and export finance reports | API-PASS / UI-PARTIAL |
| Property | Tenant | View own lease/invoices/receipts/notices and submit a maintenance request | PASS |
| Facility | Facility manager | Plan maintenance, assign/transition work, manage assets/contractors and review BI | ADMIN-PASS |
| Facility | Technician | View assigned work, update progress, labour/parts/media, but cannot approve or administer | PARTIAL |
| Facility | Inspector | Execute inspections and create corrective work without finance/contractor administration | PARTIAL |
| Facility | Occupant | Submit and follow only own service requests | PARTIAL |
| Sales | Developer/owner | Manage inventory, sales governance, commission approval and portfolio reports | ADMIN-PASS |
| Sales | Sales agent | Manage buyers/sales/visits without payment approval | PARTIAL |
| Sales | Site clerk | Register visits without buyer/payment administration | PARTIAL |
| Sales | Buyer | View own unit, installments, payments and legal documents | MISSING |
| Sales | Financier | Verify permitted payment evidence without selling | PARTIAL |
| Sales | Advocate | Access legal documents without sales/payment administration | PARTIAL |
| Sales | Relationship manager | Review governance/compliance without operational editing | PARTIAL |
| Tender | Tender manager | Register invitations, plan work and progress the gated bid workflow | ADMIN-PASS |
| Tender | Analyst | Confirm AI extraction and maintain compliance requirements | PARTIAL |
| Tender | Technical author | Edit assigned proposal sections without invitation admin | PARTIAL |
| Tender | Pricing officer | Maintain BOQ/pricing without invitation admin | PARTIAL |
| Tender | Board approver/reviewer | Open review gates without invitation admin | PARTIAL |
| Valuation | Coordinator | Register/assign instructions and schedule inspections | PARTIAL |
| Valuation | Valuer/inspector | Complete field evidence without instruction registration | PARTIAL |
| Valuation | Reviewer | Access draft reports without instruction registration | PARTIAL |
| Valuation | Finance officer | Access fees without instruction registration | PARTIAL |
| Valuation | Client | Read delivered reports and own fee records | MISSING |
| Construction | Project administrator | Configure project teams, controls and all project registers | ADMIN-PASS |
| Construction | Clerk of works/site engineer | Submit progress and evidence through offline/mobile sync | PARTIAL |
| Construction | Quantity surveyor | Manage BoQ, variations, certificates and commercial evidence | PARTIAL |
| Construction | Certifier/approver | Verify milestones from the Progress register | PARTIAL |
| Construction | Finance officer | Open payment controls without project create | PARTIAL |
| Construction | Auditor | Read/export without mutations | PARTIAL |

## Demo identities

Seed via `seed_platform` (password from `SEED_ADMIN_PASSWORD` / `SEED_ROLE_PASSWORD`):

- `admin` — superuser + platform admin
- `role-{module}-viewer|operator|approver` for each module
- Business roles: `role-property-manager`, `role-leasing-officer`, `role-property-accountant`, `role-facility-*`, `role-sales-*`, `role-tender-*`, `role-valuation-*`, `role-construction-*`, `role-clerk-of-works`, `role-quantity-surveyor`, …

Switch from the top-right profile menu while signed in as admin.

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

Playwright writes the human-readable report to `artifacts/playwright-report`, machine-readable JUnit to `artifacts/playwright-results.xml`, and failure traces/screenshots/videos to `artifacts/test-results`.
