"use client";

import { useState } from "react";

export interface IpcCertificate {
  certificateNumber: string;
  projectName: string;
  contractorName: string;
  periodEnding: string;
  originalContractSum: number;
  approvedVariationsSum: number;
  revisedContractSum: number;
  grossValuationToDate: number;
  previousGrossValuation: number;
  currentGrossValuation: number;
  retentionPct: number;
  retentionDeductionToDate: number;
  advancePaymentRecovery: number;
  netPayableThisCertificate: number;
  status: "draft" | "certified" | "approved" | "disbursed";
}

interface IpcBuilderProps {
  initialData?: Partial<IpcCertificate>;
}

const DEFAULT_IPC: IpcCertificate = {
  certificateNumber: "IPC-2026-004",
  projectName: "Center Estates Commercial Plaza Tower A",
  contractorName: "Apex Construction Infrastructure Ltd",
  periodEnding: "2026-07-31",
  originalContractSum: 450000000,
  approvedVariationsSum: 18500000,
  revisedContractSum: 468500000,
  grossValuationToDate: 142000000,
  previousGrossValuation: 110000000,
  currentGrossValuation: 32000000,
  retentionPct: 10,
  retentionDeductionToDate: 14200000,
  advancePaymentRecovery: 3200000,
  netPayableThisCertificate: 25600000,
  status: "certified",
};

const cash = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 });

