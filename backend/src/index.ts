import express from "express";
import cors from "cors";
import path from "node:path";
import { config } from "./lib/config.js";
import { healthRouter } from "./routes/health.js";
import { comicsRouter } from "./routes/comics.js";
import { pricingRouter } from "./routes/pricing.js";
import { authRouter } from "./routes/auth.js";
import { adminRouter } from "./routes/admin.js";
import { lookupRouter } from "./routes/lookup.js";
import { statsRouter } from "./routes/stats.js";
import { settingsRouter } from "./routes/settings.js";
import { requireAuth } from "./middleware/auth.js";
import { seedAdmin } from "./services/auth.js";
import { storageRoot } from "./services/storage.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use(config.storagePublicPath, express.static(storageRoot()));

app.use("/", healthRouter);
app.use("/", authRouter);
app.use("/", adminRouter);

app.use("/comics", requireAuth);
app.use("/import", requireAuth);
app.use("/lookup", requireAuth);
app.use("/stats", requireAuth);
app.use("/", comicsRouter);
app.use("/", pricingRouter);
app.use("/", lookupRouter);
app.use("/", statsRouter);
app.use("/", settingsRouter);

if (config.serveFrontend) {
  const frontendDir = path.resolve(process.cwd(), config.frontendDir);
  app.use(express.static(frontendDir));
  app.get("*", (req, res, next) => {
    if (
      req.path.startsWith("/comics") ||
      req.path.startsWith("/import") ||
      req.path.startsWith("/lookup") ||
      req.path.startsWith("/stats") ||
      req.path.startsWith("/settings") ||
      req.path.startsWith("/auth") ||
      req.path.startsWith("/admin") ||
      req.path.startsWith("/photos") ||
      req.path.startsWith("/health") ||
      req.path.startsWith("/version")
    ) {
      return next();
    }
    res.sendFile(path.join(frontendDir, "index.html"));
  });
} else {
  app.get("/", (_req, res) => {
    res.json({ name: "Comicseller API", version: "0.2.9" });
  });
}

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(err);
    res.status(500).json({
      error: "Internal server error",
      detail: err instanceof Error ? err.message : undefined,
    });
  }
);

async function start() {
  await seedAdmin();
  app.listen(config.port, () => {
    console.log(
      `Comicseller API listening on http://localhost:${config.port} (${config.nodeEnv})`
    );
  });
}

start().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
