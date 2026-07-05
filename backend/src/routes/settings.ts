import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { encryptSecret } from "../lib/crypto.js";
import { aiStatus, AI_PROVIDERS, type AiProvider } from "../lib/aiConfig.js";
import { testActiveProvider } from "../services/vision.js";

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

const MODEL_FIELDS = ["anthropicModel", "geminiModel", "grokModel"] as const;
// admin submits plaintext keys under these names; we encrypt into *KeyEnc columns
const KEY_FIELD_MAP: Record<string, string> = {
  anthropicKey: "anthropicKeyEnc",
  geminiKey: "geminiKeyEnc",
  grokKey: "grokKeyEnc",
};

async function getOrCreate() {
  return prisma.settings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });
}

function isProvider(v: unknown): v is AiProvider {
  return typeof v === "string" && (AI_PROVIDERS as string[]).includes(v);
}

/** Settings for the client — strips encrypted keys, adds masked AI status. */
async function serialize() {
  const s = (await getOrCreate()) as Record<string, unknown>;
  const rest = { ...s };
  delete rest.anthropicKeyEnc;
  delete rest.geminiKeyEnc;
  delete rest.grokKeyEnc;
  const ai = await aiStatus();
  return { ...rest, ai };
}

settingsRouter.get("/settings", requireAuth, async (_req, res, next) => {
  try {
    res.json(await serialize());
  } catch (err) {
    next(err);
  }
});

settingsRouter.patch("/settings", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    await getOrCreate();
    const b = (req.body ?? {}) as Record<string, unknown>;
    const data: Record<string, unknown> = {};

    for (const key of NUM_FIELDS) {
      if (typeof b[key] === "number" && Number.isFinite(b[key]) && (b[key] as number) >= 0) {
        data[key] = b[key];
      }
    }
    for (const key of STR_FIELDS) {
      if (typeof b[key] === "string") data[key] = b[key];
    }

    // AI provider selection + models
    if (isProvider(b.aiProvider)) data.aiProvider = b.aiProvider;
    for (const key of MODEL_FIELDS) {
      if (typeof b[key] === "string" && (b[key] as string).trim()) data[key] = (b[key] as string).trim();
    }

    // API keys: empty string clears; any other string is encrypted and stored
    for (const [plainField, encField] of Object.entries(KEY_FIELD_MAP)) {
      const val = b[plainField];
      if (typeof val === "string") {
        const trimmed = val.trim();
        data[encField] = trimmed === "" ? null : encryptSecret(trimmed);
      }
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    await prisma.settings.update({ where: { id: "default" }, data: data as never });
    res.json(await serialize());
  } catch (err) {
    next(err);
  }
});

/** Run a tiny live call against the active provider to verify the key works. */
settingsRouter.post("/settings/ai/test", requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    res.json(await testActiveProvider());
  } catch (err) {
    next(err);
  }
});
