import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const statsRouter = Router();

const num = (d: unknown): number => (d == null ? 0 : Number(d));

/**
 * GET /stats/overview
 * Collection-wide totals for the dashboard: counts, recommended value,
 * status/action/format breakdowns, and the most valuable books.
 */
statsRouter.get("/stats/overview", async (_req, res, next) => {
  try {
    const [
      total,
      byStatus,
      valueAgg,
      readyAgg,
      byAction,
      byFormat,
      keyCount,
      priced,
      topRaw,
    ] = await Promise.all([
      prisma.comic.count(),
      prisma.comic.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.comic.aggregate({ _sum: { recommendedPrice: true } }),
      prisma.comic.aggregate({
        _sum: { recommendedPrice: true },
        where: { status: { in: ["READY", "PRICED"] } },
      }),
      prisma.comic.groupBy({ by: ["recommendedAction"], _count: { _all: true } }),
      prisma.comic.groupBy({ by: ["recommendedFormat"], _count: { _all: true } }),
      prisma.comic.count({ where: { keyIssue: true } }),
      prisma.comic.count({ where: { recommendedPrice: { not: null } } }),
      prisma.comic.findMany({
        where: { recommendedPrice: { not: null } },
        orderBy: { recommendedPrice: "desc" },
        take: 10,
        select: {
          id: true,
          title: true,
          issueNumber: true,
          recommendedPrice: true,
          recommendedFormat: true,
          recommendedAction: true,
        },
      }),
    ]);

    const statusCounts: Record<string, number> = {};
    for (const s of byStatus as Array<{ status: string; _count: { _all: number } }>) {
      statusCounts[s.status] = s._count._all;
    }
    const actionCounts: Record<string, number> = {};
    for (const a of byAction as Array<{
      recommendedAction: string | null;
      _count: { _all: number };
    }>) {
      if (a.recommendedAction) actionCounts[a.recommendedAction] = a._count._all;
    }
    const formatCounts: Record<string, number> = {};
    for (const f of byFormat as Array<{
      recommendedFormat: string | null;
      _count: { _all: number };
    }>) {
      if (f.recommendedFormat) formatCounts[f.recommendedFormat] = f._count._all;
    }

    res.json({
      totalComics: total,
      pricedComics: priced,
      unpricedComics: total - priced,
      keyIssues: keyCount,
      totalValue: num(valueAgg._sum.recommendedPrice),
      readyValue: num(readyAgg._sum.recommendedPrice),
      statusCounts,
      actionCounts,
      formatCounts,
      topComics: topRaw.map((c: {
        id: string; title: string; issueNumber: string | null;
        recommendedPrice: unknown; recommendedFormat: string | null; recommendedAction: string | null;
      }) => ({
        id: c.id,
        title: c.title,
        issueNumber: c.issueNumber,
        recommendedPrice: num(c.recommendedPrice),
        recommendedFormat: c.recommendedFormat,
        recommendedAction: c.recommendedAction,
      })),
    });
  } catch (err) {
    next(err);
  }
});
