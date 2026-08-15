"use client";

import { useState, FormEvent, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { apiFetch, csrfFromCookie } from "@/lib/api";
import { CheckCircle, AlertCircle, Send } from "lucide-react";

function SettingsContent() {
  const { session } = useAuth();
  const searchParams = useSearchParams();
  const organizationId = session?.activeOrganizationId ?? null;
  const user = session?.user;

  const urlTab = searchParams ? searchParams.get("tab") : null;
  const tab = (urlTab && ["profile", "mpesa-test", "notifications", "appearance"].includes(urlTab))
    ? (urlTab as "profile" | "mpesa-test" | "notifications" | "appearance")
    : "profile";

  // STK Push test tool state
  const [testPhone, setTestPhone] = useState("254700000000");
  const [testAmount, setTestAmount] = useState("10");
  const [testInvoice, setTestInvoice] = useState("INV-TEST-001");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleTestStkPush(e: FormEvent) {
    e.preventDefault();
    if (!organizationId) return;
    setBusy(true);
    setNotice(null);
    try {
      await apiFetch("/auth/csrf/");
      const response = await apiFetch(
        "/property/portal/payments/stk-push/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-CSRFToken": csrfFromCookie() },
          body: JSON.stringify({
            invoice: testInvoice,
            phone_number: testPhone,
            amount: testAmount,
          }),
        },
        organizationId
      );
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setNotice({
          type: "success",
          text: data.message || `STK Push prompt sent successfully to ${testPhone}! Enter PIN to complete.`,
        });
      } else {
        setNotice({
          type: "error",
          text: data.detail || data.phone_number || "Failed to trigger STK Push test.",
        });
      }
    } catch {
      setNotice({ type: "error", text: "Network error occurred while sending STK push test." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1000, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 800, color: "var(--text, #1e293b)" }}>
          ⚙️ User & Operational Settings
        </h1>
        <p style={{ margin: "4px 0 0", color: "var(--muted, #64748b)", fontSize: "0.9rem" }}>
          Manage your account profile, test M-Pesa STK Push prompts, and configure notification preferences.
        </p>
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

      {/* TAB 1: PROFILE */}
      {tab === "profile" && (
        <div style={{ background: "var(--surface, #ffffff)", border: "1px solid var(--border, #e2e8f0)", borderRadius: 12, padding: 24 }}>
          <h2 style={{ margin: "0 0 16px", fontSize: "1.2rem", fontWeight: 700 }}>👤 Account Profile & Details</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 500 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Username:</label>
              <input type="text" value={user?.username || ""} readOnly style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2, #f8fafc)" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Email Address:</label>
              <input type="email" value={user?.email || ""} readOnly style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2, #f8fafc)" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>First Name:</label>
              <input type="text" defaultValue={user?.firstName || ""} style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Last Name:</label>
              <input type="text" defaultValue={user?.lastName || ""} style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }} />
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: STK PUSH TEST TOOL */}
      {tab === "mpesa-test" && (
        <div style={{ background: "var(--surface, #ffffff)", border: "1px solid var(--border, #e2e8f0)", borderRadius: 12, padding: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>📱 M-Pesa STK Push Sandbox Test Tool</h2>
            <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "0.85rem" }}>
              Test your M-Pesa Daraja STK Push prompt by sending a real-time prompt to a Safaricom phone number.
            </p>
          </div>

          <form onSubmit={handleTestStkPush} style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 500 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>M-Pesa Phone Number:</label>
              <input
                type="text"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="2547XXXXXXXX or 07XXXXXXXX"
                required
                style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Amount (KES):</label>
              <input
                type="number"
                value={testAmount}
                onChange={(e) => setTestAmount(e.target.value)}
                required
                style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Invoice Reference:</label>
              <input
                type="text"
                value={testInvoice}
                onChange={(e) => setTestInvoice(e.target.value)}
                required
                style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                background: "#e23b3b",
                color: "#ffffff",
                padding: "10px 16px",
                borderRadius: 8,
                border: 0,
                fontWeight: 700,
                cursor: "pointer",
                marginTop: 8,
              }}
            >
              <Send size={16} />
              <span>{busy ? "Sending STK Push..." : "Trigger STK Push Prompt"}</span>
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: NOTIFICATIONS */}
      {tab === "notifications" && (
        <div style={{ background: "var(--surface, #ffffff)", border: "1px solid var(--border, #e2e8f0)", borderRadius: 12, padding: 24 }}>
          <h2 style={{ margin: "0 0 16px", fontSize: "1.2rem", fontWeight: 700 }}>🔔 Notification Preferences</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { title: "Invoice & Rent Payment Alerts", desc: "Receive email and SMS notifications when a tenant pays rent or when invoices are due." },
              { title: "M-Pesa STK Push Confirmations", desc: "Get real-time notification alerts when M-Pesa STK push transactions complete." },
              { title: "Maintenance Work Order Tickets", desc: "Receive alerts for new tickets, SLA escalations, and caretaker meter readings." },
            ].map((n) => (
              <label key={n.title} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: 12, border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer" }}>
                <input type="checkbox" defaultChecked style={{ marginTop: 3 }} />
                <div>
                  <strong style={{ fontSize: 14 }}>{n.title}</strong>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--muted)" }}>{n.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: APPEARANCE */}
      {tab === "appearance" && (
        <div style={{ background: "var(--surface, #ffffff)", border: "1px solid var(--border, #e2e8f0)", borderRadius: 12, padding: 24 }}>
          <h2 style={{ margin: "0 0 16px", fontSize: "1.2rem", fontWeight: 700 }}>🎨 Display & Regional Preferences</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 500 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Default Currency:</label>
              <select style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}>
                <option>KES (Kenya Shillings)</option>
                <option>USD (US Dollars)</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Date Format:</label>
              <select style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}>
                <option>DD/MM/YYYY (e.g. 13/08/2026)</option>
                <option>YYYY-MM-DD (e.g. 2026-08-13)</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading settings…</div>}>
      <SettingsContent />
    </Suspense>
  );
}
