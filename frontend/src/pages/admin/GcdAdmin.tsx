import { useEffect, useState } from "react";
import { api, type GcdStatus } from "../../api";

export function GcdAdmin() {
  const [status, setStatus] = useState<GcdStatus>();
  const [file, setFile] = useState<File | null>(null);
  const [path, setPath] = useState("");
  const [replace, setReplace] = useState(true);
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

  // Poll while an import is running so progress updates live.
  useEffect(() => {
    if (status?.job?.status !== "running") return;
    const id = setInterval(loadStatus, 3000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.job?.status]);

  const job = status?.job;
  const running = job?.status === "running";

  async function startUpload() {
    if (!file) return;
    setError(undefined); setMsg(undefined);
    try {
      await api.gcdImportUpload(file, replace);
      setFile(null);
      setMsg("Import started — it runs in the background; progress updates below.");
      await loadStatus();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function startPath() {
    if (!path.trim()) return;
    setError(undefined); setMsg(undefined);
    try {
      await api.gcdImportPath(path.trim(), replace);
      setMsg("Import started — it runs in the background; progress updates below.");
      await loadStatus();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div>
      {error && <p className="error">{error}</p>}
      {msg && <p className="success">{msg}</p>}

      <div className="card" style={{ maxWidth: 680 }}>
        <h3>UPC / GCD data</h3>
        <p className="muted" style={{ fontSize: 13 }}>
          Local barcode &amp; title lookups. When loaded, adding a comic fills in
          title/issue/publisher/year from this data first, and only falls back to
          the AI cover read when there's no match.
        </p>
        <p style={{ fontSize: 14 }}>
          Rows loaded: <b>{status ? status.datasetSize.toLocaleString() : "…"}</b>
          {status?.lastUpdated && (
            <span className="muted"> · last updated {new Date(status.lastUpdated).toLocaleString()}</span>
          )}
        </p>

        {job && job.status !== "idle" && (
          <p
            className={job.status === "error" ? "error" : job.status === "done" ? "success" : "muted"}
            style={{ fontSize: 13 }}
          >
            {job.status === "running" && (
              <>⏳ Importing… {job.imported.toLocaleString()} rows so far (skipped {job.skipped.toLocaleString()}). Safe to leave this page.</>
            )}
            {job.status === "done" && (
              <>✓ Import finished: {job.imported.toLocaleString()} rows (skipped {job.skipped.toLocaleString()}). Total now {(job.datasetSize ?? status?.datasetSize ?? 0).toLocaleString()}.</>
            )}
            {job.status === "error" && <>✗ Import failed: {job.error}</>}
          </p>
        )}
      </div>

      <div className="card" style={{ maxWidth: 680 }}>
        <h3>Upload a file (CSV or GCD .db)</h3>
        <p className="muted" style={{ fontSize: 12 }}>
          Upload the GCD SQLite <code>.db</code> directly (recommended — no CSV needed),
          or a prepared <code>gcd_barcodes.csv</code>. Big <code>.db</code> files are
          better loaded via the server path below or the CLI script — see
          <code>docs/gcd-upc-lookup.md</code>.
        </p>
        <input type="file" accept=".csv,.tsv,.db,.sqlite,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
          <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
          Replace existing data (recommended for a full refresh)
        </label>
        <div className="spacer" />
        <button onClick={startUpload} disabled={running || !file}>
          {running ? "Import running…" : "Upload & import"}
        </button>
      </div>

      <div className="card" style={{ maxWidth: 680 }}>
        <h3>Import from a file on the server</h3>
        <p className="muted" style={{ fontSize: 12 }}>
          If the file (CSV or GCD .db) is already on the server (e.g. a big .db you
          copied to the box), give its absolute path instead of uploading.
        </p>
        <input value={path} onChange={(e) => setPath(e.target.value)} placeholder="/data/gcd.db  (or /data/gcd_barcodes.csv)" />
        <div className="spacer" />
        <button className="secondary" onClick={startPath} disabled={running || !path.trim()}>
          {running ? "Import running…" : "Import from path"}
        </button>
      </div>
    </div>
  );
}
