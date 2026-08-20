"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

export type AgentActionItem = {
  id: string;
  action_type: string;
  title: string;
  description: string;
  target_module: string;
  target_id?: string;
  target_name?: string;
  payload?: Record<string, any>;
  urgency: "critical" | "high" | "medium" | "low";
  status?: string;
};

export type LangGraphBriefingData = {
  date?: string;
  headline?: string;
  portfolio_health_score?: number;
  healthScore?: number;
  health_status?: string;
  briefing_narrative?: string;
  key_metrics?: {
    total_arrears?: number;
    overdue_invoices?: number;
    urgent_work_orders?: number;
    open_work_orders?: number;
    expiring_leases_60d?: number;
    pending_leave_requests?: number;
  };
  critical_alerts?: string[];
  recommended_focus?: string[];
  proposed_actions?: AgentActionItem[];
  // Backwards compatibility
  greeting?: string;
  generatedAt?: string;
  priorities?: Array<{
    id: string;
    severity: string;
    icon: string;
    title: string;
    description: string;
    actionLabel: string;
    actionRoute: string;
    category: string;
  }>;
};

export function DailyBriefingCard({
  userName,
  onNavigate,
}: {
  userName: string;
  onNavigate?: (route: string) => void;
}) {
  const [data, setData] = useState<LangGraphBriefingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [executedIds, setExecutedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    async function loadBriefing() {
      try {
        const res = await apiFetch("/companion/dashboard/daily-briefing/");
        if (res.ok && !cancelled) {
          const json = (await res.json()) as LangGraphBriefingData;
          setData(json);
        }
      } catch {
        // Fallback gracefully
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadBriefing();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSpeak = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    if (!data) return;

    const headline = data.headline || data.greeting || "Daily Briefing";
    const alerts = (data.critical_alerts || []).join(". ");
    const speechText = `${headline}. ${alerts}`;
    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.rate = 1.0;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleExecuteAction = async (action: AgentActionItem) => {
    setExecutingId(action.id);
    try {
      const res = await apiFetch("/companion/dashboard/execute-actions/", {
        method: "POST",
        body: JSON.stringify({
          action_ids: [action.id],
          proposed_actions: data?.proposed_actions || [],
        }),
      });
      if (res.ok) {
        setExecutedIds((prev) => new Set([...prev, action.id]));
      }
    } catch {
      // Error handled gracefully
    } finally {
      setExecutingId(null);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          background: "linear-gradient(135deg, #0b1f33 0%, #172a3e 100%)",
          borderRadius: 14,
          padding: "20px 24px",
          color: "#ffffff",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <span style={{ fontSize: 20 }}>⏳</span>
        <span style={{ fontSize: 13, color: "#94a3b8" }}>Running LangGraph Open Agent Orchestrator...</span>
      </div>
    );
  }

  if (!data) return null;

  const healthScore = data.portfolio_health_score ?? data.healthScore ?? 100;
  const headline = data.headline ?? data.greeting ?? "Portfolio Operational Briefing";
  const actions = data.proposed_actions || [];

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #081524 0%, #0f2742 100%)",
        borderRadius: 16,
        padding: "22px 26px",
        color: "#ffffff",
        boxShadow: "0 14px 36px rgba(7, 16, 29, 0.22)",
        border: "1px solid rgba(59, 130, 246, 0.2)",
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      {/* Header with Greeting & Health Score */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 12,
              background: "rgba(59, 130, 246, 0.25)",
              border: "1.5px solid rgba(96, 165, 250, 0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
            }}
          >
            ☀️
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, letterSpacing: "0.08em", fontWeight: 800, color: "#60a5fa", textTransform: "uppercase" }}>
                Quartermaster AI Orchestrator
              </span>
              <span style={{ fontSize: 10, color: "#94a3b8" }}>· {data.date || data.generatedAt || "Today"}</span>
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 900, margin: "2px 0 0", color: "#ffffff" }}>
              {headline}
            </h3>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Health Score Pill */}
          <div
            style={{
              padding: "6px 14px",
              borderRadius: 10,
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>Portfolio Health:</span>
            <strong style={{ fontSize: 14, color: healthScore >= 80 ? "#4ade80" : "#fbbf24", fontWeight: 900 }}>
              {healthScore}/100
            </strong>
          </div>

          {/* Voice Readout Button */}
          <button
            type="button"
            onClick={handleSpeak}
            style={{
              background: isSpeaking ? "#ef4444" : "rgba(59, 130, 246, 0.2)",
              color: "#ffffff",
              border: "1px solid rgba(96, 165, 250, 0.3)",
              borderRadius: 10,
              padding: "7px 12px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span>{isSpeaking ? "⏹️" : "🔊"}</span>
            <span>{isSpeaking ? "Stop" : "Read Aloud"}</span>
          </button>
        </div>
      </div>

      {/* Narrative Summary if present */}
      {data.briefing_narrative && (
        <div style={{ background: "rgba(15, 23, 42, 0.4)", borderRadius: 10, padding: "12px 16px", border: "1px solid rgba(255, 255, 255, 0.06)", fontSize: 12, lineHeight: 1.5, color: "#e2e8f0" }}>
          {data.briefing_narrative}
        </div>
      )}

      {/* Critical Alerts Banner */}
      {data.critical_alerts && data.critical_alerts.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {data.critical_alerts.map((alert, idx) => (
            <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#cbd5e1" }}>
              <span style={{ color: "#60a5fa" }}>•</span>
              <span>{alert}</span>
            </div>
          ))}
        </div>
      )}

      {/* Actionable Proposed Interventions (Human in the loop 1-click execution) */}
      {actions.length > 0 && (
        <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.1)", paddingTop: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#93c5fd", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
            ⚡ Proposed Agent Interventions ({actions.length})
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
            {actions.map((act) => {
              const isExecuted = executedIds.has(act.id);
              const isBusy = executingId === act.id;
              return (
                <div
                  key={act.id}
                  style={{
                    background: isExecuted ? "rgba(34, 197, 94, 0.12)" : "rgba(15, 39, 66, 0.65)",
                    border: isExecuted
                      ? "1px solid rgba(34, 197, 94, 0.4)"
                      : act.urgency === "critical" || act.urgency === "high"
                      ? "1px solid rgba(239, 68, 68, 0.4)"
                      : "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: 12,
                    padding: "14px 16px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: isExecuted ? "#4ade80" : "#93c5fd", textTransform: "uppercase" }}>
                        {act.target_module} · {act.urgency}
                      </span>
                      {isExecuted && <span style={{ fontSize: 11, color: "#4ade80", fontWeight: 800 }}>✓ Executed</span>}
                    </div>
                    <strong style={{ fontSize: 13, color: "#ffffff", display: "block" }}>{act.title}</strong>
                    <p style={{ fontSize: 11, color: "#cbd5e1", margin: "4px 0 0", lineHeight: 1.35 }}>{act.description}</p>
                  </div>

                  <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    {isExecuted ? (
                      <span style={{ fontSize: 11, color: "#4ade80", fontWeight: 700 }}>Action completed successfully</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleExecuteAction(act)}
                        disabled={isBusy}
                        style={{
                          background: act.urgency === "high" || act.urgency === "critical" ? "#d92d2d" : "#0284c7",
                          color: "#fff",
                          border: "none",
                          borderRadius: 6,
                          padding: "6px 12px",
                          fontSize: 11,
                          fontWeight: 800,
                          cursor: isBusy ? "not-allowed" : "pointer",
                          opacity: isBusy ? 0.7 : 1,
                        }}
                      >
                        {isBusy ? "Executing…" : `Execute: ${act.title.split(":")[0]}`}
                      </button>
                    )}
                    {act.target_module && (
                      <Link
                        href={`/${act.target_module}`}
                        style={{ fontSize: 11, color: "#60a5fa", textDecoration: "none", fontWeight: 700 }}
                      >
                        Open {act.target_module} →
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
