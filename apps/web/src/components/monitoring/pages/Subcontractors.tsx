import { useEffect, useState } from "react";
import { useParams } from "@/components/monitoring/react-router-shim";

import { get, patch, post, del } from "../api";
import { useAuth } from "../auth";
import { ErrorBanner, ConfirmModal } from "../components";
import type { Subcontractor, WorkOrder } from "../api-types";

const SECTION_CHOICES = [
  "preliminaries", "substructure", "superstructure", "finishes",
  "mep", "external", "general",
];

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

  const loadSubs = () => {
    setLoading(true);
    get<Subcontractor[]>(`/projects/${id}/subcontractors`).then(setSubs).catch(e => setError(e.message)).finally(() => setLoading(false));
  };
  const loadWorkOrders = () => {
    get<WorkOrder[]>(`/projects/${id}/work-orders`).then(setWorkOrders).catch(e => setError(e.message));
  };
  useEffect(() => { loadSubs(); loadWorkOrders(); }, [id]);

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

  const subWorkOrders = (subId: number) => workOrders.filter(wo => wo.subcontractor_id === subId);

  return (
    <div>
      <h2>Subcontractors & Work Orders</h2>
      <ErrorBanner message={error} />

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
        <table>
          <thead><tr><th>Order #</th><th>Subcontractor</th><th>Section</th><th>Rate</th><th>Qty Cap</th><th>Total</th><th>Certified</th><th>Paid</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {workOrders.map(wo => (
              <tr key={wo.id}>
                <td className="mono">{wo.order_number}</td>
                <td>{wo.subcontractor_name}</td>
                <td>{wo.boq_section}</td>
                <td className="mono">{Number(wo.unit_rate).toLocaleString()}</td>
                <td className="mono">{wo.quantity_cap ? Number(wo.quantity_cap).toLocaleString() : "—"}</td>
                <td className="mono">{Number(wo.total_value).toLocaleString()}</td>
                <td className="mono">{Number(wo.certified_value).toLocaleString()} ({wo.certified_quantity})</td>
                <td className="mono">{Number(wo.paid_value).toLocaleString()}</td>
                <td>{statusBadge(wo.status)}</td>
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
            ))}
            {workOrders.length === 0 && <tr><td colSpan={10} className="empty">No work orders.</td></tr>}
          </tbody>
        </table>
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
