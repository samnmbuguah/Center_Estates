"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Field, Modal } from "@/components/module-ui";
import { apiFetch, csrfFromCookie } from "@/lib/api";
import { Row } from "../../types/facility.types";
import { FcStatus } from "../FacilityToolbar";

function PanelHeader({ title }: { title: string }) {
  return (
    <header className="panel-title">
      <h2 style={{ fontSize: 14, margin: 0 }}>{title}</h2>
    </header>
  );
}

export function UtilityBarChart({
  title,
  months,
  values,
  color,
  format,
}: {
  title: string;
  months: string[];
  values: number[];
  color: string;
  format: (v: number) => string;
}) {
  const max = Math.max(...values, 1);
  return (
    <article className="data-panel">
      <PanelHeader title={title} />
      <div style={{ padding: "14px 18px" }}>
        <div style={{ alignItems: "flex-end", display: "flex", gap: 10, height: 140 }}>
          {months.map((m, i) => (
            <div key={m} style={{ alignItems: "flex-end", display: "flex", flexDirection: "column", flex: 1, gap: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#4b5563" }}>{format(values[i])}</span>
              <div style={{ background: color, borderRadius: "4px 4px 0 0", height: `${(values[i] / max) * 100}%`, minHeight: 4, width: "100%", transition: "height 0.3s" }} />
              <span style={{ color: "var(--text-secondary)", fontSize: 9 }}>{m}</span>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

export function UtilitiesView({ rows, kpis, organizationId, canWork, canApprove, canAdminister, reload }: {
  rows: Row[]; kpis: Record<string, string | number>; organizationId: string | null; canWork: boolean; canApprove: boolean; canAdminister: boolean; reload: () => Promise<void>;
}) {
  const [subTab, setSubTab] = useState("overview");
  const [readingMeter, setReadingMeter] = useState<Row | null>(null);
  const [reviewTarget, setReviewTarget] = useState<{ reading: Row; decision: "approve" | "reject" } | null>(null);
  const [rateMeter, setRateMeter] = useState<Row | null>(null);
  const [showAllMeters, setShowAllMeters] = useState(false);
  const [utilityError, setUtilityError] = useState("");
  const [utilityNotice, setUtilityNotice] = useState("");
  const [reconciliations, setReconciliations] = useState<Row[]>([]);
  const [reconLoading, setReconLoading] = useState(false);
  const [reconForm, setReconForm] = useState({ bulk_meter: "", period_start: "", period_end: "", bulk_consumption: "", check_consumption: "", tolerance_percent: "5" });
  const [approveTarget, setApproveTarget] = useState<Row | null>(null);

  const bulkMeters = rows.filter((row) => String(row.meter_role ?? "standard") === "bulk");
  const checkMeters = rows.filter((row) => String(row.meter_role ?? "") === "check");

  const loadReconciliations = useCallback(async () => {
    if (!organizationId) return;
    setReconLoading(true);
    const response = await apiFetch("/facility/meter-reconciliations/", {}, organizationId);
    if (response.ok) setReconciliations(await response.json() as Row[]);
    setReconLoading(false);
  }, [organizationId]);

  useEffect(() => {
    if (subTab === "reconciliation") void loadReconciliations();
  }, [loadReconciliations, subTab]);
  const sparkData = [30, 45, 38, 55, 48, 62, 50, 70, 58, 75, 65, 80];
  const maxSpark = Math.max(...sparkData);
  const utilityConsumption = Number(kpis?.utilityConsumption ?? 0);
  const utilityCostValue = Number(kpis?.utilityCost ?? 0);
  const energyKwh = utilityConsumption.toLocaleString();
  const utilityCost = utilityCostValue.toLocaleString();
  const consumptionByType = (type: string) => rows
    .filter((row) => String(row.utility_type ?? "") === type)
    .reduce((sum, row) => sum + Number(row.consumption ?? 0), 0);
  const costByType = (type: string) => rows
    .filter((row) => String(row.utility_type ?? "") === type)
    .reduce((sum, row) => sum + Number(row.cost ?? 0), 0);

  const trendMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const consumptionByMonth = rows.length > 0
    ? (() => {
        const buckets: Record<string, number> = {};
        rows.forEach((r) => {
          const date = new Date(String(r.read_at ?? ""));
          const m = Number.isNaN(date.getTime()) ? "" : trendMonths[date.getMonth()];
          if (!m) return;
          buckets[m] = (buckets[m] ?? 0) + Number(r.consumption ?? 0);
        });
        return trendMonths.map((m) => buckets[m] ?? 0);
      })()
    : trendMonths.map(() => 0);
  const costByMonth = rows.length > 0
    ? (() => {
        const buckets: Record<string, number> = {};
        rows.forEach((r) => {
          const date = new Date(String(r.read_at ?? ""));
          const m = Number.isNaN(date.getTime()) ? "" : trendMonths[date.getMonth()];
          if (!m) return;
          buckets[m] = (buckets[m] ?? 0) + Number(r.cost ?? 0);
        });
        return trendMonths.map((m) => buckets[m] ?? 0);
      })()
    : trendMonths.map(() => 0);
  const totalConsumption = consumptionByMonth.reduce((s, v) => s + v, 0);
  const totalCost = costByMonth.reduce((s, v) => s + v, 0);
  const utilityAlerts = rows.filter((row) => Boolean(row.reading_is_anomaly) || ["pending", "rejected"].includes(String(row.reading_status ?? "")));

  async function submitReading(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!readingMeter || !organizationId) return;
    const form = new FormData(event.currentTarget);
    await apiFetch("/auth/csrf/");
    const response = await apiFetch("/facility/meter-readings/", {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify({ meter: readingMeter.id, read_at: form.get("read_at"), value: form.get("value"), notes: form.get("notes") }),
    }, organizationId);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setUtilityError(Object.values(body as Record<string, unknown>).flat().join(" ") || "The meter reading could not be saved.");
      return;
    }
    setUtilityError("");
    setReadingMeter(null);
    await reload();
  }

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reviewTarget || !organizationId) return;
    const notes = String(new FormData(event.currentTarget).get("notes") ?? "").trim();
    await apiFetch("/auth/csrf/");
    const response = await apiFetch(`/facility/meter-readings/${reviewTarget.reading.id}/${reviewTarget.decision}/`, {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify({ notes }),
    }, organizationId);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setUtilityError(Object.values(body as Record<string, unknown>).flat().join(" ") || "The review decision could not be saved.");
      return;
    }
    setUtilityError("");
    setReviewTarget(null);
    await reload();
  }

  async function submitRate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rateMeter || !organizationId) return;
    const tariff = String(new FormData(event.currentTarget).get("tariff") ?? "");
    await apiFetch("/auth/csrf/");
    const response = await apiFetch(`/facility/meters/${rateMeter.id}/`, {
      method: "PATCH",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify({ tariff }),
    }, organizationId);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setUtilityError(Object.values(body as Record<string, unknown>).flat().join(" ") || "The utility rate could not be updated.");
      return;
    }
    setUtilityError("");
    setRateMeter(null);
    await reload();
  }

  async function submitReconciliation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organizationId) return;
    setUtilityError(""); setUtilityNotice("");
    await apiFetch("/auth/csrf/");
    const response = await apiFetch("/facility/meter-reconciliations/", {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify({
        bulk_meter: reconForm.bulk_meter,
        period_start: reconForm.period_start,
        period_end: reconForm.period_end,
        bulk_consumption: reconForm.bulk_consumption,
        check_consumption: reconForm.check_consumption,
        tolerance_percent: reconForm.tolerance_percent || "5",
        supporting_documents: [],
      }),
    }, organizationId);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setUtilityError(Object.values(body as Record<string, unknown>).flat().join(" ") || "The bulk/check reconciliation could not be saved.");
      return;
    }
    setUtilityNotice("Bulk/check meter reconciliation recorded.");
    setReconForm({ bulk_meter: "", period_start: "", period_end: "", bulk_consumption: "", check_consumption: "", tolerance_percent: "5" });
    await loadReconciliations();
  }

  async function submitReconApproval(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!approveTarget || !organizationId) return;
    const notes = String(new FormData(event.currentTarget).get("notes") ?? "").trim();
    await apiFetch("/auth/csrf/");
    const response = await apiFetch(`/facility/meter-reconciliations/${approveTarget.id}/approve/`, {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify({ notes }),
    }, organizationId);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setUtilityError(Object.values(body as Record<string, unknown>).flat().join(" ") || "The reconciliation could not be approved.");
      return;
    }
    setUtilityNotice("Meter reconciliation approved.");
    setApproveTarget(null);
    await loadReconciliations();
  }

  return (
    <>
      <div className="fc-kpi-strip six-col">
        {[
          { icon: "⚡", bg: "#e0e7ff", color: "#4f46e5", label: "Total Energy (kWh)", value: energyKwh, trend: "YTD consumption", up: false },
          { icon: "💧", bg: "#dbeafe", color: "#2563eb", label: "Water Consumption (m³)", value: consumptionByType("water").toLocaleString(), trend: "Recorded YTD", up: true },
          { icon: "⛽", bg: "#dcfce7", color: "#16a34a", label: "Generator Fuel (L)", value: consumptionByType("fuel").toLocaleString(), trend: "Recorded YTD", up: true },
          { icon: "🔥", bg: "#fff7ed", color: "#ea580c", label: "Gas Consumption (kg)", value: consumptionByType("gas").toLocaleString(), trend: "Recorded YTD", up: true },
          { icon: "💰", bg: "#fdf4ff", color: "#9333ea", label: "Utility Cost (KES)", value: utilityCost, trend: "YTD spend", up: false },
          { icon: "🌱", bg: "#f0fdf4", color: "#15803d", label: "Meters Reporting", value: String(rows.filter((row) => row.read_at).length), trend: "Current register", up: true },
        ].map((kpi) => (
          <div key={kpi.label} className="fc-kpi-card" style={{ cursor: "default" }}>
            <div className="fc-kpi-top">
              <span className="fc-kpi-icon" style={{ background: kpi.bg, color: kpi.color }}>{kpi.icon}</span>
              <span className="fc-kpi-label">{kpi.label}</span>
            </div>
            <strong className="fc-kpi-value" style={{ fontSize: 20 }}>{kpi.value}</strong>
            <span className={kpi.up ? "fc-kpi-trend-up" : "fc-kpi-trend-down"}>{kpi.trend} vs last period</span>
            <div className="fc-sparkline">
              {sparkData.map((v, i) => (
                <i key={i} style={{ background: kpi.color, height: `${(v / maxSpark) * 100}%`, opacity: 0.6 + (i / sparkData.length) * 0.4 }} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Utility type/workflow is a page control, not a third navigation level. */}
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, width: "fit-content", fontSize: 12, fontWeight: 700 }}>
        Utility view
        <select className="fc-toolbar-select" aria-label="Utility view" value={subTab} onChange={(event) => setSubTab(event.target.value)}>
          <option value="overview">Overview</option>
          <option value="electricity">Electricity</option>
          <option value="water">Water</option>
          <option value="generator">Generator</option>
          <option value="solar">Solar</option>
          <option value="gas">Gas</option>
          <option value="reconciliation">Meter reconciliation</option>
          <option value="waste">Waste</option>
          <option value="reports">Reports</option>
        </select>
      </label>

      {subTab === "reconciliation" ? (
        <div style={{ display: "grid", gap: 16 }}>
          {(bulkMeters.length === 0 || checkMeters.length === 0) && (
            <div className="form-error" style={{ background: "#fff7ed", color: "#9a3412", border: "1px solid #fdba74" }}>
              Register at least one bulk meter and one linked check meter before recording a variance reconciliation.
            </div>
          )}
          {canWork && (
            <article className="data-panel">
              <PanelHeader title="Record bulk / check reconciliation" />
              <form onSubmit={submitReconciliation} style={{ display: "grid", gap: 12, padding: 16 }}>
                <div className="grid-2">
                  <Field label="Bulk meter" required>
                    <select required value={reconForm.bulk_meter} onChange={(event) => setReconForm((current) => ({ ...current, bulk_meter: event.target.value }))}>
                      <option value="">Select bulk meter</option>
                      {bulkMeters.map((meter) => <option key={String(meter.id)} value={String(meter.id)}>{String(meter.name ?? meter.code)}</option>)}
                    </select>
                  </Field>
                  <Field label="Tolerance %" required>
                    <input type="number" min="0" step="0.001" value={reconForm.tolerance_percent} onChange={(event) => setReconForm((current) => ({ ...current, tolerance_percent: event.target.value }))} required />
                  </Field>
                  <Field label="Period start" required>
                    <input type="date" value={reconForm.period_start} onChange={(event) => setReconForm((current) => ({ ...current, period_start: event.target.value }))} required />
                  </Field>
                  <Field label="Period end" required>
                    <input type="date" value={reconForm.period_end} onChange={(event) => setReconForm((current) => ({ ...current, period_end: event.target.value }))} required />
                  </Field>
                  <Field label="Bulk consumption" required>
                    <input type="number" min="0" step="0.001" value={reconForm.bulk_consumption} onChange={(event) => setReconForm((current) => ({ ...current, bulk_consumption: event.target.value }))} required />
                  </Field>
                  <Field label="Sum of check meters" required>
                    <input type="number" min="0" step="0.001" value={reconForm.check_consumption} onChange={(event) => setReconForm((current) => ({ ...current, check_consumption: event.target.value }))} required />
                  </Field>
                </div>
                <p className="form-hint">Out-of-tolerance variances require an approver rationale before the period can be closed for billing.</p>
                <div className="row" style={{ justifyContent: "flex-end" }}><button className="btn primary" type="submit">Save reconciliation</button></div>
              </form>
            </article>
          )}
          <article className="data-panel">
            <PanelHeader title="Reconciliation register" />
            <div className="table-scroll">
              <table className="fc-data-table">
                <thead>
                  <tr>
                    <th>Meter / property</th>
                    <th>Period</th>
                    <th>Bulk</th>
                    <th>Checks</th>
                    <th>Variance</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reconLoading ? (
                    <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--text-secondary)" }}>Loading reconciliations…</td></tr>
                  ) : reconciliations.length === 0 ? (
                    <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--text-secondary)" }}>No bulk/check reconciliations recorded yet.</td></tr>
                  ) : reconciliations.map((row) => (
                    <tr key={String(row.id)}>
                      <td style={{ fontSize: 12 }}>{String(row.meter_name ?? "—")}<br /><span style={{ color: "var(--text-secondary)", fontSize: 10 }}>{String(row.property_name ?? "")}</span></td>
                      <td style={{ fontSize: 12 }}>{String(row.period_start ?? "—")} → {String(row.period_end ?? "—")}</td>
                      <td style={{ fontSize: 12, fontWeight: 700 }}>{String(row.bulk_consumption ?? "—")}</td>
                      <td style={{ fontSize: 12 }}>{String(row.check_consumption ?? "—")}</td>
                      <td style={{ fontSize: 12 }}>{String(row.variance ?? "—")} ({String(row.variance_percent ?? "0")}%)</td>
                      <td><FcStatus value={String(row.status ?? "pending")} /></td>
                      <td>
                        {canApprove && row.status !== "approved" && (
                          <button type="button" className="btn primary sm" onClick={() => setApproveTarget(row)}>Approve</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </div>
      ) : (() => {
        const filteredRows = subTab === "overview" ? rows
          : subTab === "electricity" ? rows.filter((r) => String(r.utility_type ?? "") === "electricity")
          : subTab === "water" ? rows.filter((r) => String(r.utility_type ?? "") === "water")
          : subTab === "gas" ? rows.filter((r) => String(r.utility_type ?? "") === "gas")
          : subTab === "generator" ? rows.filter((r) => String(r.utility_type ?? "") === "fuel" || String(r.utility_type ?? "") === "generator")
          : rows;
        return (

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(0,1.5fr) 280px" }}>
        <div style={{ display: "grid", gap: 16 }}>
          {/* Meter readings table */}
          <article className="data-panel">
            <PanelHeader title="Latest Meter Readings" />
            <div className="table-scroll">
              <table className="fc-data-table">
                <thead>
                  <tr>
                    <th>Utility Type</th>
                    <th>Meter / Location</th>
                    <th>Current Reading</th>
                    <th>Previous Reading</th>
                    <th>Consumption</th>
                    <th>Rate</th>
                    <th>Date & Time</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length > 0
                    ? (showAllMeters ? filteredRows : filteredRows.slice(0, 5)).map((row) => (
                        <tr key={String(row.id)}>
                          <td>
                            <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
                              <span>{row.utility_type === "electricity" ? "⚡" : row.utility_type === "water" ? "💧" : row.utility_type === "gas" ? "🔥" : "⛽"}</span>
                              <span style={{ fontSize: 12, textTransform: "capitalize" }}>{String(row.utility_type ?? "—")} ({String(row.unit ?? "")})</span>
                            </div>
                          </td>
                          <td style={{ fontSize: 12 }}>{String(row.name ?? "—")}<br /><span style={{ color: "var(--text-secondary)", fontSize: 10 }}>{String(row.property_name ?? "")}{row.unit_code ? ` · Unit ${String(row.unit_code)}` : ""}</span></td>
                          <td style={{ fontSize: 12, fontWeight: 700 }}>{String(row.current_reading ?? "—")}</td>
                          <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{String(row.previous_reading ?? "—")}</td>
                          <td style={{ fontSize: 12, fontWeight: 700 }}>{String(row.consumption ?? "—")} {String(row.unit ?? "")}</td>
                          <td style={{ fontSize: 12 }}>KES {Number(row.tariff ?? 0).toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                          <td style={{ fontSize: 11, color: "var(--text-secondary)" }}>{String(row.read_at ?? "—")}</td>
                          <td><FcStatus value={String(row.reading_status ?? "not_read")} /></td>
                          <td>
                            <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                              {canWork && <button className="btn ghost sm" onClick={() => setReadingMeter(row)}>Record Reading</button>}
                              {canAdminister && <button className="btn ghost sm" onClick={() => setRateMeter(row)}>Edit Rate</button>}
                              {canApprove && row.reading_status === "pending" && (() => {
                                const reading = (row.latest_reading ?? {}) as Row;
                                return <>
                                  <button className="btn primary sm" onClick={() => setReviewTarget({ reading, decision: "approve" })}>Approve</button>
                                  <button className="btn danger sm" onClick={() => setReviewTarget({ reading, decision: "reject" })}>Reject</button>
                                </>;
                              })()}
                            </div>
                          </td>
                        </tr>
                      ))
                    : <tr><td colSpan={9} style={{ color: "var(--text-secondary)", padding: 24, textAlign: "center" }}>No utility meters or readings have been recorded yet.</td></tr>}
                </tbody>
              </table>
            </div>
            <div style={{ padding: "12px 18px" }}>
              {filteredRows.length > 5 && <button type="button" onClick={() => setShowAllMeters((value) => !value)} style={{ background: "none", border: 0, color: "#e23b3b", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>{showAllMeters ? "Show Recent Meters ↑" : `View All ${filteredRows.length} Meters →`}</button>}
            </div>
          </article>

          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr" }}>
            <UtilityBarChart
              title="Utility Consumption Trend"
              months={trendMonths}
              values={consumptionByMonth}
              color="#4f46e5"
              format={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
            />
            <UtilityBarChart
              title="Utility Cost Trend (KES)"
              months={trendMonths}
              values={costByMonth}
              color="#22c55e"
              format={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
            />
          </div>

          <article className="data-panel">
            <PanelHeader title="Monthly Summary" />
            <div style={{ padding: "14px 18px", display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
              <div>
                <span style={{ color: "var(--text-secondary)", display: "block", fontSize: 11 }}>Total Consumption (YTD)</span>
                <strong style={{ fontSize: 18 }}>{totalConsumption >= 1000 ? `${(totalConsumption / 1000).toFixed(1)}k` : totalConsumption}</strong>
              </div>
              <div>
                <span style={{ color: "var(--text-secondary)", display: "block", fontSize: 11 }}>Total Cost (YTD)</span>
                <strong style={{ fontSize: 18 }}>KES {totalCost >= 1000000 ? `${(totalCost / 1000000).toFixed(2)}M` : `${(totalCost / 1000).toFixed(0)}k`}</strong>
              </div>
              <div>
                <span style={{ color: "var(--text-secondary)", display: "block", fontSize: 11 }}>Avg. Monthly Consumption</span>
                <strong style={{ fontSize: 14 }}>{totalConsumption >= 1000 ? `${(totalConsumption / 12000).toFixed(1)}k` : Math.round(totalConsumption / 12)}</strong>
              </div>
              <div>
                <span style={{ color: "var(--text-secondary)", display: "block", fontSize: 11 }}>Avg. Monthly Cost</span>
                <strong style={{ fontSize: 14 }}>KES {totalCost >= 1000000 ? `${(totalCost / 12000000).toFixed(2)}M` : `${(totalCost / 12000).toFixed(0)}k`}</strong>
              </div>
            </div>
          </article>
        </div>

        {/* Right rail */}
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <article className="data-panel">
            <PanelHeader title="Active Alerts" />
            <div className="fc-alert-list">
              {utilityAlerts.length > 0 ? utilityAlerts.map((row) => (
                <div key={String(row.id)} className="fc-alert-item">
                  <span className={`fc-alert-icon ${row.reading_status === "rejected" || row.reading_is_anomaly ? "danger" : "warning"}`}>{row.reading_is_anomaly ? "⚠" : "◷"}</span>
                  <div className="fc-alert-body">
                    <strong>{row.reading_is_anomaly ? "Consumption anomaly" : `Reading ${String(row.reading_status ?? "pending")}`}</strong>
                    <small>{String(row.name ?? row.code ?? "Utility meter")}</small>
                    <small>{String(row.property_name ?? "")}{row.unit_code ? ` · Unit ${String(row.unit_code)}` : ""}</small>
                  </div>
                  <span style={{ color: "var(--text-muted)", fontSize: 10 }}>{String(row.read_at ?? "")}</span>
                </div>
              )) : <div style={{ color: "var(--text-secondary)", fontSize: 12, padding: 18 }}>No utility anomalies or readings awaiting review.</div>}
            </div>
          </article>

          <article className="data-panel">
            <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--line)" }}>
              <strong style={{ fontSize: 13 }}>Utility Cost Summary</strong>
              <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>This Month</div>
            </div>
            <div style={{ padding: "16px 18px" }}>
              <div style={{ marginBottom: 14 }}>
                <span style={{ color: "var(--text-secondary)", display: "block", fontSize: 11 }}>Total Cost</span>
                <strong style={{ fontSize: 22 }}>KES {utilityCost}</strong>
                <span style={{ color: "#ef4444", fontSize: 11 }}> YTD</span>
              </div>
              {[
                { icon: "⚡", label: "Electricity", value: `KES ${costByType("electricity").toLocaleString()}` },
                { icon: "💧", label: "Water", value: `KES ${costByType("water").toLocaleString()}` },
                { icon: "⛽", label: "Generator Fuel", value: `KES ${costByType("fuel").toLocaleString()}` },
                { icon: "🔥", label: "Gas", value: `KES ${costByType("gas").toLocaleString()}` },
              ].map((item) => (
                <div key={item.label} style={{ alignItems: "center", borderBottom: "1px solid #f0f2f6", display: "flex", gap: 10, padding: "9px 0" }}>
                  <span>{item.icon}</span>
                  <span style={{ color: "#4b5563", flex: 1, fontSize: 12 }}>{item.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>{item.value}</span>
                </div>
              ))}
            </div>
          </article>
        </div>
      </div>
      ); })()}
      {utilityError && <div className="form-error">{utilityError}</div>}
      {utilityNotice && <div className="form-hint" style={{ color: "#166534", background: "#f0fdf4", border: "1px solid #86efac", padding: 10, borderRadius: 8 }}>{utilityNotice}</div>}
      {approveTarget && (
        <Modal title="Approve meter reconciliation" onClose={() => setApproveTarget(null)}>
          <form onSubmit={submitReconApproval} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p className="form-hint">
              {String(approveTarget.meter_name ?? "Bulk meter")} · variance {String(approveTarget.variance ?? "0")}
              ({String(approveTarget.variance_percent ?? "0")}%).
              {approveTarget.status === "exception" ? " Review notes are required for out-of-tolerance exceptions." : ""}
            </p>
            <Field label={approveTarget.status === "exception" ? "Approval rationale" : "Review notes"} required={approveTarget.status === "exception"}>
              <textarea name="notes" rows={3} required={approveTarget.status === "exception"} />
            </Field>
            <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
              <button type="button" className="btn ghost" onClick={() => setApproveTarget(null)}>Cancel</button>
              <button className="btn primary" type="submit">Approve reconciliation</button>
            </div>
          </form>
        </Modal>
      )}
      {readingMeter && (
        <Modal title={`Record Reading · ${String(readingMeter.name ?? readingMeter.code ?? "Meter")}`} onClose={() => setReadingMeter(null)}>
          <form onSubmit={submitReading} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="grid-2">
              <Field label="Previous reading"><input value={String(readingMeter.current_reading ?? 0)} readOnly /></Field>
              <Field label={`Current reading (${String(readingMeter.unit ?? "units")})`} required><input name="value" type="number" min={Number(readingMeter.current_reading ?? 0)} step="0.001" required /></Field>
            </div>
            <Field label="Reading date and time" required><input name="read_at" type="datetime-local" required /></Field>
            <Field label="Caretaker notes"><textarea name="notes" rows={3} /></Field>
            <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}><button type="button" className="btn ghost" onClick={() => setReadingMeter(null)}>Cancel</button><button className="btn primary">Submit for Review</button></div>
          </form>
        </Modal>
      )}
      {reviewTarget && (
        <Modal title={`${reviewTarget.decision === "approve" ? "Approve" : "Reject"} Meter Reading`} onClose={() => setReviewTarget(null)}>
          <form onSubmit={submitReview} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Previous reading"><input value={String(reviewTarget.reading.previous_value ?? "—")} readOnly /></Field>
            <Field label="Current reading"><input value={String(reviewTarget.reading.value ?? "—")} readOnly /></Field>
            <Field label={reviewTarget.decision === "reject" ? "Rejection reason" : "Review notes"} required={reviewTarget.decision === "reject"}><textarea name="notes" rows={3} required={reviewTarget.decision === "reject"} /></Field>
            <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}><button type="button" className="btn ghost" onClick={() => setReviewTarget(null)}>Cancel</button><button className={`btn ${reviewTarget.decision === "approve" ? "primary" : "danger"}`}>{reviewTarget.decision === "approve" ? "Approve Reading" : "Reject Reading"}</button></div>
          </form>
        </Modal>
      )}
      {rateMeter && (
        <Modal title={`Edit Utility Rate · ${String(rateMeter.name ?? rateMeter.code ?? "Meter")}`} onClose={() => setRateMeter(null)}>
          <form onSubmit={submitRate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="grid-2">
              <Field label="Utility"><input value={String(rateMeter.utility_type ?? "—")} readOnly /></Field>
              <Field label="Measurement unit"><input value={String(rateMeter.unit ?? "—")} readOnly /></Field>
            </div>
            <Field label="Rate per unit (KES)" required><input name="tariff" type="number" min="0" step="0.0001" defaultValue={String(rateMeter.tariff ?? 0)} required /></Field>
            <p className="form-hint">The new rate applies to readings recorded after this update. Existing reading costs remain unchanged.</p>
            <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}><button type="button" className="btn ghost" onClick={() => setRateMeter(null)}>Cancel</button><button className="btn primary">Save Rate</button></div>
          </form>
        </Modal>
      )}
    </>
  );
}
