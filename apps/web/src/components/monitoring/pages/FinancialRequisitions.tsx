"use client";

import { useEffect, useState } from "react";
import { Check, ClipboardList, Plus, ThumbsDown, ThumbsUp } from "lucide-react";
import { createRequisition, decideRequisition, fetchRequisitions, reviewRequisition, type Requisition } from "../api";
import { useAuth } from "../auth";
import { ErrorBanner } from "../components";
import { useWorkspace } from "../context/WorkspaceContext";

const money = (value: string) => `KES ${Number(value || 0).toLocaleString()}`;

export function FinancialRequisitions() {
  const { activeProjectId, activeProject } = useWorkspace();
  const { can } = useAuth();
  const [items, setItems] = useState<Requisition[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | "new" | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", amount: "", description: "" });

  const load = async () => {
    if (!activeProjectId) return setItems([]);
    try {
      const rows = await fetchRequisitions();
      setItems(rows.filter((row) => row.project_id === activeProjectId));
    } catch (e) { setError((e as Error).message); }
  };
  useEffect(() => { void load(); }, [activeProjectId]);

  const create = async () => {
    if (!activeProjectId || !form.title.trim() || Number(form.amount) <= 0) {
      setError("Enter a title and a positive amount."); return;
    }
    setBusy("new"); setError(null);
    try {
      await createRequisition({ ...form, project_id: activeProjectId });
      setForm({ title: "", amount: "", description: "" }); setShowForm(false); await load();
    } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  };
  const act = async (row: Requisition, action: "review" | "approved" | "rejected") => {
    setBusy(row.id); setError(null);
    try { action === "review" ? await reviewRequisition(row.id) : await decideRequisition(row.id, action); await load(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  };

  if (!activeProjectId) return <div className="card" style={{ padding: 24 }}>Select a project to view its financial requisitions.</div>;
  const pending = items.filter((x) => ["submitted", "reviewed"].includes(x.status)).length;
  return <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
      <div><div className="muted" style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase" }}>Financial control</div><h2 style={{ margin: "4px 0" }}>Financial Requisitions</h2><div className="muted">{activeProject?.name} · {pending} awaiting action</div></div>
      {can("finance.admin") && <button className="btn primary" onClick={() => setShowForm((v) => !v)}><Plus size={15}/> New requisition</button>}
    </div>
    <ErrorBanner message={error}/>
    {showForm && <div className="card" style={{ padding: 16 }}><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}><input placeholder="Purpose / title" value={form.title} onChange={(e) => setForm({...form,title:e.target.value})}/><input type="number" min="0" placeholder="Amount (KES)" value={form.amount} onChange={(e) => setForm({...form,amount:e.target.value})}/><input placeholder="Description" value={form.description} onChange={(e) => setForm({...form,description:e.target.value})}/></div><button className="btn primary" style={{ marginTop: 10 }} disabled={busy === "new"} onClick={create}><Check size={14}/> Submit for review</button></div>}
    <div className="data-panel"><div className="table-scroll"><table className="fc-data-table"><thead><tr><th>Purpose</th><th>Amount</th><th>Raised by</th><th>Status</th><th>Next action</th></tr></thead><tbody>
      {items.map((row) => <tr key={row.id}><td><strong>{row.title}</strong></td><td className="mono">{money(row.amount)}</td><td>{row.raised_by || "—"}</td><td><span className="status-pill">{row.status}</span></td><td>{can("finance.admin") && row.status === "submitted" ? <button className="btn sm" disabled={busy === row.id} onClick={() => act(row,"review")}><ClipboardList size={13}/> Review</button> : can("finance.admin") && row.status === "reviewed" ? <div style={{display:"flex",gap:6}}><button className="btn sm" disabled={busy===row.id} onClick={() => act(row,"approved")}><ThumbsUp size={13}/> Approve</button><button className="btn ghost sm" disabled={busy===row.id} onClick={() => act(row,"rejected")}><ThumbsDown size={13}/> Reject</button></div> : <span className="muted">Complete</span>}</td></tr>)}
      {!items.length && <tr><td colSpan={5} style={{ textAlign:"center", padding:32 }} className="muted">No financial requisitions for this project.</td></tr>}
    </tbody></table></div></div>
  </div>;
}
