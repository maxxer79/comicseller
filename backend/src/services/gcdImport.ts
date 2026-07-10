import { createReadStream, existsSync } from "node:fs";
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

export async function importGcdFromFile(path: string, replace: boolean): Promise<GcdImportResult> {
  if (!existsSync(path)) throw new Error(`File not found: ${path}`);
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
    if (!rec.barcode || !rec.series) { skipped++; continue; }
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
