import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ClipboardList,
  CloudSun,
  PackageCheck,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react";

import {
  createDailyLog,
  deleteDailyLog,
  fetchDailyLogs,
  fetchIncidents,
  fetchMaterials,
  type DailyLog,
  type MaterialDelivery,
  type SafetyIncident,
} from "../api";
import { PageEmpty, PageError, PageLoading, StatusPill } from "../components/PageState";
import { useWorkspace } from "../context/WorkspaceContext";
import { formatDate } from "../lib/format";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function displayWeather(log: DailyLog): string {
  if (log.weather?.trim()) return log.weather;
  const w = asRecord(log.details?.weather);
  if (!w) return "—";
  const am = String(w.morning ?? "").trim();
  const pm = String(w.afternoon ?? "").trim();
  if (am && pm) return `AM ${am}, PM ${pm}`;
  return am || pm || "—";
}

function displayLabour(log: DailyLog): number {
  if (log.labour_count != null && Number(log.labour_count) > 0) return Number(log.labour_count);
  const labour = asRecord(log.details?.labour);
  if (labour?.count != null && Number.isFinite(Number(labour.count))) return Number(labour.count);
  return Number(log.labour_count) || 0;
}

function labourAdequacy(log: DailyLog): string | null {
  const labour = asRecord(log.details?.labour);
  const a = labour?.adequacy;
  return a != null && String(a).trim() ? String(a) : null;
}

/** Materials lines from structured details — never invent deliveries. */
function materialsFromDetails(details: Record<string, unknown> | undefined | null): string[] {
  if (!details) return [];
  const m = asRecord(details.materials);
  if (!m) return [];
  const lines: string[] = [];

  if (Array.isArray(m.items)) {
    for (const item of m.items) {
      if (typeof item === "string" && item.trim()) lines.push(item.trim());
      else if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        const label = [o.name ?? o.type ?? o.material, o.quantity, o.unit]
          .filter((x) => x != null && String(x).trim() !== "")
          .join(" ");
        if (label) lines.push(label);
      }
    }
  }

  if (lines.length === 0 && (m.delivered === true || m.type || m.quantity != null)) {
    const type = m.type != null ? String(m.type) : "Materials delivered";
    const qty = m.quantity != null ? String(m.quantity) : "";
    const unit = m.unit != null ? String(m.unit) : "";
    const qtyPart = [qty, unit].filter(Boolean).join(" ");
    lines.push(qtyPart ? `${type}: ${qtyPart}` : type);
    if (m.conformance === true) lines.push("Conformance: yes");
    if (m.conformance === false) lines.push("Conformance: no");
    if (m.damaged === true) lines.push("Damaged: reported");
  }

  return lines;
}

function plantFromDetails(details: Record<string, unknown> | undefined | null): string | null {
  if (!details) return null;
  const p = asRecord(details.plant);
  if (!p) return null;
  const bits: string[] = [];
  if (p.type != null && String(p.type).trim()) bits.push(String(p.type));
  if (p.present === true && bits.length === 0) bits.push("Plant present");
  if (p.present === false) bits.push("No plant reported");
  if (p.operational === true) bits.push("operational");
  if (p.operational === false) bits.push("not operational");
  if (p.idle === true) bits.push("idle");
  return bits.length ? bits.join(" · ") : null;
}

function visitorsFromDetails(details: Record<string, unknown> | undefined | null): string[] {
  if (!details) return [];
  const v = details.visitors;
  if (!Array.isArray(v)) return [];
  return v
    .map((row) => {
      if (typeof row === "string") return row;
      if (row && typeof row === "object") {
        const o = row as Record<string, unknown>;
        return [o.name, o.company, o.purpose].filter((x) => x != null && String(x).trim()).join(" — ");
      }
      return "";
    })
    .filter(Boolean);
}

const emptyForm = {
  log_date: todayISO(),
  weather: "",
  labour_count: "",
  notes: "",
};

