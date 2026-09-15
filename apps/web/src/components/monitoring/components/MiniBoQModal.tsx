import { useEffect, useState, useCallback } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Coins,
  FileCheck,
  Layers,
  Percent,
  Printer,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
import { IpcPrintModal } from "./IpcPrintModal";
import { BoQAllocationDrawer } from "./BoQAllocationDrawer";
import {
  fetchMilestoneMiniBoQ,
  autoMapBoQToMilestones,
  runMilestoneAiAudit,
} from "../api";

interface MiniBoQModalProps {
  open: boolean;
  milestone: {
    id: string | number;
    milestone_id: string;
    percent_complete?: number;
    payment_value?: string | number | null;
  } | null;
  projectId: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function MiniBoQModal({
  open,
  milestone,
  projectId,
  onClose,
  onSuccess,
}: MiniBoQModalProps) {
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showAllocationDrawer, setShowAllocationDrawer] = useState(false);
  const [data, setData] = useState<{
    milestone_id: string;
    percent_complete: number;
    items: any[];
    valuation: any;
  } | null>(null);

  const [auditResult, setAuditResult] = useState<{
    audit_status: string;
    confidence_score: number;
    anomalies: any[];
    recommendation: string;
  } | null>(null);

  const loadData = useCallback(() => {
    if (!milestone?.id) return;
    setLoading(true);
    setError(null);
    fetchMilestoneMiniBoQ(milestone.id)
      .then((res) => {
        setData(res);
      })
      .catch((err) => {
        setError(err.message || "Failed to fetch mini-BoQ line items");
      })
      .finally(() => setLoading(false));
  }, [milestone?.id]);

  useEffect(() => {
    if (open && milestone?.id) {
      loadData();
      setAuditResult(null);
    }
  }, [open, milestone?.id, loadData]);

  const handleAutoMap = async () => {
    if (!projectId || !milestone?.milestone_id) return;
    setActionLoading(true);
    setError(null);
    try {
      await autoMapBoQToMilestones(projectId, milestone.milestone_id);
      loadData();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || "Auto-mapping failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRunAiAudit = async () => {
    if (!milestone?.id) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await runMilestoneAiAudit(milestone.id);
      setAuditResult(res);
    } catch (err: any) {
      setError(err.message || "AI Audit execution failed");
    } finally {
      setActionLoading(false);
    }
  };

  if (!open || !milestone) return null;

