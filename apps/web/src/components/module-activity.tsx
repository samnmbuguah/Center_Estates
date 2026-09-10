"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { CalendarDays, CircleAlert, RefreshCw } from "lucide-react";
import { Alert, Box, Button, Chip, Divider, FormControl, InputLabel, MenuItem, Paper, Select, Stack, TextField, Typography } from "@mui/material";
import { DetailDrawer, StatusPill } from "@/components/module-ui";
import { apiErrorMessage, apiFetch, csrfFromCookie } from "@/lib/api";
import { usePropertyContext } from "@/lib/property-context";

const CalendarWidget = dynamic(() => import("@/components/calendar-widget"), { ssr: false, loading: () => <ActivityState message="Loading calendar widget…" onRetry={() => window.location.reload()} /> });

type ActivityRecord = Record<string, unknown>;

function formatDate(value: unknown) {
  if (!value) return "—";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });
}

function ActivityState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="card" role="status" style={{ padding: 24, textAlign: "center" }}>
      <p className="muted" style={{ marginTop: 0 }}>{message}</p>
      <button type="button" className="btn ghost sm" onClick={onRetry}><RefreshCw size={14} /> Retry</button>
    </div>
  );
}

export function ModuleTicketsView({ moduleName, portfolio = false }: { moduleName: string; portfolio?: boolean }) {
  const router = useRouter();
  const { activeProperty } = usePropertyContext();
  const [rows, setRows] = useState<ActivityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<ActivityRecord | null>(null);
  const [detail, setDetail] = useState<ActivityRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [reply, setReply] = useState("");
  const [saving, setSaving] = useState(false);
  const load = useCallback(() => {
    setLoading(true); setError("");
    void apiFetch("/tickets-feed/", portfolio ? { headers: { "X-Property-Scope": "portfolio" } } : undefined)
      .then(async (response) => {
        if (!response.ok) throw new Error(await apiErrorMessage(response, "Tickets could not be loaded."));
        const data = await response.json();
        setRows(Array.isArray(data) ? data : (data.results ?? []));
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [portfolio]);
  useEffect(() => { queueMicrotask(load); }, [activeProperty?.id, load]);

  const moduleKey = moduleName.toLowerCase() === "portfolio" ? "all" : moduleName.toLowerCase();
  const relevantRows = useMemo(() => rows.filter((row) => {
    if (portfolio || moduleKey === "all" || moduleKey === "companion") return true;
    if (moduleKey === "property") {
      // Property operations should include tenant service requests, occupant feedback, and facility work orders scoped to the property
      return String(row.module) === "property" || String(row.module) === "facility";
    }
    if (moduleKey === "facility") {
      // Facility includes all facility tickets including incidents
      return String(row.module) === "facility";
    }
    return String(row.module) === moduleKey;
  }), [rows, portfolio, moduleKey]);

  const openTicket = useCallback(async (row: ActivityRecord) => {
    setSelected(row);
    setDetail(row); // Prepopulate immediately with existing row fields
    setDetailError("");
    setDetailLoading(true);

    const id = String(row.id ?? "");
    let endpoint = "";
    if (id.startsWith("feedback:")) {
      endpoint = `/companion/feedback/${id.slice("feedback:".length)}/`;
    } else if (id.startsWith("service-request:")) {
      endpoint = `/facility/service-requests/${id.slice("service-request:".length)}/`;
    } else if (id.startsWith("work-order:")) {
      endpoint = `/facility/work-orders/${id.slice("work-order:".length)}/`;
    } else if (id.startsWith("task:")) {
      endpoint = `/companion/tasks/${id.slice("task:".length)}/`;
    } else if (id.startsWith("site-ticket:")) {
      endpoint = `/construction/tickets/${id.slice("site-ticket:".length)}/`;
    } else if (id.startsWith("incident:")) {
      endpoint = `/facility/incidents/${id.slice("incident:".length)}/`;
    }

    if (!endpoint) {
      setDetailLoading(false);
      return;
    }

    try {
      const response = await apiFetch(endpoint);
      if (response.ok) {
        const data = await response.json();
        setDetail((prev) => ({ ...prev, ...data }));
      }
    } catch (reason) {
      setDetailError(reason instanceof Error ? reason.message : "Ticket details could not be loaded.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const refreshDetail = useCallback(async () => {
    if (!selected) return;
    await openTicket(selected);
    load();
  }, [load, openTicket, selected]);

  const updateStatus = useCallback(async (status: string) => {
    if (!selected) return;
    setSaving(true); setDetailError("");
    const id = String(selected.id ?? "");
    try {
      await apiFetch("/auth/csrf/");
      let path = "";
      let method = "POST";
      let body: Record<string, unknown> = { status };

      if (id.startsWith("feedback:")) {
        path = `/companion/feedback/${id.slice("feedback:".length)}/update-status/`;
      } else if (id.startsWith("task:")) {
        path = `/companion/tasks/${id.slice("task:".length)}/`;
        method = "PATCH";
        body = { status };
      } else if (id.startsWith("service-request:")) {
        const rawId = id.slice("service-request:".length);
        if (status === "resolved") {
          path = `/facility/service-requests/${rawId}/resolve/`;
          body = { resolution_notes: "Resolved via operational workspace." };
        } else if (status === "approved") {
          path = `/facility/service-requests/${rawId}/approve/`;
          body = { notes: "Approved in workspace." };
        } else if (status === "rejected") {
          path = `/facility/service-requests/${rawId}/reject/`;
          body = { notes: "Rejected in workspace." };
        }
      }

      if (path) {
        const response = await apiFetch(path, {
          method,
          headers: { "X-CSRFToken": csrfFromCookie() },
          body: JSON.stringify(body),
        });
        if (!response.ok) throw new Error(await apiErrorMessage(response, "Status could not be updated."));
      }
      await refreshDetail();
    } catch (reason) {
      setDetailError(reason instanceof Error ? reason.message : "Status could not be updated.");
    } finally { setSaving(false); }
  }, [refreshDetail, selected]);

  const sendReply = useCallback(async () => {
    if (!selected || !reply.trim()) return;
    setSaving(true); setDetailError("");
    const id = String(selected.id ?? "");
    try {
      await apiFetch("/auth/csrf/");
      if (id.startsWith("feedback:")) {
        const response = await apiFetch(`/companion/feedback/${id.slice("feedback:".length)}/messages/`, {
          method: "POST", headers: { "X-CSRFToken": csrfFromCookie() }, body: JSON.stringify({ message: reply.trim() }),
        });
        if (!response.ok) throw new Error(await apiErrorMessage(response, "Your reply could not be sent."));
      }
      setReply("");
      await refreshDetail();
    } catch (reason) {
      setDetailError(reason instanceof Error ? reason.message : "Your reply could not be sent.");
    } finally { setSaving(false); }
  }, [refreshDetail, reply, selected]);

  const createWorkOrder = useCallback(async () => {
    if (!selected) return;
    setSaving(true); setDetailError("");
    const id = String(selected.id ?? "");
    try {
      await apiFetch("/auth/csrf/");
      if (id.startsWith("feedback:")) {
        const response = await apiFetch(`/companion/feedback/${id.slice("feedback:".length)}/create-work-order/`, {
          method: "POST", headers: { "X-CSRFToken": csrfFromCookie() }, body: JSON.stringify({}),
        });
        if (!response.ok) throw new Error(await apiErrorMessage(response, "A work order could not be created."));
      } else if (id.startsWith("service-request:")) {
        const response = await apiFetch(`/facility/service-requests/${id.slice("service-request:".length)}/convert/`, {
          method: "POST", headers: { "X-CSRFToken": csrfFromCookie() }, body: JSON.stringify({}),
        });
        if (!response.ok) throw new Error(await apiErrorMessage(response, "A work order could not be created."));
      }
      await refreshDetail();
    } catch (reason) {
      setDetailError(reason instanceof Error ? reason.message : "A work order could not be created.");
    } finally { setSaving(false); }
  }, [refreshDetail, selected]);

  const ticketType = useMemo(() => {
    const id = String(selected?.id ?? "");
    if (id.startsWith("service-request:")) return "service-request";
    if (id.startsWith("work-order:")) return "work-order";
    if (id.startsWith("task:")) return "task";
    if (id.startsWith("feedback:")) return "feedback";
    if (id.startsWith("site-ticket:")) return "site-ticket";
    return "ticket";
  }, [selected]);

  return (
    <section aria-labelledby="module-tickets-heading" style={{ width: "100%", maxWidth: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <div>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--primary, var(--color-sky))" }}>
            {moduleName} OPERATIONS
          </span>
          <h2 id="module-tickets-heading" style={{ margin: "4px 0 2px", fontSize: 22, fontWeight: 800, color: "var(--text-primary, var(--color-slate-900))" }}>
            Tickets & issues
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary, var(--color-slate-500))" }}>
            {portfolio ? "Issues and requests across your accessible properties." : `Issues scoped to ${activeProperty?.name ?? "the current property"}.`}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="status-pill" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "var(--surface-2, var(--color-slate-100))", border: "1px solid var(--border, var(--color-slate-200))", fontSize: 12, fontWeight: 700, color: "var(--text-primary, var(--color-slate-900))" }}>
            <CircleAlert size={14} color="var(--primary, var(--color-sky))" /> {relevantRows.length} visible
          </span>
          <button type="button" className="btn ghost sm" onClick={load} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid var(--border, var(--color-slate-200))", borderRadius: 8, padding: "6px 12px", background: "var(--surface, #ffffff)", cursor: "pointer", fontSize: 12, fontWeight: 750 }}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <ActivityState message="Loading tickets…" onRetry={load} />
      ) : error ? (
        <ActivityState message={error} onRetry={load} />
      ) : relevantRows.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: "center", background: "var(--surface, #ffffff)", border: "1px solid var(--border, var(--color-slate-200))", borderRadius: 12 }}>
          <CircleAlert size={36} color="var(--text-secondary, var(--color-slate-400))" style={{ margin: "0 auto 12px" }} />
          <h4 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 800, color: "var(--text-primary, var(--color-slate-900))" }}>No open tickets</h4>
          <p style={{ margin: "0 auto", maxWidth: 420, fontSize: 13, color: "var(--text-secondary, var(--color-slate-500))" }}>
            {activeProperty ? `No open tickets or issues are recorded for ${activeProperty.name}.` : "No open tickets or issues recorded in this organization."}
          </p>
        </div>
      ) : (
        <div className="data-panel table-scroll" style={{ background: "var(--surface, #ffffff)", border: "1px solid var(--border, var(--color-slate-200))", borderRadius: 12, overflow: "hidden" }}>
          <table className="fc-data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--surface-2, var(--color-slate-50))", borderBottom: "1px solid var(--border, var(--color-slate-200))" }}>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary, var(--color-slate-500))" }}>Reference</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary, var(--color-slate-500))" }}>Title</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary, var(--color-slate-500))" }}>Raised by</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary, var(--color-slate-500))" }}>Priority</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary, var(--color-slate-500))" }}>Status</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary, var(--color-slate-500))" }}>Updated</th>
                <th style={{ padding: "12px 16px", textAlign: "right", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary, var(--color-slate-500))" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {relevantRows.map((row, index) => (
                <tr
                  key={String(row.id ?? index)}
                  style={{ cursor: "pointer", borderBottom: "1px solid var(--border, var(--color-slate-100))", transition: "background 0.15s ease" }}
                  onClick={() => void openTicket(row)}
                  className="ticket-row-hover"
                >
                  <td style={{ padding: "12px 16px", fontFamily: "var(--font-mono, monospace)", fontSize: 12, fontWeight: 750, color: "var(--primary, var(--color-sky))" }}>
                    {String(row.reference ?? row.code ?? `TICKET-${index + 1}`)}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ fontWeight: 750, fontSize: 13, color: "var(--text-primary, var(--color-slate-900))" }}>
                      {String(row.title ?? row.subject ?? row.description ?? "—")}
                    </div>
                    {Boolean(row.property_name && portfolio) && (
                      <div style={{ fontSize: 11, color: "var(--text-secondary, var(--color-slate-500))", marginTop: 2 }}>
                        {String(row.property_name)}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--text-secondary, var(--color-slate-700))", fontWeight: 600 }}>
                    {String(row.raised_by ?? "—")}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <StatusPill value={String(row.priority ?? "normal")} />
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <StatusPill value={String(row.status ?? "open")} />
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--text-secondary, var(--color-slate-500))" }}>
                    {formatDate(row.updated_at ?? row.created_at)}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>
                    <button
                      type="button"
                      className="btn ghost sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        void openTicket(row);
                      }}
                      style={{ padding: "4px 10px", fontSize: 12, fontWeight: 700, borderRadius: 6, border: "1px solid var(--border, var(--color-slate-200))", background: "var(--surface, #ffffff)", cursor: "pointer" }}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <DetailDrawer
          title={
            <div style={{ display: "flex", alignItems: "center", gap: 10, overflow: "hidden" }}>
              <span style={{ fontFamily: "var(--font-mono, monospace)", color: "var(--primary, var(--color-sky))", fontWeight: 800 }}>
                {String(detail?.reference ?? selected.reference ?? "Ticket")}
              </span>
              <span style={{ color: "var(--text-secondary, var(--color-slate-400))" }}>·</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {String(detail?.title ?? detail?.subject ?? selected.title ?? "Issue Details")}
              </span>
            </div>
          }
          width={620}
          onClose={() => {
            setSelected(null);
            setDetail(null);
            setDetailError("");
          }}
        >
          {detailLoading && !detail ? (
            <ActivityState message="Loading ticket details…" onRetry={() => void refreshDetail()} />
          ) : (
            <Stack spacing={3}>
              {detailError && <Alert severity="error">{detailError}</Alert>}
              {detail && (
                <>
                  {/* Status & Categorization Bar */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "12px 16px", background: "var(--surface-2, var(--color-slate-50))", border: "1px solid var(--border, var(--color-slate-200))", borderRadius: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 750, textTransform: "uppercase", color: "var(--text-secondary, var(--color-slate-500))" }}>Status:</span>
                      <StatusPill value={String(detail.status ?? selected.status ?? "open")} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 750, textTransform: "uppercase", color: "var(--text-secondary, var(--color-slate-500))" }}>Priority:</span>
                      <StatusPill value={String(detail.priority ?? selected.priority ?? "normal")} />
                    </div>
                    {Boolean(detail.module || selected.module) ? (
                      <Chip size="small" label={String(detail.module ?? selected.module).toUpperCase()} sx={{ fontWeight: 800, fontSize: 11, height: 24, bgcolor: "var(--primary-subtle, var(--color-sky-bg))", color: "var(--primary, var(--color-sky-deep))" }} />
                    ) : null}
                    {Boolean(detail.category || detail.issue_category) ? (
                      <Chip size="small" variant="outlined" label={String(detail.category || detail.issue_category)} sx={{ fontWeight: 700, fontSize: 11, height: 24 }} />
                    ) : null}
                  </div>

                  {/* Issue Description Card */}
                  {(detail.description || detail.subject || detail.title || detail.body) && (
                    <Paper variant="outlined" sx={{ p: 2.5, bgcolor: "var(--surface, #ffffff)", borderColor: "var(--border, var(--color-slate-200))", borderRadius: 2 }}>
                      <Typography variant="caption" sx={{ fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary, var(--color-slate-500))", display: "block", mb: 1 }}>
                        Issue Description
                      </Typography>
                      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", color: "var(--text-primary, var(--color-slate-900))", lineHeight: 1.6, fontSize: 14 }}>
                        {String(detail.description || detail.body || detail.title || detail.subject || "")}
                      </Typography>
                    </Paper>
                  )}

                  {/* Key Facts Grid */}
                  <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 2, p: 2.5, bgcolor: "var(--surface-2, var(--color-slate-50))", borderRadius: 2, border: "1px solid var(--border, var(--color-slate-200))" }}>
                    <TicketFact label="Property" value={detail.property_name || selected.property_name} />
                    <TicketFact label="Location / Unit" value={detail.location_detail || detail.location || detail.unit_code} />
                    <TicketFact label="Raised by" value={detail.raised_by || detail.requester_name || detail.tenant_name || detail.created_by_name || selected.raised_by} />
                    <TicketFact label="Assigned to" value={detail.assigned_to || detail.assigned_to_name || detail.assigned_team || selected.assigned_to} />
                    <TicketFact label="Created Date" value={formatDate(detail.created_at || detail.submitted_at || selected.created_at)} />
                    <TicketFact label="Due / SLA" value={formatDate(detail.sla_due_at || detail.response_due_at || detail.due_date)} />
                  </Box>

                  {/* Evidence / Attachments */}
                  {(Boolean(detail.photo_url) || (Array.isArray(detail.photos) && detail.photos.length > 0)) && (
                    <Box>
                      <Typography variant="caption" sx={{ fontWeight: 800, textTransform: "uppercase", color: "var(--text-secondary, var(--color-slate-500))", display: "block", mb: 1 }}>
                        Attached Evidence & Media
                      </Typography>
                      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
                        {detail.photo_url ? (
                          <Button component="a" href={String(detail.photo_url)} target="_blank" rel="noreferrer" variant="outlined" size="small" sx={{ fontWeight: 700 }}>
                            View Evidence Photo ↗
                          </Button>
                        ) : null}
                        {Array.isArray(detail.photos) && detail.photos.map((ph: any, i: number) => (
                          <Button key={i} component="a" href={String(ph.url || ph.file || ph)} target="_blank" rel="noreferrer" variant="outlined" size="small" sx={{ fontWeight: 700 }}>
                            Attachment #{i + 1} ↗
                          </Button>
                        ))}
                      </Box>
                    </Box>
                  )}

                  {/* Threaded Conversations (for feedback or messages) */}
                  {Array.isArray(detail.messages) && (
                    <Box>
                      <Divider sx={{ my: 2 }} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "var(--text-primary, var(--color-slate-900))", mb: 1.5 }}>
                        Conversation & Activity
                      </Typography>
                      <Stack spacing={1.5} sx={{ mb: 2 }}>
                        {detail.messages.map((message: ActivityRecord, index: number) => (
                          <Paper key={String(message.id ?? index)} variant="outlined" sx={{ p: 2, bgcolor: "var(--surface, #ffffff)", borderColor: "var(--border, var(--color-slate-200))", borderRadius: 2 }}>
                            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", color: "var(--text-primary, var(--color-slate-900))", lineHeight: 1.5 }}>
                              {String(message.message ?? "")}
                            </Typography>
                            <Typography variant="caption" sx={{ color: "var(--text-secondary, var(--color-slate-500))", display: "block", mt: 1, fontWeight: 600 }}>
                              {String(message.sender_name ?? "System")} · {formatDate(message.created_at)}
                            </Typography>
                          </Paper>
                        ))}
                        {detail.messages.length === 0 && (
                          <Typography variant="body2" color="text.secondary">
                            No messages have been recorded yet.
                          </Typography>
                        )}
                      </Stack>
                      <TextField
                        placeholder="Add an update or response to this ticket…"
                        value={reply}
                        onChange={(event) => setReply(event.target.value)}
                        multiline
                        minRows={2}
                        fullWidth
                        size="small"
                        sx={{ mb: 1.5 }}
                      />
                      <Button variant="contained" disabled={saving || !reply.trim()} onClick={() => void sendReply()} sx={{ fontWeight: 750 }}>
                        {saving ? "Sending…" : "Send Update"}
                      </Button>
                    </Box>
                  )}

                  {/* Direct Jump & Workflow Action Center */}
                  <Box>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "var(--text-primary, var(--color-slate-900))", mb: 1.5 }}>
                      Workflow & Resolution Actions
                    </Typography>

                    {/* Dispatched WO Alert */}
                    {Boolean((detail.metadata && typeof detail.metadata === "object" && (detail.metadata as ActivityRecord).work_order_number) || detail.work_order) && (
                      <Alert severity="success" sx={{ mb: 2 }} action={<Button size="small" onClick={() => router.push("/facility?tab=work-orders")}>Open Work Orders</Button>}>
                        Dispatched as Work Order {String((detail.metadata as ActivityRecord)?.work_order_number || (detail.work_order as any)?.number || detail.work_order || "")}.
                      </Alert>
                    )}

                    <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", gap: 1 }}>
                      {/* Service Request Actions */}
                      {ticketType === "service-request" && (
                        <>
                          {String(detail.status) === "new" && (
                            <>
                              <Button variant="contained" color="success" disabled={saving} onClick={() => void updateStatus("approved")} sx={{ fontWeight: 750 }}>
                                Approve Request
                              </Button>
                              <Button variant="outlined" color="error" disabled={saving} onClick={() => void updateStatus("rejected")} sx={{ fontWeight: 750 }}>
                                Reject
                              </Button>
                            </>
                          )}
                          {!detail.work_order && ["new", "approved"].includes(String(detail.status)) && (
                            <Button variant="contained" disabled={saving} onClick={() => void createWorkOrder()} sx={{ fontWeight: 750 }}>
                              Convert to Work Order
                            </Button>
                          )}
                          {["assigned", "in_progress"].includes(String(detail.status)) && (
                            <Button variant="contained" color="success" disabled={saving} onClick={() => void updateStatus("resolved")} sx={{ fontWeight: 750 }}>
                              Mark Resolved
                            </Button>
                          )}
                          <Button variant="outlined" onClick={() => router.push("/facility?tab=service-requests")} sx={{ fontWeight: 750 }}>
                            View in Facility Helpdesk ↗
                          </Button>
                        </>
                      )}

                      {/* Work Order Actions */}
                      {ticketType === "work-order" && (
                        <Button variant="contained" onClick={() => router.push("/facility?tab=work-orders")} sx={{ fontWeight: 750 }}>
                          Open in Work Orders ↗
                        </Button>
                      )}

                      {/* Task Actions */}
                      {ticketType === "task" && (
                        <>
                          {String(detail.status) !== "in_progress" && String(detail.status) !== "completed" && (
                            <Button variant="outlined" disabled={saving} onClick={() => void updateStatus("in_progress")} sx={{ fontWeight: 750 }}>
                              Start Task
                            </Button>
                          )}
                          {String(detail.status) !== "completed" && (
                            <Button variant="contained" color="success" disabled={saving} onClick={() => void updateStatus("completed")} sx={{ fontWeight: 750 }}>
                              Mark Completed
                            </Button>
                          )}
                          {String(detail.status) === "completed" && (
                            <Button variant="outlined" disabled={saving} onClick={() => void updateStatus("pending")} sx={{ fontWeight: 750 }}>
                              Reopen Task
                            </Button>
                          )}
                          <Button variant="outlined" onClick={() => router.push("/companion")} sx={{ fontWeight: 750 }}>
                            Open in Companion ↗
                          </Button>
                        </>
                      )}

                      {/* Feedback Thread Actions */}
                      {ticketType === "feedback" && (
                        <>
                          {String(detail.status) !== "in_progress" && String(detail.status) !== "resolved" && String(detail.status) !== "closed" && (
                            <Button variant="outlined" disabled={saving} onClick={() => void updateStatus("in_progress")} sx={{ fontWeight: 750 }}>
                              Start Work
                            </Button>
                          )}
                          {String(detail.status) !== "resolved" && String(detail.status) !== "closed" && (
                            <Button variant="outlined" color="success" disabled={saving} onClick={() => void updateStatus("resolved")} sx={{ fontWeight: 750 }}>
                              Mark Resolved
                            </Button>
                          )}
                          {String(detail.status) === "resolved" && (
                            <Button variant="contained" color="success" disabled={saving} onClick={() => void updateStatus("closed")} sx={{ fontWeight: 750 }}>
                              Confirm & Close
                            </Button>
                          )}
                          {["resolved", "closed"].includes(String(detail.status)) && (
                            <Button variant="outlined" disabled={saving} onClick={() => void updateStatus("open")} sx={{ fontWeight: 750 }}>
                              Reopen
                            </Button>
                          )}
                          {!((detail.metadata as ActivityRecord)?.work_order_number) && (
                            <Button variant="contained" disabled={saving} onClick={() => void createWorkOrder()} sx={{ fontWeight: 750 }}>
                              Create & Dispatch Work Order
                            </Button>
                          )}
                        </>
                      )}
                    </Stack>
                  </Box>
                </>
              )}
            </Stack>
          )}
        </DetailDrawer>
      )}
    </section>
  );
}

