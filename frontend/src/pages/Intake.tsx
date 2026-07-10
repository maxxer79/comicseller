import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type UpcMatch } from "../api";
import { Progress } from "../components/Spinner";
import { BarcodeScanner } from "../components/BarcodeScanner";
import { parseComicBarcode } from "../lib/comicBarcode";

export function Intake() {
  const nav = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>();
  const [title, setTitle] = useState("");
  const [upc, setUpc] = useState("");
  const [supplement, setSupplement] = useState("");
  const [publisher, setPublisher] = useState("");
  const [barcodeInfo, setBarcodeInfo] = useState<string>();
  const [filled, setFilled] = useState<{
    issueNumber: string | null; year: number | null; variant: string | null;
    keyIssue: boolean; keyNotes: string | null; aiSuggestedGrade: number | null;
  }>();
  const [candidates, setCandidates] = useState<UpcMatch[]>([]);
  const [searchNum, setSearchNum] = useState("");
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

  function fullUpc(main: string, sup: string): string {
    const m = (main || "").replace(/\D/g, "");
    const su = (sup || "").replace(/\D/g, "");
    return m.length === 12 && su.length === 5 ? m + su : m;
  }

  async function runLookup(digits: string) {
    setDupWarning(undefined);
    setMatchNote(undefined);
    if (!digits) return;
    const parsed = parseComicBarcode(digits);
    if (parsed) {
      if (parsed.publisher) setPublisher((cur) => cur || parsed.publisher!);
      const g = parsed.supplementDecodes;
      const sup = parsed.hasSupplement && g.length === 2
        ? ` · issue ${g[0].issue} / cover ${g[0].cover} / printing ${g[0].printing}  (alt read: ${g[1].issue} / ${g[1].cover} / ${g[1].printing})`
        : " · no 5-digit add-on captured";
      setBarcodeInfo(
        `${parsed.publisher ?? "Unknown publisher"} · series ${parsed.seriesCode}${sup}` +
          `${parsed.checkDigitValid ? "" : "  ⚠ check digit doesn\u2019t match — re-scan"}`
      );
    } else {
      setBarcodeInfo(undefined);
    }
    try {
      const dup = await api.findByUpc(digits);
      if (dup.total > 0) {
        setDupWarning(
          `Heads up: you already have ${dup.total} comic(s) with this UPC in inventory.`
        );
      }
    } catch {
      /* non-fatal */
    }
    try {
      const res = await api.lookupUpc(digits);
      if (res.found && res.match) {
        const m = res.match;
        setTitle((t) => t || m.series);
        setMatchNote(
          `Matched: ${m.series}${m.number ? " #" + m.number : ""}` +
            `${m.publisher ? " · " + m.publisher : ""}${m.year ? " · " + m.year : ""} (GCD)`
        );
      } else if (res.datasetSize === 0) {
        setMatchNote(
          "No barcode database loaded — use \u201CCreate & identify with AI\u201D below to fill from the cover (or load GCD data: docs/gcd-upc-lookup.md)."
        );
      } else {
        setMatchNote(
          "No barcode match — use \u201CCreate & identify with AI\u201D below to read the details off the cover."
        );
      }
    } catch {
      /* non-fatal */
    }
  }

  async function onDetected(code: string) {
    const digits = (code || "").replace(/\D/g, "");
    setScanning(false);
    // If the scanner also captured the 5-digit add-on, split it into the fields.
    if (digits.length === 17) {
      setUpc(digits.slice(0, 12));
      setSupplement(digits.slice(12));
    } else {
      setUpc(digits);
    }
    await runLookup(digits);
  }

  async function autoFill() {
    const digitsFull = fullUpc(upc, supplement);
    setBusy(true);
    setError(undefined);
    // 1) Try the local GCD data first (instant, no AI, no quota used).
    if (digitsFull) {
      setStep("Checking the UPC database…");
      try {
        const res = await api.lookupUpc(digitsFull);
        if (res.found && res.match) {
          const m = res.match;
          if (m.series) setTitle((t) => t || m.series);
          if (m.publisher) setPublisher((pub) => pub || m.publisher!);
          setFilled({
            issueNumber: m.number,
            year: m.year,
            variant: null,
            keyIssue: false,
            keyNotes: null,
            aiSuggestedGrade: null,
          });
          setMatchNote(
            `Matched in your GCD data: ${m.series}${m.number ? " #" + m.number : ""}` +
              `${m.publisher ? " · " + m.publisher : ""}${m.year ? " · " + m.year : ""}. No AI needed.`
          );
          setBusy(false);
          setStep(undefined);
          return;
        }
      } catch {
        /* fall through to AI */
      }
    }
    // 2) Fall back to the AI cover read.
    if (!file) {
      setError("No UPC match in your GCD data — add a cover photo so the AI can read it.");
      setBusy(false);
      setStep(undefined);
      return;
    }
    setStep("Reading the cover with AI…");
    try {
      const { suggestion: sug } = await api.identifyPreview(file);
      if (sug.title) setTitle((t) => t || sug.title!);
      if (sug.publisher) setPublisher((pub) => pub || sug.publisher!);
      setFilled({
        issueNumber: sug.issueNumber,
        year: sug.year,
        variant: sug.variant,
        keyIssue: sug.keyIssue,
        keyNotes: sug.keyNotes,
        aiSuggestedGrade: sug.suggestedGrade,
      });
      // Seed GCD title candidates from what the AI read (helps pick the exact printing).
      void gcdSearch(sug.title ?? "", sug.issueNumber ?? undefined, sug.year ?? undefined);
      const bits = [
        sug.title ? `${sug.title}${sug.issueNumber ? " #" + sug.issueNumber : ""}` : null,
        sug.publisher,
        sug.year ? String(sug.year) : null,
        sug.suggestedGrade ? `grade ~${sug.suggestedGrade}` : null,
        sug.keyIssue ? "KEY" : null,
      ]
        .filter(Boolean)
        .join(" · ");
      setMatchNote(`AI read the cover: ${bits} (${Math.round(sug.confidence * 100)}% confidence). Review, then Create.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setStep(undefined);
    }
  }

  async function gcdSearch(seriesQ: string, num?: string, year?: number) {
    const q = (seriesQ || "").trim();
    if (q.length < 2) {
      setCandidates([]);
      return;
    }
    try {
      const r = await api.searchTitle(q, num?.trim() || undefined, year);
      setCandidates(r.items);
      if (r.items.length === 0) setMatchNote("No GCD matches for that title/issue.");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function pickCandidate(c: UpcMatch) {
    setTitle(c.series);
    setPublisher(c.publisher ?? "");
    setFilled((prev) => ({
      issueNumber: c.number,
      year: c.year,
      variant: null,
      keyIssue: prev?.keyIssue ?? false,
      keyNotes: prev?.keyNotes ?? null,
      aiSuggestedGrade: prev?.aiSuggestedGrade ?? null,
    }));
    setMatchNote(
      `Using GCD: ${c.series}${c.number ? " #" + c.number : ""}` +
        `${c.publisher ? " · " + c.publisher : ""}${c.year ? " · " + c.year : ""}`
    );
    setCandidates([]);
  }

  async function submit(runIdentify: boolean) {
    setBusy(true);
    setError(undefined);
    try {
      setStep("Creating intake…");
      const extra = filled;
      const comic = await api.createComic(
        file,
        title || undefined,
        fullUpc(upc, supplement) || undefined,
        publisher || undefined,
        extra
      );
      if (runIdentify && !filled && file) {
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
      <div className="page-head">
        <h2>Add a comic</h2>
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

          <label>Add-on (5-digit supplement, optional)</label>
          <input
            value={supplement}
            onChange={(e) => setSupplement(e.target.value)}
            onBlur={() => (upc ? runLookup(fullUpc(upc, supplement)) : undefined)}
            placeholder="e.g. 00131 — the small barcode next to the main one"
            maxLength={5}
          />
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
          {barcodeInfo && (
            <p className="muted" style={{ fontSize: 12 }}>
              Barcode: {barcodeInfo}
            </p>
          )}

          <label>Title (optional — AI can fill this in)</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. The Amazing Spider-Man"
          />

          <label>Publisher (auto-filled from barcode when known)</label>
          <input
            value={publisher}
            onChange={(e) => setPublisher(e.target.value)}
            placeholder="e.g. Marvel Comics"
          />

          <label>Find in GCD by title / issue (for books with no scannable barcode)</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={searchNum}
              onChange={(e) => setSearchNum(e.target.value)}
              placeholder="Issue # (optional)"
              style={{ maxWidth: 130 }}
            />
            <button
              type="button"
              className="secondary"
              onClick={() => gcdSearch(title, searchNum)}
              disabled={title.trim().length < 2}
              style={{ whiteSpace: "nowrap" }}
            >
              Search GCD
            </button>
          </div>
          {candidates.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
              <span className="muted" style={{ fontSize: 12 }}>
                Pick the exact match ({candidates.length} found):
              </span>
              {candidates.map((c, i) => (
                <button
                  key={`${c.gcdIssueId ?? c.barcode ?? "x"}-${i}`}
                  type="button"
                  className="secondary"
                  onClick={() => pickCandidate(c)}
                  style={{ textAlign: "left", fontSize: 13 }}
                >
                  {c.series}{c.number ? ` #${c.number}` : ""}
                  {c.publisher ? ` · ${c.publisher}` : ""}{c.year ? ` · ${c.year}` : ""}
                </button>
              ))}
            </div>
          )}
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
          {(file || fullUpc(upc, supplement)) && (
            <button onClick={autoFill}>✨ Auto-fill (UPC or photo)</button>
          )}
          <button
            className={filled ? undefined : "secondary"}
            onClick={() => submit(true)}
            disabled={!file && !filled}
          >
            {filled ? "Create" : "Create &amp; identify with AI"}
          </button>
          <button className="secondary" onClick={() => submit(false)}>
            Create without AI
          </button>
        </div>
      )}
      <p className="muted" style={{ fontSize: 12 }}>
        Take a cover photo, then tap “Auto-fill from photo” — the AI fills in the
        title, issue, publisher, year, and a suggested grade (needs an AI key in
        Admin → AI). Review and Create; you confirm the grade on the next screen.
      </p>

      {scanning && (
        <BarcodeScanner onDetected={onDetected} onClose={() => setScanning(false)} />
      )}
    </div>
  );
}
