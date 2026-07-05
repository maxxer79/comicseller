import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type StatsOverview, type Pnl } from "../api";
import { BarList, MonthlyBars, type BarDatum } from "../components/Charts";

function money(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card" style={{ flex: 1, minWidth: 170, marginBottom: 0 }}>
      <div className="muted" style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 600, marginTop: 6, letterSpacing: "-0.02em" }}>{value}</div>
      {hint && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

const STATUS_ORDER = ["INTAKE", "IDENTIFIED", "PRICED", "READY", "LISTED", "SOLD", "ARCHIVED"];

export function Dashboard() {
  const [s, setS] = useState<StatsOverview>();
  const [pnl, setPnl] = useState<Pnl>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    api.stats().then(setS).catch((e) => setError((e as Error).message));
    api.pnl().then(setPnl).catch(() => undefined);
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!s) return <p className="muted">Loading…</p>;

  const sellNow = s.actionCounts.SELL_NOW ?? 0;
  const hold = s.actionCounts.HOLD ?? 0;
  const auction = s.formatCounts.AUCTION ?? 0;
  const bin = s.formatCounts.BUY_IT_NOW ?? 0;

  const statusData: BarDatum[] = STATUS_ORDER.filter((st) => s.statusCounts[st]).map((st) => ({
    label: st,
    value: s.statusCounts[st],
    to: `/?status=${st}`,
    color: st === "SOLD" ? "#34c759" : st === "READY" ? "#0071e3" : "#8e8e93",
  }));

  const recData: BarDatum[] = [
    { label: "Sell now", value: sellNow, color: "#34c759" },
    { label: "Hold / cook", value: hold, color: "#e0a100" },
    { label: "Auction", value: auction, color: "#0071e3" },
    { label: "Buy It Now", value: bin, color: "#8e8e93" },
  ];

  const months = pnl ? [...pnl.months].reverse().slice(-12) : [];

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Collection dashboard</h2>

      <div className="row" style={{ marginBottom: 18 }}>
        <Kpi label="Est. collection value" value={money(s.totalValue)} hint={`${s.pricedComics} priced of ${s.totalComics}`} />
        <Kpi label="Ready-to-list value" value={money(s.readyValue)} hint="Priced + ready" />
        <Kpi label="Total comics" value={s.totalComics.toLocaleString()} hint={`${s.unpricedComics} not priced yet`} />
        <Kpi label="Key issues" value={s.keyIssues.toLocaleString()} />
      </div>

      {months.length > 0 && (
        <div className="card">
          <h3>Monthly sales &amp; profit</h3>
          <MonthlyBars data={months} />
        </div>
      )}

      <div className="row">
        <div className="col">
          <div className="card">
            <h3>Inventory by status</h3>
            {statusData.length > 0 ? (
              <BarList data={statusData} />
            ) : (
              <p className="muted">No comics yet.</p>
            )}
          </div>

          <div className="card">
            <h3>Recommended action</h3>
            {sellNow + hold + auction + bin > 0 ? (
              <BarList data={recData} />
            ) : (
              <p className="muted">Price some comics to see recommendations.</p>
            )}
          </div>
        </div>

        <div className="col">
          <div className="card">
            <h3>Most valuable books</h3>
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th></th>
                  <th className="right">Rec. price</th>
                </tr>
              </thead>
              <tbody>
                {s.topComics.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link to={`/comics/${c.id}`}>
                        {c.title}
                        {c.issueNumber ? ` #${c.issueNumber}` : ""}
                      </Link>
                    </td>
                    <td>
                      {c.recommendedFormat === "AUCTION" ? (
                        <span className="badge accent">Auction</span>
                      ) : c.recommendedFormat === "BUY_IT_NOW" ? (
                        <span className="badge">BIN</span>
                      ) : null}
                    </td>
                    <td className="right">{money(c.recommendedPrice)}</td>
                  </tr>
                ))}
                {s.topComics.length === 0 && (
                  <tr>
                    <td colSpan={3} className="muted">
                      Price some comics to see your top books.
                    </td>
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
