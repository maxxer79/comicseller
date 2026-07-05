import { Router } from "express";
import multer from "multer";
import sharp from "sharp";
import { prisma } from "../lib/prisma.js";
import { savePhoto } from "../services/storage.js";
import {
  detectComics,
  isVisionConfigured,
  VisionNotConfiguredError,
  type DetectedComic,
} from "../services/vision.js";

/**
 * Batch intake — "a bunch of comics on the floor".
 *
 * One photo of several comics laid out flat -> detect each cover -> crop it
 * into its own image -> create one Comic (status INTAKE) per crop. Each new
 * comic then flows through the existing identify -> price -> sell/hold
 * pipeline exactly like a single-photo intake.
 */
export const batchDetectRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // floor photos can be large
});

const batchInclude = {
  photos: { orderBy: { createdAt: "asc" } },
} as const;

function pxRect(
  box: DetectedComic["box"],
  width: number,
  height: number
): { left: number; top: number; width: number; height: number } | null {
  const left = Math.round(box.x * width);
  const top = Math.round(box.y * height);
  let w = Math.round(box.w * width);
  let h = Math.round(box.h * height);
  // Keep the crop fully inside the image.
  w = Math.min(w, width - left);
  h = Math.min(h, height - top);
  if (w < 8 || h < 8 || left < 0 || top < 0) return null;
  return { left, top, width: w, height: h };
}

batchDetectRouter.post(
  "/comics/batch-detect",
  upload.single("photo"),
  async (req, res, next) => {
    try {
      if (!(await isVisionConfigured())) {
        return res.status(503).json({
          error:
            "Vision not configured. Set ANTHROPIC_API_KEY (or VISION_MOCK=1 to test).",
        });
      }
      if (!req.file) {
        return res.status(400).json({ error: "No photo uploaded" });
      }

      // Normalize orientation once so bounding-box math matches the pixels.
      const normalized = await sharp(req.file.buffer).rotate().jpeg().toBuffer();
      const meta = await sharp(normalized).metadata();
      const width = meta.width ?? 0;
      const height = meta.height ?? 0;
      if (!width || !height) {
        return res.status(400).json({ error: "Could not read image dimensions" });
      }

      // Save the original floor photo for reference in the review UI.
      const original = await savePhoto(normalized, "image/jpeg", "floor.jpg");

      const detections = await detectComics(
        normalized.toString("base64"),
        "image/jpeg"
      );

      const created: Array<{
        comic: unknown;
        detection: DetectedComic;
        cropUrl: string;
      }> = [];

      for (const det of detections) {
        const rect = pxRect(det.box, width, height);
        if (!rect) continue;

        const cropBuffer = await sharp(normalized)
          .extract(rect)
          .jpeg({ quality: 90 })
          .toBuffer();
        const cropFile = await savePhoto(cropBuffer, "image/jpeg", "cover.jpg");

        const comic = await prisma.comic.create({
          data: {
            title: det.title ?? "Untitled",
            publisher: det.publisher ?? undefined,
            status: "INTAKE",
          },
        });
        await prisma.photo.create({
          data: {
            comicId: comic.id,
            storageKey: cropFile.storageKey,
            url: cropFile.url,
            contentType: cropFile.contentType,
            bytes: cropFile.bytes,
            kind: "FRONT",
            isPrimary: true,
          },
        });

        const full = await prisma.comic.findUnique({
          where: { id: comic.id },
          include: batchInclude,
        });
        created.push({ comic: full, detection: det, cropUrl: cropFile.url });
      }

      res.status(201).json({
        originalUrl: original.url,
        width,
        height,
        detected: detections.length,
        created: created.length,
        comics: created,
      });
    } catch (err) {
      if (err instanceof VisionNotConfiguredError) {
        return res.status(503).json({ error: err.message });
      }
      next(err);
    }
  }
);
