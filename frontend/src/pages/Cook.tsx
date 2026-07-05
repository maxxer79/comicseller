import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Comic } from "../api";

function money(v: string | number | null): string {
  if (v === null || v === undefined) return "—";
  return `$${Number(v).toFixed(2)}`;
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const ms = d.setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
  return Math.round(ms / 86400000);
}

export function Cook() {
  const [items, setItems] = useState<Comic[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [savingId, setSavingId] = useState<string>();

  async function load() {
    setLoading(true);
    setError(undefined);
    try {
      const res = await api.cooking();
      // Sort: overdue/soonest first, then those with no date last.
      const sorted = [...res.items].sort((a, b) => {
        const da = a.holdUntil ? new Date(a.holdUntil).getTime() : Infinity;
        const db = b.holdUntil ? new Date(b.holdUntil).getTime() : Infinity;
        return da - db;
      });
      setItems(sorted);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function patch(id: string, body: Partial<Comic>) {
    setSavingId(id);
    setError(undefined);
    try {
      await api.updateComic(id, body);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingId(undefined);
    }
  }

  const ready = items.filter((c) => {
    const d = daysUntil(c.holdUntil);
    return d !== null && d <= 0;
  });

  return (
    <div>
      <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>🔥 Let it cook</h2>
        <button className="secondary" onClick={load} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>
      <p className="muted" style={{ fontSize: 13 }}>
        Books you're holding for value to rise. Set a target price and a revisit date;
        anything due shows up top so you know when to list it.
      </p>

      {error && <p className="error">{error}</p>}

      {ready.length > 0 && (
        <div className="card" style={{ borderLeft: "3px solid var(--warn, #e0a100)" }}>
          <h3 style={{ margin: "0 0 6px" }}>⏰ Ready to revisit ({ready.length})</h3>
          <p className="muted" style={{ fontSize: 13, margin: 0 }}>
            The hold date has arrived for {ready.length} book(s) — check current comps and list if the price is there.
          </p>
        </div>
      )}

      <div className="card">
        <p className="muted">{items.length} book(s) cooking</p>
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th className="right">Rec.</th>
              <th className="right">Target</th>
              <th>Revisit on</th>
              <th>Note</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => {
              const d = daysUntil(c.holdUntil);
              const due = d !== null && d <= 0;
              return (
                <tr key={c.id} style={due ? { background: "rgba(224,161,0,0.08)" } : undefined}>
                  <td>
                    <Link to={`/comics/${c.id}`}>
                      {c.title}{c.issueNumber ? ` #${c.issueNumber}` : ""}
                    </Link>
                    <div className="muted" style={{ fontSize: 12 }}>{c.publisher ?? ""} {c.year ?? ""}</div>
                  </td>
                  <td className="right">{money(c.recommendedPrice)}</td>
                  <td className="right">
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={c.targetPrice ?? ""}
                      style={{ width: 90, textAlign: "right" }}
                      onBlur={(e) => {
                        const v = e.target.value ? Number(e.target.value) : null;
                        if (v !== (c.targetPrice ?? null)) patch(c.id, { targetPrice: v });
                      }}
                    />
                  </td>
                  <td>
                    <input
                      type="date"
                      defaultValue={c.holdUntil ? c.holdUntil.slice(0, 10) : ""}
                      onBlur={(e) => {
                        const v = e.target.value || null;
                        const cur = c.holdUntil ? c.holdUntil.slice(0, 10) : null;
                        if (v !== cur) patch(c.id, { holdUntil: v });
                      }}
                    />
                    {d !== null && (
                      <div className="muted" style={{ fontSize: 11 }}>
                        {due ? "due now" : `in ${d} day${d === 1 ? "" : "s"}`}
                      </div>
                    )}
                  </td>
                  <td>
                    <input
                      defaultValue={c.watchNote ?? ""}
                      placeholder="why holding…"
                      style={{ minWidth: 160 }}
                      onBlur={(e) => {
                        const v = e.target.value || null;
                        if (v !== (c.watchNote ?? null)) patch(c.id, { watchNote: v });
                      }}
                    />
                  </td>
                  <td className="right" style={{ whiteSpace: "nowrap" }}>
                    <button
                      className="secondary"
                      disabled={savingId === c.id}
                      onClick={() => patch(c.id, { watching: false, status: "READY" })}
                      title="Take off the cook list and mark ready to list"
                    >
                      List now
                    </button>
                    <button
                      className="secondary"
                      disabled={savingId === c.id}
                      onClick={() => patch(c.id, { watching: false })}
                      title="Remove from the cook list"
                    >
                      Stop
                    </button>
                  </td>
                </tr>
              );
            })}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  Nothing cooking yet. Open a comic and hit “Let it cook 🔥” to add it here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
