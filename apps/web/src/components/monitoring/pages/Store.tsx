import { useEffect, useState } from "react";
import { AlertTriangle, Download, Pencil, Trash2 } from "lucide-react";
import { createItem, deleteItem, fetchItems, updateItem } from "../api";
import { useAuth } from "../auth";
import { ErrorBanner, ConfirmModal } from "../components";

const REORDER_THRESHOLD = 50; // Alert when stock falls below this

export function Store() {
  const { can } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("unit");
  const [category, setCategory] = useState("");
  const [reorderLevel, setReorderLevel] = useState(REORDER_THRESHOLD);
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<{ id: number; name: string } | null>(null);

  const load = () => {
    setLoading(true);
    fetchItems().then(setItems).catch((e) => setError(e.message)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try { await fn(); load(); } catch (e) { setError((e as Error).message); }
  };

  async function add() {
    if (!code.trim() || !name.trim()) return;
    await run(() => createItem({ code: code.trim(), name: name.trim(), unit, category }));
    setCode(""); setName("");
  }

  async function saveEdit(id: number) {
    await run(() => updateItem(id, { name: editName }));
    setEditId(null);
  }

  const lowStock = items.filter(i => Number(i.quantity_on_hand) < reorderLevel);
  const exportCsv = () => {
    const rows = [["Code", "Name", "Category", "Unit", "Quantity on hand", "Reorder level"], ...items.map(i => [i.code, i.name, i.category, i.unit, i.quantity_on_hand, i.reorder_level ?? reorderLevel])];
    const csv = rows.map(row => row.map(v => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "store-inventory.csv"; a.click();
  };

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><h2>Store &amp; Procurement</h2><button className="btn ghost sm" onClick={exportCsv}><Download size={14} /> Export CSV</button></div>
        {lowStock.length > 0 && (
          <span className="badge" style={{ background: "var(--danger)", display: "inline-flex", alignItems: "center", gap: 4 }}>
            <AlertTriangle size={12} /> {lowStock.length} low stock alerts
          </span>
        )}
      </div>
      <p className="muted" style={{ fontSize: 13 }}>{items.length} items in catalog</p>
      <ErrorBanner message={error} />

      {/* Low stock alerts */}
      {lowStock.length > 0 && (
        <div className="card" style={{ borderLeft: "4px solid var(--danger)", marginBottom: 16 }}>
          <h4 style={{ margin: 0, marginBottom: 8, color: "var(--danger)" }}>Reorder Alerts</h4>
          {lowStock.map(i => (
            <div key={i.id} style={{ fontSize: 13, padding: "2px 0" }}>
              {i.name} ({i.code}) — {i.quantity_on_hand} {i.unit} remaining
              <span style={{ color: "var(--danger)", marginLeft: 8 }}>below threshold ({reorderLevel})</span>
            </div>
          ))}
          <div className="field" style={{ marginTop: 8 }}>
            <label style={{ fontSize: 11 }}>Reorder threshold</label>
            <input type="number" value={reorderLevel} onChange={e => setReorderLevel(Number(e.target.value))}
              style={{ width: 80, fontSize: 12 }} />
          </div>
        </div>
      )}

      {/* Item list */}
      {loading ? <p className="muted">Loading...</p> : (
      <div className="card">
        <table>
          <thead><tr><th>Code</th><th>Name</th><th>Unit</th><th>Category</th><th>On Hand</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {items.map(i => (
              <tr key={i.id}>
                <td className="mono">{i.code}</td>
                <td>{editId === i.id ? (
                  <input value={editName} onChange={e => setEditName(e.target.value)}
                    onBlur={() => saveEdit(i.id)} onKeyDown={e => e.key === "Enter" && saveEdit(i.id)}
                    style={{ width: 120, fontSize: 12 }} />
                ) : (
                  <span onDoubleClick={() => { setEditId(i.id); setEditName(i.name); }}>{i.name}</span>
                )}</td>
                <td>{i.unit}</td>
                <td>{i.category}</td>
                <td className="num">{i.quantity_on_hand}</td>
                <td>{Number(i.quantity_on_hand) < reorderLevel ? (
                  <span className="badge" style={{ background: "var(--danger)", fontSize: 10 }}>Reorder</span>
                ) : Number(i.quantity_on_hand) < reorderLevel * 2 ? (
                  <span className="badge" style={{ background: "var(--warning)", fontSize: 10 }}>Low</span>
                ) : (
                  <span className="badge" style={{ background: "var(--success)", fontSize: 10 }}>OK</span>
                )}</td>
                <td>
                  {can("store.catalog.manage") && (
                    <button className="btn ghost sm" onClick={() => setConfirmDeleteItem({ id: i.id, name: i.name })}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={7} className="empty">No items in catalog.</td></tr>}
          </tbody>
        </table>
      </div>
      )}

      {/* Add item form */}
      {can("store.catalog.manage") && (
        <div className="card">
          <h4>Add Item</h4>
          <div className="row wrap" style={{ gap: 8 }}>
            <input placeholder="Code *" value={code} onChange={e => setCode(e.target.value)} style={{ width: 100 }} />
            <input placeholder="Name *" value={name} onChange={e => setName(e.target.value)} style={{ flex: 1 }} />
            <input placeholder="Unit" value={unit} onChange={e => setUnit(e.target.value)} style={{ width: 80 }} />
            <input placeholder="Category" value={category} onChange={e => setCategory(e.target.value)} style={{ width: 120 }} />
            <button className="btn" onClick={add}>Add Item</button>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!confirmDeleteItem}
        title="Delete item"
        message={confirmDeleteItem ? `Delete ${confirmDeleteItem.name}?` : ""}
        confirmLabel="Delete"
        onConfirm={() => { if (confirmDeleteItem) run(() => deleteItem(confirmDeleteItem.id)); setConfirmDeleteItem(null); }}
        onCancel={() => setConfirmDeleteItem(null)}
      />
    </div>
  );
}
