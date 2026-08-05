# Changelog

All notable changes to Center Estates ERP are documented here.

## Unreleased

### Added

- **Companion & Staff Performance module** — Cross-module task management with templates, SLA tracking, escalation, delegation, and audit events. Role-based dashboards for assignees and managers.
- **Construction Management role dashboards** — Dedicated views for Project Administrator, Clerk of Works, Quantity Surveyor, Certifier, Finance Officer, and Auditor roles.
- **Multi-step wizards** — Guided onboarding wizards for Property creation (property → building → units) and Sales pipeline (listing → buyer → sale → payment).
- **Facility Work Order Detail view** — Full detail page for work orders with cost items, attachments, timeline events, and status transitions.
- **Design system** — Badge/pill component CSS, modal overlay styles, and consistent status indicators across all modules.
- **Spec extraction** — Extracted and documented API specs for all modules (properties, facilities, sales, tenders, valuations, construction, companion).

### Changed

- Construction monitoring models expanded with BIM integration (BimModel, BimBoqLink, BimDiscrepancy), calendar events, chat messages, RFI tracking, advance payments, provisional sums, and contingency drawdowns.
- Seed data enriched with cross-module demo fixtures (construction, companion, valuations, tenders) for acceptance testing.

### Fixed

- Enrollment module: fixed enrollment flow, email template, and admin registration for first-time users.

## 0.1.0 — Initial Platform

- Multi-tenant architecture with organization-scoped data isolation.
- Property Management module (properties, buildings, units, tenants, leases, invoicing, receipts, budgets, service charges).
- Facility Management module (assets, work orders, inspections, preventive schedules, service requests, utility meters).
- Sales Management module (listings, buyers, sales, payments, installments, commissions, site visits).
- Tender Management module (pipeline, requirements, bid decisions, proposal sections, financial items, submissions, outcomes).
- Valuation Management module (clients, instructions, inspections, comparables, draft/final reports, invoices, payments).
- Construction Monitoring module (projects, milestones, evidence, observations, daily logs, BoQ, risks, tickets, work orders, quality tests, drone/satellite datasets).
- Companion & Staff Performance module (tasks, templates, events, escalation).
- Subscription-based module access control.
- Audit event logging (immutability enforced).
- Document management with versioning and generic foreign keys.
- Notification system with level-based alerts.
