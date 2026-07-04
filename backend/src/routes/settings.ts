import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

export const settingsRouter = Router();

const NUM_FIELDS = ["feePercent", "perOrderFee", "shippingCost", "shippingCharged"] as const;
const STR_FIELDS = [
  "ebayCategoryId",
  "ebayConditionId",
  "ebayDuration",
  "ebayShippingProfile",
  "ebayPaymentProfile",
  "ebayReturnProfile",
  "publicBaseUrl",
] as const;

async function getOrCreate() {
  return prisma.settings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });
}

settingsRouter.get("/settings", requireAuth, async (_req, res, next) => {
  try {
    res.json(await getOrCreate());
  } catch (err) {
    next(err);
  }
});

settingsRouter.patch("/settings", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    await getOrCreate();
    const b = req.body ?? {};
    const data: Record<string, number | string> = {};
    for (const key of NUM_FIELDS) {
      if (typeof b[key] === "number" && Number.isFinite(b[key]) && b[key] >= 0) data[key] = b[key];
    }
    for (const key of STR_FIELDS) {
      if (typeof b[key] === "string") data[key] = b[key];
    }
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }
    const updated = await prisma.settings.update({ where: { id: "default" }, data });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});
