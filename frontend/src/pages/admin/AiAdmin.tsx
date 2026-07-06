import { useEffect, useState } from "react";
import { api, type Settings, type AiProvider, type AiTestResult } from "../../api";

const PROVIDERS: { id: AiProvider; label: string; keyUrl: string; keyHint: string; modelHint: string }[] = [
  { id: "anthropic", label: "Anthropic (Claude)", keyUrl: "https://console.anthropic.com/settings/keys", keyHint: "console.anthropic.com", modelHint: "e.g. claude-sonnet-4-5" },
  { id: "gemini", label: "Google (Gemini)", keyUrl: "https://aistudio.google.com/apikey", keyHint: "aistudio.google.com/apikey", modelHint: "e.g. gemini-2.5-flash" },
  { id: "grok", label: "xAI (Grok)", keyUrl: "https://console.x.ai", keyHint: "console.x.ai", modelHint: "e.g. grok-2-vision-1212" },
];

type KeyMap = Record<AiProvider, string>;
const emptyKeys: KeyMap = { anthropic: "", gemini: "", grok: "" };

export function AiAdmin() {
  const [settings, setSettings] = useState<Settings>();
  const [provider, setProvider] = useState<AiProvider>("anthropic");
  const [models, setModels] = useState<KeyMap>(emptyKeys);
  const [keys, setKeys] = useState<KeyMap>(emptyKeys);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [msg, setMsg] = useState<string>();
  const [test, setTest] = useState<AiTestResult>();

  function hydrate(s: Settings) {
    setSettings(s);
    if (s.ai) {
      setProvider(s.ai.provider);
      setModels({
        anthropic: s.ai.providers.anthropic.model,
        gemini: s.ai.providers.gemini.model,
        grok: s.ai.providers.grok.model,
      });
    }
    setKeys(emptyKeys);
  }

  useEffect(() => {
    api.getSettings().then(hydrate).catch((e) => setError((e as Error).message));
  }, []);

  async function save() {
    setError(undefined); setMsg(undefined); setTest(undefined); setBusy(true);
    try {
      const body: Record<string, string> = {
        aiProvider: provider,
        anthropicModel: models.anthropic,
        geminiModel: models.gemini,
        grokModel: models.grok,
      };
      for (const p of PROVIDERS) {
        if (keys[p.id].trim()) body[`${p.id}Key`] = keys[p.id].trim();
      }
      const s = await api.updateAiSettings(body);
      hydrate(s);
      setMsg("AI settings saved.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function clearKey(p: AiProvider) {
    setError(undefined); setMsg(undefined); setBusy(true);
    try {
      const s = await api.updateAiSettings({ [`${p}Key`]: "" });
      hydrate(s);
      setMsg(`${p} key cleared.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function runTest() {
    setError(undefined); setMsg(undefined); setTest(undefined); setBusy(true);
    try {
      setTest(await api.testAi());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!settings) return <p className="muted">Loading…</p>;
  const ai = settings.ai;

  return (
    <div>
      {error && <p className="error">{error}</p>}
      {msg && <p className="success">{msg}</p>}

      <div className="card" style={{ maxWidth: 640 }}>
        <h3>AI provider</h3>
        <p className="muted" style={{ fontSize: 13 }}>
          Choose which AI identifies covers and scans piles. Keys are encrypted at
          rest and never shown in full. Leave a key field blank to keep the current one.
        </p>
        {ai?.mock && (
          <p className="warn" style={{ color: "var(--warn)", fontSize: 13 }}>
            VISION_MOCK is enabled — identification returns sample data and no provider is called.
          </p>
        )}

        <label>Active provider</label>
        <select value={provider} onChange={(e) => setProvider(e.target.value as AiProvider)}>
          {PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>

        <div className="spacer" />
        <div className="pill-row">
          <button onClick={save} disabled={busy}>Save AI settings</button>
          <button className="secondary" onClick={runTest} disabled={busy}>
            Test active provider
          </button>
        </div>
        {test && (
          <p className={test.ok ? "success" : "error"} style={{ fontSize: 13 }}>
            {test.ok ? "✓" : "✗"} {test.provider} · {test.model}
            {test.detail ? ` — ${test.detail}` : test.ok ? " — reachable" : ""}
          </p>
        )}
      </div>

      {PROVIDERS.map((p) => {
        const st = ai?.providers[p.id];
        return (
          <div key={p.id} className="card" style={{ maxWidth: 640 }}>
            <div className="page-head">
              <h3 style={{ margin: 0 }}>{p.label}</h3>
              {st?.configured ? (
                <span className="version-chip">
                  key set {st.maskedKey}{st.fromEnv ? " (env)" : ""}
                </span>
              ) : (
                <span className="muted" style={{ fontSize: 12 }}>no key</span>
              )}
            </div>

            <label>Model</label>
            <input
              value={models[p.id]}
              placeholder={p.modelHint}
              onChange={(e) => setModels({ ...models, [p.id]: e.target.value })}
            />

            <label>API key</label>
            <input
              type="password"
              autoComplete="off"
              value={keys[p.id]}
              placeholder={st?.configured ? "•••• leave blank to keep" : "Paste API key"}
              onChange={(e) => setKeys({ ...keys, [p.id]: e.target.value })}
            />
            <p className="muted" style={{ fontSize: 12 }}>
              Get a key at{" "}
              <a href={p.keyUrl} target="_blank" rel="noreferrer">{p.keyHint}</a>.
              {st?.configured && !st.fromEnv && (
                <>
                  {" "}
                  <button
                    className="secondary"
                    onClick={() => clearKey(p.id)}
                    disabled={busy}
                    style={{ fontSize: 12, padding: "2px 8px", marginLeft: 6 }}
                  >
                    Clear key
                  </button>
                </>
              )}
            </p>
          </div>
        );
      })}
    </div>
  );
}
