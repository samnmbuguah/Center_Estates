/**
 * Demo Tour Definitions
 * -----------------------------------------------------------------------------
 * Each tour maps 1:1 to a Playwright E2E spec so the in-app guided demo and the
 * automated acceptance suite exercise the exact same user story.
 */
import { registerTour } from "./tourService";

registerTour({
  id: "create-work-order",
  label: "Create & Submit a Work Order",
  steps: [
    {
      testid: "module-nav-facility",
      title: "Facility Management",
      description:
        "Let's walk through the full user story of raising a maintenance work order — from intake through resolution. This is exactly what the automated tests validate.",
    },
    {
      testid: "facility-create-work-order-btn",
      title: "New Work Order",
      description:
        "Click '+ New Work Order' to open the intake form. The demo auto-fills realistic maintenance data so you can see the full flow.",
      actions: [{ type: "click", testid: "facility-create-work-order-btn" }],
    },
    {
      testid: "wo-title-input",
      title: "Describe the issue",
      description:
        "A clear title helps technicians triage. This field feeds the work order register and the resolution SLA timer.",
      actions: [{ type: "fill", testid: "wo-title-input", value: "Demo: Water leakage from basement ceiling" }],
    },
    {
      testid: "wo-priority-select",
      title: "Set priority",
      description:
        "Priority drives SLA response and resolution targets. 'High' triggers a 4-hour response window.",
      actions: [{ type: "select", testid: "wo-priority-select", value: "high" }],
    },
    {
      testid: "wo-submit-btn",
      title: "Submit the work order",
      description:
        "Submitting POSTs the work order to the facility API and creates the record. The automated test verifies the row appears in the register.",
      onNext: () => {
        const btn = document.querySelector<HTMLElement>('[data-testid="wo-submit-btn"]');
        btn?.click();
      },
    },
    {
      testid: "wo-register-search",
      title: "Verify in the register",
      description:
        "The new work order is now listed in the work orders register with an 'open' status — ready for a technician to be assigned.",
    },
  ],
});

registerTour({
  id: "record-rent-receipt",
  label: "Record a Rent Receipt",
  steps: [
    {
      testid: "module-nav-property",
      title: "Property Management",
      description:
        "This tour demonstrates recording a tenant rent payment end-to-end — the flow covered by the property E2E acceptance tests.",
    },
    {
      testid: "property-rent-tab",
      title: "Open Rent & Invoices",
      description:
        "Navigate to the rent collection view where invoices, receipts and arrears are managed.",
      actions: [{ type: "click", testid: "property-rent-tab" }],
    },
    {
      testid: "property-record-receipt-btn",
      title: "Record a receipt",
      description:
        "Open the receipt dialog. The demo selects an open invoice and allocates a payment.",
      actions: [{ type: "click", testid: "property-record-receipt-btn" }],
    },
    {
      testid: "receipt-amount-input",
      title: "Payment amount",
      description:
        "Enter the payment amount. The dialog validates it does not exceed the open invoice balance.",
      actions: [{ type: "fill", testid: "receipt-amount-input", value: "50000" }],
    },
    {
      testid: "receipt-save-btn",
      title: "Save the receipt",
      description:
        "Saving allocates the payment against the invoice and updates the tenant ledger. The E2E suite asserts the receipt appears in the register.",
      onNext: () => {
        const btn = document.querySelector<HTMLElement>('[data-testid="receipt-save-btn"]');
        btn?.click();
      },
    },
  ],
});

export {};
