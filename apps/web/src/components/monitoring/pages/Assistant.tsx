import { useEffect, useRef, useState } from "react";

import {
  fetchAIModels,
  fetchAIStatus,
  fetchProjects,
  post,
  projectChat,
  riskDigest,
  type AIModel,
  type AIStatus,
  type ChatTurn,
} from "../api";
import { ErrorBanner } from "../components";

interface ProjectOption {
  id: string;
  name: string;
}

const SUGGESTIONS = [
  "What's behind schedule?",
  "Summarise this week's progress.",
  "Any urgent issues or H&S incidents?",
  "Which milestones still need verification?",
];

const SUPPORT_SUGGESTIONS = [
  "How do I create a project?",
  "How do I raise a ticket?",
  "How do I generate a weekly report?",
  "How do I add a variation?",
];

export function Assistant() {
  const [tab, setTab] = useState<"project" | "support">("project");
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectId, setProjectId] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [digest, setDigest] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [models, setModels] = useState<AIModel[]>([]);
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);
  const [model, setModel] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  // Support chat state
  const [supportTurns, setSupportTurns] = useState<ChatTurn[]>([]);
  const [supportInput, setSupportInput] = useState("");

  useEffect(() => {
    fetchProjects()
      .then((rows: ProjectOption[]) => {
        setProjects(rows);
        const first = rows[0];
        if (first) setProjectId(first.id);
      })
      .catch((e) => setError((e as Error).message));
    fetchAIModels().then(setModels).catch(() => setModels([]));
    fetchAIStatus().then(setAiStatus).catch(() => setAiStatus(null));
  }, []);

  useEffect(() => {
    setTurns([]);
    setDigest("");
  }, [projectId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, supportTurns, busy]);

  async function send(message: string) {
    if (!message.trim() || !projectId || busy) return;
    setError(null);
    const history = turns;
    setTurns((t) => [...t, { role: "user", content: message }]);
    setInput("");
    setBusy(true);
    try {
      const res = await projectChat(projectId, message, history, model || undefined);
      const sourceText = res.sources?.length ? `\n\nSources: ${res.sources.map((s: any) => `${s.label} (${s.count})`).join(", ")}` : "";
      setTurns((t) => [...t, { role: "assistant", content: `${res.answer}${sourceText}` }]);
    } catch (e) {
      setError((e as Error).message);
      setTurns((t) => [...t, { role: "assistant", content: "⚠ I couldn't answer that just now." }]);
    } finally {
      setBusy(false);
    }
  }

  async function sendSupport(message: string) {
    if (!message.trim() || busy) return;
    setError(null);
    setSupportTurns((t) => [...t, { role: "user", content: message }]);
    setSupportInput("");
    setBusy(true);
    try {
      const res = await post<{ answer: string }>("/ai/support-chat", {
        message, model: model || undefined,
        history: supportTurns,
      });
      setSupportTurns((t) => [...t, { role: "assistant", content: res.answer }]);
    } catch (e) {
      setError((e as Error).message);
      setSupportTurns((t) => [...t, { role: "assistant", content: "⚠ I couldn't answer that just now." }]);
    } finally {
      setBusy(false);
    }
  }

  async function loadDigest() {
    setError(null);
    setDigest("Analysing…");
    try {
      const res = await riskDigest(projectId, model || undefined);
      setDigest(res.digest);
    } catch (e) {
      setDigest("");
      setError((e as Error).message);
    }
  }

  return (
    <div>
      <h2>AI Assistant</h2>
      <p className="muted">Project Q&A, risk analysis, and system help — all from real data.</p>
      <ErrorBanner message={error} />

      <div className="card row" style={{ gap: 0, padding: 0, overflow: "hidden" }}>
        <button
          className={`btn ghost${tab === "project" ? " active" : ""}`}
          onClick={() => setTab("project")}
          style={{ flex: 1, borderRadius: 0, borderBottom: tab === "project" ? "2px solid var(--accent)" : "2px solid transparent" }}
        >
          Project Assistant
        </button>
        <button
          className={`btn ghost${tab === "support" ? " active" : ""}`}
          onClick={() => setTab("support")}
          style={{ flex: 1, borderRadius: 0, borderBottom: tab === "support" ? "2px solid var(--accent)" : "2px solid transparent" }}
        >
          Support Chat
        </button>
      </div>

      {tab === "project" && (
        <>
          <div className="card row" style={{ flexWrap: "wrap" }}>
            <label htmlFor="assist-project">Project</label>
            <select id="assist-project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <label htmlFor="assist-model">Model</label>
            <select id="assist-model" value={model} onChange={(e) => setModel(e.target.value)}
              title="Free models from OpenRouter">
              <option value="">Default (free)</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>{m.name}{m.vision ? " 👁" : ""}</option>
              ))}
            </select>
            <button className="btn ghost sm" disabled={!projectId} onClick={loadDigest}>Risk digest</button>
          </div>

          {digest && (
            <div className="card">
              <h3>AI risk digest</h3>
              <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", margin: 0 }}>{digest}</pre>
            </div>
          )}

          <div className="card" style={{ minHeight: 240 }}>
            {turns.length === 0 && (
              <div>
                <p className="muted">Try:</p>
                <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                  {SUGGESTIONS.map((s) => (
                    <button key={s} className="btn ghost sm" onClick={() => send(s)}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            {turns.map((t, i) => (
              <div key={i} style={{ margin: "10px 0", textAlign: t.role === "user" ? "right" : "left" }}>
                <span style={{
                  display: "inline-block", maxWidth: "80%", padding: "8px 12px", borderRadius: 12,
                  whiteSpace: "pre-wrap", textAlign: "left",
                  background: t.role === "user" ? "var(--accent, #2563eb)" : "var(--surface-2, #1e293b)",
                  color: t.role === "user" ? "#fff" : "var(--text)",
                }}>{t.content}</span>
              </div>
            ))}
            {busy && <p className="muted">Thinking…</p>}
            <div ref={endRef} />
          </div>

          <div className="card row">
            <input
              style={{ flex: 1 }}
              placeholder={aiStatus?.configured ? "Ask about this project…" : "AI not configured"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send(input)}
              disabled={!aiStatus?.configured}
              aria-label="Ask the project assistant"
            />
            <button className="btn" disabled={!input.trim() || busy || !aiStatus?.configured} onClick={() => send(input)}>Send</button>
          </div>
        </>
      )}

      {tab === "support" && (
        <>
          <div className="card row" style={{ flexWrap: "wrap" }}>
            <label htmlFor="support-model">Model</label>
            <select id="support-model" value={model} onChange={(e) => setModel(e.target.value)}
              title="Free models from OpenRouter">
              <option value="">Default (free)</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>{m.name}{m.vision ? " 👁" : ""}</option>
              ))}
            </select>
          </div>

          <div className="card" style={{ minHeight: 240 }}>
            {supportTurns.length === 0 && (
              <div>
                <p className="muted">Ask me how to use the system:</p>
                <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                  {SUPPORT_SUGGESTIONS.map((s) => (
                    <button key={s} className="btn ghost sm" onClick={() => sendSupport(s)}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            {supportTurns.map((t, i) => (
              <div key={i} style={{ margin: "10px 0", textAlign: t.role === "user" ? "right" : "left" }}>
                <span style={{
                  display: "inline-block", maxWidth: "80%", padding: "8px 12px", borderRadius: 12,
                  whiteSpace: "pre-wrap", textAlign: "left",
                  background: t.role === "user" ? "var(--accent, #2563eb)" : "var(--surface-2, #1e293b)",
                  color: t.role === "user" ? "#fff" : "var(--text)",
                }}>{t.content}</span>
              </div>
            ))}
            {busy && <p className="muted">Thinking…</p>}
            <div ref={tab === "support" ? undefined : endRef} />
          </div>

          <div className="card row">
            <input
              style={{ flex: 1 }}
              placeholder="Ask how to use the system…"
              value={supportInput}
              onChange={(e) => setSupportInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendSupport(supportInput)}
              aria-label="Ask the support assistant"
            />
            <button className="btn" disabled={!supportInput.trim() || busy} onClick={() => sendSupport(supportInput)}>Send</button>
          </div>
        </>
      )}
    </div>
  );
}
