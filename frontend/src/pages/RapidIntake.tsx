import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { BarcodeScanner } from "../components/BarcodeScanner";

interface AddedItem {
  id: string;
  label: string;
  upc: string | null;
}

/**
 * Rapid intake — optimized for cataloging a stack quickly. A barcode scanner
 * (which types the code then presses Enter) will create the comic, auto-fill
 * the title from GCD, reset the form, and refocus — one comic per scan.
 */
export function RapidIntake() {
  const [upc, setUpc] = useState("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [location, setLocation] = useState("");
  const [note, setNote] = useState<string>();
  const [dup, setDup] = useState<string>();
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [added, setAdded] = useState<AddedItem[]>([]);

  const upcRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    upcRef.current?.focus();
  }, []);

  async function feedback(code: string) {
    setDup(undefined);
    setNote(undefined);
    if (!code) return;
    try {
      const d = await api.findByUpc(code);
      if (d.total > 0) setDup(`Already have ${d.total} with this UPC.`);
    } catch {
      /* non-fatal */
    }
    try {
      const res = await api.lookupUpc(code);
      if (res.found && res.match) {
        const m = res.match;
        setTitle((t) => t || m.series);
        setNote(
          `Matched: ${m.series}${m.number ? " #" + m.number : ""}` +
            `${m.publisher ? " · " + m.publisher : ""} (GCD)`
        );
      }
    } catch {
      /* non-fatal */
    }
  }

  async function onDetected(code: string) {
    setUpc(code);
    setScanning(false);
    await feedback(code);
    upcRef.current?.focus();
  }

  function reset(keepLocation: boolean) {
    setUpc("");
    setTitle("");
    setFile(null);
    setNote(undefined);
    setDup(undefined);
    if (!keepLocation) setLocation("");
    if (fileRef.current) fileRef.current.value = "";
    upcRef.current?.focus();
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const rawUpc = upc.trim();
    let useTitle = title.trim();
    if (!rawUpc && !useTitle && !file) {
      setError("Scan a UPC, type a title, or attach a photo first.");
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      // If we only have a UPC, try GCD so the created comic gets a real title.
      if (rawUpc && !useTitle) {
        try {
          const res = await api.lookupUpc(rawUpc);
          if (res.found && res.match) useTitle = res.match.series;
        } catch {
          /* non-fatal */
        }
      }
      const c = await api.createComic(file, useTitle || undefined, rawUpc || undefined);
      if (location.trim()) {
        try {
          await api.updateComic(c.id, { location: location.trim() });
        } catch {
          /* non-fatal */
        }
      }
      const label =
        c.title && c.title !== "Untitled" ? c.title : rawUpc || "Untitled";
      setAdded((prev) => [{ id: c.id, label, upc: c.upc }, ...prev]);
      reset(true); // keep location for the rest of the box
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>⚡ Rapid intake</h2>
        <Link to="/intake"><button className="secondary">Single add (with AI)</button></Link>
      </div>
      <p className="muted" style={{ fontSize: 13 }}>
        Point a barcode scanner at each cover and it will add itself. Set a location once and it
        sticks for the whole box. You can identify photos and set prices later from Inventory.
      </p>

      <div className="row" style={{ alignItems: "flex-start" }}>
        <form className="card col" style={{ maxWidth: 460 }} onSubmit={add}>
          <label>UPC / barcode</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              ref={upcRef}
              value={upc}
              onChange={(e) => setUpc(e.target.value)}
              onBlur={(e) => feedback(e.target.value.trim())}
              placeholder="Scan or type, then Enter"
              autoComplete="off"
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
          {dup && <p className="warn" style={{ color: "var(--warn)", fontSize: 13 }}>{dup}</p>}
          {note && <p className="success" style={{ fontSize: 13 }}>{note}</p>}

          <label>Title (optional)</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Auto-filled from UPC when possible"
          />

          <div className="row">
            <div className="col">
              <label>Location (sticks for the box)</label>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Box 12 / Shelf A"
              />
            </div>
            <div className="col">
              <label>Photo (optional)</label>
              <input ref={fileRef} type="file" accept="image/*" capture="environment"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
          </div>

          <div className="spacer" />
          {error && <p className="error">{error}</p>}
          <div className="pill-row">
            <button type="submit" disabled={busy}>{busy ? "Adding…" : "Add & next"}</button>
            <button type="button" className="secondary" onClick={() => reset(false)} disabled={busy}>
              Clear
            </button>
          </div>
        </form>

        <div className="card col">
          <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
            <h3 style={{ margin: 0 }}>Added this session</h3>
            <span className="badge accent">{added.length}</span>
          </div>
          {added.length === 0 ? (
            <p className="muted">Nothing yet — scan your first comic.</p>
          ) : (
            <table>
              <tbody>
                {added.map((a) => (
                  <tr key={a.id}>
                    <td><Link to={`/comics/${a.id}`}>{a.label}</Link></td>
                    <td className="muted" style={{ fontSize: 12 }}>{a.upc ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {scanning && <BarcodeScanner onDetected={onDetected} onClose={() => setScanning(false)} />}
    </div>
  );
}
