"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type AgentActionItem = {
  id: string;
  title: string;
  description: string;
  urgency: "critical" | "high" | "normal" | "low";
  target_module: "property" | "facility" | "finance" | "companion";
  proposed_patch: Record<string, unknown>;
  requires_approval: boolean;
};

type LangGraphBriefingData = {
  headline?: string;
  greeting?: string;
  date?: string;
  generatedAt?: string;
  portfolio_health_score?: number;
  healthScore?: number;
  critical_alerts?: string[];
  briefing_narrative?: string;
  proposed_actions?: AgentActionItem[];
  kpis?: {
    total_units?: number;
    occupied_units?: number;
    occupancy_rate?: number;
    monthly_collection_rate?: number;
    open_work_orders?: number;
    critical_tickets?: number;
  };
  metrics?: Array<{
    label: string;
    value: string | number;
    change?: string;
    tone?: "green" | "red" | "yellow" | "blue";
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

  // Proactive Nudges state
  const [nudgesData, setNudgesData] = useState<{ arrears_nudges: any[]; escalation_nudges: any[]; total_nudges: number; arrears_count?: number; escalation_count?: number } | null>(null);
  const [dispatchingNudgeId, setDispatchingNudgeId] = useState<string | null>(null);
  const [dispatchedNudgeIds, setDispatchedNudgeIds] = useState<Set<string>>(new Set());


  useEffect(() => {
    let cancelled = false;
    async function loadBriefing() {
      try {
        const [res, nudgesRes] = await Promise.all([
          apiFetch("/companion/dashboard/daily-briefing/"),
          apiFetch("/companion/dashboard/nudges/"),
        ]);
        if (res.ok && !cancelled) {
          const json = (await res.json()) as LangGraphBriefingData;
          setData(json);
        }
        if (nudgesRes.ok && !cancelled) {
          const nJson = await nudgesRes.json();
          setNudgesData(nJson);
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

  const handleDispatchNudge = async (nudge: any, channel: "whatsapp" | "sms" | "email") => {
    setDispatchingNudgeId(nudge.id);
    try {
      const msg = channel === "whatsapp" ? (nudge.whatsapp_draft || nudge.notice_draft) : (nudge.sms_draft || nudge.notice_draft);
      const res = await apiFetch("/companion/dashboard/nudges/dispatch/", {
        method: "POST",
        body: JSON.stringify({
          type: nudge.type,
          tenant_id: nudge.tenant_id,
          channel,
          message: msg,
        }),
      });
      if (res.ok) {
        setDispatchedNudgeIds((prev) => new Set(prev).add(nudge.id));
      }
    } catch {
      // ignore
    } finally {
      setDispatchingNudgeId(null);
    }
  };


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
          background: "linear-gradient(135deg, rgba(13, 148, 136, 0.08) 0%, rgba(2, 132, 199, 0.08) 100%)",
          borderRadius: 14,
          padding: "20px 24px",
          color: "var(--text, var(--color-slate-900))",
          border: "1px solid rgba(13, 148, 136, 0.2)",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <span style={{ fontSize: 20 }}>⏳</span>
        <span style={{ fontSize: 13, color: "var(--text-secondary, var(--color-slate-500))" }}>
          Quartermaster AI is checking live operations…
        </span>
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
        background: "linear-gradient(135deg, rgba(240, 253, 250, 0.95) 0%, rgba(240, 249, 255, 0.95) 100%)",
        borderRadius: 16,
        padding: "22px 26px",
        color: "var(--color-slate-900)",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.04)",
        border: "1px solid rgba(13, 148, 136, 0.22)",
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
              background: "rgba(13, 148, 136, 0.12)",
              border: "1.5px solid rgba(13, 148, 136, 0.3)",
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
              <span style={{ fontSize: 11, letterSpacing: "0.08em", fontWeight: 800, color: "#0f766e", textTransform: "uppercase" }}>
                Quartermaster AI Orchestrator
              </span>
              <span style={{ fontSize: 11, color: "var(--color-slate-500)" }}>· {data.date || data.generatedAt || "Today"}</span>
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 900, margin: "2px 0 0", color: "var(--color-slate-900)" }}>
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
              background: "rgba(255, 255, 255, 0.9)",
              border: "1px solid rgba(13, 148, 136, 0.25)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
            }}
          >
            <span style={{ fontSize: 11, color: "var(--color-slate-500)", fontWeight: 600 }}>Portfolio Health:</span>
            <strong style={{ fontSize: 14, color: healthScore >= 80 ? "var(--color-success)" : "var(--color-warning)", fontWeight: 900 }}>
              {healthScore}/100
            </strong>
          </div>

          {/* Voice Readout Button */}
          <button
            type="button"
            onClick={handleSpeak}
            style={{
              background: isSpeaking ? "var(--color-danger)" : "#ffffff",
              color: isSpeaking ? "#ffffff" : "#0f766e",
              border: "1px solid rgba(13, 148, 136, 0.3)",
              borderRadius: 10,
              padding: "7px 14px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
              transition: "all 0.15s ease",
            }}
          >
            <span>{isSpeaking ? "⏹️" : "🔊"}</span>
            <span>{isSpeaking ? "Stop" : "Read Aloud"}</span>
          </button>
        </div>
      </div>

      {/* Narrative Summary if present */}
      {data.briefing_narrative && (
        <div
          style={{
            background: "rgba(255, 255, 255, 0.8)",
            borderRadius: 10,
            padding: "12px 16px",
            border: "1px solid rgba(13, 148, 136, 0.15)",
            fontSize: 13,
            lineHeight: 1.6,
            color: "var(--color-slate-700)",
          }}
        >
          {data.briefing_narrative}
        </div>
      )}

      {/* Critical Alerts Banner */}
      {data.critical_alerts && data.critical_alerts.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {data.critical_alerts.map((alert, idx) => (
            <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--color-slate-700)" }}>
              <span style={{ color: "var(--color-teal)", fontWeight: 800 }}>•</span>
              <span>{alert}</span>
            </div>
          ))}
        </div>
      )}

      {/* Actionable Proposed Interventions (Human in the loop 1-click execution) */}
      {actions.length > 0 && (
        <div style={{ borderTop: "1px solid rgba(13, 148, 136, 0.15)", paddingTop: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#0f766e", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
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
                    background: isExecuted ? "rgba(22, 163, 74, 0.08)" : "#ffffff",
                    border: isExecuted
                      ? "1px solid rgba(22, 163, 74, 0.3)"
                      : act.urgency === "critical" || act.urgency === "high"
                      ? "1px solid rgba(239, 68, 68, 0.3)"
                      : "1px solid rgba(13, 148, 136, 0.18)",
                    borderRadius: 12,
                    padding: "14px 16px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: 10,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: isExecuted ? "var(--color-success)" : "#0f766e", textTransform: "uppercase" }}>
                        {act.target_module} · {act.urgency}
                      </span>
                      {isExecuted && <span style={{ fontSize: 11, color: "var(--color-success)", fontWeight: 800 }}>✓ Executed</span>}
                    </div>
                    <strong style={{ fontSize: 13, color: "var(--color-slate-900)", display: "block" }}>{act.title}</strong>
                    <p style={{ fontSize: 12, color: "var(--color-slate-500)", margin: "4px 0 0", lineHeight: 1.4 }}>{act.description}</p>
                  </div>

                  <div style={{ borderTop: "1px solid rgba(148, 163, 184, 0.15)", paddingTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    {isExecuted ? (
                      <span style={{ fontSize: 11, color: "var(--color-success)", fontWeight: 700 }}>Action completed successfully</span>
                    ) : (
                      <>
                        <span style={{ fontSize: 11, color: "var(--color-slate-500)" }}>Requires Approval</span>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleExecuteAction(act)}
                          style={{
                            background: "#0f766e",
                            color: "#ffffff",
                            border: "none",
                            borderRadius: 6,
                            padding: "6px 12px",
                            fontSize: 11,
                            fontWeight: 800,
                            cursor: "pointer",
                            transition: "background 0.12s ease",
                          }}
                        >
                          {isBusy ? "Executing..." : "Approve & Execute"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Proactive Nudges & Tenant Communications */}
      {nudgesData && nudgesData.total_nudges > 0 && (
        <div style={{ borderTop: "1px solid rgba(13, 148, 136, 0.15)", paddingTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--color-violet)", textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 6 }}>
              <span>🔔</span> Proactive AI Action Nudges ({nudgesData.total_nudges})
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>
              {nudgesData.arrears_count} Arrears · {nudgesData.escalation_count} Escalations
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: 12 }}>
            {/* Arrears Nudges */}
            {nudgesData.arrears_nudges.map((nudge) => {
              const isDispatched = dispatchedNudgeIds.has(nudge.id);
              const isBusy = dispatchingNudgeId === nudge.id;
              return (
                <div
                  key={nudge.id}
                  style={{
                    background: isDispatched ? "rgba(22, 163, 74, 0.08)" : "var(--surface)",
                    border: isDispatched ? "1px solid rgba(22, 163, 74, 0.3)" : "1px solid rgba(239, 68, 68, 0.3)",
                    borderRadius: 10,
                    padding: "12px 14px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: "var(--color-danger)", textTransform: "uppercase" }}>
                        ⚠️ Rent Arrears · {nudge.days_overdue}d Overdue
                      </span>
                      {isDispatched && <span style={{ fontSize: 11, color: "var(--color-success)", fontWeight: 800 }}>✓ Sent</span>}
                    </div>
                    <strong style={{ fontSize: 13, color: "var(--text-primary)" }}>{nudge.tenant_name}</strong>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                      Unit {nudge.unit_code} ({nudge.property_name}) · Balance: <strong style={{ color: "var(--color-danger)" }}>KES {Number(nudge.total_balance).toLocaleString()}</strong>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 6, fontStyle: "italic", background: "var(--surface-2)", padding: "6px 8px", borderRadius: 6 }}>
                      &ldquo;{nudge.sms_draft}&rdquo;
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                    {isDispatched ? (
                      <span style={{ fontSize: 11, color: "var(--color-success)", fontWeight: 700 }}>Notification recorded</span>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleDispatchNudge(nudge, "whatsapp")}
                          style={{
                            background: "#25d366",
                            color: "#ffffff",
                            border: "none",
                            borderRadius: 6,
                            padding: "4px 10px",
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          💬 WhatsApp
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleDispatchNudge(nudge, "sms")}
                          style={{
                            background: "var(--color-indigo)",
                            color: "#ffffff",
                            border: "none",
                            borderRadius: 6,
                            padding: "4px 10px",
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          📱 SMS
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Escalation Nudges */}
            {nudgesData.escalation_nudges.map((nudge) => {
              const isDispatched = dispatchedNudgeIds.has(nudge.id);
              const isBusy = dispatchingNudgeId === nudge.id;
              return (
                <div
                  key={nudge.id}
                  style={{
                    background: isDispatched ? "rgba(22, 163, 74, 0.08)" : "var(--surface)",
                    border: isDispatched ? "1px solid rgba(22, 163, 74, 0.3)" : "1px solid rgba(124, 58, 237, 0.3)",
                    borderRadius: 10,
                    padding: "12px 14px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: "var(--color-violet)", textTransform: "uppercase" }}>
                        📈 Rent Escalation · In {nudge.days_until}d
                      </span>
                      {isDispatched && <span style={{ fontSize: 11, color: "var(--color-success)", fontWeight: 800 }}>✓ Sent</span>}
                    </div>
                    <strong style={{ fontSize: 13, color: "var(--text-primary)" }}>{nudge.tenant_name}</strong>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                      Unit {nudge.unit_code} · KES {Number(nudge.old_rent).toLocaleString()} ➔ <strong style={{ color: "var(--color-success)" }}>KES {Number(nudge.new_rent).toLocaleString()}</strong> (+{nudge.escalation_percent}%)
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                    {isDispatched ? (
                      <span style={{ fontSize: 11, color: "var(--color-success)", fontWeight: 700 }}>Notice dispatched</span>
                    ) : (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleDispatchNudge(nudge, "email")}
                        style={{
                          background: "var(--color-violet)",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: 6,
                          padding: "5px 12px",
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        📨 Dispatch Escalation Notice
                      </button>
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

