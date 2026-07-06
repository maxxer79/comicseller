import { Router } from "express";
import multer from "multer";
import { prisma } from "../lib/prisma.js";
import { savePhoto, removePhoto } from "../services/storage.js";
import {
  identifyComic,
  isVisionConfigured,
  VisionNotConfiguredError,
} from "../services/vision.js";

export const comicsRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

const comicInclude = {
  photos: { orderBy: { createdAt: "asc" } },
  priceSnapshots: { orderBy: { createdAt: "desc" }, take: 1 },
  listing: true,
} as const;

const PHOTO_KINDS = ["FRONT", "BACK", "DETAIL", "SLAB"];

comicsRouter.post("/comics", upload.single("photo"), async (req, res, next) => {
  try {
    const title =
      typeof req.body.title === "string" && req.body.title.trim()
        ? req.body.title.trim()
        : "Untitled";
    const upc =
      typeof req.body.upc === "string" && req.body.upc.trim()
        ? req.body.upc.trim()
        : null;

    const comic = await prisma.comic.create({ data: { title, upc } });

    if (req.file) {
      const saved = await savePhoto(req.file.buffer, req.file.mimetype, req.file.originalname);
      await prisma.photo.create({
        data: {
          comicId: comic.id,
          storageKey: saved.storageKey,
          url: saved.url,
          contentType: saved.contentType,
          bytes: saved.bytes,
          kind: "FRONT",
          isPrimary: true,
        },
      });
    }

    const full = await prisma.comic.findUnique({ where: { id: comic.id }, include: comicInclude });
    res.status(201).json(full);
  } catch (err) {
    next(err);
  }
});

comicsRouter.post("/comics/:id/photos", upload.single("photo"), async (req, res, next) => {
  try {
    const comic = await prisma.comic.findUnique({
      where: { id: req.params.id },
      include: { photos: true },
    });
    if (!comic) return res.status(404).json({ error: "Comic not found" });
    if (!req.file) return res.status(400).json({ error: "No photo uploaded" });

    const kind = PHOTO_KINDS.includes(req.body.kind) ? req.body.kind : "DETAIL";
    const saved = await savePhoto(req.file.buffer, req.file.mimetype, req.file.originalname);
    const photo = await prisma.photo.create({
      data: {
        comicId: comic.id,
        storageKey: saved.storageKey,
        url: saved.url,
        contentType: saved.contentType,
        bytes: saved.bytes,
        kind,
        isPrimary: comic.photos.length === 0,
      },
    });
    res.status(201).json(photo);
  } catch (err) {
    next(err);
  }
});

