"use client";

import React, { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { Modal } from "@/components/module-ui";

export function EmailUpdateBanner() {
  const { session } = useAuth();
  const [profileData, setProfileData] = useState<{
    email: string;
    is_placeholder_email: boolean;
    full_name: string;
  } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!session?.user) return;
    let cancelled = false;
    async function checkProfile() {
      try {
        const res = await apiFetch("/organizations/members/me/");
        if (res.ok && !cancelled) {
          const json = await res.json();
          setProfileData(json);
          setNewEmail(json.email || "");
        }
      } catch {
        // Ignore background fetch error
      }
    }
    // This is a helpful prompt, not a prerequisite for opening a workspace.
    // Delay the profile lookup so it cannot compete with session bootstrap on
    // constrained hosting workers.
    const deferredCheck = window.setTimeout(() => void checkProfile(), 6_000);
    return () => {
      cancelled = true;
      window.clearTimeout(deferredCheck);
    };
  }, [session?.user]);

  if (!session?.user || dismissed || !profileData || !profileData.is_placeholder_email) {
    return null;
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newEmail.includes("@")) {
      setError("Please enter a valid work email address.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await apiFetch("/organizations/members/me/", {
        method: "PATCH",
        body: JSON.stringify({ email: newEmail.trim() }),
      });
      if (res.ok) {
        setSuccess(true);
        setProfileData((prev) => prev ? { ...prev, email: newEmail.trim(), is_placeholder_email: false } : null);
        setTimeout(() => {
          setShowModal(false);
        }, 1200);
      } else {
        const data = await res.json();
        setError(data.detail || "Failed to update email.");
      }
    } catch {
      setError("An unexpected error occurred. Please retry.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <aside
        aria-label="Email update required"
        style={{
          background: "linear-gradient(90deg, #fffbeb 0%, #fef3c7 100%)",
          borderBottom: "1.5px solid #fde68a",
          padding: "10px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          boxShadow: "0 2px 8px rgba(245, 158, 11, 0.08)",
          zIndex: 40,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: 20 }}>✉️</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <strong style={{ fontSize: 13, color: "#92400e", display: "inline" }}>
              Action Required: Set your real work email address.
            </strong>
            <span style={{ fontSize: 12, color: "#b45309", marginLeft: 6 }}>
              You are currently using a system-generated placeholder ({profileData.email || "No email"}). Add your verified email to receive task alerts, daily briefings, and tenant messages.
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            style={{
              background: "#d97706",
              color: "#ffffff",
              border: "none",
              borderRadius: 8,
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 2px 6px rgba(217, 119, 6, 0.25)",
            }}
          >
            Update Email Address →
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss banner for now"
            style={{
              background: "none",
              border: "none",
              color: "#b45309",
              fontSize: 16,
              cursor: "pointer",
              padding: "2px 6px",
              fontWeight: 800,
            }}
          >
            ×
          </button>
        </div>
      </aside>

      {showModal && (
        <Modal title="✉️ Update Your Work Email Address" onClose={() => setShowModal(false)}>
          <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
              Your email is used to dispatch task assignment alerts, daily operational briefings from Quartermaster, and automated tenant communications via the verified organizational SMTP gateway.
            </p>

            {error && (
              <div style={{ padding: "10px 14px", borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 12, fontWeight: 700 }}>
                {error}
              </div>
            )}

            {success && (
              <div style={{ padding: "10px 14px", borderRadius: 8, background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#16a34a", fontSize: 12, fontWeight: 800 }}>
                ✓ Email updated successfully! You will now receive all system notifications.
              </div>
            )}

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 800, marginBottom: 6, color: "var(--text)" }}>
                Verified Work Email Address <span style={{ color: "#d92d2d" }}>*</span>
              </label>
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="e.g. name@centerestates.com"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1.5px solid var(--border)",
                  fontSize: 14,
                  fontWeight: 600,
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
              <button
                type="button"
                className="btn ghost"
                onClick={() => setShowModal(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn primary"
                disabled={saving || !newEmail.trim()}
                style={{ background: "#d97706", borderColor: "#d97706", fontWeight: 800 }}
              >
                {saving ? "Saving…" : "Save & Verify Email"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
