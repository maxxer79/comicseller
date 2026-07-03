import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

export const settingsRouter = Router();

const DEFAULTS = {
  feePercent: 13.25,
  perOrderFee: 0.4,
  shippingCost: 4.5,
  shippingCharged: 0,
};

/** Fetch (creating the default row if needed). */
async function getOrCreate() {
  return prisma.settings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default", ...DEFAULTS },
  });
}

/** GET /settings — fee + shipping assumptions (any signed-in user). */
settingsRouter.get("/settings", requireAuth, async (_req, res, next) => {
  try {
    res.json(await getOrCreate());
  } catch (err) {
    next(err);
  }
});

/** PATCH /settings — update assumptions (admin only). */
settingsRouter.patch("/settings", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    await getOrCreate();
    const b = req.body ?? {};
    const data: Record<string, number> = {};
    for (const key of ["feePercent", "perOrderFee", "shippingCost", "shippingCharged"] as const) {
      if (typeof b[key] === "number" && Number.isFinite(b[key]) && b[key] >= 0) {
        data[key] = b[key];
      }
    }
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: "No valid numeric fields to update" });
    }
    const updated = await prisma.settings.update({ where: { id: "default" }, data });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});
