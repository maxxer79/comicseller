import { Router } from "express";
import { lookupByUpc, gcdIssueCount } from "../services/upcLookup.js";
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
