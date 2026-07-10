import { createReadStream, existsSync } from "node:fs";
import { promises as fsp } from "node:fs";
import { createInterface } from "node:readline";
import { prisma } from "../lib/prisma.js";

/**
 * Streaming importer for a prepared GCD barcode CSV/TSV into the GcdIssue table.
 * Recognized columns (case/space-insensitive): barcode|upc, series|series_name|
 * title, number|issue|issue_number, publisher, year|publication_year|key_date.
 * Only `barcode` and `series` are required. Handles large files (batched).
 */

const ALIAS: Record<string, string> = {
  barcode: "barcode", upc: "barcode",
  series: "series", series_name: "series", seriesname: "series", title: "series",
  number: "number", issue: "number", issue_number: "number", issuenumber: "number",
  publisher: "publisher",
  year: "year", publication_year: "year", key_date: "year", keydate: "year",
};

const norm = (h: string) => h.toLowerCase().trim().replace(/\s/g, "_");
const digitsOnly = (s: string) => (s || "").replace(/\D/g, "");
const toYear = (s: string) => {
  const m = (s || "").match(/\d{4}/);
  return m ? parseInt(m[0], 10) : null;
};

function splitLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === delim) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

export interface GcdImportResult {
  imported: number;
  skipped: number;
}

/** True if the file begins with the SQLite magic header. */
async function isSqliteFile(path: string): Promise<boolean> {
  const fd = await fsp.open(path, "r");
  try {
    const head = Buffer.alloc(16);
    await fd.read(head, 0, 16, 0);
    return head.toString("latin1").startsWith("SQLite format 3");
  } finally {
    await fd.close();
  }
}

