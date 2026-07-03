import { useEffect, useState } from "react";
import { api, type Comic } from "../api";

const STATUSES = ["ALL", "INTAKE", "IDENTIFIED", "PRICED", "READY", "LISTED", "SOLD", "ARCHIVED"];

/**
 * Printable SKU labels. Filter by box/location (and status), then print.
 * The controls are hidden when printing; only the label sheet remains.
 */
export function Labels() {
  const [status, setStatus] = useState("ALL");
  const [location, setLocation] = useState("");
  const [locations, setLocations] = useState<{ location: string; count: number }[]>([]);
  const [items, setItems] = useState<Comic[]>([]);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.locations().then(setLocations).catch(() => undefined);
  }, []);

  async function load() {
    setLoading(true);
    setError(undefined);
    try {
      const res = await api.listComics(
        status === "ALL" ? undefined : status,
        location || undefined
      );
      setItems(res.items);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, location]);

  return (
    <div>
      <style>{`
        @media print {
          .app-header, .no-print { display: none !important; }
          .container { padding: 0 !important; max-width: none !important; }
          body { background: #fff !important; }
        }
        .label-sheet { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .label {
          border: 1px solid #bbb; border-radius: 8px; padding: 10px 12px;
          background: #fff; color: #111; break-inside: avoid; min-height: 90px;
          display: flex; flex-direction: column; justify-content: space-between;
        }
        .label .loc { font-size: 18px; font-weight: 700; letter-spacing: -0.01em; }
        .label .ttl { font-size: 13px; font-weight: 600; margin-top: 2px; }
        .label .meta { font-size: 11px; color: #555; }
        .label .sku { font-family: ui-monospace, Menlo, monospace; font-size: 11px; color: #333; margin-top: 6px; }
      `}</style>

      <div className="card no-print">
        <div className="row" style={{ alignItems: "flex-end" }}>
          <div className="col" style={{ maxWidth: 220 }}>
            <label>Box / location</label>
            <select value={location} onChange={(e) => setLocation(e.target.value)}>
              <option value="">All locations</option>
              {locations.map((l) => (
                <option key={l.location} value={l.location}>
                  {l.location} ({l.count})
                </option>
              ))}
            </select>
          </div>
          <div className="col" style={{ maxWidth: 200 }}>
            <label>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <button className="secondary" onClick={load} disabled={loading}>
              {loading ? "Loading…" : "Refresh"}
            </button>
            <button onClick={() => window.print()} disabled={items.length === 0}>
              🖨 Print labels
            </button>
          </div>
        </div>
        {error && <p className="error">{error}</p>}
        <p className="muted" style={{ fontSize: 13 }}>
          {items.length} label(s). Tip: set a book's box/location on its detail page.
        </p>
      </div>

      <div className="label-sheet">
        {items.map((c) => (
          <div className="label" key={c.id}>
            <div>
              <div className="loc">{c.location || "—"}</div>
              <div className="ttl">
                {c.title}
                {c.issueNumber ? ` #${c.issueNumber}` : ""}
              </div>
              <div className="meta">
                {c.publisher ?? ""} {c.year ?? ""}
                {c.grade ? ` · ${c.grade}` : ""}
              </div>
            </div>
            <div className="sku">SKU {c.sku.slice(0, 8)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
