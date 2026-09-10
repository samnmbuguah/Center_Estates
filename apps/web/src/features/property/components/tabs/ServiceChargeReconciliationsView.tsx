"use client";

import { useMemo } from "react";
import { Badge, KpiCard, KpiStrip, Panel, StatusPill, money } from "@/components/module-ui";
import { ListState, ViewToolbar } from "../PropertyToolbar";
import type { Row, ServiceChargeReconciliationRow } from "../../types/property.types";
import { kM, kN, fmtDate, shortId } from "../../utils/property.utils";
import { FileCheck, DollarSign, TrendingDown, TrendingUp } from "lucide-react";

export function ServiceChargeReconciliationsView({
  rows = [],
  loading = false,
  search = "",
  setSearch,
  onReview,
  onApprove,
  onDownloadPdf,
}: {
  rows: Row[];
  loading: boolean;
  search: string;
  setSearch: (v: string) => void;
  onReview?: (row: ServiceChargeReconciliationRow) => void;
  onApprove?: (row: ServiceChargeReconciliationRow) => void;
  onDownloadPdf?: (row: ServiceChargeReconciliationRow) => void;
}) {
  const reconciliations = rows as ServiceChargeReconciliationRow[];

  const filtered = useMemo(() => {
    return reconciliations.filter((r) => {
      if (!search) return true;
      const term = search.toLowerCase();
      return (
        String(r.service_charge_name ?? "").toLowerCase().includes(term) ||
        String(r.status ?? "").toLowerCase().includes(term) ||
        String(r.id ?? "").toLowerCase().includes(term)
      );
    });
  }, [reconciliations, search]);

  const totalBudgeted = filtered.reduce((sum, r) => sum + Number(r.budgeted_amount ?? 0), 0);
  const totalActual = filtered.reduce((sum, r) => sum + Number(r.actual_amount ?? 0), 0);
  const totalVariance = filtered.reduce((sum, r) => sum + Number(r.variance ?? 0), 0);
  const approvedCount = filtered.filter((r) => r.status === "approved").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <ViewToolbar
        title="Service Charge Reconciliations"
        subtitle="Audit prorated scheme budgets against actual incurred operating expenses"
        search={search}
        onSearch={setSearch}
        placeholder="Search by scheme name, period, or status…"
      />

      {/* Financial Audit Summary KPI Cards */}
      <KpiStrip cols={4}>
        <KpiCard
          icon={<FileCheck size={16} />}
          label="Reconciliation Statements"
          value={`${kN(filtered.length)} Periods`}
          sub={`${approvedCount} formally approved`}
          iconBg="rgba(37, 99, 235, 0.12)"
          iconColor="var(--color-info)"
          borderColor="var(--color-info)"
        />
        <KpiCard
          icon={<DollarSign size={16} />}
          label="Prorated Budgeted OPEX"
          value={money.format(totalBudgeted)}
          sub="Target operational allowance"
          iconBg="rgba(217, 119, 6, 0.12)"
          iconColor="var(--color-warning)"
          borderColor="var(--color-warning)"
        />
        <KpiCard
          icon={<DollarSign size={16} />}
          label="Actual Incurred Expenses"
          value={money.format(totalActual)}
          sub="Approved & paid OPEX bills"
          iconBg="rgba(14, 165, 233, 0.12)"
          iconColor="#0ea5e9"
          borderColor="#0ea5e9"
        />
        <KpiCard
          icon={totalVariance >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          label="Net Variance"
          value={`${money.format(Math.abs(totalVariance))} ${totalVariance >= 0 ? "Surplus" : "Deficit"}`}
          sub={totalVariance >= 0 ? "✓ Under Budget (Tenant credit)" : "⚠ Over Budget (Balancing charge)"}
          iconBg={totalVariance >= 0 ? "rgba(16, 185, 129, 0.12)" : "rgba(220, 38, 38, 0.12)"}
          iconColor={totalVariance >= 0 ? "var(--color-emerald)" : "var(--color-danger)"}
          borderColor={totalVariance >= 0 ? "var(--color-emerald)" : "var(--color-danger)"}
        />
      </KpiStrip>

      <Panel title="Period Reconciliations Register">
        <ListState
          loading={loading}
          empty={filtered.length === 0}
          emptyTitle="No reconciliations found"
          emptyDesc="Period reconciliations comparing budgeted to actual expenditure appear here. Click Reconcile on any Scheme to create one."
        >
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th>Reconciliation Ref</th>
                  <th>Cost Centre Scheme</th>
                  <th>Audit Period</th>
                  <th>Budgeted OPEX</th>
                  <th>Actual Incurred</th>
                  <th>Net Variance</th>
                  <th>Prepared / Reviewed By</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const varianceNum = Number(r.variance ?? 0);
                  const isSurplus = varianceNum >= 0;
                  const statusStr = String(r.status ?? "draft").toLowerCase();

                  return (
                    <tr key={String(r.id)}>
                      <td className="mono" style={{ color: "var(--primary)", fontSize: 12, fontWeight: 700 }}>
                        {shortId(r.id)}
                      </td>
                      <td>
                        <strong style={{ fontSize: 13, color: "var(--text)" }}>{String(r.service_charge_name ?? "—")}</strong>
                        {r.property_name && <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600 }}>{String(r.property_name)}</div>}
                      </td>
                      <td style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>
                        {fmtDate(r.period_start)} — {fmtDate(r.period_end)}
                      </td>
                      <td className="mono" style={{ fontWeight: 700, color: "var(--text)" }}>
                        {money.format(Number(r.budgeted_amount ?? 0))}
                      </td>
                      <td className="mono" style={{ fontWeight: 700, color: "var(--primary)" }}>
                        {money.format(Number(r.actual_amount ?? 0))}
                      </td>
                      <td
                        className="mono"
                        style={{ fontWeight: 800, color: isSurplus ? "var(--color-emerald-strong)" : "var(--color-danger)" }}
                      >
                        {money.format(Math.abs(varianceNum))}
                        <span style={{ fontSize: 10, marginLeft: 4, fontWeight: 700 }}>
                          {isSurplus ? "(Surplus)" : "(Deficit)"}
                        </span>
                      </td>
                      <td style={{ fontSize: 12 }}>
                        <div style={{ fontWeight: 700, color: "var(--text)" }}>
                          Prep: {String(r.prepared_by_name ?? "System")}
                        </div>
                        {Boolean(r.reviewed_by_name) && (
                          <div style={{ fontSize: 11, color: "var(--color-emerald-strong)", fontWeight: 700 }}>
                            Rev: {String(r.reviewed_by_name)}
                          </div>
                        )}
                      </td>
                      <td>
                        <StatusPill value={statusStr} />
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div className="row" style={{ gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                          {statusStr === "draft" && onReview && (
                            <button
                              className="btn ghost sm"
                              style={{ fontSize: 11, padding: "4px 8px" }}
                              onClick={() => onReview(r)}
                            >
                              Review & Audit
                            </button>
                          )}
                          {statusStr === "in_review" && onApprove && (
                            <button
                              className="btn primary sm"
                              style={{ fontSize: 11, padding: "4px 8px" }}
                              onClick={() => onApprove(r)}
                            >
                              ✓ Approve
                            </button>
                          )}
                          {statusStr === "approved" && onDownloadPdf && (
                            <button
                              className="btn ghost sm"
                              style={{ fontSize: 11, padding: "4px 8px" }}
                              onClick={() => onDownloadPdf(r)}
                            >
                              📄 Download Cert
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ListState>
      </Panel>
    </div>
  );
}
