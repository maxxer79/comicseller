#!/usr/bin/env node
/**
 * Import a prepared GCD (Grand Comics Database) export into the GcdIssue table
 * so Comicseller can resolve scanned UPCs to comic metadata for free, offline.
 *
 * The file must be delimited (CSV or TSV) with a header row. Recognized columns
 * (case/space-insensitive): barcode|upc, series|series_name|title,
 * number|issue|issue_number, publisher, year|publication_year|key_date.
 * Only `barcode` and `series` are required; others are optional.
 *
 * GCD data is CC-BY-SA — credit the Grand Comics Database (comics.org).
 *
 * Usage (run from the backend/ directory so @prisma/client resolves):
 *   node scripts/import-gcd.mjs <file.csv|file.tsv> [--replace]
 *
 *   --replace   Wipe the existing GcdIssue table before importing.
 */
import "dotenv/config";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const file = process.argv[2];
const replace = process.argv.includes("--replace");
if (!file) {
  console.error("Usage: node scripts/import-gcd.mjs <file.csv|file.tsv> [--replace]");
  process.exit(1);
}

const ALIAS = {
  barcode: "barcode",
  upc: "barcode",
  series: "series",
  series_name: "series",
  seriesname: "series",
  title: "series",
  number: "number",
  issue: "number",
  issue_number: "number",
  issuenumber: "number",
  publisher: "publisher",
  year: "year",
  publication_year: "year",
  key_date: "year",
  keydate: "year",
};

const norm = (h) => h.toLowerCase().trim().replace(/[\s]/g, "_");
const digits = (s) => (s || "").replace(/\D/g, "");
const toYear = (s) => {
  const m = (s || "").match(/\d{4}/);
  return m ? parseInt(m[0], 10) : null;
};

function splitLine(line, delim) {
  // Minimal delimited parser with double-quote support.
  const out = [];
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

async function main() {
  if (replace) {
    const del = await prisma.gcdIssue.deleteMany({});
    console.log(`Cleared ${del.count} existing rows.`);
  }

  const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  let header = null;
  let delim = ",";
  let colMap = [];
  let batch = [];
  let total = 0;
  let skipped = 0;

  async function flush() {
    if (batch.length === 0) return;
    await prisma.gcdIssue.createMany({ data: batch });
    total += batch.length;
    process.stdout.write(`\rImported ${total} rows…`);
    batch = [];
  }

  for await (const line of rl) {
    if (line.trim() === "") continue;
    if (!header) {
      delim = line.includes("\t") ? "\t" : ",";
      header = splitLine(line, delim).map((h) => ALIAS[norm(h)] ?? null);
      colMap = header;
      if (!colMap.includes("barcode") || !colMap.includes("series")) {
        console.error("File must have at least `barcode` and `series` columns.");
        process.exit(1);
      }
      continue;
    }
    const cells = splitLine(line, delim);
    const rec = { barcode: "", series: "", number: null, publisher: null, year: null };
    colMap.forEach((field, i) => {
      if (!field) return;
      const v = (cells[i] ?? "").trim();
      if (field === "barcode") rec.barcode = digits(v);
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
  process.stdout.write("\n");
  console.log(`Done. Imported ${total} rows, skipped ${skipped} (missing barcode/series).`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
