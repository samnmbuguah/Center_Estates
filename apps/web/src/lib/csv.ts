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

  // 5. JavaScript natural language date parser (e.g., "1 Jan 2026", "August 1, 2026")
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  return str;
}
