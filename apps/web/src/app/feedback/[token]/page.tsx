"use client";

import { FormEvent, useEffect, useState } from "react";
import { AlertCircle, CheckCircle, Send } from "lucide-react";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1").replace(/\/$/, "");

type Context = { label: string; property: string; building: string; floor: string; unit: string };

export default function PublicFeedbackPage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState("");
  const [context, setContext] = useState<Context | null>(null);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "sent" | "error">("loading");
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");

  useEffect(() => {
    void params.then(({ token: nextToken }) => {
      setToken(nextToken);
      fetch(`${API_BASE}/companion/public-feedback/${encodeURIComponent(nextToken)}/`)
        .then(async (response) => {
          const body = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(body.detail || "This feedback link is unavailable.");
          setContext(body as Context);
          setState("ready");
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : "This feedback link is unavailable.");
          setState("error");
        });
    });
  }, [params]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const response = await fetch(`${API_BASE}/companion/public-feedback/${encodeURIComponent(token)}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, message, name }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail || "Feedback could not be submitted.");
      setReference(body.reference || "");
      setState("sent");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Feedback could not be submitted.");
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f8fafc" }}>
      <section style={{ width: "min(620px, 100%)", background: "#fff", border: "1px solid #dbe3ee", borderRadius: 18, padding: "clamp(24px, 5vw, 44px)", boxShadow: "0 20px 60px rgba(15,23,42,.10)" }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ color: "#dc2626", fontSize: 12, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" }}>Center Estates</div>
          <h1 style={{ margin: "8px 0 6px", fontSize: 28 }}>Report an issue</h1>
          {context && <p style={{ margin: 0, color: "#64748b" }}>{context.property}{context.building ? ` · ${context.building}` : ""}{context.floor ? ` · Floor ${context.floor}` : ""}{context.unit ? ` · Unit ${context.unit}` : ""}</p>}
        </div>
        {state === "loading" && <p>Loading this feedback form…</p>}
        {state === "error" && <div role="alert" style={{ color: "#b91c1c", display: "flex", gap: 8 }}><AlertCircle size={18} />{error}</div>}
        {state === "sent" && <div role="status" style={{ color: "#166534", display: "grid", gap: 10 }}><CheckCircle size={26} /><strong>Thank you. Your report was submitted.</strong><span>Reference: {reference}</span></div>}
        {state === "ready" && <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
          {error && <div role="alert" style={{ color: "#b91c1c" }}>{error}</div>}
          <label>Short title<input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Water leak in corridor" style={inputStyle} /></label>
          <label>Your name <span style={{ color: "#94a3b8" }}>(optional)</span><input value={name} onChange={(event) => setName(event.target.value)} style={inputStyle} /></label>
          <label>What happened?<textarea required minLength={5} rows={6} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Describe the issue and where it is located…" style={{ ...inputStyle, resize: "vertical" }} /></label>
          <button type="submit" style={{ border: 0, borderRadius: 10, padding: "12px 18px", background: "#dc2626", color: "#fff", fontWeight: 800, display: "inline-flex", justifyContent: "center", alignItems: "center", gap: 8, cursor: "pointer" }}><Send size={16} /> Submit feedback</button>
        </form>}
      </section>
    </main>
  );
}

const inputStyle = { display: "block", width: "100%", marginTop: 7, padding: "11px 12px", border: "1px solid #cbd5e1", borderRadius: 9, font: "inherit", boxSizing: "border-box" as const };
