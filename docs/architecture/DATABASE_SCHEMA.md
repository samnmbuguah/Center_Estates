# Center Estates ERP — Database Schema

Multi-tenant Django ORM schema. Every organization-scoped model uses an `organization` ForeignKey to `organizations.Organization`. Construction module models use client-generated UUIDs and BIGINT epoch-milliseconds for WatermelonDB sync compatibility.

## Core (`core`)

| Model | Key Fields | Notes |
|---|---|---|
| `Module` | (TextChoices enum) | property, facility, sales, tender, valuation, monitoring, companion |

## Organizations (`organizations`)

| Model | Key Fields | Relationships |
|---|---|---|
| `Organization` | name, slug, is_active, domain, settings | — |
| `Permission` | key, label, module, description | — |
| `Role` | organization FK, name, slug, is_system | M2M → Permission |
| `Membership` | organization FK, user FK, status, is_organization_admin, is_default | M2M → Role (through MembershipRole) |
| `MembershipRole` | membership FK, role FK | Through table |

## Subscriptions (`subscriptions`)

| Model | Key Fields | Relationships |
|---|---|---|
| `Subscription` | organization FK, module, is_active, status, starts_at, ends_at, limits, settings | organization |

## Properties (`properties`)

| Model | Key Fields | Relationships |
|---|---|---|
| `Property` | organization FK, code, name, property_type, status, city, address, lat/lng | — |
| `Building` | organization FK, property FK, code, name, floors | property |
| `Unit` | organization FK, property FK, building FK, code, floor, unit_type, status, area | property, building |
| `Project` | organization FK, code, name, property FK, status, starts_on, ends_on | property |
| `Tenant` | organization FK, code, name, tenant_type, email, phone, tax_id, status | — |
| `TenantPortalAccess` | organization FK, user FK, tenant FK, is_active | tenant |
| `Lease` | organization FK, reference, unit FK, tenant FK, starts_on, ends_on, monthly_rent, deposit, escalation_percent, billing_day, status, renewed_from FK | unit, tenant |
| `Invoice` | organization FK, number, lease FK, invoice_type, issued_on, due_on, amount, balance, status | lease |
| `Receipt` | organization FK, number, tenant FK, invoice FK, received_on, amount, payment_method | tenant, invoice |
| `InvoiceReminder` | organization FK, invoice FK, channel, recipient, message, sent_at | invoice |
| `BankTransaction` | organization FK, reference, transacted_on, amount, status, receipt FK | receipt |
| `CreditNote` | organization FK, number, invoice FK, issued_on, amount, reason, status | invoice |
| `Expense` | organization FK, property FK, invoice_number, supplier, category, amount, status | property |
| `Budget` | organization FK, property FK, year, category, amount, status | property |
| `ServiceCharge` | organization FK, property FK, name, method, annual_budget, starts_on, is_active | property |
| `ServiceChargeAllocation` | organization FK, service_charge FK, unit FK, ratio, annual_amount, monthly_amount | service_charge, unit |
| `ServiceChargeReconciliation` | organization FK, service_charge FK, period_start, period_end, budgeted_amount, actual_amount, variance, status | service_charge |
| `RentSchedule` | organization FK, lease FK, invoice FK, period_start, period_end, due_on, base_rent, total, status | lease, invoice |
| `TenantDocument` | organization FK, tenant FK, document_type, document_number, file_url, expires_on, status | tenant |

## Facilities (`facilities`)

| Model | Key Fields | Relationships |
|---|---|---|
| `FacilityAsset` | organization FK, code, name, category, property FK, building FK, manufacturer, condition | property, building |
| `Contractor` | organization FK, code, name, specialty, status, rating | — |
| `WorkOrder` | organization FK, number, title, category, property FK, asset FK, contractor FK, assigned_to, priority, status, labor_cost, parts_cost | property, asset, contractor |
| `WorkOrderEvent` | organization FK, work_order FK, event_type, from_status, to_status, notes, actor | work_order |
| `WorkOrderCostItem` | organization FK, work_order FK, kind, description, quantity, unit_cost, total | work_order |
| `WorkOrderAttachment` | organization FK, work_order FK, file_name, file_url, media_type, caption | work_order |
| `Inspection` | organization FK, reference, title, inspection_type, property FK, inspector, scheduled_on, status, score | property |
| `ServiceRequest` | organization FK, reference, subject, category, property FK, unit FK, tenant FK, status, work_order FK | property, unit, tenant, work_order |
| `PreventiveSchedule` | organization FK, code, name, asset FK, frequency, last_completed_on, next_due_on | asset |
| `UtilityMeter` | organization FK, code, name, property FK, utility_type, tariff | property |
| `MeterReading` | organization FK, meter FK, read_at, value, consumption, cost, is_anomaly | meter |

