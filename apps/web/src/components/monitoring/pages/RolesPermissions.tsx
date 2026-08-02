import { Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { createRole, deleteRole, fetchPermissions, fetchRole, fetchRoles, saveRole } from "../api";
import { ErrorBanner, ConfirmModal } from "../components";

interface Perm { key: string; label: string; module: string }

export function RolesPermissions() {
  const [roles, setRoles] = useState<{ slug: string; name: string }[]>([]);
  const [perms, setPerms] = useState<Perm[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [confirmDeleteRole, setConfirmDeleteRole] = useState(false);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [newRole, setNewRole] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadRoles = () => {
    setLoading(true);
    fetchRoles().then(setRoles).catch((e) => setError(e.message)).finally(() => setLoading(false));
  };
  useEffect(() => {
    loadRoles();
    fetchPermissions().then(setPerms).catch((e) => setError(e.message));
  }, []);

  async function open(slug: string) {
    setError(null); setNotice(null);
    try {
      const r = await fetchRole(slug);
      setActive(slug); setName(r.name); setSelected(new Set(r.permissions));
    } catch (e) { setError((e as Error).message); }
  }

  const toggle = (key: string) =>
    setSelected((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });

  async function save() {
    if (!active) return;
    setError(null); setNotice(null);
    try {
      await saveRole(active, { name, permissions: [...selected] });
      setNotice("Role saved."); loadRoles();
    } catch (e) { setError((e as Error).message); }
  }

  async function add() {
    if (!newRole.trim()) return;
    setError(null);
    try {
      const r = await createRole({ slug: newRole.trim(), name: newRole.trim() });
      setNewRole(""); await loadRoles(); open(r.slug);
    } catch (e) { setError((e as Error).message); }
  }

  async function remove(slug: string) {
    setError(null);
    try {
      await deleteRole(slug);
      if (active === slug) setActive(null);
      loadRoles();
    } catch (e) { setError((e as Error).message); }
  }

  const modules = [...new Set(perms.map((p) => p.module))];

  return (
    <div>
      <div className="page-head">
        <div className="eyebrow">Admin · Access control</div>
        <h2>Roles &amp; Permissions</h2>
      </div>
      <ErrorBanner message={error} />
      {notice && <div className="card" style={{ borderColor: "var(--success)" }}><span style={{ color: "var(--success)" }}>{notice}</span></div>}

      {loading ? <p className="muted">Loading...</p> : (
      <>
      {/* Role picker as a dropdown so the permission matrix below gets the full
          width — important on small screens. */}
      <div className="card row" style={{ flexWrap: "wrap", alignItems: "flex-end", gap: 12 }}>
        <div className="field" style={{ margin: 0, flex: "1 1 220px", minWidth: 180 }}>
          <label htmlFor="role-select">Role</label>
          <select id="role-select" value={active ?? ""} onChange={(e) => e.target.value && open(e.target.value)}>
            <option value="" disabled>Select a role…</option>
            {roles.map((r) => <option key={r.slug} value={r.slug}>{r.name}</option>)}
          </select>
        </div>
        {active && (
          <button className="btn ghost sm" title="Delete this role" onClick={() => setConfirmDeleteRole(true)}><Trash2 size={14} /> Delete</button>
        )}
        <div className="field" style={{ margin: 0, flex: "1 1 200px", minWidth: 160 }}>
          <label htmlFor="new-role">New role</label>
          <div className="row" style={{ flexWrap: "nowrap" }}>
            <input id="new-role" placeholder="new-role" value={newRole} onChange={(e) => setNewRole(e.target.value)} style={{ flex: 1 }} />
            <button className="btn sm" onClick={add} disabled={!newRole.trim()}><Plus size={14} /></button>
          </div>
        </div>
      </div>

      <div className="card">
        {!active ? (
          <div className="empty">Select a role above to edit its permissions.</div>
        ) : (
          <>
            <div className="field" style={{ maxWidth: 320 }}>
              <label>Display name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            {modules.map((m) => (
              <div key={m} style={{ marginBottom: 14 }}>
                <div className="muted mono" style={{ textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{m.replace(/_/g, " ")}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 240px), 1fr))", gap: 6 }}>
                  {perms.filter((p) => p.module === m).map((p) => (
                    <label key={p.key} className="row" style={{ gap: 8, fontSize: 13 }}>
                      <input type="checkbox" checked={selected.has(p.key)} onChange={() => toggle(p.key)} style={{ width: 15, height: 15 }} />
                      <span>{p.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <button className="btn" onClick={save}><Save size={16} /> Save role</button>
          </>
        )}
      </div>
      <ConfirmModal
        open={confirmDeleteRole}
        title="Delete role"
        message={`Delete role "${name || active}"?`}
        confirmLabel="Delete"
        onConfirm={() => { if (active) remove(active); setConfirmDeleteRole(false); }}
        onCancel={() => setConfirmDeleteRole(false)}
      />
      </>
      )}
    </div>
  );
}
