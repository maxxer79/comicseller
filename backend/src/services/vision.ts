import Anthropic from "@anthropic-ai/sdk";
import { resolveAiConfig, type ResolvedAiConfig, type AiProvider } from "../lib/aiConfig.js";

/**
 * Vision identification service (multi-provider).
 *
 * Identifies a comic cover (and suggests a grade) OR detects multiple covers
 * in a single photo. The active provider — Anthropic (Claude), Google (Gemini),
 * or xAI (Grok) — plus its API key and model are resolved at call time from the
 * admin AI settings (see lib/aiConfig.ts). Grading is always a *suggestion*;
 * the user confirms before anything is priced or listed.
 */

export interface IdentificationResult {
  title: string | null;
  issueNumber: string | null;
  publisher: string | null;
  variant: string | null;
  year: number | null;
  keyIssue: boolean;
  keyNotes: string | null;
  suggestedGrade: number | null; // 0.5 - 10.0
  gradeRationale: string | null;
  confidence: number; // 0..1 model's self-reported confidence in the ID
  rawModelText?: string; // kept for auditing
}

/** Thrown when identification can't run (e.g. no API key configured). */
export class VisionNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VisionNotConfiguredError";
  }
}

const SYSTEM_PROMPT = `You are a comic book cataloguing assistant. Given a photo of a comic book cover, identify it as precisely as you can and estimate its condition on the 10-point CGC scale (0.5=Poor, 2.0=Good, 4.0=Very Good, 6.0=Fine, 8.0=Very Fine, 9.0-9.2=Near Mint-, 9.4-9.8=Near Mint/Mint).

Grading from a single photo is imprecise: judge only what is visible (spine wear, corners, creases, gloss, color break, staining). When unsure, grade conservatively and lower your confidence.

Respond with ONLY a JSON object, no prose, matching exactly:
{
  "title": string|null,
  "issueNumber": string|null,
  "publisher": string|null,
  "variant": string|null,
  "year": number|null,
  "keyIssue": boolean,
  "keyNotes": string|null,
  "suggestedGrade": number|null,
  "gradeRationale": string|null,
  "confidence": number
}
- keyIssue: true if this is a notable key (first appearance, death, major event, iconic cover).
- keyNotes: short reason it's a key, else null.
- confidence: 0..1, your confidence in the identification (not the grade).
Use null for anything you genuinely cannot determine. Do not guess a specific issue number if it is not visible.`;

const DETECT_SYSTEM_PROMPT = `You are a comic book intake assistant. You are given ONE photo showing multiple comic books laid out flat on a surface (floor, table, or bed), roughly in a grid and NOT overlapping.

Your job is to locate every individual comic cover in the photo and return a bounding box for each. Do not grade or deeply catalogue them — just locate each cover and read the title/publisher only if clearly legible.

Respond with ONLY a JSON array, no prose. Each element must match exactly:
{
  "box": { "x": number, "y": number, "w": number, "h": number },
  "title": string|null,
  "publisher": string|null,
  "confidence": number
}
- box coordinates are FRACTIONS of the image dimensions (0.0 to 1.0), with x,y = top-left corner of the cover and w,h = its width/height. x+w and y+h must not exceed 1.0.
- Give a generous box that fully contains the cover, but do not overlap neighboring comics.
- title/publisher: only if clearly readable, else null. Do not guess.
- confidence: 0..1 that this is a distinct, fully-visible comic cover.
- Order boxes top-to-bottom, then left-to-right (reading order).
- If you see no comics, return [].`;

const MOCK_RESULT: IdentificationResult = {
  title: "Sample Comic (mock)",
  issueNumber: "1",
  publisher: "Mock Comics",
  variant: null,
  year: 1990,
  keyIssue: false,
  keyNotes: null,
  suggestedGrade: 8.0,
  gradeRationale: "Mock result — VISION_MOCK is enabled and no API key is set.",
  confidence: 0.5,
};

/** A single comic located within a larger photo. Box is normalized 0..1. */
export interface DetectedComic {
  box: { x: number; y: number; w: number; h: number };
  title: string | null;
  publisher: string | null;
  confidence: number;
}

