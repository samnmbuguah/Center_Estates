/**
 * Demo Tour Definitions
 * -----------------------------------------------------------------------------
 * Each tour maps 1:1 to a Playwright E2E spec so the in-app guided demo and the
 * automated acceptance suite exercise the exact same user story.
 */
import { registerTour } from "./tourService";

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const now = new Date();
const leaseStartIso = iso(now.getFullYear(), now.getMonth() + 1, now.getDate() + 1);
const leaseEndIso = iso(now.getFullYear() + 1, 1, 1);

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

registerTour({
  id: "onboard-tenant",
  label: "Onboard a Tenant",
  steps: [
    {
      testid: "module-nav-property",
      title: "Property Management",
      description:
        "This tour demonstrates onboarding a new tenant from the property workspace — the exact flow covered by the property E2E acceptance tests.",
    },
    {
      testid: "property-add-tenant-btn",
      title: "Add a Tenant",
      description:
        "Click '+ Add Tenant' to open the tenant profile dialog. The demo auto-fills the registration form with realistic data.",
      actions: [{ type: "click", testid: "property-add-tenant-btn" }],
    },
    {
      testid: "tenant-code-input",
      title: "Tenant code",
      description:
        "A short unique code links the tenant to leases, invoices and documents across the portfolio.",
      actions: [{ type: "fill", testid: "tenant-code-input", value: "TNT-007" }],
    },
    {
      testid: "tenant-name-input",
      title: "Tenant name",
      description:
        "The registered name appears on invoices, receipts and the tenant portal.",
      actions: [{ type: "fill", testid: "tenant-name-input", value: "Demo Tenant Ltd" }],
    },
    {
      testid: "tenant-type-select",
      title: "Tenant type",
      description:
        "Corporate tenants get company onboarding fields; individuals are verified against national ID.",
      actions: [{ type: "select", testid: "tenant-type-select", value: "company" }],
    },
    {
      testid: "tenant-email-input",
      title: "Contact email",
      description:
        "Invoices and payment reminders are delivered to this address.",
      actions: [{ type: "fill", testid: "tenant-email-input", value: "demo@tenant.example" }],
    },
    {
      testid: "tenant-phone-input",
      title: "Phone number",
      description:
        "SMS billing preferences and mobile payment notifications use this number.",
      actions: [{ type: "fill", testid: "tenant-phone-input", value: "+254 700 000 000" }],
      onNext: () => {
        const btn = document.querySelector<HTMLElement>('[data-testid="tenant-save-btn"]');
        btn?.click();
      },
    },
  ],
});

registerTour({
  id: "schedule-inspection",
  label: "Schedule an Inspection",
  steps: [
    {
      testid: "module-nav-facility",
      title: "Facility Management",
      description:
        "This tour demonstrates scheduling a statutory compliance inspection — the flow exercised by the facility E2E acceptance tests.",
    },
    {
      testid: "facility-create-inspection-btn",
      title: "New Inspection",
      description:
        "Click '+ New Inspection' to open the inspection intake form. The demo auto-fills the details for you.",
      actions: [{ type: "click", testid: "facility-create-inspection-btn" }],
    },
    {
      testid: "insp-title-input",
      title: "Inspection name",
      description:
        "A descriptive name helps inspectors triage and records compliance coverage.",
      actions: [{ type: "fill", testid: "insp-title-input", value: "Demo: Lift Safety Inspection" }],
    },
    {
      testid: "insp-type-select",
      title: "Inspection type",
      description:
        "Compliance inspections feed the statutory register and the maintenance SLA tracker.",
      actions: [{ type: "select", testid: "insp-type-select", value: "compliance" }],
      onNext: () => {
        const btn = document.querySelector<HTMLElement>('[data-testid="insp-submit-btn"]');
        btn?.click();
      },
    },
  ],
});

registerTour({
  id: "create-service-request",
  label: "Raise a Service Request",
  steps: [
    {
      testid: "module-nav-facility",
      title: "Facility Management",
      description:
        "This tour demonstrates raising a tenant service request from the facility workspace — the flow covered by the facility E2E acceptance tests.",
    },
    {
      testid: "facility-create-request-btn",
      title: "New Service Request",
      description:
        "Click '+ New Service Request' to open the request intake form. The demo auto-fills the details.",
      actions: [{ type: "click", testid: "facility-create-request-btn" }],
    },
    {
      testid: "sr-title-input",
      title: "Describe the issue",
      description:
        "A clear subject helps the facilities team triage and dispatch the right trade.",
      actions: [{ type: "fill", testid: "sr-title-input", value: "Demo: AC not cooling – Office 38" }],
    },
    {
      testid: "sr-priority-select",
      title: "Set priority",
      description:
        "Priority drives the SLA response window — 'High' triggers a 4-hour response.",
      actions: [{ type: "select", testid: "sr-priority-select", value: "high" }],
      onNext: () => {
        const btn = document.querySelector<HTMLElement>('[data-testid="sr-submit-btn"]');
        btn?.click();
      },
    },
  ],
});

