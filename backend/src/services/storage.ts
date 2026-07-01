import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { config } from "../lib/config.js";

/**
 * Local-disk object storage.
 *
 * Photos are written under STORAGE_DIR and served statically under
 * STORAGE_PUBLIC_PATH. The interface (save/getPath/remove + a `url`) is kept
 * deliberately small so it can be swapped for S3-compatible storage later
 * without touching callers.
 */

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic",
};

export interface SavedFile {
  storageKey: string; // relative key, stored in DB
  url: string; // public URL path the frontend can load
  bytes: number;
  contentType: string;
}

function extForMime(mime: string, fallbackName?: string): string {
  if (EXT_BY_MIME[mime]) return EXT_BY_MIME[mime];
  if (fallbackName) {
    const ext = path.extname(fallbackName);
    if (ext) return ext.toLowerCase();
  }
  return ".bin";
}

/** Absolute directory where files live. */
export function storageRoot(): string {
  return path.resolve(config.storageDir);
}

/** Resolve a storageKey back to an absolute path on disk. */
export function absolutePathFor(storageKey: string): string {
  return path.join(storageRoot(), storageKey);
}

/**
 * Persist an uploaded buffer. Files are grouped in a subfolder so a single
 * directory never holds thousands of entries.
 */
export async function savePhoto(
  buffer: Buffer,
  contentType: string,
  originalName?: string
): Promise<SavedFile> {
  const id = crypto.randomUUID();
  const ext = extForMime(contentType, originalName);
  const subdir = id.slice(0, 2); // shard by first 2 chars
  const storageKey = path.join(subdir, `${id}${ext}`);
  const absPath = absolutePathFor(storageKey);

  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, buffer);

  // Normalize to forward slashes for URLs even on Windows.
  const urlKey = storageKey.split(path.sep).join("/");

  return {
    storageKey: urlKey,
    url: `${config.storagePublicPath}/${urlKey}`,
    bytes: buffer.length,
    contentType,
  };
}

/** Delete a stored file; ignores missing files. */
export async function removePhoto(storageKey: string): Promise<void> {
  try {
    await fs.unlink(absolutePathFor(storageKey));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}
