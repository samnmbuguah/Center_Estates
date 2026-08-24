import { csvCell, csvColumn, normalizeCsvHeader, parseCsv } from "./csv";

describe("shared CSV parser", () => {
  it("preserves quoted commas, escaped quotes, CRLF and BOM headers", () => {
    const rows = parseCsv('\uFEFFunit_no,area,description\r\nF1-1,"3,101.00","Corner, retail ""shop"""\r\n');
    expect(rows).toEqual([
      ["unit_no", "area", "description"],
      ["F1-1", "3,101.00", 'Corner, retail "shop"'],
    ]);
    const headers = rows[0].map(normalizeCsvHeader);
    expect(csvCell(rows[1], csvColumn(headers, ["unit_no"]))).toBe("F1-1");
  });

  it("rejects malformed unclosed quoted fields", () => {
    expect(() => parseCsv('name,description\nLift,"Unclosed')).toThrow(/unclosed quoted value/i);
  });
});
