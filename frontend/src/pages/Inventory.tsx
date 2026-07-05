import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, type Comic, type ComicStatus } from "../api";

const STATUSES: (ComicStatus | "ALL")[] = [
  "ALL", "INTAKE", "IDENTIFIED", "PRICED", "READY", "LISTED", "SOLD", "ARCHIVED",
];
const SET_STATUSES: ComicStatus[] = [
  "INTAKE", "IDENTIFIED", "PRICED", "READY", "LISTED", "SOLD", "ARCHIVED",
];

function money(v: string | null): string {
  if (v === null) return "—";
  return `$${Number(v).toFixed(2)}`;
}

function actionBadge(c: Comic) {
  if (!c.recommendedAction) return null;
  const cls = c.recommendedAction === "SELL_NOW" ? "good" : "warn";
  const label = c.recommendedAction === "SELL_NOW" ? "Sell now" : "Hold";
  return <span className={`badge ${cls}`}>{label}</span>;
}

export function Inventory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const [status, setStatus] = useState<ComicStatus | "ALL">("ALL");
  const [location, setLocation] = useState<string>("");
  const [locations, setLocations] = useState<{ location: string; count: number }[]>([]);
  const [data, setData] = useState<{ total: number; items: Comic[] }>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Bulk selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLocation, setBulkLocation] = useState("");
  const [bulkStatus, setBulkStatus] = useState<ComicStatus>("READY");
  const [bulkBusy, setBulkBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError(undefined);
    try {
      const res = await api.listComics(status === "ALL" ? undefined : status, location || undefined, q || undefined);
      setData(res);
      setSelected(new Set());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function exportCsv() {
    setExporting(true);
    setError(undefined);
    try {
      const blob = await api.exportEbayCsv(status === "ALL" ? "READY" : status);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "comicseller-ebay.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    api.locations().then(setLocations).catch(() => undefined);
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, location, q]);

  const items = data?.items ?? [];
  const allSelected = items.length > 0 && items.every((c) => selected.has(c.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(items.map((c) => c.id)));
  }

  async function runBulk(fn: () => Promise<unknown>) {
    setBulkBusy(true);
    setError(undefined);
    try {
      await fn();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBulkBusy(false);
    }
  }

  const ids = () => Array.from(selected);

  return (
    <div>
      <div className="card">
        <div className="row" style={{ alignItems: "flex-end" }}>
          <div className="col" style={{ maxWidth: 240 }}>
            <label>Filter by status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as ComicStatus | "ALL")}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="col" style={{ maxWidth: 220 }}>
            <label>Filter by location</label>
            <select value={location} onChange={(e) => setLocation(e.target.value)}>
              <option value="">All locations</option>
              {locations.map((l) => (
                <option key={l.location} value={l.location}>{l.location} ({l.count})</option>
              ))}
            </select>
          </div>
          <div>
            <button className="secondary" onClick={load} disabled={loading}>
              {loading ? "Loading…" : "Refresh"}
            </button>
            <button className="secondary" onClick={exportCsv} disabled={exporting}>
              {exporting ? "Exporting…" : "⬇ eBay CSV"}
            </button>
            <Link to="/labels"><button className="secondary">🖨 Labels</button></Link>
            <Link to="/intake"><button>+ Add comic</button></Link>
          </div>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {q && (
        <p className="muted" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          Search results for <strong>“{q}”</strong>
          <button className="secondary" onClick={() => setSearchParams({})}>Clear search</button>
        </p>
      )}

      {selected.size > 0 && (
        <div className="card" style={{ background: "var(--panel-2, rgba(0,0,0,0.03))" }}>
          <div className="row" style={{ alignItems: "flex-end" }}>
            <div className="col" style={{ maxWidth: 160 }}>
              <span className="badge accent">{selected.size} selected</span>
            </div>
            <div className="col" style={{ maxWidth: 240 }}>
              <label>Set location</label>
              <div style={{ display: "flex", gap: 6 }}>
                <input value={bulkLocation} onChange={(e) => setBulkLocation(e.target.value)} placeholder="Box 12 / Shelf A" />
                <button className="secondary" disabled={bulkBusy || !bulkLocation} onClick={() => runBulk(() => api.bulkUpdate(ids(), { location: bulkLocation }))}>Apply</button>
              </div>
            </div>
            <div className="col" style={{ maxWidth: 240 }}>
              <label>Set status</label>
              <div style={{ display: "flex", gap: 6 }}>
                <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value as ComicStatus)}>
                  {SET_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <button className="secondary" disabled={bulkBusy} onClick={() => runBulk(() => api.bulkUpdate(ids(), { status: bulkStatus }))}>Apply</button>
              </div>
            </div>
            <div>
              <button className="secondary" disabled={bulkBusy} onClick={() => runBulk(() => api.bulkUpdate(ids(), { status: "READY" }))}>Mark ready</button>
              <button className="danger" disabled={bulkBusy} onClick={() => { if (confirm(`Delete ${selected.size} comic(s)? This removes their photos too.`)) runBulk(() => api.bulkDelete(ids())); }}>Delete</button>
              <button className="secondary" disabled={bulkBusy} onClick={() => setSelected(new Set())}>Clear</button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <p className="muted">{data ? `${data.total} comic(s)` : "…"}</p>
        <table>
          <thead>
            <tr>
              <th><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" /></th>
              <th></th>
              <th>Title</th>
              <th>Grade</th>
              <th>Status</th>
              <th>Location</th>
              <th className="right">Rec. price</th>
              <th>Format</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => {
              const primary = c.photos.find((p) => p.isPrimary) ?? c.photos[0];
              return (
                <tr key={c.id} style={selected.has(c.id) ? { background: "rgba(0,113,227,0.06)" } : undefined}>
                  <td><input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} aria-label="Select" /></td>
                  <td>
                    {primary?.url ? <img className="thumb" src={primary.url} alt="" /> : <div className="thumb" />}
                  </td>
                  <td>
                    <Link to={`/comics/${c.id}`}>
                      {c.title}{c.issueNumber ? ` #${c.issueNumber}` : ""}
                    </Link>
                    {c.keyIssue && <span className="badge warn" style={{ marginLeft: 8 }}>KEY</span>}
                    <div className="muted" style={{ fontSize: 12 }}>{c.publisher ?? ""} {c.year ?? ""}</div>
                  </td>
                  <td>{c.grade ?? (c.aiSuggestedGrade ? `~${c.aiSuggestedGrade}?` : "—")}</td>
                  <td><span className="badge">{c.status}</span></td>
                  <td className="muted">{c.location ?? "—"}</td>
                  <td className="right">{money(c.recommendedPrice)}</td>
                  <td>{c.recommendedFormat === "AUCTION" ? "Auction" : c.recommendedFormat === "BUY_IT_NOW" ? "BIN" : "—"}</td>
                  <td>{actionBadge(c)}</td>
                </tr>
              );
            })}
            {data && items.length === 0 && (
              <tr><td colSpan={9} className="muted">No comics yet. Add one or import a CSV.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
