import { defaultManualInvoiceSubtotal } from "../usePropertyLogic";

describe("manual invoice amount defaults", () => {
  it("uses lease rent only for rent invoices", () => {
    expect(defaultManualInvoiceSubtotal("rent", 134120)).toBe("134120");
    expect(defaultManualInvoiceSubtotal("rent", 134120, 3)).toBe("402360");
  });

  it.each(["service_charge", "utility", "move_in", "other"])(
    "does not reuse rent for %s invoices",
    (invoiceType) => {
      expect(defaultManualInvoiceSubtotal(invoiceType, 134120)).toBe("");
    },
  );
});
