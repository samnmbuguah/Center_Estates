import { Bot, ChevronDown, ChevronUp, Send, X, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { fetchAIStatus, post, projectChat, type AIStatus, type ChatTurn } from "../api";
import { useAuth } from "../auth";

interface ProjectAssistantProps {
  projectId: string;
  projectName: string;
}

export function ProjectAssistant({ projectId, projectName }: ProjectAssistantProps) {
  const { can } = useAuth();
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAIStatus().then(setAiStatus).catch(() => setAiStatus(null));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  const send = async (msg: string) => {
    if (!msg.trim() || busy) return;
    setInput("");
    const history = turns.map((t) => ({ role: t.role, content: t.content }));
    setTurns((prev) => [...prev, { role: "user", content: msg }]);
    setBusy(true);
    try {
      const reply = await projectChat(projectId, msg, history);
      setTurns((prev) => [...prev, { role: "assistant", content: reply.answer }]);
    } catch (e) {
      setTurns((prev) => [...prev, { role: "assistant", content: "Sorry, AI is unavailable right now." }]);
    } finally {
      setBusy(false);
    }
  };

  const riskCheck = async () => {
    setBusy(true);
    try {
      const res = await post<{ digest: string }>("/ai/risk-digest", { project_id: projectId });
      setTurns((prev) => [...prev, { role: "user", content: "What are the risks?" }, { role: "assistant", content: res.digest || "No risks detected." }]);
    } catch {
      setTurns((prev) => [...prev, { role: "assistant", content: "Could not fetch risk analysis." }]);
    } finally {
      setBusy(false);
    }
  };

  if (!can("site.reporting.view")) return null;

  const suggestions = [
    "What's behind schedule?",
    "Summarise this week's progress.",
    "Any urgent issues or H&S incidents?",
  ];

  return (
    <div style={{ marginTop: 24 }}>
      <button
        className="btn ghost"
        style={{ width: "100%", justifyContent: "space-between", padding: "12px 16px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--card)" }}
        onClick={() => setOpen(!open)}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Bot size={18} style={{ color: "var(--accent)" }} />
          <span style={{ fontSize: 14, fontWeight: 600 }}>AI Assistant — {projectName}</span>
          {!aiStatus?.configured && <span className="muted" style={{ fontSize: 12 }}>(not configured)</span>}
        </span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="card" style={{ marginTop: 8, padding: 16 }}>
          {turns.length === 0 && (
            <div style={{ marginBottom: 12 }}>
              <p className="muted" style={{ marginBottom: 8 }}>Ask a project-specific question:</p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {suggestions.map((s, i) => (
                  <button key={i} className="btn ghost sm" onClick={() => send(s)} disabled={busy || !aiStatus?.configured}>
                    {s}
                  </button>
                ))}
                <button className="btn ghost sm" onClick={riskCheck} disabled={busy || !aiStatus?.configured}>
                  <Zap size={14} style={{ marginRight: 4 }} /> Risk check
                </button>
              </div>
            </div>
          )}

          <div style={{ maxHeight: 320, overflowY: "auto", marginBottom: 12 }}>
            {turns.map((t, i) => (
              <div
                key={i}
                style={{
                  marginBottom: 8,
                  padding: "8px 12px",
                  borderRadius: 6,
                  background: t.role === "user" ? "var(--muted-bg)" : "var(--accent-light)",
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                <span style={{ fontWeight: 600, fontSize: 11, textTransform: "uppercase", color: "var(--muted)" }}>
                  {t.role === "user" ? "You" : "AI"}
                </span>
                <p style={{ margin: "4px 0 0" }}>{t.content}</p>
              </div>
            ))}
            {busy && <p className="muted" style={{ fontSize: 13 }}>Thinking…</p>}
            <div ref={endRef} />
          </div>

          {aiStatus?.configured ? (
            <div style={{ display: "flex", gap: 8 }}>
              <input
                style={{ flex: 1 }}
                placeholder="Ask about this project…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send(input)}
                disabled={busy}
              />
              <button className="btn" disabled={!input.trim() || busy} onClick={() => send(input)}>
                <Send size={14} style={{ marginRight: 4 }} /> Send
              </button>
            </div>
          ) : (
            <p className="muted" style={{ fontSize: 12 }}>AI service not configured. Set AI_API_KEY on the server.</p>
          )}

          {turns.length > 0 && (
            <button className="btn ghost sm" onClick={() => setTurns([])} style={{ marginTop: 8 }}>
              <X size={12} style={{ marginRight: 4 }} /> Clear chat
            </button>
          )}
        </div>
      )}
    </div>
  );
}