export function DailyLogs() {
  const { activeProjectId, activeProject, projects } = useWorkspace();

  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [total, setTotal] = useState(0);
  const [materials, setMaterials] = useState<MaterialDelivery[]>([]);
  const [incidents, setIncidents] = useState<SafetyIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formProjectId, setFormProjectId] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Keep create form project in sync with workspace selection
  useEffect(() => {
    setFormProjectId(activeProjectId || projects[0]?.id || "");
  }, [activeProjectId, projects]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const pid = activeProjectId || undefined;
    try {
      const [logRes, mats, incs] = await Promise.all([
        fetchDailyLogs(pid, 100),
        fetchMaterials(pid).catch(() => [] as MaterialDelivery[]),
        fetchIncidents(pid).catch(() => [] as SafetyIncident[]),
      ]);
      setLogs(logRes.results ?? []);
      setTotal(logRes.total ?? logRes.results?.length ?? 0);
      setMaterials(Array.isArray(mats) ? mats : []);
      setIncidents(Array.isArray(incs) ? incs : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load daily logs");
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [activeProjectId]);

  useEffect(() => {
    load();
  }, [load]);

  const [today, setToday] = useState(() => (typeof window === "undefined" ? "" : todayISO()));
  useEffect(() => {
    setToday(todayISO());
  }, []);
  const logsToday = useMemo(
    () => logs.filter((l) => l.log_date === today),
    [logs, today],
  );
  const labourToday = useMemo(() => {
    if (logsToday.length === 0) return null;
    // Sum is misleading if multiple shifts; show latest entry's labour for "today"
    const sorted = [...logsToday].sort((a, b) => String(b.log_date).localeCompare(String(a.log_date)));
    const first = sorted[0];
    return first ? displayLabour(first) : null;
  }, [logsToday]);
  const latestLabour = useMemo(() => {
    const first = logs[0];
    if (!first) return null;
    return displayLabour(first);
  }, [logs]);
  const seriousIncidents = useMemo(
    () => incidents.filter((i) => i.severity === "serious" || i.severity === "lost_time").length,
    [incidents],
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!form.log_date.trim()) {
      setFormError("Log date is required.");
      return;
    }
    const projectId = formProjectId || activeProjectId;
    if (!projectId) {
      setFormError("Select a project before recording a daily log.");
      return;
    }
    const labour = form.labour_count === "" ? 0 : Number(form.labour_count);
    if (form.labour_count !== "" && (!Number.isFinite(labour) || labour < 0)) {
      setFormError("Labour count must be a non-negative number.");
      return;
    }

    setSaving(true);
    try {
      await createDailyLog({
        project_id: projectId,
        log_date: form.log_date,
        weather: form.weather.trim(),
        labour_count: labour,
        notes: form.notes.trim(),
      });
      setForm({ ...emptyForm, log_date: todayISO() });
      setShowForm(false);
      await load();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to create daily log");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Delete this daily log? This cannot be undone.")) return;
    setDeletingId(id);
    setError(null);
    try {
      await deleteDailyLog(id);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete daily log");
    } finally {
      setDeletingId(null);
    }
  }

  const projectLabel = activeProject?.name || (activeProjectId ? activeProjectId : "All projects");

  return (
    <div
      style={{
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        maxWidth: "1600px",
        margin: "0 auto",
        width: "100%",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 700, color: "var(--text)" }}>
            Construction Progress & Daily Site Logs
          </h1>
          <div style={{ fontSize: "13px", color: "var(--muted)", marginTop: "4px" }}>
            Live site diary for {projectLabel} — figures from the API only
          </div>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setFormError(null);
            setShowForm((s) => !s);
          }}
        >
          {showForm ? (
            <>
              <X size={15} style={{ marginRight: 4 }} /> Cancel
            </>
          ) : (
            <>
              <Plus size={15} style={{ marginRight: 4 }} /> Record Daily Log
            </>
          )}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="card"
          style={{
            padding: "20px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>New daily log</h3>
          {formError && (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.3)",
                color: "var(--color-danger)",
                fontSize: 13,
              }}
            >
              {formError}
            </div>
          )}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
            }}
          >
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--muted)" }}>
              Project
              <select
                value={formProjectId}
                onChange={(e) => setFormProjectId(e.target.value)}
                disabled={saving}
                required
                style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)" }}
              >
                {!formProjectId && <option value="">Select project…</option>}
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--muted)" }}>
              Log date
              <input
                type="date"
                value={form.log_date}
                onChange={(e) => setForm((f) => ({ ...f, log_date: e.target.value }))}
                disabled={saving}
                required
                style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)" }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--muted)" }}>
              Weather
              <input
                type="text"
                placeholder="e.g. Sunny, light rain PM"
                value={form.weather}
                onChange={(e) => setForm((f) => ({ ...f, weather: e.target.value }))}
                disabled={saving}
                style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)" }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--muted)" }}>
              Labour count
              <input
                type="number"
                min={0}
                step={1}
                placeholder="0"
                value={form.labour_count}
                onChange={(e) => setForm((f) => ({ ...f, labour_count: e.target.value }))}
                disabled={saving}
                style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)" }}
              />
            </label>
          </div>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--muted)" }}>
            Notes / activities
            <textarea
              rows={3}
              placeholder="Daily activities summary…"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              disabled={saving}
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--surface-2)",
                color: "var(--text)",
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />
          </label>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button type="button" className="btn ghost" disabled={saving} onClick={() => setShowForm(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Save daily log"}
            </button>
          </div>
        </form>
      )}

      {loading && <PageLoading rows={3} />}

      {!loading && error && <PageError message={error} onRetry={load} />}

      {!loading && !error && (
        <>
          {/* KPI strip — real counts only */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "14px",
            }}
          >
            <div className="card" style={{ padding: "16px", background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted)", fontSize: "12px" }}>
                <span>Daily logs today</span>
                <ClipboardList size={16} />
              </div>
              <div style={{ fontSize: "24px", fontWeight: 700, margin: "6px 0 2px", color: "var(--text)" }}>
                {logsToday.length}
              </div>
              <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                {total} total recorded{activeProjectId ? " for project" : ""}
              </div>
            </div>

            <div className="card" style={{ padding: "16px", background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted)", fontSize: "12px" }}>
                <span>Workforce on site</span>
                <Users size={16} />
              </div>
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: 700,
                  margin: "6px 0 2px",
                  color: labourToday != null || latestLabour != null ? "var(--color-brand-blue)" : "var(--muted)",
                  fontFamily: "IBM Plex Mono, ui-monospace, monospace",
                }}
              >
                {labourToday != null
                  ? `${labourToday}`
                  : latestLabour != null
                    ? `${latestLabour}`
                    : "—"}
              </div>
              <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                {labourToday != null
                  ? "From today's latest log"
                  : latestLabour != null
                    ? "From most recent log"
                    : "No labour recorded yet"}
              </div>
            </div>

            <div className="card" style={{ padding: "16px", background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted)", fontSize: "12px" }}>
                <span>Material deliveries</span>
                <PackageCheck size={16} />
              </div>
              <div style={{ fontSize: "24px", fontWeight: 700, margin: "6px 0 2px", color: "var(--text)" }}>
                {materials.length}
              </div>
              <div style={{ fontSize: "11px", color: "var(--muted)" }}>Recorded deliveries</div>
            </div>

            <div className="card" style={{ padding: "16px", background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted)", fontSize: "12px" }}>
                <span>H&amp;S incidents</span>
                <AlertTriangle size={16} />
              </div>
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: 700,
                  margin: "6px 0 2px",
                  color: incidents.length > 0 ? "var(--color-amber)" : "var(--text)",
                }}
              >
                {incidents.length}
              </div>
              <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                {seriousIncidents > 0 ? `${seriousIncidents} high priority` : "Reported to date"}
              </div>
            </div>
          </div>

          {/* Log cards */}
          {logs.length === 0 ? (
            <PageEmpty
              title="No daily logs yet"
              description="When clerks of works submit site diaries they will appear here. No demo figures are shown."
              action={{ label: "Record Daily Log", onClick: () => setShowForm(true) }}
              icon={<ClipboardList size={40} />}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {logs.map((log) => {
                const labour = displayLabour(log);
                const weather = displayWeather(log);
                const adequacy = labourAdequacy(log);
                const matLines = materialsFromDetails(log.details);
                const plant = plantFromDetails(log.details);
                const visitors = visitorsFromDetails(log.details);
                const isToday = log.log_date === today;

                return (
                  <div
                    key={log.id}
                    className="card"
                    style={{
                      padding: "20px",
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: 12,
                        borderBottom: "1px solid var(--border)",
                        paddingBottom: 10,
                        gap: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
                            Daily Log — {formatDate(log.log_date)}
                          </h3>
                          {isToday && <StatusPill label="Today" tone="info" />}
                          {weather !== "—" && (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                fontSize: 11,
                                background: "rgba(0,163,255,0.12)",
                                color: "var(--color-brand-blue)",
                                padding: "2px 8px",
                                borderRadius: 12,
                                fontWeight: 600,
                              }}
                            >
                              <CloudSun size={12} /> {weather}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                          By <strong>{log.author || "—"}</strong>
                          {log.project_id ? (
                            <>
                              {" "}
                              · Project <span style={{ fontFamily: "IBM Plex Mono, ui-monospace, monospace" }}>{log.project_id}</span>
                            </>
                          ) : null}
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                        <div style={{ textAlign: "right", fontSize: 12 }}>
                          <div style={{ color: "var(--muted)" }}>Workforce on site</div>
                          <strong style={{ fontFamily: "IBM Plex Mono, ui-monospace, monospace", color: "var(--color-brand-blue)", fontSize: 16 }}>
                            {labour} {labour === 1 ? "worker" : "workers"}
                          </strong>
                          {adequacy && (
                            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{adequacy}</div>
                          )}
                        </div>
                        <button
                          type="button"
                          className="btn ghost sm"
                          title="Delete log"
                          disabled={deletingId === log.id}
                          onClick={() => handleDelete(log.id)}
                          style={{ color: "var(--muted)" }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Notes / activities */}
                    <div style={{ marginBottom: matLines.length || plant || visitors.length ? 14 : 0 }}>
                      <h4 style={{ margin: "0 0 4px", fontSize: 12, color: "var(--muted)", letterSpacing: "0.04em" }}>
                        DAILY ACTIVITIES SUMMARY
                      </h4>
                      {log.notes?.trim() ? (
                        <p style={{ margin: 0, fontSize: 14, color: "var(--text)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                          {log.notes}
                        </p>
                      ) : (
                        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", fontStyle: "italic" }}>
                          No notes recorded for this day.
                        </p>
                      )}
                    </div>

                    {/* Structured details when present */}
                    {(matLines.length > 0 || plant || visitors.length > 0) && (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                          gap: 12,
                          background: "var(--surface-2)",
                          padding: 12,
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      >
                        {matLines.length > 0 && (
                          <div>
                            <h5 style={{ margin: "0 0 6px", color: "var(--muted)", fontSize: 11 }}>MATERIALS</h5>
                            <ul style={{ margin: 0, paddingLeft: 16, color: "var(--text)" }}>
                              {matLines.map((line, idx) => (
                                <li key={idx}>{line}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {plant && (
                          <div>
                            <h5 style={{ margin: "0 0 6px", color: "var(--muted)", fontSize: 11 }}>PLANT &amp; EQUIPMENT</h5>
                            <div style={{ color: "var(--text)" }}>{plant}</div>
                          </div>
                        )}
                        {visitors.length > 0 && (
                          <div>
                            <h5 style={{ margin: "0 0 6px", color: "var(--muted)", fontSize: 11 }}>VISITORS</h5>
                            <ul style={{ margin: 0, paddingLeft: 16, color: "var(--text)" }}>
                              {visitors.map((v, idx) => (
                                <li key={idx}>{v}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Side context: recent materials & incidents (live only) */}
          {(materials.length > 0 || incidents.length > 0) && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 16,
              }}
            >
              {materials.length > 0 && (
                <div className="card" style={{ padding: 18, background: "var(--surface)", border: "1px solid var(--border)" }}>
                  <h4 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: "var(--muted)", letterSpacing: "0.05em" }}>
                    RECENT MATERIAL DELIVERIES
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {materials.slice(0, 6).map((m) => (
                      <div
                        key={m.id}
                        style={{
                          background: "var(--surface-2)",
                          padding: 10,
                          borderRadius: 6,
                          border: "1px solid var(--border)",
                          fontSize: 12,
                        }}
                      >
                        <div style={{ fontWeight: 600, color: "var(--text)" }}>{m.material || "Material"}</div>
                        <div style={{ color: "var(--muted)", marginTop: 2 }}>
                          {formatDate(m.delivery_date)}
                          {m.quantity != null && m.quantity !== ""
                            ? ` · ${m.quantity}${m.unit ? ` ${m.unit}` : ""}`
                            : ""}
                          {m.supplier ? ` · ${m.supplier}` : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {incidents.length > 0 && (
                <div className="card" style={{ padding: 18, background: "var(--surface)", border: "1px solid var(--border)" }}>
                  <h4 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: "var(--muted)", letterSpacing: "0.05em" }}>
                    RECENT H&amp;S INCIDENTS
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {incidents.slice(0, 6).map((inc) => {
                      const tone =
                        inc.severity === "serious" || inc.severity === "lost_time"
                          ? "danger"
                          : inc.severity === "first_aid"
                            ? "warning"
                            : "neutral";
                      return (
                        <div
                          key={inc.id}
                          style={{
                            background: "var(--surface-2)",
                            padding: 10,
                            borderRadius: 6,
                            border: "1px solid var(--border)",
                            fontSize: 12,
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                            <span style={{ fontWeight: 600, color: "var(--text)" }}>{formatDate(inc.incident_date)}</span>
                            <StatusPill label={(inc.severity || "unknown").replaceAll("_", " ")} tone={tone} />
                          </div>
                          <div style={{ color: "var(--text)" }}>{inc.description || "—"}</div>
                          {inc.reported_by && (
                            <div style={{ color: "var(--muted)", marginTop: 4, fontSize: 11 }}>
                              Reported by {inc.reported_by}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
