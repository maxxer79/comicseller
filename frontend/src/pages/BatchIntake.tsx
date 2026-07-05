import { useState } from "react";
import { Link } from "react-router-dom";
import { api, type BatchDetectResult, type ComicStatus } from "../api";
import { Progress } from "../components/Spinner";

interface Item {
  id: string;
  cropUrl: string | null;
  title: string;
  publisher: string | null;
  confidence: number;
  status: ComicStatus;
  working: boolean;
  identified: boolean;
  note?: string;
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export function BatchIntake() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<string>();
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<BatchDetectResult | null>(null);
  const [items, setItems] = useState<Item[]>([]);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : undefined);
    setResult(null);
    setItems([]);
    setError(undefined);
  }

  async function detect() {
    if (!file) return;
    setBusy(true);
    setError(undefined);
    setStep("Finding comics in the photo…");
    try {
      const res = await api.batchDetect(file);
      setResult(res);
      setItems(
        res.comics.map((c) => ({
          id: c.comic.id,
          cropUrl: c.cropUrl,
          title: c.comic.title,
          publisher: c.comic.publisher ?? c.detection.publisher,
          confidence: c.detection.confidence,
          status: c.comic.status,
          working: false,
          identified: false,
        }))
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function discard(id: string) {
    const prev = items;
    setItems((list) => list.filter((i) => i.id !== id));
    try {
      await api.deleteComic(id);
    } catch (e) {
      setError((e as Error).message);
      setItems(prev); // put it back if the delete failed
    }
  }

  function setItem(id: string, patch: Partial<Item>) {
    setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  async function identifyOne(id: string) {
    setItem(id, { working: true, note: undefined });
    try {
      const { comic } = await api.identify(id);
      setItem(id, {
        working: false,
        identified: true,
        title: comic.title,
        publisher: comic.publisher,
        status: comic.status,
        note: comic.aiSuggestedGrade
          ? `AI grade ~${comic.aiSuggestedGrade}`
          : undefined,
      });
    } catch (e) {
      setItem(id, { working: false, note: (e as Error).message });
    }
  }

  async function identifyAll() {
    setBusy(true);
    setError(undefined);
    const todo = items.filter((i) => !i.identified);
    for (let n = 0; n < todo.length; n++) {
      setStep(`Identifying ${n + 1} of ${todo.length}…`);
      await identifyOne(todo[n].id);
    }
    setBusy(false);
    setStep(undefined);
  }

  const remaining = items.filter((i) => !i.identified).length;

  return (
    <div className="card" style={{ maxWidth: 900 }}>
      <div className="page-head">
        <h2>Scan a pile</h2>
        <Link to="/intake"><button type="button" className="secondary">Single comic</button></Link>
      </div>
      <p className="muted" style={{ fontSize: 13 }}>
        Lay a bunch of comics out flat (not overlapping), take one photo, and the
        AI will find each cover, crop it, and add it to inventory as its own book.
        Then run identify to fill in titles, grades, and key-issue flags.
      </p>

      <div className="row">
        <div className="col">
          <label>Photo of the pile</label>
          <input type="file" accept="image/*" capture="environment" onChange={onFile} />
        </div>
        <div className="col" style={{ maxWidth: 220 }}>
          {preview ? (
            <img className="cover" src={preview} alt="pile preview" />
          ) : (
            <div className="cover" style={{ height: 200 }} />
          )}
        </div>
      </div>

      <div className="spacer" />
      {error && <p className="error">{error}</p>}
      {busy && <Progress label={step ?? "Working…"} />}

      {!busy && !result && (
        <div className="pill-row">
          <button onClick={detect} disabled={!file}>
            Detect comics
          </button>
        </div>
      )}

      {result && (
        <>
          <div className="page-head" style={{ marginTop: 16 }}>
            <h3 style={{ margin: 0 }}>
              Found {result.detected} · added {items.length}
            </h3>
            {!busy && items.length > 0 && (
              <div className="pill-row" style={{ margin: 0 }}>
                <button onClick={identifyAll} disabled={remaining === 0}>
                  {remaining === 0 ? "All identified" : `Identify all (${remaining})`}
                </button>
                <Link to="/"><button type="button" className="secondary">Finish → Inventory</button></Link>
              </div>
            )}
          </div>

          {items.length === 0 ? (
            <p className="muted">
              No comics kept. Try a clearer, flatter photo with less overlap.
            </p>
          ) : (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 14,
                marginTop: 12,
              }}
            >
              {items.map((it) => (
                <div
                  key={it.id}
                  className="card"
                  style={{ width: 180, padding: 10, margin: 0 }}
                >
                  <Link to={`/comics/${it.id}`}>
                    {it.cropUrl ? (
                      <img
                        className="cover"
                        src={it.cropUrl}
                        alt={it.title}
                        style={{ width: "100%", height: 200, objectFit: "cover" }}
                      />
                    ) : (
                      <div className="cover" style={{ height: 200 }} />
                    )}
                  </Link>
                  <div style={{ fontWeight: 600, fontSize: 13, marginTop: 6 }}>
                    {it.title}
                  </div>
                  {it.publisher && (
                    <div className="muted" style={{ fontSize: 12 }}>{it.publisher}</div>
                  )}
                  <div className="muted" style={{ fontSize: 11 }}>
                    detect {pct(it.confidence)} · {it.status}
                  </div>
                  {it.note && (
                    <div className="success" style={{ fontSize: 11 }}>{it.note}</div>
                  )}
                  <div className="pill-row" style={{ marginTop: 8, gap: 6 }}>
                    <button
                      onClick={() => identifyOne(it.id)}
                      disabled={it.working || busy}
                      style={{ fontSize: 12, padding: "4px 8px" }}
                    >
                      {it.working ? "…" : it.identified ? "Re-ID" : "Identify"}
                    </button>
                    <button
                      className="secondary"
                      onClick={() => discard(it.id)}
                      disabled={it.working || busy}
                      style={{ fontSize: 12, padding: "4px 8px" }}
                    >
                      Discard
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
