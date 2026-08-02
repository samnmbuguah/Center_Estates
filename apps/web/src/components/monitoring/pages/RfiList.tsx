import { useEffect, useState } from "react";
import { useParams } from "@/components/monitoring/react-router-shim";
import { MessageSquareText } from "lucide-react";
import { get, post, patch } from "../api";
import { useAuth } from "../auth";
import { ErrorBanner } from "../components";

const STATUS_COLORS: Record<string, string> = {
  draft: "#6b7280", open: "#d97706", answered: "#16a34a", closed: "#374151", void: "#9ca3af",
};
const PRIORITY_ORDER = ["urgent", "high", "normal", "low"];

export function RfiList() {
  const { id: projectId } = useParams();
  const { can } = useAuth();
  const [rfis, setRfis] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  // Form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", question: "", priority: "normal", category: "", due_date: "" });

  // Detail
  const [detail, setDetail] = useState<any>(null);

  const load = () => {
    setLoading(true);
    const url = projectId ? `/rfis?project_id=${projectId}${filter ? `&status=${filter}` : ""}` : "/rfis";
    get<any[]>(url).then(setRfis).catch(e => setError(e.message)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [projectId, filter]);

  async function createRfi() {
    if (!form.title || !form.question) return;
    try {
      await post("/rfis", { ...form, project_id: projectId });
      setForm({ title: "", question: "", priority: "normal", category: "", due_date: "" });
      setShowForm(false);
      load();
    } catch (e: any) { setError(e.message); }
  }

  async function respond(rfi: any, response: string) {
    if (!response) return;
    try {
      await patch(`/rfis/${rfi.id}`, { response });
      load();
      setDetail(null);
    } catch (e: any) { setError(e.message); }
  }

  async function closeRfi(rfi: any) {
    try {
      await patch(`/rfis/${rfi.id}`, { status: "closed" });
      load();
    } catch (e: any) { setError(e.message); }
  }

  const sorted = [...rfis].sort((a, b) => {
    const ai = PRIORITY_ORDER.indexOf(a.priority);
    const bi = PRIORITY_ORDER.indexOf(b.priority);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>Requests for Information</h2>
          <p className="muted" style={{ fontSize: 13 }}>{rfis.length} RFIs</p>
        </div>
        {can("site.reporting.tickets.manage") && (
          <button className="btn" onClick={() => setShowForm(!showForm)}>
            <MessageSquareText size={16} /> {showForm ? "Cancel" : "New RFI"}
          </button>
        )}
      </div>
      <ErrorBanner message={error} />

      {/* Filter tabs */}
      <div className="row" style={{ gap: 4, marginBottom: 12 }}>
        {["", "open", "answered", "closed"].map(s => (
          <button key={s} className={filter === s ? "btn sm" : "btn ghost sm"} onClick={() => setFilter(s)}>
            {s || "All"}
          </button>
        ))}
      </div>

      {/* New RFI form */}
      {showForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>New RFI</h3>
          <div className="field"><label>Title *</label><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Beam reinforcement details" /></div>
          <div className="field"><label>Question *</label><textarea value={form.question} onChange={e => setForm({ ...form, question: e.target.value })} rows={3} placeholder="Describe what information is needed..." /></div>
          <div className="row" style={{ gap: 8 }}>
            <div className="field" style={{ flex: 1 }}><label>Priority</label>
              <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>
              </select>
            </div>
            <div className="field" style={{ flex: 1 }}><label>Category</label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                <option value="">General</option><option value="structural">Structural</option><option value="architectural">Architectural</option>
                <option value="mep">MEP</option><option value="civil">Civil</option><option value="geotechnical">Geotechnical</option><option value="other">Other</option>
              </select>
            </div>
            <div className="field" style={{ flex: 1 }}><label>Due date</label><input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
          </div>
          <button className="btn" onClick={createRfi} disabled={!form.title || !form.question}>Submit RFI</button>
        </div>
      )}

      {/* RFI list */}
      {loading ? <p className="muted">Loading...</p> : sorted.length === 0 ? <p className="muted">No RFIs found.</p> : (
        <div className="card">
          <table>
            <thead><tr><th>#</th><th>Title</th><th>Priority</th><th>Status</th><th>Category</th><th>Raised</th><th>Due</th><th></th></tr></thead>
            <tbody>
              {sorted.map(r => (
                <tr key={r.id}>
                  <td className="mono">{r.number || r.id.slice(0, 8)}</td>
                  <td><strong>{r.title}</strong></td>
                  <td><span className="badge" style={{ background: r.priority === "urgent" ? "var(--danger)" : r.priority === "high" ? "var(--warning)" : "var(--muted)" }}>{r.priority}</span></td>
                  <td><span className="badge" style={{ background: STATUS_COLORS[r.status] || "var(--muted)" }}>{r.status}</span></td>
                  <td className="muted">{r.category || "—"}</td>
                  <td>{r.raised_by}</td>
                  <td>{r.due_date || "—"}</td>
                  <td>
                    <button className="btn ghost sm" onClick={() => setDetail(detail?.id === r.id ? null : r)}>
                      {detail?.id === r.id ? "Close" : "View"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail panel */}
      {detail && (
        <div className="card" style={{ borderLeft: "4px solid var(--primary)" }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>{detail.title}</h3>
            <span className="badge" style={{ background: STATUS_COLORS[detail.status] }}>{detail.status}</span>
          </div>
          <div className="field"><label>Question</label><p style={{ whiteSpace: "pre-wrap" }}>{detail.question}</p></div>

          {detail.response ? (
            <div className="field">
              <label>Response (by {detail.responded_by})</label>
              <p style={{ whiteSpace: "pre-wrap", background: "var(--surface-2)", padding: 12, borderRadius: 8 }}>{detail.response}</p>
            </div>
          ) : can("site.reporting.tickets.manage") && (
            <div className="field">
              <label>Your Response</label>
              <textarea id="rfi-response" rows={3} placeholder="Type your response..." />
              <button className="btn" style={{ marginTop: 8 }} onClick={() => {
                const el = document.getElementById("rfi-response") as HTMLTextAreaElement;
                respond(detail, el.value);
              }}>Submit Response</button>
            </div>
          )}

          <div className="row" style={{ gap: 8, marginTop: 12 }}>
            <span className="muted">Priority: {detail.priority}</span>
            {detail.category && <span className="muted">Category: {detail.category}</span>}
            {detail.due_date && <span className="muted">Due: {detail.due_date}</span>}
            <span className="muted">Raised by: {detail.raised_by}</span>
          </div>

          {detail.status !== "closed" && can("site.reporting.tickets.manage") && (
            <div className="row" style={{ gap: 8, marginTop: 12 }}>
              {detail.status === "answered" && (
                <button className="btn" onClick={() => closeRfi(detail)}>Close RFI</button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
