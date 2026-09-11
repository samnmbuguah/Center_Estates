import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Truck } from "lucide-react";
import { fetchSuppliers, createSupplier, updateSupplier, deleteSupplier } from "../api";
import { ErrorBanner, ConfirmModal } from "../components";
import type { StoreSupplier } from "../api-types";

export function Suppliers() {
  const [suppliers, setSuppliers] = useState<StoreSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", contact: "" });
  const [editId, setEditId] = useState<number | null>(null);
  const [edit, setEdit] = useState({ name: "", contact: "" });
  const [confirmDelete, setConfirmDelete] = useState<StoreSupplier | null>(null);

  const load = () => {
    setLoading(true);
    fetchSuppliers().then(setSuppliers).catch((e) => setError(e.message)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.name.trim()) return;
    setError(null);
    try {
      await createSupplier({ name: form.name.trim(), contact: form.contact.trim() });
      setForm({ name: "", contact: "" });
      load();
    } catch (e) { setError((e as Error).message); }
  };

  const saveEdit = async () => {
    if (editId === null) return;
    setError(null);
    try {
      await updateSupplier(editId, { name: edit.name.trim(), contact: edit.contact.trim() });
      setEditId(null);
      load();
    } catch (e) { setError((e as Error).message); }
  };

  const remove = async (s: StoreSupplier) => {
    setError(null);
    try { await deleteSupplier(s.id); load(); } catch (e) { setError((e as Error).message); }
  };

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h2>Suppliers</h2>
        <span className="muted" style={{ fontSize: 13 }}>{suppliers.length} registered</span>
      </div>
      <p className="muted" style={{ fontSize: 13 }}>Vendors and suppliers used for purchase orders and material procurement.</p>
      <ErrorBanner message={error} />

      <div className="card">
        <h4>Add Supplier</h4>
        <div className="row wrap" style={{ gap: 8 }}>
          <input placeholder="Supplier name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ flex: 1, minWidth: 200 }} />
          <input placeholder="Contact (phone / email)" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} style={{ flex: 1, minWidth: 200 }} />
          <button className="btn" onClick={add}><Plus size={14} /> Add</button>
        </div>
      </div>

      {loading ? <p className="muted">Loading...</p> : (
        <div className="card">
          <table>
            <thead><tr><th>Supplier</th><th>Contact</th><th></th></tr></thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id}>
                  <td>{editId === s.id ? (
                    <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} style={{ fontSize: 12 }} />
                  ) : <strong>{s.name}</strong>}</td>
                  <td>{editId === s.id ? (
                    <input value={edit.contact} onChange={(e) => setEdit({ ...edit, contact: e.target.value })} style={{ fontSize: 12 }} />
                  ) : (s.contact || "—")}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {editId === s.id ? (
                      <>
                        <button className="btn sm" onClick={saveEdit}>Save</button>
                        <button className="btn ghost sm" onClick={() => setEditId(null)}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button className="btn ghost sm" onClick={() => { setEditId(s.id); setEdit({ name: s.name, contact: s.contact }); }}><Pencil size={14} /></button>
                        <button className="btn ghost sm" style={{ color: "var(--color-danger)" }} onClick={() => setConfirmDelete(s)}><Trash2 size={14} /></button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {suppliers.length === 0 && <tr><td colSpan={3} className="empty"><Truck size={16} /> No suppliers registered.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        open={!!confirmDelete}
        title="Delete supplier"
        message={confirmDelete ? `Delete ${confirmDelete.name}?` : ""}
        confirmLabel="Delete"
        onConfirm={() => { if (confirmDelete) remove(confirmDelete); setConfirmDelete(null); }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