registerTour({
  id: "add-property",
  label: "Add a Property",
  steps: [
    {
      testid: "module-nav-property",
      title: "Property Management",
      description:
        "This tour demonstrates adding a new property through the guided wizard — the flow covered by the property E2E acceptance tests.",
    },
    {
      testid: "property-add-prop-btn",
      title: "Add a Property",
      description:
        "Click '+ Add Property' to open the 3-step wizard. The demo auto-fills realistic portfolio data.",
      actions: [{ type: "click", testid: "property-add-prop-btn" }],
    },
    {
      testid: "prop-name-input",
      title: "Property name",
      description:
        "The property name appears across portfolio, occupancy and rent reporting.",
      actions: [{ type: "fill", testid: "prop-name-input", value: "Demo Tower" }],
    },
    {
      testid: "prop-code-input",
      title: "Property code",
      description:
        "A short unique code is used in unit and lease references.",
      actions: [{ type: "fill", testid: "prop-code-input", value: "DEMO-001" }],
    },
    {
      testid: "prop-type-select",
      title: "Property type",
      description:
        "The type drives the default unit mix and service charge templates.",
      actions: [{ type: "select", testid: "prop-type-select", value: "commercial" }],
    },
    {
      testid: "prop-city-input",
      title: "City",
      description:
        "Location is required to complete the wizard and feeds the portfolio location filters.",
      actions: [{ type: "fill", testid: "prop-city-input", value: "Nairobi" }],
    },
    {
      testid: "prop-wizard-next",
      title: "Review & create",
      description:
        "Continue through the wizard and create the property. The automated test verifies it appears in the register.",
      onNext: () => {
        const clickNext = () => document.querySelector<HTMLElement>('[data-testid="prop-wizard-next"]')?.click();
        const clickCreate = () => document.querySelector<HTMLElement>('[data-testid="prop-wizard-create"]')?.click();
        const done = () => {
          if (document.querySelector('[data-testid="prop-wizard-create"]')) clickCreate();
          else clickNext();
        };
        done();
        setTimeout(done, 60);
        setTimeout(() => {
          if (document.querySelector('[data-testid="prop-wizard-create"]')) clickCreate();
        }, 120);
      },
    },
  ],
});

registerTour({
  id: "create-lease",
  label: "Create a Lease",
  steps: [
    {
      testid: "module-nav-property",
      title: "Property Management",
      description:
        "This tour demonstrates creating a lease agreement for a tenant and unit — the flow covered by the property E2E acceptance tests.",
    },
    {
      testid: "property-add-lease-btn",
      title: "Add a Lease",
      description:
        "Click '+ Add Single Lease' to open the lease intake form. The demo auto-fills the agreement details.",
      actions: [{ type: "click", testid: "property-add-lease-btn" }],
    },
    {
      testid: "lease-ref-input",
      title: "Lease reference",
      description:
        "A unique reference links the agreement to invoices, rent schedules and the tenant ledger.",
      actions: [{ type: "fill", testid: "lease-ref-input", value: `LS-DEMO-${Date.now().toString().slice(-6)}` }],
    },
    {
      testid: "lease-tenant-select",
      title: "Select tenant",
      description:
        "Choose the tenant who holds this lease. The demo selects the first registered tenant.",
      onNext: () => {
        const sel = document.querySelector<HTMLSelectElement>('[data-testid="lease-tenant-select"]');
        if (sel && sel.options.length > 1) sel.value = sel.options[1].value;
        sel?.dispatchEvent(new Event("change", { bubbles: true }));
      },
    },
    {
      testid: "lease-unit-select",
      title: "Select unit",
      description:
        "Attach the lease to a unit. The demo selects the first lettable unit.",
      onNext: () => {
        const sel = document.querySelector<HTMLSelectElement>('[data-testid="lease-unit-select"]');
        if (sel && sel.options.length > 1) sel.value = sel.options[1].value;
        sel?.dispatchEvent(new Event("change", { bubbles: true }));
      },
    },
    {
      testid: "lease-start-input",
      title: "Start date",
      description:
        "The tenancy start date drives the first rent schedule and billing cycle.",
      actions: [{ type: "fill", testid: "lease-start-input", value: leaseStartIso }],
    },
    {
      testid: "lease-end-input",
      title: "End date",
      description:
        "The expiry date feeds the lease renewal and critical-date alerts.",
      actions: [{ type: "fill", testid: "lease-end-input", value: leaseEndIso }],
    },
    {
      testid: "lease-rent-input",
      title: "Monthly rent",
      description:
        "The contracted monthly rent is invoiced against this lease's rent schedule.",
      actions: [{ type: "fill", testid: "lease-rent-input", value: "75000" }],
      onNext: () => {
        const btn = document.querySelector<HTMLElement>('[data-testid="lease-save-btn"]');
        btn?.click();
      },
    },
  ],
});

registerTour({
  id: "assign-companion-task",
  label: "Assign a Companion Task",
  steps: [
    {
      testid: "module-nav-companion",
      title: "Companion Task Assignment",
      description:
        "This tour demonstrates assigning a task to a staff member — the flow covered by the companion E2E acceptance tests.",
    },
    {
      testid: "companion-assign-btn",
      title: "Assign a Task",
      description:
        "Click '+ Assign Task' to open the assignment form. The demo auto-fills a realistic task.",
      actions: [{ type: "click", testid: "companion-assign-btn" }],
    },
    {
      testid: "assign-title-input",
      title: "Task title",
      description:
        "A clear title helps the assignee triage and keeps the SLA tracker accurate.",
      actions: [{ type: "fill", testid: "assign-title-input", value: `Demo: Follow up rent arrears ${Date.now().toString().slice(-6)}` }],
    },
    {
      testid: "assign-priority-select",
      title: "Set priority",
      description:
        "Priority drives the SLA response window and workload scoring.",
      actions: [{ type: "select", testid: "assign-priority-select", value: "high" }],
      onNext: () => {
        const assignee = document.querySelector<HTMLElement>('[data-testid^="assign-assignee-"]');
        assignee?.click();
        setTimeout(() => {
          document.querySelector<HTMLElement>('[data-testid="assign-submit-btn"]')?.click();
        }, 120);
      },
    },
  ],
});

export {};
