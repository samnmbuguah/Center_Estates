# Sales Management development plan

1. Define roles, assignment scopes and immutable project/unit baseline rules.
2. Reuse shared projects/properties/units; add sale pricing and milestone mappings.
3. Implement buyer onboarding, secure confirmation, duplicate checks and legal documents.
4. Implement reservation/sale state machines and cancellation controls.
5. Implement installments, online payment integration, manual proof verification, reconciliation and receipts.
6. Implement visits, QR capture, interests, presentation content and agent attribution.
7. Implement commissions with verified-payment and milestone gates.
8. Add agent appraisal, role dashboards, marketing outputs, audit/compliance reports and offline clerk queue.
9. Test duplicate payments, partial approval, authorization boundaries and end-to-end buyer journeys.

Implemented workflow evidence:

- Buyer status changes, reservation/sale transitions and expired-reservation release use explicit state-machine actions.
- Payment proof is tenant-scoped, duplicate protected, linked only to the selected sale's installment, verified/rejected/reversed atomically and permanently retained.
- Installment allocations and commission eligibility are server-calculated; both verified-payment and construction-progress gates must pass before controlled approval and payout.
- Legal sale documents are checksum-versioned and append-only, and every financial/workflow decision records a Sales audit event.

## UI alignment from Sales-Module-UIs.pdf (`docs/spec/pages/page-XX.png`)

The approved mockups confirm the existing workspace screens (dashboard, projects & units, buyer profile, site visits, payment plan, payment verification). Two mockup screens are not yet implemented and should be added:

1. **Unit Handover & Occupancy** (`page-19`): handover register with inspection-ready units, occupancy handover actions, handover report export. Add a `handovers` endpoint + a `handovers` tab in the sales workspace (available/reserved → handed-over unit flow).
2. **Payments & Reconciliation — Bank Reconciliation** (`page-15`): bank-statement matching for collected sale payments (match/unmatch, reconcile). Add `bank-transactions` endpoint + reconciliation view.

Both require backend endpoints first; the existing `verify/` payment workflow already feeds reconciliation-ready records.
