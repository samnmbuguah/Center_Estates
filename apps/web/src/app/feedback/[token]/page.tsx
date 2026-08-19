"use client";

import { FormEvent, useEffect, useState, use } from "react";
import {
  AlertCircle, CheckCircle, Clock, MapPin, Send, Shield, User,
  CheckCircle2, RefreshCw, MessageSquare, ExternalLink, Camera,
  FileText, Sparkles, Building2, HelpCircle
} from "lucide-react";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1").replace(/\/$/, "");

type CategoryItem = { id: string; label: string; icon: string };

type Context = {
  label: string;
  property: string;
  property_id: string;
  building: string;
  floor: string;
  unit: string;
  categories: CategoryItem[];
};

type TicketStatus = {
  reference: string;
  title: string;
  category: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: string;
  property_name: string;
  location_detail: string;
  assigned_team: string;
  assigned_to: string;
  created_at: string;
  sla_due_at?: string;
  resolved_at?: string;
  confirmed_at?: string;
  resolution_notes?: string;
  reopened_count: number;
  messages: { sender: string; message: string; is_developer_response: boolean; created_at: string }[];
};

const DEFAULT_CATEGORIES: CategoryItem[] = [
  { id: "Plumbing", label: "Plumbing & Drainage", icon: "🚰" },
  { id: "Electrical", label: "Electrical & Lighting", icon: "⚡" },
  { id: "Cleaning", label: "Cleaning & Janitorial", icon: "🧹" },
  { id: "Security", label: "Security & Guarding", icon: "🛡️" },
  { id: "Lift", label: "Elevator / Lift", icon: "🛗" },
  { id: "Access", label: "Access Control & Doors", icon: "🚪" },
  { id: "Water", label: "Water Supply & Pumps", icon: "💧" },
  { id: "Common Area", label: "Common Area & Facilities", icon: "🏢" },
  { id: "Other", label: "General / Other Inquiry", icon: "📝" },
];

