import { useEffect, useState } from "react";

import { createTenant, fetchTenant, fetchTenants, fetchUsers, saveBranding, setDefaultTenant, updateTenant } from "../api";
import { useAuth } from "../auth";
import { ErrorBanner, ConfirmModal } from "../components";

export function Tenants() {
  const { can, me } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<any>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [confirmRemoveMember, setConfirmRemoveMember] = useState<{ userId: number; username: string } | null>(null);

  // Create form
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  // Edit form
  const [editName, setEditName] = useState("");
  const [editDomain, setEditDomain] = useState("");
  const [editSsoUrl, setEditSsoUrl] = useState("");
  const [editWebsiteSync, setEditWebsiteSync] = useState(false);
  const [editSettings, setEditSettings] = useState("");

  // Branding
  const [brandLogo, setBrandLogo] = useState("");
  const [brandPrimaryColor, setBrandPrimaryColor] = useState("var(--color-danger)");
  const [brandCompanyName, setBrandCompanyName] = useState("");
  const [brandAddress, setBrandAddress] = useState("");
  const [brandPhone, setBrandPhone] = useState("");
  const [brandEmail, setBrandEmail] = useState("");
  const [brandTaxPin, setBrandTaxPin] = useState("");

  // Member management
  const [addUserId, setAddUserId] = useState("");
  const [allUsers, setAllUsers] = useState<any[]>([]);

  const load = () => {
    setLoading(true);
    fetchTenants().then(setRows).catch(e => setError(e.message)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const loadDetail = async (id: string) => {
    try {
      const d = await fetchTenant(id);
      setDetail(d);
      setDetailId(id);
      setEditName(d.name);
      setEditDomain(d.domain ?? "");
      setEditSsoUrl(d.settings?.sso_url ?? "");
      setEditWebsiteSync(d.settings?.website_sync_enabled ?? false);
      setEditSettings(JSON.stringify(d.settings ?? {}, null, 2));
      const b = d.settings?.branding ?? {};
      setBrandLogo(b.logo_url ?? "");
      setBrandPrimaryColor(b.primary_color ?? "var(--color-danger)");
      setBrandCompanyName(b.company_name ?? "");
      setBrandAddress(b.address ?? "");
      setBrandPhone(b.phone ?? "");
      setBrandEmail(b.email ?? "");
      setBrandTaxPin(b.tax_pin ?? "");
      fetchUsers().then(setAllUsers).catch(() => {});
    } catch (e) {
      setError((e as Error).message);
    }
  };

  async function add() {
    if (!name.trim() || !slug.trim()) return;
    setError(null);
    try {
      await createTenant({ name: name.trim(), slug: slug.trim().toLowerCase().replace(/\s+/g, "_") });
      setName(""); setSlug("");
      load();
    } catch (e) { setError((e as Error).message); }
  }

  async function saveDetail() {
    if (!detailId) return;
    setError(null);
    try {
      let parsed: Record<string, unknown> = {};
      try { parsed = JSON.parse(editSettings); } catch { /* keep default */ }
      parsed.sso_url = editSsoUrl;
      parsed.website_sync_enabled = editWebsiteSync;
      await updateTenant(detailId, { name: editName, domain: editDomain, settings: parsed });
      loadDetail(detailId);
    } catch (e) { setError((e as Error).message); }
  }

  async function saveBrand() {
    if (!detailId) return;
    setError(null);
    try {
      await saveBranding(detailId, { logo_url: brandLogo, primary_color: brandPrimaryColor, company_name: brandCompanyName, address: brandAddress, phone: brandPhone, email: brandEmail, tax_pin: brandTaxPin });
      loadDetail(detailId);
    } catch (e) { setError((e as Error).message); }
  }

  return (
    <div>
      <div className="page-head"><div className="eyebrow">Admin</div><h2>Tenants</h2></div>
      <ErrorBanner message={error} />

      {/* Create tenant (superuser only) */}
      {me?.is_superuser && (
        <div className="card">
          <h3>Create Tenant</h3>
          <div style={{ display: "flex", gap: 8, alignItems: "end" }}>
            <div className="field"><label>Name</label><input value={name} onChange={e => setName(e.target.value)} /></div>
            <div className="field"><label>Slug</label><input value={slug} onChange={e => setSlug(e.target.value)} /></div>
            <button className="btn primary" onClick={add}>Create</button>
          </div>
        </div>
      )}

      {/* Tenant list */}
      {loading ? <p className="muted">Loading...</p> : (
      <div className="card">
        <table>
          <thead><tr><th>Name</th><th>Slug</th><th>Role</th><th></th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td className="mono">{r.slug}</td>
                <td>{r.is_tenant_admin ? "Admin" : "Member"}</td>
                <td>
                  {can("settings.manage") && (
                    <button className="btn ghost sm" onClick={() => loadDetail(r.id)}>Manage</button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} style={{ opacity: 0.6 }}>No tenants</td></tr>}
          </tbody>
        </table>
      </div>
      )}

      {/* Tenant detail */}
      {detail && (
        <div className="card">
          <h3>Tenant: {detail.name}</h3>
          <div className="field"><label>Name</label><input value={editName} onChange={e => setEditName(e.target.value)} /></div>
          <div className="field"><label>Domain</label><input value={editDomain} onChange={e => setEditDomain(e.target.value)} placeholder="e.g. clientcompany.com" /></div>
          <div className="field"><label>SSO URL</label><input value={editSsoUrl} onChange={e => setEditSsoUrl(e.target.value)} placeholder="https://sales.example.com/sso" /></div>
          <div className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={editWebsiteSync} onChange={e => setEditWebsiteSync(e.target.checked)} id="wsync" />
            <label htmlFor="wsync">Enable website user sync</label>
          </div>
          <div className="field"><label>Additional Settings (JSON)</label><textarea value={editSettings} onChange={e => setEditSettings(e.target.value)} rows={4} /></div>
          <button className="btn primary" onClick={saveDetail}>Save</button>
        </div>
      )}

      {/* Branding settings */}
      {detail && (
        <div className="card">
          <h3>Branding</h3>
          <p style={{ opacity: 0.6, marginBottom: 12 }}>Customize the look and feel for this tenant's reports and portal.</p>
          <div className="field"><label>Company Name</label><input value={brandCompanyName} onChange={e => setBrandCompanyName(e.target.value)} placeholder="e.g. ABC Construction Ltd" /></div>
          <div className="field"><label>Management Address</label><textarea value={brandAddress} onChange={e => setBrandAddress(e.target.value)} rows={2} placeholder="P.O. Box and physical office address" /></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <div className="field"><label>Management Phone</label><input type="tel" value={brandPhone} onChange={e => setBrandPhone(e.target.value)} placeholder="+254 700 000 000" /></div>
            <div className="field"><label>Management Email</label><input type="email" value={brandEmail} onChange={e => setBrandEmail(e.target.value)} placeholder="property@company.co.ke" /></div>
            <div className="field"><label>Tax PIN</label><input value={brandTaxPin} onChange={e => setBrandTaxPin(e.target.value)} placeholder="P000000000X" /></div>
          </div>
          <div className="field"><label>Logo URL</label><input value={brandLogo} onChange={e => setBrandLogo(e.target.value)} placeholder="https://example.com/logo.png" /></div>
          {brandLogo && (
            <div style={{ marginBottom: 12 }}>
              <img src={brandLogo} alt="Logo preview" style={{ maxHeight: 60, borderRadius: 4, border: "1px solid var(--border)" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
            </div>
          )}
          <div className="field"><label>Primary Color</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="color" value={brandPrimaryColor} onChange={e => setBrandPrimaryColor(e.target.value)} style={{ width: 48, height: 36, padding: 2, cursor: "pointer" }} />
              <input value={brandPrimaryColor} onChange={e => setBrandPrimaryColor(e.target.value)} style={{ width: 120 }} placeholder="var(--color-danger)" />
            </div>
          </div>
          <button className="btn primary" onClick={saveBrand}>Save Branding</button>
        </div>
      )}

      {detail && (
        <div className="card">
          <h4 style={{ marginTop: 0 }}>Members ({detail.members?.length ?? 0})</h4>
          <table>
            <thead><tr><th>Username</th><th>Email</th><th>Admin</th><th>Default</th><th></th></tr></thead>
            <tbody>
              {(detail.members ?? []).map((m: any) => (
                <tr key={m.user_id}>
                  <td>{m.username}</td>
                  <td>{m.email}</td>
                  <td>
                    <button className={m.is_tenant_admin ? "btn sm" : "btn ghost sm"} style={{ fontSize: 11 }}
                      onClick={async () => {
                        try {
                          const res = await fetch(`/tenants/${detailId}/members/${m.user_id}/role`, {
                            method: "PATCH", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ is_tenant_admin: !m.is_tenant_admin }),
                          });
                          if (!res.ok) throw new Error("Failed");
                          loadDetail(detailId!);
                        } catch (e: any) { setError(e.message); }
                      }}>
                      {m.is_tenant_admin ? "Admin" : "Member"}
                    </button>
                  </td>
                  <td>
                    {m.is_default ? (
                      <span className="badge" style={{ background: "var(--success)" }}>Default</span>
                    ) : (
                      <button className="btn ghost sm" style={{ fontSize: 11 }}
                        onClick={async () => {
                          try {
                            await setDefaultTenant(detailId!);
                            loadDetail(detailId!);
                          } catch (e: any) { setError(e.message); }
                        }}>Set default</button>
                    )}
                  </td>
                  <td>
                    {!m.is_default && (
                      <button className="btn ghost sm" style={{ fontSize: 11, color: "var(--danger)" }}
                        onClick={() => setConfirmRemoveMember({ userId: m.user_id, username: m.username })}>✕</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="row" style={{ marginTop: 8 }}>
            <select value={addUserId} onChange={e => setAddUserId(e.target.value)} style={{ flex: 1 }}>
              <option value="">Add existing user...</option>
              {allUsers.filter(u => !detail.members?.find((m: any) => m.user_id === u.id)).map((u: any) => (
                <option key={u.id} value={u.id}>{u.username}{u.email ? ` (${u.email})` : ""}</option>
              ))}
            </select>
            <button className="btn sm" disabled={!addUserId}
              onClick={async () => {
                try {
                  const res = await fetch(`/tenants/${detailId}/members`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ user_id: addUserId }),
                  });
                  if (!res.ok) throw new Error("Failed");
                  setAddUserId("");
                  loadDetail(detailId!);
                } catch (e: any) { setError(e.message); }
              }}>Add</button>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!confirmRemoveMember}
        title="Remove member"
        message={confirmRemoveMember ? `Remove ${confirmRemoveMember.username} from this tenant?` : ""}
        confirmLabel="Remove"
        onConfirm={async () => {
          if (!confirmRemoveMember || !detailId) return;
          try {
            const res = await fetch(`/tenants/${detailId}/members/${confirmRemoveMember.userId}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed");
            loadDetail(detailId);
          } catch (e: any) { setError(e.message); }
          setConfirmRemoveMember(null);
        }}
        onCancel={() => setConfirmRemoveMember(null)}
      />
    </div>
  );
}
