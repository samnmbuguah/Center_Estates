"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

export type DailyBriefingPriority = {
  id: string;
  severity: "high" | "medium" | "low";
  icon: string;
  title: string;
  description: string;
  actionLabel: string;
  actionRoute: string;
  category: string;
};

export type DailyBriefingData = {
  status: string;
  greeting: string;
  generatedAt: string;
  propertyScope: string;
  healthScore: number;
  priorities: DailyBriefingPriority[];
  quickStats: {
    collectionRate: string;
    activeTenants: number;
    openTickets: number;
    pendingApprovals: number;
  };
};

export function DailyBriefingCard({
  userName,
  onNavigate,
}: {
  userName: string;
  onNavigate?: (route: string) => void;
}) {
  const [data, setData] = useState<DailyBriefingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadBriefing() {
      try {
        const res = await apiFetch("/companion/dashboard/daily-briefing/");
        if (res.ok && !cancelled) {
          const json = (await res.json()) as DailyBriefingData;
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

    const speechText = `${data.greeting} Key priorities: ${data.priorities.map((p) => p.title).join(". ")}`;
    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.rate = 1.0;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
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
        <span style={{ fontSize: 13, color: "#94a3b8" }}>Synthesizing daily operational briefing...</span>
      </div>
    );
  }

  if (!data) return null;

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
      {/* Header with Greeting & Voice Synthesis */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
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
                Daily Intelligence Briefing
              </span>
              <span style={{ fontSize: 10, color: "#94a3b8" }}>· {data.generatedAt}</span>
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 900, margin: "2px 0 0", color: "#ffffff" }}>
              {data.greeting}
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
            <strong style={{ fontSize: 14, color: data.healthScore >= 80 ? "#4ade80" : "#fbbf24", fontWeight: 900 }}>
              {data.healthScore}/100
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
            <span>{isSpeaking ? "Stop Briefing" : "Read Aloud"}</span>
          </button>
        </div>
      </div>

      {/* Priority Actionable Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
        {data.priorities.map((item) => (
          <div
            key={item.id}
            style={{
              background: "rgba(15, 39, 66, 0.65)",
              border: item.severity === "high" ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: 12,
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: "#93c5fd", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {item.category}
                </span>
                <span style={{ fontSize: 16 }}>{item.icon}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#ffffff" }}>
                {item.title}
              </div>
              <div style={{ fontSize: 11, color: "#cbd5e1", marginTop: 4, lineHeight: 1.4 }}>
                {item.description}
              </div>
            </div>

            <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: 8, marginTop: 4 }}>
              {onNavigate ? (
                <button
                  type="button"
                  onClick={() => onNavigate(item.actionRoute)}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    color: "#60a5fa",
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <span>{item.actionLabel}</span>
                  <span>→</span>
                </button>
              ) : (
                <Link
                  href={item.actionRoute}
                  style={{
                    color: "#60a5fa",
                    fontSize: 12,
                    fontWeight: 800,
                    textDecoration: "none",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <span>{item.actionLabel}</span>
                  <span>→</span>
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