export function IpcBuilder({ initialData }: IpcBuilderProps) {
  const [data, setData] = useState<IpcCertificate>({ ...DEFAULT_IPC, ...initialData });
  const [printMode, setPrintMode] = useState(false);

  return (
    <div style={{ background: "#ffffff", borderRadius: 12, border: "1px solid #e2e8f0", padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
      {/* Header Actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, borderBottom: "1px solid #e2e8f0", paddingBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1.2rem", color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
            <span>📄 Interim Payment Certificate (IPC)</span>
            <span style={{
              fontSize: "0.75rem", padding: "2px 10px", borderRadius: 12, fontWeight: "bold",
              background: data.status === "certified" ? "#dcfce7" : "#dbeafe",
              color: data.status === "certified" ? "#166534" : "#1e40af"
            }}>
              {data.status.toUpperCase()}
            </span>
          </h3>
          <small style={{ color: "#64748b" }}>Certificate #{data.certificateNumber} — Valuation Period Ending {data.periodEnding}</small>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => window.print()}
            style={{ background: "#2563eb", color: "#ffffff", border: "none", padding: "8px 16px", borderRadius: 6, fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}
          >
            🖨️ Export PDF / Print
          </button>
        </div>
      </div>

      {/* Contract & Party Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
        <div style={{ background: "#f8fafc", padding: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}>
          <small style={{ color: "#64748b", textTransform: "uppercase", fontSize: "0.7rem", fontWeight: "bold" }}>Project Name</small>
          <div style={{ fontWeight: "bold", color: "#0f172a", marginTop: 2, fontSize: "0.9rem" }}>{data.projectName}</div>
        </div>

        <div style={{ background: "#f8fafc", padding: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}>
          <small style={{ color: "#64748b", textTransform: "uppercase", fontSize: "0.7rem", fontWeight: "bold" }}>Main Contractor</small>
          <div style={{ fontWeight: "bold", color: "#0f172a", marginTop: 2, fontSize: "0.9rem" }}>{data.contractorName}</div>
        </div>

        <div style={{ background: "#f8fafc", padding: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}>
          <small style={{ color: "#64748b", textTransform: "uppercase", fontSize: "0.7rem", fontWeight: "bold" }}>Revised Contract Sum</small>
          <div style={{ fontWeight: "bold", color: "#2563eb", marginTop: 2, fontSize: "0.95rem" }}>{cash.format(data.revisedContractSum)}</div>
        </div>
      </div>

      {/* Valuation Computation Statement */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem", marginBottom: 20 }}>
        <thead>
          <tr style={{ background: "#0f172a", color: "#ffffff" }}>
            <th style={{ padding: 10, textAlign: "left" }}>Valuation & Deduction Item Breakdown</th>
            <th style={{ padding: 10, textAlign: "right", width: 180 }}>Cumulative Value</th>
            <th style={{ padding: 10, textAlign: "right", width: 180 }}>This Certificate</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
            <td style={{ padding: 10, fontWeight: 600 }}>1. Original Contract Sum</td>
            <td style={{ padding: 10, textAlign: "right" }}>{cash.format(data.originalContractSum)}</td>
            <td style={{ padding: 10, textAlign: "right", color: "#94a3b8" }}>—</td>
          </tr>
          <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
            <td style={{ padding: 10, fontWeight: 600 }}>2. Approved Net Variations</td>
            <td style={{ padding: 10, textAlign: "right", color: "#16a34a" }}>+{cash.format(data.approvedVariationsSum)}</td>
            <td style={{ padding: 10, textAlign: "right", color: "#94a3b8" }}>—</td>
          </tr>
          <tr style={{ borderBottom: "2px solid #0f172a", background: "#f8fafc" }}>
            <td style={{ padding: 10, fontWeight: "bold" }}>REVISED CONTRACT VALUE</td>
            <td style={{ padding: 10, textAlign: "right", fontWeight: "bold" }}>{cash.format(data.revisedContractSum)}</td>
            <td style={{ padding: 10, textAlign: "right", color: "#94a3b8" }}>—</td>
          </tr>

          <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
            <td style={{ padding: 10, fontWeight: 600 }}>3. Gross Measured Work & Material on Site</td>
            <td style={{ padding: 10, textAlign: "right", fontWeight: "bold" }}>{cash.format(data.grossValuationToDate)}</td>
            <td style={{ padding: 10, textAlign: "right", fontWeight: "bold", color: "#2563eb" }}>{cash.format(data.currentGrossValuation)}</td>
          </tr>
          <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
            <td style={{ padding: 10, color: "#dc2626" }}>Less: Retention Fund ({data.retentionPct}%)</td>
            <td style={{ padding: 10, textAlign: "right", color: "#dc2626" }}>-{cash.format(data.retentionDeductionToDate)}</td>
            <td style={{ padding: 10, textAlign: "right", color: "#dc2626" }}>-{cash.format(data.currentGrossValuation * (data.retentionPct / 100))}</td>
          </tr>
          <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
            <td style={{ padding: 10, color: "#dc2626" }}>Less: Advance Payment Recovery</td>
            <td style={{ padding: 10, textAlign: "right", color: "#dc2626" }}>-{cash.format(data.advancePaymentRecovery)}</td>
            <td style={{ padding: 10, textAlign: "right", color: "#dc2626" }}>-{cash.format(data.advancePaymentRecovery)}</td>
          </tr>

          <tr style={{ background: "#dcfce7", borderTop: "2px solid #16a34a" }}>
            <td style={{ padding: 12, fontWeight: "bold", fontSize: "1rem", color: "#166534" }}>NET AMOUNT PAYABLE TO CONTRACTOR</td>
            <td style={{ padding: 12, textAlign: "right", fontWeight: "bold", fontSize: "1rem", color: "#166534" }}>
              {cash.format(data.grossValuationToDate - data.retentionDeductionToDate - data.advancePaymentRecovery)}
            </td>
            <td style={{ padding: 12, textAlign: "right", fontWeight: "bold", fontSize: "1.1rem", color: "#15803d" }}>
              {cash.format(data.netPayableThisCertificate)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Signatures & Certification block */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginTop: 24, paddingTop: 16, borderTop: "1px dashed #cbd5e1" }}>
        <div style={{ textAlign: "center", borderTop: "1px solid #94a3b8", paddingTop: 8 }}>
          <small style={{ color: "#64748b" }}>Quantity Surveyor Certification</small>
          <div style={{ fontWeight: "bold", color: "#0f172a", marginTop: 4 }}>Registered QS #QS-8821</div>
        </div>

        <div style={{ textAlign: "center", borderTop: "1px solid #94a3b8", paddingTop: 8 }}>
          <small style={{ color: "#64748b" }}>Project Architect Approval</small>
          <div style={{ fontWeight: "bold", color: "#0f172a", marginTop: 4 }}>Lead Architect #ARC-1092</div>
        </div>

        <div style={{ textAlign: "center", borderTop: "1px solid #94a3b8", paddingTop: 8 }}>
          <small style={{ color: "#64748b" }}>Client Representative Authorization</small>
          <div style={{ fontWeight: "bold", color: "#0f172a", marginTop: 4 }}>Center Estates Finance Dir</div>
        </div>
      </div>
    </div>
  );
}
