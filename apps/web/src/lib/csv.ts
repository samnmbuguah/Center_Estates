/**
 * Detect the separator used by common spreadsheet CSV exports. Excel uses a
 * semicolon in locales where the comma is the decimal separator, while a TSV
 * may be supplied by a reporting tool. The first populated line is enough for
 * the import templates because their headers are unquoted identifiers.
 */
function detectCsvDelimiter(text: string) {
  const header = text.split(/\r?\n/, 1)[0] ?? "";
  const candidates = [",", ";", "\t"] as const;
  return candidates.reduce((best, delimiter) => {
    const count = header.split(delimiter).length - 1;
    const bestCount = header.split(best).length - 1;
    return count > bestCount ? delimiter : best;
  }, ",");
}

/** RFC-4180 compatible CSV parsing shared by every bulk uploader. */
export function parseCsv(text: string, delimiter = detectCsvDelimiter(text)): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"' && quoted && text[index + 1] === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      row.push(cell.trim()); cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; cell = "";
    } else {
      cell += character;
    }
  }
  if (quoted) throw new Error("The CSV contains an unclosed quoted value.");
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

export function normalizeCsvHeader(value: string) {
  return value.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export type ImportGridSpec = {
  /** Canonical field name -> accepted heading aliases (already normalized form). */
  fields: Record<string, string[]>;
  /** Canonical fields that must each match a column before any row can import. */
  required?: string[];
  /** Keep a mapped row when true (default: keep rows with any value). */
  keep?: (row: Record<string, string>) => boolean;
  /** Rewrite a mapped row before the keep check (dates, number cleanup). */
  normalize?: (row: Record<string, string>) => Record<string, string>;
};

export type ImportGridParse = {
  rows: Record<string, string>[];
  /** Raw heading cells from the first row, as written in the file. */
  detectedHeaders: string[];
  /** Canonical fields that matched a column in the file. */
  matchedFields: string[];
  /** Required fields with no matching column. */
  missingRequired: string[];
  /** Non-blank data rows seen below the heading row. */
  dataRowCount: number;
  /** Data rows dropped by the keep check. */
  droppedCount: number;
};

/**
 * Shared pre-parse gate for every bulk importer. Maps each data row to
 * canonical keys via alias lists, applies an optional rewrite, then keeps
 * only rows the caller considers meaningful — while recording everything
 * needed to explain an empty result (detected headings, missing required
 * fields, dropped-row count) instead of a bare "no rows found" message.
 */
export function parseImportGrid(parsed: string[][], spec: ImportGridSpec): ImportGridParse {
  const canonical = Object.keys(spec.fields);
  const required = spec.required ?? [];
  const empty = (detectedHeaders: string[] = []): ImportGridParse => ({
    rows: [], detectedHeaders, matchedFields: [],
    missingRequired: [...required], dataRowCount: 0, droppedCount: 0,
  });
  if (!parsed.length) return empty();
  const detectedHeaders = parsed[0].map((cell) => String(cell ?? "").trim()).filter(Boolean);
  const normalized = parsed[0].map(normalizeCsvHeader);
  const matchedFields = canonical.filter((field) => csvColumn(normalized, spec.fields[field]) >= 0);
  const missingRequired = required.filter((field) => !matchedFields.includes(field));
  const dataRows = parsed.slice(1).filter((row) => row.some((cell) => String(cell ?? "").trim()));
  const rows: Record<string, string>[] = [];
  for (const row of dataRows) {
    const raw = Object.fromEntries(canonical.map((field) => [
      field, csvCell(row, csvColumn(normalized, spec.fields[field])),
    ]));
    const finalRow = spec.normalize ? spec.normalize(raw) : raw;
    if (!spec.keep || spec.keep(finalRow)) rows.push(finalRow);
  }
  return {
    rows, detectedHeaders, matchedFields, missingRequired,
    dataRowCount: dataRows.length, droppedCount: dataRows.length - rows.length,
  };
}

/** Explain an empty parse so the user can fix the file instead of guessing. */
export function describeEmptyGrid(parse: ImportGridParse, noun = "rows"): string {
  const found = parse.detectedHeaders.length
    ? `Headings found: ${parse.detectedHeaders.join(", ")}.`
    : "No headings were found on the first row — put the template headings on row 1 with no title rows above them.";
  const missing = parse.missingRequired.length
    ? ` Missing required heading${parse.missingRequired.length === 1 ? "" : "s"}: ${parse.missingRequired.join(", ")}.`
    : "";
  const skipped = parse.dataRowCount > 0
    ? ` ${parse.dataRowCount} data row${parse.dataRowCount === 1 ? " was" : "s were"} ignored — none matched the required columns.`
    : "";
  return `No ${noun} were found. ${found}${missing}${skipped}`;
}

export function csvColumn(headers: string[], aliases: string[]) {
  return aliases.map(normalizeCsvHeader).reduce((found, alias) => found >= 0 ? found : headers.indexOf(alias), -1);
}

export function csvCell(row: string[], index: number) {
  return index >= 0 ? (row[index] ?? "").trim() : "";
}

/**
 * Normalizes any common date representation (ISO YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY,
 * DD.MM.YYYY, YYYY/MM/DD, Excel serial date numbers, or word dates) to standard ISO 'YYYY-MM-DD'.
 */
export function normalizeDateString(raw: string | number | null | undefined): string {
  if (!raw) return "";
  const str = String(raw).trim();
  if (!str) return "";

  // 1. ISO YYYY-MM-DD (or YYYY/MM/DD, YYYY.MM.DD)
  const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, "0");
    const d = isoMatch[3].padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // 2. Day-first: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY (or D/M/YYYY)
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, "0");
    const m = dmyMatch[2].padStart(2, "0");
    const y = dmyMatch[3];
    return `${y}-${m}-${d}`;
  }

  // 3. Short year: DD/MM/YY, DD-MM-YY
  const dmyShortMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$/);
  if (dmyShortMatch) {
    const d = dmyShortMatch[1].padStart(2, "0");
    const m = dmyShortMatch[2].padStart(2, "0");
    const y = Number(dmyShortMatch[3]) > 50 ? `19${dmyShortMatch[3]}` : `20${dmyShortMatch[3]}`;
    return `${y}-${m}-${d}`;
  }

  // 4. Excel integer serial date numbers (e.g. 45321)
  if (/^\d{5}$/.test(str)) {
    const serial = Number(str);
    const utcDays = serial - 25569;
    const utcValue = utcDays * 86400;
    const dateInfo = new Date(utcValue * 1000);
    if (!isNaN(dateInfo.getTime())) {
      return dateInfo.toISOString().split("T")[0];
    }
  }

  // 5. Day + month name: 01-Feb-24, 30-Sept-2031 ("Sept" included). Handled
  // explicitly because Date.parse maps two-digit years inconsistently and
  // rejects "Sept"; the pivot below matches Python strptime %y behaviour.
  const monthIndex: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };
  const wordMatch = str.match(/^(\d{1,2})[-/. ]([A-Za-z]{3,9})[-/. ](\d{2}|\d{4})$/);
  if (wordMatch) {
    const month = monthIndex[wordMatch[2].toLowerCase().slice(0, 3)];
    const day = Number(wordMatch[1]);
    if (month && day >= 1 && day <= 31) {
      const year = wordMatch[3].length === 2
        ? (Number(wordMatch[3]) <= 68 ? `20${wordMatch[3]}` : `19${wordMatch[3]}`)
        : wordMatch[3];
      return `${year}-${month}-${String(day).padStart(2, "0")}`;
    }
  }

  // 6. JavaScript natural language date parser (e.g., "1 Jan 2026", "August 1, 2026")
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  return str;
}
