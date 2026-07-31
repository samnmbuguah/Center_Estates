# Facility Management

Controls the operational lifecycle of buildings, assets, maintenance, inspections, requests, contractors and utilities. The original source is [specification.pdf](specification.pdf); labeled references are indexed in [UI_REFERENCE.md](docs/UI_REFERENCE.md).

## Functional scope

- Portfolio dashboard with work-order, asset, service, cost, energy and SLA KPIs.
- Building/location register, map, status, occupancy and drill-down hierarchy.
- Asset register with category, location, condition, warranty, QR/barcode and lifecycle costs.
- Corrective work orders with priority, SLA, assignee, schedule, labour, parts, costs, media and approval history.
- Preventive maintenance calendar, recurring schedules, compliance state and completion trends.
- Inspection templates, assignments, findings, scores, violations and follow-up work orders.
- Tenant/occupant service requests, categorization, assignment, communication, SLA and satisfaction.
- Electricity/water consumption, meters, anomalies, costs and period comparison.
- Contractor register, compliance documents, ratings, work history and performance.
- Operational and BI reports with filters, exports and scheduled delivery.

## Integration points

Properties/buildings/units come from Property Management. Tenant requests may reference leases. Work and supplier costs feed shared finance/reporting. Documents use the shared vault, and every status/approval change is audited.

