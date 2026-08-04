# Companion & Staff Performance development plan

## Backend (`apps/backend/companion/`)
1. **Task** model: assigned_to (FK User), assigned_by, title, description, source_module, source_ref, priority, status (pending/acknowledged/in_progress/completed/delegated/cancelled), due_at, completed_at, sla_due_at, delegated_to, attachments, template, recurrence, created_at, updated_at. Organization-scoped.
2. **TaskTemplate** and **TaskRecurrence** models for reusable assignments.
3. **TaskEvent** audit: acknowledge/complete/delegate/escalate transitions with timestamps + user.
4. **CompanionEvent** ingestion: signals from other modules (property, facility, sales, tender, valuation, visitor, calendar) create Task rows via a `create_companion_action(org, user, source_module, source_ref, title, due_at, sla)` helper.
5. **PerformanceMetric** / aggregation endpoints:
   - `GET /companion/dashboard/` — companion actions for the current user (by status, overdue, due today, escalated).
   - `GET /companion/tasks/` — list/create/transition tasks.
   - `GET /companion/performance/` — admin/manager: DAU, last logins, screen time, module usage, tasks assigned vs completed, overdue by staff, TAT, SLA compliance, adoption score, workload balance; date-range filters.
   - `GET /companion/performance/staff/:id/` — individual staff drill-down history.
6. SLA escalation worker/cron: scan tasks past `sla_due_at` → set escalated + push to performance dashboard.
7. RBAC: `companion.view` (own tasks), `companion.assign` (managers/admins), `companion.performance.view` (admins/managers).

## Frontend (`apps/web/src/app/companion/` + workspace)
1. Register module in `lib/modules.ts` and `lib/module-nav.ts` (`companionNav`).
2. `companion-workspace.tsx` rendering `ModuleShell` with:
   - **overview** — My Companion (personal command center): greeting, due-today, overdue, escalated, my tasks list with acknowledge/complete/delegate actions.
   - **tasks** — Task Assignment Centre (managers): assign to one/many staff, templates, recurring, deadlines, priorities, attachments, reminders, delegation.
   - **performance** — Performance Dashboard: KPI strip (DAU, usage time, tasks completed, completion rate, avg TAT, adoption score), attention/escalated panels, staff table with drill-down, date-range filter.
   - **templates** — task templates.
   - **audit** — task event audit trail.
3. Land users on Companion by default after login (redirect `/` → `/companion` for authenticated staff, per acceptance criteria).
4. Auto-create companion actions from module events (wire ingestion helper into existing module viewsets).

## Acceptance
Companion opens by default post-login; scheduled ERP events appear automatically; delegation works; admins monitor adoption/productivity; overdue auto-escalates; analytics support date-range filtering; full audit trail.