function TicketFact({ label, value }: { label: string; value: unknown }) {
  return (
    <Box>
      <Typography variant="caption" sx={{ color: "var(--text-secondary, var(--color-slate-500))", fontWeight: 750, textTransform: "uppercase", fontSize: 11, display: "block", mb: 0.25 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 750, color: "var(--text-primary, var(--color-slate-900))", fontSize: 13 }}>
        {value ? String(value) : "—"}
      </Typography>
    </Box>
  );
}

export function ModuleCalendarView({ moduleName, portfolio = false }: { moduleName: string; portfolio?: boolean }) {
  const { activeProperty } = usePropertyContext();
  const [rows, setRows] = useState<ActivityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [range, setRange] = useState({ start: "", end: "" });
  const load = useCallback(() => {
    setLoading(true); setError("");
    const params = new URLSearchParams(); if (range.start) params.set("start", range.start); if (range.end) params.set("end", range.end);
    void apiFetch(`/calendar-feed/?${params.toString()}`, portfolio ? { headers: { "X-Property-Scope": "portfolio" } } : undefined)
      .then(async (response) => {
        if (!response.ok) throw new Error(await apiErrorMessage(response, "The calendar could not be loaded."));
        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.includes("application/json")) throw new Error("The calendar service returned an unexpected response. Please retry in a moment.");
        const data = await response.json().catch(() => { throw new Error("The calendar data could not be read. Please retry in a moment."); });
        setRows(Array.isArray(data) ? data : (data.results ?? []));
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [portfolio, range.start, range.end]);
  useEffect(() => { queueMicrotask(load); }, [activeProperty?.id, load]);

  const moduleKey = moduleName.toLowerCase() === "portfolio" ? "all" : moduleName.toLowerCase();
  const relevantRows = useMemo(() => rows.filter((row) => (
    (portfolio || moduleKey === "all" || String(row.module) === moduleKey)
    && (moduleFilter === "all" || String(row.module) === moduleFilter)
    && (typeFilter === "all" || String(row.event_type) === typeFilter)
  )), [rows, portfolio, moduleKey, moduleFilter, typeFilter]);
  const modules = [...new Set(rows.map(row => String(row.module ?? "operations")))].sort();
  const types = [...new Set(rows.map(row => String(row.event_type ?? "event")))].sort();
  const borderColors: Record<string, string> = { property: "var(--color-brand-red)", facility: "var(--color-sky)", companion: "var(--color-success)", monitoring: "var(--color-warning)" };
  const calendarEvents = relevantRows.map((row, index) => ({
    id: String(row.id ?? index), title: String(row.title ?? "Untitled event"),
    start: String(row.starts_at), end: row.ends_at ? String(row.ends_at) : undefined,
    allDay: Boolean(row.all_day), url: String(row.source_url ?? ""),
    backgroundColor: String(row.status) === "overdue" ? "var(--color-danger)" : borderColors[String(row.module)] ?? "var(--color-slate-500)",
    borderColor: String(row.status) === "overdue" ? "var(--color-danger)" : borderColors[String(row.module)] ?? "var(--color-slate-500)",
    extendedProps: { subtitle: row.subtitle, propertyName: row.property_name, module: row.module },
  }));

  return (
    <section aria-labelledby="module-calendar-heading">
      <div className="page-head" style={{ marginBottom: 16 }}>
        <div><p className="eyebrow">{moduleName} operations</p><h2 id="module-calendar-heading">Calendar</h2><p className="muted">{portfolio ? "Meetings, inspections and operational events across your accessible projects." : `Meetings, inspections and operational events for ${activeProperty?.name ?? "the current property"}.`}</p></div>
        <span className="status-pill"><CalendarDays size={14} /> {relevantRows.length} events</span>
      </div>
      {portfolio && rows.length > 0 && <Paper variant="outlined" sx={{ p: 1.5, mb: 2, display: "flex", gap: 1.5, flexWrap: "wrap" }}>
        <FormControl size="small" sx={{ minWidth: 170 }}><InputLabel>Module</InputLabel><Select value={moduleFilter} label="Module" onChange={event => setModuleFilter(event.target.value)}><MenuItem value="all">All modules</MenuItem>{modules.map(module => <MenuItem key={module} value={module}>{module.replaceAll("_", " ")}</MenuItem>)}</Select></FormControl>
        <FormControl size="small" sx={{ minWidth: 190 }}><InputLabel>Event type</InputLabel><Select value={typeFilter} label="Event type" onChange={event => setTypeFilter(event.target.value)}><MenuItem value="all">All event types</MenuItem>{types.map(type => <MenuItem key={type} value={type}>{type.replaceAll("_", " ")}</MenuItem>)}</Select></FormControl>
      </Paper>}
      {error ? <ActivityState message={error} onRetry={load} /> : <CalendarWidget events={calendarEvents} loading={loading} onRangeChange={(next) => setRange((current) => current.start === next.start && current.end === next.end ? current : next)} />}
      {!loading && !error && relevantRows.length === 0 && <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", mt: 1 }}>No operational deadlines or appointments fall within this calendar range.</Typography>}
    </section>
  );
}
