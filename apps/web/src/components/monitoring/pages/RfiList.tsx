import { useEffect, useState } from "react";
import { useParams } from "@/components/monitoring/react-router-shim";
import { 
  MessageSquareText, Search, Calendar, 
  AlertTriangle, CheckCircle2, Clock, FileText,
  Archive, TrendingUp, BarChart3
} from "lucide-react";
import { get, post, patch } from "../api";
import { useAuth } from "../auth";
import { ErrorBanner } from "../components";

const STATUS_COLORS: Record<string, string> = {
  draft: "#6b7280", open: "#d97706", answered: "#16a34a", closed: "#374151", void: "#9ca3af",
};
const STATUS_ICONS: Record<string, any> = {
  draft: FileText, open: AlertTriangle, answered: CheckCircle2, closed: Archive, void: Clock,
};
const PRIORITY_ORDER = ["urgent", "high", "normal", "low"];
const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#ef4444", high: "#f97316", normal: "#3b82f6", low: "#6b7280",
};

export function RfiList() {
  const { id: projectId } = useParams();
  const { can } = useAuth();
  const [rfis, setRfis] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "card">("list");

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

  // Calculate statistics
  const stats = {
    total: rfis.length,
    byStatus: rfis.reduce((acc, rfi) => {
      acc[rfi.status] = (acc[rfi.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    byPriority: rfis.reduce((acc, rfi) => {
      acc[rfi.priority] = (acc[rfi.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    overdue: rfis.filter(rfi => rfi.due_date && new Date(rfi.due_date) < new Date() && rfi.status !== "closed").length,
    answered: rfis.filter(rfi => rfi.status === "answered").length,
  };

  // Filter RFIs
  const filteredRfis = rfis.filter(rfi => {
    const matchesStatus = !filter || rfi.status === filter;
    const matchesPriority = !priorityFilter || rfi.priority === priorityFilter;
    const matchesCategory = !categoryFilter || rfi.category === categoryFilter;
    const matchesSearch = !searchQuery || 
      rfi.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rfi.question?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rfi.number?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesPriority && matchesCategory && matchesSearch;
  });

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

      {/* Statistics Dashboard */}
      <div className="grid mb-md" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
        <div className="card card-compact" style={{ borderLeft: "4px solid var(--primary)" }}>
          <div className="row" style={{ gap: 8, alignItems: "center", marginBottom: 8 }}>
            <MessageSquareText size={18} style={{ color: "var(--primary)" }} />
            <span className="muted fs-xs">Total RFIs</span>
          </div>
          <div className="fw-700 fs-24">{stats.total}</div>
        </div>
        
        <div className="card card-compact" style={{ borderLeft: "4px solid #22c55e" }}>
          <div className="row" style={{ gap: 8, alignItems: "center", marginBottom: 8 }}>
            <CheckCircle2 size={18} style={{ color: "#22c55e" }} />
            <span className="muted fs-xs">Answered</span>
          </div>
          <div className="fw-700 fs-24">{stats.answered}</div>
        </div>
        
        <div className="card card-compact" style={{ borderLeft: "4px solid #ef4444" }}>
          <div className="row" style={{ gap: 8, alignItems: "center", marginBottom: 8 }}>
            <AlertTriangle size={18} style={{ color: "#ef4444" }} />
            <span className="muted fs-xs">Overdue</span>
          </div>
          <div className="fw-700 fs-24">{stats.overdue}</div>
        </div>
        
        <div className="card card-compact" style={{ borderLeft: "4px solid #f97316" }}>
          <div className="row" style={{ gap: 8, alignItems: "center", marginBottom: 8 }}>
            <TrendingUp size={18} style={{ color: "#f97316" }} />
            <span className="muted fs-xs">High Priority</span>
          </div>
          <div className="fw-700 fs-24">{stats.byPriority.high || 0}</div>
        </div>
      </div>

      {/* Enhanced Filters */}
      <div className="card mb-md" style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div className="row" style={{ gap: 8, alignItems: "center", flex: 1, minWidth: 200 }}>
            <Search size={16} style={{ color: "var(--muted)" }} />
            <input
              placeholder="Search RFIs..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ flex: 1, minWidth: 0 }}
            />
          </div>
          
          <select 
            value={filter} 
            onChange={e => setFilter(e.target.value)}
            style={{ minWidth: 120 }}
          >
            <option value="">All Statuses</option>
            <option value="open">Open</option>
            <option value="answered">Answered</option>
            <option value="closed">Closed</option>
          </select>
          
          <select 
            value={priorityFilter} 
            onChange={e => setPriorityFilter(e.target.value)}
            style={{ minWidth: 120 }}
          >
            <option value="">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
          
          <select 
            value={categoryFilter} 
            onChange={e => setCategoryFilter(e.target.value)}
            style={{ minWidth: 120 }}
          >
            <option value="">All Categories</option>
            <option value="structural">Structural</option>
            <option value="architectural">Architectural</option>
            <option value="mep">MEP</option>
            <option value="civil">Civil</option>
            <option value="geotechnical">Geotechnical</option>
          </select>
          
          <div className="row" style={{ gap: 8 }}>
            <button 
              className={`btn sm ${viewMode === "list" ? "" : "ghost"}`}
              onClick={() => setViewMode("list")}
            >
              <FileText size={14} />
            </button>
            <button 
              className={`btn sm ${viewMode === "card" ? "" : "ghost"}`}
              onClick={() => setViewMode("card")}
            >
              <BarChart3 size={14} />
            </button>
          </div>
          
          {(filter || priorityFilter || categoryFilter || searchQuery) && (
            <button 
              className="btn ghost sm"
              onClick={() => { setFilter(""); setPriorityFilter(""); setCategoryFilter(""); setSearchQuery(""); }}
            >
              Clear Filters
            </button>
          )}
        </div>
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

      {/* RFI list/card view */}
      {loading ? <p className="muted">Loading...</p> : sorted.length === 0 ? <p className="muted">No RFIs found.</p> : (
        <>
          {viewMode === "list" ? (
            <div className="card">
              <table>
                <thead><tr><th>#</th><th>Title</th><th>Priority</th><th>Status</th><th>Category</th><th>Raised</th><th>Due</th><th></th></tr></thead>
                <tbody>
                  {sorted.map(r => (
                    <tr key={r.id}>
                      <td className="mono">{r.number || r.id.slice(0, 8)}</td>
                      <td><strong>{r.title}</strong></td>
                      <td><span className="badge" style={{ background: PRIORITY_COLORS[r.priority] || "var(--muted)" }}>{r.priority}</span></td>
                      <td><span className="badge" style={{ background: STATUS_COLORS[r.status] || "var(--muted)" }}>{r.status}</span></td>
                      <td className="muted">{r.category || "—"}</td>
                      <td>{r.raised_by}</td>
                      <td style={{ color: r.due_date && new Date(r.due_date) < new Date() && r.status !== "closed" ? "#ef4444" : "inherit" }}>{r.due_date || "—"}</td>
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
          ) : (
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
              {sorted.map(r => {
                const StatusIcon = STATUS_ICONS[r.status] || FileText;
                const isOverdue = r.due_date && new Date(r.due_date) < new Date() && r.status !== "closed";
                
                return (
                  <div 
                    key={r.id}
                    className="card"
                    style={{ 
                      cursor: "pointer",
                      borderLeft: `4px solid ${PRIORITY_COLORS[r.priority] || "var(--muted)"}`,
                      transition: "all 0.2s"
                    }}
                    onClick={() => setDetail(detail?.id === r.id ? null : r)}
                  >
                    <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
                      <div className="row" style={{ gap: 8, alignItems: "center" }}>
                        <StatusIcon size={16} style={{ color: STATUS_COLORS[r.status] }} />
                        <span className="badge" style={{ background: STATUS_COLORS[r.status] || "var(--muted)" }}>{r.status}</span>
                      </div>
                      <span className="badge" style={{ background: PRIORITY_COLORS[r.priority] || "var(--muted)" }}>{r.priority}</span>
                    </div>
                    
                    <h4 style={{ margin: "0 0 8px 0", fontSize: 14 }}>{r.title}</h4>
                    <p className="muted" style={{ fontSize: 12, marginBottom: 12, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {r.question}
                    </p>
                    
                    <div className="row" style={{ gap: 8, fontSize: 11, color: "var(--muted)", marginBottom: 12 }}>
                      {r.category && <span>{r.category}</span>}
                      {r.raised_by && <span>• {r.raised_by}</span>}
                    </div>
                    
                    <div className="row" style={{ justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                      <div className="row" style={{ gap: 8, fontSize: 11 }}>
                        {r.due_date && (
                          <div className="row" style={{ gap: 4, alignItems: "center", color: isOverdue ? "#ef4444" : "var(--muted)" }}>
                            <Calendar size={12} />
                            <span>{r.due_date}</span>
                          </div>
                        )}
                      </div>
                      <button className="btn ghost sm" style={{ fontSize: 11 }}>
                        {detail?.id === r.id ? "Close" : "View Details"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
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
