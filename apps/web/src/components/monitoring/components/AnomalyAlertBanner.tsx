import { AlertTriangle, CheckCircle2, ChevronRight, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { get } from "../api";
import { useWorkspace } from "../context/WorkspaceContext";

interface Anomaly {
  id: string;
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  recommendation: string;
}

export function AnomalyAlertBanner() {
  const { activeProjectId } = useWorkspace();
  const projectId = activeProjectId || "kasneb-towers-2";
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    get<{ anomalies: Anomaly[] }>(`/projects/${projectId}/anomalies`)
      .then((d) => setAnomalies(d.anomalies || []))
      .catch(() => setAnomalies([]));
  }, [projectId]);

  if (anomalies.length === 0) {
    return (
      <div style={{
        padding: "12px 16px", borderRadius: 8, background: "rgba(16,185,129,0.08)",
        border: "1px solid rgba(16,185,129,0.25)", color: "#10b981", display: "flex",
        alignItems: "center", gap: 10, fontSize: 13, fontWeight: 600, marginBottom: 16,
      }}>
        <CheckCircle2 size={18} />
        <span>AI Anomaly Engine: 0 critical budget or schedule anomalies detected for active project.</span>
      </div>
    );
  }

  return (
    <div style={{
      borderRadius: 10, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.3)",
      padding: 14, marginBottom: 16, transition: "all 0.2s ease",
    }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ShieldAlert size={20} style={{ color: "#ef4444" }} />
          <div>
            <strong style={{ fontSize: 14, color: "var(--text)" }}>
              AI Anomaly Detection: {anomalies.length} Potential Project Risk{anomalies.length > 1 ? "s" : ""} Flagged
            </strong>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              Automated audit of variation spikes, uncertified payments & critical path slippage
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#ef4444" }}>
          <span>{expanded ? "Hide Details" : "View Details"}</span>
          <ChevronRight size={16} style={{ transform: expanded ? "rotate(90deg)" : "none", transition: "transform 0.2s" }} />
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          {anomalies.map((a) => (
            <div
              key={a.id}
              style={{
                padding: 12, borderRadius: 8, background: "var(--surface)",
                border: "1px solid var(--border)", borderLeft: `4px solid ${a.severity === "high" ? "#ef4444" : "#f59e0b"}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <AlertTriangle size={14} style={{ color: a.severity === "high" ? "#ef4444" : "#f59e0b" }} />
                <strong style={{ fontSize: 13, color: "var(--text)" }}>{a.title}</strong>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>{a.description}</p>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--primary)" }}>
                💡 Recommendation: {a.recommendation}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