## Sales (`sales`)

| Model | Key Fields | Relationships |
|---|---|---|
| `SaleListing` | organization FK, unit FK, project FK, list_price, minimum_deposit_percent, status, construction_progress | unit, project |
| `Buyer` | organization FK, reference, full_name, email, phone, id_number, financing_type, status, assigned_agent | — |
| `PropertySale` | organization FK, reference, buyer FK, listing FK, agent FK, agreed_price, reservation_fee, status | buyer, listing |
| `Installment` | organization FK, sale FK, sequence, description, due_on, amount, paid_amount, status, milestone | sale |
| `SalePayment` | organization FK, reference, sale FK, installment FK, paid_on, amount, method, status | sale, installment |
| `SiteVisit` | organization FK, reference, visitor_name, project FK, visited_at, follow_up_on | project |
| `AgentCommission` | organization FK, reference, sale FK, agent FK, rate_percent, amount, status | sale |
| `SaleDocument` | organization FK, sale FK, document_type, title, checksum, is_final | sale |
| `SalesAuditEvent` | organization FK, payment FK, sale FK, event_type, from_status, to_status, details, actor | payment, sale |

## Tenders (`tenders`)

| Model | Key Fields | Relationships |
|---|---|---|
| `Tender` | organization FK, reference, title, client, stage, submission_deadline, estimated_value, readiness_score, owner | — |
| `TenderRequirement` | organization FK, tender FK, category, text, mandatory, status, confidence | tender |
| `BidDecision` | organization FK, tender FK, eligibility_score, risk_score, recommendation, decision | tender |
| `TenderTask` | organization FK, tender FK, title, stage, owner, starts_on, due_on, status, progress, dependency FK | tender |
| `CompanyDocument` | organization FK, name, document_type, version, expires_on, status, checksum | — |
| `ProposalSection` | organization FK, tender FK, title, section_type, sequence, owner, content, status | tender |
| `FinancialItem` | organization FK, tender FK, code, description, quantity, unit_rate, amount | tender |
| `TenderReview` | organization FK, tender FK, reviewer FK, gate, status, comments | tender |
| `TenderSubmission` | organization FK, tender FK, channel, submitted_at, package_checksum, receipt_reference | tender |
| `TenderOutcome` | organization FK, tender FK, result, notified_on, winner, feedback | tender |
| `TenderAuditEvent` | organization FK, tender FK, event_type, from_stage, to_stage, details, actor | tender |

## Valuations (`valuations`)

| Model | Key Fields | Relationships |
|---|---|---|
| `ValuationClient` | organization FK, code, name, client_type, contact_name, payment_terms_days | — |
| `ValuationInstruction` | organization FK, reference, client FK, property FK, valuation_type, purpose, valuer, status | client, property |
| `ValuationInspection` | organization FK, reference, instruction FK, inspector FK, scheduled_at, status, checklist, findings | instruction |
| `ComparableEvidence` | organization FK, instruction FK, reference, address, transaction_price, area, rate_per_area | instruction |
| `DraftValuationReport` | organization FK, instruction FK, version, template, assessed_value, market_value, status | instruction |
| `FinalValuationReport` | organization FK, instruction FK, draft FK, report_number, issued_on, market_value | instruction, draft |
| `ValuationInvoice` | organization FK, number, instruction FK, subtotal, tax, total, balance, status | instruction |
| `ValuationPayment` | organization FK, reference, invoice FK, paid_on, amount, method | invoice |
| `ValuationAuditEvent` | organization FK, instruction FK, event_type, from_status, to_status, details, actor | instruction |

## Construction (`construction`)

All construction models use `CharField` PKs (client-generated UUIDs) and BIGINT epoch-millisecond timestamps for WatermelonDB sync.

