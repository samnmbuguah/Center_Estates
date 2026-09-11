import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, ClipboardList } from "lucide-react";
import { fetchMaterialRequisitions, createMaterialRequisition, fetchProjects, fetchItems } from "../api";
import { ErrorBanner } from "../components";
import type { MaterialRequisition, StoreItem } from "../api-types";

type DraftLine = { item: string; quantity: string };

const STATUS_TONE: Record<string, string> = {
  submitted: "var(--color-amber)",
  approved: "var(--color-blue)",
  fulfilled: "var(--color-green)",
  rejected: "var(--color-danger)",
};

export function MaterialRequisitions() {
  const [rows, setRows] = useState<MaterialRequisition[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [items, setItems] = useState<StoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ project: "", reference: "" });
  const [lines, setLines] = useState<DraftLine[]>([{ item: "", quantity: "" }]);
  const [statusFilter, setStatusFilter] = useState("");

  const load = () => {
    setLoading(true);
    fetchMaterialRequisitions().then(setRows).catch((e) => setError(e.message)).finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    fetchProjects().then((p) => setProjects(p.map((x) => ({ id: x.id, name: x.name })))).catch(() => {});
    fetchItems().then(setItems).catch(() => {});
  }, []);

  const itemName = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i.name])), [items]);

  const submit = async () => {
    setError(null);
    const cleanLines = lines.filter((l) => l.item && Number(l.quantity) > 0)
      .map((l) => ({ item: Number(l.item), quantity: Number(l.quantity) }));
    if (!form.project || !form.reference.trim() || cleanLines.length === 0) {
      setError("Select a project, enter a reference, and add at least one item with a positive quantity.");
      return;
    }
    setSaving(true);
    try {
      await createMaterialRequisition({ project: form.project, reference: form.reference.trim(), lines: cleanLines });
      setForm({ project: "", reference: "" });
      setLines([{ item: "", quantity: "" }]);
      setShowForm(false);
      load();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };

  const filtered = rows.filter((r) => !statusFilter || r.status === statusFilter);

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h2>Material Requests</h2>
        <button className="btn sm" onClick={() => setShowForm((s) => !s)}>{showForm ? "Cancel" : <><Plus size={14} /> New Request</>}</button>
      </div>
      <p className="muted" style={{ fontSize: 13 }}>Site material requisitions raised against a project, fulfilled from the store.</p>
      <ErrorBanner message={error} />

      {showForm && (
        <div className="card">
          <h4>New material requisition</h4>
          <div className="row wrap" style={{ gap: 8, marginBottom: 12 }}>
            <select value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} style={{ minWidth: 200 }}>
              <option value="">Select project…</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input placeholder="Reference (e.g. MR-001) *" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} style={{ minWidth: 180 }} />
          </div>
          <div className="card" style={{ background: "var(--surface-sunken, #f8fafc)" }}>
            {lines.map((line, idx) => (
              <div key={idx} className="row wrap" style={{ gap: 8, marginBottom: 8 }}>
                <select value={line.item} onChange={(e) => setLines(lines.map((l, i) => i === idx ? { ...l, item: e.target.value } : l))} style={{ flex: 1, minWidth: 200 }}>
                  <option value="">Select item…</option>
                  {items.map((it) => <option key={it.id} value={it.id}>{it.code} — {it.name}</option>)}
                </select>
                <input type="number" min="0" placeholder="Quantity" value={line.quantity} onChange={(e) => setLines(lines.map((l, i) => i === idx ? { ...l, quantity: e.target.value } : l))} style={{ width: 120 }} />
                <button className="btn ghost sm" onClick={() => setLines(lines.filter((_, i) => i !== idx))} disabled={lines.length === 1}><Trash2 size={14} /></button>
              </div>
            ))}
            <button className="btn ghost sm" onClick={() => setLines([...lines, { item: "", quantity: "" }])}><Plus size={14} /> Add line</button>
          </div>
          <button className="btn" style={{ marginTop: 12 }} onClick={submit} disabled={saving}>{saving ? "Submitting…" : "Submit requisition"}</button>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 12, alignItems: "center" }}>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ minWidth: 160 }}>
            <option value="">All statuses</option>
            <option value="submitted">Submitted</option>
            <option value="approved">Approved</option>
            <option value="fulfilled">Fulfilled</option>
            <option value="rejected">Rejected</option>
          </select>
          <span className="muted" style={{ fontSize: 13 }}>{filtered.length} requisition(s)</span>
        </div>
      </div>

      {loading ? <p className="muted">Loading...</p> : (
        <div className="card">
          <table>
            <thead><tr><th>Reference</th><th>Project</th><th>Items</th><th>Status</th><th>Raised by</th><th>Date</th></tr></thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.reference}</td>
                  <td>{r.project_name || "—"}</td>
                  <td style={{ fontSize: 12 }}>
                    {(r.lines || []).map((l) => `${itemName[l.item] ?? `#${l.item}`} ×${Number(l.quantity)}`).join(", ") || "—"}
                  </td>
                  <td><span className="badge" style={{ background: STATUS_TONE[r.status] || "var(--muted)" }}>{r.status}</span></td>
                  <td style={{ fontSize: 12 }}>{r.raised_by_name || "—"}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={6} className="empty"><ClipboardList size={16} /> No material requisitions found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
