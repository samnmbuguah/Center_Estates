import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, PackageCheck, ShoppingCart } from "lucide-react";
import { fetchPurchaseOrders, createPurchaseOrder, receivePurchaseOrder, fetchProjects, fetchItems, fetchSuppliers } from "../api";
import { ErrorBanner, ConfirmModal } from "../components";
import type { PurchaseOrder, StoreItem, StoreSupplier } from "../api-types";

type DraftLine = { item: string; quantity: string; unit_price: string };

const STATUS_TONE: Record<string, string> = {
  draft: "var(--muted)",
  sent: "var(--color-blue)",
  received: "var(--color-green)",
  closed: "var(--color-slate-500)",
  cancelled: "var(--color-danger)",
};

const money = (v: unknown) => `KSh ${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function PurchaseOrders() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [items, setItems] = useState<StoreItem[]>([]);
  const [suppliers, setSuppliers] = useState<StoreSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [confirmReceive, setConfirmReceive] = useState<PurchaseOrder | null>(null);
  const [form, setForm] = useState({ project: "", supplier: "", number: "" });
  const [lines, setLines] = useState<DraftLine[]>([{ item: "", quantity: "", unit_price: "" }]);

  const load = () => {
    setLoading(true);
    fetchPurchaseOrders().then(setOrders).catch((e) => setError(e.message)).finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    fetchProjects().then((p) => setProjects(p.map((x) => ({ id: x.id, name: x.name })))).catch(() => {});
    fetchItems().then(setItems).catch(() => {});
    fetchSuppliers().then(setSuppliers).catch(() => {});
  }, []);

  const itemName = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i.name])), [items]);

  const submit = async () => {
    setError(null);
    const cleanLines = lines.filter((l) => l.item && Number(l.quantity) > 0)
      .map((l) => ({ item: Number(l.item), quantity: Number(l.quantity), unit_price: Number(l.unit_price || 0) }));
    if (!form.project || !form.supplier || !form.number.trim() || cleanLines.length === 0) {
      setError("Select a project and supplier, enter a PO number, and add at least one line.");
      return;
    }
    setSaving(true);
    try {
      await createPurchaseOrder({ project: form.project, supplier: Number(form.supplier), number: form.number.trim(), lines: cleanLines });
      setForm({ project: "", supplier: "", number: "" });
      setLines([{ item: "", quantity: "", unit_price: "" }]);
      setShowForm(false);
      load();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };

  const receive = async (order: PurchaseOrder) => {
    setError(null);
    try { await receivePurchaseOrder(order.id); load(); } catch (e) { setError((e as Error).message); }
  };

  const filtered = orders.filter((o) => !statusFilter || o.status === statusFilter);

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h2>Purchase Orders</h2>
        <button className="btn sm" onClick={() => setShowForm((s) => !s)}>{showForm ? "Cancel" : <><Plus size={14} /> New Purchase Order</>}</button>
      </div>
      <p className="muted" style={{ fontSize: 13 }}>Raise purchase orders to suppliers; receiving a PO posts goods receipts into the stock ledger.</p>
      <ErrorBanner message={error} />

      {showForm && (
        <div className="card">
          <h4>New purchase order</h4>
          <div className="row wrap" style={{ gap: 8, marginBottom: 12 }}>
            <select value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} style={{ minWidth: 180 }}>
              <option value="">Select project…</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} style={{ minWidth: 180 }}>
              <option value="">Select supplier…</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input placeholder="PO number (e.g. PO-001) *" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} style={{ minWidth: 160 }} />
          </div>
          <div className="card" style={{ background: "var(--surface-sunken, #f8fafc)" }}>
            {lines.map((line, idx) => (
              <div key={idx} className="row wrap" style={{ gap: 8, marginBottom: 8 }}>
                <select value={line.item} onChange={(e) => setLines(lines.map((l, i) => i === idx ? { ...l, item: e.target.value } : l))} style={{ flex: 1, minWidth: 180 }}>
                  <option value="">Select item…</option>
                  {items.map((it) => <option key={it.id} value={it.id}>{it.code} — {it.name}</option>)}
                </select>
                <input type="number" min="0" placeholder="Qty" value={line.quantity} onChange={(e) => setLines(lines.map((l, i) => i === idx ? { ...l, quantity: e.target.value } : l))} style={{ width: 90 }} />
                <input type="number" min="0" step="0.01" placeholder="Unit price" value={line.unit_price} onChange={(e) => setLines(lines.map((l, i) => i === idx ? { ...l, unit_price: e.target.value } : l))} style={{ width: 120 }} />
                <button className="btn ghost sm" onClick={() => setLines(lines.filter((_, i) => i !== idx))} disabled={lines.length === 1}><Trash2 size={14} /></button>
              </div>
            ))}
            <button className="btn ghost sm" onClick={() => setLines([...lines, { item: "", quantity: "", unit_price: "" }])}><Plus size={14} /> Add line</button>
          </div>
          <button className="btn" style={{ marginTop: 12 }} onClick={submit} disabled={saving}>{saving ? "Creating…" : "Create purchase order"}</button>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 12, alignItems: "center" }}>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ minWidth: 160 }}>
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="received">Received</option>
            <option value="closed">Closed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <span className="muted" style={{ fontSize: 13 }}>{filtered.length} purchase order(s)</span>
        </div>
      </div>

      {loading ? <p className="muted">Loading...</p> : (
        <div className="card">
          <table>
            <thead><tr><th>PO #</th><th>Supplier</th><th>Project</th><th>Items</th><th>Total</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id}>
                  <td className="mono">{o.number}</td>
                  <td>{o.supplier_name || "—"}</td>
                  <td>{o.project_name || "—"}</td>
                  <td style={{ fontSize: 12 }}>
                    {(o.lines || []).map((l) => `${itemName[l.item] ?? `#${l.item}`} ×${Number(l.quantity)}`).join(", ") || "—"}
                  </td>
                  <td className="mono">{money(o.total)}</td>
                  <td><span className="badge" style={{ background: STATUS_TONE[o.status] || "var(--muted)" }}>{o.status}</span></td>
                  <td style={{ textAlign: "right" }}>
                    {o.status === "sent" && (
                      <button className="btn sm" onClick={() => setConfirmReceive(o)}><PackageCheck size={14} /> Receive</button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="empty"><ShoppingCart size={16} /> No purchase orders found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        open={!!confirmReceive}
        title="Receive purchase order"
        message={confirmReceive ? `Receive ${confirmReceive.number}? This posts goods receipts and increases stock on hand.` : ""}
        confirmLabel="Receive"
        onConfirm={() => { if (confirmReceive) receive(confirmReceive); setConfirmReceive(null); }}
        onCancel={() => setConfirmReceive(null)}
      />
    </div>
  );
}
