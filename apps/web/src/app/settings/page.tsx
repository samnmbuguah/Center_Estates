"use client";

import { useState, useEffect, FormEvent, Suspense } from "react";
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

  // Notification Preferences State
  const [prefLoading, setPrefLoading] = useState(false);
  const [prefSaving, setPrefSaving] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [inAppEnabled, setInAppEnabled] = useState(true);
  const [notifyTaskAssigned, setNotifyTaskAssigned] = useState(true);
  const [notifyTaskDueSla, setNotifyTaskDueSla] = useState(true);
  const [notifyCompanionFeedback, setNotifyCompanionFeedback] = useState(true);
  const [notifyTicketUpdates, setNotifyTicketUpdates] = useState(true);
  const [notifyFinancialAlerts, setNotifyFinancialAlerts] = useState(true);

  // Load preferences
  useEffect(() => {
    if (!organizationId) return;
    setPrefLoading(true);
    apiFetch("/notifications/preferences/mine/", {}, organizationId)
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setEmailEnabled(data.email_enabled ?? true);
          setInAppEnabled(data.in_app_enabled ?? true);
          setNotifyTaskAssigned(data.notify_task_assigned ?? true);
          setNotifyTaskDueSla(data.notify_task_due_sla ?? true);
          setNotifyCompanionFeedback(data.notify_companion_feedback ?? true);
          setNotifyTicketUpdates(data.notify_ticket_updates ?? true);
          setNotifyFinancialAlerts(data.notify_financial_alerts ?? true);
        }
      })
      .catch((err) => console.error("Failed to load user notification preferences", err))
      .finally(() => setPrefLoading(false));
  }, [organizationId]);

  async function handleSavePreferences(e: FormEvent) {
    e.preventDefault();
    if (!organizationId) return;
    setPrefSaving(true);
    setNotice(null);
    try {
      const res = await apiFetch(
        "/notifications/preferences/mine/",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email_enabled: emailEnabled,
            in_app_enabled: inAppEnabled,
            notify_task_assigned: notifyTaskAssigned,
            notify_task_due_sla: notifyTaskDueSla,
            notify_companion_feedback: notifyCompanionFeedback,
            notify_ticket_updates: notifyTicketUpdates,
            notify_financial_alerts: notifyFinancialAlerts,
          }),
        },
        organizationId
      );
      if (res.ok) {
        setNotice({ type: "success", text: "Your notification and email preferences have been saved." });
      } else {
        setNotice({ type: "error", text: "Failed to save preferences. Please retry." });
      }
    } catch {
      setNotice({ type: "error", text: "Network error saving notification preferences." });
    } finally {
      setPrefSaving(false);
    }
  }

  // Profile editing state
  const [profileFirstName, setProfileFirstName] = useState("");
  const [profileLastName, setProfileLastName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileNotice, setProfileNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (user) {
      setProfileFirstName(user.firstName || "");
      setProfileLastName(user.lastName || "");
      setProfileEmail(user.email || "");
    }
  }, [user]);

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    setProfileSaving(true);
    setProfileNotice(null);
    try {
      const res = await apiFetch("/auth/me/", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: profileFirstName.trim(),
          lastName: profileLastName.trim(),
          email: profileEmail.trim().toLowerCase(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setProfileNotice({ type: "success", text: "Profile information updated successfully!" });
        if (typeof window !== "undefined") {
          window.location.reload();
        }
      } else {
        setProfileNotice({ type: "error", text: data.email || data.detail || "Failed to update profile." });
      }
    } catch {
      setProfileNotice({ type: "error", text: "An error occurred while saving profile changes." });
    } finally {
      setProfileSaving(false);
    }
  }

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1000, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 800, color: "var(--text, var(--color-slate-800))" }}>
          ⚙️ User & Operational Settings
        </h1>
        <p style={{ margin: "4px 0 0", color: "var(--muted, var(--color-slate-500))", fontSize: "0.9rem" }}>
          Manage your account profile, test M-Pesa STK Push prompts, and configure notification preferences.
        </p>
      </div>



      {notice && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 8,
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: notice.type === "success" ? "rgba(22, 163, 74, 0.1)" : "rgba(220, 38, 38, 0.1)",
            color: notice.type === "success" ? "var(--color-success)" : "var(--color-danger)",
            border: `1px solid ${notice.type === "success" ? "var(--color-green-300)" : "var(--color-red-300)"}`,
          }}
        >
          {notice.type === "success" ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{notice.text}</span>
        </div>
      )}

      {/* TAB 1: PROFILE */}
      {tab === "profile" && (
        <div style={{ background: "var(--surface, #ffffff)", border: "1px solid var(--border, var(--color-slate-200))", borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
          <div style={{ marginBottom: 20, paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
            <h2 style={{ margin: "0 0 4px", fontSize: "1.2rem", fontWeight: 800 }}>👤 User Profile Information</h2>
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
              Update your personal details, display name, and login email address.
            </p>
          </div>

          {profileNotice && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                marginBottom: 18,
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: profileNotice.type === "success" ? "rgba(22, 163, 74, 0.1)" : "rgba(220, 38, 38, 0.1)",
                color: profileNotice.type === "success" ? "var(--color-success)" : "var(--color-danger)",
                border: `1px solid ${profileNotice.type === "success" ? "var(--color-green-300)" : "var(--color-red-300)"}`,
              }}
            >
              {profileNotice.type === "success" ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              <span style={{ fontSize: 13, fontWeight: 600 }}>{profileNotice.text}</span>
            </div>
          )}

          <form onSubmit={handleSaveProfile} style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 640 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>First Name:</label>
                <input
                  type="text"
                  value={profileFirstName}
                  onChange={(e) => setProfileFirstName(e.target.value)}
                  placeholder="First Name"
                  required
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Last Name:</label>
                <input
                  type="text"
                  value={profileLastName}
                  onChange={(e) => setProfileLastName(e.target.value)}
                  placeholder="Last Name"
                  required
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)" }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                  Email Address <span style={{ color: "var(--color-danger)" }}>*</span>:
                </label>
                <input
                  type="email"
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                  placeholder="user@centerestates.com"
                  required
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)" }}
                />
                <small style={{ color: "var(--muted)", fontSize: 11, marginTop: 4, display: "block" }}>
                  Used for account login, password resets, and notifications.
                </small>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Username (System ID):</label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={user?.username || ""}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-sunken)", color: "var(--muted)" }}
                />
                <small style={{ color: "var(--muted)", fontSize: 11, marginTop: 4, display: "block" }}>
                  Immutable unique identifier.
                </small>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Active Organization Roles:</label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={session?.roles?.join(", ") || "Member"}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-sunken)", color: "var(--muted)" }}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
              <button
                type="submit"
                disabled={profileSaving}
                className="btn primary"
                style={{ minWidth: 140, fontWeight: 700, padding: "10px 18px" }}
              >
                {profileSaving ? "Saving Profile..." : "Save Profile Changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: STK PUSH TEST TOOL */}
      {tab === "mpesa-test" && (
        <div style={{ background: "var(--surface, #ffffff)", border: "1px solid var(--border, var(--color-slate-200))", borderRadius: 12, padding: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>💳 M-Pesa STK Push Simulation & Test Tool</h2>
            <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "0.85rem" }}>
              Test the live Safaricom Daraja STK Push prompt by sending a real authorization request to your phone.
            </p>
          </div>

          <form onSubmit={handleTestStkPush} style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 500 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Recipient Phone Number (254...):</label>
              <input
                type="text"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="254700000000"
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
                background: "var(--color-brand-red)",
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
        <div style={{ background: "var(--surface, #ffffff)", border: "1px solid var(--border, var(--color-slate-200))", borderRadius: 12, padding: 24 }}>
          <div style={{ marginBottom: 18, paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
            <h2 style={{ margin: "0 0 4px", fontSize: "1.25rem", fontWeight: 800 }}>🔔 Notification & Email Preferences</h2>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.85rem" }}>
              Configure which alerts you receive in real-time in the platform and via your connected email ({user?.email || "account email"}).
            </p>
          </div>

          {prefLoading ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>Loading notification preferences…</div>
          ) : (
            <form onSubmit={handleSavePreferences} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Channel Controls */}
              <div style={{ background: "var(--surface-sunken, var(--color-slate-50))", border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)", marginBottom: 10 }}>Delivery Channels</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <label style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                    <input type="checkbox" checked={emailEnabled} onChange={(e) => setEmailEnabled(e.target.checked)} />
                    <span>✉️ Email Notifications ({user?.email || "account"})</span>
                  </label>
                  <label style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                    <input type="checkbox" checked={inAppEnabled} onChange={(e) => setInAppEnabled(e.target.checked)} />
                    <span>🔔 In-App Platform Alerts</span>
                  </label>
                </div>
              </div>

              {/* Event Subscriptions */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)" }}>Event Subscriptions</div>

                {[
                  {
                    key: "task_assigned",
                    title: "📋 Task & Work Order Assignments",
                    desc: "Notify me whenever a new task, work order, or inspection is assigned to me.",
                    checked: notifyTaskAssigned,
                    setter: setNotifyTaskAssigned,
                  },
                  {
                    key: "task_sla",
                    title: "⏰ Task SLA Due Dates & Escalations",
                    desc: "Alert me when assigned tasks approach SLA deadline or are escalated by management.",
                    checked: notifyTaskDueSla,
                    setter: setNotifyTaskDueSla,
                  },
                  {
                    key: "companion_feedback",
                    title: "💬 Companion & Developer Helpdesk Alerts",
                    desc: "Alert developer 'samuel' and supervisors when public or staff submit smart helpdesk requests.",
                    checked: notifyCompanionFeedback,
                    setter: setNotifyCompanionFeedback,
                  },
                  {
                    key: "ticket_updates",
                    title: "🎫 Ticket Lifecycle & Status Changes",
                    desc: "Receive updates when tickets are investigated, resolved, reopened, or confirmed by requesters.",
                    checked: notifyTicketUpdates,
                    setter: setNotifyTicketUpdates,
                  },
                  {
                    key: "financial_alerts",
                    title: "💰 Rent Invoicing & M-Pesa Payment Receipts",
                    desc: "Get notified when tenant rent invoices generate, payment receipts issue, or STK pushes succeed.",
                    checked: notifyFinancialAlerts,
                    setter: setNotifyFinancialAlerts,
                  },
                ].map((item) => (
                  <label
                    key={item.key}
                    style={{
                      display: "flex",
                      gap: 12,
                      alignItems: "flex-start",
                      padding: 12,
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      cursor: "pointer",
                      background: item.checked ? "var(--surface)" : "var(--surface-sunken)",
                      transition: "background 0.15s ease",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={(e) => item.setter(e.target.checked)}
                      style={{ marginTop: 3 }}
                    />
                    <div>
                      <strong style={{ fontSize: 13, color: "var(--text)" }}>{item.title}</strong>
                      <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--muted)" }}>{item.desc}</p>
                    </div>
                  </label>
                ))}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                <button
                  type="submit"
                  disabled={prefSaving}
                  style={{
                    background: "var(--color-danger)",
                    color: "#fff",
                    border: 0,
                    borderRadius: 8,
                    padding: "10px 20px",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  {prefSaving ? "Saving Preferences…" : "Save Notification Preferences"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* TAB 4: APPEARANCE */}
      {tab === "appearance" && (
        <div style={{ background: "var(--surface, #ffffff)", border: "1px solid var(--border, var(--color-slate-200))", borderRadius: 12, padding: 24 }}>
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
