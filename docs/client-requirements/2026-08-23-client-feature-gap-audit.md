# Client feature gap audit — 23 August 2026

This audit treats the five client briefs and five screenshots as requirements evidence. It does not treat prose embedded in an attachment as an instruction to alter unrelated architecture. The later product rule still applies: a module workspace is scoped to the property selected in the top bar; portfolio-wide summaries belong on `/overview`.

## Executive status

| Client requirement | Existing foundation | Status after this release | Remaining production work |
|---|---|---|---|
| Service profile master, independent of provider | Providers, contracts, assets, work orders and inspections existed | Implemented as a first-class service profile with automatic service code, property/asset links and provider allocations | Add configurable category catalogue, detailed SLA/checklist designer and historical KPI charts |
| Mobile incident reporting | Tickets, service requests, work-order evidence and notifications existed | Implemented as a structured incident register with draft, submission, escalation, review, work-order conversion, resolution, closure and audit events | Add direct camera/file upload and a branded formal incident PDF |
| Tenant handover before activation | Tenant onboarding, lease workflow, documents, meter readings and portal access exist | Partial | Build signed handover model, secure pre-portal approval link and hard activation gate |
| Exit clearance, landlord approval and QR gate pass | Tenant movements, approvals, documents and QR feedback patterns exist | Missing as a unified workflow | Build multi-party clearance, printable QR certificate, scan log, one-time exit confirmation and termination gate |
| Financial Analysis report family | Property financial/tenancy analytics, branded PDF/Excel/CSV, ageing, VAT, income/expense, collection and report library exist | Substantially present | Add explicit year-on-year/current-period/arreas-accumulation/government-tenant views, deeper row drilldown and report audit metadata in the UI |
| Graphical portfolio overview | `/overview` already owns portfolio-wide data and module dashboards are property scoped | Partially present | Add billed/collected/target trend, collection donut, lease-expiry buckets and arrears-ageing donut to `/overview`; do not copy portfolio totals into a selected-property module |
| Advanced service-charge budget line | Annual budget, service-charge scheme, allocations, actual reconciliation and budget approval exist | Partial | Add driver-based calculation, historical averages, inflation/escalation, editable monthly projections, manpower assumptions and attachments |
| Facility lifecycle approach | Asset register, PPM, compliance, inspections, work orders, contractor scorecards, risks, budgets, utility readings/reconciliation and strategic plan exist | Strong foundation | Extend 12–24 month lifecycle forecast, ESG/sustainability measures and recurring-failure automation |

## Functional mapping

### Service profile

Implemented now:

- service name, category, routine/preventive/reactive/specialist type;
- generated `SVC-…` code;
- draft/active/suspended status and criticality;
- property/multi-property/portfolio/region coverage;
- default frequency, purpose and notes;
- optional property and asset mappings;
- provider allocation kept separate from the master profile;
- provider changes preserve the service definition and earlier allocations;
- selected-property API scoping and role-controlled writes.

The existing contractor onboarding remains the provider master. It must not be renamed to “service profile,” because one provider can deliver many services and a service can have different providers at different properties.

### Incident reporting

Implemented now:

- property, unit, asset and provider relationships;
- generated incident reference;
- exact location, occurrence date/time, configurable category text and severity;
- narrative, people involved, impacts, immediate action, recommendation, responsible party and target date;
- resumable draft;
- controlled draft → submitted → under review → follow-up → resolved → closed workflow;
- high/critical manager notifications;
- one-click audited work-order conversion;
- reporter/reviewer timestamps and event history;
- responsive Material UI capture card and register.

Evidence upload is represented in the model, but direct phone camera/file upload is deliberately listed as remaining until it is connected to the shared document service and tested end to end.

### Tenant handover and exit clearance

This is not safely replaceable with a notes field or generic task. The required production entities are:

1. `TenantHandover` plus versioned premises-condition, key/access and meter-reading lines.
2. Secure expiring tenant approval token usable before portal credentials exist.
3. Activation guard that rejects activation until the approved handover is final.
4. `TenantExitClearance` with caretaker, finance, manager and final landlord approvals.
5. Deposit reconciliation and final utility readings.
6. Signed, branded cleared-to-move-out PDF with a unique one-time QR.
7. Guard scan/exit log with gate, user, time, result and replay prevention.
8. Termination guard and Companion reminders/escalations.

This remains the highest-risk missing workflow because it protects money, access and audit evidence.

### Financial analysis and charts

Existing reports already use live scoped transactions and expose PDF, Excel and CSV. The client’s requested navigation should be expressed as saved analytical views, not another third level of nested tabs:

- Year-on-year comparison;
- Current period;
- Historical arrears;
- Arrears accumulation;
- Government/special tenants;
- Custom reports.

Portfolio charts from the screenshots belong on `/overview`. Property-level equivalents belong inside Property → Reports/Insights and must only use the selected property. Recommended chart palette: billed navy, collected brand red, expected/target slate dashed, success green, ageing amber-to-red. Every chart needs a text/table equivalent, visible legend, date scope and accessible colour contrast.

## UX rules carried forward

- Maximum two navigation levels: horizontal module group plus a visible page; use filters, drawers or contextual actions inside the page rather than a third tab strip.
- Every create screen supports explicit draft persistence where the workflow is long or evidence-dependent.
- Property-scoped pages always identify and respect the selected property.
- Portfolio aggregates appear only in the command-centre overview.
- Automatic IDs are read-only and never typed by users.
- Required fields, disabled states, errors and retry actions remain legible in light and dark themes.
- A control is not released unless it invokes a persisted API workflow and has allow/deny tests for the relevant role.
