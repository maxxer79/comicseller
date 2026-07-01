import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

type Result = Awaited<ReturnType<typeof api.importCsv>>;

/**
 * Bulk import from a CLZ / CovrPrice CSV export. Always preview (dry run)
 * first, then import for real.
 */
export function ImportCsv() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Result>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [imported, setImported] = useState(false);

  async function run(dryRun: boolean) {
    if (!file) return;
    setBusy(true);
    setError(undefined);
    try {
      const res = await api.importCsv(file, dryRun);
      setResult(res);
      setImported(!dryRun);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 720 }}>
      <h2>Import CSV</h2>
      <p className="muted">
        Export from CLZ (with CovrPrice values) or any spreadsheet. Recognized
        columns include: Title, Issue, Publisher, Year, Grade, Value/FMV, Trend,
        Key. Preview first, then import.
      </p>

      <label>CSV file</label>
      <input
        type="file"
        accept=".csv,text/csv"
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null);
          setResult(undefined);
          setImported(false);
        }}
      />

      <div className="spacer" />
      <div className="pill-row">
        <button className="secondary" onClick={() => run(true)} disabled={busy || !file}>
          Preview (dry run)
        </button>
        <button onClick={() => run(false)} disabled={busy || !file}>
          Import for real
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {result && (
        <div className="card" style={{ background: "var(--panel-2)" }}>
          {imported ? (
            <p className="success">
              Imported {result.imported} comic(s). {result.rowsSkipped} row(s) skipped.{" "}
              <Link to="/">View inventory →</Link>
            </p>
          ) : (
            <p className="muted">
              Dry run: {result.willImport} row(s) will import, {result.rowsSkipped} skipped.
            </p>
          )}
          {result.unmatchedHeaders.length > 0 && (
            <p className="muted" style={{ fontSize: 12 }}>
              Ignored columns: {result.unmatchedHeaders.join(", ")}
            </p>
          )}
          {result.preview && result.preview.length > 0 && (
            <pre className="mono" style={{ fontSize: 12, overflow: "auto" }}>
              {JSON.stringify(result.preview, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
