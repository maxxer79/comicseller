import { prisma } from "./prisma.js";
import { config } from "./config.js";
import { tryDecryptSecret, maskSecret } from "./crypto.js";

/** Supported AI providers for comic vision. */
export type AiProvider = "anthropic" | "gemini" | "grok";
export const AI_PROVIDERS: AiProvider[] = ["anthropic", "gemini", "grok"];

export const PROVIDER_LABELS: Record<AiProvider, string> = {
  anthropic: "Anthropic (Claude)",
  gemini: "Google (Gemini)",
  grok: "xAI (Grok)",
};

export const DEFAULT_MODELS: Record<AiProvider, string> = {
  anthropic: "claude-sonnet-4-5",
  gemini: "gemini-2.0-flash",
  grok: "grok-2-vision-1212",
};

/** Loose view of the settings row incl. the AI fields (client types may lag a migration). */
export interface AiSettingsRow {
  aiProvider?: string | null;
  anthropicKeyEnc?: string | null;
  geminiKeyEnc?: string | null;
  grokKeyEnc?: string | null;
  anthropicModel?: string | null;
  geminiModel?: string | null;
  grokModel?: string | null;
}

export interface ResolvedAiConfig {
  provider: AiProvider;
  apiKey: string;
  model: string;
  mock: boolean;
}

function normalizeProvider(v: unknown): AiProvider {
  return v === "gemini" || v === "grok" ? v : "anthropic";
}

async function loadSettingsRow(): Promise<AiSettingsRow | null> {
  // Cast: the generated Prisma client may predate the AI columns migration.
  const row = await prisma.settings.findUnique({ where: { id: "default" } });
  return (row as AiSettingsRow | null) ?? null;
}

function envFallbackKey(provider: AiProvider): string {
  if (provider === "anthropic") return config.anthropicApiKey;
  if (provider === "gemini") return config.geminiApiKey;
  return config.grokApiKey;
}

function defaultModel(provider: AiProvider): string {
  if (provider === "anthropic") return config.visionModel || DEFAULT_MODELS.anthropic;
  return DEFAULT_MODELS[provider];
}

/** Resolve the active provider, its (decrypted) key and model. */
export async function resolveAiConfig(): Promise<ResolvedAiConfig> {
  if (config.visionMock) {
    return { provider: "anthropic", apiKey: "", model: defaultModel("anthropic"), mock: true };
  }

  const row = await loadSettingsRow();
  const provider = normalizeProvider(row?.aiProvider);

  const encByProvider: Record<AiProvider, string | null | undefined> = {
    anthropic: row?.anthropicKeyEnc,
    gemini: row?.geminiKeyEnc,
    grok: row?.grokKeyEnc,
  };
  const modelByProvider: Record<AiProvider, string | null | undefined> = {
    anthropic: row?.anthropicModel,
    gemini: row?.geminiModel,
    grok: row?.grokModel,
  };

  const apiKey = tryDecryptSecret(encByProvider[provider]) || envFallbackKey(provider);
  const model = (modelByProvider[provider] || "").trim() || defaultModel(provider);
  return { provider, apiKey, model, mock: false };
}

/** Per-provider status for the admin UI (never returns raw keys). */
export interface ProviderStatus {
  configured: boolean;
  maskedKey: string | null;
  model: string;
  fromEnv: boolean;
}
export interface AiStatus {
  provider: AiProvider;
  mock: boolean;
  providers: Record<AiProvider, ProviderStatus>;
}

export async function aiStatus(): Promise<AiStatus> {
  const row = await loadSettingsRow();
  const provider = normalizeProvider(row?.aiProvider);
  const enc: Record<AiProvider, string | null | undefined> = {
    anthropic: row?.anthropicKeyEnc,
    gemini: row?.geminiKeyEnc,
    grok: row?.grokKeyEnc,
  };
  const models: Record<AiProvider, string | null | undefined> = {
    anthropic: row?.anthropicModel,
    gemini: row?.geminiModel,
    grok: row?.grokModel,
  };
  const build = (p: AiProvider): ProviderStatus => {
    const dbKey = tryDecryptSecret(enc[p]);
    const envKey = envFallbackKey(p);
    const effective = dbKey || envKey;
    return {
      configured: Boolean(effective),
      maskedKey: maskSecret(effective),
      model: (models[p] || "").trim() || defaultModel(p),
      fromEnv: !dbKey && Boolean(envKey),
    };
  };
  return {
    provider,
    mock: config.visionMock,
    providers: { anthropic: build("anthropic"), gemini: build("gemini"), grok: build("grok") },
  };
}
