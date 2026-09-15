import { useEffect } from "react";
import { CheckCircle2, FileText, Printer, X } from "lucide-react";

interface IpcPrintModalProps {
  open: boolean;
  milestone: {
    id: string | number;
    milestone_id: string;
    percent_complete?: number;
  } | null;
  projectName?: string;
  projectCode?: string;
  contractorName?: string;
  data: {
    milestone_id: string;
    percent_complete: number;
    items: any[];
    valuation: any;
  } | null;
  onClose: () => void;
}

export function IpcPrintModal({
  open,
  milestone,
  projectName = "Center Estates Construction",
  projectCode = "PRJ-001",
  contractorName = "Lead General Contractor Ltd",
  data,
  onClose,
}: IpcPrintModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open || !milestone) return null;

  const val = data?.valuation || {};
  const gross = Number(val.current_gross || 0);
  const retention = Number(val.retention_amount || 0);
  const retentionPct = Number(val.retention_percent || 5);
  const advance = Number(val.advance_recovery || 0);
  const advancePct = Number(val.advance_recovery_percent || 10);
  const net = Number(val.net_payable || 0);
  const items = data?.items || [];
  const percentComplete = data?.percent_complete ?? milestone.percent_complete ?? 0;
  const certNumber = val.certificate_number || `IPC-${projectCode}-${milestone.milestone_id}`;
  const currentDate = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1200 }}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 920,
          width: "95vw",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          padding: 0,
          overflow: "hidden",
          borderRadius: 10,
          background: "#ffffff",
          color: "#1e293b",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        }}
      >
        {/* Modal Toolbar (hidden when printing) */}
        <div
          className="no-print"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 20px",
            background: "#f8fafc",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600 }}>
            <FileText size={16} color="#0066cc" />
            <span>Interim Payment Certificate (IPC) Preview</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn primary sm"
              onClick={handlePrint}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <Printer size={14} />
              <span>Print / Save as PDF</span>
            </button>
            <button className="btn ghost sm" onClick={onClose} aria-label="Close modal" style={{ padding: 6 }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Printable Certificate Content */}
        <div
          id="ipc-printable-content"
          style={{
            padding: "40px 48px",
            overflowY: "auto",
            fontSize: 13,
            lineHeight: 1.5,
            color: "#0f172a",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              borderBottom: "2px solid #0f172a",
              paddingBottom: 20,
            }}
          >
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.5, textTransform: "uppercase" }}>
                CENTER ESTATES ERP
              </div>
              <div style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>
                Construction & Infrastructure Monitoring Division
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: "#0f172a",
                  letterSpacing: 0.5,
                  fontFamily: "monospace",
                }}
              >
                {certNumber}
              </div>
              <div style={{ fontSize: 12, color: "#64748b" }}>Date: {currentDate}</div>
            </div>
          </div>

          <div style={{ textAlign: "center", margin: "24px 0 20px" }}>
            <h2
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: 1,
                color: "#0f172a",
              }}
            >
              INTERIM PAYMENT CERTIFICATE
            </h2>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
              Issued in Accordance with FIDIC / JBCC Standard Conditions of Contract
            </div>
          </div>

          {/* Project & Parties Summary Box */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 6,
              padding: "14px 18px",
              marginBottom: 24,
            }}
          >
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                Project Particulars
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{projectName}</div>
              <div style={{ fontSize: 12, color: "#475569" }}>Code: {projectCode}</div>
              <div style={{ fontSize: 12, color: "#475569" }}>
                Milestone Scope: <strong>{milestone.milestone_id}</strong> ({percentComplete}% Verified)
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                Payee / Contractor
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{contractorName}</div>
              <div style={{ fontSize: 12, color: "#475569" }}>Valuation Basis: Itemized Mini-BoQ</div>
              <div style={{ fontSize: 12, color: "#16a34a", fontWeight: 600 }}>
                Status: Certified for Payment
              </div>
            </div>
          </div>

          {/* Itemized Mini-BoQ Table */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", marginBottom: 8, textTransform: "uppercase" }}>
              1. Measured Works Valuation (Mini-BoQ Breakdown)
            </div>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 12,
                border: "1px solid #cbd5e1",
              }}
            >
              <thead>
                <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1" }}>
                  <th style={{ padding: "8px 10px", textAlign: "left", width: 70 }}>Item</th>
                  <th style={{ padding: "8px 10px", textAlign: "left" }}>Description</th>
                  <th style={{ padding: "8px 10px", textAlign: "center", width: 50 }}>Unit</th>
                  <th style={{ padding: "8px 10px", textAlign: "right", width: 90 }}>Rate (KES)</th>
                  <th style={{ padding: "8px 10px", textAlign: "right", width: 80 }}>Allocated</th>
                  <th style={{ padding: "8px 10px", textAlign: "right", width: 80 }}>Certified</th>
                  <th style={{ padding: "8px 10px", textAlign: "right", width: 110 }}>Amount (KES)</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it: any, index: number) => {
                  const rate = Number(it.boq_rate || it.boq_item?.rate || 0);
                  const allocQty = Number(it.allocated_quantity || 0);
                  const certQty = allocQty * (percentComplete / 100);
                  const lineAmount = certQty * rate;

                  return (
                    <tr key={index} style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "8px 10px", fontFamily: "monospace" }}>
                        {it.boq_item_number || it.boq_item?.item_number || `0${index + 1}`}
                      </td>
                      <td style={{ padding: "8px 10px" }}>
                        {it.boq_description || it.boq_item?.description || "Contract item"}
                      </td>
                      <td style={{ padding: "8px 10px", textAlign: "center", color: "#64748b" }}>
                        {it.boq_unit || it.boq_item?.unit || "unit"}
                      </td>
                      <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "monospace" }}>
                        {rate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "monospace" }}>
                        {allocQty.toLocaleString()}
                      </td>
                      <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "monospace", color: "#16a34a" }}>
                        {certQty.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>
                        {lineAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}

                {items.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: "16px", textAlign: "center", color: "#64748b" }}>
                      Milestone valued on overall stage completion rate.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Financial Summary & Deductions Ledger */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginBottom: 36,
            }}
          >
            <div style={{ width: 360, border: "1px solid #cbd5e1", borderRadius: 6, overflow: "hidden" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "8px 14px",
                  background: "#f8fafc",
                  borderBottom: "1px solid #e2e8f0",
                }}
              >
                <span>Total Gross Valuation:</span>
                <strong style={{ fontFamily: "monospace" }}>
                  KES {gross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "8px 14px",
                  color: "#b45309",
                  borderBottom: "1px solid #e2e8f0",
                }}
              >
                <span>Less: Defects Retention ({retentionPct}%):</span>
                <strong style={{ fontFamily: "monospace" }}>
                  - KES {retention.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "8px 14px",
                  color: "#7e22ce",
                  borderBottom: "1px solid #e2e8f0",
                }}
              >
                <span>Less: Advance Mobilization ({advancePct}%):</span>
                <strong style={{ fontFamily: "monospace" }}>
                  - KES {advance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  background: "#f0fdf4",
                  color: "#15803d",
                  fontSize: 14,
                  fontWeight: 800,
                }}
              >
                <span>Net Certified Payable:</span>
                <strong style={{ fontFamily: "monospace" }}>
                  KES {net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </div>
            </div>
          </div>

          {/* Verification & Endorsement Signatories */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", marginBottom: 14, textTransform: "uppercase" }}>
              2. Certification & Approvals
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 20,
              }}
            >
              <div style={{ border: "1px solid #cbd5e1", borderRadius: 6, padding: "12px 14px", minHeight: 120 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>SITE INSPECTOR / COW</div>
                <div style={{ marginTop: 24, borderBottom: "1px solid #94a3b8", height: 28 }} />
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 6 }}>Signature & Date</div>
                <div style={{ fontSize: 11, color: "#16a34a", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                  <CheckCircle2 size={12} /> Physical progress verified
                </div>
              </div>

              <div style={{ border: "1px solid #cbd5e1", borderRadius: 6, padding: "12px 14px", minHeight: 120 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>QUANTITY SURVEYOR</div>
                <div style={{ marginTop: 24, borderBottom: "1px solid #94a3b8", height: 28 }} />
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 6 }}>Signature & Date</div>
                <div style={{ fontSize: 11, color: "#16a34a", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                  <CheckCircle2 size={12} /> BoQ rates & valuation audited
                </div>
              </div>

              <div style={{ border: "1px solid #cbd5e1", borderRadius: 6, padding: "12px 14px", minHeight: 120 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>PROJECT MANAGER / CLIENT</div>
                <div style={{ marginTop: 24, borderBottom: "1px solid #94a3b8", height: 28 }} />
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 6 }}>Signature & Date</div>
                <div style={{ fontSize: 11, color: "#16a34a", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                  <CheckCircle2 size={12} /> Approved for disbursement
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 36,
              paddingTop: 14,
              borderTop: "1px solid #e2e8f0",
              fontSize: 10,
              color: "#94a3b8",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>Center Estates Automated Construction Valuation Engine</span>
            <span>Electronic Audit Trail Hash: SHA256-AUTHENTICATED</span>
          </div>
        </div>

        {/* Global Print Styling */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body * {
              visibility: hidden;
            }
            .modal-overlay {
              position: static !important;
              background: none !important;
              padding: 0 !important;
            }
            .modal {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
              height: auto !important;
              max-height: none !important;
              box-shadow: none !important;
              border: none !important;
            }
            #ipc-printable-content, #ipc-printable-content * {
              visibility: visible !important;
            }
            #ipc-printable-content {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              padding: 10mm 15mm !important;
            }
            .no-print {
              display: none !important;
            }
          }
        `}} />
      </div>
    </div>
  );
}
