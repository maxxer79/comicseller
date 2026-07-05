import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type Comic, type Trend } from "../api";
import { buildEbayTitle, buildEbayDescription } from "../lib/ebay";
import { Progress } from "../components/Spinner";
import { BarcodeScanner } from "../components/BarcodeScanner";
import { PhotoManager } from "../components/PhotoManager";
import { ProfitCalculator } from "../components/ProfitCalculator";
import { SaleManager } from "../components/SaleManager";

function money(v: string | null): string {
  return v === null ? "—" : `$${Number(v).toFixed(2)}`;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="secondary"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "Copied!" : label}
    </button>
  );
}

export function ComicDetail() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [comic, setComic] = useState<Comic>();
  const [error, setError] = useState<string>();
  const [msg, setMsg] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);

  const [form, setForm] = useState<Partial<Comic>>({});
  const [cook, setCook] = useState({ targetPrice: "", holdUntil: "", watchNote: "" });
  const [price, setPrice] = useState({
    medianPrice: "",
    lowPrice: "",
    highPrice: "",
    salesPerMonth: "",
    trend: "UNKNOWN" as Trend,
  });

  async function load() {
    if (!id) return;
    try {
      const c = await api.getComic(id);
      setComic(c);
      setForm({
        title: c.title,
        issueNumber: c.issueNumber,
        publisher: c.publisher,
        variant: c.variant,
        year: c.year,
        upc: c.upc,
        location: c.location,
        costBasis: c.costBasis,
        keyIssue: c.keyIssue,
        keyNotes: c.keyNotes,
        grade: c.grade,
        graded: c.graded,
        gradingCompany: c.gradingCompany,
      });
      setCook({
        targetPrice: c.targetPrice != null ? String(c.targetPrice) : "",
        holdUntil: c.holdUntil ? c.holdUntil.slice(0, 10) : "",
        watchNote: c.watchNote ?? "",
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) return <p className="error">{error}</p>;
  if (!comic) return <p className="muted">Loading…</p>;

  const primary = comic.photos.find((p) => p.isPrimary) ?? comic.photos[0];
  const snap = comic.priceSnapshots[0];

  async function runIdentify() {
    if (!id) return;
    setBusy(true);
    setMsg(undefined);
    setError(undefined);
    try {
      const { suggestion } = await api.identify(id);
      setMsg(
        `AI suggests: ${suggestion.title ?? "?"} ${
          suggestion.issueNumber ? "#" + suggestion.issueNumber : ""
        } — suggested grade ${suggestion.suggestedGrade ?? "?"} (confidence ${(
          suggestion.confidence * 100
        ).toFixed(0)}%). Review and confirm below.`
      );
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveMeta() {
    if (!id) return;
    setBusy(true);
    setMsg(undefined);
    setError(undefined);
    try {
      const patch: Partial<Comic> = {
        ...form,
        year: form.year ? Number(form.year) : null,
        grade: form.grade ? Number(form.grade) : null,
      };
      await api.updateComic(id, patch);
      setMsg("Saved.");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function savePrice() {
    if (!id) return;
    setBusy(true);
    setMsg(undefined);
    setError(undefined);
    try {
      const body: Parameters<typeof api.addPrice>[1] = { source: "MANUAL", trend: price.trend };
      if (price.medianPrice) body.medianPrice = Number(price.medianPrice);
      if (price.lowPrice) body.lowPrice = Number(price.lowPrice);
      if (price.highPrice) body.highPrice = Number(price.highPrice);
      if (price.salesPerMonth) body.salesPerMonth = Number(price.salesPerMonth);
      await api.addPrice(id, body);
      setMsg("Price comps saved — recommendation updated.");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveCook() {
    if (!id) return;
    setBusy(true);
    setMsg(undefined);
    setError(undefined);
    try {
      await api.updateComic(id, {
        watching: true,
        targetPrice: cook.targetPrice ? Number(cook.targetPrice) : null,
        holdUntil: cook.holdUntil || null,
        watchNote: cook.watchNote || null,
      });
      setMsg("Added to the cook list.");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function stopCook() {
    if (!id) return;
    setBusy(true);
    setError(undefined);
    try {
      await api.updateComic(id, { watching: false });
      setMsg("Removed from the cook list.");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function markReady() {
    if (!id) return;
    setBusy(true);
    try {
      await api.updateComic(id, { status: "READY" as Comic["status"] });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!id || !confirm("Delete this comic and its photos?")) return;
    await api.deleteComic(id);
    nav("/");
  }

  const set = (k: keyof Comic, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const ebayTitle = buildEbayTitle(comic);
  const ebayDesc = buildEbayDescription(comic);

  return (
    <div>
      <div className="pill-row">
        <span className="badge">{comic.status}</span>
        <span className="muted mono">SKU {comic.sku.slice(0, 8)}</span>
        <div style={{ marginLeft: "auto" }}>
          <button className="secondary" onClick={remove}>
            Delete
          </button>
        </div>
      </div>

      {msg && <p className="success">{msg}</p>}
      {error && <p className="error">{error}</p>}
      {busy && <Progress label="Working…" />}

      {scanning && (
        <BarcodeScanner
          onDetected={async (code) => {
            set("upc", code);
            setScanning(false);
            try {
              const res = await api.lookupUpc(code);
              if (res.found && res.match) {
                const m = res.match;
                setForm((f) => ({
                  ...f,
                  title: f.title && f.title !== "Untitled" ? f.title : m.series,
                  issueNumber: f.issueNumber ?? m.number,
                  publisher: f.publisher ?? m.publisher,
                  year: f.year ?? m.year,
                }));
                setMsg(
                  `Matched via GCD: ${m.series}${m.number ? " #" + m.number : ""} — review and save.`
                );
              }
            } catch {
              /* non-fatal */
            }
          }}
          onClose={() => setScanning(false)}
        />
      )}

      <div className="row">
        <div className="col" style={{ maxWidth: 240 }}>
          <div className="card">
            <PhotoManager comicId={comic.id} photos={comic.photos} onChange={load} />
            <div className="spacer" />
            <button className="secondary" onClick={runIdentify} disabled={busy || !primary}>
              {busy ? "Working…" : "Identify with AI"}
            </button>
          </div>
        </div>

        <div className="col">
          <div className="card">
            <h3>Details (confirm)</h3>
            {comic.aiSuggestedGrade !== null && (
              <p className="muted" style={{ fontSize: 13 }}>
                AI suggested grade: <b>{comic.aiSuggestedGrade}</b> — set the confirmed grade below.
              </p>
            )}
            <div className="row">
              <div className="col">
                <label>Title</label>
                <input value={form.title ?? ""} onChange={(e) => set("title", e.target.value)} />
              </div>
              <div className="col" style={{ maxWidth: 120 }}>
                <label>Issue #</label>
                <input
                  value={form.issueNumber ?? ""}
                  onChange={(e) => set("issueNumber", e.target.value || null)}
                />
              </div>
            </div>
            <div className="row">
              <div className="col">
                <label>Publisher</label>
                <input
                  value={form.publisher ?? ""}
                  onChange={(e) => set("publisher", e.target.value || null)}
                />
              </div>
              <div className="col" style={{ maxWidth: 120 }}>
                <label>Year</label>
                <input
                  type="number"
                  value={form.year ?? ""}
                  onChange={(e) => set("year", e.target.value ? Number(e.target.value) : null)}
                />
              </div>
            </div>
            <div className="row">
              <div className="col">
                <label>Variant</label>
                <input
                  value={form.variant ?? ""}
                  onChange={(e) => set("variant", e.target.value || null)}
                />
              </div>
              <div className="col" style={{ maxWidth: 140 }}>
                <label>Confirmed grade (0.5–10)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="10"
                  value={form.grade ?? ""}
                  onChange={(e) => set("grade", e.target.value ? Number(e.target.value) : null)}
                />
              </div>
            </div>
            <div className="row">
              <div className="col">
                <label>UPC / barcode</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    value={form.upc ?? ""}
                    onChange={(e) => set("upc", e.target.value || null)}
                    placeholder="Scan or type"
                  />
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setScanning(true)}
                    style={{ whiteSpace: "nowrap" }}
                  >
                    📷 Scan
                  </button>
                </div>
              </div>
            </div>
            <div className="row">
              <div className="col" style={{ maxWidth: 260 }}>
                <label>Box / location</label>
                <input
                  value={form.location ?? ""}
                  onChange={(e) => set("location", e.target.value || null)}
                  placeholder="e.g. Box 12 / Shelf A"
                />
              </div>
              <div className="col" style={{ maxWidth: 160 }}>
                <label>Cost basis ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.costBasis ?? ""}
                  onChange={(e) => set("costBasis", e.target.value ? Number(e.target.value) : null)}
                  placeholder="what you paid"
                />
              </div>
            </div>
            <div className="row">
              <div className="col" style={{ maxWidth: 160 }}>
                <label>Key issue?</label>
                <select
                  value={form.keyIssue ? "yes" : "no"}
                  onChange={(e) => set("keyIssue", e.target.value === "yes")}
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
              <div className="col">
                <label>Key notes</label>
                <input
                  value={form.keyNotes ?? ""}
                  onChange={(e) => set("keyNotes", e.target.value || null)}
                  placeholder="e.g. 1st app. of…"
                />
              </div>
            </div>
            <div className="row">
              <div className="col" style={{ maxWidth: 160 }}>
                <label>Professionally graded?</label>
                <select
                  value={form.graded ? "yes" : "no"}
                  onChange={(e) => set("graded", e.target.value === "yes")}
                >
                  <option value="no">Raw</option>
                  <option value="yes">Slabbed</option>
                </select>
              </div>
              <div className="col" style={{ maxWidth: 160 }}>
                <label>Grading company</label>
                <input
                  value={form.gradingCompany ?? ""}
                  onChange={(e) => set("gradingCompany", e.target.value || null)}
                  placeholder="CGC, CBCS…"
                />
              </div>
            </div>
            <div className="spacer" />
            <button onClick={saveMeta} disabled={busy}>
              Save details
            </button>
          </div>

          <div className="card">
            <h3>Price comps</h3>
            <p className="muted" style={{ fontSize: 13 }}>
              Paste values from CovrPrice / Key Collector for this book&apos;s grade.
            </p>
            <div className="row">
              <div className="col">
                <label>Median / FMV ($)</label>
                <input
                  type="number"
                  value={price.medianPrice}
                  onChange={(e) => setPrice({ ...price, medianPrice: e.target.value })}
                />
              </div>
              <div className="col">
                <label>Low ($)</label>
                <input
                  type="number"
                  value={price.lowPrice}
                  onChange={(e) => setPrice({ ...price, lowPrice: e.target.value })}
                />
              </div>
              <div className="col">
                <label>High ($)</label>
                <input
                  type="number"
                  value={price.highPrice}
                  onChange={(e) => setPrice({ ...price, highPrice: e.target.value })}
                />
              </div>
            </div>
            <div className="row">
              <div className="col">
                <label>Sales / month</label>
                <input
                  type="number"
                  value={price.salesPerMonth}
                  onChange={(e) => setPrice({ ...price, salesPerMonth: e.target.value })}
                />
              </div>
              <div className="col">
                <label>Trend</label>
                <select
                  value={price.trend}
                  onChange={(e) => setPrice({ ...price, trend: e.target.value as Trend })}
                >
                  <option value="UNKNOWN">Unknown</option>
                  <option value="RISING">Rising</option>
                  <option value="FLAT">Flat</option>
                  <option value="FALLING">Falling</option>
                </select>
              </div>
            </div>
            <div className="spacer" />
            <button onClick={savePrice} disabled={busy}>
              Save comps &amp; get recommendation
            </button>
            {snap && (
              <p className="muted" style={{ fontSize: 12 }}>
                Latest comps: median {money(snap.medianPrice)} · source {snap.source} ·{" "}
                {snap.trend ?? "—"}
              </p>
            )}
          </div>

          <div className="card">
            <h3>Recommendation</h3>
            {comic.recommendedPrice || comic.recommendationNote ? (
              <>
                <div className="pill-row">
                  <span className="badge good">Price {money(comic.recommendedPrice)}</span>
                  <span className="badge">
                    {comic.recommendedFormat === "AUCTION" ? "Auction" : "Buy It Now"}
                  </span>
                  <span className={`badge ${comic.recommendedAction === "SELL_NOW" ? "good" : "warn"}`}>
                    {comic.recommendedAction === "SELL_NOW" ? "Sell now" : "Hold / cook"}
                  </span>
                </div>
                <p className="rec-note">{comic.recommendationNote}</p>
              </>
            ) : (
              <p className="muted">Add price comps to generate a recommendation.</p>
            )}
          </div>

          <div className="card">
            <h3>🔥 Let it cook</h3>
            <p className="muted" style={{ fontSize: 13 }}>
              Hold this book for value to rise. It'll show on the{" "}
              <b>Let it cook</b> tracker, with a nudge when the revisit date arrives.
            </p>
            <div className="row">
              <div className="col" style={{ maxWidth: 160 }}>
                <label>Target price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={cook.targetPrice}
                  onChange={(e) => setCook({ ...cook, targetPrice: e.target.value })}
                  placeholder="price to wait for"
                />
              </div>
              <div className="col" style={{ maxWidth: 200 }}>
                <label>Revisit on</label>
                <input
                  type="date"
                  value={cook.holdUntil}
                  onChange={(e) => setCook({ ...cook, holdUntil: e.target.value })}
                />
              </div>
            </div>
            <label>Note</label>
            <input
              value={cook.watchNote}
              onChange={(e) => setCook({ ...cook, watchNote: e.target.value })}
              placeholder="why you're holding (e.g. movie rumor, spec play)"
            />
            <div className="spacer" />
            <div className="pill-row">
              <button onClick={saveCook} disabled={busy}>
                {comic.watching ? "Update cook plan" : "Let it cook 🔥"}
              </button>
              {comic.watching && (
                <button className="secondary" onClick={stopCook} disabled={busy}>
                  Stop watching
                </button>
              )}
            </div>
            {comic.watching && (
              <p className="muted" style={{ fontSize: 12 }}>On the cook list.</p>
            )}
          </div>

          <SaleManager comic={comic} onChange={load} />

          <ProfitCalculator recommendedPrice={comic.recommendedPrice} />

          <div className="card">
            <h3>eBay listing (copy &amp; paste)</h3>
            <label>Title ({ebayTitle.length}/80)</label>
            <input readOnly value={ebayTitle} />
            <div className="spacer" />
            <CopyButton text={ebayTitle} label="Copy title" />
            <div className="spacer" />
            <label>Description</label>
            <textarea readOnly value={ebayDesc} style={{ minHeight: 160 }} />
            <div className="spacer" />
            <CopyButton text={ebayDesc} label="Copy description" />
            {comic.recommendedPrice && (
              <>
                <div className="spacer" />
                <CopyButton text={String(comic.recommendedPrice)} label="Copy price" />
              </>
            )}
            <div className="spacer" />
            <button onClick={markReady} disabled={busy}>
              Mark ready to list
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
