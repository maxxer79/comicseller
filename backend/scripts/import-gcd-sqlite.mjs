#!/usr/bin/env node
/**
 * Load GCD metadata straight from a GCD SQLite (.db) file — no CSV needed.
 *
 * Run from the backend/ directory:
 *   node --experimental-sqlite scripts/import-gcd-sqlite.mjs <file.db> [--replace]
 */
import "dotenv/config";
import { DatabaseSync } from "node:sqlite";
import { PrismaClient } from "@prisma/client";

const file = process.argv[2];
const replace = process.argv.includes("--replace");
if (!file) {
  console.error("Usage: node --experimental-sqlite scripts/import-gcd-sqlite.mjs <file.db> [--replace]");
  process.exit(1);
}

const prisma = new PrismaClient();
const db = new DatabaseSync(file, { readonly: true });
const QUERY =
  "SELECT i.barcode AS barcode, s.name AS series, i.number AS number, " +
  "p.name AS publisher, substr(i.key_date,1,4) AS year " +
  "FROM gcd_issue i JOIN gcd_series s ON i.series_id = s.id " +
  "LEFT JOIN gcd_publisher p ON s.publisher_id = p.id " +
  "WHERE i.barcode IS NOT NULL AND i.barcode <> ''";

async function main() {
  if (replace) {
    const del = await prisma.gcdIssue.deleteMany({});
    console.log(`Cleared ${del.count} existing rows.`);
  }
  const stmt = db.prepare(QUERY);
  let batch = [];
  let total = 0;
  let skipped = 0;
  const flush = async () => {
    if (!batch.length) return;
    await prisma.gcdIssue.createMany({ data: batch });
    total += batch.length;
    process.stdout.write(`\rImported ${total} rows…`);
    batch = [];
  };
  for (const row of stmt.iterate()) {
    const barcode = String(row.barcode ?? "").replace(/\D/g, "");
    const series = row.series ? String(row.series) : "";
    if (!barcode || !series) { skipped++; continue; }
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
  db.close();
  process.stdout.write("\n");
  console.log(`Done. Imported ${total} rows, skipped ${skipped} (missing barcode/series).`);
  await prisma.$disconnect();
}
main().catch(async (e) => {
  console.error(e);
  try { db.close(); } catch { /* ignore */ }
  await prisma.$disconnect();
  process.exit(1);
});
