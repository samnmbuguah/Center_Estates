"use client";

import React from "react";
import Link from "next/link";
import { DetailDrawer, money } from "@/components/module-ui";
import { useAuth } from "@/components/auth-provider";
import { Candidate, issueResolution, isMissingWaterReading } from "./types";

export function CandidatePreviewDrawer({
  candidate,
  onClose,
  onRecordMeter,
}: {
  candidate: Candidate;
  onClose: () => void;
  onRecordMeter?: (c: Candidate) => void;
}) {
  const { session } = useAuth();
  const currentOrg = session?.organizations.find((o) => o.id === session?.activeOrganizationId) || session?.organizations[0];
  const orgName = currentOrg?.company_name || currentOrg?.name || "Legend Management";
  const isMissingWater = isMissingWaterReading(candidate);
  const isReady = candidate.status === "ready" && !isMissingWater;
  const hasIssues = candidate.issue_summary && candidate.issue_summary.length > 0;
  const totalAmount = Number(candidate.total || 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <DetailDrawer
      title={
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", paddingRight: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 16 }}>📄</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text)" }}>Tax Invoice Preview</div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 500 }}>
                {candidate.tenant_name} · {candidate.unit_code}
              </div>
            </div>
          </div>
          <span
            style={{
              fontSize: 11,
              padding: "4px 10px",
              borderRadius: 6,
              fontWeight: 700,
              letterSpacing: "0.02em",
              background: isReady ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
              color: isReady ? "#059669" : "#dc2626",
              border: isReady ? "1px solid rgba(16, 185, 129, 0.25)" : "1px solid rgba(239, 68, 68, 0.25)",
            }}
          >
            {isReady ? "READY TO BILL" : "EXCEPTION REQUIRES ACTION"}
          </span>
        </div>
      }
      onClose={onClose}
      centered
      width={720}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18, padding: "4px 2px" }}>
        
        {/* Exception / Issue Alert Banner if any */}
        {hasIssues && (
          <div
            style={{
              padding: "14px 16px",
              borderRadius: 10,
              background: isMissingWater ? "rgba(245, 158, 11, 0.08)" : "rgba(239, 68, 68, 0.08)",
              border: isMissingWater ? "1px solid rgba(245, 158, 11, 0.3)" : "1px solid rgba(239, 68, 68, 0.25)",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: isMissingWater ? "#b45309" : "#dc2626", fontWeight: 800, fontSize: 13 }}>
                <span>{isMissingWater ? "💧" : "⚠️"}</span>
                <span>{isMissingWater ? "Water Meter Reading Required — Consolidated Billing Hold" : "Billing Exception Detected"}</span>
              </div>
              {isMissingWater && onRecordMeter && (
                <button
                  type="button"
                  onClick={() => onRecordMeter(candidate)}
                  style={{
                    background: "var(--brand-primary, #2563eb)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 6,
                    padding: "4px 12px",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "0 2px 4px rgba(37,99,235,0.2)",
                  }}
                >
                  Record Meter Reading ↗
                </button>
              )}
            </div>

            {isMissingWater && (
              <p style={{ margin: 0, fontSize: 11.5, color: "var(--text)", lineHeight: 1.5, background: "rgba(255,255,255,0.6)", padding: "8px 10px", borderRadius: 6 }}>
                <strong>Consolidated Billing Policy:</strong> Rent and utilities cannot be billed separately for this tenancy.
                Record the water meter reading to automatically calculate consumption and unlock the single consolidated invoice.
              </p>
            )}

            {candidate.issue_summary.map((issue, idx) => {
              const resolution = issueResolution(issue.code);
              return (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "var(--text)" }}>
                  <span>• {issue.message}</span>
                  {resolution && (
                    <Link
                      href={resolution.href}
                      style={{
                        color: "var(--primary)",
                        fontWeight: 700,
                        textDecoration: "underline",
                        fontSize: 11,
                        whiteSpace: "nowrap",
                        marginLeft: 12,
                      }}
                    >
                      {resolution.label} →
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Invoice Document Header Card */}
        <div
          style={{
            background: "var(--surface, #ffffff)",
            color: "var(--text-primary, #0f172a)",
            border: "1px solid var(--border, #e2e8f0)",
            borderRadius: 12,
            padding: "20px 24px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid var(--border, #e2e8f0)", paddingBottom: 16, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: "0.08em", fontWeight: 700, color: "#2563eb", textTransform: "uppercase" }}>
                {orgName} · Generated by CeEst
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, marginTop: 4, letterSpacing: "-0.01em", color: "var(--text-primary, #0f172a)" }}>
                {candidate.property_name}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary, #64748b)", marginTop: 2 }}>
                Unit: <strong style={{ color: "var(--text-primary, #0f172a)" }}>{candidate.unit_code}</strong>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, letterSpacing: "0.06em", color: "var(--text-secondary, #475569)", textTransform: "uppercase", fontWeight: 700 }}>Invoice Ref</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary, #0f172a)", fontFamily: "monospace", marginTop: 2 }}>
                {candidate.invoice_number || `DRAFT-${candidate.unit_code}-${candidate.due_date?.slice(0, 7) || "AUTO"}`}
              </div>
              <div style={{ fontSize: 12, color: "#dc2626", marginTop: 6, fontWeight: 700 }}>
                Payment Due: <strong>{candidate.due_date}</strong>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16, fontSize: 12 }}>
            <div>
              <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-secondary, #475569)", fontWeight: 800, letterSpacing: "0.05em" }}>
                Billed Tenant
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary, #0f172a)", marginTop: 3 }}>
                {candidate.tenant_name}
              </div>
              <div style={{ color: "var(--text-secondary, #475569)", fontSize: 12, marginTop: 3 }}>
                Lease: <span style={{ color: "var(--text-primary, #0f172a)", fontWeight: 700 }}>{candidate.lease_reference}</span>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-secondary, #475569)", fontWeight: 800, letterSpacing: "0.05em" }}>
                Total Amount Due
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "var(--brand-primary, #1d4ed8)", marginTop: 2 }}>
                {money.format(totalAmount)}
              </div>
              <div style={{ color: "var(--text-secondary, #64748b)", fontSize: 11, fontWeight: 600, marginTop: 2 }}>Currency: KES (Kenyan Shilling)</div>
            </div>
          </div>
        </div>

        {/* Itemized Charges Table */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          <div
            style={{
              padding: "12px 18px",
              background: "var(--surface-sunken)",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <strong style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary, #334155)", fontWeight: 800 }}>
              Itemized Billing Breakdown
            </strong>
            <span style={{ fontSize: 12, color: "var(--text-secondary, #475569)", fontWeight: 700 }}>
              {candidate.billing_items.length} line {candidate.billing_items.length === 1 ? "item" : "items"}
            </span>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
            <thead>
              <tr style={{ background: "var(--surface-sunken)", borderBottom: "1px solid var(--border)", color: "var(--text-secondary, #334155)", fontSize: 11, textTransform: "uppercase" }}>
                <th style={{ padding: "10px 16px", fontWeight: 800, width: "38px" }}>#</th>
                <th style={{ padding: "10px 16px", fontWeight: 800 }}>Description</th>
                <th style={{ padding: "10px 16px", fontWeight: 800, width: "130px" }}>Category</th>
                <th style={{ padding: "10px 16px", fontWeight: 800, textAlign: "right", width: "140px" }}>Amount (KES)</th>
              </tr>
            </thead>
            <tbody>
              {candidate.billing_items.map((item, idx) => {
                const amount = Number(item.total ?? item.amount ?? 0);
                const codeUpper = (item.code || "CHARGE").toUpperCase();
                return (
                  <tr
                    key={idx}
                    style={{
                      borderBottom: idx === candidate.billing_items.length - 1 ? "none" : "1px solid var(--border)",
                      background: idx % 2 === 0 ? "transparent" : "rgba(0,0,0,0.015)",
                    }}
                  >
                    <td style={{ padding: "12px 16px", color: "var(--text-secondary, #64748b)", fontSize: 12, fontWeight: 600 }}>{idx + 1}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontWeight: 800, color: "var(--text-primary, #0f172a)" }}>
                        {item.description || item.code}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary, #475569)", marginTop: 2 }}>
                        Tenancy lease schedule charge
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "3px 8px",
                          borderRadius: 6,
                          background: codeUpper.includes("RENT")
                            ? "rgba(59, 130, 246, 0.1)"
                            : codeUpper.includes("WATER")
                            ? "rgba(6, 182, 212, 0.1)"
                            : "rgba(107, 114, 128, 0.1)",
                          color: codeUpper.includes("RENT")
                            ? "#2563eb"
                            : codeUpper.includes("WATER")
                            ? "#0891b2"
                            : "#4b5563",
                          border: "1px solid currentColor",
                        }}
                      >
                        {codeUpper}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 800, color: "var(--text)" }}>
                      {money.format(amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: "var(--surface-sunken)", borderTop: "2px solid var(--border)" }}>
                <td colSpan={3} style={{ padding: "14px 16px", fontWeight: 800, textAlign: "right", fontSize: 13, color: "var(--text)" }}>
                  Grand Total Payable:
                </td>
                <td style={{ padding: "14px 16px", fontWeight: 900, textAlign: "right", fontSize: 16, color: "var(--primary)" }}>
                  {money.format(totalAmount)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Meter Readings Reconciliation if any */}
        {candidate.meter_readings && candidate.meter_readings.length > 0 && (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "10px 18px", background: "var(--surface-sunken)", borderBottom: "1px solid var(--border)" }}>
              <strong style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-secondary)" }}>
                Utility Meter Consumption Readings
              </strong>
            </div>
            <div style={{ padding: "12px 16px", display: "grid", gap: 10 }}>
              {candidate.meter_readings.map((m, i) => (
                <div
                  key={i}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    background: "var(--surface-sunken)",
                    border: "1px solid var(--border)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: 12,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, color: "var(--text)" }}>{m.meter_type} Meter</div>
                    <div style={{ color: "var(--faint)", fontSize: 11, marginTop: 2 }}>
                      Previous: <strong style={{ color: "var(--text)" }}>{m.previous}</strong> → Current: <strong style={{ color: "var(--text)" }}>{m.current}</strong>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: 13, fontWeight: 900, color: "#0891b2", background: "rgba(6, 182, 212, 0.1)", padding: "4px 10px", borderRadius: 6 }}>
                      {m.units} units consumed
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: "1px solid var(--border)", marginTop: 4 }}>
          <button
            type="button"
            className="btn ghost sm"
            onClick={handlePrint}
            style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700 }}
          >
            <span>🖨️</span>
            <span>Print Draft Slip</span>
          </button>
          
          <button
            type="button"
            className="btn primary"
            onClick={onClose}
            style={{ minWidth: 110, fontWeight: 700 }}
          >
            Close Preview
          </button>
        </div>

      </div>
    </DetailDrawer>
  );
}
