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
  const relevantRows = useMemo(() => rows.filter((row) => (
    portfolio || moduleKey === "all" || moduleKey === "companion" || String(row.module) === moduleKey
  )), [rows, portfolio, moduleKey]);

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
    <section aria-labelledby="module-tickets-heading">
      <div className="page-head" style={{ marginBottom: 16 }}>
        <div><p className="eyebrow">{moduleName} operations</p><h2 id="module-tickets-heading">Tickets & issues</h2><p className="muted">{portfolio ? "Issues across your accessible projects and operations." : `Issues scoped to ${activeProperty?.name ?? "the current property"}.`}</p></div>
        <span className="status-pill"><CircleAlert size={14} /> {relevantRows.length} visible</span>
      </div>
      {loading ? <ActivityState message="Loading tickets…" onRetry={load} /> : error ? <ActivityState message={error} onRetry={load} /> : relevantRows.length === 0 ? <ActivityState message={activeProperty ? "No open tickets or issues are recorded for this property." : "No open tickets or issues recorded in this organization."} onRetry={load} /> : (
        <div className="data-panel table-scroll"><table className="fc-data-table"><thead><tr><th>Reference</th><th>Title</th><th>Raised by</th><th>Priority</th><th>Status</th><th>Updated</th><th>Action</th></tr></thead><tbody>
          {relevantRows.map((row, index) => (
            <tr key={String(row.id ?? index)} style={{ cursor: "pointer" }} onClick={() => void openTicket(row)}>
              <td className="mono">{String(row.reference ?? row.code ?? `TICKET-${index + 1}`)}</td>
              <td><strong>{String(row.title ?? row.subject ?? row.description ?? "—")}</strong></td>
              <td>{String(row.raised_by ?? "—")}</td>
              <td><span style={{ textTransform: "capitalize", fontWeight: 600 }}>{String(row.priority ?? "—")}</span></td>
              <td><StatusPill value={String(row.status ?? "open")} /></td>
              <td>{formatDate(row.updated_at ?? row.created_at)}</td>
              <td><button type="button" className="btn ghost sm" onClick={(e) => { e.stopPropagation(); void openTicket(row); }}>Open</button></td>
            </tr>
          ))}
        </tbody></table></div>
      )}
      {selected && (
        <DetailDrawer title={`${String(detail?.reference ?? selected.reference ?? "Ticket")} · ${String(detail?.title ?? detail?.subject ?? selected.title ?? "Issue")}`} width={580} onClose={() => { setSelected(null); setDetail(null); setDetailError(""); }}>
          {detailLoading && !detail ? <ActivityState message="Loading ticket details…" onRetry={() => void refreshDetail()} /> : (
            <Stack spacing={2.5}>
              {detailError && <Alert severity="error">{detailError}</Alert>}
              {detail && <>
                {/* Header Status & Tags */}
                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", alignItems: "center" }}>
                  <StatusPill value={String(detail.status ?? selected.status ?? "open")} />
                  <StatusPill value={String(detail.priority ?? selected.priority ?? "normal")} />
                  {detail.module || selected.module ? <Chip size="small" label={String(detail.module ?? selected.module).toUpperCase()} sx={{ fontWeight: 700 }} /> : null}
                  {detail.category || detail.issue_category ? <Chip size="small" variant="outlined" label={String(detail.category || detail.issue_category)} /> : null}
                </Stack>

                {/* Description Box */}
                {(detail.description || detail.subject || detail.title || detail.body) && (
                  <Paper variant="outlined" sx={{ p: 2, bgcolor: "var(--surface-sunken)", borderColor: "var(--border)" }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: "uppercase" }}>Issue Description</Typography>
                    <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: "pre-wrap", color: "var(--text-primary)" }}>
                      {String(detail.description || detail.body || detail.title || detail.subject || "")}
                    </Typography>
                  </Paper>
                )}

                {/* Key Facts Grid */}
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1.5, p: 2, bgcolor: "var(--surface-2)", borderRadius: 2, border: "1px solid var(--border)" }}>
                  <TicketFact label="Property" value={detail.property_name || selected.property_name} />
                  <TicketFact label="Location / Unit" value={detail.location_detail || detail.location || detail.unit_code} />
                  <TicketFact label="Raised by" value={detail.raised_by || detail.requester_name || detail.tenant_name || detail.created_by_name || selected.raised_by} />
                  <TicketFact label="Assigned to" value={detail.assigned_to || detail.assigned_to_name || detail.assigned_team || selected.assigned_to} />
                  <TicketFact label="Created" value={formatDate(detail.created_at || detail.submitted_at || selected.created_at)} />
                  <TicketFact label="Due / SLA" value={formatDate(detail.sla_due_at || detail.response_due_at || detail.due_date)} />
                </Box>

                {/* Evidence / Attachments */}
                {(Boolean(detail.photo_url) || (Array.isArray(detail.photos) && detail.photos.length > 0)) && (
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>ATTACHED EVIDENCE</Typography>
                    <Box sx={{ mt: 1, display: "flex", gap: 1, flexWrap: "wrap" }}>
                      {detail.photo_url ? (
                        <Button component="a" href={String(detail.photo_url)} target="_blank" rel="noreferrer" variant="outlined" size="small">
                          View evidence photo ↗
                        </Button>
                      ) : null}
                      {Array.isArray(detail.photos) && detail.photos.map((ph: any, i: number) => (
                        <Button key={i} component="a" href={String(ph.url || ph.file || ph)} target="_blank" rel="noreferrer" variant="outlined" size="small">
                          Attachment #{i + 1} ↗
                        </Button>
                      ))}
                    </Box>
                  </Box>
                )}

                {/* Threaded Conversations (for feedback or messages) */}
                {Array.isArray(detail.messages) && (
                  <>
                    <Divider />
                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Conversation & Activity</Typography>
                    <Stack spacing={1}>
                      {detail.messages.map((message: ActivityRecord, index: number) => (
                        <Paper key={String(message.id ?? index)} variant="outlined" sx={{ p: 1.5 }}>
                          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{String(message.message ?? "")}</Typography>
                          <Typography variant="caption" color="text.secondary">{String(message.sender_name ?? "System")} · {formatDate(message.created_at)}</Typography>
                        </Paper>
                      ))}
                      {detail.messages.length === 0 && (
                        <Typography variant="body2" color="text.secondary">No messages have been recorded.</Typography>
                      )}
                    </Stack>
                    <TextField label="Add an update or response" value={reply} onChange={(event) => setReply(event.target.value)} multiline minRows={2} fullWidth />
                    <Button variant="contained" disabled={saving || !reply.trim()} onClick={() => void sendReply()}>Send Update</Button>
                  </>
                )}

                {/* Direct Jump & Workflow Action Center */}
                <Divider />
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Workflow & Actions</Typography>

                {/* Dispatched WO Alert */}
                {Boolean((detail.metadata && typeof detail.metadata === "object" && (detail.metadata as ActivityRecord).work_order_number) || detail.work_order) && (
                  <Alert severity="success" action={<Button size="small" onClick={() => router.push("/facility?tab=work-orders")}>Open Work Orders</Button>}>
                    Dispatched as Work Order {String((detail.metadata as ActivityRecord)?.work_order_number || (detail.work_order as any)?.number || detail.work_order || "")}.
                  </Alert>
                )}

                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                  {/* Service Request Actions */}
                  {ticketType === "service-request" && (
                    <>
                      {String(detail.status) === "new" && (
                        <>
                          <Button variant="contained" color="success" disabled={saving} onClick={() => void updateStatus("approved")}>Approve Request</Button>
                          <Button variant="outlined" color="error" disabled={saving} onClick={() => void updateStatus("rejected")}>Reject</Button>
                        </>
                      )}
                      {!detail.work_order && ["new", "approved"].includes(String(detail.status)) && (
                        <Button variant="contained" disabled={saving} onClick={() => void createWorkOrder()}>Convert to Work Order</Button>
                      )}
                      {["assigned", "in_progress"].includes(String(detail.status)) && (
                        <Button variant="contained" color="success" disabled={saving} onClick={() => void updateStatus("resolved")}>Mark Resolved</Button>
                      )}
                      <Button variant="outlined" onClick={() => router.push("/facility?tab=service-requests")}>
                        View in Facility Helpdesk ↗
                      </Button>
                    </>
                  )}

                  {/* Work Order Actions */}
                  {ticketType === "work-order" && (
                    <>
                      <Button variant="contained" onClick={() => router.push("/facility?tab=work-orders")}>
                        Open in Work Orders ↗
                      </Button>
                    </>
                  )}

                  {/* Task Actions */}
                  {ticketType === "task" && (
                    <>
                      {String(detail.status) !== "in_progress" && String(detail.status) !== "completed" && (
                        <Button variant="outlined" disabled={saving} onClick={() => void updateStatus("in_progress")}>Start Task</Button>
                      )}
                      {String(detail.status) !== "completed" && (
                        <Button variant="contained" color="success" disabled={saving} onClick={() => void updateStatus("completed")}>Mark Completed</Button>
                      )}
                      {String(detail.status) === "completed" && (
                        <Button variant="outlined" disabled={saving} onClick={() => void updateStatus("pending")}>Reopen Task</Button>
                      )}
                      <Button variant="outlined" onClick={() => router.push("/companion")}>
                        Open in Companion ↗
                      </Button>
                    </>
                  )}

                  {/* Feedback Thread Actions */}
                  {ticketType === "feedback" && (
                    <>
                      {String(detail.status) !== "in_progress" && <Button variant="outlined" disabled={saving} onClick={() => void updateStatus("in_progress")}>Start Work</Button>}
                      {String(detail.status) !== "resolved" && <Button variant="outlined" color="success" disabled={saving} onClick={() => void updateStatus("resolved")}>Mark Resolved</Button>}
                      {String(detail.status) === "resolved" && <Button variant="contained" color="success" disabled={saving} onClick={() => void updateStatus("closed")}>Confirm & Close</Button>}
                      {["resolved", "closed"].includes(String(detail.status)) && <Button variant="outlined" disabled={saving} onClick={() => void updateStatus("open")}>Reopen</Button>}
                      {!((detail.metadata as ActivityRecord)?.work_order_number) && (
                        <Button variant="contained" disabled={saving} onClick={() => void createWorkOrder()}>Create & Dispatch Work Order</Button>
                      )}
                    </>
                  )}
                </Stack>
              </>}
            </Stack>
          )}
        </DetailDrawer>
      )}
    </section>
  );
}

function TicketFact({ label, value }: { label: string; value: unknown }) {
  return <Box><Typography variant="caption" color="text.secondary">{label}</Typography><Typography variant="body2" sx={{ fontWeight: 600 }}>{value ? String(value) : "—"}</Typography></Box>;
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
  const borderColors: Record<string, string> = { property: "#e23b3b", facility: "#0284c7", companion: "#16a34a", monitoring: "#d97706" };
  const calendarEvents = relevantRows.map((row, index) => ({
    id: String(row.id ?? index), title: String(row.title ?? "Untitled event"),
    start: String(row.starts_at), end: row.ends_at ? String(row.ends_at) : undefined,
    allDay: Boolean(row.all_day), url: String(row.source_url ?? ""),
    backgroundColor: String(row.status) === "overdue" ? "#dc2626" : borderColors[String(row.module)] ?? "#64748b",
    borderColor: String(row.status) === "overdue" ? "#dc2626" : borderColors[String(row.module)] ?? "#64748b",
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
