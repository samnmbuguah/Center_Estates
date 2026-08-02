import { Calendar, Download, FileText, X } from "lucide-react";
import { useState } from "react";
import { API_BASE, authHeaders } from "../api";
import { useWorkspace } from "../context/WorkspaceContext";

interface SectionOption {
  id: string;
  label: string;
  desc: string;
}

const SECTIONS: SectionOption[] = [
  { id: "summary", label: "Executive Project Summary", desc: "Contract budget, physical completion %, project metadata" },
  { id: "evm", label: "Financial EVM & Valuation Ledger", desc: "Contract sum, gross certified value, retention & advance recovery" },
  { id: "scurve", label: "Physical S-Curve & Progress", desc: "Weekly milestones breakdown and visual progress indicator bars" },
  { id: "consultant", label: "Consultant Payment Certificates", desc: "Approved fee breakdown and certificate payment status" },
];

export function ReportExportModal({ onClose }: { onClose: () => void }) {
  const { activeProjectId, activeProject } = useWorkspace();
  const projectId = activeProjectId || "kasneb-towers-2";
  const [selected, setSelected] = useState<string[]>(["summary", "evm", "scurve", "consultant"]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleSection = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const handleDownload = async () => {
    if (selected.length === 0) {
      setError("Please select at least one section to include in the report.");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/projects/${projectId}/export-pdf-report`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sections: selected,
          start_date: startDate,
          end_date: endDate,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to generate PDF report");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `project-digest-${activeProject?.name || projectId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      onClose();
    } catch (err: any) {
      setError(err.message || "Error generating report");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
    }}>
      <div className="modal card" onClick={(e) => e.stopPropagation()} style={{
        maxWidth: 580, width: "90%", background: "var(--surface)",
        padding: 24, borderRadius: 12, border: "1px solid var(--border)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <FileText size={22} style={{ color: "var(--primary)" }} />
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Custom PDF Report Builder</h3>
          </div>
          <button className="btn ghost sm" onClick={onClose} style={{ padding: 4 }}><X size={18} /></button>
        </div>

        <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
          Customize the sections and date scope for your executive PDF project digest.
        </p>

        {error && (
          <div style={{
            padding: "8px 12px", background: "rgba(239,68,68,0.1)", border: "1px solid #ef4444",
            color: "#ef4444", borderRadius: 6, fontSize: 12, marginBottom: 14,
          }}>
            {error}
          </div>
        )}

        {/* Date Scope Filter */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", display: "block", marginBottom: 4 }}>
              <Calendar size={12} style={{ marginRight: 4 }} /> Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)" }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", display: "block", marginBottom: 4 }}>
              <Calendar size={12} style={{ marginRight: 4 }} /> End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)" }}
            />
          </div>
        </div>

        {/* Section Toggles */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", display: "block", marginBottom: 8 }}>
            Report Sections to Include:
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {SECTIONS.map((sec) => {
              const isChecked = selected.includes(sec.id);
              return (
                <div
                  key={sec.id}
                  onClick={() => toggleSection(sec.id)}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px",
                    borderRadius: 8, border: `1px solid ${isChecked ? "var(--primary)" : "var(--border)"}`,
                    background: isChecked ? "rgba(217,45,45,0.05)" : "var(--surface-2)",
                    cursor: "pointer", transition: "all 0.15s ease",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}}
                    style={{ marginTop: 3, cursor: "pointer" }}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{sec.label}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>{sec.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button className="btn ghost sm" onClick={onClose} disabled={loading}>Cancel</button>
          <button
            className="btn primary sm"
            onClick={handleDownload}
            disabled={loading}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <Download size={14} /> {loading ? "Generating PDF..." : "Export Custom PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
