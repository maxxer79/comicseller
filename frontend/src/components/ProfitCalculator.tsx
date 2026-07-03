import { useEffect, useState } from "react";
import { api, type Settings } from "../api";
import { computeProfit } from "../lib/profit";

function usd(n: number): string {
  return `$${n.toFixed(2)}`;
}

/**
 * Shows net take-home for a sale price after eBay fees + shipping, using the
 * global fee settings. Sale price defaults to the recommended price and is
 * editable; shipping charged is editable inline.
 */
export function ProfitCalculator({ recommendedPrice }: { recommendedPrice: string | null }) {
  const [settings, setSettings] = useState<Settings>();
  const [price, setPrice] = useState<string>(recommendedPrice ?? "");
  const [shipCharged, setShipCharged] = useState<string>("");

  useEffect(() => {
    api.getSettings().then((s) => {
      setSettings(s);
      setShipCharged(String(s.shippingCharged));
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (recommendedPrice && !price) setPrice(recommendedPrice);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recommendedPrice]);

  if (!settings) return null;

  const sale = Number(price) || 0;
  const r = computeProfit(sale, settings, {
    shippingCharged: shipCharged === "" ? undefined : Number(shipCharged),
  });

  return (
    <div className="card">
      <h3>Profit (take-home)</h3>
      <div className="row">
        <div className="col">
          <label>Sale price ($)</label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="col">
          <label>Shipping charged to buyer ($)</label>
          <input
            type="number"
            value={shipCharged}
            onChange={(e) => setShipCharged(e.target.value)}
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="spacer" />
      <div className="kv" style={{ gridTemplateColumns: "1fr auto" }}>
        <span className="k">Gross (item + shipping)</span>
        <span className="mono right">{usd(r.gross)}</span>
        <span className="k">eBay fees ({settings.feePercent}% + {usd(settings.perOrderFee)})</span>
        <span className="mono right" style={{ color: "var(--bad)" }}>−{usd(r.fee)}</span>
        <span className="k">Your shipping cost</span>
        <span className="mono right" style={{ color: "var(--bad)" }}>−{usd(r.shippingCost)}</span>
        <span className="k" style={{ fontWeight: 700 }}>Net take-home</span>
        <span className="mono right" style={{ fontWeight: 700, color: r.net >= 0 ? "var(--good)" : "var(--bad)" }}>
          {usd(r.net)}
        </span>
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
        {sale > 0 ? `You keep ${r.marginPct.toFixed(0)}% of the sale price.` : "Enter a sale price."}{" "}
        Assumptions are set in Admin → Fees &amp; shipping.
      </p>
    </div>
  );
}
