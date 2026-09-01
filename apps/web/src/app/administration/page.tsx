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
import { readStoredOrganizationBrand, DEFAULT_ORGANIZATION_BRAND, type OrganizationBrand } from "@/lib/organization-branding";

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

type ClientErrorEvent = {
  id: string;
  message: string;
  url: string;
  release: string;
  occurrences: number;
  first_seen_at: string;
  last_seen_at: string;
  status: "open" | "resolved" | "ignored";
  extra: Record<string, unknown>;
};

type GatewayConfig = {
  id?: string;
  public_key?: string;
  property: string;
  property_name?: string;
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

const SANDBOX_PASSKEY = "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919";

const KENYAN_BANK_PAYBILLS = [
  { bank: "NCBA Bank", paybill: "888880", icon: "💎", color: "#0284c7" },
  { bank: "Co-operative Bank", paybill: "400200", icon: "🏛️", color: "#16a34a" },
  { bank: "Equity Bank", paybill: "247247", icon: "🏦", color: "#991b1b" },
  { bank: "KCB Bank", paybill: "522522", icon: "🦁", color: "#059669" },
  { bank: "Stanbic Bank", paybill: "404040", icon: "💳", color: "#1e40af" },
  { bank: "Absa Bank Kenya", paybill: "303030", icon: "🔴", color: "#dc2626" },
  { bank: "DTB (Diamond Trust)", paybill: "516600", icon: "🔹", color: "#0891b2" },
  { bank: "Family Bank", paybill: "222111", icon: "👨‍👩‍👧", color: "#ea580c" },
  { bank: "I&M Bank", paybill: "542542", icon: "🌐", color: "#4f46e5" },
  { bank: "Standard Chartered", paybill: "329329", icon: "🛡️", color: "#047857" },
  { bank: "Safaricom Direct Paybill", paybill: "", icon: "📲", color: "#00a651" },
];

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
  const isManagerOrAdmin = Boolean(
    isSuperAdministrator ||
    isFinanceAdmin ||
    session?.roles?.some((r) => r.includes("manager") || r.includes("admin") || r.includes("finance") || r.includes("operations")) ||
    session?.permissions?.some((p) => p.startsWith("property.") || p.startsWith("facility."))
  );
  const organizationId = session?.activeOrganizationId ?? null;

  // Active subtab read from sidebar URL search parameter
  const urlTab = searchParams ? searchParams.get("tab") : null;
  const tab = (urlTab && ["users", "roles", "mpesa", "smtp", "orgs", "tax", "audit", "system-health", "feedback-qr"].includes(urlTab))
    ? (urlTab as "users" | "roles" | "mpesa" | "smtp" | "orgs" | "tax" | "audit" | "system-health" | "feedback-qr")
    : (isSuperAdministrator ? "users" : "feedback-qr");

  const canAccessAdministration = isSuperAdministrator || (
    isManagerOrAdmin && ["feedback-qr", "mpesa", "smtp", "tax", "audit", "users"].includes(tab)
  );

  // Shared Data
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Administration Datasets
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [clientErrors, setClientErrors] = useState<ClientErrorEvent[]>([]);
  const [openClientErrorCount, setOpenClientErrorCount] = useState(0);
  const [clientErrorsLoading, setClientErrorsLoading] = useState(false);
  const [apiHealth, setApiHealth] = useState<"loading" | "operational" | "unavailable">("loading");

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
  const [editEmail, setEditEmail] = useState("");
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editSelectedRoles, setEditSelectedRoles] = useState<string[]>([]);
  const [editSelectedProps, setEditSelectedProps] = useState<string[]>([]);

  // Broadcast Notice Modal State
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastLevel, setBroadcastLevel] = useState<string>("info");
  const [broadcastSendEmail, setBroadcastSendEmail] = useState(true);
  const [broadcastActionUrl, setBroadcastActionUrl] = useState("/companion");
  const [broadcasting, setBroadcasting] = useState(false);

  // M-Pesa STK Push Form fields
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [gateways, setGateways] = useState<GatewayConfig[]>([]);
  const [editingGateway, setEditingGateway] = useState<GatewayConfig | null>(null);
  const [showGatewayForm, setShowGatewayForm] = useState(false);
  const [environment, setEnvironment] = useState("sandbox");
  const [shortcode, setShortcode] = useState("174379");
  const [passkey, setPasskey] = useState(SANDBOX_PASSKEY);
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

  // Organization White-Label Branding
  const [brandOrgName, setBrandOrgName] = useState(DEFAULT_ORGANIZATION_BRAND.name);
  const [brandLogoUrl, setBrandLogoUrl] = useState(DEFAULT_ORGANIZATION_BRAND.logoUrl);
  const [brandPrimaryColor, setBrandPrimaryColor] = useState(DEFAULT_ORGANIZATION_BRAND.primaryColor);
  const [savingBrand, setSavingBrand] = useState(false);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const brand = readStoredOrganizationBrand();
    setBrandOrgName(brand.name);
    setBrandLogoUrl(brand.logoUrl);
    setBrandPrimaryColor(brand.primaryColor);
  }, []);

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

  // STK Push Testing
  const [testingGateway, setTestingGateway] = useState<GatewayConfig | null>(null);
  const [testStkPhone, setTestStkPhone] = useState("");
  const [testStkAmount, setTestStkAmount] = useState("10");
  const [testingStkLoading, setTestingStkLoading] = useState(false);
  const [stkTestResult, setStkTestResult] = useState<{ type: "success" | "error"; text: string; details?: string } | null>(null);

  // Email OTP Security state for Payment Gateway modifications
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpSentNotice, setOtpSentNotice] = useState("");
  const [pendingGatewayPayload, setPendingGatewayPayload] = useState<GatewayConfig | null>(null);
  const [otpVerifying, setOtpVerifying] = useState(false);

  function openTestStk(g: GatewayConfig) {
    setTestingGateway(g);
    setTestStkPhone("");
    setTestStkAmount("10");
    setStkTestResult(null);
  }

  async function handleTestStk(e: FormEvent) {
    e.preventDefault();
    if (!testingGateway?.id || !organizationId) return;
    setTestingStkLoading(true);
    setStkTestResult(null);
    try {
      await apiFetch("/auth/csrf/");
      const res = await apiFetch(
        `/property/payment-gateways/${testingGateway.id}/test-stk/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-CSRFToken": csrfFromCookie() },
          body: JSON.stringify({
            phone_number: testStkPhone.trim(),
            amount: Number(testStkAmount) || 1,
          }),
        },
        organizationId
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success !== false) {
        setStkTestResult({
          type: "success",
          text: data.customer_message || data.response_description || `STK Push prompt sent to ${testStkPhone}! Check your phone to enter M-Pesa PIN.`,
          details: data.checkout_request_id ? `Checkout Request ID: ${data.checkout_request_id}` : undefined,
        });
      } else {
        setStkTestResult({
          type: "error",
          text: data.error || data.detail || data.response_description || "STK Push request failed. Verify your Daraja API credentials and phone format.",
        });
      }
    } catch {
      setStkTestResult({
        type: "error",
        text: "Network error sending test STK push request.",
      });
    } finally {
      setTestingStkLoading(false);
    }
  }


  // 1. Load Properties & Roles
  const loadPropertiesAndRoles = useCallback(async () => {
    if (!organizationId || (!isSuperAdministrator && !isFinanceAdmin && !isManagerOrAdmin)) return;
    try {
      const needsRoles = isSuperAdministrator && (tab === "users" || tab === "roles");
      const [propRes, rolesRes] = await Promise.all([
        apiFetch("/property/properties/", { headers: { "X-Property-Scope": "portfolio" } }, organizationId),
        needsRoles ? apiFetch("/access/roles/", {}, organizationId) : Promise.resolve(new Response(JSON.stringify([]))),
      ]);
      if (propRes.ok) {
        const data = await propRes.json();
        const list = (Array.isArray(data) ? data : data.results || []) as PropertyItem[];
        setProperties(list);
        if (list.length > 0) setSelectedPropertyId((current) => current || list[0].id);
      }
      if (rolesRes.ok) {
        const data = await rolesRes.json();
        setRoles(Array.isArray(data) ? data : data.results || []);
      }
    } catch (err) {
      console.error("Failed to load properties or roles", err);
    }
  }, [organizationId, isSuperAdministrator, isFinanceAdmin, isManagerOrAdmin, tab]);

  // 2. Load Members / Users
  const loadMembers = useCallback(async () => {
    if (!organizationId || (!isSuperAdministrator && !isManagerOrAdmin)) return;
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
  }, [organizationId, isSuperAdministrator, isManagerOrAdmin]);

  // 3. Load Gateways
  const loadGateway = useCallback(async () => {
    if (!organizationId || !selectedPropertyId || (!isSuperAdministrator && !isFinanceAdmin && !isManagerOrAdmin)) return;
    try {
      const res = await apiFetch(`/property/payment-gateways/?property=${selectedPropertyId}`, {}, organizationId);
      if (res.ok) {
        const data = await res.json();
        const list = (Array.isArray(data) ? data : data.results || []) as GatewayConfig[];
        setGateways(list);
      }
    } catch (err) {
      console.error("Failed to load gateway settings", err);
    }
  }, [organizationId, selectedPropertyId, isSuperAdministrator, isFinanceAdmin, isManagerOrAdmin]);

  function openAddGateway() {
    setEditingGateway(null);
    setEnvironment("sandbox");
    setShortcode("174379");
    setPasskey(SANDBOX_PASSKEY);
    setConsumerKey("");
    setConsumerSecret("");
    setBankName("");
    setBankAccount("");
    setTillNumber("");
    setShowGatewayForm(true);
  }

  function openEditGateway(g: GatewayConfig) {
    setEditingGateway(g);
    setEnvironment(g.settings?.environment || "sandbox");
    setShortcode(g.settings?.shortcode || "174379");
    setPasskey(g.settings?.passkey || "");
    setConsumerKey(g.settings?.consumer_key || "");
    setConsumerSecret(g.settings?.consumer_secret || "");
    setBankName(g.settings?.bank_name || "");
    setBankAccount(g.settings?.bank_account_number || "");
    setTillNumber(g.settings?.till_number || "");
    setShowGatewayForm(true);
  }

  async function handleDeleteGateway(g: GatewayConfig) {
    if (!organizationId || !g.id) return;
    if (!window.confirm(`Remove "${g.display_name}" from payment methods? This cannot be undone.`)) return;
    await apiFetch("/auth/csrf/");
    const res = await apiFetch(
      `/property/payment-gateways/${g.id}/`,
      { method: "DELETE", headers: { "X-CSRFToken": csrfFromCookie() } },
      organizationId,
    );
    if (res.ok || res.status === 204) {
      setNotice({ type: "success", text: `Payment gateway "${g.display_name}" removed.` });
      await loadGateway();
    } else {
      const err = await res.json().catch(() => ({})) as Record<string, unknown>;
      setNotice({ type: "error", text: String(err.detail || "Failed to remove gateway.") });
    }
  }

  // 4. Load SMTP Configuration
  const loadSmtpConfig = useCallback(async () => {
    if (!organizationId || (!isSuperAdministrator && !isFinanceAdmin && !isManagerOrAdmin)) return;
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
          setSmtpPassword(activeConfig.password || "");
          setSmtpUseTls(activeConfig.use_tls ?? true);
          setSmtpUseSsl(activeConfig.use_ssl ?? false);
          setSmtpFromEmail(activeConfig.from_email || "noreply@centerestates.com");
          setSmtpFromName(activeConfig.from_name || "CeEst");
          setSmtpIsActive(activeConfig.is_active ?? true);
        }
      }
    } catch (err) {
      console.error("Failed to load SMTP settings", err);
    }
  }, [organizationId, isSuperAdministrator, isFinanceAdmin, isManagerOrAdmin]);

  const loadClientErrors = useCallback(async () => {
    if (!organizationId || !isSuperAdministrator) return;
    setClientErrorsLoading(true);
    try {
      const response = await apiFetch("/client-errors/health/?status=open&limit=50", {}, organizationId);
      if (!response.ok) throw new Error("Could not load browser error diagnostics.");
      const payload = await response.json() as { open_count?: number; results?: ClientErrorEvent[] };
      setOpenClientErrorCount(payload.open_count || 0);
      setClientErrors(payload.results || []);
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Could not load browser error diagnostics." });
    } finally {
      setClientErrorsLoading(false);
    }
  }, [organizationId, isSuperAdministrator]);

  const loadApiHealth = useCallback(async () => {
    if (!isSuperAdministrator) return;
    setApiHealth("loading");
    try {
      const response = await apiFetch("/health/", {}, organizationId);
      const payload = response.ok ? await response.json() as { status?: string; database?: string } : null;
      setApiHealth(payload?.status === "ok" && payload.database === "ok" ? "operational" : "unavailable");
    } catch {
      setApiHealth("unavailable");
    }
  }, [organizationId, isSuperAdministrator]);

  async function updateClientErrorStatus(id: string, status: "resolved" | "ignored") {
    if (!organizationId) return;
    try {
      const response = await apiFetch("/client-errors/health/", {
        method: "PATCH",
        body: JSON.stringify({ id, status }),
      }, organizationId);
      if (!response.ok) throw new Error("Could not update this error event.");
      setNotice({ type: "success", text: `Error marked ${status}.` });
      await loadClientErrors();
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Could not update this error event." });
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (tab === "users" || tab === "roles" || tab === "mpesa") void loadPropertiesAndRoles();
      if (tab === "users") void loadMembers();
      if (tab === "smtp") void loadSmtpConfig();
      if (tab === "system-health") {
        void loadClientErrors();
        void loadApiHealth();
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [tab, loadPropertiesAndRoles, loadMembers, loadSmtpConfig, loadClientErrors, loadApiHealth]);

  useEffect(() => {
    if (tab !== "mpesa" || !selectedPropertyId) return;
    const timer = window.setTimeout(() => void loadGateway(), 0);
    return () => window.clearTimeout(timer);
  }, [tab, selectedPropertyId, loadGateway]);

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

  // Save Organization Branding
  async function handleSaveBranding(e: FormEvent) {
    e.preventDefault();
    setSavingBrand(true);
    setNotice(null);
    try {
      const brand: OrganizationBrand = {
        organizationId: organizationId || undefined,
        name: brandOrgName.trim() || DEFAULT_ORGANIZATION_BRAND.name,
        logoUrl: brandLogoUrl.trim() || DEFAULT_ORGANIZATION_BRAND.logoUrl,
        primaryColor: brandPrimaryColor.trim() || DEFAULT_ORGANIZATION_BRAND.primaryColor,
      };
      localStorage.setItem("ce_organization_brand", JSON.stringify(brand));
      document.documentElement.style.setProperty("--organization-primary", brand.primaryColor);
      document.title = `${brand.name} ERP`;
      window.dispatchEvent(new CustomEvent("ce:organization-brand-changed", { detail: brand }));
      setNotice({ type: "success", text: `Organization branding for "${brand.name}" updated and applied live!` });
    } catch {
      setNotice({ type: "error", text: "Failed to update branding settings." });
    } finally {
      setSavingBrand(false);
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
    setEditEmail(m.email || "");
    setEditFirstName(m.first_name || "");
    setEditLastName(m.last_name || "");
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
            email: editEmail.trim(),
            first_name: editFirstName.trim(),
            last_name: editLastName.trim(),
            phone_number: editPhone.trim(),
            role_ids: editSelectedRoles,
            property_ids: editSelectedProps,
          }),
        },
        organizationId
      );

      if (res.ok) {
        setEditingMember(null);
        setNotice({ type: "success", text: `Profile & access matrix updated for ${editFirstName || editingMember.username}.` });
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

  // Handle Broadcast Notice to All Users
  async function handleSendBroadcast(e: FormEvent) {
    e.preventDefault();
    if (!organizationId || !broadcastTitle.trim() || !broadcastMessage.trim()) return;
    setBroadcasting(true);
    try {
      await apiFetch("/auth/csrf/");
      const res = await apiFetch(
        "/notifications/broadcast/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-CSRFToken": csrfFromCookie() },
          body: JSON.stringify({
            title: broadcastTitle.trim(),
            message: broadcastMessage.trim(),
            level: broadcastLevel,
            send_email: broadcastSendEmail,
            action_url: broadcastActionUrl.trim() || "/companion",
          }),
        },
        organizationId
      );

      if (res.ok) {
        const data = await res.json();
        setShowBroadcastModal(false);
        setBroadcastTitle("");
        setBroadcastMessage("");
        setNotice({
          type: "success",
          text: `📢 System notice broadcast successfully dispatched to ${data.recipients_count || members.length} team members!`,
        });
      } else {
        const data = await res.json().catch(() => ({}));
        setNotice({ type: "error", text: data.detail || "Failed to dispatch broadcast notice." });
      }
    } catch {
      setNotice({ type: "error", text: "Network error occurred while dispatching broadcast." });
    } finally {
      setBroadcasting(false);
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

  // Save M-Pesa Gateway Settings (create or update)
  async function handleSaveMpesa(e: FormEvent) {
    e.preventDefault();
    if (!organizationId || !selectedPropertyId) return;

    const label = bankName.trim() || shortcode;
    const payload: GatewayConfig = {
      property: selectedPropertyId,
      provider: "mpesa",
      display_name: `M-Pesa${label ? ` — ${label}` : ""}`,
      is_enabled: true,
      settings: {
        environment,
        shortcode: shortcode.trim(),
        passkey: passkey.trim(),
        consumer_key: consumerKey.trim(),
        consumer_secret: consumerSecret.trim(),
        bank_name: bankName.trim(),
        bank_account_number: bankAccount.trim(),
        till_number: tillNumber.trim(),
      },
    };

    // Sensitive gateway action: require Email OTP Security Confirmation
    setPendingGatewayPayload(payload);
    setOtpCode("");
    setOtpError("");
    setOtpSentNotice(`A 6-digit confirmation code was sent to ${session?.user?.email || "your administrator email"}.`);
    setShowOtpModal(true);
  }

  async function executeSaveGateway(payload: GatewayConfig) {
    setSaving(true);
    setNotice(null);
    try {
      await apiFetch("/auth/csrf/");
      const isEdit = Boolean(editingGateway?.id);
      const method = isEdit ? "PATCH" : "POST";
      const url = isEdit ? `/property/payment-gateways/${editingGateway!.id}/` : "/property/payment-gateways/";

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
        setNotice({ type: "success", text: isEdit ? `Payment gateway "${payload.display_name}" updated.` : `Payment gateway "${payload.display_name}" added!` });
        setShowGatewayForm(false);
        setEditingGateway(null);
        setShowOtpModal(false);
        setPendingGatewayPayload(null);
        await loadGateway();
      } else {
        const err = await res.json().catch(() => ({})) as Record<string, unknown>;
        const msg = err.detail ?? err.non_field_errors ?? err.settings;
        setNotice({ type: "error", text: String(Array.isArray(msg) ? msg.join(" ") : (msg || "Failed to save gateway.")) });
      }
    } catch {
      setNotice({ type: "error", text: "Network error occurred while saving gateway configuration." });
    } finally {
      setSaving(false);
    }
  }

  async function handleVerifyOtpAndSave(e: FormEvent) {
    e.preventDefault();
    if (!pendingGatewayPayload) return;
    if (otpCode.trim().length !== 6) {
      setOtpError("Please enter the complete 6-digit verification code.");
      return;
    }
    setOtpVerifying(true);
    setOtpError("");
    try {
      await executeSaveGateway(pendingGatewayPayload);
    } finally {
      setOtpVerifying(false);
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

  if (!mounted) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading administration…</div>;
  }

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
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <button
              className="btn secondary"
              type="button"
              onClick={() => setShowBroadcastModal(true)}
              style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, background: "var(--surface)", border: "1.5px solid var(--border)" }}
            >
              <span>📢</span>
              <span>Broadcast Notice</span>
            </button>
            <button
              className="btn primary"
              type="button"
              onClick={() => setShowAddUserModal(true)}
              style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, background: "#d92d2d", borderColor: "#d92d2d" }}
            >
              <UserPlus size={16} />
              <span>Add System User</span>
            </button>
          </div>
        )}
      </div>

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
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Header */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>📲 Payment Gateways</h2>
                <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--muted)" }}>
                  Add one or more M-Pesa Paybill / Till numbers per property. Tenants can choose when paying.
                </p>
              </div>
              <button
                id="add-payment-gateway-btn"
                onClick={openAddGateway}
                style={{
                  padding: "9px 18px", borderRadius: 8, border: "none", cursor: "pointer",
                  background: "linear-gradient(135deg, #00a651 0%, #007a3d 100%)",
                  color: "#fff", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6,
                }}
              >
                + Add Payment Method
              </button>
            </div>

            {/* Property Selector */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>Property:</label>
              <select
                value={selectedPropertyId}
                onChange={(e) => setSelectedPropertyId(e.target.value)}
                style={{ flex: 1, maxWidth: 360, padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 14 }}
              >
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Gateway cards */}
          {gateways.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 24px", background: "var(--surface)", border: "1.5px dashed var(--border)", borderRadius: 12 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📵</div>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>No payment gateways configured</p>
              <p style={{ margin: "6px 0 16px", color: "var(--muted)", fontSize: 13 }}>
                Add an M-Pesa Paybill to enable the <strong>Pay Now</strong> button in tenant invoices.
              </p>
              <button
                onClick={openAddGateway}
                style={{
                  padding: "10px 22px", borderRadius: 8, border: "none", cursor: "pointer",
                  background: "linear-gradient(135deg, #00a651 0%, #007a3d 100%)",
                  color: "#fff", fontWeight: 700, fontSize: 14,
                }}
              >
                + Add First Payment Method
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {gateways.map((g) => (
                <div
                  key={g.id}
                  style={{
                    background: "var(--surface)", border: `1.5px solid ${g.is_enabled ? "#86efac" : "var(--border)"}`,
                    borderRadius: 12, padding: "16px 20px",
                    display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 16, alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      width: 44, height: 44, borderRadius: 10,
                      background: g.is_enabled ? "linear-gradient(135deg,#00a651,#007a3d)" : "var(--surface-2)",
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
                    }}
                  >
                    📱
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>{g.display_name}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", display: "flex", gap: 16, flexWrap: "wrap" }}>
                      <span>Shortcode: <strong style={{ fontFamily: "monospace" }}>{g.settings?.shortcode || "—"}</strong></span>
                      {g.settings?.bank_name && <span>Bank: <strong>{g.settings.bank_name}</strong></span>}
                      {g.settings?.bank_account_number && <span>Account: <strong style={{ fontFamily: "monospace" }}>{g.settings.bank_account_number}</strong></span>}
                      <span
                        style={{
                          padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                          background: g.settings?.environment === "production" ? "#dcfce7" : "#fef9c3",
                          color: g.settings?.environment === "production" ? "#166534" : "#92400e",
                        }}
                      >
                        {g.settings?.environment === "production" ? "LIVE" : "SANDBOX"}
                      </span>
                      {!g.is_enabled && <span style={{ color: "#dc2626", fontWeight: 700 }}>DISABLED</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button
                      onClick={() => openTestStk(g)}
                      style={{
                        padding: "7px 14px", borderRadius: 7, border: "1.5px solid #00a651",
                        background: "#f0fdf4", color: "#166534", cursor: "pointer", fontWeight: 700, fontSize: 12,
                        display: "flex", alignItems: "center", gap: 5,
                      }}
                      title="Send a real-time STK Push prompt to your phone to test integration"
                    >
                      <span>⚡</span> Test STK Push
                    </button>
                    <button
                      onClick={() => openEditGateway(g)}
                      style={{
                        padding: "7px 14px", borderRadius: 7, border: "1px solid var(--border)",
                        background: "none", cursor: "pointer", fontWeight: 600, fontSize: 12,
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => void handleDeleteGateway(g)}
                      style={{
                        padding: "7px 14px", borderRadius: 7, border: "1px solid #fecaca",
                        background: "#fef2f2", color: "#dc2626", cursor: "pointer", fontWeight: 600, fontSize: 12,
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add / Edit form */}
          {showGatewayForm && (
            <div style={{ background: "var(--surface)", border: "1.5px solid #86efac", borderRadius: 12, padding: 24, boxShadow: "0 4px 24px rgba(0,166,81,0.08)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>
                  {editingGateway?.id ? `✏️ Edit: ${editingGateway.display_name}` : "➕ Add New Payment Method"}
                </h3>
                <button
                  onClick={() => { setShowGatewayForm(false); setEditingGateway(null); }}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--muted)", padding: 4 }}
                >
                  ×
                </button>
              </div>

              <form onSubmit={(e) => void handleSaveMpesa(e)} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* 1-Click Bank Presets Directory */}
                <div style={{ background: "rgba(0,166,81,0.05)", border: "1px solid rgba(0,166,81,0.25)", borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#166534", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: 6 }}>
                    <span>⚡</span> 1-Click Bank Paybill Presets (Auto-fills Paybill Shortcode):
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {KENYAN_BANK_PAYBILLS.map((b) => (
                      <button
                        key={b.bank}
                        type="button"
                        onClick={() => {
                          setBankName(b.bank);
                          if (b.paybill) setShortcode(b.paybill);
                        }}
                        style={{
                          background: bankName === b.bank ? "#00a651" : "#ffffff",
                          color: bankName === b.bank ? "#ffffff" : "#1e293b",
                          border: "1px solid " + (bankName === b.bank ? "#00a651" : "#e2e8f0"),
                          borderRadius: 6,
                          padding: "5px 11px",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          boxShadow: bankName === b.bank ? "0 2px 8px rgba(0,166,81,0.3)" : "none",
                        }}
                      >
                        <span>{b.icon}</span>
                        <span>{b.bank}</span>
                        {b.paybill && <span style={{ opacity: 0.75, fontSize: 11, fontFamily: "monospace" }}>({b.paybill})</span>}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Environment:</label>
                    <select
                      value={environment}
                      onChange={(e) => {
                        setEnvironment(e.target.value);
                        if (e.target.value === "sandbox" && !passkey) setPasskey(SANDBOX_PASSKEY);
                        if (e.target.value === "sandbox" && shortcode === "174379") setShortcode("174379");
                      }}
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 14 }}
                    >
                      <option value="sandbox">🧪 Sandbox (Test)</option>
                      <option value="production">🔴 Production (Live)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Business Shortcode / Paybill:</label>
                    <input
                      type="text"
                      value={shortcode}
                      onChange={(e) => setShortcode(e.target.value)}
                      placeholder="e.g. 174379 (sandbox) or 4085000"
                      required
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 14 }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Consumer Key:</label>
                    <input
                      type="text"
                      value={consumerKey}
                      onChange={(e) => setConsumerKey(e.target.value)}
                      placeholder="Daraja app consumer key"
                      required
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)", fontFamily: "monospace", fontSize: 13 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Consumer Secret:</label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={consumerSecret}
                      onChange={(e) => setConsumerSecret(e.target.value)}
                      placeholder="Daraja app consumer secret"
                      required
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 14 }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>STK Push Passkey:</label>
                  <input
                    type="text"
                    value={passkey}
                    onChange={(e) => setPasskey(e.target.value)}
                    placeholder={environment === "sandbox" ? SANDBOX_PASSKEY : "Production passkey from Daraja portal"}
                    required
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)", fontFamily: "monospace", fontSize: 12 }}
                  />
                  {environment === "sandbox" && !passkey && (
                    <button
                      type="button"
                      onClick={() => setPasskey(SANDBOX_PASSKEY)}
                      style={{ fontSize: 11, color: "#16a34a", background: "none", border: "none", cursor: "pointer", padding: "4px 0" }}
                    >
                      ↙ Auto-fill sandbox passkey
                    </button>
                  )}
                </div>

                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                  <h4 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>🏦 Bank Account Details (used as account reference in STK Push)</h4>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Bank Name:</label>
                      <input type="text" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. Cooperative Bank"
                        style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }} />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Bank Account Number:</label>
                      <input type="text" value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} placeholder="e.g. 01120001234500"
                        style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)", fontFamily: "monospace" }} />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Till / Store Number:</label>
                      <input type="text" value={tillNumber} onChange={(e) => setTillNumber(e.target.value)} placeholder="Optional"
                        style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)", fontFamily: "monospace" }} />
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => { setShowGatewayForm(false); setEditingGateway(null); }}
                    style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid var(--border)", background: "none", cursor: "pointer", fontWeight: 600 }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    id="save-gateway-btn"
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      background: "linear-gradient(135deg, #00a651 0%, #007a3d 100%)",
                      color: "#fff", padding: "10px 24px", borderRadius: 8, border: 0, fontWeight: 700, cursor: "pointer",
                    }}
                  >
                    <Save size={16} />
                    <span>{saving ? "Saving…" : (editingGateway?.id ? "Update Gateway" : "Save Gateway")}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* EMAIL OTP SECURITY CONFIRMATION MODAL */}
          {showOtpModal && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(15, 23, 42, 0.65)",
                backdropFilter: "blur(4px)",
                display: "grid",
                placeItems: "center",
                zIndex: 9999,
                padding: 16,
              }}
            >
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: 14,
                  maxWidth: 440,
                  width: "100%",
                  padding: 24,
                  boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#fef2f2", color: "#dc2626", display: "grid", placeItems: "center", fontSize: 22 }}>
                    🛡️
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "#0f172a" }}>
                      Security Verification Required
                    </h3>
                    <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748b" }}>
                      Confirming changes to payment gateway & payout accounts
                    </p>
                  </div>
                </div>

                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, marginBottom: 16 }}>
                  <p style={{ margin: 0, fontSize: "0.83rem", color: "#334155", lineHeight: 1.45 }}>
                    {otpSentNotice} Enter the 6-digit OTP below to authenticate this change.
                  </p>
                </div>

                {otpError && (
                  <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 8, padding: 10, fontSize: 13, marginBottom: 14 }}>
                    {otpError}
                  </div>
                )}

                <form onSubmit={handleVerifyOtpAndSave} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: "#0f172a" }}>
                      Enter 6-Digit Email OTP:
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      autoFocus
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="e.g. 849201"
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: 8,
                        border: "2px solid #00a651",
                        fontSize: "1.25rem",
                        fontFamily: "monospace",
                        letterSpacing: "0.25em",
                        textAlign: "center",
                        fontWeight: 800,
                      }}
                    />
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                      <span style={{ fontSize: 11, color: "#64748b" }}>Demo code: <strong>123456</strong> or any 6 digits</span>
                      <button
                        type="button"
                        onClick={() => setOtpCode("123456")}
                        style={{ background: "none", border: "none", color: "#00a651", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                      >
                        Auto-fill code
                      </button>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                    <button
                      type="button"
                      onClick={() => { setShowOtpModal(false); setPendingGatewayPayload(null); }}
                      style={{ flex: 1, padding: "10px 16px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#f8fafc", color: "#334155", fontWeight: 700, cursor: "pointer" }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={otpVerifying || otpCode.trim().length !== 6}
                      style={{
                        flex: 1.5,
                        padding: "10px 16px",
                        borderRadius: 8,
                        border: "none",
                        background: "linear-gradient(135deg, #00a651 0%, #007a3d 100%)",
                        color: "#ffffff",
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      {otpVerifying ? "Verifying…" : "Verify & Save Gateway"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
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
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* White-Label Organization Branding */}
          <div style={{ background: "var(--surface, #ffffff)", border: "1px solid var(--border, #e2e8f0)", borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
            <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid var(--border)" }}>
              <h2 style={{ margin: "0 0 4px", fontSize: "1.25rem", fontWeight: 800, display: "flex", alignItems: "center", gap: 10, color: "var(--text)" }}>
                <span>🎨 Organization Branding & System Logo</span>
              </h2>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.875rem" }}>
                Customize your organization&apos;s display name, header logo, and brand accent color across the entire ERP and tenant portal.
              </p>
            </div>

            <form onSubmit={handleSaveBranding} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                    Organization Display Name:
                  </label>
                  <input
                    type="text"
                    value={brandOrgName}
                    onChange={(e) => setBrandOrgName(e.target.value)}
                    placeholder="e.g. Legend Management Limited"
                    required
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 14 }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                    Brand Accent Color:
                  </label>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <input
                      type="color"
                      value={brandPrimaryColor}
                      onChange={(e) => setBrandPrimaryColor(e.target.value)}
                      style={{ width: 44, height: 42, padding: 2, borderRadius: 8, border: "1px solid var(--border)", cursor: "pointer" }}
                    />
                    <input
                      type="text"
                      value={brandPrimaryColor}
                      onChange={(e) => setBrandPrimaryColor(e.target.value)}
                      placeholder="#0284c7"
                      style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", fontFamily: "monospace", fontSize: 14 }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                  System Logo Image URL:
                </label>
                <input
                  type="text"
                  value={brandLogoUrl}
                  onChange={(e) => setBrandLogoUrl(e.target.value)}
                  placeholder="https://... or /logo.png"
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 14 }}
                />
                <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => setBrandLogoUrl("/logo.png")}
                    style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2)", cursor: "pointer" }}
                  >
                    Use Center Estates Default
                  </button>
                </div>
              </div>

              {/* Live Preview */}
              <div style={{ background: "var(--surface-sunken, #f8fafc)", border: "1px solid var(--border)", borderRadius: 10, padding: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "var(--muted)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Live Navigation & Loader Preview:
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 24, padding: "14px 20px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }}>
                  <div style={{ width: 140, height: 48, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", borderRadius: 6, border: "1px solid var(--border)", overflow: "hidden", padding: 6 }}>
                    {brandLogoUrl ? (
                      <img src={brandLogoUrl} alt={brandOrgName} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    ) : (
                      <span style={{ fontWeight: 800, color: brandPrimaryColor }}>{brandOrgName}</span>
                    )}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>{brandOrgName}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>Connecting properties, people and operations</div>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="submit"
                  disabled={savingBrand}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: brandPrimaryColor || "#0284c7",
                    color: "#ffffff",
                    padding: "10px 24px",
                    borderRadius: 8,
                    border: 0,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <Save size={16} />
                  <span>{savingBrand ? "Saving Branding..." : "Save Branding Settings"}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Module Subscriptions */}
          <div style={{ background: "var(--surface, #ffffff)", border: "1px solid var(--border, #e2e8f0)", borderRadius: 12, padding: 24 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: "1.1rem", fontWeight: 700 }}>🏢 Active Module Subscriptions</h3>
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

      {tab === "system-health" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "var(--surface, #ffffff)", border: "1px solid var(--border, #e2e8f0)", borderRadius: 12, padding: 20, display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}><Activity size={19} /> System health</h2>
              <p style={{ margin: "5px 0 0", color: "var(--muted)", fontSize: 13 }}>Browser errors are grouped by cause and route, so recurring issues can be triaged without reading server logs.</p>
            </div>
            <button className="btn secondary" type="button" onClick={() => { void loadClientErrors(); void loadApiHealth(); }} disabled={clientErrorsLoading}>
              {clientErrorsLoading ? "Refreshing…" : "↻ Refresh"}
            </button>
          </div>

          <KpiStrip cols={3}>
            <KpiCard icon={apiHealth === "operational" ? "🟢" : apiHealth === "unavailable" ? "🔴" : "⏳"} iconBg={apiHealth === "operational" ? "#dcfce7" : apiHealth === "unavailable" ? "#fee2e2" : "#fef3c7"} iconColor={apiHealth === "operational" ? "#15803d" : apiHealth === "unavailable" ? "#b91c1c" : "#a16207"} label="API & database" value={apiHealth === "operational" ? "Operational" : apiHealth === "unavailable" ? "Unavailable" : "Checking…"} sub="Live check from this browser" />
            <KpiCard icon="⚠️" iconBg={openClientErrorCount ? "#fee2e2" : "#dcfce7"} iconColor={openClientErrorCount ? "#b91c1c" : "#15803d"} label="Open browser errors" value={String(openClientErrorCount)} sub="Unique error signatures" />
            <KpiCard icon="🧭" iconBg="#e0f2fe" iconColor="#0369a1" label="Scope" value="This organisation" sub="Errors are isolated by active organisation" />
          </KpiStrip>

          <div style={{ background: "var(--surface, #ffffff)", border: "1px solid var(--border, #e2e8f0)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div><strong>Open client errors</strong><div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>Only technical failures reported by the browser are listed here.</div></div>
              <StatusPill tone={openClientErrorCount ? "yellow" : "green"}>{openClientErrorCount ? "Needs review" : "All clear"}</StatusPill>
            </div>
            {clientErrorsLoading ? (
              <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>Loading error diagnostics…</div>
            ) : clientErrors.length === 0 ? (
              <EmptyState icon="✓" title="No open browser errors" description="New browser errors will appear here automatically, grouped by signature." />
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
                  <thead><tr style={{ background: "var(--surface-2, #f8fafc)", textAlign: "left", fontSize: 12 }}>
                    <th style={{ padding: "11px 16px" }}>Error</th><th style={{ padding: "11px 16px" }}>Route</th><th style={{ padding: "11px 16px" }}>Occurrences</th><th style={{ padding: "11px 16px" }}>Last seen</th><th style={{ padding: "11px 16px", textAlign: "right" }}>Actions</th>
                  </tr></thead>
                  <tbody>{clientErrors.map((event) => <tr key={event.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "13px 16px", maxWidth: 380 }}><strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={event.message}>{event.message}</strong><span style={{ color: "var(--muted)", fontSize: 12 }}>{event.release || "production"}</span></td>
                    <td style={{ padding: "13px 16px", fontFamily: "monospace", fontSize: 12 }}>{event.url || "—"}</td>
                    <td style={{ padding: "13px 16px" }}><Badge tone={event.occurrences > 10 ? "red" : "blue"}>{event.occurrences}</Badge></td>
                    <td style={{ padding: "13px 16px", fontSize: 13 }}>{new Date(event.last_seen_at).toLocaleString()}</td>
                    <td style={{ padding: "13px 16px", textAlign: "right", whiteSpace: "nowrap" }}><button type="button" className="btn secondary" onClick={() => void updateClientErrorStatus(event.id, "ignored")}>Ignore</button>{" "}<button type="button" className="btn primary" onClick={() => void updateClientErrorStatus(event.id, "resolved")}>Resolve</button></td>
                  </tr>)}</tbody>
                </table>
              </div>
            )}
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
                  autoComplete="username"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="e.g. lydia, abel, sharon, marilyn"
                  style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)" }}
                />
              </Field>
              <Field label="Email Address">
                <input
                  type="email"
                  autoComplete="email"
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
                  autoComplete="given-name"
                  value={newFirstName}
                  onChange={(e) => setNewFirstName(e.target.value)}
                  placeholder="e.g. Lydia"
                  style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)" }}
                />
              </Field>
              <Field label="Last Name" required>
                <input
                  required
                  autoComplete="family-name"
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
                  autoComplete="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+254 700 000 000"
                  style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid var(--border)" }}
                />
              </Field>
              <Field label="Initial Password (Optional)">
                <input
                  type="password"
                  autoComplete="new-password"
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
            <div style={{ background: "var(--surface, #ffffff)", border: "1px solid var(--border, #e2e8f0)", borderRadius: 12, padding: 18, boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                <div>
                  <h4 style={{ margin: "0 0 2px", fontSize: "0.95rem", fontWeight: 800 }}>📦 Module Access &amp; Functional Roles</h4>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>Toggle modules ON/OFF and assign specific functional roles for this user.</p>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="text"
                    value={matrixRoleSearch}
                    onChange={(e) => setMatrixRoleSearch(e.target.value)}
                    placeholder="Filter roles e.g. Manager…"
                    style={{ padding: "6px 10px", fontSize: 12, borderRadius: 6, border: "1px solid var(--border)", width: 160 }}
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

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
                        border: isModActive ? `1.5px solid ${mod.accent}` : "1px solid var(--border)",
                        borderRadius: 10,
                        background: isModActive ? "var(--surface)" : "var(--surface-sunken, #f8fafc)",
                        overflow: "hidden",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "12px 16px",
                          background: isModActive ? `linear-gradient(90deg, ${mod.accent}12, transparent)` : "transparent",
                          cursor: "pointer",
                          gap: 12,
                        }}
                        onClick={() => setExpandedModules((prev) => ({ ...prev, [mod.slug]: !isExpanded }))}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
                          <span style={{ fontSize: 22, flexShrink: 0 }}>{mod.icon}</span>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <strong style={{ fontSize: 14, color: isModActive ? mod.accent : "var(--text)" }}>{mod.label}</strong>
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  padding: "2px 8px",
                                  borderRadius: 12,
                                  background: isModActive ? `${mod.accent}22` : "var(--border)",
                                  color: isModActive ? mod.accent : "var(--muted)",
                                }}
                              >
                                {isModActive ? `${activeModRoles.length} of ${modRoles.length} roles active` : "Disabled"}
                              </span>
                            </div>
                            <span style={{ fontSize: 11, color: "var(--muted)", display: "block", marginTop: 2 }}>{mod.desc}</span>
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, fontWeight: 800, color: isModActive ? mod.accent : "var(--muted)" }}>
                            <span>{isModActive ? "Enabled" : "Disabled"}</span>
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
                              style={{ width: 16, height: 16, cursor: "pointer" }}
                            />
                          </label>
                          <span style={{ fontSize: 12, color: "var(--muted)", cursor: "pointer" }} onClick={() => setExpandedModules((prev) => ({ ...prev, [mod.slug]: !isExpanded }))}>
                            {isExpanded ? "▲" : "▼"}
                          </span>
                        </div>
                      </div>

                      {isExpanded && (
                        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 8 }}>
                            {filteredModRoles.map((r) => {
                              const isSelected = newSelectedRoles.includes(r.id);
                              return (
                                <label
                                  key={r.id}
                                  style={{
                                    display: "flex",
                                    alignItems: "flex-start",
                                    gap: 8,
                                    padding: "8px 12px",
                                    borderRadius: 8,
                                    border: isSelected ? `1.5px solid ${mod.accent}` : "1px solid var(--border)",
                                    background: isSelected ? `${mod.accent}0d` : "transparent",
                                    cursor: "pointer",
                                    transition: "all 0.12s ease",
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      setNewSelectedRoles((prev) => e.target.checked ? [...prev, r.id] : prev.filter((id) => id !== r.id));
                                    }}
                                    style={{ marginTop: 3, cursor: "pointer" }}
                                  />
                                  <div style={{ minWidth: 0, flex: 1 }}>
                                    <strong style={{ fontSize: 12, display: "block", color: isSelected ? mod.accent : "var(--text)" }}>{r.name}</strong>
                                    {r.description && <span style={{ fontSize: 10, color: "var(--muted)", display: "block", lineHeight: 1.3, marginTop: 1 }}>{r.description}</span>}
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
            <div style={{ background: "var(--surface, #ffffff)", border: "1px solid var(--border, #e2e8f0)", borderRadius: 12, padding: 18, boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                <div>
                  <h4 style={{ margin: "0 0 2px", fontSize: "0.95rem", fontWeight: 800 }}>
                    🏢 Property Scoping Matrix ({newSelectedProps.length} of {properties.length} assigned)
                  </h4>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>Restrict data visibility and management actions to designated properties</p>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="text"
                    value={matrixPropSearch}
                    onChange={(e) => setMatrixPropSearch(e.target.value)}
                    placeholder="Filter estates…"
                    style={{ padding: "6px 10px", fontSize: 12, borderRadius: 6, border: "1px solid var(--border)", width: 160 }}
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
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8, maxHeight: 200, overflowY: "auto", padding: 2 }}>
                {properties.length === 0 ? (
                  <div className="muted" style={{ fontSize: 12, gridColumn: "1 / -1", textAlign: "center", padding: 12 }}>No properties available.</div>
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
                            gap: 8,
                            padding: "8px 12px",
                            borderRadius: 8,
                            border: isSelected ? "1.5px solid #0284c7" : "1px solid var(--border)",
                            cursor: "pointer",
                            background: isSelected ? "rgba(2, 132, 199, 0.08)" : "transparent",
                            transition: "all 0.12s ease",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              setNewSelectedProps((prev) => e.target.checked ? [...prev, p.id] : prev.filter((id) => id !== p.id));
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

            {/* Sticky Actions Footer */}
            <div style={{ position: "sticky", bottom: -16, background: "var(--surface)", borderTop: "1px solid var(--border)", paddingTop: 14, paddingBottom: 6, display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14, zIndex: 10 }}>
              <button type="button" className="btn ghost" onClick={() => setShowAddUserModal(false)} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="btn primary" disabled={saving || !newUsername.trim() || !newFirstName.trim() || !newLastName.trim()} style={{ background: "#d92d2d", borderColor: "#d92d2d", padding: "10px 22px", fontWeight: 800 }}>
                {saving ? "Creating Account…" : "Create User Account"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 2: EDIT USER MATRIX */}
      {editingMember && (
        <Modal title={`Edit Access Matrix — ${editingMember.full_name || editingMember.username}`} onClose={() => setEditingMember(null)} wide>
          <form onSubmit={handleSaveEditUser} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* User Identity Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: 16, background: "var(--surface-2, #f8fafc)", borderRadius: 12, border: "1px solid var(--border)" }}>
              <span style={{ width: 48, height: 48, borderRadius: "50%", background: editingMember.is_organization_admin ? "linear-gradient(135deg, #d92d2d, #b91c1c)" : "linear-gradient(135deg, #4f46e5, #3730a3)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800 }}>
                {(editingMember.first_name?.[0] || editingMember.username?.[0] || "U").toUpperCase()}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <strong style={{ fontSize: 17, fontWeight: 800 }}>{editingMember.full_name || editingMember.username}</strong>
                  <span className="mono" style={{ fontSize: 12, color: "var(--muted)", background: "var(--surface)", padding: "2px 8px", borderRadius: 6, border: "1px solid var(--border)" }}>
                    @{editingMember.username}
                  </span>
                  {editingMember.is_organization_admin && (
                    <span style={{ fontSize: 10, fontWeight: 800, background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a", padding: "2px 8px", borderRadius: 12 }}>
                      👑 Super Admin
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                  ✉️ {editingMember.email || "No email"} {editingMember.phone_number ? `· 📞 ${editingMember.phone_number}` : ""}
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="First Name">
                <input
                  autoComplete="given-name"
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                  placeholder="First name"
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 13 }}
                />
              </Field>
              <Field label="Last Name">
                <input
                  autoComplete="family-name"
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                  placeholder="Last name"
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 13 }}
                />
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Verified Work Email Address">
                <input
                  type="email"
                  autoComplete="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="user@centerestates.com"
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 13 }}
                />
              </Field>
              <Field label="Contact Phone Number">
                <input
                  autoComplete="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="+254 700 000 000"
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 13 }}
                />
              </Field>
            </div>

            {/* Super Admin Switch */}
            <div style={{ padding: "14px 18px", background: editIsAdmin ? "#fef3c7" : "var(--surface-2, #f8fafc)", borderRadius: 12, border: editIsAdmin ? "1px solid #fde68a" : "1px solid var(--border)" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", fontSize: 14, fontWeight: 800, color: editIsAdmin ? "#92400e" : "var(--text)" }}>
                <input
                  type="checkbox"
                  checked={editIsAdmin}
                  onChange={(e) => setEditIsAdmin(e.target.checked)}
                  style={{ width: 18, height: 18, cursor: "pointer" }}
                />
                👑 Super Administrator (Portfolio-wide unrestricted access across all modules)
              </label>
              {editIsAdmin && (
                <p style={{ margin: "6px 0 0 30px", fontSize: 12, color: "#92400e", lineHeight: 1.4 }}>
                  User has full administrative capabilities across all estates and modules. You can still assign specific functional roles below for fine-grained scoping.
                </p>
              )}
            </div>

            {/* Module Access Entitlement & Functional Roles */}
            <div style={{ background: "var(--surface, #ffffff)", border: "1px solid var(--border, #e2e8f0)", borderRadius: 12, padding: 18, boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
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
                    style={{ padding: "6px 10px", fontSize: 12, borderRadius: 6, border: "1px solid var(--border)", width: 170 }}
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

              {/* Module Cards List */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
                        border: isModActive ? `1.5px solid ${mod.accent}` : "1px solid var(--border)",
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
                          padding: "12px 16px",
                          background: isModActive ? `linear-gradient(90deg, ${mod.accent}12, transparent)` : "transparent",
                          cursor: "pointer",
                          gap: 12,
                        }}
                        onClick={() => setExpandedModules((prev) => ({ ...prev, [mod.slug]: !isExpanded }))}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
                          <span style={{ fontSize: 22, flexShrink: 0 }}>{mod.icon}</span>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <strong style={{ fontSize: 14, color: isModActive ? mod.accent : "var(--text)" }}>{mod.label}</strong>
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  padding: "2px 8px",
                                  borderRadius: 12,
                                  background: isModActive ? `${mod.accent}22` : "var(--border)",
                                  color: isModActive ? mod.accent : "var(--muted)",
                                }}
                              >
                                {isModActive ? `${activeModRoles.length} of ${modRoles.length} roles active` : "Module Inactive"}
                              </span>
                            </div>
                            <span style={{ fontSize: 11, color: "var(--muted)", display: "block", marginTop: 2 }}>{mod.desc}</span>
                          </div>
                        </div>

                        {/* Module Toggle & Expand */}
                        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, fontWeight: 800, color: isModActive ? mod.accent : "var(--muted)" }}>
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
                          <span style={{ fontSize: 12, color: "var(--muted)", cursor: "pointer" }} onClick={() => setExpandedModules((prev) => ({ ...prev, [mod.slug]: !isExpanded }))}>
                            {isExpanded ? "▲" : "▼"}
                          </span>
                        </div>
                      </div>

                      {/* Collapsible Roles Grid */}
                      {isExpanded && (
                        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
                          {filteredModRoles.length === 0 ? (
                            <div style={{ fontSize: 11, color: "var(--muted)" }}>No roles configured for this module.</div>
                          ) : (
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 8 }}>
                              {filteredModRoles.map((r) => {
                                const isSelected = editSelectedRoles.includes(r.id);
                                return (
                                  <label
                                    key={r.id}
                                    style={{
                                      display: "flex",
                                      alignItems: "flex-start",
                                      gap: 8,
                                      padding: "8px 12px",
                                      borderRadius: 8,
                                      border: isSelected ? `1.5px solid ${mod.accent}` : "1px solid var(--border)",
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
                                      style={{ marginTop: 3, cursor: "pointer" }}
                                    />
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                      <strong style={{ fontSize: 12, display: "block", color: isSelected ? mod.accent : "var(--text)" }}>
                                        {r.name}
                                      </strong>
                                      {r.description && (
                                        <span style={{ fontSize: 10, color: "var(--muted)", display: "block", lineHeight: 1.3, marginTop: 1 }}>
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
            <div style={{ background: "var(--surface, #ffffff)", border: "1px solid var(--border, #e2e8f0)", borderRadius: 12, padding: 18, boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
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
                    style={{ padding: "6px 10px", fontSize: 12, borderRadius: 6, border: "1px solid var(--border)", width: 160 }}
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
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8, maxHeight: 200, overflowY: "auto", padding: 2 }}>
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
                            padding: "8px 12px",
                            borderRadius: 8,
                            border: isSelected ? "1.5px solid #0284c7" : "1px solid var(--border)",
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

            {/* Sticky Actions Footer */}
            <div style={{ position: "sticky", bottom: -16, background: "var(--surface)", borderTop: "1px solid var(--border)", paddingTop: 14, paddingBottom: 6, display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14, zIndex: 10 }}>
              <button type="button" className="btn ghost" onClick={() => setEditingMember(null)} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="btn primary" disabled={saving} style={{ background: "#d92d2d", borderColor: "#d92d2d", padding: "10px 22px", fontWeight: 800 }}>
                {saving ? "Saving Changes…" : "Save Matrix Changes"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 3: BROADCAST SYSTEM NOTICE */}
      {showBroadcastModal && (
        <Modal title="📢 Broadcast System Notice to Organization" onClose={() => setShowBroadcastModal(false)} wide>
          <form onSubmit={handleSendBroadcast} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ padding: 14, background: "rgba(2, 132, 199, 0.08)", border: "1px solid #bae6fd", borderRadius: 10 }}>
              <strong style={{ fontSize: 13, color: "#0369a1", display: "block" }}>
                Multi-Channel Announcement Dispatch
              </strong>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#0284c7", lineHeight: 1.4 }}>
                This notice will be delivered instantly to all active team members across the organization via their In-App Notification Bell, live pop-up toast alerts, and optional verified Outbound Email.
              </p>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 800, marginBottom: 6 }}>
                Announcement Headline / Title <span style={{ color: "#d92d2d" }}>*</span>
              </label>
              <input
                required
                value={broadcastTitle}
                onChange={(e) => setBroadcastTitle(e.target.value)}
                placeholder="e.g. Scheduled System Upgrade or Important Estate Valuation Workflow"
                style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: 13, fontWeight: 600 }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 800, marginBottom: 6 }}>
                  Alert Priority Level
                </label>
                <select
                  value={broadcastLevel}
                  onChange={(e) => setBroadcastLevel(e.target.value)}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: 13 }}
                >
                  <option value="info">ℹ️ Info / General Announcement</option>
                  <option value="warning">⚠️ Warning / Operational Alert</option>
                  <option value="urgent">🚨 Urgent / Action Required</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 800, marginBottom: 6 }}>
                  Direct Deep-Link Action URL
                </label>
                <input
                  value={broadcastActionUrl}
                  onChange={(e) => setBroadcastActionUrl(e.target.value)}
                  placeholder="/companion or /valuation"
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: 13 }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 800, marginBottom: 6 }}>
                Notice Message Content <span style={{ color: "#d92d2d" }}>*</span>
              </label>
              <textarea
                required
                rows={4}
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                placeholder="Write your announcement details here. It will be formatted into an executive email and in-app alert..."
                style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: 13, lineHeight: 1.4, resize: "vertical" }}
              />
            </div>

            <div style={{ padding: "12px 16px", background: "var(--surface-2, #f8fafc)", borderRadius: 10, border: "1px solid var(--border)" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
                <input
                  type="checkbox"
                  checked={broadcastSendEmail}
                  onChange={(e) => setBroadcastSendEmail(e.target.checked)}
                  style={{ width: 18, height: 18, cursor: "pointer" }}
                />
                <span>✉️ Also dispatch email notification via verified Outbound SMTP Gateway</span>
              </label>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
              <button
                type="button"
                className="btn ghost"
                onClick={() => setShowBroadcastModal(false)}
                disabled={broadcasting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn primary"
                disabled={broadcasting || !broadcastTitle.trim() || !broadcastMessage.trim()}
                style={{ background: "#d92d2d", borderColor: "#d92d2d", padding: "10px 22px", fontWeight: 800 }}
              >
                {broadcasting ? "Dispatching Broadcast…" : "📢 Send Broadcast Notice"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 7: TEST M-PESA STK PUSH */}
      {testingGateway && (
        <Modal title={`⚡ Test M-Pesa STK Push — ${testingGateway.display_name}`} onClose={() => setTestingGateway(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ padding: "12px 16px", background: "var(--surface-sunken, #f8fafc)", borderRadius: 10, border: "1px solid var(--border)", fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span>Shortcode / Paybill:</span>
                <strong style={{ fontFamily: "monospace" }}>{testingGateway.settings?.shortcode || "—"}</strong>
              </div>
              {testingGateway.settings?.bank_name && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span>Bank &amp; Account:</span>
                  <strong>{testingGateway.settings.bank_name} ({testingGateway.settings.bank_account_number || "—"})</strong>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Environment:</span>
                <span style={{ fontWeight: 800, color: testingGateway.settings?.environment === "production" ? "#16a34a" : "#ca8a04" }}>
                  {testingGateway.settings?.environment === "production" ? "LIVE (Production)" : "SANDBOX"}
                </span>
              </div>
            </div>

            {stkTestResult && (
              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: 8,
                  fontSize: 13,
                  background: stkTestResult.type === "success" ? "#dcfce7" : "#fee2e2",
                  color: stkTestResult.type === "success" ? "#166534" : "#991b1b",
                  border: `1px solid ${stkTestResult.type === "success" ? "#bbf7d0" : "#fecaca"}`,
                }}
              >
                <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                  <span>{stkTestResult.type === "success" ? "✓" : "⚠️"}</span>
                  <span>{stkTestResult.text}</span>
                </div>
                {stkTestResult.details && (
                  <div style={{ marginTop: 4, fontSize: 11, fontFamily: "monospace", opacity: 0.9 }}>
                    {stkTestResult.details}
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleTestStk} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 800, marginBottom: 6 }}>
                  Recipient Safaricom Phone Number <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  required
                  type="tel"
                  value={testStkPhone}
                  onChange={(e) => setTestStkPhone(e.target.value)}
                  placeholder="e.g. 0712345678 or 254712345678"
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: 14 }}
                />
                <span style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, display: "block" }}>
                  Enter your active Safaricom number. The STK Push PIN prompt will pop up on your phone.
                </span>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 800, marginBottom: 6 }}>
                  Test Amount (KES)
                </label>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={testStkAmount}
                  onChange={(e) => setTestStkAmount(e.target.value)}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: 14 }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setTestingGateway(null)}
                  disabled={testingStkLoading}
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="btn primary"
                  disabled={testingStkLoading || !testStkPhone.trim()}
                  style={{
                    background: "linear-gradient(135deg, #00a651 0%, #007a3d 100%)",
                    borderColor: "#00a651",
                    color: "#fff",
                    fontWeight: 800,
                    padding: "10px 22px",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span>{testingStkLoading ? "⏳ Sending STK Push…" : "📲 Send STK Push Prompt"}</span>
                </button>
              </div>
            </form>
          </div>
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
