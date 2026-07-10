export type ComicStatus =
  | "INTAKE" | "IDENTIFIED" | "PRICED" | "READY" | "LISTED" | "SOLD" | "ARCHIVED";
export type ListingFormat = "AUCTION" | "BUY_IT_NOW";
export type SellAction = "SELL_NOW" | "HOLD";
export type Trend = "RISING" | "FLAT" | "FALLING" | "UNKNOWN";
export type Role = "ADMIN" | "USER";

export interface Photo {
  id: string; url: string | null; storageKey: string;
  kind: "FRONT" | "BACK" | "DETAIL" | "SLAB"; isPrimary: boolean;
}
export interface PriceSnapshot {
  id: string; createdAt: string; source: string;
  averagePrice: string | null; medianPrice: string | null;
  lowPrice: string | null; highPrice: string | null;
  salesPerMonth: number | null; trend: Trend | null;
}
export interface Comic {
  id: string; sku: string; createdAt: string; updatedAt: string;
  title: string; issueNumber: string | null; publisher: string | null;
  variant: string | null; year: number | null; upc: string | null; location: string | null; keyIssue: boolean; keyNotes: string | null;
  aiSuggestedGrade: number | null; grade: number | null; condition: string | null;
  graded: boolean; gradingCompany: string | null; status: ComicStatus;
  quantity: number; freeShipping: boolean | null;
  recommendedPrice: string | null; recommendedFormat: ListingFormat | null;
  recommendedAction: SellAction | null; recommendationNote: string | null;
  watching: boolean; holdUntil: string | null; targetPrice: number | null; watchNote: string | null;
  costBasis: number | null; soldPrice: number | null; soldNet: number | null; soldProfit: number | null; soldAt: string | null;
  photos: Photo[]; priceSnapshots: PriceSnapshot[]; listing: unknown | null;
}
export interface Identification {
  title: string | null; issueNumber: string | null; publisher: string | null;
  variant: string | null; year: number | null; keyIssue: boolean; keyNotes: string | null;
  suggestedGrade: number | null; gradeRationale: string | null; confidence: number;
}
export interface AuthUser { id: string; email: string; name: string | null; role: Role; }
export interface AdminUser extends AuthUser { active: boolean; createdAt: string; lastLoginAt: string | null; }
export interface VersionInfo { version: string; buildSha: string; buildTime: string; nodeEnv: string; }
export interface UpcMatch {
  series: string; number: string | null; publisher: string | null;
  year: number | null; barcode: string; gcdIssueId: string | null;
}
export interface UpcLookupResult {
  found: boolean; query: string; match: UpcMatch | null;
  candidates: UpcMatch[]; source: "GCD" | "NONE"; datasetSize: number;
}
export interface StatsOverview {
  totalComics: number; pricedComics: number; unpricedComics: number; keyIssues: number;
  totalValue: number; readyValue: number;
  statusCounts: Record<string, number>;
  actionCounts: Record<string, number>;
  formatCounts: Record<string, number>;
  topComics: {
    id: string; title: string; issueNumber: string | null;
    recommendedPrice: number; recommendedFormat: string | null; recommendedAction: string | null;
  }[];
}
export interface Settings {
  id: string; updatedAt: string;
  feePercent: number; perOrderFee: number; shippingCost: number; shippingCharged: number;
  ebayCategoryId: string; ebayConditionId: string; ebayDuration: string;
  ebayShippingProfile: string; ebayPaymentProfile: string; ebayReturnProfile: string;
  ebayFreeShippingProfile: string; freeShippingDefault: boolean;
  publicBaseUrl: string;
  aiProvider: AiProvider;
  anthropicModel: string; geminiModel: string; grokModel: string;
  ai?: AiStatus;
}
export interface Pnl {
  unitsSold: number; revenue: number; net: number; cost: number; profit: number;
  months: { month: string; units: number; revenue: number; net: number; profit: number }[];
  recent: { id: string; title: string; issueNumber: string | null; soldPrice: number; soldProfit: number; soldAt: string | null }[];
}

export interface BatchDetectedComic {
  comic: Comic;
  cropUrl: string;
  detection: {
    box: { x: number; y: number; w: number; h: number };
    title: string | null; publisher: string | null; confidence: number;
  };
}
export interface BatchDetectResult {
  originalUrl: string; width: number; height: number;
  detected: number; created: number; comics: BatchDetectedComic[];
}

export interface CopiesResult {
  count: number;
  items: { id: string; sku: string; grade: number | null; status: ComicStatus; recommendedPrice: string | null }[];
}
export interface GcdJob {
  status: "idle" | "running" | "done" | "error";
  source: string | null; imported: number; skipped: number;
  startedAt: string | null; finishedAt: string | null; error: string | null; datasetSize: number | null;
}
export interface GcdStatus { datasetSize: number; ready?: boolean; lastUpdated: string | null; job?: GcdJob; }
export interface GcdImportResult { imported: number; skipped: number; datasetSize: number; lastUpdated: string | null; }

