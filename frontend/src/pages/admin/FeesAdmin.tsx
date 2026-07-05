import { useEffect, useState } from "react";
import { api, type Settings } from "../../api";

export function FeesAdmin() {
  const [settings, setSettings] = useState<Settings>();
  const [error, setError] = useState<string>();
  const [msg, setMsg] = useState<string>();

  useEffect(() => {
    api.getSettings().then(setSettings).catch((e) => setError((e as Error).message));
  }, []);

  async function save() {
    if (!settings) return;
    setError(undefined);
    setMsg(undefined);
    try {
      const s = await api.updateSettings({
        feePercent: settings.feePercent,
        perOrderFee: settings.perOrderFee,
        shippingCost: settings.shippingCost,
        shippingCharged: settings.shippingCharged,
      });
      setSettings(s);
      setMsg("Fees & shipping saved.");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!settings) return <p className="muted">Loading…</p>;

  return (
    <div>
      {error && <p className="error">{error}</p>}
      {msg && <p className="success">{msg}</p>}

      <div className="card" style={{ maxWidth: 560 }}>
        <h3>Fees &amp; shipping</h3>
        <p className="muted" style={{ fontSize: 13 }}>
          Used by the profit calculator on each comic and the Sales P&amp;L.
        </p>
        <div className="row">
          <div className="col">
            <label>eBay fee %</label>
            <input type="number" step="0.01" value={settings.feePercent}
              onChange={(e) => setSettings({ ...settings, feePercent: Number(e.target.value) })} />
          </div>
          <div className="col">
            <label>Per-order fee ($)</label>
            <input type="number" step="0.01" value={settings.perOrderFee}
              onChange={(e) => setSettings({ ...settings, perOrderFee: Number(e.target.value) })} />
          </div>
        </div>
        <div className="row">
          <div className="col">
            <label>Your shipping cost ($)</label>
            <input type="number" step="0.01" value={settings.shippingCost}
              onChange={(e) => setSettings({ ...settings, shippingCost: Number(e.target.value) })} />
          </div>
          <div className="col">
            <label>Shipping charged to buyer ($)</label>
            <input type="number" step="0.01" value={settings.shippingCharged}
              onChange={(e) => setSettings({ ...settings, shippingCharged: Number(e.target.value) })} />
          </div>
        </div>
        <div className="spacer" />
        <button onClick={save}>Save fees</button>
      </div>
    </div>
  );
}