| Model | Key Fields | Relationships |
|---|---|---|
| `Project` | id, organization FK, portfolio_project FK, name, code, stage, project_type, budget, tender_amount, geofence fields | portfolio_project |
| `ProjectDocument` | project FK, doc_type, title, discipline | project |
| `DocumentVersion` | document FK, version, remote_url, file_format, uploaded_by | document |
| `ProjectApproval` | project FK, approval_type, authority, reference, status, issue_date | project |
| `LifecycleRecord` | project FK, stage, record_type, title, status, responsible_party, due_date | project |
| `Device` | id, organization FK, user FK, public_key, algorithm, enrolled_at, revoked | user |
| `ProgressPlan` | project_id, week, planned_percent | — (reference data) |
| `MilestoneEntry` | id, organization FK, project_id, milestone_id, percent_complete, submitted_at, payment_value | — (sync model) |
| `EvidenceFile` | id, milestone_entry FK, media_type, remote_url, hash, lat/lng, geofence_status | milestone_entry |
| `Observation` | id, milestone_entry FK, body, flag, origin | milestone_entry |
| `OfficeNote` | id, milestone_entry FK, body, author | milestone_entry |
| `SubmissionRecord` | milestone_entry FK, integrity_hash, evidence_count, sealed_at, signature | milestone_entry |
| `MilestoneVerification` | milestone_entry FK, verifier FK, decision, note, verified_at | milestone_entry |
| `DailyLog` | organization FK, project_id, log_date, weather, labour_count, notes, details, author FK | — (sync model) |
| `MaterialDelivery` | organization FK, project_id, delivery_date, material, quantity, supplier, boq_item FK, received_by FK | boq_item |
| `SafetyIncident` | organization FK, project_id, incident_date, severity, description, reported_by FK | — |
| `Risk` | project_id, organization FK, reference, description, category, owner FK, likelihood, impact, status | — |
| `Ticket` | organization FK, project_id, title, priority, status, risk_level, raised_by FK, assigned_to FK, plan_document FK | project_document |
| `TicketComment` | ticket FK, author FK, body, attachment_url | ticket |
| `RequirementWaiver` | project FK, requirement_key, reason, waived_by FK | project |
| `ProjectModule` | project FK, module_key, settings | project |
| `IgpSafeguard` | project FK, risk_classification, eia_status | project |
| `IgpProcurement` | project FK, procurement_method | project |
| `QualityTest` | project FK, test_type, sample_id, result_value, passed, tested_by FK | project |
| `ConsultantPayment` | project FK, consultant_name, consultant_role, certificate_number, amount, status | project |
| `DroneDataset` | project FK, data_type, flight_date, external_url, review_status, storage_tier | project |
| `DroneDatasetReview` | dataset FK, reviewer FK, annotation, annotation_type | dataset |
| `SatelliteDataset` | project FK, sat_type, capture_date, resolution_cm, external_url | project |
| `WorkPlanTask` | project FK, task_id, task_name, wbs_level, start_date, end_date, percent_complete, approval_status | project |
| `BoQItem` | project FK, section, item_number, description, unit, quantity, rate, amount, cost_state, executed_quantity | project |
| `ProjectMembership` | user FK, project FK, role FK, label | project |
| `RecordSequence` | organization FK, project FK, record_type, prefix, next_value | project |
| `Variation` | project FK, variation_number, description, variation_type, amount, status | project |
| `ProvisionalSum` | project FK, item_number, description, budgeted_amount, status | project |
| `ContingencyDrawdown` | project FK, drawdown_number, reason, category, amount, status | project |
| `AdvancePayment` | project FK, contractor_name, amount, recovery_rate, recovered_amount, status | project |
| `AdvanceRecovery` | advance_payment FK, certificate_number, amount_recovered | advance_payment |
| `Subcontractor` | project FK, name, contact_person, email | project |
| `WorkOrder` | project FK, order_number, subcontractor FK, boq_section, total_value, status | project, subcontractor |
| `BimModel` | id, project FK, name, discipline, file_format, version, processing_status, element_count | project |
| `BimBoqLink` | id, project FK, bim_model FK, ifc_guid, boq_item FK | bim_model, boq_item |
| `BimMilestoneMapping` | id, project FK, bim_model FK, milestone_entry FK, element_ids, color | bim_model, milestone_entry |
| `BimDiscrepancy` | id, project FK, bim_model FK, milestone_entry FK, description, severity, status | bim_model, milestone_entry |
| `CalendarEvent` | id, project FK, title, event_type, status, start, end | project |
| `ChatMessage` | id, project FK, sender FK, recipient FK, channel, body | project |
| `TourProgress` | user FK, role, completed | — |
| `Rfi` | id, project FK, number, title, question, status, priority, raised_by FK, assigned_to FK, response | project |
| `Requisition` | organization FK, project_id, title, amount, status, raised_by FK, reviewed_by FK, approved_by FK | — |
| `Certificate` | organization FK, project_id, number, cert_type, amount, retention_percent, status | — |
| `Disbursement` | organization FK, project_id, certificate FK, amount, status, managed_by FK | certificate |
| `DrawdownRequest` | organization FK, project_id, request_number, amount, status, requested_by FK, reviewed_by FK | — |
| `Notification` (construction) | id, organization FK, recipient FK, title, body, type, link, read_at | — |
| `AdminAuditLog` | id, organization FK, timestamp, user FK, action, category, resource, details, outcome | — |
| `DroneAuditLog` | dataset FK, user FK, action, details | dataset |
| `StoreItem` | organization FK, code, name, unit, category, quantity_on_hand | — |
| `StoreSupplier` | organization FK, name, contact | — |
| `MaterialRequisition` | organization FK, project FK, reference, status, raised_by FK | project |
| `MaterialRequisitionLine` | requisition FK, item FK, quantity | requisition, item |
| `PurchaseOrder` | organization FK, project FK, supplier FK, number, status, created_by FK | project, supplier |
| `PurchaseOrderLine` | purchase_order FK, item FK, quantity, unit_price | purchase_order, item |
| `StockMovement` | organization FK, project FK, item FK, movement_type, quantity, reference | project, item |

