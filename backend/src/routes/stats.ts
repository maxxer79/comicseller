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

statsRouter.get("/stats/locations", async (_req, res, next) => {
  try {
    const rows = await prisma.comic.groupBy({
      by: ["location"],
      _count: { _all: true },
      where: { location: { not: null } },
    });
    const locations = (rows as Array<{ location: string | null; _count: { _all: number } }>)
      .filter((r) => r.location)
      .map((r) => ({ location: r.location as string, count: r._count._all }))
      .sort((a, b) => a.location.localeCompare(b.location));
    res.json({ locations });
  } catch (err) {
    next(err);
  }
});

statsRouter.get("/stats/pnl", async (_req, res, next) => {
  try {
    const sold = await prisma.comic.findMany({
      where: { status: "SOLD" },
      select: {
        id: true, title: true, issueNumber: true,
        soldPrice: true, soldNet: true, soldProfit: true, costBasis: true, soldAt: true,
      },
      orderBy: { soldAt: "desc" },
    });
    const n = (v: unknown): number => (v == null ? 0 : Number(v));
    let revenue = 0, net = 0, cost = 0, profit = 0;
    const monthsMap: Record<string, { units: number; revenue: number; net: number; profit: number }> = {};
    for (const c of sold as Array<{ soldPrice: number | null; soldNet: number | null; soldProfit: number | null; costBasis: number | null; soldAt: Date | string | null }>) {
      revenue += n(c.soldPrice); net += n(c.soldNet); cost += n(c.costBasis); profit += n(c.soldProfit);
      const d = c.soldAt ? new Date(c.soldAt) : null;
      const key = d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` : "unknown";
      const m = (monthsMap[key] ||= { units: 0, revenue: 0, net: 0, profit: 0 });
      m.units += 1; m.revenue += n(c.soldPrice); m.net += n(c.soldNet); m.profit += n(c.soldProfit);
    }
    const months = Object.entries(monthsMap)
      .map(([month, v]) => ({ month, ...v }))
      .sort((a, b) => b.month.localeCompare(a.month));
    const recent = (sold as Array<{ id: string; title: string; issueNumber: string | null; soldPrice: number | null; soldProfit: number | null; soldAt: Date | string | null }>)
      .slice(0, 25)
      .map((c) => ({ id: c.id, title: c.title, issueNumber: c.issueNumber, soldPrice: n(c.soldPrice), soldProfit: n(c.soldProfit), soldAt: c.soldAt }));
    res.json({ unitsSold: sold.length, revenue, net, cost, profit, months, recent });
  } catch (err) {
    next(err);
  }
});
