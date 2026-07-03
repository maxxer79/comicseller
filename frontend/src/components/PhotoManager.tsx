import { useRef, useState } from "react";
import { api, type Photo } from "../api";
import { Spinner } from "./Spinner";

const KINDS = ["FRONT", "BACK", "DETAIL", "SLAB"] as const;
const KIND_LABEL: Record<string, string> = {
  FRONT: "Front",
  BACK: "Back",
  DETAIL: "Detail",
  SLAB: "Slab",
};

/**
 * Photo gallery for a comic: primary image, thumbnail strip, and controls to
 * add (with a kind), set primary, or delete. Calls onChange to refresh the
 * parent after any mutation.
 */
export function PhotoManager({
  comicId,
  photos,
  onChange,
}: {
  comicId: string;
  photos: Photo[];
  onChange: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<string>("FRONT");
  const [error, setError] = useState<string>();
  const fileRef = useRef<HTMLInputElement>(null);

  const primary = photos.find((p) => p.isPrimary) ?? photos[0];

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(undefined);
    try {
      await fn();
      await onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    await run(() => api.addPhoto(comicId, f, kind));
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div>
      {primary?.url ? (
        <img className="cover" src={primary.url} alt="" />
      ) : (
        <div className="cover" style={{ height: 240, display: "grid", placeItems: "center" }}>
          <span className="muted" style={{ fontSize: 12 }}>No photo</span>
        </div>
      )}

      {photos.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          {photos.map((p) => (
            <div key={p.id} style={{ textAlign: "center" }}>
              {p.url && (
                <img
                  className="thumb"
                  src={p.url}
                  alt=""
                  style={{
                    outline: p.isPrimary ? "2px solid var(--accent)" : "none",
                    outlineOffset: 1,
                  }}
                />
              )}
              <div className="muted" style={{ fontSize: 10 }}>{KIND_LABEL[p.kind] ?? p.kind}</div>
              <div style={{ display: "flex", gap: 4, justifyContent: "center", marginTop: 2 }}>
                {!p.isPrimary && (
                  <button
                    className="ghost"
                    style={{ padding: "2px 6px", fontSize: 11 }}
                    disabled={busy}
                    title="Set as primary"
                    onClick={() => run(() => api.updatePhoto(comicId, p.id, { isPrimary: true }))}
                  >
                    ★
                  </button>
                )}
                <button
                  className="ghost"
                  style={{ padding: "2px 6px", fontSize: 11, color: "var(--bad)" }}
                  disabled={busy}
                  title="Delete photo"
                  onClick={() => {
                    if (confirm("Delete this photo?")) run(() => api.deletePhoto(comicId, p.id));
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="spacer" />
      <label>Add photo</label>
      <select value={kind} onChange={(e) => setKind(e.target.value)} style={{ marginBottom: 6 }}>
        {KINDS.map((k) => (
          <option key={k} value={k}>
            {KIND_LABEL[k]}
          </option>
        ))}
      </select>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={upload}
        disabled={busy}
      />
      {busy && (
        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
          <Spinner /> Uploading…
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
