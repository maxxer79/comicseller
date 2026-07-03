import { useEffect, useState } from "react";
import { api, type Comic, type Settings } from "../api";
import { computeProfit } from "../lib/profit";

function usd(n: number): string {
  return `$${n.toFixed(2)}`;
}

/**
 * Record a sale (with fees/shipping applied) or show the sale summary + undo.
 */
export function SaleManager({
  comic,
  onChange,
}: {
  comic: Comic;
  onChange: () => void | Promise<void>;
}) {
  const [settings, setSettings] = useState<Settings>();
  const [soldPrice, setSoldPrice] = useState<string>(comic.recommendedPrice ?? "");
  const [shipCharged, setShipCharged] = useState<string>("");
  const [cost, setCost] = useState<string>(comic.costBasis != null ? String(comic.costBasis) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    api.getSettings().then((s) => {
      setSettings(s);
      setShipCharged(String(s.shippingCharged));
    }).catch(() => undefined);
  }, []);

  if (comic.status === "SOLD") {
    return (
      <div className="card">
        <h3>Sold</h3>
        <div className="kv" style={{ gridTemplateColumns: "1fr auto" }}>
          <span className="k">Sold price</span>
          <span className="mono right">{usd(comic.soldPrice ?? 0)}</span>
          <span className="k">Net proceeds</span>
          <span className="mono right">{usd(comic.soldNet ?? 0)}</span>
          <span className="k">Cost basis</span>
          <span className="mono right">{comic.costBasis != null ? usd(comic.costBasis) : "—"}</span>
          <span className="k" style={{ fontWeight: 700 }}>Profit</span>
          <span className="mono right" style={{ fontWeight: 700, color: (comic.soldProfit ?? 0) >= 0 ? "var(--good)" : "var(--bad)" }}>
            {usd(comic.soldProfit ?? 0)}
          </span>
          <span className="k">Sold date</span>
          <span className="mono right">{comic.soldAt ? new Date(comic.soldAt).toLocaleDateString() : "—"}</span>
        </div>
        <div className="spacer" />
        <button
          className="secondary"
          disabled={busy}
          onClick={async () => {
            if (!confirm("Undo this sale? The comic goes back to Ready.")) return;
            setBusy(true);
            setError(undefined);
            try {
              await api.unsell(comic.id);
              await onChange();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Undo sale
        </button>
        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  const preview = settings
    ? computeProfit(Number(soldPrice) || 0, settings, {
        shippingCharged: shipCharged === "" ? undefined : Number(shipCharged),
      })
    : null;
  const profit = preview ? preview.net - (Number(cost) || 0) : 0;

  async function sell() {
    setBusy(true);
    setError(undefined);
    try {
      await api.sell(comic.id, {
        soldPrice: Number(soldPrice) || 0,
        shippingCharged: shipCharged === "" ? undefined : Number(shipCharged),
        costBasis: cost === "" ? undefined : Number(cost),
      });
      await onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h3>Record a sale</h3>
      <div className="row">
        <div className="col">
          <label>Sale price ($)</label>
          <input type="number" value={soldPrice} onChange={(e) => setSoldPrice(e.target.value)} />
        </div>
        <div className="col">
          <label>Shipping charged ($)</label>
          <input type="number" value={shipCharged} onChange={(e) => setShipCharged(e.target.value)} />
        </div>
        <div className="col">
          <label>Your cost ($)</label>
          <input type="number" value={cost} onChange={(e) => setCost(e.target.value)} />
        </div>
      </div>
      {preview && (
        <p className="muted" style={{ fontSize: 13 }}>
          Net after fees/shipping: <b>{usd(preview.net)}</b> · Profit:{" "}
          <b style={{ color: profit >= 0 ? "var(--good)" : "var(--bad)" }}>{usd(profit)}</b>
        </p>
      )}
      <div className="spacer" />
      <button onClick={sell} disabled={busy || !soldPrice}>
        Mark sold
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
