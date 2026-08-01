# Tender Management development plan

1. Implement tender register, stages, deadlines, source import and document ingestion.
2. Build auditable AI extraction with citations, confidence, prompt/model version and mandatory human confirmation.
3. Implement bid/no-bid scoring, conflict-safe approvals and board decision record.
4. Implement work breakdown, dependencies, Gantt, reminders and workload view.
5. Build shared company-document vault, expiry alerts, versions and reusable eligibility packs.
6. Build technical editor with templates, comments, section ownership, AI drafting and change history.
7. Build access-restricted BOQ/pricing workspace with formula validation and approval.
8. Build readiness checks, review gates, packaging manifest and deterministic PDF/document bundle.
9. Capture submissions, acknowledgements, amendments, outcome and lessons learned.
10. Add dashboards, notifications, exports, permission/security tests and complete workflow tests.

## Implemented control evidence

- AI-extracted requirements preserve confidence, citation and model evidence and require an explicit, audited human confirmation action.
- Bid decisions, task progress, proposal review, BOQ approval and final review gates use server-enforced transitions with organization-scoped audit events.
- BOQ totals are calculated server-side; approved pricing, approved proposal sections, company-vault evidence and submission receipts cannot be overwritten.
- Packaging is blocked until proposal, pricing and review gates pass; submission and outcome records advance the tender atomically.
- Dashboard analytics and five downloadable CSV registers cover the live tenant-scoped pipeline, compliance, workload, pricing and outcomes.
