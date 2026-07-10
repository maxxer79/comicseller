import { useEffect, useState } from "react";
import { api, type GcdStatus, type GcdImportResult } from "../../api";

export function GcdAdmin() {
  const [status, setStatus] = useState<GcdStatus>();
  const [file, setFile] = useState<File | null>(null);
  const [path, setPath] = useState("");
  const [replace, setReplace] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [msg, setMsg] = useState<string>();

  async function loadStatus() {
    try {
      setStatus(await api.gcdStatus());
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    loadStatus();
  }, []);

  function done(r: GcdImportResult) {
    setStatus({ datasetSize: r.datasetSize, lastUpdated: r.lastUpdated, ready: r.datasetSize > 0 });
    setMsg(`Imported ${r.imported.toLocaleString()} rows (skipped ${r.skipped.toLocaleString()}). Total now ${r.datasetSize.toLocaleString()}.`);
  }

  async function importUpload() {
    if (!file) return;
    setBusy(true); setError(undefined); setMsg(undefined);
    try {
      done(await api.gcdImportUpload(file, replace));
      setFile(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function importPath() {
    if (!path.trim()) return;
    setBusy(true); setError(undefined); setMsg(undefined);
    try {
      done(await api.gcdImportPath(path.trim(), replace));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {error && <p className="error">{error}</p>}
      {msg && <p className="success">{msg}</p>}

      <div className="card" style={{ maxWidth: 680 }}>
        <h3>UPC / GCD data</h3>
        <p className="muted" style={{ fontSize: 13 }}>
          Local barcode → metadata lookup. When loaded, scanning a comic fills in
          title/issue/publisher/year from this data first, and only falls back to
          the AI cover read when there's no match.
        </p>
        <p style={{ fontSize: 14 }}>
          Rows loaded: <b>{status ? status.datasetSize.toLocaleString() : "…"}</b>
          {status?.lastUpdated && (
            <span className="muted"> · last updated {new Date(status.lastUpdated).toLocaleString()}</span>
          )}
        </p>
      </div>

      <div className="card" style={{ maxWidth: 680 }}>
        <h3>Upload a barcode CSV</h3>
        <p className="muted" style={{ fontSize: 12 }}>
          Upload the prepared <code>gcd_barcodes.csv</code> (columns: barcode, series,
          number, publisher, year). See <code>docs/gcd-upc-lookup.md</code> for how to
          export it from the GCD PostgreSQL dump.
        </p>
        <input type="file" accept=".csv,.tsv,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
          <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
          Replace existing data (recommended for a full refresh)
        </label>
        <div className="spacer" />
        <button onClick={importUpload} disabled={busy || !file}>
          {busy ? "Importing…" : "Upload & import"}
        </button>
      </div>

      <div className="card" style={{ maxWidth: 680 }}>
        <h3>Import from a file on the server</h3>
        <p className="muted" style={{ fontSize: 12 }}>
          If the CSV is already on the server (e.g. a big file you copied to the box),
          give its absolute path instead of uploading.
        </p>
        <input value={path} onChange={(e) => setPath(e.target.value)} placeholder="/data/gcd_barcodes.csv" />
        <div className="spacer" />
        <button className="secondary" onClick={importPath} disabled={busy || !path.trim()}>
          {busy ? "Importing…" : "Import from path"}
        </button>
      </div>
    </div>
  );
}
