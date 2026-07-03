import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type StatsOverview } from "../api";

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
  const [error, setError] = useState<string>();

  useEffect(() => {
    api.stats().then(setS).catch((e) => setError((e as Error).message));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!s) return <p className="muted">Loading…</p>;

  const sellNow = s.actionCounts.SELL_NOW ?? 0;
  const hold = s.actionCounts.HOLD ?? 0;
  const auction = s.formatCounts.AUCTION ?? 0;
  const bin = s.formatCounts.BUY_IT_NOW ?? 0;

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Collection dashboard</h2>

      <div className="row" style={{ marginBottom: 18 }}>
        <Kpi label="Est. collection value" value={money(s.totalValue)} hint={`${s.pricedComics} priced of ${s.totalComics}`} />
        <Kpi label="Ready-to-list value" value={money(s.readyValue)} hint="Priced + ready" />
        <Kpi label="Total comics" value={s.totalComics.toLocaleString()} hint={`${s.unpricedComics} not priced yet`} />
        <Kpi label="Key issues" value={s.keyIssues.toLocaleString()} />
      </div>

      <div className="row">
        <div className="col">
          <div className="card">
            <h3>Recommended action</h3>
            <div className="pill-row">
              <span className="badge good">Sell now: {sellNow}</span>
              <span className="badge warn">Hold / cook: {hold}</span>
            </div>
            <div className="pill-row">
              <span className="badge accent">Auction: {auction}</span>
              <span className="badge">Buy It Now: {bin}</span>
            </div>
          </div>

          <div className="card">
            <h3>By status</h3>
            <table>
              <tbody>
                {STATUS_ORDER.filter((st) => s.statusCounts[st]).map((st) => (
                  <tr key={st}>
                    <td>
                      <Link to={`/?status=${st}`}>{st}</Link>
                    </td>
                    <td className="right">{s.statusCounts[st]}</td>
                  </tr>
                ))}
                {Object.keys(s.statusCounts).length === 0 && (
                  <tr>
                    <td className="muted">No comics yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
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