comicsRouter.patch("/comics/:id/photos/:photoId", async (req, res, next) => {
  try {
    const photo = await prisma.photo.findFirst({
      where: { id: req.params.photoId, comicId: req.params.id },
    });
    if (!photo) return res.status(404).json({ error: "Photo not found" });

    const b = req.body ?? {};
    const data: Record<string, unknown> = {};
    if (typeof b.isPrimary === "boolean") data.isPrimary = b.isPrimary;
    if (typeof b.kind === "string" && PHOTO_KINDS.includes(b.kind)) data.kind = b.kind;

    if (data.isPrimary === true) {
      await prisma.photo.updateMany({ where: { comicId: req.params.id }, data: { isPrimary: false } });
    }
    // Listing options
    if (b.quantity === null || typeof b.quantity === "number") {
      data.quantity = typeof b.quantity === "number" ? Math.max(1, Math.floor(b.quantity)) : 1;
    }
    if (b.freeShipping === null || typeof b.freeShipping === "boolean") data.freeShipping = b.freeShipping;

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }
    const updated = await prisma.photo.update({ where: { id: photo.id }, data });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

comicsRouter.delete("/comics/:id/photos/:photoId", async (req, res, next) => {
  try {
    const photo = await prisma.photo.findFirst({
      where: { id: req.params.photoId, comicId: req.params.id },
    });
    if (!photo) return res.status(404).json({ error: "Photo not found" });

    await removePhoto(photo.storageKey);
    await prisma.photo.delete({ where: { id: photo.id } });

    if (photo.isPrimary) {
      const nextPhoto = await prisma.photo.findFirst({
        where: { comicId: req.params.id },
        orderBy: { createdAt: "asc" },
      });
      if (nextPhoto) {
        await prisma.photo.update({ where: { id: nextPhoto.id }, data: { isPrimary: true } });
      }
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

comicsRouter.post("/comics/:id/identify", async (req, res, next) => {
  try {
    if (!(await isVisionConfigured())) {
      return res.status(503).json({
        error: "Vision not configured. Set ANTHROPIC_API_KEY (or VISION_MOCK=1 to test).",
      });
    }

    const comic = await prisma.comic.findUnique({
      where: { id: req.params.id },
      include: { photos: true },
    });
    if (!comic) return res.status(404).json({ error: "Comic not found" });

    const photo =
      comic.photos.find((p: { isPrimary: boolean }) => p.isPrimary) ?? comic.photos[0];
    if (!photo) return res.status(400).json({ error: "Comic has no photo to identify" });

    const { absolutePathFor } = await import("../services/storage.js");
    const { promises: fs } = await import("node:fs");
    const bytes = await fs.readFile(absolutePathFor(photo.storageKey));
    const base64 = bytes.toString("base64");

    const result = await identifyComic(base64, photo.contentType ?? "image/jpeg");

    const updated = await prisma.comic.update({
      where: { id: comic.id },
      data: {
        title: comic.title === "Untitled" && result.title ? result.title : comic.title,
        issueNumber: comic.issueNumber ?? result.issueNumber,
        publisher: comic.publisher ?? result.publisher,
        variant: comic.variant ?? result.variant,
        year: comic.year ?? result.year,
        keyIssue: comic.keyIssue || result.keyIssue,
        keyNotes: comic.keyNotes ?? result.keyNotes,
        aiSuggestedGrade: result.suggestedGrade,
        status: comic.status === "INTAKE" ? "IDENTIFIED" : comic.status,
      },
      include: comicInclude,
    });

    res.json({ suggestion: result, comic: updated });
  } catch (err) {
    if (err instanceof VisionNotConfiguredError) {
      return res.status(503).json({ error: err.message });
    }
    next(err);
  }
});

comicsRouter.patch("/comics/:id", async (req, res, next) => {
  try {
    const b = req.body ?? {};
    const data: Record<string, unknown> = {};

    if (typeof b.title === "string") data.title = b.title.trim();
    if (b.issueNumber === null || typeof b.issueNumber === "string") data.issueNumber = b.issueNumber;
    if (b.publisher === null || typeof b.publisher === "string") data.publisher = b.publisher;
    if (b.variant === null || typeof b.variant === "string") data.variant = b.variant;
    if (b.upc === null || typeof b.upc === "string") data.upc = b.upc;
    if (b.location === null || typeof b.location === "string") data.location = b.location;
    if (b.costBasis === null || typeof b.costBasis === "number") data.costBasis = b.costBasis;
    if (b.year === null || typeof b.year === "number") data.year = b.year;
    if (typeof b.keyIssue === "boolean") data.keyIssue = b.keyIssue;
    if (b.keyNotes === null || typeof b.keyNotes === "string") data.keyNotes = b.keyNotes;
    if (typeof b.graded === "boolean") data.graded = b.graded;
    if (b.gradingCompany === null || typeof b.gradingCompany === "string") data.gradingCompany = b.gradingCompany;
    if (b.condition === null || typeof b.condition === "string") data.condition = b.condition;

    if (b.grade === null || typeof b.grade === "number") {
      if (typeof b.grade === "number" && (b.grade < 0.5 || b.grade > 10)) {
        return res.status(400).json({ error: "grade must be between 0.5 and 10.0" });
      }
      data.grade = b.grade;
      if (typeof b.grade === "number") data.status = "IDENTIFIED";
    }

    if (typeof b.status === "string") data.status = b.status;

    // Watchlist ("let it cook")
    if (typeof b.watching === "boolean") data.watching = b.watching;
    if (b.holdUntil === null || typeof b.holdUntil === "string") {
      data.holdUntil = b.holdUntil ? new Date(b.holdUntil) : null;
    }
    if (b.targetPrice === null || typeof b.targetPrice === "number") data.targetPrice = b.targetPrice;
    if (b.watchNote === null || typeof b.watchNote === "string") data.watchNote = b.watchNote;

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    const comic = await prisma.comic.update({
      where: { id: req.params.id },
      data,
      include: comicInclude,
    });
    res.json(comic);
  } catch (err) {
    if ((err as { code?: string }).code === "P2025") {
      return res.status(404).json({ error: "Comic not found" });
    }
    next(err);
  }
});

comicsRouter.post("/comics/:id/sell", async (req, res, next) => {
  try {
    const comic = await prisma.comic.findUnique({ where: { id: req.params.id } });
    if (!comic) return res.status(404).json({ error: "Comic not found" });

    const b = req.body ?? {};
    const soldPrice = Number(b.soldPrice);
    if (!Number.isFinite(soldPrice) || soldPrice < 0) {
      return res.status(400).json({ error: "soldPrice (number) is required" });
    }
    const settings = await prisma.settings.upsert({
      where: { id: "default" },
      update: {},
      create: { id: "default" },
    });
    const shippingCharged = Number.isFinite(Number(b.shippingCharged))
      ? Number(b.shippingCharged)
      : settings.shippingCharged;
    const shippingCost = Number.isFinite(Number(b.shippingCost))
      ? Number(b.shippingCost)
      : settings.shippingCost;
    const costBasis = Number.isFinite(Number(b.costBasis))
      ? Number(b.costBasis)
      : comic.costBasis ?? 0;

    const gross = soldPrice + shippingCharged;
    const fee = gross * (settings.feePercent / 100) + settings.perOrderFee;
    const soldNet = Math.round((gross - fee - shippingCost) * 100) / 100;
    const soldProfit = Math.round((soldNet - costBasis) * 100) / 100;
    const soldAt = b.soldAt ? new Date(b.soldAt) : new Date();

    const updated = await prisma.comic.update({
      where: { id: comic.id },
      data: { soldPrice, soldNet, soldProfit, soldAt, costBasis, status: "SOLD" },
      include: comicInclude,
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

comicsRouter.post("/comics/:id/unsell", async (req, res, next) => {
  try {
    const comic = await prisma.comic.update({
      where: { id: req.params.id },
      data: { soldPrice: null, soldNet: null, soldProfit: null, soldAt: null, status: "READY" },
      include: comicInclude,
    });
    res.json(comic);
  } catch (err) {
    if ((err as { code?: string }).code === "P2025") {
      return res.status(404).json({ error: "Comic not found" });
    }
    next(err);
  }
});

const BULK_STATUSES = ["INTAKE", "IDENTIFIED", "PRICED", "READY", "LISTED", "SOLD", "ARCHIVED"];

/** POST /comics/bulk — set status and/or location on many comics at once. */
comicsRouter.post("/comics/bulk", async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids.filter((x: unknown): x is string => typeof x === "string")
      : [];
    if (ids.length === 0) return res.status(400).json({ error: "No ids provided" });

    const set = req.body?.set ?? {};
    const data: Record<string, unknown> = {};
    if (set.location === null || typeof set.location === "string") data.location = set.location;
    if (typeof set.status === "string" && BULK_STATUSES.includes(set.status)) data.status = set.status;
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: "Nothing to set (status or location)" });
    }
    const result = await prisma.comic.updateMany({
      where: { id: { in: ids } },
      data: data as never,
    });
    res.json({ updated: result.count });
  } catch (err) {
    next(err);
  }
});

/** POST /comics/bulk-delete — delete many comics and their photo files. */
comicsRouter.post("/comics/bulk-delete", async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids.filter((x: unknown): x is string => typeof x === "string")
      : [];
    if (ids.length === 0) return res.status(400).json({ error: "No ids provided" });

    const photos = await prisma.photo.findMany({ where: { comicId: { in: ids } } });
    await Promise.all(
      photos.map((p: { storageKey: string }) => removePhoto(p.storageKey))
    );
    const result = await prisma.comic.deleteMany({ where: { id: { in: ids } } });
    res.json({ deleted: result.count });
  } catch (err) {
    next(err);
  }
});

comicsRouter.get("/comics", async (req, res, next) => {
  try {
    const take = Math.min(Number(req.query.limit ?? 50), 200);
    const skip = Math.max(Number(req.query.offset ?? 0), 0);
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const upc = typeof req.query.upc === "string" ? req.query.upc : undefined;
    const location = typeof req.query.location === "string" ? req.query.location : undefined;
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const watching = req.query.watching === "true";

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (upc) where.upc = upc;
    if (location) where.location = location;
    if (watching) where.watching = true;
    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { issueNumber: { contains: q, mode: "insensitive" } },
        { publisher: { contains: q, mode: "insensitive" } },
        { variant: { contains: q, mode: "insensitive" } },
        { keyNotes: { contains: q, mode: "insensitive" } },
        { location: { contains: q, mode: "insensitive" } },
        { upc: { contains: q } },
        { sku: { contains: q } },
      ];
    }
    const [items, total] = await Promise.all([
      prisma.comic.findMany({
        where: where as never,
        include: comicInclude,
        orderBy: { updatedAt: "desc" },
        take,
        skip,
      }),
      prisma.comic.count({ where: where as never }),
    ]);
    res.json({ total, items });
  } catch (err) {
    next(err);
  }
});

comicsRouter.get("/comics/:id", async (req, res, next) => {
  try {
    const comic = await prisma.comic.findUnique({
      where: { id: req.params.id },
      include: comicInclude,
    });
    if (!comic) return res.status(404).json({ error: "Comic not found" });
    res.json(comic);
  } catch (err) {
    next(err);
  }
});

comicsRouter.delete("/comics/:id", async (req, res, next) => {
  try {
    const comic = await prisma.comic.findUnique({
      where: { id: req.params.id },
      include: { photos: true },
    });
    if (!comic) return res.status(404).json({ error: "Comic not found" });

    await Promise.all(comic.photos.map((p: { storageKey: string }) => removePhoto(p.storageKey)));
    await prisma.comic.delete({ where: { id: comic.id } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

/** POST /comics/:id/duplicate — clone identification into a new INTAKE copy. */
comicsRouter.post("/comics/:id/duplicate", async (req, res, next) => {
  try {
    const src = await prisma.comic.findUnique({ where: { id: req.params.id } });
    if (!src) return res.status(404).json({ error: "Comic not found" });
    const copy = await prisma.comic.create({
      data: {
        title: src.title,
        issueNumber: src.issueNumber,
        publisher: src.publisher,
        variant: src.variant,
        year: src.year,
        upc: src.upc,
        keyIssue: src.keyIssue,
        keyNotes: src.keyNotes,
        location: src.location,
        status: "INTAKE",
      },
    });
    const full = await prisma.comic.findUnique({ where: { id: copy.id }, include: comicInclude });
    res.status(201).json(full);
  } catch (err) {
    next(err);
  }
});

/** GET /comics/:id/copies — other records of the same title + issue. */
comicsRouter.get("/comics/:id/copies", async (req, res, next) => {
  try {
    const comic = await prisma.comic.findUnique({ where: { id: req.params.id } });
    if (!comic) return res.status(404).json({ error: "Comic not found" });
    const items = await prisma.comic.findMany({
      where: { id: { not: comic.id }, title: comic.title, issueNumber: comic.issueNumber },
      select: { id: true, sku: true, grade: true, status: true, recommendedPrice: true },
      orderBy: { createdAt: "asc" },
    });
    res.json({ count: items.length, items });
  } catch (err) {
    next(err);
  }
});
