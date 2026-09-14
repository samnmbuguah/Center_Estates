import {
  cleanPhoneNumber,
  createWhatsAppUrl,
  buildSiteVisitMessage,
  buildPaymentReceiptMessage,
  buildInstallmentReminderMessage,
} from "../sales-communication";

describe("Sales Communication Utilities", () => {
  describe("cleanPhoneNumber", () => {
    it("converts 07... to 2547...", () => {
      expect(cleanPhoneNumber("0712345678")).toBe("254712345678");
    });

    it("converts 01... to 2541...", () => {
      expect(cleanPhoneNumber("0112345678")).toBe("254112345678");
    });

    it("handles +254...", () => {
      expect(cleanPhoneNumber("+254712345678")).toBe("254712345678");
    });

    it("leaves already normalized numbers intact", () => {
      expect(cleanPhoneNumber("254712345678")).toBe("254712345678");
    });

    it("handles empty or null gracefully", () => {
      expect(cleanPhoneNumber("")).toBe("");
      expect(cleanPhoneNumber(null)).toBe("");
      expect(cleanPhoneNumber(undefined)).toBe("");
    });
  });

  describe("createWhatsAppUrl", () => {
    it("generates wa.me link with phone and encoded message", () => {
      const url = createWhatsAppUrl("0712345678", "Hello World!");
      expect(url).toBe("https://wa.me/254712345678?text=Hello%20World!");
    });
  });

  describe("message builders", () => {
    it("builds site visit message", () => {
      const msg = buildSiteVisitMessage({
        visitor_name: "John Kamau",
        project_name: "Riverside Heights",
        agent_name: "Sarah",
        org_name: "Center Estates",
      });
      expect(msg).toContain("Hello John");
      expect(msg).toContain("Riverside Heights");
      expect(msg).toContain("Center Estates");
    });

    it("builds payment receipt message", () => {
      const msg = buildPaymentReceiptMessage({
        buyer_name: "Grace Wanjiku",
        amount: 250000,
        reference: "REC-2026-001",
        method: "M-Pesa",
        sale_reference: "SALE-RH-402",
        org_name: "Center Estates",
      });
      expect(msg).toContain("Grace");
      expect(msg).toContain("250,000");
      expect(msg).toContain("REC-2026-001");
      expect(msg).toContain("M-PESA");
    });

    it("builds installment reminder message", () => {
      const msg = buildInstallmentReminderMessage({
        buyer_name: "David Otieno",
        description: "Roof Slab Milestone",
        amount: 500000,
        paid_amount: 100000,
        due_on: "2026-10-15",
        sale_reference: "SALE-RH-402",
        org_name: "Center Estates",
      });
      expect(msg).toContain("David");
      expect(msg).toContain("Roof Slab Milestone");
      expect(msg).toContain("400,000");
    });
  });
});
