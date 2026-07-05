import { Link } from "react-router-dom";

export interface BarDatum {
  label: string;
  value: number;
  color?: string;
  to?: string;
}

/** Horizontal labeled bars for categorical counts. Dependency-free. */
export function BarList({ data, unit }: { data: BarDatum[]; unit?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {data.map((d) => (
        <div
          key={d.label}
          style={{ display: "grid", gridTemplateColumns: "104px 1fr 54px", alignItems: "center", gap: 10 }}
        >
          <span className="muted" style={{ fontSize: 13 }}>
            {d.to ? <Link to={d.to}>{d.label}</Link> : d.label}
          </span>
          <div style={{ background: "var(--panel-2, rgba(0,0,0,0.06))", borderRadius: 6, height: 12 }}>
            <div
              style={{
                width: `${(d.value / max) * 100}%`,
                height: "100%",
                minWidth: d.value > 0 ? 4 : 0,
                background: d.color ?? "#0071e3",
                borderRadius: 6,
                transition: "width 0.3s",
              }}
            />
          </div>
          <span style={{ fontSize: 13, textAlign: "right" }}>
            {unit === "$" ? `$${d.value.toLocaleString()}` : d.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

export interface MonthDatum {
  month: string; // "YYYY-MM"
  revenue: number;
  profit: number;
}

/** Vertical grouped bars (revenue vs profit) per month. Dependency-free. */
export function MonthlyBars({ data }: { data: MonthDatum[] }) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.revenue, d.profit)));
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 150, overflowX: "auto", paddingTop: 6 }}>
        {data.map((d) => (
          <div key={d.month} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, minWidth: 42 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 118 }}>
              <div
                title={`Revenue $${d.revenue.toFixed(2)}`}
                style={{ width: 13, height: `${(d.revenue / max) * 100}%`, minHeight: d.revenue > 0 ? 2 : 0, background: "#0071e3", borderRadius: "3px 3px 0 0" }}
              />
              <div
                title={`Profit $${d.profit.toFixed(2)}`}
                style={{ width: 13, height: `${(Math.max(0, d.profit) / max) * 100}%`, minHeight: d.profit > 0 ? 2 : 0, background: "#34c759", borderRadius: "3px 3px 0 0" }}
              />
            </div>
            <span className="muted" style={{ fontSize: 11 }}>{d.month.slice(2)}</span>
          </div>
        ))}
      </div>
      <div className="pill-row" style={{ marginTop: 10 }}>
        <span style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 10, height: 10, background: "#0071e3", borderRadius: 2, display: "inline-block" }} /> Revenue
        </span>
        <span style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 10, height: 10, background: "#34c759", borderRadius: 2, display: "inline-block" }} /> Profit
        </span>
      </div>
    </div>
  );
}
