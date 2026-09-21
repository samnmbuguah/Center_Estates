import { describeEmptyGrid, normalizeDateString, parseCsv, parseImportGrid } from "../csv";

describe("shared import grid", () => {
  const spec = {
    fields: {
      unit_code: ["unit_code", "unit", "unit_no"],
      name: ["name", "tenant_name", "tenant"],
    },
    required: ["unit_code", "name"],
  };

  it("maps alias headings to canonical keys", () => {
    const result = parseImportGrid(parseCsv("Unit,Tenant\nA-101,Grace"), spec);
    expect(result.rows).toEqual([{ unit_code: "A-101", name: "Grace" }]);
    expect(result.missingRequired).toEqual([]);
  });

  it("diagnoses unrecognised headings", () => {
    const result = parseImportGrid(parseCsv("House,Person\nK-101,Sharon"), {
      ...spec,
      keep: (row) => Boolean(row.unit_code || row.name),
    });
    expect(result.rows).toHaveLength(0);
    expect(describeEmptyGrid(result, "tenant rows")).toBe(
      "No tenant rows were found. Headings found: House, Person. "
      + "Missing required headings: unit_code, name. "
      + "1 data row was ignored — none matched the required columns.",
    );
  });

  it("counts dropped rows while keeping valid ones", () => {
    const result = parseImportGrid(parseCsv("unit_code,name\nA-101,Grace\n,,\nB-202,"), {
      ...spec,
      keep: (row) => Boolean(row.unit_code && row.name),
    });
    expect(result.rows).toHaveLength(1);
    expect(result.dataRowCount).toBe(2);
    expect(result.droppedCount).toBe(1);
  });

  it("normalises word dates including Sept and two-digit years", () => {
    expect(normalizeDateString("01-Feb-24")).toBe("2024-02-01");
    expect(normalizeDateString("30-Sept-31")).toBe("2031-09-30");
    expect(normalizeDateString("30-Sep-2031")).toBe("2031-09-30");
    expect(normalizeDateString("2026-09-01")).toBe("2026-09-01");
    expect(normalizeDateString("01/09/2026")).toBe("2026-09-01");
  });
});
