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
import { FeedbackQrManager } from "@/components/feedback-qr-manager";
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

const MODULE_DEFINITIONS = [
  { slug: "property", label: "Property Management", icon: "🏢", accent: "#0284c7", desc: "Properties, units, leases, rent collection & tenancy ledger" },
  { slug: "facility", label: "Facility Management", icon: "🔧", accent: "#ea580c", desc: "Asset register, maintenance work orders & PPM schedules" },
  { slug: "monitoring", label: "Construction & Monitoring", icon: "🏗️", accent: "#16a34a", desc: "Site diaries, IPC payment certificates & contractor tracking" },
  { slug: "sales", label: "Sales & Marketing", icon: "💰", accent: "#8b5cf6", desc: "Property listings, buyer KYC, installments & reservation pipeline" },
  { slug: "valuation", label: "Valuation & Advisory", icon: "📜", accent: "#0d9488", desc: "Valuation instructions, inspection schedules & appraisal reports" },
  { slug: "tender", label: "Tenders & Procurement", icon: "📑", accent: "#d97706", desc: "Procurement invitations, contractor bids & tender evaluation board" },
  { slug: "companion", label: "Operations Companion", icon: "🤖", accent: "#4f46e5", desc: "Team tasks, daily briefings, staff feedback & HR approvals" },
];

function getRoleModule(role: RoleItem): string {
  const slug = (role.slug || "").toLowerCase();
  if (slug.startsWith("clerk-of-works") || slug.startsWith("construction") || slug.startsWith("quantity-surveyor")) return "monitoring";
  if (slug.startsWith("facility")) return "facility";
  if (slug.startsWith("sales") || slug.startsWith("site-clerk")) return "sales";
  if (slug.startsWith("valuation") || slug.startsWith("valuer")) return "valuation";
  if (slug.startsWith("tender") || slug.startsWith("pricing")) return "tender";
  if (slug.startsWith("property") || slug.startsWith("leasing") || slug.startsWith("finance") || slug.startsWith("read-only")) return "property";
  if (slug.startsWith("caretaker") || slug.startsWith("operations") || slug.startsWith("companion") || slug.startsWith("portfolio") || slug.startsWith("platform-admin")) return "companion";
  return "property";
}

