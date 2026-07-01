/**
 * Minimal, dependency-free CSV parsing + row mapping for bulk import.
 *
 * Handles quoted fields, escaped quotes ("") and commas inside quotes — enough
 * for real-world CLZ / CovrPrice exports where comic titles contain commas.
 * Header names are matched loosely (case/space/underscore-insensitive) against
 * a set of known aliases, so exports from different tools import without
 * hand-editing columns.
 */

export interface ImportedRow {
  title: string;
  issueNumber: string | null;
  publisher: string | null;
  year: number | null;
  grade: number | null;
  value: number | null; // FMV for this book's condition
  trend: "RISING" | "FLAT" | "FALLING" | "UNKNOWN" | null;
  keyIssue: boolean;
}

/** Parse raw CSV text into an array of string-cell rows. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  // Normalize newlines.
  const s = text.replace(/\r\n?/g, "\n");

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  // Flush trailing field/row (if file doesn't end in newline).
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[\s_\-.]/g, "");
}

// Known header aliases -> canonical field.
const HEADER_ALIASES: Record<string, keyof ImportedRow> = {
  title: "title",
  seriestitle: "title",
  series: "title",
  comictitle: "title",
  name: "title",
  issue: "issueNumber",
  issueno: "issueNumber",
  issuenumber: "issueNumber",
  number: "issueNumber",
  no: "issueNumber",
  publisher: "publisher",
  year: "year",
  coverdate: "year",
  grade: "grade",
  gradenumber: "grade",
  cgcgrade: "grade",
  value: "value",
  fmv: "value",
  price: "value",
  covrprice: "value",
  marketvalue: "value",
  estimatedvalue: "value",
  trend: "trend",
  key: "keyIssue",
  keyissue: "keyIssue",
  iskey: "keyIssue",
};

function toNumber(v: string): number | null {
  if (!v) return null;
  const n = Number(v.replace(/[$,]/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function toTrend(v: string): ImportedRow["trend"] {
  const t = v.trim().toLowerCase();
  if (["rising", "up", "hot", "↑"].includes(t)) return "RISING";
  if (["falling", "down", "cooling", "↓"].includes(t)) return "FALLING";
  if (["flat", "stable", "steady", "→"].includes(t)) return "FLAT";
  if (t === "") return null;
  return "UNKNOWN";
}

function toBool(v: string): boolean {
  return ["true", "yes", "y", "1", "key", "✓"].includes(v.trim().toLowerCase());
}

export interface MappedImport {
  rows: ImportedRow[];
  unmatchedHeaders: string[]; // columns we ignored (informational)
  rowsSkipped: number; // rows with no usable title
}

/** Map parsed CSV cells into typed ImportedRow objects. */
export function mapRows(cells: string[][]): MappedImport {
  if (cells.length === 0) {
    return { rows: [], unmatchedHeaders: [], rowsSkipped: 0 };
  }

  const header = cells[0];
  const colToField: (keyof ImportedRow | null)[] = header.map(
    (h) => HEADER_ALIASES[normalizeHeader(h)] ?? null
  );
  const unmatchedHeaders = header.filter((_, i) => colToField[i] === null);

  const rows: ImportedRow[] = [];
  let rowsSkipped = 0;

  for (let r = 1; r < cells.length; r++) {
    const cell = cells[r];
    const rec: ImportedRow = {
      title: "",
      issueNumber: null,
      publisher: null,
      year: null,
      grade: null,
      value: null,
      trend: null,
      keyIssue: false,
    };

    colToField.forEach((field, i) => {
      if (!field) return;
      const raw = (cell[i] ?? "").trim();
      switch (field) {
        case "title":
          rec.title = raw;
          break;
        case "issueNumber":
          rec.issueNumber = raw || null;
          break;
        case "publisher":
          rec.publisher = raw || null;
          break;
        case "year":
          rec.year = toNumber(raw);
          break;
        case "grade":
          rec.grade = toNumber(raw);
          break;
        case "value":
          rec.value = toNumber(raw);
          break;
        case "trend":
          rec.trend = toTrend(raw);
          break;
        case "keyIssue":
          rec.keyIssue = toBool(raw);
          break;
      }
    });

    if (!rec.title) {
      rowsSkipped++;
      continue;
    }
    rows.push(rec);
  }

  return { rows, unmatchedHeaders, rowsSkipped };
}
