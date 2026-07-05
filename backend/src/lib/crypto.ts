import crypto from "node:crypto";
import { config } from "./config.js";

/**
 * Small helper for encrypting secrets (API keys) at rest with AES-256-GCM.
 *
 * The encryption key is derived from config.encSecret (APP_ENC_SECRET, falling
 * back to JWT_SECRET). Ciphertext is stored as "iv:tag:data", all base64.
 * Rotating APP_ENC_SECRET invalidates previously stored keys — they must be
 * re-entered in the admin UI.
 */

const ALGO = "aes-256-gcm";

function encryptionKey(): Buffer {
  // 32-byte key from the configured secret.
  return crypto.createHash("sha256").update(String(config.encSecret)).digest();
}

/** Encrypt a plaintext secret. Returns "iv:tag:ciphertext" (base64 parts). */
export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, encryptionKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(":");
}

/** Decrypt a value produced by encryptSecret. Throws if tampered/invalid. */
export function decryptSecret(enc: string): string {
  const [ivB, tagB, ctB] = enc.split(":");
  if (!ivB || !tagB || !ctB) throw new Error("Malformed ciphertext");
  const decipher = crypto.createDecipheriv(ALGO, encryptionKey(), Buffer.from(ivB, "base64"));
  decipher.setAuthTag(Buffer.from(tagB, "base64"));
  const out = Buffer.concat([decipher.update(Buffer.from(ctB, "base64")), decipher.final()]);
  return out.toString("utf8");
}

/** Best-effort decrypt; returns null instead of throwing (e.g. after secret rotation). */
export function tryDecryptSecret(enc: string | null | undefined): string | null {
  if (!enc) return null;
  try {
    return decryptSecret(enc);
  } catch {
    return null;
  }
}

/** Mask a plaintext secret for display, e.g. "••••••3f9a". */
export function maskSecret(plain: string | null | undefined): string | null {
  if (!plain) return null;
  const last4 = plain.slice(-4);
  return `••••${last4}`;
}
