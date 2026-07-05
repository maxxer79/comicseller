import { useEffect, useState } from "react";
import { api, type VersionInfo } from "../../api";

export function SystemAdmin() {
  const [version, setVersion] = useState<VersionInfo>();
  const [error, setError] = useState<string>();
  const [backing, setBacking] = useState(false);

  useEffect(() => {
    api.version().then(setVersion).catch((e) => setError((e as Error).message));
  }, []);

  async function backup() {
    setBacking(true);
    setError(undefined);
    try {
      const blob = await api.exportInventoryCsv("ALL");
      const stamp = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `comicseller-backup-${stamp}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBacking(false);
    }
  }

  return (
    <div>
      {error && <p className="error">{error}</p>}

      <div className="card">
        <h3>Version &amp; build</h3>
        {version ? (
          <div className="kv">
            <span className="k">Version</span>
            <span className="mono">{version.version}</span>
            <span className="k">Build (git sha)</span>
            <span className="mono">{version.buildSha}</span>
            <span className="k">Build time</span>
            <span className="mono">{version.buildTime || "—"}</span>
            <span className="k">Environment</span>
            <span className="mono">{version.nodeEnv}</span>
          </div>
        ) : (
          <p className="muted">Loading…</p>
        )}
      </div>

      <div className="card" style={{ maxWidth: 560 }}>
        <h3>Data &amp; backup</h3>
        <p className="muted" style={{ fontSize: 13 }}>
          Download a full CSV of your entire catalog — every field for every comic. Keep a copy
          off the NAS as a safety net.
        </p>
        <button onClick={backup} disabled={backing}>
          {backing ? "Preparing…" : "⬇ Download full backup (CSV)"}
        </button>
      </div>
    </div>
  );
}
