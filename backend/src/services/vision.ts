import Anthropic from "@anthropic-ai/sdk";
import { config } from "../lib/config.js";

/**
 * Vision identification service.
 *
 * Sends a comic cover photo to Claude and returns STRUCTURED identification
 * plus a *suggested* grade. Per the product decision, this is only a
 * suggestion — the user confirms/overrides before anything is priced or listed.
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

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: config.anthropicApiKey });
  return client;
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

/** Extract the first JSON object from a text blob (defensive parsing). */
function parseJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("Model did not return a JSON object");
  }
  return JSON.parse(text.slice(start, end + 1));
}

export function isVisionConfigured(): boolean {
  return Boolean(config.anthropicApiKey) || config.visionMock;
}

/**
 * Identify a comic from an image buffer.
 * @param imageBase64 base64-encoded image bytes
 * @param mediaType   e.g. "image/jpeg"
 */
export async function identifyComic(
  imageBase64: string,
  mediaType: string
): Promise<IdentificationResult> {
  if (!config.anthropicApiKey) {
    if (config.visionMock) return { ...MOCK_RESULT };
    throw new VisionNotConfiguredError(
      "Vision is not configured. Set ANTHROPIC_API_KEY (or VISION_MOCK=1 to test the flow)."
    );
  }

  const supported = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  const mt = supported.includes(mediaType) ? mediaType : "image/jpeg";

  const message = await getClient().messages.create({
    model: config.visionModel,
    max_tokens: 700,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mt as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
              data: imageBase64,
            },
          },
          { type: "text", text: "Identify this comic and estimate its grade." },
        ],
      },
    ],
  });

  const textPart = message.content.find((c) => c.type === "text");
  const rawText = textPart && "text" in textPart ? textPart.text : "";
  const parsed = parseJsonObject(rawText);
  return coerceResult(parsed, rawText);
}