## Companion (`companion`)

| Model | Key Fields | Relationships |
|---|---|---|
| `Task` | organization FK, reference, title, source_module, source_ref, assignee FK, assigned_by FK, priority, status, due_at, sla_due_at, escalated | — |
| `TaskTemplate` | organization FK, name, title_template, default_priority, sla_hours, source_module | — |
| `TaskEvent` | organization FK, task FK, actor FK, action, note, created_at | task |

## Notifications (`notifications`)

| Model | Key Fields | Relationships |
|---|---|---|
| `Notification` | organization FK, recipient FK, title, message, level, action_url, read_at, metadata | — |

## Documents (`documents`)

| Model | Key Fields | Relationships |
|---|---|---|
| `Document` | organization FK, title, category, file, original_filename, mime_type, checksum_sha256, version, status, expires_on, uploaded_by FK, content_type FK, object_id | GenericForeignKey → any model |

## Audit (`audit`)

| Model | Key Fields | Relationships |
|---|---|---|
| `AuditEvent` | id (UUID), organization FK, actor FK, action, entity_type, entity_id, changes, context, created_at | Immutable; no update/delete |

## Key relationships summary

```
Organization ─┬─ Membership ──── MembershipRole ──── Role ──── Permission
              ├─ Subscription (per Module)
              ├─ Property ─┬─ Building ──── Unit
              │             ├─ Project (portfolio) ──── Construction.Project
              │             └─ FacilityAsset
              ├─ Tenant ─┬─ Lease ──── Invoice ──── Receipt
              │           └─ TenantPortalAccess
              └─ ... (all module models)

Construction.Project ─┬─ MilestoneEntry ─┬─ EvidenceFile
                      │                  ├─ Observation
                      │                  ├─ SubmissionRecord
                      │                  └─ MilestoneVerification
                      ├─ ProjectDocument ──── DocumentVersion
                      ├─ Risk, Ticket, DailyLog, QualityTest
                      ├─ BoQItem, WorkPlanTask, Variation
                      ├─ WorkOrder (construction) ──── Subcontractor
                      ├─ Certificate ──── Disbursement
                      └─ BimModel ─┬─ BimBoqLink ──── BoQItem
                                   ├─ BimMilestoneMapping
                                   └─ BimDiscrepancy
```
