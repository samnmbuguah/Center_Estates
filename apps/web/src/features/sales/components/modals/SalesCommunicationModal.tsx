"use client";

import { useState } from "react";
import { Modal } from "@/components/module-ui";
import { cleanPhoneNumber, createWhatsAppUrl } from "../../utils/sales-communication";

export type SalesCommunicationModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  recipientName: string;
  defaultPhone?: string;
  initialMessage: string;
  type?: "visit" | "receipt" | "installment" | "custom";
};

export function SalesCommunicationModal({
  open,
  onClose,
  title,
  subtitle,
  recipientName,
  defaultPhone = "",
  initialMessage,
  type = "custom",
}: SalesCommunicationModalProps) {
  const [phone, setPhone] = useState(defaultPhone);
  const [message, setMessage] = useState(initialMessage);
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const normalizedPhone = cleanPhoneNumber(phone);
  const charCount = message.length;
  const smsSegments = Math.ceil(charCount / 160) || 1;

  const typeIcons: Record<string, string> = {
    visit: "📍",
    receipt: "🧾",
    installment: "🗓️",
    custom: "💬",
  };

  const typeLabels: Record<string, string> = {
    visit: "Site Visit Confirmation",
    receipt: "Payment Receipt Acknowledgment",
    installment: "Installment Due Notice",
    custom: "Client Communication",
  };

  function handleCopy() {
    navigator.clipboard?.writeText(message).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  }

  function handleOpenWhatsApp() {
    const url = createWhatsAppUrl(phone, message);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <Modal
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>{typeIcons[type] ?? "💬"}</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{title}</div>
            {subtitle && <small style={{ fontSize: 12, color: "var(--muted)" }}>{subtitle}</small>}
          </div>
        </div>
      }
      onClose={onClose}
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", flexWrap: "wrap", gap: 10 }}>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>
            {charCount} characters · ~{smsSegments} SMS {smsSegments === 1 ? "segment" : "segments"}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn ghost sm" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn ghost sm"
              onClick={handleCopy}
              style={copied ? { color: "var(--color-success-strong)", borderColor: "var(--color-success)" } : undefined}
            >
              {copied ? "✓ Copied to Clipboard" : "Copy Text"}
            </button>
            <button
              type="button"
              className="btn sm"
              onClick={handleOpenWhatsApp}
              style={{
                backgroundColor: "#25D366",
                color: "#ffffff",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>💬</span> Send via WhatsApp
            </button>
          </div>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Recipient summary bar */}
        <div
          style={{
            background: "var(--surface-sunken, #f8fafc)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "10px 14px",
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--muted)", fontWeight: 700 }}>
              Client / Recipient
            </span>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{recipientName || "Valued Client"}</div>
          </div>
          <div style={{ minWidth: 200 }}>
            <label style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--muted)", fontWeight: 700, display: "block", marginBottom: 2 }}>
              Phone Number (WhatsApp / SMS)
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 0712345678 or +254..."
              style={{
                width: "100%",
                padding: "6px 10px",
                fontSize: 13,
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--surface, #fff)",
              }}
            />
          </div>
        </div>

        {/* Message type badge & tips */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "3px 8px",
              borderRadius: 6,
              background: "rgba(37, 211, 102, 0.12)",
              color: "#0f8c3c",
            }}
          >
            ● {typeLabels[type] ?? "Client Message"}
          </span>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>
            Tip: You can edit the text before sending or copying.
          </span>
        </div>

        {/* Live message editor */}
        <div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={9}
            style={{
              width: "100%",
              padding: 12,
              fontFamily: "inherit",
              fontSize: 13,
              lineHeight: 1.5,
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--surface, #ffffff)",
              color: "var(--text-primary)",
              resize: "vertical",
            }}
          />
        </div>

        {/* Normalized phone indicator */}
        {phone && (
          <div style={{ fontSize: 11, color: "var(--muted)", display: "flex", alignItems: "center", gap: 6 }}>
            <span>WhatsApp Target:</span>
            <code style={{ background: "rgba(0,0,0,0.05)", padding: "2px 6px", borderRadius: 4 }}>
              +{normalizedPhone || phone}
            </code>
          </div>
        )}
      </div>
    </Modal>
  );
}
