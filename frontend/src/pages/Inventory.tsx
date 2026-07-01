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
  const [data, setData] = useState<{ total: number; items: Comic[] }>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError(undefined);
    try {
      const res = await api.listComics(status === "ALL" ? undefined : status);
      setData(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

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
          <div>
            <button className="secondary" onClick={load} disabled={loading}>
              {loading ? "Loading…" : "Refresh"}
            </button>
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
                  <td className="right">{money(c.recommendedPrice)}</td>
                  <td>{c.recommendedFormat === "AUCTION" ? "Auction" : c.recommendedFormat === "BUY_IT_NOW" ? "BIN" : "—"}</td>
                  <td>{actionBadge(c)}</td>
                </tr>
              );
            })}
            {data && data.items.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
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