  const val = data?.valuation || {};
  const gross = val.current_gross ?? 0;
  const retention = val.retention_amount ?? 0;
  const advance = val.advance_recovery ?? 0;
  const net = val.net_payable ?? 0;
  const items = data?.items || [];
  const percentComplete = data?.percent_complete ?? milestone.percent_complete ?? 0;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 960,
          width: "92vw",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          padding: 0,
          overflow: "hidden",
          borderRadius: 12,
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "18px 24px",
            borderBottom: "1px solid var(--border)",
            background: "var(--surface)",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                Mini-BoQ Valuation Engine
              </h3>
              <span
                style={{
                  fontFamily: "monospace",
                  padding: "3px 8px",
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: 600,
                  background: "var(--accent-subtle, rgba(0, 102, 204, 0.1))",
                  color: "var(--color-brand-blue, #0066cc)",
                }}
              >
                {milestone.milestone_id}
              </span>
              <span
                style={{
                  padding: "3px 8px",
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: 600,
                  background: percentComplete >= 100 ? "#e6f9ed" : "#fff8e6",
                  color: percentComplete >= 100 ? "#1b7340" : "#996b00",
                }}
              >
                {percentComplete}% Complete
              </span>
            </div>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: 12,
                color: "var(--muted)",
              }}
            >
              Contractual line-item breakdown, automated IPC valuation deductions, and AI claim verification.
            </p>
          </div>
          <button
            className="btn ghost sm"
            onClick={onClose}
            style={{ padding: 6, borderRadius: "50%" }}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div
          style={{
            padding: "20px 24px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          {error && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                background: "#fde8e8",
                color: "#c81e1e",
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Valuation KPI Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
              gap: 12,
            }}
          >
            {/* Gross Value */}
            <div
              style={{
                padding: "14px 16px",
                borderRadius: 8,
                background: "var(--surface)",
                border: "1px solid var(--border)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--muted)", fontSize: 12 }}>
                <Coins size={14} />
                <span>Gross Value</span>
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, fontFamily: "monospace" }}>
                KES {Number(gross).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                At {percentComplete}% progress
              </div>
            </div>

            {/* Retention */}
            <div
              style={{
                padding: "14px 16px",
                borderRadius: 8,
                background: "var(--surface)",
                border: "1px solid var(--border)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#b45309", fontSize: 12 }}>
                <Percent size={14} />
                <span>Retention (5%)</span>
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: "#b45309", fontFamily: "monospace" }}>
                - KES {Number(retention).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                Defects liability reserve
              </div>
            </div>

            {/* Advance Recovery */}
            <div
              style={{
                padding: "14px 16px",
                borderRadius: 8,
                background: "var(--surface)",
                border: "1px solid var(--border)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#9333ea", fontSize: 12 }}>
                <Coins size={14} />
                <span>Advance Recovery (10%)</span>
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: "#9333ea", fontFamily: "monospace" }}>
                - KES {Number(advance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                Mobilization amortization
              </div>
            </div>

            {/* Net Payable */}
            <div
              style={{
                padding: "14px 16px",
                borderRadius: 8,
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#15803d", fontSize: 12, fontWeight: 600 }}>
                <FileCheck size={14} />
                <span>Net Certified Payable</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4, color: "#166534", fontFamily: "monospace" }}>
                KES {Number(net).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: 11, color: "#15803d", marginTop: 2 }}>
                Interim Payment Certificate (IPC)
              </div>
            </div>
          </div>

          {/* AI Progress Audit Report */}
          {auditResult && (
            <div
              style={{
                borderRadius: 8,
                padding: "14px 18px",
                border: "1px solid",
                borderColor:
                  auditResult.audit_status === "pass"
                    ? "#86efac"
                    : auditResult.audit_status === "warning"
                    ? "#fde047"
                    : "#fca5a5",
                background:
                  auditResult.audit_status === "pass"
                    ? "#f0fdf4"
                    : auditResult.audit_status === "warning"
                    ? "#fefce8"
                    : "#fef2f2",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Bot size={18} color="#0066cc" />
                  <strong style={{ fontSize: 14 }}>
                    Quartermaster AI Progress Audit Report
                  </strong>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>Confidence:</span>
                  <strong
                    style={{
                      fontSize: 14,
                      color: auditResult.confidence_score >= 80 ? "#15803d" : "#b45309",
                    }}
                  >
                    {auditResult.confidence_score}%
                  </strong>
                  <span
                    style={{
                      textTransform: "uppercase",
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "2px 6px",
                      borderRadius: 4,
                      background:
                        auditResult.audit_status === "pass"
                          ? "#dcfce7"
                          : auditResult.audit_status === "warning"
                          ? "#fef9c3"
                          : "#fee2e2",
                      color:
                        auditResult.audit_status === "pass"
                          ? "#166534"
                          : auditResult.audit_status === "warning"
                          ? "#854d0e"
                          : "#991b1b",
                    }}
                  >
                    {auditResult.audit_status}
                  </span>
                </div>
              </div>

              <p style={{ fontSize: 13, margin: "8px 0 6px", color: "var(--text)" }}>
                {auditResult.recommendation}
              </p>

              {auditResult.anomalies && auditResult.anomalies.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                  {auditResult.anomalies.map((ano: any, idx: number) => (
                    <div
                      key={idx}
                      style={{
                        fontSize: 12,
                        padding: "6px 10px",
                        borderRadius: 6,
                        background: "rgba(255,255,255,0.8)",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      {ano.severity === "high" ? (
                        <ShieldAlert size={14} color="#dc2626" />
                      ) : (
                        <AlertTriangle size={14} color="#d97706" />
                      )}
                      <strong>{ano.issue}:</strong> {ano.detail}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Action Toolbar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Allocated Items</span>
              <span
                style={{
                  fontSize: 11,
                  padding: "2px 6px",
                  borderRadius: 10,
                  background: "var(--border)",
                  color: "var(--text)",
                }}
              >
                {items.length} lines
              </span>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn ghost sm"
                onClick={() => setShowAllocationDrawer(true)}
                title="Manage which BoQ line items and quantities belong to this milestone"
              >
                <Layers size={14} />
                <span>Manage Allocations</span>
              </button>

              <button
                className="btn ghost sm"
                onClick={handleAutoMap}
                disabled={actionLoading || loading}
                title="Automatically match project BoQ items by keyword and section"
              >
                <Sparkles size={14} />
                <span>Auto-Map BoQ</span>
              </button>

              <button
                className="btn ghost sm"
                onClick={handleRunAiAudit}
                disabled={actionLoading || loading}
                title="Audit photographic evidence, geofence, and contractual coverage"
              >
                <Bot size={14} />
                <span>AI Progress Audit</span>
              </button>

              <button
                className="btn ghost sm"
                onClick={loadData}
                disabled={loading}
                title="Refresh valuation data"
              >
                <RefreshCw size={14} className={loading ? "spin" : ""} />
              </button>
            </div>
          </div>

          {/* Mini-BoQ Line Items Table */}
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                  <th style={{ padding: "10px 12px", width: 90 }}>Item No.</th>
                  <th style={{ padding: "10px 12px" }}>Description</th>
                  <th style={{ padding: "10px 12px", width: 60 }}>Unit</th>
                  <th style={{ padding: "10px 12px", textAlign: "right", width: 100 }}>Rate (KES)</th>
                  <th style={{ padding: "10px 12px", textAlign: "right", width: 100 }}>Allocated Qty</th>
                  <th style={{ padding: "10px 12px", textAlign: "right", width: 100 }}>Certified Qty</th>
                  <th style={{ padding: "10px 12px", textAlign: "right", width: 130 }}>Line Amount (KES)</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it: any) => {
                  const rate = Number(it.boq_rate || it.boq_item?.rate || 0);
                  const allocQty = Number(it.allocated_quantity || 0);
                  const certQty = allocQty * (percentComplete / 100);
                  const lineAmount = certQty * rate;

                  return (
                    <tr
                      key={it.id}
                      style={{
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      <td style={{ padding: "10px 12px", fontFamily: "monospace", color: "var(--muted)" }}>
                        {it.boq_item_number || it.boq_item?.item_number || "—"}
                      </td>
                      <td style={{ padding: "10px 12px", fontWeight: 500 }}>
                        {it.boq_description || it.boq_item?.description || "—"}
                      </td>
                      <td style={{ padding: "10px 12px", color: "var(--muted)" }}>
                        {it.boq_unit || it.boq_item?.unit || "—"}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "monospace" }}>
                        {rate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "monospace" }}>
                        {allocQty.toLocaleString()}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "monospace", color: "#15803d" }}>
                        {certQty.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>
                        {lineAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}

                {items.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "32px 16px", color: "var(--muted)" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                        <Wrench size={24} style={{ opacity: 0.5 }} />
                        <span>No BoQ line items mapped to this milestone yet.</span>
                        <button
                          className="btn sm"
                          onClick={handleAutoMap}
                          disabled={actionLoading}
                          style={{ marginTop: 6 }}
                        >
                          <Sparkles size={14} />
                          <span>Run Auto-Map from Project BoQ</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "14px 24px",
            borderTop: "1px solid var(--border)",
            background: "var(--surface)",
          }}
        >
          <div style={{ fontSize: 12, color: "var(--muted)" }}>
            Calculations strictly adhere to FIDIC/JBCC contractual norms with 5% defects retention and 10% advance recovery.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn primary sm"
              onClick={() => setShowPrintModal(true)}
              title="Generate printable FIDIC Interim Payment Certificate"
            >
              <Printer size={14} />
              <span>Print IPC Certificate</span>
            </button>
            <button className="btn ghost" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>

      <IpcPrintModal
        open={showPrintModal}
        milestone={milestone}
        data={data}
        onClose={() => setShowPrintModal(false)}
      />

      <BoQAllocationDrawer
        open={showAllocationDrawer}
        milestone={milestone}
        projectId={projectId}
        onClose={() => setShowAllocationDrawer(false)}
        onSuccess={() => { loadData(); if (onSuccess) onSuccess(); }}
      />
    </div>
  );
}