const MOCK_DETECT: DetectedComic[] = [
  { box: { x: 0.03, y: 0.04, w: 0.44, h: 0.44 }, title: "Sample Comic A (mock)", publisher: "Mock Comics", confidence: 0.9 },
  { box: { x: 0.53, y: 0.04, w: 0.44, h: 0.44 }, title: "Sample Comic B (mock)", publisher: "Mock Comics", confidence: 0.88 },
  { box: { x: 0.03, y: 0.52, w: 0.44, h: 0.44 }, title: null, publisher: null, confidence: 0.7 },
  { box: { x: 0.53, y: 0.52, w: 0.44, h: 0.44 }, title: null, publisher: null, confidence: 0.66 },
];

// --------------------------------------------------------------------------
// Parsing helpers
// --------------------------------------------------------------------------

function parseJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("Model did not return a JSON object");
  }
  return JSON.parse(text.slice(start, end + 1));
}

function parseJsonArray(text: string): unknown {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("Model did not return a JSON array");
  }
  return JSON.parse(text.slice(start, end + 1));
}

function coerceResult(parsed: unknown, rawText: string): IdentificationResult {
  const p = (parsed ?? {}) as Record<string, unknown>;
  const num = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  const str = (v: unknown): string | null =>
    typeof v === "string" && v.trim() !== "" ? v.trim() : null;

  let grade = num(p.suggestedGrade);
  if (grade !== null) grade = Math.min(10, Math.max(0.5, grade));

  let confidence = num(p.confidence) ?? 0;
  confidence = Math.min(1, Math.max(0, confidence));

  return {
    title: str(p.title),
    issueNumber: str(p.issueNumber),
    publisher: str(p.publisher),
    variant: str(p.variant),
    year: num(p.year),
    keyIssue: p.keyIssue === true,
    keyNotes: str(p.keyNotes),
    suggestedGrade: grade,
    gradeRationale: str(p.gradeRationale),
    confidence,
    rawModelText: rawText,
  };
}

function coerceDetection(item: unknown): DetectedComic | null {
  const p = (item ?? {}) as Record<string, unknown>;
  const box = (p.box ?? {}) as Record<string, unknown>;
  const frac = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : null;

  const x = frac(box.x);
  const y = frac(box.y);
  let w = frac(box.w);
  let h = frac(box.h);
  if (x === null || y === null || w === null || h === null) return null;

  w = Math.min(w, 1 - x);
  h = Math.min(h, 1 - y);
  if (w < 0.03 || h < 0.03) return null;

  const str = (v: unknown): string | null =>
    typeof v === "string" && v.trim() !== "" ? v.trim() : null;
  let confidence = typeof p.confidence === "number" ? p.confidence : 0.5;
  confidence = Math.min(1, Math.max(0, confidence));

  return { box: { x, y, w, h }, title: str(p.title), publisher: str(p.publisher), confidence };
}

// --------------------------------------------------------------------------
// Provider dispatch — returns the raw model text for a system+image+prompt.
// --------------------------------------------------------------------------

const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
function safeMediaType(mt: string): string {
  return SUPPORTED_IMAGE_TYPES.includes(mt) ? mt : "image/jpeg";
}

async function callAnthropic(
  cfg: ResolvedAiConfig,
  system: string,
  userText: string,
  base64: string,
  mediaType: string,
  maxTokens: number
): Promise<string> {
  const client = new Anthropic({ apiKey: cfg.apiKey });
  const mt = safeMediaType(mediaType);
  const message = await client.messages.create({
    model: cfg.model,
    max_tokens: maxTokens,
    system,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mt as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
              data: base64,
            },
          },
          { type: "text", text: userText },
        ],
      },
    ],
  });
  const textPart = message.content.find((c) => c.type === "text");
  return textPart && "text" in textPart ? textPart.text : "";
}

async function callGemini(
  cfg: ResolvedAiConfig,
  system: string,
  userText: string,
  base64: string,
  mediaType: string,
  maxTokens: number
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    cfg.model
  )}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;
  const body = {
    system_instruction: { parts: [{ text: system }] },
    contents: [
      {
        role: "user",
        parts: [
          { inline_data: { mime_type: safeMediaType(mediaType), data: base64 } },
          { text: userText },
        ],
      },
    ],
    generationConfig: { maxOutputTokens: maxTokens, temperature: 0 },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Gemini API error ${res.status}: ${t.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const parts = json.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p) => p.text ?? "").join("");
}

