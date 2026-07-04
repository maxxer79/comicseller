import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { buildEbayCsv, type CsvComic, type EbayExportSettings } from "../services/ebayCsv.js";

export const exportRouter = Router();

const EXPORTABLE_STATUSES = ["INTAKE", "IDENTIFIED", "PRICED", "READY", "LISTED", "SOLD", "ARCHIVED"];

/**
 * GET /export/ebay.csv?status=READY
 * Download a Seller Hub Reports (File Exchange) bulk-listing CSV. Defaults to
 * READY comics.
 */
exportRouter.get("/export/ebay.csv", async (req, res, next) => {
  try {
    const status =
      typeof req.query.status === "string" && EXPORTABLE_STATUSES.includes(req.query.status)
        ? req.query.status
        : "READY";

    const settings = await prisma.settings.upsert({
      where: { id: "default" },
      update: {},
      create: { id: "default" },
    });

    const comics = await prisma.comic.findMany({
      where: { status: status as never },
      include: { photos: { orderBy: { createdAt: "asc" } } },
      orderBy: { updatedAt: "desc" },
    });

    const rows: CsvComic[] = comics.map((c: {
      sku: string; title: string; issueNumber: string | null; publisher: string | null; variant: string | null;
      year: number | null; grade: unknown; graded: boolean; gradingCompany: string | null; condition: string | null;
      keyIssue: boolean; keyNotes: string | null; location: string | null; recommendedPrice: unknown; recommendedFormat: string | null;
      photos: { url: string | null; isPrimary: boolean }[];
    }) => ({
      sku: c.sku,
      title: c.title,
      issueNumber: c.issueNumber,
      publisher: c.publisher,
      variant: c.variant,
      year: c.year,
      grade: c.grade ? Number(c.grade) : null,
      graded: c.graded,
      gradingCompany: c.gradingCompany,
      condition: c.condition,
      keyIssue: c.keyIssue,
      keyNotes: c.keyNotes,
      location: c.location,
      recommendedPrice: c.recommendedPrice,
      recommendedFormat: c.recommendedFormat,
      photos: c.photos.map((p: { url: string | null; isPrimary: boolean }) => ({
        url: p.url,
        isPrimary: p.isPrimary,
      })),
    }));

    const settingsForCsv: EbayExportSettings = {
      ebayCategoryId: settings.ebayCategoryId,
      ebayConditionId: settings.ebayConditionId,
      ebayDuration: settings.ebayDuration,
      ebayShippingProfile: settings.ebayShippingProfile,
      ebayPaymentProfile: settings.ebayPaymentProfile,
      ebayReturnProfile: settings.ebayReturnProfile,
      publicBaseUrl: settings.publicBaseUrl,
    };

    const csv = buildEbayCsv(rows, settingsForCsv);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="comicseller-ebay-${status.toLowerCase()}.csv"`
    );
    res.send(csv);
  } catch (err) {
    next(err);
  }
});
