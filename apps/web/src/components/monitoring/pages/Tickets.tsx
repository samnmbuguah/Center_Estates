import { useEffect, useMemo, useState, type MouseEvent } from "react";

import { Download, MessageCircle, Paperclip, Trash2, X } from "lucide-react";

import {
  acknowledgeTicket,
  createTicket,
  deleteTicket,
  fetchProject,
  fetchProjects,
  fetchTickets,
  get,
  mediaUrl,
  post,
  updateTicket,
} from "../api";
import { useAuth } from "../auth";
import { ErrorBanner, ConfirmModal } from "../components";
import { pinStyle, relativePin, type PinPoint } from "../lib/pins";

const PRIORITY_COLOR: Record<string, string> = {
  urgent: "var(--danger)", high: "var(--warning)", normal: "var(--muted)", low: "var(--muted)",
};
const RISK_COLOR: Record<string, string> = {
  high: "var(--danger)", medium: "var(--warning)", low: "var(--muted)",
};

interface DrawingDoc {
  id: number;
  doc_type: string;
  title: string;
  latest_url: string | null;
}

interface CommentRow {
  id: number; ticket_id: number; author: string; body: string;
  attachment_url: string; attachment_name: string; created_at: number;
}

export function Tickets() {
  const { can } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("normal");
  const [risk, setRisk] = useState("medium");
  const [sensitivity, setSensitivity] = useState("normal");
  const [due, setDue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteTicketId, setConfirmDeleteTicketId] = useState<number | null>(null);

  // Comment thread state
  const [openTicketId, setOpenTicketId] = useState<number | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentFile, setCommentFile] = useState<File | null>(null);
  const [submittingComment, setSubmittingComment] = useState(false);

  // Plan view (Fieldwire-style pinned defects)
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [planProjectId, setPlanProjectId] = useState("");
  const [drawings, setDrawings] = useState<DrawingDoc[]>([]);
  const [drawingId, setDrawingId] = useState<number | null>(null);
  const [pendingPin, setPendingPin] = useState<PinPoint | null>(null);
  const [pinTitle, setPinTitle] = useState("");

  const load = () => {
    setLoading(true);
    fetchTickets().then((data: any) => {
      setRows(Array.isArray(data) ? data : (data.results ?? []));
    }).catch((e) => setError(e.message)).finally(() => setLoading(false));
  };
  const exportCsv = () => {
    const data = [["Title", "Priority", "Risk", "Status", "Due date", "Assigned to"], ...rows.map(t => [t.title, t.priority, t.risk_level, t.status, t.due_date || "", t.assigned_to || ""] )];
    const csv = data.map(row => row.map(v => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "ticket-register.csv"; a.click();
  };
  useEffect(() => {
    load();
    fetchProjects().then(setProjects).catch(() => {});
  }, []);

  useEffect(() => {
    setDrawings([]);
    setDrawingId(null);
    setPendingPin(null);
    if (!planProjectId) return;
    fetchProject(planProjectId)
      .then((p: { documents?: DrawingDoc[] }) => {
        const docs = (p.documents ?? []).filter((d) => d.latest_url);
        setDrawings(docs);
        const firstDrawing = docs.find((d) => d.doc_type === "drawing") ?? docs[0];
        if (firstDrawing) setDrawingId(firstDrawing.id);
      })
      .catch((e) => setError((e as Error).message));
  }, [planProjectId]);

  const drawing = drawings.find((d) => d.id === drawingId) ?? null;
  const pinned = useMemo(
    () => rows.filter((t) => t.plan_document_id === drawingId && t.pin_x != null && t.pin_y != null),
    [rows, drawingId],
  );

  function onPlanClick(e: MouseEvent<HTMLDivElement>) {
    if (!can("site.reporting.tickets.manage") || !drawing) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setPendingPin(relativePin(e.clientX, e.clientY, rect));
  }

  async function addPinnedTicket() {
    if (!pendingPin || !drawing || !pinTitle.trim()) return;
    setError(null);
    try {
      await createTicket({
        title: pinTitle.trim(),
        priority,
        project_id: planProjectId,
        plan_document_id: drawing.id,
        pin_x: pendingPin.x,
        pin_y: pendingPin.y,
      });
      setPinTitle("");
      setPendingPin(null);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function add() {
    if (!title.trim()) return;
    setError(null);
    try {
      await createTicket({ title: title.trim(), priority, risk_level: risk, sensitivity, due_date: due });
      setTitle("");
      setDue("");
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function ack(id: number) {
    setError(null);
    try { await acknowledgeTicket(id); load(); } catch (e) { setError((e as Error).message); }
  }

  async function setStatus(id: number, status: string) {
    setError(null);
    try {
      await updateTicket(id, { status });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function loadComments(ticketId: number) {
    setError(null);
    try {
      const data = await get<CommentRow[]>(`/tickets/${ticketId}/comments`);
      setComments(data);
      setOpenTicketId(ticketId);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function addComment() {
    if (!commentText.trim() || !openTicketId) return;
    setSubmittingComment(true);
    setError(null);
    try {
      const payload: any = { body: commentText.trim() };
      if (commentFile) {
        const fd = new FormData();
        fd.append("file", commentFile);
        const uploadRes = await post<any>("/media/upload", fd);
        payload.attachment_url = uploadRes.remote_url;
        payload.attachment_name = commentFile.name;
      }
      await post(`/tickets/${openTicketId}/comments`, payload);
      setCommentText("");
      setCommentFile(null);
      await loadComments(openTicketId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmittingComment(false);
    }
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}><h2>Tickets / Issues</h2><button className="btn ghost sm" onClick={exportCsv}><Download size={14} /> Export CSV</button></div>
      <ErrorBanner message={error} />
      {loading ? <p className="muted">Loading...</p> : (<>
      <div className="card">
        <table>
          <thead><tr><th>Title</th><th>Risk</th><th>Due</th><th>Status</th><th>Raised by</th><th>Assigned to</th><th></th>{can("site.reporting.tickets.manage") && <th></th>}</tr></thead>
          <tbody>
            {rows.map((t) => {
              const overdue = t.due_date && !t.acknowledged_at && t.status !== "resolved" && t.status !== "closed"
                && t.due_date < new Date().toISOString().slice(0, 10);
              return (
              <tr key={t.id}>
                <td>{t.title}</td>
                <td>
                  <span className="badge" style={{ background: RISK_COLOR[t.risk_level] ?? "var(--muted)" }}>
                    {(t.risk_level ?? "medium")}{t.sensitivity === "urgent" ? " · urgent" : ""}
                  </span>
                  {t.escalation_level > 0 && <span className="badge" style={{ background: "var(--danger)", marginLeft: 4 }}>L{t.escalation_level}</span>}
                </td>
                <td style={overdue ? { color: "var(--danger)", fontWeight: 600 } : undefined}>{t.due_date || "—"}</td>
                <td>{t.status}{t.acknowledged_at ? " · ack'd" : ""}</td>
                <td>{t.raised_by}</td>
                <td>{t.assigned_to || "—"}</td>
                <td>
                  <button className="btn ghost sm" onClick={() => openTicketId === t.id ? setOpenTicketId(null) : loadComments(t.id)} title="Comments">
                    <MessageCircle size={14} />
                  </button>
                </td>
                {can("site.reporting.tickets.manage") && (
                  <td>
                    <div className="row" style={{ justifyContent: "flex-end" }}>
                      {!t.acknowledged_at && t.status !== "resolved" && (
                        <button className="btn ghost sm" onClick={() => ack(t.id)}>Acknowledge</button>
                      )}
                      {t.status !== "resolved" && (
                        <button className="btn ghost sm" onClick={() => setStatus(t.id, "resolved")}>Resolve</button>
                      )}
                      <button className="btn ghost sm" title="Delete" onClick={() => setConfirmDeleteTicketId(t.id)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                )}
              </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={8} className="muted">No tickets found.</td></tr>}
          </tbody>
        </table>

        {openTicketId && (
          <div style={{ borderTop: "1px solid var(--border)", marginTop: 12, paddingTop: 12 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h4 style={{ margin: 0 }}>Comments</h4>
              <button className="btn ghost sm" onClick={() => setOpenTicketId(null)}><X size={14} /></button>
            </div>
            {comments.length === 0 && <p className="muted">No comments yet.</p>}
            {comments.map((c) => (
              <div key={c.id} style={{ margin: "8px 0", padding: 8, background: "var(--surface-2, #1e293b)", borderRadius: 8 }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <strong>{c.author}</strong>
                  <span className="muted" style={{ fontSize: 11 }}>{new Date(c.created_at).toLocaleString()}</span>
                </div>
                <div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{c.body}</div>
                {c.attachment_url && (
                  <a href={mediaUrl(c.attachment_url)} target="_blank" rel="noreferrer" className="muted" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                    <Paperclip size={12} /> {c.attachment_name || "Attachment"}
                  </a>
                )}
              </div>
            ))}
            {can("site.reporting.tickets.manage") && (
              <div style={{ marginTop: 8 }}>
                <textarea
                  rows={2}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add a comment…"
                  style={{ width: "100%", resize: "vertical" }}
                />
                <div className="row" style={{ gap: 8, marginTop: 4 }}>
                  <label className="btn ghost sm" style={{ cursor: "pointer" }}>
                    <Paperclip size={14} /> {commentFile ? commentFile.name : "Attach file"}
                    <input type="file" style={{ display: "none" }} onChange={(e) => setCommentFile(e.target.files?.[0] ?? null)} />
                  </label>
                  {commentFile && <button className="btn ghost sm" onClick={() => setCommentFile(null)}><X size={14} /></button>}
                  <button className="btn sm" disabled={!commentText.trim() || submittingComment} onClick={addComment}>
                    {submittingComment ? "Posting…" : "Post"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {can("site.reporting.tickets.manage") && (
        <div className="card row" style={{ flexWrap: "wrap", gap: 8 }}>
          <input placeholder="New ticket title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          <select aria-label="Risk level" value={risk} onChange={(e) => setRisk(e.target.value)}>
            <option value="low">Risk: Low</option><option value="medium">Risk: Medium</option>
            <option value="high">Risk: High</option>
          </select>
          <select aria-label="Sensitivity" value={sensitivity} onChange={(e) => setSensitivity(e.target.value)}>
            <option value="normal">Normal</option><option value="urgent">Urgent</option>
          </select>
          <input aria-label="Target resolution date" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          <select aria-label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="low">Low</option><option value="normal">Normal</option>
            <option value="high">High</option><option value="urgent">Urgent</option>
          </select>
          <button className="btn" onClick={add}>Raise ticket</button>
        </div>
      )}

      <div className="card">
        <h3>Plan view</h3>
        <p className="muted">
          Pin defects to a drawing: pick a project document, then click the plan to place a ticket
          exactly where the problem is.
        </p>
        <div className="row">
          <select
            aria-label="Plan project"
            value={planProjectId}
            onChange={(e) => setPlanProjectId(e.target.value)}
          >
            <option value="">Select project…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {drawings.length > 0 && (
            <select
              aria-label="Drawing"
              value={drawingId ?? ""}
              onChange={(e) => setDrawingId(Number(e.target.value))}
            >
              {drawings.map((d) => (
                <option key={d.id} value={d.id}>{d.title} ({d.doc_type})</option>
              ))}
            </select>
          )}
        </div>
        {planProjectId && drawings.length === 0 && (
          <p className="muted">No documents with files on this project yet — upload a drawing in Projects.</p>
        )}
        {drawing?.latest_url && (
          <>
            <div
              onClick={onPlanClick}
              role="img"
              aria-label={`Drawing ${drawing.title} with ${pinned.length} pinned ticket(s)`}
              style={{ position: "relative", display: "inline-block", marginTop: 8, maxWidth: "100%",
                cursor: can("site.reporting.tickets.manage") ? "crosshair" : "default" }}
            >
              <img
                src={mediaUrl(drawing.latest_url)}
                alt={drawing.title}
                style={{ maxWidth: "100%", borderRadius: 8, display: "block" }}
              />
              {pinned.map((t) => (
                <span
                  key={t.id}
                  title={`#${t.id} ${t.title} (${t.priority}, ${t.status})`}
                  style={{
                    position: "absolute", ...pinStyle(t.pin_x, t.pin_y),
                    transform: "translate(-50%, -100%)",
                    fontSize: 22, lineHeight: 1,
                    color: PRIORITY_COLOR[t.priority] ?? "var(--muted)",
                    textShadow: "0 1px 2px rgba(0,0,0,0.6)",
                  }}
                >
                  📍
                </span>
              ))}
              {pendingPin && (
                <span
                  style={{
                    position: "absolute", ...pinStyle(pendingPin.x, pendingPin.y),
                    transform: "translate(-50%, -100%)", fontSize: 22, lineHeight: 1,
                    opacity: 0.6,
                  }}
                >
                  📍
                </span>
              )}
            </div>
            {pendingPin && can("site.reporting.tickets.manage") && (
              <div className="row" style={{ marginTop: 8 }}>
                <input
                  placeholder="Ticket title for this pin"
                  value={pinTitle}
                  onChange={(e) => setPinTitle(e.target.value)}
                />
                <button className="btn" disabled={!pinTitle.trim()} onClick={addPinnedTicket}>
                  Pin ticket here
                </button>
                <button className="btn ghost" onClick={() => setPendingPin(null)}>Cancel</button>
              </div>
            )}
            {pinned.length > 0 && (
              <p className="muted" style={{ marginTop: 6 }}>
                {pinned.length} pinned ticket(s) on this drawing — hover a pin for details.
              </p>
            )}
          </>
        )}
      </div>
    </>)}
      <ConfirmModal
        open={confirmDeleteTicketId !== null}
        title="Delete ticket"
        message="Delete this ticket?"
        confirmLabel="Delete"
        onConfirm={async () => {
          if (confirmDeleteTicketId === null) return;
          setError(null);
          try { await deleteTicket(confirmDeleteTicketId); load(); } catch (e) { setError((e as Error).message); }
          setConfirmDeleteTicketId(null);
        }}
        onCancel={() => setConfirmDeleteTicketId(null)}
      />
    </div>
  );
}
