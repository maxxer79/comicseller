import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

/**
 * Add a comic: upload a cover photo, create the intake, then (optionally) run
 * AI identification. On success, jump to the detail/review page.
 */
export function Intake() {
  const nav = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>();
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<string>();
  const [error, setError] = useState<string>();

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : undefined);
  }

  async function submit(runIdentify: boolean) {
    setBusy(true);
    setError(undefined);
    try {
      setStep("Creating intake…");
      const comic = await api.createComic(file, title || undefined);

      if (runIdentify && file) {
        setStep("Identifying with AI…");
        try {
          await api.identify(comic.id);
        } catch (e) {
          // Identification failing shouldn't lose the intake; surface it on the
          // detail page instead.
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
      <h2>Add a comic</h2>

      <div className="row">
        <div className="col">
          <label>Cover photo</label>
          <input type="file" accept="image/*" onChange={onFile} />
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
      {busy && <p className="muted">{step}</p>}

      <div className="pill-row">
        <button onClick={() => submit(true)} disabled={busy || !file}>
          Create &amp; identify with AI
        </button>
        <button className="secondary" onClick={() => submit(false)} disabled={busy}>
          Create without AI
        </button>
      </div>
      <p className="muted" style={{ fontSize: 12 }}>
        AI identification needs a photo and an API key configured on the server
        (or VISION_MOCK=1 to test). You'll confirm everything on the next screen.
      </p>
    </div>
  );
}
