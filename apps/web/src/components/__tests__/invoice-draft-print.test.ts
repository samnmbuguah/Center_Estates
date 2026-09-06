import { invoiceDraftHtml } from "@/components/billing/invoice-draft-print";

describe("invoiceDraftHtml", () => {
  const candidate = {
    id: "candidate-1",
    tenant_name: "Acacia Consulting Ltd",
    property_name: "Westlands Business Centre",
    unit_code: "101",
    lease_reference: "LS-2026-001",
    due_date: "2026-09-05",
    billing_items: [
      { code: "rent", description: "Monthly rent", total: "100000" },
      { code: "service_charge", description: "Service charge", total: "16000" },
    ],
    total: "116000",
    status: "ready",
    issue_summary: [],
  };

  it("creates a dedicated branded draft document instead of printing the workspace", () => {
    const html = invoiceDraftHtml(candidate, { name: "Legend Management", logoUrl: "/legend.png", primaryColor: "#d71920" });
    expect(html).toContain("DRAFT INVOICE");
    expect(html).toContain("Not yet issued");
    expect(html).toContain("Acacia Consulting Ltd");
    expect(html).toContain("Westlands Business Centre");
    expect(html).toContain("Monthly rent");
    expect(html).toContain("Print / Save PDF");
    expect(html).not.toContain("Billing workflow");
    expect(html).not.toContain("Candidate invoices");
  });

  it("escapes billing data before placing it in the print document", () => {
    const html = invoiceDraftHtml({ ...candidate, tenant_name: '<script>alert("x")</script>' }, { name: "CeEst" });
    expect(html).not.toContain('<script>alert("x")</script>');
    expect(html).toContain("&lt;script&gt;");
  });
});
