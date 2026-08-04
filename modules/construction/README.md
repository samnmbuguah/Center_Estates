# Construction Management (Monitoring)

Construction and site monitoring ERP — project portfolio, programme, site evidence, commercial controls, BIM/GIS, progress certification, risk engineering and reporting. Originally the standalone MonitoringERP product; these mockups are the approved design reference ported into the Center Estates shell.

- Source specification: `specification.pdf` (approved UI mockups, 15 screens) and `specification-by-role.pdf` (role-based dashboards, 10 screens).
- UI reference: [docs/UI_REFERENCE.md](docs/UI_REFERENCE.md).
- The legacy implementation is retained under `MonitoringERP/` as a migration source; the integrated module is rendered by `apps/web/src/components/monitoring-workspace.tsx` and `apps/web/src/components/monitoring/pages/*`.

## Functional scope

- Navigation flow: lifecycle stages, project-centric navigation, supporting modules.
- Dashboard: portfolio KPIs, risks, finance, visits, activity and quick actions.
- Project portfolio & active projects: register, cards/table, filters, location and progress summaries.
- Project workspace: unified project overview with programme, finance, documents and actions.
- Programme: performance curve, schedule status, milestones and programme table.
- Construction (site records): progress, labour, materials, equipment, inspections and diary snapshot.
- Financial monitoring: registers, utilization, alerts and payment summaries (BoQ, variations, IPC, drawdowns).
- Risks: risk register, matrix, actions and trends; RFIs.
- Site visits: visit register, calendar, findings, photos and actions.
- Documents: folder/register view, revisions, storage and upload workflow.
- Meetings: meetings, minutes, actions, attendance and linked files.
- Reports: report catalogue, schedules, history and generation.
- Stakeholders: directory, role distribution, engagement and communications.
- Administration: users, roles, settings and audit.

## Roles (from `specification-by-role.pdf`)

Role-specific dashboards covering Project Developer, Sales, Finance, Project Manager, Site Agent, Clerk, Valuer, Facilities and Administrator views — each prioritising the KPIs and registers that role acts on.
