"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiFetch, csrfFromCookie } from "@/lib/api";
import { Field, Modal, money } from "@/components/module-ui";
import { Row } from "../../types/facility.types";
import { exportCsv } from "../../utils/facility.utils";
import { FcStatus } from "../FacilityToolbar";

function EmptyState({ message = "No data available." }: { message?: string }) {
  return (
    <div className="empty-state" style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-secondary)" }}>
      {message}
    </div>
  );
}

export function WorkOrderDetail({
  row,
  onBack,
  organizationId,
  canWork,
}: {
  row: Row;
  onBack: () => void;
  organizationId: string | null;
  canWork: boolean;
}) {
  const [detailTab, setDetailTab] = useState<"overview" | "history" | "parts" | "media">("overview");
  const [events, setEvents] = useState<Row[]>([]);
  const [costItems, setCostItems] = useState<Row[]>([]);
  const [attachments, setAttachments] = useState<Row[]>([]);
  const [showCostForm, setShowCostForm] = useState(false);
  const [showMediaForm, setShowMediaForm] = useState(false);
  const [detailError, setDetailError] = useState("");

  const loadEvidence = useCallback(async () => {
    if (!organizationId) return;
    const query = encodeURIComponent(String(row.number ?? ""));
    const [eventResponse, costResponse, attachmentResponse] = await Promise.all([
      apiFetch(`/facility/work-order-events/?search=${query}`, {}, organizationId),
      apiFetch(`/facility/work-order-cost-items/?search=${query}`, {}, organizationId),
      apiFetch(`/facility/work-order-attachments/?search=${query}`, {}, organizationId),
    ]);
    setEvents(eventResponse.ok ? await eventResponse.json() : []);
    setCostItems(costResponse.ok ? await costResponse.json() : []);
    setAttachments(attachmentResponse.ok ? await attachmentResponse.json() : []);
  }, [row.number, organizationId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadEvidence(), 0);
    return () => window.clearTimeout(timer);
  }, [loadEvidence]);

  async function submitCostItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organizationId) return;
    const form = new FormData(event.currentTarget);
    await apiFetch("/auth/csrf/");
    const response = await apiFetch("/facility/work-order-cost-items/", {
      method: "POST", headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify({ work_order: row.id, ...Object.fromEntries(form.entries()) }),
    }, organizationId);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setDetailError(Object.values(body as Record<string, unknown>).flat().join(" ") || "The cost item could not be recorded.");
      return;
    }
    setDetailError(""); setShowCostForm(false); await loadEvidence();
  }

  async function submitAttachment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organizationId) return;
    const form = new FormData(event.currentTarget);
    form.set("work_order", String(row.id));
    const file = form.get("uploaded_file");
    if (file instanceof File && file.size > 0) {
      form.set("file_name", file.name);
      form.set("media_type", file.type || "application/octet-stream");
    }
    await apiFetch("/auth/csrf/");
    const response = await apiFetch("/facility/work-order-attachments/", {
      method: "POST", headers: { "X-CSRFToken": csrfFromCookie() },
      body: form,
    }, organizationId);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setDetailError(Object.values(body as Record<string, unknown>).flat().join(" ") || "The work evidence could not be attached.");
      return;
    }
    setDetailError(""); setShowMediaForm(false); await loadEvidence();
  }

  const priority = String(row.priority ?? "low");
  const status = String(row.status ?? "open");
  const totalCost = costItems.reduce((sum, item) => sum + Number(item.total ?? 0), 0);
  const laborCost = costItems.filter((i) => i.kind === "labor").reduce((s, i) => s + Number(i.total ?? 0), 0);
  const partsCost = costItems.filter((i) => i.kind === "part").reduce((s, i) => s + Number(i.total ?? 0), 0);
  const priorityColors: Record<string, string> = { critical: "#b91c1c", high: "#c2410c", medium: "#a16207", low: "#15803d" };

  return (
    <>
      <nav style={{ marginBottom: 12, fontSize: 12, color: "var(--text-secondary)" }}>
        <span style={{ cursor: "pointer" }} onClick={onBack}>Maintenance</span>
        <span style={{ margin: "0 6px" }}>/</span>
        <span style={{ cursor: "pointer" }} onClick={onBack}>Work Orders</span>
        <span style={{ margin: "0 6px" }}>/</span>
        <span style={{ color: "var(--text-primary)" }}>{String(row.number ?? "—")}</span>
      </nav>
      <button onClick={onBack} style={{ background: "none", border: 0, color: "#e23b3b", cursor: "pointer", fontSize: 13, fontWeight: 700, marginBottom: 16, padding: 0 }}>
        ← Back to Work Orders
      </button>
      <div className="data-panel" style={{ padding: "16px 18px", marginBottom: 16 }}>
        <div style={{ alignItems: "center", display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
          <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{String(row.number ?? "—")}</span>
          <FcStatus value={status.replace("_", "-")} />
          <span className="fc-priority-chip">
            <i style={{ background: priorityColors[priority] ?? "#9ca3af" }} />
            <span style={{ color: priorityColors[priority] ?? "#9ca3af", textTransform: "capitalize" }}>{priority}</span>
          </span>
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>{String(row.title ?? "—")}</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span style={{ alignItems: "center", background: "#f0f4ff", borderRadius: 6, color: "#4f46e5", display: "inline-flex", fontSize: 11, gap: 4, padding: "3px 10px" }}>
            📍 {String(row.property_name ?? "—")}
          </span>
          <span style={{ alignItems: "center", background: "#f0fdf4", borderRadius: 6, color: "#15803d", display: "inline-flex", fontSize: 11, gap: 4, padding: "3px 10px" }}>
            🏗 {String(row.category ?? "General")}
          </span>
        </div>
      </div>
      <div role="tablist" aria-label="Work order details" style={{ borderBottom: "1px solid var(--line)", display: "flex", gap: 0, marginBottom: 16 }}>
        {([
          { id: "overview", label: "Overview" },
          { id: "history", label: `History${events.length ? ` (${events.length})` : ""}` },
          { id: "parts", label: `Parts & Labor${costItems.length ? ` (${costItems.length})` : ""}` },
          { id: "media", label: `Media${attachments.length ? ` (${attachments.length})` : ""}` },
        ] as const).map((t) => (
          <button key={t.id} role="tab" aria-selected={detailTab === t.id} onClick={() => setDetailTab(t.id)} style={{ background: "transparent", border: 0, borderBottom: detailTab === t.id ? "2px solid #e23b3b" : "2px solid transparent", color: detailTab === t.id ? "#e23b3b" : "#6b7280", cursor: "pointer", fontSize: 13, fontWeight: 600, padding: "12px 16px", textTransform: "capitalize" }}>
            {t.label}
          </button>
        ))}
      </div>

      {detailTab === "overview" && (
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 340px" }}>
        <div style={{ display: "grid", gap: 16 }}>
          <div className="data-panel" style={{ padding: "16px 18px" }}>
            <strong style={{ display: "block", fontSize: 13, marginBottom: 12 }}>Work Order Details</strong>
            {[
              { label: "Priority", value: <span className="fc-priority-chip"><i style={{ background: priorityColors[priority] ?? "#9ca3af" }} /><span style={{ color: priorityColors[priority] ?? "#9ca3af", textTransform: "capitalize" }}>{priority}</span></span> },
              { label: "SLA Response Time", value: "Within 4 hours" },
              { label: "SLA Resolution Time", value: "Within 48 hours" },
              { label: "Assigned To", value: String(row.assigned_to_name ?? "Unassigned") },
              { label: "Reported At", value: String(row.reported_at ?? "—") },
              { label: "Scheduled For", value: String(row.scheduled_for ?? "—") },
              { label: "Progress", value: `${String(row.progress ?? 0)}%` },
            ].map((f) => (
              <div key={f.label} style={{ borderBottom: "1px solid #f0f2f6", display: "flex", justifyContent: "space-between", padding: "9px 0" }}>
                <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>{f.label}</span>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{f.value}</span>
              </div>
            ))}
          </div>
          <div className="data-panel">
            <div style={{ borderBottom: "1px solid var(--line)", padding: "14px 18px" }}>
              <strong style={{ fontSize: 13 }}>Parts & Materials</strong>
            </div>
            <div className="table-scroll">
              <table className="fc-data-table">
                <thead>
                  <tr><th>Part Code</th><th>Description</th><th>Qty</th><th>Unit Cost</th><th>Total</th></tr>
                </thead>
                <tbody>
                  {costItems.filter((i) => i.kind === "part").length > 0
                    ? costItems.filter((i) => i.kind === "part").map((item, idx) => (
                        <tr key={idx}>
                          <td style={{ fontSize: 11, fontFamily: "ui-monospace, monospace" }}>{String(item.reference ?? "—")}</td>
                          <td style={{ fontSize: 12 }}>{String(item.description ?? "—")}</td>
                          <td style={{ fontSize: 12 }}>{String(item.quantity ?? "—")}</td>
                          <td style={{ fontSize: 12 }}>{money.format(Number(item.unit_cost ?? 0))}</td>
                          <td style={{ fontSize: 12, fontWeight: 700 }}>{money.format(Number(item.total ?? 0))}</td>
                        </tr>
                      ))
                    : <tr><td colSpan={5}><EmptyState message="No parts have been recorded for this work order." /></td></tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
          <div className="data-panel" style={{ padding: "16px 18px" }}>
            <strong style={{ display: "block", fontSize: 13, marginBottom: 12 }}>Cost Estimate Summary</strong>
            {[
              { label: "Labor Cost", value: money.format(Number(row.labor_cost ?? laborCost)) },
              { label: "Parts Cost", value: money.format(Number(row.parts_cost ?? partsCost)) },
              { label: "Other Cost", value: money.format(Number(row.other_cost ?? 0)) },
            ].map((f) => (
              <div key={f.label} style={{ borderBottom: "1px solid #f0f2f6", display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
                <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>{f.label}</span>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{f.value}</span>
              </div>
            ))}
            <div style={{ borderTop: "2px solid #f0f2f6", display: "flex", justifyContent: "space-between", marginTop: 4, padding: "10px 0" }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Total Cost</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: "#e23b3b" }}>{money.format(Number(row.total_cost ?? totalCost))}</span>
            </div>
          </div>
        </div>
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <div className="data-panel" style={{ padding: "16px 18px" }}>
            <strong style={{ display: "block", fontSize: 13, marginBottom: 12 }}>Workflow status</strong>
            <div style={{ alignItems: "center", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, display: "flex", gap: 10, padding: "10px 14px" }}>
              <FcStatus value={status.replace("_", "-")} />
              <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{status === "completed" ? "Resolution evidence recorded" : "Use the register action to advance this work order"}</span>
            </div>
          </div>
          <div className="data-panel" style={{ padding: "16px 18px" }}>
            <strong style={{ display: "block", fontSize: 13, marginBottom: 12 }}>Work Order Timeline</strong>
            <div style={{ display: "grid", gap: 12 }}>
              {events.slice(0, 6).map((evt, i, arr) => (
                <div key={i} style={{ display: "flex", gap: 10 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ background: i === 0 ? "#e23b3b" : "#d7dce5", borderRadius: "50%", height: 8, width: 8 }} />
                    {i < arr.length - 1 && <div style={{ background: "#edf0f5", flex: 1, width: 2, marginTop: 4 }} />}
                  </div>
                  <div style={{ paddingBottom: 8 }}>
                    <strong style={{ display: "block", fontSize: 12 }}>{String(evt.event_type ?? "—").replace(/_/g, " ")}</strong>
                    <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>{String(evt.created_at ?? "—")}</span>
                    {Boolean(evt.notes) && <p style={{ color: "#4b5563", fontSize: 11, margin: "4px 0 0" }}>{String(evt.notes)}</p>}
                  </div>
                </div>
              ))}
              {events.length === 0 && <span className="muted" style={{ fontSize: 12 }}>No audited work-order events yet.</span>}
            </div>
          </div>
        </div>
      </div>
      )}

      {detailTab === "history" && (
        <div className="data-panel" style={{ padding: "16px 18px" }}>
          <strong style={{ display: "block", fontSize: 13, marginBottom: 12 }}>Work Order History / Events</strong>
          {events.length > 0 ? (
            <div style={{ display: "grid", gap: 14 }}>
              {events.map((evt, i, arr) => (
                <div key={String(evt.id ?? i)} style={{ display: "flex", gap: 10 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ background: i === 0 ? "#e23b3b" : "#d7dce5", borderRadius: "50%", height: 10, width: 10 }} />
                    {i < arr.length - 1 && <div style={{ background: "#edf0f5", flex: 1, width: 2, marginTop: 4 }} />}
                  </div>
                  <div style={{ paddingBottom: 12 }}>
                    <div style={{ alignItems: "center", display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <strong style={{ fontSize: 13 }}>{String(evt.event_type ?? "—").replace(/_/g, " ")}</strong>
                      {Boolean(evt.from_status || evt.to_status) && (
                        <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                          {String(evt.from_status ?? "—").replace(/_/g, " ")} → {String(evt.to_status ?? "—").replace(/_/g, " ")}
                        </span>
                      )}
                    </div>
                    <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>{String(evt.created_at ?? "—")} · by {String(evt.actor_name ?? "—")}</span>
                    {Boolean(evt.notes) && <p style={{ color: "#4b5563", fontSize: 12, margin: "6px 0 0" }}>{String(evt.notes)}</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="No events recorded for this work order yet." />
          )}
        </div>
      )}

      {detailTab === "parts" && (
        <div className="data-panel">
          <div className="fc-table-toolbar">
            <span style={{ color: "var(--text-primary)", fontWeight: 700, fontSize: 13 }}>Labor & Parts Cost Items</span>
            <div className="row" style={{ gap: 8 }}>
              <button className="fc-toolbar-btn" onClick={() => exportCsv(costItems, `work-order-${String(row.number ?? "cost")}-items.csv`)}>↓ Export</button>
              {canWork && <button className="fc-toolbar-btn primary" onClick={() => setShowCostForm(true)}>+ Add Cost Item</button>}
            </div>
          </div>
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr><th>Type</th><th>Description</th><th>Qty</th><th>Unit Cost</th><th>Total</th><th>Supplier</th><th>Reference</th><th>Added By</th></tr>
              </thead>
              <tbody>
                {costItems.length > 0 ? costItems.map((item, idx) => (
                  <tr key={idx}>
                    <td><FcStatus value={String(item.kind ?? "other")} /></td>
                    <td style={{ fontSize: 12 }}>{String(item.description ?? "—")}</td>
                    <td style={{ fontSize: 12 }}>{String(item.quantity ?? "—")}</td>
                    <td style={{ fontSize: 12 }}>{money.format(Number(item.unit_cost ?? 0))}</td>
                    <td style={{ fontSize: 12, fontWeight: 700 }}>{money.format(Number(item.total ?? 0))}</td>
                    <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{String(item.supplier ?? "—")}</td>
                    <td style={{ fontSize: 11, fontFamily: "ui-monospace, monospace" }}>{String(item.reference ?? "—")}</td>
                    <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{String(item.added_by_name ?? "—")}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={8}><EmptyState message="No cost items recorded for this work order yet." /></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {detailTab === "media" && (
        <div className="data-panel" style={{ padding: "16px 18px" }}>
          <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
            <strong style={{ fontSize: 13 }}>Work Media / Attachments</strong>
            {canWork && <button className="btn primary sm" onClick={() => setShowMediaForm(true)}>+ Attach Evidence</button>}
          </div>
          {attachments.length > 0 ? (
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
              {attachments.map((att, idx) => {
                const url = String(att.file_url ?? "");
                const isImage = /\.(png|jpe?g|gif|webp|svg|avif)(\?.*)?$/i.test(url) || String(att.media_type ?? "").startsWith("image");
                return (
                  <div key={String(att.id ?? idx)} style={{ background: "#f8fafc", border: "1px solid #eef1f5", borderRadius: 10, overflow: "hidden" }}>
                    {isImage ? (
                      <div style={{ height: 120, display: "grid", placeItems: "center", background: "#eef1f5" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={String(att.caption ?? att.file_name ?? "attachment")} style={{ height: "100%", width: "100%", objectFit: "cover" }} />
                      </div>
                    ) : (
                      <div style={{ height: 120, display: "grid", placeItems: "center", background: "#eef1f5", color: "var(--text-secondary)", fontSize: 32 }}>📄</div>
                    )}
                    <div style={{ padding: "10px 12px" }}>
                      <strong style={{ display: "block", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{String(att.file_name ?? "—")}</strong>
                      <small style={{ color: "var(--text-secondary)", fontSize: 10 }}>{String(att.caption ?? att.media_type ?? "—")}</small>
                      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                        {url && <a href={url} target="_blank" rel="noreferrer" style={{ color: "#e23b3b", fontSize: 11, fontWeight: 700, textDecoration: "none" }}>Open →</a>}
                        <span style={{ color: "var(--text-secondary)", fontSize: 10, marginLeft: "auto" }}>{String(att.uploaded_by_name ?? "—")}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState message="No media attached to this work order yet." />
          )}
        </div>
      )}
      {detailError && <div className="form-error">{detailError}</div>}
      {showCostForm && (
        <Modal title={`Add Cost Item · ${String(row.number ?? "Work order")}`} onClose={() => setShowCostForm(false)}>
          <form onSubmit={submitCostItem} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="grid-2">
              <Field label="Cost type" required><select name="kind" required defaultValue="part"><option value="labor">Labor</option><option value="part">Part / material</option><option value="other">Other</option></select></Field>
              <Field label="Reference"><input name="reference" placeholder="Receipt, stock or timesheet ref" /></Field>
            </div>
            <Field label="Description" required><input name="description" required placeholder="Technician hours or replacement part" /></Field>
            <div className="grid-2">
              <Field label="Quantity" required><input name="quantity" type="number" min="0.001" step="0.001" defaultValue="1" required /></Field>
              <Field label="Unit cost (KES)" required><input name="unit_cost" type="number" min="0" step="0.01" required /></Field>
            </div>
            <Field label="Supplier / technician"><input name="supplier" /></Field>
            <div className="modal-actions"><button type="button" className="btn ghost" onClick={() => setShowCostForm(false)}>Cancel</button><button className="btn primary">Record Cost</button></div>
          </form>
        </Modal>
      )}
      {showMediaForm && (
        <Modal title={`Attach Work Evidence · ${String(row.number ?? "Work order")}`} onClose={() => setShowMediaForm(false)}>
          <form onSubmit={submitAttachment} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Evidence file" required><input name="uploaded_file" type="file" accept="image/*,video/*,application/pdf" required /></Field>
            <small style={{ color: "var(--text-secondary)" }}>Photos, short videos and PDFs up to 15 MB. File name and media type are captured automatically.</small>
            <Field label="Caption"><textarea name="caption" rows={3} placeholder="Describe the condition or completed work" /></Field>
            <div className="modal-actions"><button type="button" className="btn ghost" onClick={() => setShowMediaForm(false)}>Cancel</button><button className="btn primary">Attach Evidence</button></div>
          </form>
        </Modal>
      )}
    </>
  );
}