export default function PublicFeedbackPage({ params }: { params: Promise<{ token: string }> }) {
  const unwrappedParams = use(params);
  const token = unwrappedParams.token;

  const [context, setContext] = useState<Context | null>(null);
  const [categories, setCategories] = useState<CategoryItem[]>(DEFAULT_CATEGORIES);
  const [state, setState] = useState<"loading" | "ready" | "tracking" | "error">("loading");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [selectedCategory, setSelectedCategory] = useState("Plumbing");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [name, setName] = useState("");
  const [contactChannel, setContactChannel] = useState<"email" | "whatsapp_number" | "whatsapp_username" | "phone">("email");
  const [contactValue, setContactValue] = useState("");
  const [priority, setPriority] = useState<"normal" | "urgent">("normal");
  const [photoUrl, setPhotoUrl] = useState("");

  // Tracking State
  const [ticketRef, setTicketRef] = useState("");
  const [ticket, setTicket] = useState<TicketStatus | null>(null);
  const [actionNote, setActionNote] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Load QR Context
  useEffect(() => {
    fetch(`${API_BASE}/companion/public-feedback/${encodeURIComponent(token)}/`)
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.detail || "This QR Helpdesk link is unavailable.");
        setContext(body as Context);
        if (body.categories && Array.isArray(body.categories)) {
          setCategories(body.categories);
        }
        // Check URL search params for existing reference
        const searchParams = new URLSearchParams(window.location.search);
        const ref = searchParams.get("ref");
        if (ref) {
          setTicketRef(ref);
          void loadTicketStatus(ref);
        } else {
          setState("ready");
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "This QR Helpdesk link is unavailable.");
        setState("error");
      });
  }, [token]);

  async function loadTicketStatus(ref: string) {
    try {
      const res = await fetch(`${API_BASE}/companion/public-ticket/${encodeURIComponent(ref)}/`);
      if (res.ok) {
        const data = (await res.json()) as TicketStatus;
        setTicket(data);
        setTicketRef(ref);
        setState("tracking");
      } else {
        setState("ready");
      }
    } catch {
      setState("ready");
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!description.trim()) {
      setError("Please describe the issue.");
      return;
    }
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch(`${API_BASE}/companion/public-feedback/${encodeURIComponent(token)}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: selectedCategory,
          title: title || `${selectedCategory} Request - ${context?.label || ""}`,
          description,
          name,
          contact_channel: contactChannel,
          contact_value: contactValue,
          priority,
          photo_url: photoUrl,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || data.message || "Failed to submit helpdesk ticket.");
      }

      const reference = data.reference || data.ticket_no;
      setTicketRef(reference);
      window.history.replaceState(null, "", `?ref=${reference}`);
      await loadTicketStatus(reference);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed. Please check connection.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTicketAction(action: "confirm" | "reopen") {
    if (!ticketRef) return;
    setActionBusy(true);
    setActionMessage(null);
    try {
      const res = await fetch(`${API_BASE}/companion/public-ticket/${encodeURIComponent(ticketRef)}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: actionNote }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setActionMessage({ type: "success", text: data.detail || "Ticket updated successfully." });
        setActionNote("");
        await loadTicketStatus(ticketRef);
      } else {
        setActionMessage({ type: "error", text: data.detail || "Failed to update ticket status." });
      }
    } catch {
      setActionMessage({ type: "error", text: "Network error occurred." });
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(180deg, #f1f5f9 0%, #e2e8f0 100%)", padding: "16px 12px 48px", display: "flex", justifyContent: "center", alignItems: "flex-start", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 640 }}>
        {/* Header Branding */}
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#dc2626", color: "#fff", padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
            <Shield size={13} />
            <span>Center Estates Smart Helpdesk</span>
          </div>
          <h1 style={{ margin: "2px 0 0", fontSize: 22, fontWeight: 800, color: "#0f172a" }}>
            {state === "tracking" ? "Helpdesk Ticket Status" : "Report an Issue or Request Service"}
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>
            Instant QR issue logging &amp; automatic team dispatch
          </p>
        </div>

        {/* Location Banner Card */}
        {context && (
          <div style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 14, padding: "12px 16px", marginBottom: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(220,38,38,0.1)", color: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Building2 size={20} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {context.property}
              </div>
              <div style={{ fontSize: 12, color: "#64748b", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                  <MapPin size={11} /> {context.label}
                </span>
                {context.building && <span>· {context.building}</span>}
                {context.floor && <span>· Floor {context.floor}</span>}
                {context.unit && <span>· Unit {context.unit}</span>}
              </div>
            </div>
          </div>
        )}

        {/* ERROR STATE */}
        {state === "error" && (
          <div style={{ background: "#ffffff", border: "1px solid #fecaca", borderRadius: 16, padding: 24, textAlign: "center", boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}>
            <AlertCircle size={36} color="#dc2626" style={{ margin: "0 auto 10px" }} />
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 6px", color: "#991b1b" }}>Helpdesk Form Unavailable</h2>
            <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>{error}</p>
          </div>
        )}

        {/* LOADING STATE */}
        {state === "loading" && (
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 36, textAlign: "center" }}>
            <div style={{ display: "inline-block", width: 28, height: 28, border: "3px solid #cbd5e1", borderTopColor: "#dc2626", borderRadius: "50%", animation: "spin 0.8s linear infinite", marginBottom: 12 }} />
            <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>Connecting to property smart helpdesk…</p>
          </div>
        )}

        {/* FORM CREATION STATE */}
        {state === "ready" && (
          <form onSubmit={handleSubmit} style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 18, padding: "20px 18px", boxShadow: "0 8px 30px rgba(15,23,42,0.08)", display: "flex", flexDirection: "column", gap: 18 }}>
            {error && (
              <div style={{ padding: "10px 14px", borderRadius: 8, background: "#fee2e2", color: "#991b1b", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {/* 1. Category Selection Grid */}
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>
                1. Select Issue Category <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {categories.map((cat) => {
                  const isSelected = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategory(cat.id)}
                      style={{
                        padding: "10px 6px",
                        borderRadius: 10,
                        border: isSelected ? "2px solid #dc2626" : "1px solid #e2e8f0",
                        background: isSelected ? "rgba(220,38,38,0.05)" : "#f8fafc",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 4,
                        textAlign: "center",
                        transition: "all 0.12s ease",
                      }}
                    >
                      <span style={{ fontSize: 20 }}>{cat.icon}</span>
                      <span style={{ fontSize: 11, fontWeight: isSelected ? 800 : 600, color: isSelected ? "#dc2626" : "#334155", lineHeight: 1.2 }}>
                        {cat.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Issue Description */}
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>
                2. Describe the Issue / Request <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <textarea
                required
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Where exactly is the issue and what is happening? (e.g. Water dripping under sink in Washroom 2)"
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", resize: "vertical" }}
              />
            </div>

            {/* 3. Priority Level */}
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>
                3. Priority / Urgency
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setPriority("normal")}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: priority === "normal" ? "2px solid #2563eb" : "1px solid #e2e8f0",
                    background: priority === "normal" ? "rgba(37,99,235,0.06)" : "#f8fafc",
                    fontWeight: 700,
                    fontSize: 12,
                    color: priority === "normal" ? "#1d4ed8" : "#475569",
                    cursor: "pointer",
                  }}
                >
                  🟢 Normal (24h SLA)
                </button>
                <button
                  type="button"
                  onClick={() => setPriority("urgent")}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: priority === "urgent" ? "2px solid #dc2626" : "1px solid #e2e8f0",
                    background: priority === "urgent" ? "rgba(220,38,38,0.06)" : "#f8fafc",
                    fontWeight: 700,
                    fontSize: 12,
                    color: priority === "urgent" ? "#991b1b" : "#475569",
                    cursor: "pointer",
                  }}
                >
                  🔴 Urgent / Safety (4h SLA)
                </button>
              </div>
            </div>

            {/* 4. Requester Contact Information */}
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <User size={15} color="#dc2626" />
                <span>4. Your Contact (for Ticket Acknowledgment & Updates)</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>
                    Your Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Alex Kamau (Tenant / Visitor / Cleaner)"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13, boxSizing: "border-box" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>
                    Preferred Update Channel
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 8 }}>
                    {[
                      { id: "email", label: "Email" },
                      { id: "whatsapp_number", label: "WhatsApp" },
                      { id: "phone", label: "Phone" },
                      { id: "whatsapp_username", label: "WA User" },
                    ].map((ch) => (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => setContactChannel(ch.id as any)}
                        style={{
                          padding: "6px 4px",
                          borderRadius: 6,
                          border: contactChannel === ch.id ? "1.5px solid #0f172a" : "1px solid #cbd5e1",
                          background: contactChannel === ch.id ? "#0f172a" : "#fff",
                          color: contactChannel === ch.id ? "#fff" : "#334155",
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {ch.label}
                      </button>
                    ))}
                  </div>

                  <input
                    type={contactChannel === "email" ? "email" : "text"}
                    value={contactValue}
                    onChange={(e) => setContactValue(e.target.value)}
                    placeholder={
                      contactChannel === "email"
                        ? "name@example.com (receive instant receipt)"
                        : contactChannel === "whatsapp_number" || contactChannel === "phone"
                        ? "e.g. 0712345678 or +254712345678"
                        : "WhatsApp username (e.g. @alex_k)"
                    }
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13, boxSizing: "border-box" }}
                  />
                </div>
              </div>
            </div>

            {/* 5. Photo / Document Attachment */}
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>
                Photo or Document URL (Optional)
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="url"
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  placeholder="https://... (link to photo/video evidence)"
                  style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13, boxSizing: "border-box" }}
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              style={{
                background: "#dc2626",
                color: "#ffffff",
                border: 0,
                borderRadius: 10,
                padding: "14px 20px",
                fontSize: 15,
                fontWeight: 800,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                boxShadow: "0 4px 14px rgba(220,38,38,0.3)",
                transition: "background 0.15s ease",
              }}
            >
              {submitting ? (
                <>
                  <span style={{ display: "inline-block", width: 16, height: 16, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  <span>Logging Ticket &amp; Dispatching Team…</span>
                </>
              ) : (
                <>
                  <Send size={17} />
                  <span>Submit Ticket &amp; Request Help</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* LIVE TICKET TRACKING STATE */}
        {state === "tracking" && ticket && (
          <div style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 18, padding: 20, boxShadow: "0 8px 30px rgba(15,23,42,0.08)", display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Top Ticket Status Header */}
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: "16px 18px", textAlign: "center" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#166534", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
                Ticket Reference
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "#15803d", fontFamily: "monospace" }}>
                {ticket.reference}
              </div>
              <div style={{ fontSize: 13, color: "#166534", fontWeight: 600, marginTop: 4 }}>
                {ticket.category} · {ticket.title}
              </div>
            </div>

            {/* SLA & Assignment Bar */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 14px" }}>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>Assigned Team</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginTop: 2 }}>{ticket.assigned_team}</div>
                <div style={{ fontSize: 11, color: "#475569" }}>{ticket.assigned_to}</div>
              </div>
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 14px" }}>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>Status &amp; Priority</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: ticket.status === "resolved" ? "#16a34a" : ticket.status === "closed" ? "#475569" : "#d97706", marginTop: 2, textTransform: "uppercase" }}>
                  {ticket.status.replace("_", " ")} ({ticket.priority})
                </div>
                <div style={{ fontSize: 11, color: "#64748b" }}>
                  {ticket.sla_due_at ? `SLA: ${new Date(ticket.sla_due_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Within 24h"}
                </div>
              </div>
            </div>

            {/* Stepper Lifecycle */}
            <div style={{ padding: "10px 0" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#475569", marginBottom: 10 }}>Ticket Lifecycle Progress:</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative" }}>
                {[
                  { key: "open", label: "Created" },
                  { key: "assigned", label: "Assigned" },
                  { key: "in_progress", label: "In Progress" },
                  { key: "resolved", label: "Resolved" },
                  { key: "closed", label: "Closed" },
                ].map((step, idx) => {
                  const stepIndex = ["open", "assigned", "in_progress", "resolved", "closed"].indexOf(step.key);
                  const currentIdx = ticket.status === "closed" ? 4 : ticket.status === "resolved" ? 3 : ticket.status === "in_progress" ? 2 : 1;
                  const isDone = currentIdx >= stepIndex;
                  return (
                    <div key={step.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, zIndex: 2 }}>
                      <div style={{ width: 24, height: 24, borderRadius: "50%", background: isDone ? "#16a34a" : "#e2e8f0", color: isDone ? "#fff" : "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800 }}>
                        {isDone ? "✓" : idx + 1}
                      </div>
                      <div style={{ fontSize: 10, fontWeight: isDone ? 700 : 500, color: isDone ? "#0f172a" : "#94a3b8" }}>{step.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Resolution Box if Resolved */}
            {ticket.status === "resolved" && (
              <div style={{ background: "#f0fdf4", border: "1.5px solid #86efac", borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#166534", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                  <CheckCircle2 size={16} />
                  <span>Work Completed &amp; Marked Resolved</span>
                </div>
                <p style={{ margin: "0 0 10px", fontSize: 13, color: "#166534" }}>
                  {ticket.resolution_notes || "The maintenance officer has completed work on this issue."}
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => handleTicketAction("confirm")}
                    style={{ background: "#16a34a", color: "#fff", border: 0, padding: "8px 14px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                  >
                    ✓ Confirm Resolution &amp; Close
                  </button>
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => handleTicketAction("reopen")}
                    style={{ background: "#fff", color: "#dc2626", border: "1px solid #dc2626", padding: "8px 14px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                  >
                    ↻ Reopen Ticket (Issue Persists)
                  </button>
                </div>
              </div>
            )}

            {/* Action Notice */}
            {actionMessage && (
              <div style={{ padding: "8px 12px", borderRadius: 8, background: actionMessage.type === "success" ? "#dcfce7" : "#fee2e2", color: actionMessage.type === "success" ? "#166534" : "#991b1b", fontSize: 13 }}>
                {actionMessage.text}
              </div>
            )}

            {/* Timeline / Messages */}
            {ticket.messages && ticket.messages.length > 0 && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <MessageSquare size={14} />
                  <span>Activity &amp; Dialogue</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 220, overflowY: "auto", paddingRight: 4 }}>
                  {ticket.messages.map((m, i) => (
                    <div key={i} style={{ background: m.is_developer_response ? "#f1f5f9" : "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b", marginBottom: 2 }}>
                        <strong>{m.sender}</strong>
                        <span>{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#1e293b" }}>{m.message}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bottom Actions */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTop: "1px solid #e2e8f0" }}>
              <button
                type="button"
                onClick={() => void loadTicketStatus(ticket.reference)}
                style={{ background: "none", border: 0, color: "#2563eb", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}
              >
                <RefreshCw size={13} /> Refresh Status
              </button>
              <button
                type="button"
                onClick={() => { setState("ready"); setTicket(null); setTicketRef(""); window.history.replaceState(null, "", window.location.pathname); }}
                style={{ background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
              >
                + Raise Another Request
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