async function callGrok(
  cfg: ResolvedAiConfig,
  system: string,
  userText: string,
  base64: string,
  mediaType: string,
  maxTokens: number
): Promise<string> {
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: maxTokens,
      temperature: 0,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            {
              type: "image_url",
              image_url: { url: `data:${safeMediaType(mediaType)};base64,${base64}` },
            },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Grok API error ${res.status}: ${t.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return json.choices?.[0]?.message?.content ?? "";
}

async function runVision(
  cfg: ResolvedAiConfig,
  system: string,
  userText: string,
  base64: string,
  mediaType: string,
  maxTokens: number
): Promise<string> {
  const dispatch: Record<AiProvider, typeof callAnthropic> = {
    anthropic: callAnthropic,
    gemini: callGemini,
    grok: callGrok,
  };
  return dispatch[cfg.provider](cfg, system, userText, base64, mediaType, maxTokens);
}

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------

/** True if a call can succeed right now (mock, or the active provider has a key). */
export async function isVisionConfigured(): Promise<boolean> {
  const cfg = await resolveAiConfig();
  return cfg.mock || Boolean(cfg.apiKey);
}

function requireKey(cfg: ResolvedAiConfig): void {
  if (!cfg.apiKey) {
    throw new VisionNotConfiguredError(
      `No API key set for the active provider (${cfg.provider}). Add one under Admin → AI (or set VISION_MOCK=1 to test).`
    );
  }
}

/** Identify a single comic from an image. */
export async function identifyComic(
  imageBase64: string,
  mediaType: string
): Promise<IdentificationResult> {
  const cfg = await resolveAiConfig();
  if (cfg.mock) return { ...MOCK_RESULT };
  requireKey(cfg);

  const rawText = await runVision(
    cfg,
    SYSTEM_PROMPT,
    "Identify this comic and estimate its grade.",
    imageBase64,
    mediaType,
    700
  );
  const parsed = parseJsonObject(rawText);
  return coerceResult(parsed, rawText);
}

/** Detect multiple comics within a single photo. */
export async function detectComics(
  imageBase64: string,
  mediaType: string
): Promise<DetectedComic[]> {
  const cfg = await resolveAiConfig();
  if (cfg.mock) return MOCK_DETECT.map((d) => ({ ...d, box: { ...d.box } }));
  requireKey(cfg);

  const rawText = await runVision(
    cfg,
    DETECT_SYSTEM_PROMPT,
    "Locate every comic cover in this photo and return their bounding boxes.",
    imageBase64,
    mediaType,
    1500
  );
  const parsed = parseJsonArray(rawText);
  if (!Array.isArray(parsed)) return [];
  return parsed.map(coerceDetection).filter((d): d is DetectedComic => d !== null);
}

// --------------------------------------------------------------------------
// Connectivity test — a tiny text-only call to verify the active provider key.
// --------------------------------------------------------------------------

export interface ProviderTestResult {
  provider: AiProvider;
  model: string;
  ok: boolean;
  detail?: string;
}

export async function testActiveProvider(): Promise<ProviderTestResult> {
  const cfg = await resolveAiConfig();
  if (cfg.mock) {
    return { provider: cfg.provider, model: cfg.model, ok: true, detail: "VISION_MOCK enabled" };
  }
  if (!cfg.apiKey) {
    return { provider: cfg.provider, model: cfg.model, ok: false, detail: "No API key set" };
  }
  try {
    if (cfg.provider === "anthropic") {
      const client = new Anthropic({ apiKey: cfg.apiKey });
      await client.messages.create({
        model: cfg.model,
        max_tokens: 5,
        messages: [{ role: "user", content: "Reply with OK." }],
      });
    } else if (cfg.provider === "gemini") {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        cfg.model
      )}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "Reply with OK." }] }],
          generationConfig: { maxOutputTokens: 5 },
        }),
      });
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 200)}`);
    } else {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
        body: JSON.stringify({
          model: cfg.model,
          max_tokens: 5,
          messages: [{ role: "user", content: "Reply with OK." }],
        }),
      });
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    return { provider: cfg.provider, model: cfg.model, ok: true };
  } catch (err) {
    return {
      provider: cfg.provider,
      model: cfg.model,
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}
