import { useEffect, useState } from "react";
import { api, type Settings } from "../../api";

export function EbayAdmin() {
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
        ebayCategoryId: settings.ebayCategoryId,
        ebayConditionId: settings.ebayConditionId,
        ebayDuration: settings.ebayDuration,
        ebayShippingProfile: settings.ebayShippingProfile,
        ebayPaymentProfile: settings.ebayPaymentProfile,
        ebayReturnProfile: settings.ebayReturnProfile,
        ebayFreeShippingProfile: settings.ebayFreeShippingProfile,
        publicBaseUrl: settings.publicBaseUrl,
      });
      setSettings(s);
      setMsg("eBay settings saved.");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!settings) return <p className="muted">Loading…</p>;

  return (
    <div>
      {error && <p className="error">{error}</p>}
      {msg && <p className="success">{msg}</p>}

      <div className="card" style={{ maxWidth: 620 }}>
        <h3>eBay bulk export</h3>
        <p className="muted" style={{ fontSize: 13 }}>
          Used for the Seller Hub Reports CSV. Enter your eBay Business Policy names exactly as they
          appear in eBay.
        </p>
        <div className="row">
          <div className="col">
            <label>Category ID</label>
            <input value={settings.ebayCategoryId} onChange={(e) => setSettings({ ...settings, ebayCategoryId: e.target.value })} />
          </div>
          <div className="col">
            <label>Condition ID</label>
            <input value={settings.ebayConditionId} onChange={(e) => setSettings({ ...settings, ebayConditionId: e.target.value })} />
          </div>
          <div className="col">
            <label>Duration</label>
            <input value={settings.ebayDuration} onChange={(e) => setSettings({ ...settings, ebayDuration: e.target.value })} />
          </div>
        </div>
        <div className="row">
          <div className="col">
            <label>Shipping policy</label>
            <input value={settings.ebayShippingProfile} onChange={(e) => setSettings({ ...settings, ebayShippingProfile: e.target.value })} />
          </div>
          <div className="col">
            <label>Payment policy</label>
            <input value={settings.ebayPaymentProfile} onChange={(e) => setSettings({ ...settings, ebayPaymentProfile: e.target.value })} />
          </div>
          <div className="col">
            <label>Return policy</label>
            <input value={settings.ebayReturnProfile} onChange={(e) => setSettings({ ...settings, ebayReturnProfile: e.target.value })} />
          </div>
        </div>
        <label>Free-shipping policy (business policy used for free-shipping items)</label>
        <input value={settings.ebayFreeShippingProfile} onChange={(e) => setSettings({ ...settings, ebayFreeShippingProfile: e.target.value })} placeholder="e.g. Free Shipping" />
        <p className="muted" style={{ fontSize: 12 }}>Create a free-shipping business policy in eBay and put its exact name here. Items marked free shipping use it; others use the Shipping policy above.</p>
        <label>Public base URL (for photo links, e.g. https://comics.example.com)</label>
        <input value={settings.publicBaseUrl} onChange={(e) => setSettings({ ...settings, publicBaseUrl: e.target.value })} placeholder="https://…" />
        <div className="spacer" />
        <button onClick={save}>Save eBay settings</button>
      </div>
    </div>
  );
}
