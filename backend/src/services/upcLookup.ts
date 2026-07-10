import { prisma } from "../lib/prisma.js";

/**
 * Free, offline UPC -> comic metadata lookup backed by a local slice of the
 * Grand Comics Database (the GcdIssue table). This is the pluggable "comic
 * metadata provider" — swap/extend the source without touching callers.
 *
 * Comic barcodes are a 12-digit UPC-A plus an optional 5-digit supplement that
 * encodes issue number + cover variant. Scanners often read only the 12-digit
 * main code, so we match on the full barcode when available and fall back to
 * the 12-digit prefix.
 */

export interface UpcMatch {
  series: string;
  number: string | null;
  publisher: string | null;
  year: number | null;
  barcode: string;
  gcdIssueId: string | null;
}

export interface UpcLookupResult {
  found: boolean;
  query: string; // normalized digits
  match: UpcMatch | null; // best single match
  candidates: UpcMatch[]; // other matches (same main UPC, different issues/printings)
  source: "GCD" | "NONE";
}

/** Keep only digits. */
export function normalizeUpc(raw: string): string {
  return (raw || "").replace(/\D/g, "");
}

function toMatch(r: {
  series: string;
  number: string | null;
  publisher: string | null;
  year: number | null;
  barcode: string;
  gcdIssueId: string | null;
}): UpcMatch {
  return {
    series: r.series,
    number: r.number,
    publisher: r.publisher,
    year: r.year,
    barcode: r.barcode,
    gcdIssueId: r.gcdIssueId,
  };
}

export async function lookupByUpc(rawUpc: string): Promise<UpcLookupResult> {
  const digits = normalizeUpc(rawUpc);
  const empty: UpcLookupResult = {
    found: false,
    query: digits,
    match: null,
    candidates: [],
    source: "NONE",
  };
  if (digits.length < 8) return empty;

  // 1) Exact barcode match (best).
  const exact = await prisma.gcdIssue.findMany({
    where: { barcode: digits },
    take: 10,
    orderBy: { year: "desc" },
  });
  if (exact.length > 0) {
    return {
      found: true,
      query: digits,
      match: toMatch(exact[0]),
      candidates: exact.slice(1).map(toMatch),
      source: "GCD",
    };
  }

  // 2) Fall back to the 12-digit main UPC (identifies the series/title, though
  //    the specific issue may be ambiguous across printings).
  const main = digits.slice(0, 12);
  if (main.length === 12) {
    const byMain = await prisma.gcdIssue.findMany({
      where: { barcode: { startsWith: main } },
      take: 25,
      orderBy: { year: "desc" },
    });
    if (byMain.length > 0) {
      return {
        found: true,
        query: digits,
        match: toMatch(byMain[0]),
        candidates: byMain.slice(1).map(toMatch),
        source: "GCD",
      };
    }
  }

  return empty;
}

/**
 * Search the GCD table by series title (+ optional issue number / year).
 * Title+issue is NOT unique, so this returns a ranked candidate list to pick
 * from — used for pre-barcode books where UPC lookup can't help.
 */
export async function searchByTitle(
  seriesQ: string,
  number?: string | null,
  year?: number | null
): Promise<UpcMatch[]> {
  const q = (seriesQ || "").trim();
  if (q.length < 2) return [];
  const where: Record<string, unknown> = { series: { contains: q, mode: "insensitive" } };
  if (number && String(number).trim()) where.number = String(number).trim();
  if (typeof year === "number" && year > 0) where.year = year;
  const rows = await prisma.gcdIssue.findMany({
    where: where as never,
    take: 30,
    orderBy: [{ year: "desc" }],
  });
  return rows.map(toMatch);
}

/** Is the local GCD table populated? (for status/UX). */
export async function gcdIssueCount(): Promise<number> {
  return prisma.gcdIssue.count();
}
