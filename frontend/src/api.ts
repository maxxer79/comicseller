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
  variant: string | null; year: number | null; upc: string | null; keyIssue: boolean; keyNotes: string | null;
  aiSuggestedGrade: number | null; grade: number | null; condition: string | null;
  graded: boolean; gradingCompany: string | null; status: ComicStatus;
  recommendedPrice: string | null; recommendedFormat: ListingFormat | null;
  recommendedAction: SellAction | null; recommendationNote: string | null;
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
  async listUsers(): Promise<{ users: AdminUser[] }> { return request("/admin/users"); },
  async createUser(body: { email: string; password: string; name?: string; role?: Role }): Promise<AdminUser> {
    return request("/admin/users", jsonInit("POST", body));
  },
  async updateUser(id: string, body: Partial<{ role: Role; active: boolean; name: string; password: string }>): Promise<AdminUser> {
    return request(`/admin/users/${id}`, jsonInit("PATCH", body));
  },
  async deleteUser(id: string): Promise<void> { return request(`/admin/users/${id}`, { method: "DELETE" }); },
  async listComics(status?: string): Promise<{ total: number; items: Comic[] }> {
    const q = status ? `?status=${encodeURIComponent(status)}` : "";
    return request(`/comics${q}`);
  },
  async getComic(id: string): Promise<Comic> { return request(`/comics/${id}`); },
  async createComic(file: File | null, title?: string, upc?: string): Promise<Comic> {
    const form = new FormData();
    if (title) form.append("title", title);
    if (upc) form.append("upc", upc);
    if (file) form.append("photo", file);
    return request(`/comics`, { method: "POST", body: form });
  },
  async findByUpc(upc: string): Promise<{ total: number; items: Comic[] }> {
    return request(`/comics?upc=${encodeURIComponent(upc)}`);
  },
  async lookupUpc(upc: string): Promise<UpcLookupResult> {
    return request(`/lookup/upc/${encodeURIComponent(upc)}`);
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
  async addPrice(id: string, body: {
    source?: string; averagePrice?: number; medianPrice?: number; lowPrice?: number;
    highPrice?: number; salesPerMonth?: number; sampleSize?: number; trend?: Trend;
  }): Promise<Comic> {
    return request(`/comics/${id}/price`, jsonInit("POST", body));
  },
  async recommend(id: string): Promise<Comic> { return request(`/comics/${id}/recommend`, { method: "POST" }); },
  async deleteComic(id: string): Promise<void> { return request(`/comics/${id}`, { method: "DELETE" }); },
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
