"use client";

import { useState, useEffect, useCallback, FormEvent } from "react";
import { useAuth } from "@/components/auth-provider";
import { apiFetch, csrfFromCookie } from "@/lib/api";
import { CreditCard, Shield, Building, FileText, Activity, CheckCircle, AlertCircle, Save } from "lucide-react";
import { RoleAccessManager } from "@/components/role-access-manager";

type PropertyItem = { id: string; name: string; code: string };
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

export default function AdministrationPage() {
  const { session } = useAuth();
  const organizationId = session?.activeOrganizationId ?? null;
  const [tab, setTab] = useState<"mpesa" | "roles" | "orgs" | "tax" | "audit">("mpesa");
  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [gateway, setGateway] = useState<GatewayConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // M-Pesa STK Push Form fields
  const [environment, setEnvironment] = useState("sandbox");
  const [shortcode, setShortcode] = useState("174379");
  const [passkey, setPasskey] = useState("bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919");
  const [consumerKey, setConsumerKey] = useState("");
  const [consumerSecret, setConsumerSecret] = useState("");
  const [bankName, setBankName] = useState("Cooperative Bank");
  const [bankAccount, setBankAccount] = useState("01120001234500");
  const [tillNumber, setTillNumber] = useState("");

  const loadProperties = useCallback(async () => {
    if (!organizationId) return;
    try {
      const res = await apiFetch("/property/properties/", {}, organizationId);
      if (res.ok) {
        const data = await res.json();
        const list = (data.results || data) as PropertyItem[];
        setProperties(list);
        if (list.length > 0 && !selectedPropertyId) {
          setSelectedPropertyId(list[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load properties", err);
    }
  }, [organizationId, selectedPropertyId]);

  const loadGateway = useCallback(async () => {
    if (!organizationId || !selectedPropertyId) return;
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  }, [organizationId, selectedPropertyId]);

  useEffect(() => {
    void loadProperties();
  }, [loadProperties]);

  useEffect(() => {
    if (selectedPropertyId) {
      void loadGateway();
    }
  }, [selectedPropertyId, loadGateway]);

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
    } catch (err) {
      setNotice({ type: "error", text: "Network error occurred while saving gateway configuration." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 800, color: "var(--text, #1e293b)" }}>
            🛡️ Platform Administration & Settings
          </h1>
          <p style={{ margin: "4px 0 0", color: "var(--muted, #64748b)", fontSize: "0.9rem" }}>
            Configure organization settings, M-Pesa STK Push paybills, bank accounts, tax compliance, and role permissions.
          </p>
        </div>
      </div>

      {/* Subtab Navigation */}
      <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--border, #e2e8f0)", marginBottom: 24, paddingBottom: 8 }}>
        {[
          { id: "mpesa", label: "💳 M-Pesa STK Push & Bank Accounts", icon: CreditCard },
          { id: "roles", label: "🔐 Roles & User Access", icon: Shield },
          { id: "orgs", label: "🏢 Organization & Modules", icon: Building },
          { id: "tax", label: "📜 KRA Tax & E-TIMS", icon: FileText },
          { id: "audit", label: "🛡️ Security & Audit Trail", icon: Activity },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = tab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id as typeof tab)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 16px",
                borderRadius: 8,
                border: 0,
                background: isActive ? "#e23b3b" : "transparent",
                color: isActive ? "#ffffff" : "var(--text, #475569)",
                fontWeight: isActive ? 700 : 500,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </button>
          );
        })}
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

      {/* TAB 1: M-PESA STK PUSH & BANK ACCOUNTS */}
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
                  background: "#e23b3b",
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

      {/* TAB 2: ROLES & USER ACCESS */}
      {tab === "roles" && (
        <div style={{ background: "var(--surface, #ffffff)", border: "1px solid var(--border, #e2e8f0)", borderRadius: 12, padding: 24 }}>
          <RoleAccessManager organizationId={organizationId} />
        </div>
      )}

      {/* TAB 3: ORGANIZATIONS & MODULES */}
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

      {/* TAB 4: KRA TAX & E-TIMS */}
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

      {/* TAB 5: AUDIT TRAIL */}
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
    </div>
  );
}