/** Import directly from a GCD SQLite (.db) file using Node's built-in SQLite. */
export async function importGcdFromSqlite(dbPath: string, replace: boolean, onProgress?: (imported: number, skipped: number) => void): Promise<GcdImportResult> {
  let DatabaseSync: unknown;
  try {
    // Node's built-in SQLite (needs the --experimental-sqlite flag at startup).
    ({ DatabaseSync } = require("node:sqlite") as { DatabaseSync: unknown });
  } catch {
    throw new Error(
      "Reading a .db needs Node's SQLite support. Start the server with --experimental-sqlite, or run: node --experimental-sqlite scripts/import-gcd-sqlite.mjs <file.db> --replace"
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const DB = DatabaseSync as any;
  const db = new DB(dbPath, { readonly: true });
  try {
    if (replace) await prisma.gcdIssue.deleteMany({});
    const QUERY =
      "SELECT i.barcode AS barcode, s.name AS series, i.number AS number, " +
      "p.name AS publisher, substr(i.key_date,1,4) AS year " +
      "FROM gcd_issue i JOIN gcd_series s ON i.series_id = s.id " +
      "LEFT JOIN gcd_publisher p ON s.publisher_id = p.id";
    let stmt;
    try {
      stmt = db.prepare(QUERY);
    } catch {
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all()
        .map((r: { name: string }) => r.name)
        .join(", ");
      throw new Error(
        `Could not run the GCD query — expected tables gcd_issue / gcd_series / gcd_publisher. Tables found: ${tables}`
      );
    }
    let batch: { barcode: string; series: string; number: string | null; publisher: string | null; year: number | null }[] = [];
    let imported = 0;
    let skipped = 0;
    const flush = async () => {
      if (batch.length === 0) return;
      await prisma.gcdIssue.createMany({ data: batch });
      imported += batch.length;
      batch = [];
      onProgress?.(imported, skipped);
    };
    for (const row of stmt.iterate() as Iterable<Record<string, unknown>>) {
      const barcode = String(row.barcode ?? "").replace(/\D/g, "");
      const series = row.series ? String(row.series) : "";
      if (!series) { skipped++; continue; }
      const yn = row.year ? parseInt(String(row.year), 10) : NaN;
      batch.push({
        barcode,
        series,
        number: row.number ? String(row.number) : null,
        publisher: row.publisher ? String(row.publisher) : null,
        year: Number.isFinite(yn) ? yn : null,
      });
      if (batch.length >= 2000) await flush();
    }
    await flush();
    return { imported, skipped };
  } finally {
    db.close();
  }
}

export async function importGcdFromFile(path: string, replace: boolean, onProgress?: (imported: number, skipped: number) => void): Promise<GcdImportResult> {
  if (!existsSync(path)) throw new Error(`File not found: ${path}`);
  if (await isSqliteFile(path)) return importGcdFromSqlite(path, replace, onProgress);
  if (replace) await prisma.gcdIssue.deleteMany({});

  const rl = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  let colMap: (string | null)[] | null = null;
  let delim = ",";
  let batch: { barcode: string; series: string; number: string | null; publisher: string | null; year: number | null }[] = [];
  let imported = 0;
  let skipped = 0;

  const flush = async () => {
    if (batch.length === 0) return;
    await prisma.gcdIssue.createMany({ data: batch });
    imported += batch.length;
    batch = [];
    onProgress?.(imported, skipped);
  };

  for await (const line of rl) {
    if (line.trim() === "") continue;
    if (!colMap) {
      delim = line.includes("\t") ? "\t" : ",";
      colMap = splitLine(line, delim).map((h) => ALIAS[norm(h)] ?? null);
      if (!colMap.includes("barcode") || !colMap.includes("series")) {
        throw new Error("CSV must include at least 'barcode' and 'series' columns.");
      }
      continue;
    }
    const cells = splitLine(line, delim);
    const rec = { barcode: "", series: "", number: null as string | null, publisher: null as string | null, year: null as number | null };
    colMap.forEach((field, i) => {
      if (!field) return;
      const v = (cells[i] ?? "").trim();
      if (field === "barcode") rec.barcode = digitsOnly(v);
      else if (field === "series") rec.series = v;
      else if (field === "number") rec.number = v || null;
      else if (field === "publisher") rec.publisher = v || null;
      else if (field === "year") rec.year = toYear(v);
    });
    if (!rec.series) { skipped++; continue; }
    batch.push(rec);
    if (batch.length >= 2000) await flush();
  }
  await flush();
  return { imported, skipped };
}

/** Row count + newest row timestamp (for the admin status panel). */
export async function gcdStatus(): Promise<{ datasetSize: number; lastUpdated: string | null }> {
  const datasetSize = await prisma.gcdIssue.count();
  const newest = await prisma.gcdIssue.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } });
  return { datasetSize, lastUpdated: newest ? newest.createdAt.toISOString() : null };
}

// ---------------------------------------------------------------------------
// Background import job (single global job; imports are admin-only + infrequent)
// ---------------------------------------------------------------------------

export interface GcdJob {
  status: "idle" | "running" | "done" | "error";
  source: string | null;
  imported: number;
  skipped: number;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  datasetSize: number | null;
}

let currentJob: GcdJob = {
  status: "idle", source: null, imported: 0, skipped: 0,
  startedAt: null, finishedAt: null, error: null, datasetSize: null,
};

export function getGcdJob(): GcdJob {
  return currentJob;
}
export function isGcdJobRunning(): boolean {
  return currentJob.status === "running";
}

/** Run an import in the background, tracking progress on the global job. */
export async function runGcdImportJob(
  path: string,
  replace: boolean,
  source: string,
  cleanup?: () => Promise<void>
): Promise<void> {
  currentJob = {
    status: "running", source, imported: 0, skipped: 0,
    startedAt: new Date().toISOString(), finishedAt: null, error: null, datasetSize: null,
  };
  try {
    const res = await importGcdFromFile(path, replace, (imported, skipped) => {
      currentJob.imported = imported;
      currentJob.skipped = skipped;
    });
    const st = await gcdStatus();
    currentJob = {
      ...currentJob,
      status: "done",
      imported: res.imported,
      skipped: res.skipped,
      finishedAt: new Date().toISOString(),
      datasetSize: st.datasetSize,
    };
  } catch (e) {
    currentJob = {
      ...currentJob,
      status: "error",
      finishedAt: new Date().toISOString(),
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    if (cleanup) await cleanup().catch(() => {});
  }
}
