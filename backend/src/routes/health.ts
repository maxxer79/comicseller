import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const healthRouter = Router();

/**
 * Liveness + DB readiness check.
 * Returns 200 with db:"up" when Postgres is reachable, 503 otherwise.
 */
healthRouter.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", db: "up" });
  } catch (err) {
    res.status(503).json({
      status: "degraded",
      db: "down",
      error: err instanceof Error ? err.message : "unknown error",
    });
  }
});
