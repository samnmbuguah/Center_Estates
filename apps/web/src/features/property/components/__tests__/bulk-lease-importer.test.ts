import { parseCsv } from "@/lib/csv";
import { describeEmptyParse, parseLeaseGrid } from "../BulkLeaseImporter";

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
});
