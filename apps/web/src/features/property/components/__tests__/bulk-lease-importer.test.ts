import { parseCsv } from "@/lib/csv";
import { defaultColumnWarnings, describeEmptyParse, parseLeaseGrid, summarizePreviewErrors } from "../BulkLeaseImporter";

const TEMPLATE = "tenant_code,unit_code,starts_on,ends_on,monthly_rent,service_charge,billing_day,escalation_percent,escalation_interval_months";

describe("BulkLeaseImporter grid parsing", () => {
  it("parses template-format CSV into canonical rows", () => {
    const result = parseLeaseGrid(parseCsv(
      `${TEMPLATE}\r\nTNT-0001,A-101,2026-09-01,2027-08-31,25000,0,1,0,12\r\nTNT-0002,B-201,01/09/2026,31/08/2027,50000,0,1,0,12`,
    ));
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({ tenant_code: "TNT-0001", unit_code: "A-101", starts_on: "2026-09-01" });
    expect(result.rows[1]).toMatchObject({ tenant_code: "TNT-0002", starts_on: "2026-09-01", ends_on: "2027-08-31" });
    expect(result.missingRequired).toEqual([]);
    expect(result.droppedCount).toBe(0);
  });

  it("accepts the alias headings honoured by the bulk-import API", () => {
    const result = parseLeaseGrid(parseCsv(
      "Tenant,Unit,Commencement Date,Expiry Date,Rent\nTNT-0009,C-301,01/09/2026,31/08/2027,75000",
    ));
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      tenant_code: "TNT-0009", unit_code: "C-301",
      starts_on: "2026-09-01", ends_on: "2027-08-31", monthly_rent: "75000",
    });
    expect(result.missingRequired).toEqual([]);
  });

  it("explains unrecognised headings instead of a bare 'no rows' message", () => {
    const result = parseLeaseGrid(parseCsv("Name,House,Rent,Start\nSharon,K-101,45000,2026-09-01"));
    expect(result.rows).toHaveLength(0);
    const message = describeEmptyParse(result);
    expect(message).toContain("Headings found: Name, House, Rent, Start.");
    expect(message).toContain("Missing required headings: tenant_code, unit_code.");
    expect(message).toContain("1 data row was ignored");
  });

  it("points at a title row when headings are not on row 1", () => {
    const result = parseLeaseGrid(parseCsv(`Lease Schedule 2026\n${TEMPLATE}\nTNT-0001,A-101,2026-09-01,2027-08-31,25000,0,1,0,12`));
    expect(result.rows).toHaveLength(0);
    const message = describeEmptyParse(result);
    expect(message).toContain("Headings found: Lease Schedule 2026.");
    expect(message).toContain("Missing required headings: tenant_code, unit_code.");
  });

  it("keeps valid rows while reporting skipped rows", () => {
    const result = parseLeaseGrid(parseCsv(
      `${TEMPLATE}\nTNT-0001,A-101,2026-09-01,2027-08-31,25000,0,1,0,12\n,,,,45000,,,,\nTNT-0002,B-201,2026-09-01,2027-08-31,50000,0,1,0,12`,
    ));
    expect(result.rows).toHaveLength(2);
    expect(result.dataRowCount).toBe(3);
    expect(result.droppedCount).toBe(1);
  });

  it("reports a file with no headings at all", () => {
    const result = parseLeaseGrid([]);
    expect(result.rows).toHaveLength(0);
    expect(describeEmptyParse(result)).toContain("No headings were found on the first row");
  });

  it("loads a rent-roll export with Start/End headings, grouped amounts and word dates", () => {
    // Sharon's tenancy-schedule shape: bare Start/End/Escalation headings,
    // quoted thousands separators, DD-Mon-YY dates.
    const result = parseLeaseGrid(parseCsv(
      'Reference,Tenant,Unit,Start,End,Monthly Rent,Deposit,Escalation %,Status,Outstanding\n'
      + '1,Ambunya Lawrence T/A Lawrence Merchants,GR-1,01-Feb-24,31/01/2030,"11,305.94","31,406.00",10,Active,0\n'
      + '2,Ravishing Radish Caterers Ltd,F1-1,01-May-25,30-Apr-31,"323,744.40","964,256.00",10,Active,0',
    ));
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      tenant_code: "Ambunya Lawrence T/A Lawrence Merchants", unit_code: "GR-1",
      starts_on: "2024-02-01", ends_on: "2030-01-31",
      monthly_rent: "11305.94", escalation_percent: "10",
    });
    expect(result.rows[1]).toMatchObject({
      starts_on: "2025-05-01", ends_on: "2031-04-30", monthly_rent: "323744.40",
    });
    expect(result.missingRequired).toEqual([]);
  });

  it("normalises Sept word dates", () => {
    const result = parseLeaseGrid(parseCsv(`${TEMPLATE}\nTNT-1,A-1,01-Oct-25,30-Sept-31,10000,0,1,0,0`));
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ starts_on: "2025-10-01", ends_on: "2031-09-30" });
  });

  it("maps rent-rate aliases and strips grouped amounts", () => {
    const result = parseLeaseGrid(parseCsv('tenant_code,unit_code,starts_on,ends_on,Rate\nTNT-1,A-1,2026-09-01,2027-08-31,"1,250"'));
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ rent_rate_per_sqft: "1250" });
  });

  it("warns about every defaulted column", () => {
    expect(defaultColumnWarnings(["tenant_code", "unit_code", "starts_on", "ends_on", "monthly_rent", "service_charge", "billing_day", "escalation_percent", "escalation_interval_months"])).toEqual([]);
    const warnings = defaultColumnWarnings(["tenant_code", "unit_code"]);
    expect(warnings).toHaveLength(5);
    expect(warnings.join(" ")).toContain("defaults to 12 months");
    // A rate column suppresses the rent default warning.
    expect(defaultColumnWarnings(["tenant_code", "unit_code", "rent_rate_per_sqft"])).toHaveLength(4);
  });

  it("summarises preview errors by frequency", () => {
    const summary = summarizePreviewErrors([
      { row: 2, data: {}, errors: { unit: "Match an existing unit in 'Owned Property'." } },
      { row: 3, data: {}, errors: { unit: "Match an existing unit in 'Owned Property'.", tenant: "Match an existing tenant." } },
      { row: 4, data: {}, errors: {} },
    ]);
    expect(summary).toEqual([
      { message: "Match an existing unit in 'Owned Property'.", count: 2 },
      { message: "Match an existing tenant.", count: 1 },
    ]);
    expect(summarizePreviewErrors([])).toEqual([]);
  });
});
