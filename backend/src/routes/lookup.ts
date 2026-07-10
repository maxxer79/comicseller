import { Router } from "express";
import { lookupByUpc, gcdIssueCount, searchByTitle } from "../services/upcLookup.js";
import { gcdStatus } from "../services/gcdImport.js";

export const lookupRouter = Router();

/**
 * GET /lookup/upc/:upc
 * Resolve a scanned barcode to comic metadata via the local GCD table.
 * Returns { found, match, candidates, source, datasetSize }.
 */
lookupRouter.get("/lookup/upc/:upc", async (req, res, next) => {
  try {
    const result = await lookupByUpc(req.params.upc);
    const datasetSize = await gcdIssueCount();
    res.json({ ...result, datasetSize });
  } catch (err) {
    next(err);
  }
});

/** GET /lookup/status — whether the GCD dataset is loaded. */
lookupRouter.get("/lookup/status", async (_req, res, next) => {
  try {
    const st = await gcdStatus();
    res.json({ ...st, ready: st.datasetSize > 0 });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /lookup/title?series=...&number=...&year=YYYY
 * Ranked GCD candidates for a title/issue (non-barcode books).
 */
lookupRouter.get("/lookup/title", async (req, res, next) => {
  try {
    const series = typeof req.query.series === "string" ? req.query.series : "";
    const number = typeof req.query.number === "string" ? req.query.number : undefined;
    const year =
      typeof req.query.year === "string" && /^\d{4}$/.test(req.query.year)
        ? Number(req.query.year)
        : undefined;
    const items = await searchByTitle(series, number, year);
    res.json({ count: items.length, items });
  } catch (err) {
    next(err);
  }
});
