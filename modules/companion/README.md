# Companion & Staff Performance

A new CeEst Workplace module that gives every staff member a personal command center (the Companion) and gives administrators/managers a Staff Performance Dashboard. System events from Property, Facility, Help Desk, Procurement, Valuation, Visitor Management and the Calendar automatically create Companion actions; SLA breaches escalate to the Performance Dashboard so no overdue operational task stays hidden in an individual's view.

- Source specification: `specification.pdf` (Companion & Staff Performance Enhancement Brief, 5 pages).
- UI reference: [docs/UI_REFERENCE.md](docs/UI_REFERENCE.md).

## Functional scope

### 1. Workspace navigation changes
- **My Companion** — the first screen staff see after login.
- **Performance Dashboard** — available to administrators and managers.
- The existing Workspace design is retained; these two items are added to navigation.

### 2. Staff Performance Management (Performance Dashboard)
Metrics: Daily Active Users · Last login per user (date/month filters) · Average screen time · Active vs idle time · Module usage statistics · Tasks assigned vs completed · Overdue tasks by staff · Staff requiring attention · Escalated tasks (auto-pulled from Companion) · Average Turnaround Time (TAT) · SLA compliance · Instructions received vs completed · System adoption score · Workload balancing across staff · Drill-down into individual staff history.

### 3. Task Assignment Centre
Managers/administrators assign tasks to one or multiple staff. Tasks flow directly into each user's Companion. Supports templates, recurring tasks, deadlines, priorities, attachments, reminders and delegation.

### 4. Companion Workflow
System events from Property, Facility, Help Desk, Procurement, Valuation, Visitor Management and Calendar automatically create Companion actions. Staff acknowledge, complete or delegate work. SLA breaches auto-escalate to the Performance Dashboard.

### 5. Escalation Logic
Companion → Reminder → SLA Warning → SLA Breach → Performance Dashboard → Administrator Intervention → Resolution.

### 6. UI screens
1. Updated Workspace (with My Companion and Performance Dashboard navigation).
2. My Companion screen.
3. Performance Dashboard.
4. Task Assignment Centre.

### 7. Acceptance Criteria
- Companion opens by default after login.
- All scheduled ERP events appear automatically in Companion.
- Users can delegate tasks.
- Administrators can monitor adoption and productivity.
- Overdue work escalates automatically.
- Performance analytics support date-range filtering.
- Full audit trail maintained.