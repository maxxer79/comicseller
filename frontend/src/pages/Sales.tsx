import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Pnl } from "../api";

function usd(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Kpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="card" style={{ flex: 1, minWidth: 150, marginBottom: 0 }}>
      <div className="muted" style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 600, marginTop: 6, color }}>{value}</div>
    </div>
  );
}

export function Sales() {
  const [p, setP] = useState<Pnl>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    api.pnl().then(setP).catch((e) => setError((e as Error).message));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!p) return <p className="muted">Loading…</p>;

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Sales &amp; P&amp;L</h2>

      <div className="row" style={{ marginBottom: 18 }}>
        <Kpi label="Units sold" value={String(p.unitsSold)} />
        <Kpi label="Revenue" value={usd(p.revenue)} />
        <Kpi label="Net proceeds" value={usd(p.net)} />
        <Kpi label="Profit" value={usd(p.profit)} color={p.profit >= 0 ? "var(--good)" : "var(--bad)"} />
      </div>

      <div className="row">
        <div className="col">
          <div className="card">
            <h3>By month</h3>
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th className="right">Units</th>
                  <th className="right">Revenue</th>
                  <th className="right">Profit</th>
                </tr>
              </thead>
              <tbody>
                {p.months.map((m) => (
                  <tr key={m.month}>
                    <td>{m.month}</td>
                    <td className="right">{m.units}</td>
                    <td className="right">{usd(m.revenue)}</td>
                    <td className="right" style={{ color: m.profit >= 0 ? "var(--good)" : "var(--bad)" }}>
                      {usd(m.profit)}
                    </td>
                  </tr>
                ))}
                {p.months.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted">
                      No sales yet. Mark a comic sold on its detail page.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="col">
          <div className="card">
            <h3>Recent sales</h3>
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th className="right">Sold</th>
                  <th className="right">Profit</th>
                </tr>
              </thead>
              <tbody>
                {p.recent.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link to={`/comics/${c.id}`}>
                        {c.title}
                        {c.issueNumber ? ` #${c.issueNumber}` : ""}
                      </Link>
                      <div className="muted" style={{ fontSize: 11 }}>
                        {c.soldAt ? new Date(c.soldAt).toLocaleDateString() : ""}
                      </div>
                    </td>
                    <td className="right">{usd(c.soldPrice)}</td>
                    <td className="right" style={{ color: c.soldProfit >= 0 ? "var(--good)" : "var(--bad)" }}>
                      {usd(c.soldProfit)}
                    </td>
                  </tr>
                ))}
                {p.recent.length === 0 && (
                  <tr>
                    <td colSpan={3} className="muted">—</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
