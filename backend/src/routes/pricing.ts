import { Router } from "express";
import multer from "multer";
import { prisma } from "../lib/prisma.js";
import { recommend, type Trend } from "../services/pricing/recommend.js";
import { parseCsv, mapRows } from "../services/pricing/csv.js";

export const pricingRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB CSV
});

const comicInclude = {
  photos: { orderBy: { createdAt: "asc" } },
  priceSnapshots: { orderBy: { createdAt: "desc" }, take: 1 },
  listing: true,
} as const;

const VALID_SOURCES = ["EBAY_ACTIVE", "EBAY_SOLD", "MANUAL", "COMIC_API"];
const VALID_TRENDS: Trend[] = ["RISING", "FLAT", "FALLING", "UNKNOWN"];

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * Apply a snapshot's numbers + the comic's own attributes to the engine and
 * persist the recommendation on the comic. Returns the updated comic.
 */
async function priceComic(comicId: string) {
  const comic = await prisma.comic.findUnique({
    where: { id: comicId },
    include: { priceSnapshots: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!comic) return null;

  const snap = comic.priceSnapshots[0];
  const settings = await prisma.settings.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } });
  const c = comic as unknown as { freeShipping?: boolean | null };
  const st = settings as unknown as { freeShippingDefault?: boolean; shippingCost?: number };
  const effFreeShipping = c.freeShipping ?? st.freeShippingDefault ?? false;
  const rec = recommend({
    grade: comic.grade ? Number(comic.grade) : null,
    keyIssue: comic.keyIssue,
    averagePrice: snap?.averagePrice ? Number(snap.averagePrice) : null,
    medianPrice: snap?.medianPrice ? Number(snap.medianPrice) : null,
    lowPrice: snap?.lowPrice ? Number(snap.lowPrice) : null,
    highPrice: snap?.highPrice ? Number(snap.highPrice) : null,
    salesPerMonth: snap?.salesPerMonth ?? null,
    trend: (snap?.trend as Trend | undefined) ?? null,
    freeShipping: effFreeShipping,
    shippingCost: st.shippingCost ?? null,
  });

  return prisma.comic.update({
    where: { id: comicId },
    data: {
      recommendedPrice: rec.recommendedPrice ?? null,
      recommendedFormat: rec.recommendedFormat,
      recommendedAction: rec.recommendedAction,
      recommendationNote: rec.recommendationNote,
      status:
        comic.status === "INTAKE" || comic.status === "IDENTIFIED"
          ? "PRICED"
          : comic.status,
    },
    include: comicInclude,
  });
}

/**
 * POST /comics/:id/price
 * Record a price snapshot (e.g. pasted from CovrPrice / Key Collector) and
 * regenerate the recommendation. Body:
 * {
 *   source?: "MANUAL"|"COMIC_API"|"EBAY_ACTIVE"|"EBAY_SOLD",
 *   averagePrice?, medianPrice?, lowPrice?, highPrice?: number,
 *   salesPerMonth?: number, sampleSize?: number,
 *   trend?: "RISING"|"FLAT"|"FALLING"|"UNKNOWN",
 *   rawComps?: any
 * }
 */
pricingRouter.post("/comics/:id/price", async (req, res, next) => {
  try {
    const comic = await prisma.comic.findUnique({ where: { id: req.params.id } });
    if (!comic) return res.status(404).json({ error: "Comic not found" });

    const b = req.body ?? {};
    const source = VALID_SOURCES.includes(b.source) ? b.source : "MANUAL";
    const trend =
      typeof b.trend === "string" && VALID_TRENDS.includes(b.trend as Trend)
        ? b.trend
        : null;

    const hasAnyPrice =
      num(b.averagePrice) !== null ||
      num(b.medianPrice) !== null ||
      (num(b.lowPrice) !== null && num(b.highPrice) !== null);
    if (!hasAnyPrice) {
      return res.status(400).json({
        error:
          "Provide at least averagePrice, medianPrice, or both lowPrice and highPrice.",
      });
    }

    await prisma.priceSnapshot.create({
      data: {
        comicId: comic.id,
        source: source as never,
        sampleSize: num(b.sampleSize) ?? 0,
        averagePrice: num(b.averagePrice),
        medianPrice: num(b.medianPrice),
        lowPrice: num(b.lowPrice),
        highPrice: num(b.highPrice),
        salesPerMonth: num(b.salesPerMonth),
        trend: (trend as never) ?? undefined,
        rawComps: b.rawComps ?? undefined,
      },
    });

    const updated = await priceComic(comic.id);
    res.status(201).json(updated);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /comics/:id/recommend
 * Re-run the recommendation using the latest snapshot (e.g. after you confirm
 * a grade or toggle keyIssue). No new comps required.
 */
pricingRouter.post("/comics/:id/recommend", async (req, res, next) => {
  try {
    const updated = await priceComic(req.params.id);
    if (!updated) return res.status(404).json({ error: "Comic not found" });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /import/csv
 * Bulk-import comics from a CLZ / CovrPrice CSV export (field name "file").
 * Each row creates a comic + a MANUAL price snapshot + a recommendation.
 * Dry-run with ?dryRun=1 to preview the mapping without writing.
 */
pricingRouter.post("/import/csv", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No CSV file uploaded" });
    const dryRun = req.query.dryRun === "1" || req.query.dryRun === "true";

    const text = req.file.buffer.toString("utf8");
    const { rows, unmatchedHeaders, rowsSkipped } = mapRows(parseCsv(text));

    if (rows.length === 0) {
      return res.status(400).json({
        error: "No importable rows found (need at least a Title column).",
        unmatchedHeaders,
      });
    }

    if (dryRun) {
      return res.json({
        dryRun: true,
        willImport: rows.length,
        rowsSkipped,
        unmatchedHeaders,
        preview: rows.slice(0, 10),
      });
    }

    let created = 0;
    for (const row of rows) {
      const comic = await prisma.comic.create({
        data: {
          title: row.title,
          issueNumber: row.issueNumber,
          publisher: row.publisher,
          year: row.year,
          grade: row.grade, // CSV grade is treated as confirmed
          keyIssue: row.keyIssue,
          status: "IDENTIFIED",
        },
      });

      if (row.value !== null) {
        await prisma.priceSnapshot.create({
          data: {
            comicId: comic.id,
            source: "MANUAL",
            averagePrice: row.value,
            medianPrice: row.value,
            trend: (row.trend as never) ?? undefined,
          },
        });
        await priceComic(comic.id);
      }
      created++;
    }

    res.status(201).json({
      imported: created,
      rowsSkipped,
      unmatchedHeaders,
    });
  } catch (err) {
    next(err);
  }
});
