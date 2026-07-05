import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { Progress } from "../components/Spinner";
import { BarcodeScanner } from "../components/BarcodeScanner";

export function Intake() {
  const nav = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>();
  const [title, setTitle] = useState("");
  const [upc, setUpc] = useState("");
  const [dupWarning, setDupWarning] = useState<string>();
  const [matchNote, setMatchNote] = useState<string>();
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<string>();
  const [error, setError] = useState<string>();

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : undefined);
  }

  async function onDetected(code: string) {
    setUpc(code);
    setScanning(false);
    setDupWarning(undefined);
    setMatchNote(undefined);
    try {
      const dup = await api.findByUpc(code);
      if (dup.total > 0) {
        setDupWarning(
          `Heads up: you already have ${dup.total} comic(s) with this UPC in inventory.`
        );
      }
    } catch {
      /* non-fatal */
    }
    try {
      const res = await api.lookupUpc(code);
      if (res.found && res.match) {
        const m = res.match;
        setTitle((t) => t || m.series);
        setMatchNote(
          `Matched: ${m.series}${m.number ? " #" + m.number : ""}` +
            `${m.publisher ? " · " + m.publisher : ""}${m.year ? " · " + m.year : ""} (GCD)`
        );
      } else if (res.datasetSize === 0) {
        setMatchNote("No GCD data loaded yet — see docs/gcd-upc-lookup.md to enable auto-fill.");
      }
    } catch {
      /* non-fatal */
    }
  }

  async function submit(runIdentify: boolean) {
    setBusy(true);
    setError(undefined);
    try {
      setStep("Creating intake…");
      const comic = await api.createComic(file, title || undefined, upc || undefined);
      if (runIdentify && file) {
        setStep("Identifying from photo…");
        try {
          await api.identify(comic.id);
        } catch (e) {
          console.warn("identify failed", e);
        }
      }
      nav(`/comics/${comic.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 640 }}>
      <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>Add a comic</h2>
        <Link to="/intake/rapid"><button type="button" className="secondary">⚡ Rapid mode</button></Link>
      </div>

      <div className="row">
        <div className="col">
          <label>Cover photo</label>
          <input type="file" accept="image/*" capture="environment" onChange={onFile} />

          <label>UPC / barcode</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={upc}
              onChange={(e) => setUpc(e.target.value)}
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
          {dupWarning && (
            <p className="warn" style={{ color: "var(--warn)", fontSize: 13 }}>
              {dupWarning}
            </p>
          )}
          {matchNote && (
            <p className="success" style={{ fontSize: 13 }}>
              {matchNote}
            </p>
          )}

          <label>Title (optional — AI can fill this in)</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. The Amazing Spider-Man"
          />
        </div>
        <div className="col" style={{ maxWidth: 200 }}>
          {preview ? (
            <img className="cover" src={preview} alt="preview" />
          ) : (
            <div className="cover" style={{ height: 260 }} />
          )}
        </div>
      </div>

      <div className="spacer" />
      {error && <p className="error">{error}</p>}
      {busy && <Progress label={step ?? "Working…"} />}

      {!busy && (
        <div className="pill-row">
          <button onClick={() => submit(true)} disabled={!file}>
            Create &amp; identify with AI
          </button>
          <button className="secondary" onClick={() => submit(false)}>
            Create without AI
          </button>
        </div>
      )}
      <p className="muted" style={{ fontSize: 12 }}>
        On a phone, the photo button opens your camera. AI identification needs a
        photo and a configured API key (or VISION_MOCK=1). You'll confirm
        everything on the next screen.
      </p>

      {scanning && (
        <BarcodeScanner onDetected={onDetected} onClose={() => setScanning(false)} />
      )}
    </div>
  );
}
