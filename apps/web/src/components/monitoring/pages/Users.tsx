import { KeyRound, Mail, Power, Settings2, UserPlus } from "lucide-react";
import { Fragment, useEffect, useState } from "react";

import { fetchRoles, fetchTenants, fetchUsers, inviteUser, updateUser } from "../api";
import { useAuth } from "../auth";
import { ErrorBanner } from "../components";

interface Role {
  slug: string;
  name: string;
}

export function Users() {
  const { can } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [draftRoles, setDraftRoles] = useState<string[]>([]);
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Add user form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [allTenants, setAllTenants] = useState<{ id: string; name: string }[]>([]);

  const load = () => {
    setLoading(true);
    fetchUsers().then(setUsers).catch((e) => setError(e.message)).finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    fetchRoles().then(setRoles).catch((e) => setError(e.message));
    fetchTenants().then(setAllTenants).catch(() => {});
  }, []);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setError(null);
    setNotice(null);
    try {
      await fn();
      if (ok) setNotice(ok);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  async function handleCreateAndInvite() {
    if (!email) { setError("Email is required"); return; }
    const payload: any = { email, phone: phone || undefined, name: name || undefined, roles: role ? [role] : [] };
    if (tenantId) payload.tenant_ids = [tenantId];
    await run(
      () => inviteUser(payload),
      `Invitation sent to ${email}.${tenantId ? "" : " (assigned to current tenant)"}`,
    );
    setName(""); setEmail(""); setPhone(""); setRole(""); setTenantId("");
  }

  function openEditor(u: any) {
    setEditing(editing === u.id ? null : u.id);
    setDraftRoles(u.roles ?? []);
    setNewPassword("");
    setError(null);
    setNotice(null);
  }

  const toggleRole = (slug: string) =>
    setDraftRoles((r) => (r.includes(slug) ? r.filter((x) => x !== slug) : [...r, slug]));

  return (
    <div>
      <div className="page-head">
        <div className="eyebrow">Admin</div>
        <h2>Users &amp; Access</h2>
      </div>
      <ErrorBanner message={error} />
      {notice && (
        <div className="card" style={{ borderColor: "var(--success)" }}>
          <span style={{ color: "var(--success)" }}>{notice}</span>
        </div>
      )}

      {/* Unified Add User Form — always at top */}
      {can("users.create") && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ margin: "0 0 12px 0", fontSize: 15 }}>Invite New User</h3>
          <div className="row wrap" style={{ gap: 8, alignItems: "end" }}>
            <div className="field" style={{ flex: 1, minWidth: 140 }}>
              <label style={{ fontSize: 12 }}>Role</label>
              <select value={role} onChange={e => setRole(e.target.value)}>
                <option value="">Role</option>
                {roles.map(r => <option key={r.slug} value={r.slug}>{r.name}</option>)}
              </select>
            </div>
            <div className="field" style={{ flex: 1, minWidth: 160 }}>
              <label style={{ fontSize: 12 }}>Full Name</label>
              <input placeholder="e.g. John Doe" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="field" style={{ flex: 1, minWidth: 200 }}>
              <label style={{ fontSize: 12 }}>Email *</label>
              <input placeholder="john@example.com" type="email" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="field" style={{ flex: 1, minWidth: 160 }}>
              <label style={{ fontSize: 12 }}>Phone</label>
              <input placeholder="+254 712 345 678" type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            {allTenants.length > 1 && (
              <div className="field" style={{ flex: 1, minWidth: 160 }}>
                <label style={{ fontSize: 12 }}>Tenant</label>
                <select value={tenantId} onChange={e => setTenantId(e.target.value)}>
                  <option value="">Current tenant</option>
                  {allTenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="row" style={{ gap: 8, marginTop: 12 }}>
            <button className="btn" onClick={handleCreateAndInvite} disabled={!email}>
              <Mail size={15} style={{ marginRight: 6 }} /> Send Invite
            </button>
          </div>
        </div>
      )}

      {/* Users Table */}
      {loading ? <p className="muted">Loading...</p> : users.length === 0 ? <p className="muted">No users found.</p> : (
      <div className="card">
        <table>
          <thead>
            <tr><th>User</th><th>Roles</th><th>Tenants</th><th className="col-status">Status</th>{can("users.edit") && <th style={{ textAlign: "right" }}>Actions</th>}</tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <Fragment key={u.id}>
                <tr>
                  <td>
                    {u.username}
                    {u.is_superuser ? <span className="badge" style={{ background: "var(--steel)", marginLeft: 8 }}>admin</span> : null}
                    <span className="status-inline">
                      <span className="badge" style={{ background: u.is_active ? "var(--success)" : "var(--faint)", marginLeft: 8 }}>
                        {u.is_active ? "active" : "disabled"}
                      </span>
                    </span>
                    {u.email && <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{u.email}</div>}
                  </td>
                  <td className="muted">{u.roles.join(" · ") || "—"}</td>
                  <td className="muted">{u.tenants?.map((t: any) => t.name).join(", ") || "—"}</td>
                  <td className="col-status">
                    <span className="badge" style={{ background: u.is_active ? "var(--success)" : "var(--faint)" }}>
                      {u.is_active ? "active" : "disabled"}
                    </span>
                  </td>
                  {can("users.edit") && (
                    <td>
                      <div className="row" style={{ justifyContent: "flex-end" }}>
                        <button className="btn ghost sm" onClick={() => openEditor(u)}><Settings2 size={15} /> Manage</button>
                        {can("users.disable") && (
                          <button className="btn ghost sm" onClick={() => run(() => updateUser(u.id, { is_active: !u.is_active }))}>
                            <Power size={15} /> {u.is_active ? "Disable" : "Enable"}
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
                {editing === u.id && can("users.edit") && (
                  <tr>
                    <td colSpan={4} style={{ background: "var(--surface-2)" }}>
                      <div style={{ padding: "6px 2px" }}>
                        <div className="muted" style={{ marginBottom: 8 }}>Roles</div>
                        <div className="row" style={{ marginBottom: 14 }}>
                          {roles.map((r) => {
                            const on = draftRoles.includes(r.slug);
                            return (
                              <button
                                key={r.slug}
                                className={on ? "btn sm" : "btn ghost sm"}
                                onClick={() => toggleRole(r.slug)}
                                type="button"
                              >
                                {r.name}
                              </button>
                            );
                          })}
                        </div>
                        <div className="row">
                          <button className="btn sm" onClick={() => run(() => updateUser(u.id, { roles: draftRoles }), "Roles updated.")}>
                            Save roles
                          </button>
                          <span style={{ width: 16 }} />
                          <KeyRound size={16} className="muted" />
                          <input
                            type="password"
                            placeholder="New password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            style={{ width: 200 }}
                          />
                          <button
                            className="btn ghost sm"
                            disabled={newPassword.length < 6}
                            onClick={() => run(() => updateUser(u.id, { password: newPassword }), "Password reset.").then(() => setNewPassword(""))}
                          >
                            Reset password
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}