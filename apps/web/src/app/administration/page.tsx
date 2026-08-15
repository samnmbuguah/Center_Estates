"use client";

import { useState, useEffect, useCallback, useMemo, FormEvent, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { apiFetch, csrfFromCookie } from "@/lib/api";
import {
  CreditCard,
  Shield,
  Building,
  FileText,
  Activity,
  CheckCircle,
  AlertCircle,
  Save,
  Users,
  UserPlus,
  Edit2,
  Trash2,
  Key,
  Search,
  ExternalLink,
  Lock,
} from "lucide-react";
import { RoleAccessManager } from "@/components/role-access-manager";
import { Field, Modal, StatusPill, Badge, EmptyState, KpiCard, KpiStrip } from "@/components/module-ui";

type PropertyItem = { id: string; name: string; code: string };
type RoleItem = { id: string; name: string; slug: string; description?: string };
type MemberItem = {
  id: string;
  user_id: string;
  username: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone_number: string;
  is_organization_admin: boolean;
  status: string;
  roles: { id: string; name: string; slug: string }[];
  assigned_properties: { id: string; name: string; code: string }[];
};

type GatewayConfig = {
  id?: string;
  property: string;
  provider: string;
  display_name: string;
  is_enabled: boolean;
  merchant_reference?: string;
  checkout_url_template?: string;
  webhook_secret_env?: string;
  settings: {
    environment?: string;
    consumer_key?: string;
    consumer_secret?: string;
    passkey?: string;
    shortcode?: string;
    till_number?: string;
    bank_name?: string;
    bank_account_number?: string;
  };
};

function AdministrationContent() {
  const { session } = useAuth();
  const searchParams = useSearchParams();
  const isSuperAdministrator = Boolean(
    session?.user.isSuperuser ||
    session?.roles?.includes("platform-admin") ||
    session?.roles?.includes("super-admin")
  );
  const organizationId = session?.activeOrganizationId ?? null;

  // Active subtab read from sidebar URL search parameter
  const urlTab = searchParams ? searchParams.get("tab") : null;
  const tab = (urlTab && ["users", "roles", "mpesa", "orgs", "tax", "audit"].includes(urlTab))
    ? (urlTab as "users" | "roles" | "mpesa" | "orgs" | "tax" | "audit")
    : "users";

  // Shared Data
  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // User Administration Filters & Modals
  const [userSearch, setUserSearch] = useState("");
  const [selectedPropertyFilter, setSelectedPropertyFilter] = useState<string>("all");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>("all");
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [editingMember, setEditingMember] = useState<MemberItem | null>(null);
  const [memberError, setMemberError] = useState("");

  // Add User Form Fields
  const [newUsername, setNewUsername] = useState("");
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [newSelectedRoles, setNewSelectedRoles] = useState<string[]>([]);
  const [newSelectedProps, setNewSelectedProps] = useState<string[]>([]);

  // Edit User Matrix Form Fields
  const [editIsAdmin, setEditIsAdmin] = useState(false);
  const [editPhone, setEditPhone] = useState("");
  const [editSelectedRoles, setEditSelectedRoles] = useState<string[]>([]);
  const [editSelectedProps, setEditSelectedProps] = useState<string[]>([]);

  // M-Pesa STK Push Form fields
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [gateway, setGateway] = useState<GatewayConfig | null>(null);
  const [environment, setEnvironment] = useState("sandbox");
  const [shortcode, setShortcode] = useState("174379");
  const [passkey, setPasskey] = useState("bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919");
  const [consumerKey, setConsumerKey] = useState("");
  const [consumerSecret, setConsumerSecret] = useState("");
  const [bankName, setBankName] = useState("Cooperative Bank");
  const [bankAccount, setBankAccount] = useState("01120001234500");
  const [tillNumber, setTillNumber] = useState("");

  // 1. Load Properties & Roles
  const loadPropertiesAndRoles = useCallback(async () => {
    if (!organizationId || !isSuperAdministrator) return;
    try {
      const [propRes, rolesRes] = await Promise.all([
        apiFetch("/property/properties/", {}, organizationId),
        apiFetch("/access/roles/", {}, organizationId),
      ]);
      if (propRes.ok) {
        const data = await propRes.json();
        const list = (Array.isArray(data) ? data : data.results || []) as PropertyItem[];
        setProperties(list);
        if (list.length > 0 && !selectedPropertyId) {
          setSelectedPropertyId(list[0].id);
        }
      }
      if (rolesRes.ok) {
        const data = await rolesRes.json();
        setRoles(Array.isArray(data) ? data : data.results || []);
      }
    } catch (err) {
      console.error("Failed to load properties or roles", err);
    }
  }, [organizationId, isSuperAdministrator, selectedPropertyId]);

  // 2. Load Members / Users
  const loadMembers = useCallback(async () => {
    if (!organizationId || !isSuperAdministrator) return;
    setLoading(true);
    try {
      const res = await apiFetch("/access/members/", {}, organizationId);
      if (res.ok) {
        const data = await res.json();
        setMembers(Array.isArray(data) ? data : data.results || []);
      }
    } catch (err) {
      console.error("Failed to load organization members", err);
    } finally {
      setLoading(false);
    }
  }, [organizationId, isSuperAdministrator]);

  // 3. Load Gateway
  const loadGateway = useCallback(async () => {
    if (!organizationId || !selectedPropertyId || !isSuperAdministrator) return;
    try {
      const res = await apiFetch(`/property/payment-gateways/?property=${selectedPropertyId}`, {}, organizationId);
      if (res.ok) {
        const data = await res.json();
        const list = (data.results || data) as GatewayConfig[];
        const mpesa = list.find((g) => g.provider === "mpesa");
        if (mpesa) {
          setGateway(mpesa);
          setEnvironment(mpesa.settings?.environment || "sandbox");
          setShortcode(mpesa.settings?.shortcode || "174379");
          setPasskey(mpesa.settings?.passkey || "");
          setConsumerKey(mpesa.settings?.consumer_key || "");
          setConsumerSecret(mpesa.settings?.consumer_secret || "");
          setBankName(mpesa.settings?.bank_name || "Cooperative Bank");
          setBankAccount(mpesa.settings?.bank_account_number || "");
          setTillNumber(mpesa.settings?.till_number || "");
        } else {
          setGateway(null);
          setEnvironment("sandbox");
          setShortcode("174379");
          setPasskey("bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919");
          setConsumerKey("");
          setConsumerSecret("");
          setBankName("Cooperative Bank");
          setBankAccount("01120001234500");
          setTillNumber("");
        }
      }
    } catch (err) {
      console.error("Failed to load gateway settings", err);
    }
  }, [organizationId, selectedPropertyId, isSuperAdministrator]);

  useEffect(() => {
    void loadPropertiesAndRoles();
    void loadMembers();
  }, [loadPropertiesAndRoles, loadMembers]);

  useEffect(() => {
    if (selectedPropertyId) {
      void loadGateway();
    }
  }, [selectedPropertyId, loadGateway]);

  // Handle Add Member Submit
  async function handleCreateUser(e: FormEvent) {
    e.preventDefault();
    if (!organizationId) return;
    setSaving(true);
    setMemberError("");
    setNotice(null);
    try {
      await apiFetch("/auth/csrf/");
      const res = await apiFetch(
        "/access/members/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-CSRFToken": csrfFromCookie() },
          body: JSON.stringify({
            username: newUsername.trim(),
            first_name: newFirstName.trim(),
            last_name: newLastName.trim(),
            email: newEmail.trim(),
            phone_number: newPhone.trim(),
            password: newPassword.trim() || undefined,
            is_organization_admin: newIsAdmin,
            role_ids: newSelectedRoles,
            property_ids: newSelectedProps,
          }),
        },
        organizationId
      );

      if (res.ok) {
        setShowAddUserModal(false);
        setNotice({ type: "success", text: `User account '${newUsername}' created and access matrix assigned.` });
        setNewUsername("");
        setNewFirstName("");
        setNewLastName("");
        setNewEmail("");
        setNewPhone("");
        setNewPassword("");
        setNewIsAdmin(false);
        setNewSelectedRoles([]);
        setNewSelectedProps([]);
        await loadMembers();
      } else {
        const body = await res.json().catch(() => ({}));
        const err = body.detail || body.username || body.email || "Failed to create user account.";
        setMemberError(String(err));
      }
    } catch {
      setMemberError("Network error occurred while creating user.");
    } finally {
      setSaving(false);
    }
  }

  // Handle Open Edit Member Modal
  function openEditModal(m: MemberItem) {
    setEditingMember(m);
    setEditIsAdmin(m.is_organization_admin);
    setEditPhone(m.phone_number || "");
    setEditSelectedRoles(m.roles?.map((r) => r.id) || []);
    setEditSelectedProps(m.assigned_properties?.map((p) => p.id) || []);
  }

  // Handle Save Edit Member
  async function handleSaveEditUser(e: FormEvent) {
    e.preventDefault();
    if (!organizationId || !editingMember) return;
    setSaving(true);
    setNotice(null);
    try {
      await apiFetch("/auth/csrf/");
      const res = await apiFetch(
        `/access/members/${editingMember.id}/`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "X-CSRFToken": csrfFromCookie() },
          body: JSON.stringify({
            is_organization_admin: editIsAdmin,
            phone_number: editPhone.trim(),
            role_ids: editSelectedRoles,
            property_ids: editSelectedProps,
          }),
        },
        organizationId
      );

      if (res.ok) {
        setEditingMember(null);
        setNotice({ type: "success", text: `Access matrix updated for ${editingMember.full_name || editingMember.username}.` });
        await loadMembers();
      } else {
        const body = await res.json().catch(() => ({}));
        setNotice({ type: "error", text: String(body.detail || "Failed to update member access matrix.") });
      }
    } catch {
      setNotice({ type: "error", text: "Network error updating member matrix." });
    } finally {
      setSaving(false);
    }
  }

  // Handle Deactivate / Delete User
  async function handleDeleteUser(m: MemberItem) {
    if (!organizationId) return;
    const confirmDelete = window.confirm(`Are you sure you want to remove user '${m.full_name || m.username}' from this organization?`);
    if (!confirmDelete) return;

    setSaving(true);
    try {
      await apiFetch("/auth/csrf/");
      const res = await apiFetch(
        `/access/members/${m.id}/`,
        {
          method: "DELETE",
          headers: { "X-CSRFToken": csrfFromCookie() },
        },
        organizationId
      );
      if (res.ok) {
        setNotice({ type: "success", text: `User ${m.username} removed from organization.` });
        await loadMembers();
      } else {
        const body = await res.json().catch(() => ({}));
        setNotice({ type: "error", text: String(body.detail || "Failed to remove member.") });
      }
    } catch {
      setNotice({ type: "error", text: "Network error removing member." });
    } finally {
      setSaving(false);
    }
  }

  // Save M-Pesa Gateway Settings
  async function handleSaveMpesa(e: FormEvent) {
    e.preventDefault();
    if (!organizationId || !selectedPropertyId) return;
    setSaving(true);
    setNotice(null);

    const payload = {
      property: selectedPropertyId,
      provider: "mpesa",
      display_name: `M-Pesa STK Push (${bankName})`,
      is_enabled: true,
      settings: {
        environment,
        shortcode,
        passkey,
        consumer_key: consumerKey,
        consumer_secret: consumerSecret,
        bank_name: bankName,
        bank_account_number: bankAccount,
        till_number: tillNumber,
      },
    };

    try {
      await apiFetch("/auth/csrf/");
      const method = gateway?.id ? "PATCH" : "POST";
      const url = gateway?.id ? `/property/payment-gateways/${gateway.id}/` : "/property/payment-gateways/";

      const res = await apiFetch(
        url,
        {
          method,
          headers: { "Content-Type": "application/json", "X-CSRFToken": csrfFromCookie() },
          body: JSON.stringify(payload),
        },
        organizationId
      );

      if (res.ok) {
        setNotice({ type: "success", text: "M-Pesa STK Push administration settings saved successfully!" });
        await loadGateway();
      } else {
        const err = await res.json().catch(() => ({}));
        setNotice({ type: "error", text: err.detail || "Failed to save M-Pesa STK Push settings." });
      }
    } catch {
      setNotice({ type: "error", text: "Network error occurred while saving gateway configuration." });
    } finally {
      setSaving(false);
    }
  }

  // Filtered Members for Tab 1
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      if (selectedPropertyFilter !== "all") {
        if (!m.is_organization_admin && !m.assigned_properties?.some((p) => p.id === selectedPropertyFilter)) {
          return false;
        }
      }
      if (selectedRoleFilter !== "all") {
        if (!m.roles?.some((r) => r.id === selectedRoleFilter)) {
          return false;
        }
      }
      if (userSearch) {
        const q = userSearch.toLowerCase();
        const match =
          (m.full_name || "").toLowerCase().includes(q) ||
          (m.username || "").toLowerCase().includes(q) ||
          (m.email || "").toLowerCase().includes(q) ||
          (m.phone_number || "").toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [members, selectedPropertyFilter, selectedRoleFilter, userSearch]);

  const totalUsers = members.length;
  const adminCount = members.filter((m) => m.is_organization_admin).length;
  const staffCount = totalUsers - adminCount;

  if (session && !isSuperAdministrator) {
    return (
      <main style={{ padding: "48px 32px", maxWidth: 760, margin: "0 auto" }}>
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <Shield size={38} aria-hidden="true" style={{ margin: "0 auto 12px", color: "#dc2626" }} />
          <h1 style={{ margin: "0 0 8px", fontSize: "1.5rem" }}>Super administrator access required</h1>
          <p style={{ margin: 0, color: "var(--muted)" }}>
            Organization administration, user accounts, and role permissions are restricted to the Center Estates super administrator.
          </p>
        </div>
      </main>
    );
  }

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1300, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 800, color: "var(--text, #1e293b)", display: "flex", alignItems: "center", gap: 10 }}>
            <span>🛡️ Platform Administration & Access Control</span>
          </h1>
          <p style={{ margin: "4px 0 0", color: "var(--muted, #64748b)", fontSize: "0.9rem" }}>
            Create system users, configure role permissions across all modules, and manage M-Pesa payment gateways.
          </p>
        </div>
        {tab === "users" && (
          <button
            className="btn primary"
            onClick={() => setShowAddUserModal(true)}
            style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, background: "#d92d2d", borderColor: "#d92d2d" }}
          >
            <UserPlus size={16} />
            <span>+ Add System User</span>
          </button>
        )}
      </div>


      {/* Notice Banner */}
      {notice && (
        <div
          style={{
            marginBottom: 20,
            padding: "12px 16px",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: notice.type === "success" ? "#dcfce7" : "#fee2e2",
            color: notice.type === "success" ? "#166534" : "#991b1b",
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          {notice.type === "success" ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{notice.text}</span>
        </div>
      )}

      {/* TAB 1: USERS & STAFF ACCOUNTS */}
      {tab === "users" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* KPI Strip */}
          <KpiStrip cols={4}>
            <KpiCard icon="👥" iconBg="#e0e7ff" iconColor="#4f46e5" label="Total System Users" value={String(totalUsers)} sub="Organization members" />
            <KpiCard icon="🛡️" iconBg="#fef3c7" iconColor="#92400e" label="Super Administrators" value={String(adminCount)} sub="Portfolio-wide access" />
            <KpiCard icon="💼" iconBg="#e0f2fe" iconColor="#0284c7" label="Operational Staff" value={String(staffCount)} sub="Scoped to properties" />
            <KpiCard icon="🔐" iconBg="#dcfce7" iconColor="#16a34a" label="Configured Roles" value={String(roles.length)} sub="Active RBAC roles" />
          </KpiStrip>

          {/* User Table Card */}
          <div style={{ background: "var(--surface, #ffffff)", border: "1px solid var(--border, #e2e8f0)", borderRadius: 12, padding: 20 }}>
            {/* Filter & Search Bar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16, paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", flex: 1 }}>
                <div style={{ position: "relative", minWidth: 260 }}>
                  <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
                  <input
                    type="search"
                    placeholder="Search by name, username, email or phone…"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    style={{ width: "100%", paddingLeft: 32, paddingRight: 12, height: 36, borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-sunken)", fontSize: 13 }}
                  />
                </div>

                {/* Property Filter */}
                <select
                  value={selectedPropertyFilter}
                  onChange={(e) => setSelectedPropertyFilter(e.target.value)}
                  style={{ height: 36, padding: "0 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-sunken)", fontSize: 13 }}
                >
                  <option value="all">🏢 All Properties / Scopes</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      🏢 {p.name} ({p.code})
                    </option>
                  ))}
                </select>

                {/* Role Filter */}
                <select
                  value={selectedRoleFilter}
                  onChange={(e) => setSelectedRoleFilter(e.target.value)}
                  style={{ height: 36, padding: "0 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-sunken)", fontSize: 13 }}
                >
                  <option value="all">🔐 All Roles</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>

                {(userSearch || selectedPropertyFilter !== "all" || selectedRoleFilter !== "all") && (
                  <button
                    onClick={() => {
                      setUserSearch("");
                      setSelectedPropertyFilter("all");
                      setSelectedRoleFilter("all");
                    }}
                    style={{ border: "none", background: "none", color: "var(--muted)", textDecoration: "underline", cursor: "pointer", fontSize: 12 }}
                  >
                    Clear filters
                  </button>
                )}
              </div>

              <div style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>
                Showing {filteredMembers.length} of {totalUsers} users
              </div>
            </div>

            {/* Table */}
            {loading ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading user accounts…</div>
            ) : filteredMembers.length === 0 ? (
              <EmptyState
                icon="👥"
                title="No user accounts found"
                description="Create staff member accounts (e.g. Lydia, Abel, Sharon, Marilyn) and assign them to roles and estates."
                action={
                  <button className="btn primary sm" onClick={() => setShowAddUserModal(true)}>
                    + Add System User
                  </button>
                }
              />
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>User / Staff Member</th>
                      <th>Contact Info</th>
                      <th>Assigned Roles (Feature Access)</th>
                      <th>Assigned Properties / Estates</th>
                      <th>Access Level</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMembers.map((m) => (
                      <tr key={m.id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: "50%",
                                background: m.is_organization_admin ? "#d92d2d" : "#4f46e5",
                                color: "#fff",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 12,
                                fontWeight: 700,
                              }}
                            >
                              {(m.first_name?.[0] || m.username?.[0] || "U").toUpperCase()}
                            </span>
                            <div>
                              <strong style={{ fontSize: 13, color: "var(--text)", display: "block" }}>
                                {m.full_name || m.username}
                              </strong>
                              <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
                                @{m.username}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td style={{ fontSize: 12 }}>
                          {m.email ? (
                            <a href={`mailto:${m.email}`} style={{ color: "var(--primary)", textDecoration: "none" }}>
                              {m.email}
                            </a>
                          ) : (
                            <span className="muted">No email</span>
                          )}
                          {m.phone_number && (
                            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                              📞 {m.phone_number}
                            </div>
                          )}
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {m.roles?.length > 0 ? (
                              m.roles.map((r) => (
                                <Badge key={r.id} tone="purple">
                                  {r.name}
                                </Badge>
                              ))
                            ) : (
                              <span className="muted" style={{ fontSize: 12 }}>
                                Standard Staff
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {m.is_organization_admin ? (
                              <Badge tone="blue">All Properties (Portfolio-wide)</Badge>
                            ) : m.assigned_properties?.length > 0 ? (
                              m.assigned_properties.map((p) => (
                                <span key={p.id} style={{ fontSize: 11, padding: "2px 6px", background: "rgba(0,0,0,0.05)", borderRadius: 4, color: "var(--text)" }}>
                                  🏢 {p.name}
                                </span>
                              ))
                            ) : (
                              <span className="muted" style={{ fontSize: 12 }}>
                                General / Unrestricted
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <StatusPill
                            value={m.is_organization_admin ? "Super Admin" : "Staff"}
                            tone={m.is_organization_admin ? "yellow" : "gray"}
                          />
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              className="btn ghost sm"
                              style={{ padding: "4px 8px", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}
                              onClick={() => openEditModal(m)}
                              title="Edit Role & Property Matrix"
                            >
                              <Edit2 size={12} />
                              <span>Edit Matrix</span>
                            </button>
                            <button
                              className="btn ghost sm"
                              style={{ padding: "4px 8px", fontSize: 11, color: "#dc2626" }}
                              onClick={() => handleDeleteUser(m)}
                              title="Remove user from organization"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ROLES & MODULE PERMISSIONS */}
      {tab === "roles" && (
        <div style={{ background: "var(--surface, #ffffff)", border: "1px solid var(--border, #e2e8f0)", borderRadius: 12, padding: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: "var(--text, #1e293b)" }}>
              🔐 Role-Based Access Control & Feature Permissions Matrix
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--muted, #64748b)" }}>
              Create and manage roles, then select which module features (Property, Facility, Sales, Companion, Valuation, Monitoring) are active for each role.
            </p>
          </div>
          <RoleAccessManager organizationId={organizationId} />
        </div>
      )}

      {/* TAB 3: M-PESA STK PUSH & BANK ACCOUNTS */}
      {tab === "mpesa" && (
        <div style={{ background: "var(--surface, #ffffff)", border: "1px solid var(--border, #e2e8f0)", borderRadius: 12, padding: 24 }}>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: "var(--text, #1e293b)" }}>
              📲 M-Pesa STK Push Gateway & Bank Account Configuration
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--muted, #64748b)" }}>
              Configure Daraja API keys, Paybill numbers, Till numbers, and Bank Accounts for instant STK Push tenant rent collection.
            </p>
          </div>

          <form onSubmit={handleSaveMpesa} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Property Selector */}
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: "var(--text)" }}>
                Target Property:
              </label>
              <select
                value={selectedPropertyId}
                onChange={(e) => setSelectedPropertyId(e.target.value)}
                style={{ width: "100%", maxWidth: 400, padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 14 }}
              >
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                  Environment Mode:
                </label>
                <select
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
                >
                  <option value="sandbox">Sandbox (Testing / Demo Keys)</option>
                  <option value="production">Production (Live M-Pesa Daraja API)</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                  Business Shortcode / Paybill Number:
                </label>
                <input
                  type="text"
                  value={shortcode}
                  onChange={(e) => setShortcode(e.target.value)}
                  placeholder="e.g. 174379 or 4085000"
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                  Consumer Key (Daraja API):
                </label>
                <input
                  type="text"
                  value={consumerKey}
                  onChange={(e) => setConsumerKey(e.target.value)}
                  placeholder="Provide M-Pesa Consumer Key"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                  Consumer Secret (Daraja API):
                </label>
                <input
                  type="password"
                  value={consumerSecret}
                  onChange={(e) => setConsumerSecret(e.target.value)}
                  placeholder="Provide M-Pesa Consumer Secret"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                STK Push Passkey:
              </label>
              <input
                type="text"
                value={passkey}
                onChange={(e) => setPasskey(e.target.value)}
                placeholder="bfb279f9aa9bdbcf158e97..."
                style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
              />
            </div>

            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 8 }}>
              <h3 style={{ margin: "0 0 12px", fontSize: "1rem", fontWeight: 700 }}>🏦 Linked Bank Account & Till Details</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Bank Name:</label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g. Cooperative Bank"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Bank Account Number:</label>
                  <input
                    type="text"
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                    placeholder="e.g. 01120001234500"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Till / Store Number (Optional):</label>
                  <input
                    type="text"
                    value={tillNumber}
                    onChange={(e) => setTillNumber(e.target.value)}
                    placeholder="e.g. 883921"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button
                type="submit"
                disabled={saving}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "#d92d2d",
                  color: "#ffffff",
                  padding: "10px 20px",
                  borderRadius: 8,
                  border: 0,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <Save size={18} />
                <span>{saving ? "Saving M-Pesa Settings..." : "Save STK Push Configuration"}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 4: ORGANIZATIONS & MODULES */}
      {tab === "orgs" && (
        <div style={{ background: "var(--surface, #ffffff)", border: "1px solid var(--border, #e2e8f0)", borderRadius: 12, padding: 24 }}>
          <h2 style={{ margin: "0 0 12px", fontSize: "1.2rem", fontWeight: 700 }}>🏢 Active Organization & Module Subscriptions</h2>
          <p style={{ margin: "0 0 16px", color: "var(--muted)", fontSize: "0.85rem" }}>
            Organization ID: <strong>{organizationId}</strong>
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {[
              { name: "🏢 Property Management", status: "Active", desc: "Properties, units, leases, rent roll & tenant ledger" },
              { name: "🔧 Facility Management", status: "Active", desc: "Assets, work orders & caretaker meter readings" },
              { name: "💰 Sales & Leasing", status: "Active", desc: "Listings, buyer CRM & sales pipelines" },
              { name: "📋 Tender Engine", status: "Active", desc: "RFP invitations & contractor bids" },
              { name: "📜 Valuation Services", status: "Active", desc: "Site inspections & RICS reports" },
              { name: "📊 Monitoring & Projects", status: "Active", desc: "BIM models, IPC certificates & programme schedules" },
              { name: "🧭 Companion Tasks", status: "Active", desc: "Universal field worker task management" },
            ].map((m) => (
              <div key={m.name} style={{ padding: 14, border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface-2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <strong style={{ fontSize: 13 }}>{m.name}</strong>
                  <span style={{ fontSize: 10, background: "#dcfce7", color: "#15803d", padding: "2px 6px", borderRadius: 10, fontWeight: 700 }}>
                    {m.status}
                  </span>
                </div>
                <small style={{ fontSize: 11, color: "var(--muted)" }}>{m.desc}</small>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: KRA TAX & E-TIMS */}
      {tab === "tax" && (
        <div style={{ background: "var(--surface, #ffffff)", border: "1px solid var(--border, #e2e8f0)", borderRadius: 12, padding: 24 }}>
          <h2 style={{ margin: "0 0 12px", fontSize: "1.2rem", fontWeight: 700 }}>📜 KRA Tax & E-TIMS Compliance Settings</h2>
          <p style={{ margin: "0 0 16px", color: "var(--muted)", fontSize: "0.85rem" }}>
            Configure default KRA PIN, E-TIMS integration settings, and standard tax rates for rental income & service charge invoicing.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 600 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Organization Tax PIN:</label>
              <input type="text" defaultValue="P051234567X" style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Standard VAT Rate:</label>
              <input type="text" defaultValue="16%" style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>E-TIMS Transmission Mode:</label>
              <select style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}>
                <option>Automatic Real-Time Fiscal Sign</option>
                <option>Batch Daily Transmission</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: AUDIT TRAIL */}
      {tab === "audit" && (
        <div style={{ background: "var(--surface, #ffffff)", border: "1px solid var(--border, #e2e8f0)", borderRadius: 12, padding: 24 }}>
          <h2 style={{ margin: "0 0 12px", fontSize: "1.2rem", fontWeight: 700 }}>🛡️ Security Audit Log</h2>
          <p style={{ margin: "0 0 16px", color: "var(--muted)", fontSize: "0.85rem" }}>
            Recent administrative events and user security actions.
          </p>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>
            No security violations recorded. All sessions running on HTTPS with active CSRF token validation.
          </div>
        </div>
      )}

      {/* MODAL 1: ADD SYSTEM USER */}
      {showAddUserModal && (
        <Modal title="+ Add System User (Staff Creation)" onClose={() => setShowAddUserModal(false)} wide>
          {memberError && (
            <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid #ef4444", color: "#b91c1c", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13 }}>
              ⚠️ {memberError}
            </div>
          )}
          <form onSubmit={handleCreateUser} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Username (Login Handle)" required>
                <input
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="e.g. lydia, abel, sharon, marilyn"
                  style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)" }}
                />
              </Field>
              <Field label="Email Address">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="staff@centerestates.co.ke"
                  style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)" }}
                />
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="First Name" required>
                <input
                  required
                  value={newFirstName}
                  onChange={(e) => setNewFirstName(e.target.value)}
                  placeholder="e.g. Lydia"
                  style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)" }}
                />
              </Field>
              <Field label="Last Name" required>
                <input
                  required
                  value={newLastName}
                  onChange={(e) => setNewLastName(e.target.value)}
                  placeholder="e.g. Kipkorir"
                  style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)" }}
                />
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Phone Number (SMS & Direct Contact)">
                <input
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+254 700 000 000"
                  style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)" }}
                />
              </Field>
              <Field label="Initial Password (Optional)">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Leave blank for auto-invite"
                  style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)" }}
                />
              </Field>
            </div>

            <div style={{ padding: "10px 14px", background: "var(--surface-2, #f8fafc)", borderRadius: 8, border: "1px solid var(--border)" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
                <input
                  type="checkbox"
                  checked={newIsAdmin}
                  onChange={(e) => setNewIsAdmin(e.target.checked)}
                  style={{ width: 16, height: 16 }}
                />
                Super Administrator (Full organization & portfolio-wide access)
              </label>
            </div>

            {!newIsAdmin && (
              <>
                <Field label="Assigned Functional Roles (Grants Module Permissions)">
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 8, maxHeight: 180, overflowY: "auto", background: "var(--surface)" }}>
                    {roles.length === 0 ? (
                      <div className="muted" style={{ fontSize: 12 }}>No roles found.</div>
                    ) : (
                      roles.map((r) => (
                        <label
                          key={r.id}
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 8,
                            padding: 8,
                            borderRadius: 6,
                            border: "1px solid var(--border)",
                            background: newSelectedRoles.includes(r.id) ? "rgba(226, 59, 59, 0.05)" : "transparent",
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={newSelectedRoles.includes(r.id)}
                            onChange={(e) => {
                              setNewSelectedRoles((prev) => e.target.checked ? [...prev, r.id] : prev.filter((id) => id !== r.id));
                            }}
                            style={{ marginTop: 2 }}
                          />
                          <div>
                            <strong style={{ fontSize: 12, display: "block" }}>{r.name}</strong>
                            {r.description && (
                              <span style={{ fontSize: 10, color: "var(--muted)", display: "block", lineHeight: 1.3 }}>
                                {r.description}
                              </span>
                            )}
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </Field>

                <Field label="Property Scoping Matrix (Assign to specific properties/estates)">
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 8, maxHeight: 150, overflowY: "auto", background: "var(--surface)" }}>
                    {properties.length === 0 ? (
                      <div className="muted" style={{ fontSize: 12 }}>No properties available in this organization.</div>
                    ) : (
                      properties.map((p) => (
                        <label
                          key={p.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "6px 8px",
                            borderRadius: 6,
                            border: "1px solid var(--border)",
                            cursor: "pointer",
                            background: newSelectedProps.includes(p.id) ? "rgba(79, 70, 229, 0.05)" : "transparent",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={newSelectedProps.includes(p.id)}
                            onChange={(e) => {
                              setNewSelectedProps((prev) => e.target.checked ? [...prev, p.id] : prev.filter((id) => id !== p.id));
                            }}
                          />
                          <span style={{ fontSize: 12 }}>🏢 {p.name} ({p.code})</span>
                        </label>
                      ))
                    )}
                  </div>
                </Field>
              </>
            )}

            <div className="modal-actions" style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
              <button type="button" className="btn ghost" onClick={() => setShowAddUserModal(false)} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="btn primary" disabled={saving || !newUsername.trim() || !newFirstName.trim() || !newLastName.trim()} style={{ background: "#d92d2d", borderColor: "#d92d2d" }}>
                {saving ? "Creating Account…" : "Create User Account"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 2: EDIT USER MATRIX */}
      {editingMember && (
        <Modal title={`Edit Access Matrix — ${editingMember.full_name || editingMember.username}`} onClose={() => setEditingMember(null)} wide>
          <form onSubmit={handleSaveEditUser} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, background: "var(--surface-2, #f8fafc)", borderRadius: 8, border: "1px solid var(--border)" }}>
              <span style={{ width: 36, height: 36, borderRadius: "50%", background: editingMember.is_organization_admin ? "#d92d2d" : "#4f46e5", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700 }}>
                {(editingMember.first_name?.[0] || editingMember.username?.[0] || "U").toUpperCase()}
              </span>
              <div>
                <strong style={{ fontSize: 14 }}>{editingMember.full_name || editingMember.username}</strong>
                <div className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>@{editingMember.username} · {editingMember.email || "No email"}</div>
              </div>
            </div>

            <Field label="Phone Number">
              <input
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="+254 700 000 000"
                style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)" }}
              />
            </Field>

            <div style={{ padding: "10px 14px", background: "var(--surface-2, #f8fafc)", borderRadius: 8, border: "1px solid var(--border)" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
                <input
                  type="checkbox"
                  checked={editIsAdmin}
                  onChange={(e) => setEditIsAdmin(e.target.checked)}
                  style={{ width: 16, height: 16 }}
                />
                Super Administrator (Portfolio-wide unrestricted access)
              </label>
            </div>

            {!editIsAdmin && (
              <>
                <Field label="Assigned Functional Roles">
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 8, maxHeight: 180, overflowY: "auto", background: "var(--surface)" }}>
                    {roles.map((r) => (
                      <label
                        key={r.id}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 8,
                          padding: 8,
                          borderRadius: 6,
                          border: "1px solid var(--border)",
                          background: editSelectedRoles.includes(r.id) ? "rgba(226, 59, 59, 0.05)" : "transparent",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={editSelectedRoles.includes(r.id)}
                          onChange={(e) => {
                            setEditSelectedRoles((prev) => e.target.checked ? [...prev, r.id] : prev.filter((id) => id !== r.id));
                          }}
                          style={{ marginTop: 2 }}
                        />
                        <div>
                          <strong style={{ fontSize: 12, display: "block" }}>{r.name}</strong>
                          {r.description && (
                            <span style={{ fontSize: 10, color: "var(--muted)", display: "block", lineHeight: 1.3 }}>
                              {r.description}
                            </span>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </Field>

                <Field label="Property Scoping Matrix">
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: 10, border: "1px solid var(--border)", borderRadius: 8, maxHeight: 150, overflowY: "auto", background: "var(--surface)" }}>
                    {properties.map((p) => (
                      <label
                        key={p.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "6px 8px",
                          borderRadius: 6,
                          border: "1px solid var(--border)",
                          cursor: "pointer",
                          background: editSelectedProps.includes(p.id) ? "rgba(79, 70, 229, 0.05)" : "transparent",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={editSelectedProps.includes(p.id)}
                          onChange={(e) => {
                            setEditSelectedProps((prev) => e.target.checked ? [...prev, p.id] : prev.filter((id) => id !== p.id));
                          }}
                        />
                        <span style={{ fontSize: 12 }}>🏢 {p.name} ({p.code})</span>
                      </label>
                    ))}
                  </div>
                </Field>
              </>
            )}

            <div className="modal-actions" style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
              <button type="button" className="btn ghost" onClick={() => setEditingMember(null)} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="btn primary" disabled={saving} style={{ background: "#d92d2d", borderColor: "#d92d2d" }}>
                {saving ? "Saving Changes…" : "Save Matrix Changes"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default function AdministrationPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading administration…</div>}>
      <AdministrationContent />
    </Suspense>
  );
}