export type AiProvider = "anthropic" | "gemini" | "grok";
export interface ProviderStatus { configured: boolean; maskedKey: string | null; model: string; fromEnv: boolean; }
export interface AiStatus { provider: AiProvider; mock: boolean; providers: Record<AiProvider, ProviderStatus>; }
export interface AiTestResult { provider: AiProvider; model: string; ok: boolean; detail?: string; }
export interface AiUpdate {
  aiProvider?: AiProvider;
  anthropicModel?: string; geminiModel?: string; grokModel?: string;
  anthropicKey?: string; geminiKey?: string; grokKey?: string;
}

const TOKEN_KEY = "comicseller.token";
let authToken: string | null = localStorage.getItem(TOKEN_KEY);
let onUnauthorized: (() => void) | null = null;

export function setToken(token: string | null) {
  authToken = token;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}
export function getToken(): string | null { return authToken; }
export function setUnauthorizedHandler(fn: () => void) { onUnauthorized = fn; }

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (authToken) headers.set("Authorization", `Bearer ${authToken}`);
  const res = await fetch(path, { ...init, headers });
  if (res.status === 401) {
    setToken(null);
    onUnauthorized?.();
    throw new Error("Session expired — please sign in again.");
  }
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try { const body = await res.json(); if (body?.error) msg = body.error; } catch { /* ignore */ }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
function jsonInit(method: string, body: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

export const api = {
  async login(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
    return request("/auth/login", jsonInit("POST", { email, password }));
  },
  async me(): Promise<AuthUser> { return request("/auth/me"); },
  async version(): Promise<VersionInfo> { return request("/version"); },
  async stats(): Promise<StatsOverview> { return request("/stats/overview"); },
  async getSettings(): Promise<Settings> { return request("/settings"); },
  async updateSettings(body: Partial<Omit<Settings, "id" | "updatedAt">>): Promise<Settings> {
    return request("/settings", jsonInit("PATCH", body));
  },
  async updateAiSettings(body: AiUpdate): Promise<Settings> {
    return request("/settings", jsonInit("PATCH", body));
  },
  async testAi(): Promise<AiTestResult> {
    return request("/settings/ai/test", { method: "POST" });
  },
  async listUsers(): Promise<{ users: AdminUser[] }> { return request("/admin/users"); },
  async createUser(body: { email: string; password: string; name?: string; role?: Role }): Promise<AdminUser> {
    return request("/admin/users", jsonInit("POST", body));
  },
  async updateUser(id: string, body: Partial<{ role: Role; active: boolean; name: string; password: string }>): Promise<AdminUser> {
    return request(`/admin/users/${id}`, jsonInit("PATCH", body));
  },
  async deleteUser(id: string): Promise<void> { return request(`/admin/users/${id}`, { method: "DELETE" }); },
  async listComics(status?: string, location?: string, search?: string): Promise<{ total: number; items: Comic[] }> {
    const qs = new URLSearchParams();
    if (status) qs.set("status", status);
    if (location) qs.set("location", location);
    if (search) qs.set("q", search);
    const q = qs.toString() ? `?${qs.toString()}` : "";
    return request(`/comics${q}`);
  },
  async locations(): Promise<{ location: string; count: number }[]> {
    const r = await request<{ locations: { location: string; count: number }[] }>("/stats/locations");
    return r.locations;
  },
  async getComic(id: string): Promise<Comic> { return request(`/comics/${id}`); },
  async cooking(): Promise<{ total: number; items: Comic[] }> {
    return request(`/comics?watching=true&limit=200`);
  },
  async createComic(
    file: File | null,
    title?: string,
    upc?: string,
    publisher?: string,
    extra?: {
      issueNumber?: string | null; year?: number | null; variant?: string | null;
      keyIssue?: boolean; keyNotes?: string | null; aiSuggestedGrade?: number | null;
    }
  ): Promise<Comic> {
    const form = new FormData();
    if (title) form.append("title", title);
    if (upc) form.append("upc", upc);
    if (publisher) form.append("publisher", publisher);
    if (extra?.issueNumber) form.append("issueNumber", extra.issueNumber);
    if (extra?.year != null) form.append("year", String(extra.year));
    if (extra?.variant) form.append("variant", extra.variant);
    if (extra?.keyIssue) form.append("keyIssue", "true");
    if (extra?.keyNotes) form.append("keyNotes", extra.keyNotes);
    if (extra?.aiSuggestedGrade != null) form.append("aiSuggestedGrade", String(extra.aiSuggestedGrade));
    if (file) form.append("photo", file);
    return request(`/comics`, { method: "POST", body: form });
  },
  async identifyPreview(file: File): Promise<{ suggestion: Identification }> {
    const form = new FormData();
    form.append("photo", file);
    return request(`/comics/identify-preview`, { method: "POST", body: form });
  },
  async batchDetect(file: File): Promise<BatchDetectResult> {
    const form = new FormData();
    form.append("photo", file);
    return request(`/comics/batch-detect`, { method: "POST", body: form });
  },
  async findByUpc(upc: string): Promise<{ total: number; items: Comic[] }> {
    return request(`/comics?upc=${encodeURIComponent(upc)}`);
  },
  async lookupUpc(upc: string): Promise<UpcLookupResult> {
    return request(`/lookup/upc/${encodeURIComponent(upc)}`);
  },
  async searchTitle(series: string, number?: string, year?: number): Promise<{ count: number; items: UpcMatch[] }> {
    const qs = new URLSearchParams({ series });
    if (number) qs.set("number", number);
    if (year) qs.set("year", String(year));
    return request(`/lookup/title?${qs.toString()}`);
  },
  async addPhoto(id: string, file: File, kind?: string): Promise<Photo> {
    const form = new FormData();
    form.append("photo", file);
    if (kind) form.append("kind", kind);
    return request(`/comics/${id}/photos`, { method: "POST", body: form });
  },
  async updatePhoto(comicId: string, photoId: string, body: { isPrimary?: boolean; kind?: string }): Promise<Photo> {
    return request(`/comics/${comicId}/photos/${photoId}`, jsonInit("PATCH", body));
  },
  async deletePhoto(comicId: string, photoId: string): Promise<void> {
    return request(`/comics/${comicId}/photos/${photoId}`, { method: "DELETE" });
  },
  async identify(id: string): Promise<{ suggestion: Identification; comic: Comic }> {
    return request(`/comics/${id}/identify`, { method: "POST" });
  },
  async updateComic(id: string, patch: Partial<Comic>): Promise<Comic> {
    return request(`/comics/${id}`, jsonInit("PATCH", patch));
  },
  async duplicateComic(id: string): Promise<Comic> {
    return request(`/comics/${id}/duplicate`, { method: "POST" });
  },
  async getCopies(id: string): Promise<CopiesResult> {
    return request(`/comics/${id}/copies`);
  },
  async gcdStatus(): Promise<GcdStatus> {
    return request(`/admin/gcd/status`);
  },
  async gcdImportUpload(file: File, replace: boolean): Promise<{ started: boolean }> {
    const form = new FormData();
    form.append("file", file);
    return request(`/admin/gcd/import?replace=${replace ? "1" : "0"}`, { method: "POST", body: form });
  },
  async gcdImportPath(path: string, replace: boolean): Promise<{ started: boolean }> {
    return request(`/admin/gcd/import-path`, jsonInit("POST", { path, replace }));
  },
  async addPrice(id: string, body: {
    source?: string; averagePrice?: number; medianPrice?: number; lowPrice?: number;
    highPrice?: number; salesPerMonth?: number; sampleSize?: number; trend?: Trend;
  }): Promise<Comic> {
    return request(`/comics/${id}/price`, jsonInit("POST", body));
  },
  async recommend(id: string): Promise<Comic> { return request(`/comics/${id}/recommend`, { method: "POST" }); },
  async sell(id: string, body: { soldPrice: number; shippingCharged?: number; shippingCost?: number; costBasis?: number; soldAt?: string }): Promise<Comic> {
    return request(`/comics/${id}/sell`, jsonInit("POST", body));
  },
  async unsell(id: string): Promise<Comic> { return request(`/comics/${id}/unsell`, { method: "POST" }); },
  async pnl(): Promise<Pnl> { return request("/stats/pnl"); },
  async exportEbayCsv(status = "READY"): Promise<Blob> {
    const t = getToken();
    const headers = new Headers();
    if (t) headers.set("Authorization", `Bearer ${t}`);
    const res = await fetch(`/export/ebay.csv?status=${encodeURIComponent(status)}`, { headers });
    if (res.status === 401) { setToken(null); onUnauthorized?.(); throw new Error("Session expired — please sign in again."); }
    if (!res.ok) throw new Error(`Export failed (${res.status})`);
    return res.blob();
  },
  async exportInventoryCsv(status?: string): Promise<Blob> {
    const t = getToken();
    const headers = new Headers();
    if (t) headers.set("Authorization", `Bearer ${t}`);
    const qs = status && status !== "ALL" ? `?status=${encodeURIComponent(status)}` : "";
    const res = await fetch(`/export/inventory.csv${qs}`, { headers });
    if (res.status === 401) { setToken(null); onUnauthorized?.(); throw new Error("Session expired — please sign in again."); }
    if (!res.ok) throw new Error(`Backup failed (${res.status})`);
    return res.blob();
  },
  async deleteComic(id: string): Promise<void> { return request(`/comics/${id}`, { method: "DELETE" }); },
  async bulkUpdate(ids: string[], set: { status?: string; location?: string | null }): Promise<{ updated: number }> {
    return request("/comics/bulk", jsonInit("POST", { ids, set }));
  },
  async bulkDelete(ids: string[]): Promise<{ deleted: number }> {
    return request("/comics/bulk-delete", jsonInit("POST", { ids }));
  },
  async importCsv(file: File, dryRun: boolean): Promise<{
    dryRun?: boolean; willImport?: number; imported?: number;
    rowsSkipped: number; unmatchedHeaders: string[]; preview?: unknown[];
  }> {
    const form = new FormData();
    form.append("file", file);
    const q = dryRun ? "?dryRun=1" : "";
    return request(`/import/csv${q}`, { method: "POST", body: form });
  },
};
