import { useEffect, useRef, useState } from "react";
import { useParams } from "@/components/monitoring/react-router-shim";
import { Bot, ChevronRight, Loader2, X } from "lucide-react";

import { fetchAIStatus, projectChat, riskDigest, type AIStatus, type ChatTurn } from "../api";

export function AISidebarChat() {
  const { id: projectId = "" } = useParams();
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [digest, setDigest] = useState("");
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAIStatus().then(setAiStatus).catch(() => setAiStatus(null));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, digest]);

  const send = async (msg: string) => {
    if (!msg.trim() || busy || !projectId) return;
    setInput("");
    setTurns((prev) => [...prev, { role: "user", content: msg.trim() }]);
    setBusy(true);
    try {
      const data = await projectChat(projectId, msg.trim(), turns);
      setTurns((prev) => [...prev, { role: "assistant", content: data.answer }]);
    } catch {
      setTurns((prev) => [...prev, { role: "assistant", content: "AI unavailable — try again shortly." }]);
    } finally {
      setBusy(false);
    }
  };

  const doDigest = async () => {
    if (busy || !projectId) return;
    setDigest("");
    setBusy(true);
    try {
      const data = await riskDigest(projectId);
      setDigest(data.digest);
    } catch {
      setDigest("⚠️ Could not generate digest.");
    } finally {
      setBusy(false);
    }
  };

  const suggestions = [
    "What's behind schedule?",
    "Summarise this week's progress.",
    "Any urgent issues or H&S incidents?",
    "Which milestones still need verification?",
  ];

  if (!projectId) return null;

  return (
    <>
      {/* Collapse toggle button — always visible when closed */}
      {!open && (
        <button
          className="btn ghost sm"
          onClick={() => setOpen(true)}
          style={{ position: "fixed", right: 16, bottom: 16, zIndex: 50, borderRadius: 24, padding: "8px 14px", boxShadow: "0 2px 12px rgba(0,0,0,0.15)" }}
          title="Open AI Assistant"
        >
          <Bot size={16} style={{ marginRight: 6 }} /> Ask AI
        </button>
      )}

      {/* Sidebar drawer */}
      {open && (
        <div style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: 380, maxWidth: "90vw", zIndex: 50, background: "var(--surface)", borderLeft: "1px solid var(--border)", boxShadow: "-4px 0 24px rgba(0,0,0,0.1)", display: "flex", flexDirection: "column" }}>
          {/* Header */}
          <div className="row" style={{ justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
            <div className="row" style={{ gap: 8 }}>
              <Bot size={18} style={{ color: "var(--accent)" }} />
              <strong style={{ fontSize: 14 }}>Project Assistant</strong>
            </div>
            <div className="row" style={{ gap: 4 }}>
              <button className="btn ghost sm" onClick={doDigest} disabled={busy} title="Risk Digest">
                <Loader2 size={14} className={busy && !digest ? "spin" : ""} style={{ marginRight: 4 }} />
                Digest
              </button>
              <button className="btn ghost sm icon-only" onClick={() => setOpen(false)} title="Close">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Chat messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
            {/* Risk digest card */}
            {digest && (
              <div className="card" style={{ marginBottom: 12 }}>
                <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>AI Risk Digest</h3>
                <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 13, lineHeight: 1.5, color: "var(--text)" }}>
                  {digest}
                </pre>
              </div>
            )}

            {/* Empty state */}
            {turns.length === 0 && !digest && (
              <div>
                <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
                  Ask questions about this project. The AI has access to milestones, issues, and recent progress.
                </p>
                {suggestions.map((s, i) => (
                  <button key={i} className="btn ghost sm" style={{ marginBottom: 6, display: "block", width: "100%", textAlign: "left" }}
                    onClick={() => send(s)} disabled={busy || !aiStatus?.configured}>
                    <ChevronRight size={12} style={{ marginRight: 4 }} />
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Chat turns */}
            {turns.map((t, i) => (
              <div key={i} style={{ margin: "10px 0", textAlign: t.role === "user" ? "right" : "left" }}>
                <span style={{
                  display: "inline-block", maxWidth: "85%", padding: "8px 12px", borderRadius: 12,
                  whiteSpace: "pre-wrap", textAlign: "left", fontSize: 13, lineHeight: 1.5,
                  background: t.role === "user" ? "var(--accent, var(--color-info))" : "var(--surface-2, var(--color-slate-800))",
                  color: t.role === "user" ? "#fff" : "var(--text)",
                }}>
                  {t.content}
                </span>
              </div>
            ))}
            {busy && !digest && <p className="muted" style={{ fontSize: 13 }}>Thinking…</p>}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div className="row" style={{ padding: "8px 16px", borderTop: "1px solid var(--border)", gap: 8 }}>
            <input
              style={{ flex: 1 }}
              placeholder={aiStatus?.configured ? "Ask about this project…" : "AI not configured"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send(input)}
              disabled={!aiStatus?.configured}
              aria-label="Chat input"
            />
            <button className="btn sm" disabled={!input.trim() || busy || !aiStatus?.configured} onClick={() => send(input)}>
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}