import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Comic, type ComicStatus } from "../api";

const STATUSES: (ComicStatus | "ALL")[] = [
  "ALL",
  "INTAKE",
  "IDENTIFIED",
  "PRICED",
  "READY",
  "LISTED",
  "SOLD",
  "ARCHIVED",
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
  const [status, setStatus] = useState<ComicStatus | "ALL">("ALL");
  const [location, setLocation] = useState<string>("");
  const [locations, setLocations] = useState<{ location: string; count: number }[]>([]);
  const [data, setData] = useState<{ total: number; items: Comic[] }>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function load() {
    setLoading(true);
    setError(undefined);
    try {
      const res = await api.listComics(status === "ALL" ? undefined : status, location || undefined);
      setData(res);
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
  }, [status, location]);

  return (
    <div>
      <div className="card">
        <div className="row" style={{ alignItems: "flex-end" }}>
          <div className="col" style={{ maxWidth: 240 }}>
            <label>Filter by status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ComicStatus | "ALL")}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="col" style={{ maxWidth: 220 }}>
            <label>Filter by location</label>
            <select value={location} onChange={(e) => setLocation(e.target.value)}>
              <option value="">All locations</option>
              {locations.map((l) => (
                <option key={l.location} value={l.location}>
                  {l.location} ({l.count})
                </option>
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
            <Link to="/labels">
              <button className="secondary">🖨 Labels</button>
            </Link>
            <Link to="/intake">
              <button>+ Add comic</button>
            </Link>
          </div>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="card">
        <p className="muted">{data ? `${data.total} comic(s)` : "…"}</p>
        <table>
          <thead>
            <tr>
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
            {data?.items.map((c) => {
              const primary = c.photos.find((p) => p.isPrimary) ?? c.photos[0];
              return (
                <tr key={c.id}>
                  <td>
                    {primary?.url ? (
                      <img className="thumb" src={primary.url} alt="" />
                    ) : (
                      <div className="thumb" />
                    )}
                  </td>
                  <td>
                    <Link to={`/comics/${c.id}`}>
                      {c.title}
                      {c.issueNumber ? ` #${c.issueNumber}` : ""}
                    </Link>
                    {c.keyIssue && <span className="badge warn" style={{ marginLeft: 8 }}>KEY</span>}
                    <div className="muted" style={{ fontSize: 12 }}>
                      {c.publisher ?? ""} {c.year ?? ""}
                    </div>
                  </td>
                  <td>{c.grade ?? (c.aiSuggestedGrade ? `~${c.aiSuggestedGrade}?` : "—")}</td>
                  <td>
                    <span className="badge">{c.status}</span>
                  </td>
                  <td className="muted">{c.location ?? "—"}</td>
                  <td className="right">{money(c.recommendedPrice)}</td>
                  <td>{c.recommendedFormat === "AUCTION" ? "Auction" : c.recommendedFormat === "BUY_IT_NOW" ? "BIN" : "—"}</td>
                  <td>{actionBadge(c)}</td>
                </tr>
              );
            })}
            {data && data.items.length === 0 && (
              <tr>
                <td colSpan={8} className="muted">
                  No comics yet. Add one or import a CSV.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