function AdministrationContent() {
  const { session } = useAuth();
  const searchParams = useSearchParams();
  const isSuperAdministrator = Boolean(
    session?.user.isSuperuser ||
    session?.roles?.includes("platform-admin") ||
    session?.roles?.includes("super-admin")
  );
  const isFinanceAdmin = Boolean(
    isSuperAdministrator ||
    session?.permissions?.includes("property.finance") ||
    session?.roles?.some((r) => r.includes("finance") || r.includes("admin") || r.includes("manager"))
  );
  const organizationId = session?.activeOrganizationId ?? null;

  // Active subtab read from sidebar URL search parameter
  const urlTab = searchParams ? searchParams.get("tab") : null;
  const tab = (urlTab && ["users", "roles", "mpesa", "smtp", "orgs", "tax", "audit", "feedback-qr"].includes(urlTab))
    ? (urlTab as "users" | "roles" | "mpesa" | "smtp" | "orgs" | "tax" | "audit" | "feedback-qr")
    : (isSuperAdministrator ? "users" : "mpesa");

  const canAccessAdministration = isSuperAdministrator || ((tab === "mpesa" || tab === "smtp") && isFinanceAdmin);

  // Shared Data
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Administration Datasets
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [properties, setProperties] = useState<PropertyItem[]>([]);

  // User Table Search & Filters
  const [userSearch, setUserSearch] = useState("");
  const [selectedPropertyFilter, setSelectedPropertyFilter] = useState<string>("all");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>("all");

  // User Management Modals
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [editingMember, setEditingMember] = useState<MemberItem | null>(null);
  const [memberError, setMemberError] = useState<string | null>(null);

  // Matrix Filter / Search State
  const [matrixRoleSearch, setMatrixRoleSearch] = useState("");
  const [matrixPropSearch, setMatrixPropSearch] = useState("");
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({
    property: true,
    facility: true,
    monitoring: true,
    sales: true,
    valuation: true,
    tender: true,
    companion: true,
  });

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

  // Email SMTP Form fields
  const [smtpConfigId, setSmtpConfigId] = useState<string>("");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("465");
  const [smtpUsername, setSmtpUsername] = useState("companion@centerestates.com");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [smtpUseTls, setSmtpUseTls] = useState(false);
  const [smtpUseSsl, setSmtpUseSsl] = useState(true);
  const [smtpFromEmail, setSmtpFromEmail] = useState("companion@centerestates.com");
  const [smtpFromName, setSmtpFromName] = useState("Center Estates");
  const [smtpIsActive, setSmtpIsActive] = useState(true);
  const [testEmailAddress, setTestEmailAddress] = useState("samnmbuguah@gmail.com");
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function applySmtpPreset(provider: "cpanel" | "gmail" | "m365") {
    if (provider === "cpanel") {
      setSmtpHost("mail.centerestates.com");
      setSmtpPort("465");
      setSmtpUseSsl(true);
      setSmtpUseTls(false);
      setSmtpFromEmail("companion@centerestates.com");
      setSmtpUsername("companion@centerestates.com");
      setSmtpFromName("Center Estates");
    } else if (provider === "gmail") {
      setSmtpHost("smtp.gmail.com");
      setSmtpPort("587");
      setSmtpUseTls(true);
      setSmtpUseSsl(false);
    } else if (provider === "m365") {
      setSmtpHost("smtp.office365.com");
      setSmtpPort("587");
      setSmtpUseTls(true);
      setSmtpUseSsl(false);
    }
  }


  // 1. Load Properties & Roles
  const loadPropertiesAndRoles = useCallback(async () => {
    if (!organizationId || (!isSuperAdministrator && !isFinanceAdmin)) return;
    try {
      const [propRes, rolesRes] = await Promise.all([
        apiFetch("/property/properties/", {}, organizationId),
        isSuperAdministrator ? apiFetch("/access/roles/", {}, organizationId) : Promise.resolve(new Response(JSON.stringify([]))),
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
  }, [organizationId, isSuperAdministrator, isFinanceAdmin, selectedPropertyId]);

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
    if (!organizationId || !selectedPropertyId || (!isSuperAdministrator && !isFinanceAdmin)) return;
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
  }, [organizationId, selectedPropertyId, isSuperAdministrator, isFinanceAdmin]);

  // 4. Load SMTP Configuration
  const loadSmtpConfig = useCallback(async () => {
    if (!organizationId || (!isSuperAdministrator && !isFinanceAdmin)) return;
    try {
      const res = await apiFetch("/notifications/email-settings/", {}, organizationId);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.results || [];
        const activeConfig = list.find((c: any) => c.is_active) || list[0];
        if (activeConfig) {
          setSmtpConfigId(activeConfig.id);
          setSmtpHost(activeConfig.host || "");
          setSmtpPort(String(activeConfig.port || 587));
          setSmtpUsername(activeConfig.username || "");
          setSmtpUseTls(activeConfig.use_tls ?? true);
          setSmtpUseSsl(activeConfig.use_ssl ?? false);
          setSmtpFromEmail(activeConfig.from_email || "notifications@centerestates.com");
          setSmtpFromName(activeConfig.from_name || "Center Estates");
          setSmtpIsActive(activeConfig.is_active ?? true);
        }
      }
    } catch (err) {
      console.error("Failed to load SMTP settings", err);
    }
  }, [organizationId, isSuperAdministrator, isFinanceAdmin]);

  useEffect(() => {
    void loadPropertiesAndRoles();
    void loadMembers();
    void loadSmtpConfig();
  }, [loadPropertiesAndRoles, loadMembers, loadSmtpConfig]);

  useEffect(() => {
    if (selectedPropertyId) {
      void loadGateway();
    }
  }, [selectedPropertyId, loadGateway]);

  async function handleSaveSmtp(e: FormEvent) {
    e.preventDefault();
    if (!organizationId) return;
    setSaving(true);
    setNotice(null);
    try {
      const payload: any = {
        host: smtpHost.trim(),
        port: parseInt(smtpPort, 10) || 587,
        username: smtpUsername.trim(),
        use_tls: smtpUseTls,
        use_ssl: smtpUseSsl,
        from_email: smtpFromEmail.trim(),
        from_name: smtpFromName.trim(),
        is_active: smtpIsActive,
      };
      if (smtpPassword) {
        payload.password = smtpPassword;
      }
      const url = smtpConfigId
        ? `/notifications/email-settings/${smtpConfigId}/`
        : `/notifications/email-settings/`;
      const method = smtpConfigId ? "PATCH" : "POST";

      const res = await apiFetch(
        url,
        {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
        organizationId
      );

      if (res.ok) {
        const body = await res.json();
        setSmtpConfigId(body.id);
        setSmtpPassword("");
        setNotice({ type: "success", text: "Organization SMTP settings saved successfully." });
      } else {
        const body = await res.json().catch(() => ({}));
        setNotice({ type: "error", text: body.detail || "Failed to save SMTP settings." });
      }
    } catch {
      setNotice({ type: "error", text: "Failed to save SMTP configuration. Check connection." });
    } finally {
      setSaving(false);
    }
  }

  async function handleTestSmtp() {
    if (!organizationId) return;
    setTestingSmtp(true);
    setSmtpTestResult(null);
    try {
      const res = await apiFetch(
        "/notifications/email-settings/test/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            test_email: testEmailAddress || undefined,
            host: smtpHost || undefined,
            port: parseInt(smtpPort, 10) || undefined,
            username: smtpUsername || undefined,
            password: smtpPassword || undefined,
            use_tls: smtpUseTls,
            use_ssl: smtpUseSsl,
            from_email: smtpFromEmail || undefined,
            from_name: smtpFromName || undefined,
          }),
        },
        organizationId
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSmtpTestResult({ type: "success", text: data.detail || "Diagnostic test email dispatched successfully!" });
      } else {
        setSmtpTestResult({ type: "error", text: data.detail || "Failed to dispatch test email." });
      }
    } catch {
      setSmtpTestResult({ type: "error", text: "Test email dispatch failed due to network error." });
    } finally {
      setTestingSmtp(false);
    }
  }

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

  if (session && !canAccessAdministration) {
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
            <span>Add System User</span>
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
                    Add System User
                  </button>
                }
              />
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--border)", background: "var(--surface-sunken)", textAlign: "left" }}>
                      <th style={{ padding: "12px 14px", fontWeight: 700, color: "var(--text-secondary)", width: "32%" }}>User & Contact</th>
                      <th style={{ padding: "12px 14px", fontWeight: 700, color: "var(--text-secondary)", width: "26%" }}>Assigned Roles</th>
                      <th style={{ padding: "12px 14px", fontWeight: 700, color: "var(--text-secondary)", width: "27%" }}>Assigned Properties (Estates)</th>
                      <th style={{ padding: "12px 14px", fontWeight: 700, color: "var(--text-secondary)", width: "15%", textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMembers.map((m) => (
                      <tr key={m.id} style={{ borderBottom: "1px solid var(--border)", transition: "background 0.15s" }}>
                        <td style={{ padding: "12px 14px", verticalAlign: "top" }}>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                            <span
                              style={{
                                width: 36,
                                height: 36,
                                minWidth: 36,
                                borderRadius: "50%",
                                background: m.is_organization_admin ? "linear-gradient(135deg, #d92d2d, #b91c1c)" : "linear-gradient(135deg, #4f46e5, #3730a3)",
                                color: "#fff",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 13,
                                fontWeight: 700,
                                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                              }}
                            >
                              {(m.first_name?.[0] || m.username?.[0] || "U").toUpperCase()}
                            </span>
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <strong style={{ fontSize: 14, color: "var(--text)" }}>
                                  {m.full_name || m.username}
                                </strong>
                                <span className="mono" style={{ fontSize: 11, color: "var(--muted)", background: "var(--surface-sunken)", padding: "1px 6px", borderRadius: 4, border: "1px solid var(--border)" }}>
                                  @{m.username}
                                </span>
                                {m.is_organization_admin && (
                                  <span style={{ fontSize: 10, fontWeight: 700, background: "#fef3c7", color: "#92400e", padding: "1px 6px", borderRadius: 10 }}>
                                    Super Admin
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 12, color: "var(--muted)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 2 }}>
                                {m.email ? (
                                  <a href={`mailto:${m.email}`} style={{ color: "var(--primary, #d92d2d)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
                                    <span>✉️</span> {m.email}
                                  </a>
                                ) : (
                                  <span className="muted">No email</span>
                                )}
                                {m.phone_number && (
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--text)" }}>
                                    <span>📞</span> {m.phone_number}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "12px 14px", verticalAlign: "top" }}>
                          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                            {m.roles?.length > 0 ? (
                              m.roles.map((r) => (
                                <Badge key={r.id} tone={m.is_organization_admin ? "purple" : "blue"}>
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
                        <td style={{ padding: "12px 14px", verticalAlign: "top" }}>
                          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                            {m.is_organization_admin ? (
                              <span style={{ fontSize: 12, padding: "3px 8px", background: "#e0f2fe", color: "#0369a1", borderRadius: 6, fontWeight: 600, border: "1px solid #bae6fd" }}>
                                🌐 All Properties (Portfolio-wide)
                              </span>
                            ) : m.assigned_properties?.length > 0 ? (
                              m.assigned_properties.map((p) => (
                                <span
                                  key={p.id}
                                  style={{
                                    fontSize: 11,
                                    padding: "3px 8px",
                                    background: "var(--surface-sunken)",
                                    borderRadius: 6,
                                    color: "var(--text)",
                                    border: "1px solid var(--border)",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                  }}
                                >
                                  <span>🏢</span>
                                  <strong>{p.name}</strong>
                                  <span className="mono muted" style={{ fontSize: 10 }}>({p.code})</span>
                                </span>
                              ))
                            ) : (
                              <span className="muted" style={{ fontSize: 12 }}>
                                General / Unrestricted
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: "12px 14px", verticalAlign: "top", textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: 8, alignItems: "center", justifyContent: "flex-end" }}>
                            <button
                              className="btn ghost sm"
                              style={{
                                padding: "6px 12px",
                                fontSize: 12,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                fontWeight: 600,
                                borderRadius: 6,
                                border: "1px solid var(--border)",
                              }}
                              onClick={() => openEditModal(m)}
                              title="Edit Role & Property Matrix"
                            >
                              <Edit2 size={13} />
                              <span>Edit Matrix</span>
                            </button>
                            <button
                              className="btn ghost sm"
                              style={{
                                padding: "6px 10px",
                                fontSize: 12,
                                color: "#dc2626",
                                background: "rgba(220, 38, 38, 0.06)",
                                border: "1px solid rgba(220, 38, 38, 0.2)",
                                borderRadius: 6,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 5,
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                              onClick={() => handleDeleteUser(m)}
                              title="Remove user from organization"
                            >
                              <Trash2 size={13} color="#dc2626" />
                              <span>Delete</span>
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

      {/* TAB: EMAIL SMTP GATEWAY */}
      {tab === "smtp" && (
        <div style={{ background: "var(--surface, #ffffff)", border: "1px solid var(--border, #e2e8f0)", borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
          <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid var(--border)" }}>
            <h2 style={{ margin: "0 0 4px", fontSize: "1.25rem", fontWeight: 800, display: "flex", alignItems: "center", gap: 10, color: "var(--text)" }}>
              <span>✉️ Organizational Email SMTP Gateway</span>
            </h2>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.875rem" }}>
              Configure outbound SMTP credentials to send instant transactional emails, tenant invoices, M-Pesa receipts, task assignments, and smart helpdesk notifications.
            </p>
          </div>

          {/* Quick Setup Presets */}
          <div style={{ marginBottom: 18, background: "rgba(59, 130, 246, 0.05)", border: "1px solid rgba(59, 130, 246, 0.2)", borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#1e40af", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              ⚡ 1-Click Mail Server Presets:
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => applySmtpPreset("cpanel")}
                className="btn ghost sm"
                style={{ background: "#ffffff", border: "1px solid #bfdbfe", color: "#1e40af", fontWeight: 700, fontSize: 12, borderRadius: 6 }}
              >
                🚀 Center Estates Webmail (mail.centerestates.com : 465 SSL)
              </button>
              <button
                type="button"
                onClick={() => applySmtpPreset("gmail")}
                className="btn ghost sm"
                style={{ background: "#ffffff", border: "1px solid #e2e8f0", color: "#334155", fontWeight: 600, fontSize: 12, borderRadius: 6 }}
              >
                🌐 Google Workspace (smtp.gmail.com : 587 TLS)
              </button>
              <button
                type="button"
                onClick={() => applySmtpPreset("m365")}
                className="btn ghost sm"
                style={{ background: "#ffffff", border: "1px solid #e2e8f0", color: "#334155", fontWeight: 600, fontSize: 12, borderRadius: 6 }}
              >
                💼 Microsoft 365 (smtp.office365.com : 587 TLS)
              </button>
            </div>
          </div>

          <form onSubmit={handleSaveSmtp} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Server Settings */}
            <div style={{ background: "var(--surface-sunken, #f8fafc)", border: "1px solid var(--border)", borderRadius: 10, padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                1. Outbound Mail Server Details
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                    SMTP Host / Server Address <span style={{ color: "#dc2626" }}>*</span>:
                  </label>
                  <input
                    type="text"
                    required
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder="e.g. mail.centerestates.com or smtp.gmail.com"
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                    SMTP Port <span style={{ color: "#dc2626" }}>*</span>:
                  </label>
                  <input
                    type="number"
                    required
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(e.target.value)}
                    placeholder="465 (SSL) or 587 (TLS)"
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)" }}
                  />
                </div>
              </div>

              {/* Security & Protocol */}
              <div style={{ display: "flex", gap: 24, marginTop: 14 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="smtp_encryption"
                    checked={smtpUseSsl}
                    onChange={() => {
                      setSmtpUseSsl(true);
                      setSmtpUseTls(false);
                      setSmtpPort("465");
                    }}
                  />
                  <span>Direct SSL/TLS (Port 465 - Recommended for cPanel)</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="smtp_encryption"
                    checked={smtpUseTls}
                    onChange={() => {
                      setSmtpUseTls(true);
                      setSmtpUseSsl(false);
                      setSmtpPort("587");
                    }}
                  />
                  <span>STARTTLS (Port 587 - Gmail / Outlook)</span>
                </label>
              </div>
            </div>

            {/* Authentication Credentials */}
            <div style={{ background: "var(--surface-sunken, #f8fafc)", border: "1px solid var(--border)", borderRadius: 10, padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                2. Authentication &amp; Sender Profile
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <label style={{ fontSize: 12, fontWeight: 700 }}>
                      SMTP Username / Login <span style={{ color: "#dc2626" }}>*</span>:
                    </label>
                    <button
                      type="button"
                      onClick={() => setSmtpUsername("companion@centerestates.com")}
                      style={{ background: "none", border: "none", color: "#2563eb", fontSize: 11, fontWeight: 600, cursor: "pointer", padding: 0 }}
                    >
                      Use companion@centerestates.com
                    </button>
                  </div>
                  <input
                    type="text"
                    value={smtpUsername}
                    onChange={(e) => setSmtpUsername(e.target.value)}
                    placeholder="e.g. companion@centerestates.com"
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                    SMTP Password:
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showSmtpPassword ? "text" : "password"}
                      value={smtpPassword}
                      onChange={(e) => setSmtpPassword(e.target.value)}
                      placeholder={smtpConfigId ? "(Saved — enter new to overwrite)" : "Enter SMTP account password"}
                      style={{ width: "100%", padding: "9px 40px 9px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)" }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                      style={{
                        position: "absolute",
                        right: 10,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        fontSize: 14,
                        cursor: "pointer",
                        opacity: 0.7,
                      }}
                      title={showSmtpPassword ? "Hide Password" : "Show Password"}
                    >
                      {showSmtpPassword ? "🙈" : "👁️"}
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                    From Email Address <span style={{ color: "#dc2626" }}>*</span>:
                  </label>
                  <input
                    type="email"
                    required
                    value={smtpFromEmail}
                    onChange={(e) => setSmtpFromEmail(e.target.value)}
                    placeholder="companion@centerestates.com"
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                    Sender Display Name:
                  </label>
                  <input
                    type="text"
                    value={smtpFromName}
                    onChange={(e) => setSmtpFromName(e.target.value)}
                    placeholder="Center Estates"
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)" }}
                  />
                </div>
              </div>
            </div>

            {/* Diagnostic Email Test Box */}
            <div style={{ background: "#f0fdf4", border: "1.5px solid #86efac", borderRadius: 10, padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#166534", marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
                <span>🧪 Test SMTP Outbound Connection</span>
              </div>
              <p style={{ margin: "0 0 12px", fontSize: 12, color: "#166534" }}>
                Send a real-time diagnostic test email to verify DNS, authentication, and port delivery without waiting for system events.
              </p>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <input
                  type="email"
                  value={testEmailAddress}
                  onChange={(e) => setTestEmailAddress(e.target.value)}
                  placeholder={`Recipient email (defaults to ${session?.user.email || "samnmbuguah@gmail.com"})`}
                  style={{ flex: 1, minWidth: 260, padding: "8px 12px", borderRadius: 6, border: "1px solid #86efac", background: "#fff", fontSize: 13 }}
                />
                <button
                  type="button"
                  disabled={testingSmtp}
                  onClick={() => void handleTestSmtp()}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 6,
                    border: 0,
                    background: "#16a34a",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {testingSmtp ? "Dispatching Test Email…" : "🚀 Send Test Email"}
                </button>
              </div>

              {smtpTestResult && (
                <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: 6, background: smtpTestResult.type === "success" ? "#dcfce7" : "#fee2e2", color: smtpTestResult.type === "success" ? "#166534" : "#991b1b", fontSize: 13, fontWeight: 600 }}>
                  {smtpTestResult.type === "success" ? "✓ " : "⚠️ "}{smtpTestResult.text}
                </div>
              )}
            </div>

            {/* Save Buttons */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button
                type="submit"
                disabled={saving}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "#dc2626",
                  color: "#ffffff",
                  padding: "10px 22px",
                  borderRadius: 8,
                  border: 0,
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(220,38,38,0.25)",
                }}
              >
                <Save size={16} />
                <span>{saving ? "Saving SMTP Gateway..." : "Save SMTP Gateway Settings"}</span>
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

      {tab === "feedback-qr" && <FeedbackQrManager organizationId={organizationId} />}

      {/* MODAL 1: ADD SYSTEM USER */}
      {showAddUserModal && (
        <Modal title="Add System User (Staff Creation)" onClose={() => setShowAddUserModal(false)} wide>
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

            {/* ADD USER: Module Entitlement & Roles */}
            <div style={{ background: "var(--surface, #ffffff)", border: "1px solid var(--border, #e2e8f0)", borderRadius: 10, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
                <div>
                  <strong style={{ fontSize: 13, display: "block" }}>📦 Module Access &amp; Functional Roles</strong>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>Toggle modules ON/OFF and assign specific functional roles</span>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    type="text"
                    value={matrixRoleSearch}
                    onChange={(e) => setMatrixRoleSearch(e.target.value)}
                    placeholder="Filter roles…"
                    style={{ padding: "4px 8px", fontSize: 11, borderRadius: 5, border: "1px solid var(--border)", width: 130 }}
                  />
                  <button
                    type="button"
                    onClick={() => setNewSelectedRoles(roles.map((r) => r.id))}
                    style={{ fontSize: 11, color: "var(--primary, #d92d2d)", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewSelectedRoles([])}
                    style={{ fontSize: 11, color: "var(--muted)", background: "none", border: "none", cursor: "pointer" }}
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 240, overflowY: "auto" }}>
                {MODULE_DEFINITIONS.map((mod) => {
                  const modRoles = roles.filter((r) => getRoleModule(r) === mod.slug);
                  const filteredModRoles = matrixRoleSearch.trim()
                    ? modRoles.filter((r) => r.name.toLowerCase().includes(matrixRoleSearch.toLowerCase()) || (r.description && r.description.toLowerCase().includes(matrixRoleSearch.toLowerCase())))
                    : modRoles;

                  if (matrixRoleSearch.trim() && filteredModRoles.length === 0) return null;

                  const activeModRoles = modRoles.filter((r) => newSelectedRoles.includes(r.id));
                  const isModActive = activeModRoles.length > 0 || newIsAdmin;
                  const isExpanded = expandedModules[mod.slug] ?? true;

                  return (
                    <div
                      key={mod.slug}
                      style={{
                        border: isModActive ? `1px solid ${mod.accent}` : "1px solid var(--border)",
                        borderRadius: 8,
                        background: isModActive ? "var(--surface)" : "var(--surface-sunken, #f8fafc)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "8px 12px",
                          background: isModActive ? `linear-gradient(90deg, ${mod.accent}0f, transparent)` : "transparent",
                          cursor: "pointer",
                        }}
                        onClick={() => setExpandedModules((prev) => ({ ...prev, [mod.slug]: !isExpanded }))}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 16 }}>{mod.icon}</span>
                          <div>
                            <strong style={{ fontSize: 12, color: isModActive ? mod.accent : "var(--text)" }}>{mod.label}</strong>
                            <span style={{ fontSize: 10, color: "var(--muted)", marginLeft: 8 }}>
                              {isModActive ? `${activeModRoles.length} roles active` : "Disabled"}
                            </span>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }} onClick={(e) => e.stopPropagation()}>
                          <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 11, fontWeight: 700, color: isModActive ? mod.accent : "var(--muted)" }}>
                            <span>{isModActive ? "ON" : "OFF"}</span>
                            <input
                              type="checkbox"
                              checked={isModActive}
                              onChange={(e) => {
                                const enable = e.target.checked;
                                if (enable) {
                                  const idsToAdd = modRoles.map((r) => r.id);
                                  setNewSelectedRoles((prev) => Array.from(new Set([...prev, ...idsToAdd])));
                                } else {
                                  const idsToRemove = new Set(modRoles.map((r) => r.id));
                                  setNewSelectedRoles((prev) => prev.filter((id) => !idsToRemove.has(id)));
                                }
                              }}
                              style={{ width: 14, height: 14, cursor: "pointer" }}
                            />
                          </label>
                          <span style={{ fontSize: 10, color: "var(--muted)" }}>{isExpanded ? "▲" : "▼"}</span>
                        </div>
                      </div>

                      {isExpanded && (
                        <div style={{ padding: "8px 12px", borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                            {filteredModRoles.map((r) => {
                              const isSelected = newSelectedRoles.includes(r.id);
                              return (
                                <label
                                  key={r.id}
                                  style={{
                                    display: "flex",
                                    alignItems: "flex-start",
                                    gap: 6,
                                    padding: "5px 8px",
                                    borderRadius: 5,
                                    border: isSelected ? `1px solid ${mod.accent}` : "1px solid var(--border)",
                                    background: isSelected ? `${mod.accent}0d` : "transparent",
                                    cursor: "pointer",
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      setNewSelectedRoles((prev) => e.target.checked ? [...prev, r.id] : prev.filter((id) => id !== r.id));
                                    }}
                                    style={{ marginTop: 2, cursor: "pointer" }}
                                  />
                                  <div style={{ minWidth: 0 }}>
                                    <strong style={{ fontSize: 11, display: "block", color: isSelected ? mod.accent : "var(--text)" }}>{r.name}</strong>
                                    {r.description && <span style={{ fontSize: 9, color: "var(--muted)", display: "block", lineHeight: 1.2 }}>{r.description}</span>}
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ADD USER: Property Scoping */}
            <div style={{ background: "var(--surface, #ffffff)", border: "1px solid var(--border, #e2e8f0)", borderRadius: 10, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
                <div>
                  <strong style={{ fontSize: 13, display: "block" }}>🏢 Property Scoping ({newSelectedProps.length} of {properties.length} assigned)</strong>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>Restrict data visibility and actions to designated properties</span>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    type="text"
                    value={matrixPropSearch}
                    onChange={(e) => setMatrixPropSearch(e.target.value)}
                    placeholder="Filter estates…"
                    style={{ padding: "4px 8px", fontSize: 11, borderRadius: 5, border: "1px solid var(--border)", width: 130 }}
                  />
                  <button
                    type="button"
                    onClick={() => setNewSelectedProps(properties.map((p) => p.id))}
                    style={{ fontSize: 11, color: "var(--primary, #d92d2d)", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}
                  >
                    Select All ({properties.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewSelectedProps([])}
                    style={{ fontSize: 11, color: "var(--muted)", background: "none", border: "none", cursor: "pointer" }}
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, maxHeight: 150, overflowY: "auto" }}>
                {properties.length === 0 ? (
                  <div className="muted" style={{ fontSize: 11, gridColumn: "1 / -1", textAlign: "center", padding: 8 }}>No properties available.</div>
                ) : (
                  properties
                    .filter((p) => !matrixPropSearch.trim() || p.name.toLowerCase().includes(matrixPropSearch.toLowerCase()) || p.code.toLowerCase().includes(matrixPropSearch.toLowerCase()))
                    .map((p) => {
                      const isSelected = newSelectedProps.includes(p.id);
                      return (
                        <label
                          key={p.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "6px 8px",
                            borderRadius: 5,
                            border: isSelected ? "1px solid #0284c7" : "1px solid var(--border)",
                            cursor: "pointer",
                            background: isSelected ? "rgba(2, 132, 199, 0.08)" : "transparent",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              setNewSelectedProps((prev) => e.target.checked ? [...prev, p.id] : prev.filter((id) => id !== p.id));
                            }}
                          />
                          <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                            <strong style={{ fontSize: 11, color: isSelected ? "#0369a1" : "var(--text)" }}>{p.name}</strong>
                            <span className="mono muted" style={{ fontSize: 9, background: "var(--surface-sunken)", padding: "1px 3px", borderRadius: 3, border: "1px solid var(--border)" }}>
                              {p.code}
                            </span>
                          </div>
                        </label>
                      );
                    })
                )}
              </div>
            </div>

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
            {/* User Identity Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, background: "var(--surface-2, #f8fafc)", borderRadius: 10, border: "1px solid var(--border)" }}>
              <span style={{ width: 44, height: 44, borderRadius: "50%", background: editingMember.is_organization_admin ? "linear-gradient(135deg, #d92d2d, #b91c1c)" : "linear-gradient(135deg, #4f46e5, #3730a3)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800 }}>
                {(editingMember.first_name?.[0] || editingMember.username?.[0] || "U").toUpperCase()}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <strong style={{ fontSize: 16, fontWeight: 800 }}>{editingMember.full_name || editingMember.username}</strong>
                  <span className="mono" style={{ fontSize: 12, color: "var(--muted)", background: "var(--surface)", padding: "2px 8px", borderRadius: 6, border: "1px solid var(--border)" }}>
                    @{editingMember.username}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
                  ✉️ {editingMember.email || "No email"} {editingMember.phone_number ? `· 📞 ${editingMember.phone_number}` : ""}
                </div>
              </div>
            </div>

            <Field label="Contact Phone Number">
              <input
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="+254 700 000 000"
                style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 13 }}
              />
            </Field>

            {/* Super Admin Switch */}
            <div style={{ padding: "12px 16px", background: editIsAdmin ? "#fef3c7" : "var(--surface-2, #f8fafc)", borderRadius: 10, border: editIsAdmin ? "1px solid #fde68a" : "1px solid var(--border)" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13, fontWeight: 800, color: editIsAdmin ? "#92400e" : "var(--text)" }}>
                <input
                  type="checkbox"
                  checked={editIsAdmin}
                  onChange={(e) => setEditIsAdmin(e.target.checked)}
                  style={{ width: 18, height: 18, cursor: "pointer" }}
                />
                👑 Super Administrator (Portfolio-wide unrestricted access across all modules)
              </label>
              {editIsAdmin && (
                <p style={{ margin: "4px 0 0 28px", fontSize: 11, color: "#92400e" }}>
                  User has full administrative capabilities across all estates and modules. You can still assign specific functional roles below for fine-grained scoping.
                </p>
              )}
            </div>

            {/* Module Access Entitlement & Functional Roles */}
            <div style={{ background: "var(--surface, #ffffff)", border: "1px solid var(--border, #e2e8f0)", borderRadius: 12, padding: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                <div>
                  <h4 style={{ margin: "0 0 2px", fontSize: "0.95rem", fontWeight: 800 }}>📦 Module Access &amp; Functional Roles</h4>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
                    Toggle which modules this user can access, then customize their active functional roles.
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="text"
                    value={matrixRoleSearch}
                    onChange={(e) => setMatrixRoleSearch(e.target.value)}
                    placeholder="Filter roles e.g. Accountant…"
                    style={{ padding: "5px 10px", fontSize: 12, borderRadius: 6, border: "1px solid var(--border)", width: 170 }}
                  />
                  <button
                    type="button"
                    onClick={() => setEditSelectedRoles(roles.map((r) => r.id))}
                    style={{ fontSize: 11, color: "var(--primary, #d92d2d)", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}
                  >
                    Select All Roles
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditSelectedRoles([])}
                    style={{ fontSize: 11, color: "var(--muted)", background: "none", border: "none", cursor: "pointer" }}
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Module Cards Grid / List */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 320, overflowY: "auto", paddingRight: 4 }}>
                {MODULE_DEFINITIONS.map((mod) => {
                  const modRoles = roles.filter((r) => getRoleModule(r) === mod.slug);
                  const filteredModRoles = matrixRoleSearch.trim()
                    ? modRoles.filter((r) => r.name.toLowerCase().includes(matrixRoleSearch.toLowerCase()) || (r.description && r.description.toLowerCase().includes(matrixRoleSearch.toLowerCase())))
                    : modRoles;

                  if (matrixRoleSearch.trim() && filteredModRoles.length === 0) return null;

                  const activeModRoles = modRoles.filter((r) => editSelectedRoles.includes(r.id));
                  const isModActive = activeModRoles.length > 0 || editIsAdmin;
                  const isExpanded = expandedModules[mod.slug] ?? true;

                  return (
                    <div
                      key={mod.slug}
                      style={{
                        border: isModActive ? `1px solid ${mod.accent}` : "1px solid var(--border)",
                        borderRadius: 10,
                        background: isModActive ? "var(--surface)" : "var(--surface-sunken, #f8fafc)",
                        overflow: "hidden",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {/* Module Card Header */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 14px",
                          background: isModActive ? `linear-gradient(90deg, ${mod.accent}0f, transparent)` : "transparent",
                          borderBottom: isExpanded ? "1px solid var(--border)" : "none",
                          cursor: "pointer",
                        }}
                        onClick={() => setExpandedModules((prev) => ({ ...prev, [mod.slug]: !isExpanded }))}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 20 }}>{mod.icon}</span>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <strong style={{ fontSize: 13, color: isModActive ? mod.accent : "var(--text)" }}>{mod.label}</strong>
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  padding: "1px 6px",
                                  borderRadius: 10,
                                  background: isModActive ? `${mod.accent}20` : "var(--border)",
                                  color: isModActive ? mod.accent : "var(--muted)",
                                }}
                              >
                                {isModActive ? `${activeModRoles.length} of ${modRoles.length} roles active` : "Module Inactive"}
                              </span>
                            </div>
                            <span style={{ fontSize: 11, color: "var(--muted)", display: "block" }}>{mod.desc}</span>
                          </div>
                        </div>

                        {/* Module Toggle & Expand */}
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }} onClick={(e) => e.stopPropagation()}>
                          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 11, fontWeight: 700, color: isModActive ? mod.accent : "var(--muted)" }}>
                            <span>{isModActive ? "Enabled" : "Disabled"}</span>
                            <input
                              type="checkbox"
                              checked={isModActive}
                              onChange={(e) => {
                                const enable = e.target.checked;
                                if (enable) {
                                  const idsToAdd = modRoles.map((r) => r.id);
                                  setEditSelectedRoles((prev) => Array.from(new Set([...prev, ...idsToAdd])));
                                } else {
                                  const idsToRemove = new Set(modRoles.map((r) => r.id));
                                  setEditSelectedRoles((prev) => prev.filter((id) => !idsToRemove.has(id)));
                                }
                              }}
                              style={{ width: 16, height: 16, cursor: "pointer" }}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => setExpandedModules((prev) => ({ ...prev, [mod.slug]: !isExpanded }))}
                            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--muted)" }}
                          >
                            {isExpanded ? "▲" : "▼"}
                          </button>
                        </div>
                      </div>

                      {/* Collapsible Roles Grid */}
                      {isExpanded && (
                        <div style={{ padding: "10px 14px", background: "var(--surface)" }}>
                          {filteredModRoles.length === 0 ? (
                            <div style={{ fontSize: 11, color: "var(--muted)" }}>No roles configured for this module.</div>
                          ) : (
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                              {filteredModRoles.map((r) => {
                                const isSelected = editSelectedRoles.includes(r.id);
                                return (
                                  <label
                                    key={r.id}
                                    style={{
                                      display: "flex",
                                      alignItems: "flex-start",
                                      gap: 8,
                                      padding: "6px 10px",
                                      borderRadius: 6,
                                      border: isSelected ? `1px solid ${mod.accent}` : "1px solid var(--border)",
                                      background: isSelected ? `${mod.accent}0d` : "transparent",
                                      cursor: "pointer",
                                      transition: "all 0.12s ease",
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={(e) => {
                                        setEditSelectedRoles((prev) =>
                                          e.target.checked ? [...prev, r.id] : prev.filter((id) => id !== r.id)
                                        );
                                      }}
                                      style={{ marginTop: 2, cursor: "pointer" }}
                                    />
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                      <strong style={{ fontSize: 11, display: "block", color: isSelected ? mod.accent : "var(--text)" }}>
                                        {r.name}
                                      </strong>
                                      {r.description && (
                                        <span style={{ fontSize: 10, color: "var(--muted)", display: "block", lineHeight: 1.25 }}>
                                          {r.description}
                                        </span>
                                      )}
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Property Scoping Matrix */}
            <div style={{ background: "var(--surface, #ffffff)", border: "1px solid var(--border, #e2e8f0)", borderRadius: 12, padding: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                <div>
                  <h4 style={{ margin: "0 0 2px", fontSize: "0.95rem", fontWeight: 800 }}>
                    🏢 Property Scoping Matrix ({editSelectedProps.length} of {properties.length} assigned)
                  </h4>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
                    Restrict this user&apos;s data visibility and management actions to designated properties / estates.
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="text"
                    value={matrixPropSearch}
                    onChange={(e) => setMatrixPropSearch(e.target.value)}
                    placeholder="Filter properties…"
                    style={{ padding: "5px 10px", fontSize: 12, borderRadius: 6, border: "1px solid var(--border)", width: 150 }}
                  />
                  <button
                    type="button"
                    onClick={() => setEditSelectedProps(properties.map((p) => p.id))}
                    style={{ fontSize: 11, color: "var(--primary, #d92d2d)", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}
                  >
                    Select All ({properties.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditSelectedProps([])}
                    style={{ fontSize: 11, color: "var(--muted)", background: "none", border: "none", cursor: "pointer" }}
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Properties Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, maxHeight: 180, overflowY: "auto", padding: 4 }}>
                {properties.length === 0 ? (
                  <div style={{ fontSize: 12, color: "var(--muted)", gridColumn: "1 / -1", textAlign: "center", padding: 12 }}>
                    No properties available in this organization.
                  </div>
                ) : (
                  properties
                    .filter((p) => !matrixPropSearch.trim() || p.name.toLowerCase().includes(matrixPropSearch.toLowerCase()) || p.code.toLowerCase().includes(matrixPropSearch.toLowerCase()))
                    .map((p) => {
                      const isSelected = editSelectedProps.includes(p.id);
                      return (
                        <label
                          key={p.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "8px 10px",
                            borderRadius: 6,
                            border: isSelected ? "1px solid #0284c7" : "1px solid var(--border)",
                            cursor: "pointer",
                            background: isSelected ? "rgba(2, 132, 199, 0.08)" : "transparent",
                            transition: "all 0.12s ease",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              setEditSelectedProps((prev) =>
                                e.target.checked ? [...prev, p.id] : prev.filter((id) => id !== p.id)
                              );
                            }}
                            style={{ cursor: "pointer" }}
                          />
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", minWidth: 0, flex: 1 }}>
                            <span>🏢</span>
                            <strong style={{ fontSize: 12, color: isSelected ? "#0369a1" : "var(--text)" }}>{p.name}</strong>
                            <span className="mono muted" style={{ fontSize: 10, background: "var(--surface-sunken)", padding: "1px 4px", borderRadius: 3, border: "1px solid var(--border)" }}>
                              {p.code}
                            </span>
                          </div>
                        </label>
                      );
                    })
                )}
              </div>
            </div>

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
