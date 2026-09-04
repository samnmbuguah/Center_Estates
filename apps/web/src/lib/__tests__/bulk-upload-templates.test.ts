import { parseCsv, normalizeCsvHeader, csvCell, csvColumn } from "../csv";
import { normalizeDateString } from "@/components/bulk-tenant-uploader";

describe("Bulk Upload Templates & Parsers Contract Tests", () => {
  describe("Tenant Bulk Upload Template & Parser (Mirrored from Tenant Application Card)", () => {
    const TEMPLATE_HEADERS = [
      "unit_code",
      "name",
      "tenant_type",
      "address_1",
      "address_2",
      "city",
      "phone",
      "email",
      "tax_id",
      "registration_number",
      "contact_name",
      "contact_phone",
      "contact_email",
      "rent_type",
      "monthly_rent",
      "rent_rate_per_sqft",
      "lease_term_months",
      "lease_start",
      "service_charge_rate_per_sqft",
      "vat_rate",
      "billing_day",
      "escalation_percent",
      "escalation_interval_months",
      "parking_bay",
      "parking_monthly_fee",
      "opening_balance_amount",
    ];

    const SAMPLE_ROWS = [
      [
        "A-101", "Grace Mwangi", "individual", "P.O. Box 45123", "Ngong Road", "Nairobi",
        "+254722123456", "grace.mwangi@example.com", "A001234567Z", "28456789",
        "Grace Mwangi", "+254722123456", "grace.mwangi@example.com",
        "fixed", "25000", "", "12", "2026-09-01", "0", "0", "1", "0", "12", "P-101", "2500", "0",
      ],
      [
        "A-102", "Brian Kiprono", "individual", "P.O. Box 12890", "Kilimani", "Nairobi",
        "+254733987654", "brian.kiprono@example.com", "A009876543W", "31234567",
        "Brian Kiprono", "+254733987654", "brian.kiprono@example.com",
        "fixed", "35000", "", "12", "01/09/2026", "0", "0", "1", "0", "12", "P-102", "2500", "0",
      ],
      [
        "B-201", "Faith Njeri Ndungu", "individual", "P.O. Box 78100", "Kileleshwa", "Nairobi",
        "+254711555888", "faith.njeri@example.com", "A005556667K", "29876543",
        "Faith Njeri Ndungu", "+254711555888", "faith.njeri@example.com",
        "fixed", "50000", "", "12", "2026-09-01", "0", "0", "1", "5", "12", "P-201", "3000", "0",
      ],
      [
        "B-202", "Kevin Otieno & Linda Achieng", "individual", "P.O. Box 34500", "Valley Arcade", "Nairobi",
        "+254700112233", "otieno.family@example.com", "A007778889P", "27654321",
        "Kevin Otieno", "+254700112233", "otieno.family@example.com",
        "fixed", "65000", "", "24", "01/09/2026", "0", "0", "1", "5", "12", "P-202", "3000", "0",
      ],
      [
        "G-01", "Savannah Retail Enterprises Ltd", "company", "P.O. Box 90210", "Ground Floor Suite G-01", "Nairobi",
        "+254722000111", "accounts@savannahretail.co.ke", "P051234567X", "CPR/2022/12345",
        "James Mwangi", "+254722000112", "jmwangi@savannahretail.co.ke",
        "rate_per_sqft", "85000", "100", "24", "2026-09-01", "35", "16", "1", "7.5", "12", "P-COMM-01", "5000", "0",
      ],
    ];

    it("verifies unit_code is the very first column in the template", () => {
      expect(TEMPLATE_HEADERS[0]).toBe("unit_code");
      SAMPLE_ROWS.forEach((row) => {
        expect(row[0]).toMatch(/^[A-B]-\d{3}$|^G-01$/); // unit number is index 0
      });
    });

    it("generates valid CSV that parses with 100% row fidelity", () => {
      const csvContent = [TEMPLATE_HEADERS, ...SAMPLE_ROWS]
        .map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","))
        .join("\r\n");

      const parsed = parseCsv(csvContent);
      expect(parsed.length).toBe(6); // 1 header + 5 rows
      expect(parsed[0]).toEqual(TEMPLATE_HEADERS);
      expect(parsed[0][0]).toBe("unit_code");
    });

    it("ensures residential tenants have 0% VAT and individual type", () => {
      const residentialRows = SAMPLE_ROWS.slice(0, 4);
      residentialRows.forEach((row) => {
        expect(row[0]).toMatch(/^[A-B]-\d{3}$/); // unit_code is column 0
        expect(row[2]).toBe("individual"); // tenant_type is column 2
        expect(row[19]).toBe("0"); // vat_rate is column 19 (0% VAT exempt)
        expect(Number(row[14])).toBeGreaterThan(0); // monthly_rent is column 14
      });
    });

    it("ensures commercial tenant has CPR registration and 16% standard VAT", () => {
      const commercialRow = SAMPLE_ROWS[4];
      expect(commercialRow[0]).toBe("G-01"); // unit_code
      expect(commercialRow[2]).toBe("company"); // tenant_type
      expect(commercialRow[9]).toContain("CPR"); // registration_number
      expect(commercialRow[19]).toBe("16"); // vat_rate (16% VAT)
    });

    it("supports fuzzy header mappings (id_number, national_id, pin_number, rent_amount)", () => {
      const customCsv = `full_name,national_id,kra_pin,door_number,start_date,rent_amount
John Doe,12345678,A001122334K,A-101,01/09/2026,25000`;
      const all = parseCsv(customCsv);
      const h = all[0].map(normalizeCsvHeader);

      const cName = csvColumn(h, ["name", "tenant_name", "company_name", "full_name", "tenant"]);
      const cReg = csvColumn(h, ["registration_number", "reg_no", "registration", "id_number", "national_id"]);
      const cTax = csvColumn(h, ["tax_id", "kra_pin", "pin", "pin_number"]);
      const cUnit = csvColumn(h, ["unit_code", "unit", "unit_no", "door_number"]);
      const cStart = csvColumn(h, ["lease_start", "start_date", "starts_on"]);
      const cRent = csvColumn(h, ["monthly_rent", "rent", "rent_amount"]);

      expect(csvCell(all[1], cName)).toBe("John Doe");
      expect(csvCell(all[1], cReg)).toBe("12345678");
      expect(csvCell(all[1], cTax)).toBe("A001122334K");
      expect(csvCell(all[1], cUnit)).toBe("A-101");
      expect(normalizeDateString(csvCell(all[1], cStart))).toBe("2026-09-01");
      expect(csvCell(all[1], cRent)).toBe("25000");
    });
  });

  describe("Date Normalization Tests", () => {
    it("normalizes both ISO YYYY-MM-DD and DD/MM/YYYY dates accurately", () => {
      expect(normalizeDateString("2026-09-01")).toBe("2026-09-01");
      expect(normalizeDateString("01/09/2026")).toBe("2026-09-01");
      expect(normalizeDateString("15-08-2026")).toBe("2026-08-15");
      expect(normalizeDateString("31/12/2026")).toBe("2026-12-31");
    });

    it("handles Excel integer serial date numbers", () => {
      // 45536 is approximately Sept 1, 2024
      const res = normalizeDateString("45536");
      expect(res).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe("Facility Assets & Contractors Template Tests", () => {
    const CONTRACTOR_SAMPLE = `name,code,specialty,contact_name,email,phone,emergency_phone,pin_number,registration_number,coverage_areas,rating,status
Schindler Lifts Kenya Ltd,VND-ELEV-01,Vertical Transportation & Lifts,Francis Mwangi,service.ke@schindler.com,+254722100200,+254700999111,P051234567X,REG-SCH-2018,Nairobi & Mombasa,4.8,active`;

    const ASSET_SAMPLE = `name,code,category,asset_class,criticality,condition,manufacturer,model_number,serial_number,purchase_value,replacement_cost,expected_useful_life_years,funding_source,maintenance_procedure
Main Passenger Lift #1,LIFT-01,Vertical Transportation,Mechanical & Electrical,critical,good,Schindler,3300 AP,SCH-99412,8500000,9500000,15,Reserve Float,Monthly lubrication and brake audit`;

    it("parses contractor template with all mandatory compliance fields", () => {
      const rows = parseCsv(CONTRACTOR_SAMPLE);
      expect(rows.length).toBe(2);
      expect(rows[1][0]).toBe("Schindler Lifts Kenya Ltd");
      expect(rows[1][7]).toBe("P051234567X"); // Valid KRA PIN format
      expect(rows[1][11]).toBe("active");
    });

    it("parses asset template with cost and engineering parameters", () => {
      const rows = parseCsv(ASSET_SAMPLE);
      expect(rows.length).toBe(2);
      expect(rows[1][0]).toBe("Main Passenger Lift #1");
      expect(Number(rows[1][9])).toBe(8500000); // purchase_value numeric
      expect(rows[1][4]).toBe("critical"); // criticality enum
    });
  });

  describe("Owners / Landlord Template Tests", () => {
    const OWNER_HEADERS = [
      "unit_numbers", "name", "email", "phone", "pin_number", "id_or_registration_number",
      "settlement_bank_name", "settlement_bank_account", "settlement_bank_branch",
      "settlement_paybill_or_till", "engaged_for_unit_management", "engaged_for_letting", "is_management_company"
    ];

    it("supports semicolon-separated multi-unit ownership", () => {
      const sampleRow = ["B-201;B-202", "Eng. Mary Wambui Gitau", "mary.gitau@example.com", "+254733222333", "A009876543Y", "23456789", "", "", "", "247247", "yes", "no", "no"];
      const csvContent = [OWNER_HEADERS, sampleRow]
        .map((r) => r.map((v) => `"${v}"`).join(","))
        .join("\r\n");

      const parsed = parseCsv(csvContent);
      expect(parsed[1][0].split(";")).toEqual(["B-201", "B-202"]);
      expect(parsed[1][4]).toBe("A009876543Y"); // KRA PIN
      expect(parsed[1][9]).toBe("247247"); // Paybill
    });
  });
});
