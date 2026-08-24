import { useEffect, useState } from "react";
import { useParams } from "@/components/monitoring/react-router-shim";
import { 
  Users, Briefcase, Plus, Search, Filter, Calendar, 
  DollarSign, CheckCircle2, AlertTriangle, FileText,
  TrendingUp, BarChart3, Trash2, Eye, Edit
} from "lucide-react";

import { get, patch, post, del } from "../api";
import { useAuth } from "../auth";
import { ErrorBanner, ConfirmModal } from "../components";
import type { Subcontractor, WorkOrder } from "../api-types";

const SECTION_CHOICES = [
  "preliminaries", "substructure", "superstructure", "finishes",
  "mep", "external", "general",
];

const STATUS_COLORS: Record<string, string> = {
  draft: "#6b7280", issued: "#3b82f6", completed: "#22c55e", closed: "#374151", cancelled: "#ef4444",
};

const STATUS_ICONS: Record<string, any> = {
  draft: FileText, issued: Briefcase, completed: CheckCircle2, closed: Users, cancelled: AlertTriangle,
};

export function Subcontractors() {
  const { id = "" } = useParams();
  const { can } = useAuth();
  const [subs, setSubs] = useState<Subcontractor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [subForm, setSubForm] = useState({ name: "", contact_person: "", email: "", phone: "" });
  const [expandedSub, setExpandedSub] = useState<number | null>(null);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [woForm, setWoForm] = useState({
    subcontractor_id: "", order_number: "", boq_section: "general",
    description: "", unit_rate: "", quantity_cap: "",
  });
  const [showWoForm, setShowWoForm] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  
  // Enhanced filtering and view mode
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "card">("list");

  const loadSubs = () => {
    setLoading(true);
    get<Subcontractor[]>(`/projects/${id}/subcontractors`).then(setSubs).catch(e => setError(e.message)).finally(() => setLoading(false));
  };
  const loadWorkOrders = () => {
    get<WorkOrder[]>(`/projects/${id}/work-orders`).then(setWorkOrders).catch(e => setError(e.message));
  };
  useEffect(() => { loadSubs(); loadWorkOrders(); }, [id]);

  // Calculate statistics
  const stats = {
    totalSubs: subs.length,
    totalWorkOrders: workOrders.length,
    totalValue: workOrders.reduce((sum, wo) => sum + Number(wo.total_value), 0),
    certifiedValue: workOrders.reduce((sum, wo) => sum + Number(wo.certified_value), 0),
    paidValue: workOrders.reduce((sum, wo) => sum + Number(wo.paid_value), 0),
    byStatus: workOrders.reduce((acc, wo) => {
      acc[wo.status] = (acc[wo.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    bySection: workOrders.reduce((acc, wo) => {
      acc[wo.boq_section] = (acc[wo.boq_section] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };

  // Filter work orders
  const filteredWorkOrders = workOrders.filter(wo => {
    const matchesStatus = !statusFilter || wo.status === statusFilter;
    const matchesSection = !sectionFilter || wo.boq_section === sectionFilter;
    const matchesSearch = !searchQuery || 
      wo.order_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      wo.subcontractor_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      wo.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSection && matchesSearch;
  });

  const createSub = () => {
    if (!subForm.name.trim()) return;
    setError(null);
    post(`/projects/${id}/subcontractors`, subForm).then(() => {
      setSubForm({ name: "", contact_person: "", email: "", phone: "" });
      loadSubs();
    }).catch(e => setError(e.message));
  };

  const deleteSub = (subId: number) => {
    del(`/subcontractors/${subId}`).then(() => { loadSubs(); loadWorkOrders(); }).catch(e => setError(e.message));
  };

  const toggleExpand = (subId: number) => {
    setExpandedSub(expandedSub === subId ? null : subId);
  };

  const createWorkOrder = () => {
    setError(null);
    post(`/projects/${id}/work-orders`, woForm).then(() => {
      setWoForm({ subcontractor_id: "", order_number: "", boq_section: "general", description: "", unit_rate: "", quantity_cap: "" });
      setShowWoForm(false);
      loadWorkOrders();
    }).catch(e => setError(e.message));
  };

  const updateWo = (woId: number, data: Record<string, unknown>) => {
    patch(`/work-orders/${woId}`, data).then(loadWorkOrders).catch(e => setError(e.message));
  };

  const certifyQuantity = (wo: WorkOrder) => {
    const qty = prompt("Certified quantity:", wo.certified_quantity);
    if (qty === null) return;
    updateWo(wo.id, { certified_quantity: qty });
  };

  const recordPayment = (wo: WorkOrder) => {
    const paid = prompt("Paid value:", wo.paid_value);
    if (paid === null) return;
    updateWo(wo.id, { paid_value: paid });
  };

  const statusBadge = (s: string) => {
    const colors: Record<string, string> = { draft: "#888", issued: "#2196F3", completed: "#4CAF50", closed: "#666" };
    return <span style={{ background: colors[s] || "#888", color: "#fff", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{s}</span>;
  };

  const formatMoney = (v: number) => Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const subWorkOrders = (subId: number) => workOrders.filter(wo => wo.subcontractor_id === subId);

  return (
    <div>
      <h2>Subcontractors & Work Orders</h2>
      <ErrorBanner message={error} />

      {/* Statistics Dashboard */}
      <div className="grid mb-md" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
        <div className="card card-compact" style={{ borderLeft: "4px solid var(--primary)" }}>
          <div className="row" style={{ gap: 8, alignItems: "center", marginBottom: 8 }}>
            <Users size={18} style={{ color: "var(--primary)" }} />
            <span className="muted fs-xs">Subcontractors</span>
          </div>
          <div className="fw-700 fs-24">{stats.totalSubs}</div>
        </div>
        
        <div className="card card-compact" style={{ borderLeft: "4px solid #3b82f6" }}>
          <div className="row" style={{ gap: 8, alignItems: "center", marginBottom: 8 }}>
            <Briefcase size={18} style={{ color: "#3b82f6" }} />
            <span className="muted fs-xs">Work Orders</span>
          </div>
          <div className="fw-700 fs-24">{stats.totalWorkOrders}</div>
        </div>
        
        <div className="card card-compact" style={{ borderLeft: "4px solid #22c55e" }}>
          <div className="row" style={{ gap: 8, alignItems: "center", marginBottom: 8 }}>
            <DollarSign size={18} style={{ color: "#22c55e" }} />
            <span className="muted fs-xs">Total Value</span>
          </div>
          <div className="fw-700 fs-24">{formatMoney(stats.totalValue)}</div>
        </div>
        
        <div className="card card-compact" style={{ borderLeft: "4px solid #f97316" }}>
          <div className="row" style={{ gap: 8, alignItems: "center", marginBottom: 8 }}>
            <CheckCircle2 size={18} style={{ color: "#f97316" }} />
            <span className="muted fs-xs">Certified</span>
          </div>
          <div className="fw-700 fs-24">{formatMoney(stats.certifiedValue)}</div>
        </div>
      </div>

      {/* Enhanced Filters */}
      <div className="card mb-md" style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div className="row" style={{ gap: 8, alignItems: "center", flex: 1, minWidth: 200 }}>
            <Search size={16} style={{ color: "var(--muted)" }} />
            <input
              placeholder="Search work orders..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ flex: 1, minWidth: 0 }}
            />
          </div>
          
          <select 
            value={statusFilter} 
            onChange={e => setStatusFilter(e.target.value)}
            style={{ minWidth: 120 }}
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="issued">Issued</option>
            <option value="completed">Completed</option>
            <option value="closed">Closed</option>
          </select>
          
          <select 
            value={sectionFilter} 
            onChange={e => setSectionFilter(e.target.value)}
            style={{ minWidth: 120 }}
          >
            <option value="">All Sections</option>
            {SECTION_CHOICES.map(sc => <option key={sc} value={sc}>{sc}</option>)}
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
          
          {(statusFilter || sectionFilter || searchQuery) && (
            <button 
              className="btn ghost sm"
              onClick={() => { setStatusFilter(""); setSectionFilter(""); setSearchQuery(""); }}
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {can("finance.admin") && (
        <div className="card">
          <h3>New Subcontractor</h3>
          <div className="row wrap" style={{ gap: 8 }}>
            <input placeholder="Name *" value={subForm.name} onChange={e => setSubForm({ ...subForm, name: e.target.value })} autoFocus />
            <input placeholder="Contact person" value={subForm.contact_person} onChange={e => setSubForm({ ...subForm, contact_person: e.target.value })} />
            <input placeholder="Email" value={subForm.email} onChange={e => setSubForm({ ...subForm, email: e.target.value })} />
            <input placeholder="Phone" value={subForm.phone} onChange={e => setSubForm({ ...subForm, phone: e.target.value })} />
            <button className="btn" onClick={createSub}>Add</button>
          </div>
        </div>
      )}

      {loading ? <p className="muted">Loading...</p> : (
        <div className="card">
          <table>
            <thead><tr><th>Name</th><th>Contact</th><th>Email</th><th>Phone</th><th>Work Orders</th><th></th></tr></thead>
            <tbody>
              {subs.map(sub => {
                const wos = subWorkOrders(sub.id);
                const isExpanded = expandedSub === sub.id;
                return (
                  <tr key={sub.id} style={{ cursor: "pointer" }} onClick={() => toggleExpand(sub.id)}>
                    <td><strong>{sub.name}</strong></td>
                    <td>{sub.contact_person || "—"}</td>
                    <td>{sub.email || "—"}</td>
                    <td>{sub.phone || "—"}</td>
                    <td>{wos.length}</td>
                    <td>
                      {can("finance.admin") && (
                        <button className="btn ghost sm" onClick={e => { e.stopPropagation(); setConfirmDeleteId(sub.id); }} style={{ color: "red" }}>Delete</button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {subs.length === 0 && <tr><td colSpan={6} className="empty">No subcontractors.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <h3>Work Orders</h3>
        {can("finance.admin") && (
          <button className="btn sm" onClick={() => setShowWoForm(!showWoForm)} style={{ marginBottom: 8 }}>
            {showWoForm ? "Cancel" : "New Work Order"}
          </button>
        )}
        {showWoForm && (
          <div className="row wrap" style={{ gap: 8, marginBottom: 12 }}>
            <select value={woForm.subcontractor_id} onChange={e => setWoForm({ ...woForm, subcontractor_id: e.target.value })}>
              <option value="">Select sub...</option>
              {subs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input placeholder="Order #" value={woForm.order_number} onChange={e => setWoForm({ ...woForm, order_number: e.target.value })} />
            <select value={woForm.boq_section} onChange={e => setWoForm({ ...woForm, boq_section: e.target.value })}>
              {SECTION_CHOICES.map(sc => <option key={sc} value={sc}>{sc}</option>)}
            </select>
            <input placeholder="Description" value={woForm.description} onChange={e => setWoForm({ ...woForm, description: e.target.value })} />
            <input placeholder="Unit rate" type="number" value={woForm.unit_rate} onChange={e => setWoForm({ ...woForm, unit_rate: e.target.value })} />
            <input placeholder="Qty cap" type="number" value={woForm.quantity_cap} onChange={e => setWoForm({ ...woForm, quantity_cap: e.target.value })} />
            <button className="btn" onClick={createWorkOrder}>Create</button>
          </div>
        )}
        
        {viewMode === "list" ? (
          <table>
            <thead><tr><th>Order #</th><th>Subcontractor</th><th>Section</th><th>Rate</th><th>Qty Cap</th><th>Total</th><th>Certified</th><th>Paid</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {filteredWorkOrders.map(wo => {
                const StatusIcon = STATUS_ICONS[wo.status] || FileText;
                return (
                  <tr key={wo.id}>
                    <td className="mono">{wo.order_number}</td>
                    <td>{wo.subcontractor_name}</td>
                    <td>{wo.boq_section}</td>
                    <td className="mono">{formatMoney(Number(wo.unit_rate))}</td>
                    <td className="mono">{wo.quantity_cap ? Number(wo.quantity_cap).toLocaleString() : "—"}</td>
                    <td className="mono">{formatMoney(Number(wo.total_value))}</td>
                    <td className="mono">{formatMoney(Number(wo.certified_value))} ({wo.certified_quantity})</td>
                    <td className="mono">{formatMoney(Number(wo.paid_value))}</td>
                    <td>
                      <div className="row" style={{ gap: 8, alignItems: "center" }}>
                        <StatusIcon size={14} style={{ color: STATUS_COLORS[wo.status] }} />
                        <span className="badge" style={{ background: STATUS_COLORS[wo.status] }}>{wo.status}</span>
                      </div>
                    </td>
                    <td>
                      {can("finance.admin") && (
                        <>
                          {wo.status === "draft" && <button className="btn ghost sm" onClick={() => updateWo(wo.id, { status: "issued" })}>Issue</button>}
                          {wo.status === "issued" && <button className="btn ghost sm" onClick={() => updateWo(wo.id, { status: "completed" })}>Complete</button>}
                          {wo.status === "completed" && <button className="btn ghost sm" onClick={() => updateWo(wo.id, { status: "closed" })}>Close</button>}
                          <button className="btn ghost sm" onClick={() => certifyQuantity(wo)}>Certify</button>
                          <button className="btn ghost sm" onClick={() => recordPayment(wo)}>Pay</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredWorkOrders.length === 0 && <tr><td colSpan={10} className="empty">No work orders found matching your filters.</td></tr>}
            </tbody>
          </table>
        ) : (
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
            {filteredWorkOrders.map(wo => {
              const StatusIcon = STATUS_ICONS[wo.status] || FileText;
              return (
                <div 
                  key={wo.id}
                  className="card"
                  style={{ 
                    borderLeft: `4px solid ${STATUS_COLORS[wo.status]}`,
                    transition: "all 0.2s"
                  }}
                >
                  <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
                    <div className="row" style={{ gap: 8, alignItems: "center" }}>
                      <StatusIcon size={16} style={{ color: STATUS_COLORS[wo.status] }} />
                      <span className="badge" style={{ background: STATUS_COLORS[wo.status] }}>{wo.status}</span>
                    </div>
                    <span className="mono" style={{ fontSize: 12 }}>{wo.order_number}</span>
                  </div>
                  
                  <h4 style={{ margin: "0 0 8px 0", fontSize: 14 }}>{wo.description || wo.boq_section}</h4>
                  
                  <div className="row" style={{ gap: 8, fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
                    <span>{wo.subcontractor_name}</span>
                    <span>•</span>
                    <span>{wo.boq_section}</span>
                  </div>
                  
                  <div className="grid" style={{ gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: 12 }}>
                    <div>
                      <div className="muted fs-xs mb-xs">Total Value</div>
                      <div className="fw-700">{formatMoney(Number(wo.total_value))}</div>
                    </div>
                    <div>
                      <div className="muted fs-xs mb-xs">Certified</div>
                      <div className="fw-700">{formatMoney(Number(wo.certified_value))}</div>
                    </div>
                    <div>
                      <div className="muted fs-xs mb-xs">Paid</div>
                      <div className="fw-700">{formatMoney(Number(wo.paid_value))}</div>
                    </div>
                    <div>
                      <div className="muted fs-xs mb-xs">Quantity</div>
                      <div className="fw-700">{wo.certified_quantity} / {wo.quantity_cap || "—"}</div>
                    </div>
                  </div>
                  
                  {can("finance.admin") && (
                    <div className="row" style={{ gap: 8, flexWrap: "wrap", paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                      {wo.status === "draft" && <button className="btn sm" onClick={() => updateWo(wo.id, { status: "issued" })}>Issue</button>}
                      {wo.status === "issued" && <button className="btn sm" onClick={() => updateWo(wo.id, { status: "completed" })}>Complete</button>}
                      {wo.status === "completed" && <button className="btn sm" onClick={() => updateWo(wo.id, { status: "closed" })}>Close</button>}
                      <button className="btn ghost sm" onClick={() => certifyQuantity(wo)}>Certify</button>
                      <button className="btn ghost sm" onClick={() => recordPayment(wo)}>Pay</button>
                    </div>
                  )}
                </div>
              );
            })}
            
            {filteredWorkOrders.length === 0 && (
              <div className="card" style={{ gridColumn: "1 / -1", textAlign: "center", padding: 40 }}>
                <Briefcase size={48} style={{ color: "var(--muted)", marginBottom: 16 }} />
                <p className="muted">No work orders found matching your filters.</p>
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmModal
        open={confirmDeleteId !== null}
        title="Delete subcontractor"
        message="Delete this subcontractor?"
        confirmLabel="Delete"
        onConfirm={() => { if (confirmDeleteId !== null) deleteSub(confirmDeleteId); setConfirmDeleteId(null); }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
