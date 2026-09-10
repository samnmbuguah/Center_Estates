"use client";

import { FormEvent, useEffect, useState, use, useRef } from "react";
import {
  AlertCircle, CheckCircle, Clock, MapPin, Send, Shield, User,
  CheckCircle2, RefreshCw, MessageSquare, ExternalLink, Camera,
  FileText, Sparkles, Building2, HelpCircle, Phone, Mail,
  UploadCloud, X, ChevronRight, Share2, Copy, Check, ArrowRight,
  ShieldCheck, Wrench, Zap, Droplets, Flame, Key, Lock, Bell
} from "lucide-react";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1").replace(/\/$/, "");

type CategoryItem = { id: string; label: string; icon: string; desc?: string };

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
  acknowledgement_email_status?: "queued" | "failed" | "not_requested" | "unknown";
  messages: { sender: string; message: string; is_developer_response: boolean; created_at: string }[];
};

const DEFAULT_CATEGORIES: CategoryItem[] = [
  { id: "Plumbing", label: "Plumbing & Drainage", icon: "🚰", desc: "Leaks, clogs, low pressure, toilets" },
  { id: "Electrical", label: "Electrical & Lighting", icon: "⚡", desc: "Power outage, blown lights, sockets" },
  { id: "Cleaning", label: "Cleaning & Janitorial", icon: "🧹", desc: "Spills, bins, washroom hygiene" },
  { id: "Security", label: "Security & Guarding", icon: "🛡️", desc: "Gate, parking, visitor access, noise" },
  { id: "Lift", label: "Elevator / Lift", icon: "🛗", desc: "Elevator breakdown, doors, buttons" },
  { id: "Access", label: "Access & Doors", icon: "🚪", desc: "Keycards, broken locks, gates" },
  { id: "Water", label: "Water & Pumps", icon: "💧", desc: "Borehole, tank supplies, pressure" },
  { id: "Common Area", label: "Facilities & Grounds", icon: "🏢", desc: "Gym, stairs, garden, paintwork" },
  { id: "Other", label: "General Inquiry", icon: "📝", desc: "Billing, concierge, general requests" },
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
  const [contactChannel, setContactChannel] = useState<"email" | "whatsapp_number" | "phone">("email");
  const [contactValue, setContactValue] = useState("");
  const [priority, setPriority] = useState<"normal" | "urgent">("normal");
  const [photoUrl, setPhotoUrl] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
        if (!response.ok) throw new Error(body.detail || "This QR Helpdesk link is no longer active.");
        setContext(body as Context);
        if (body.categories && Array.isArray(body.categories)) {
          setCategories(body.categories);
        }
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

  async function handleFileUpload(file: File) {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      setError("File size exceeds 25 MB.");
      return;
    }
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_BASE}/companion/public-feedback/${encodeURIComponent(token)}/upload/`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setPhotoUrl(data.url);
      } else {
        setError("Failed to upload image. Please try again.");
      }
    } catch {
      setError("Image upload failed. Check internet connection.");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!description.trim()) {
      setError("Please provide a brief description of the issue.");
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
          name: name.trim() || "Building Occupant",
          contact_channel: contactChannel,
          contact_value: contactValue.trim(),
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
        setActionMessage({ type: "success", text: data.detail || "Ticket status updated." });
        setActionNote("");
        await loadTicketStatus(ticketRef);
      } else {
        setActionMessage({ type: "error", text: data.detail || "Could not update status." });
      }
    } catch {
      setActionMessage({ type: "error", text: "Network error occurred." });
    } finally {
      setActionBusy(false);
    }
  }

  function copyTicketLink() {
    if (typeof window !== "undefined" && ticketRef) {
      const url = `${window.location.origin}/feedback/${token}?ref=${ticketRef}`;
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse at top, var(--color-slate-50) 0%, #edf2f7 50%, var(--color-slate-200) 100%)",
      padding: "24px 16px 60px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      color: "var(--color-slate-900)"
    }}>
      {/* Centered Luxury Container */}
      <div style={{ width: "100%", maxWidth: 680 }}>
        
        {/* Brand Top Header */}
        <header style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            background: "linear-gradient(135deg, var(--color-slate-900) 0%, var(--color-slate-800) 100%)",
            color: "#ffffff",
            padding: "6px 14px",
            borderRadius: 30,
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            boxShadow: "0 4px 12px rgba(15,23,42,0.15)",
            marginBottom: 10
          }}>
            <ShieldCheck size={15} color="#38bdf8" />
            <span>CeEst Smart Concierge</span>
          </div>

          <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--color-slate-900)" }}>
            {state === "tracking" ? "Live Ticket Tracking" : "Report an Issue or Service Request"}
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: "var(--color-slate-500)" }}>
            {state === "tracking"
              ? "Real-time dispatch and resolution progress for your request"
              : "Scan-to-log helpdesk · Direct technician dispatch · No login required"}
          </p>
        </header>

        {/* Location Identity Placard */}
        {context && (
          <div style={{
            background: "#ffffff",
            border: "1px solid var(--color-slate-200)",
            borderRadius: 16,
            padding: "14px 18px",
            marginBottom: 16,
            boxShadow: "0 4px 20px -4px rgba(0,0,0,0.05)",
            display: "flex",
            alignItems: "center",
            gap: 14
          }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "linear-gradient(135deg, var(--color-blue-soft) 0%, var(--color-blue-bg) 100%)",
              color: "var(--color-info)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              border: "1px solid var(--color-blue-200)"
            }}>
              <Building2 size={22} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: "var(--color-slate-900)" }}>{context.property}</span>
                <span style={{ fontSize: 10, fontWeight: 800, background: "var(--color-green-bg)", color: "var(--color-green-text)", padding: "2px 8px", borderRadius: 12 }}>
                  Verified Location
                </span>
              </div>
              <div style={{ fontSize: 13, color: "var(--color-slate-500)", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 3 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 600, color: "var(--color-slate-700)" }}>
                  <MapPin size={13} color="var(--color-danger)" /> {context.label}
                </span>
                {context.building && <span style={{ color: "var(--color-slate-400)" }}>• {context.building}</span>}
                {context.floor && <span style={{ color: "var(--color-slate-400)" }}>• Floor {context.floor}</span>}
                {context.unit && <span style={{ color: "var(--color-slate-400)" }}>• Unit {context.unit}</span>}
              </div>
            </div>
          </div>
        )}

        {/* ERROR STATE */}
        {state === "error" && (
          <div style={{ background: "#ffffff", border: "1px solid var(--color-red-200)", borderRadius: 16, padding: 32, textAlign: "center", boxShadow: "0 8px 30px rgba(0,0,0,0.06)" }}>
            <AlertCircle size={42} color="var(--color-danger)" style={{ margin: "0 auto 12px" }} />
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 6px", color: "var(--color-danger-deep)" }}>Helpdesk Portal Unavailable</h2>
            <p style={{ margin: 0, fontSize: 14, color: "var(--color-slate-500)" }}>{error}</p>
          </div>
        )}

        {/* LOADING STATE */}
        {state === "loading" && (
          <div style={{ background: "#ffffff", border: "1px solid var(--color-slate-200)", borderRadius: 16, padding: 48, textAlign: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.04)" }}>
            <div style={{
              display: "inline-block",
              width: 34,
              height: 34,
              border: "3px solid var(--color-slate-200)",
              borderTopColor: "var(--color-sky)",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
              marginBottom: 14
            }} />
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--color-slate-600)" }}>
              Connecting to Smart Helpdesk…
            </p>
          </div>
        )}

        {/* FORM CREATION STATE */}
        {state === "ready" && (
          <form onSubmit={handleSubmit} style={{
            background: "#ffffff",
            border: "1px solid var(--color-slate-200)",
            borderRadius: 20,
            padding: "24px 22px",
            boxShadow: "0 12px 40px -8px rgba(15,23,42,0.08)",
            display: "flex",
            flexDirection: "column",
            gap: 22
          }}>
            {error && (
              <div style={{ padding: "12px 16px", borderRadius: 10, background: "var(--color-red-bg)", border: "1px solid var(--color-red-300)", color: "var(--color-danger-deep)", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 10 }}>
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {/* Step 1: Category Grid */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <label style={{ fontSize: 14, fontWeight: 800, color: "var(--color-slate-900)", display: "flex", alignItems: "center", gap: 6 }}>
                  <span>1. What needs attention?</span>
                  <span style={{ color: "var(--color-danger)" }}>*</span>
                </label>
                <span style={{ fontSize: 12, color: "var(--color-slate-500)" }}>Select category</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                {categories.map((cat) => {
                  const isSelected = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategory(cat.id)}
                      style={{
                        padding: "14px 8px",
                        borderRadius: 12,
                        border: isSelected ? "2px solid var(--color-sky)" : "1px solid var(--color-slate-200)",
                        background: isSelected ? "#f0f9ff" : "var(--color-slate-50)",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 6,
                        textAlign: "center",
                        position: "relative",
                        transition: "all 0.15s ease",
                        boxShadow: isSelected ? "0 4px 14px rgba(2,132,199,0.15)" : "none",
                        transform: isSelected ? "scale(1.02)" : "scale(1)",
                      }}
                    >
                      <span style={{ fontSize: 24 }}>{cat.icon}</span>
                      <span style={{ fontSize: 12, fontWeight: isSelected ? 800 : 600, color: isSelected ? "var(--color-sky-deep)" : "var(--color-slate-800)", lineHeight: 1.2 }}>
                        {cat.label}
                      </span>
                      {isSelected && (
                        <div style={{
                          position: "absolute",
                          top: 6,
                          right: 6,
                          width: 16,
                          height: 16,
                          borderRadius: "50%",
                          background: "var(--color-sky)",
                          color: "#ffffff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 10,
                          fontWeight: 900
                        }}>
                          ✓
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Description */}
            <div>
              <label style={{ display: "block", fontSize: 14, fontWeight: 800, color: "var(--color-slate-900)", marginBottom: 6 }}>
                2. Describe the Issue / Maintenance Details <span style={{ color: "var(--color-danger)" }}>*</span>
              </label>
              <textarea
                required
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Where exactly is the issue and what is occurring? (e.g. Water leak under sink in 3rd floor washroom, corridor lighting flickering…)"
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "1px solid var(--color-slate-300)",
                  fontSize: 14,
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                  lineHeight: 1.5,
                  resize: "vertical",
                  outline: "none",
                  transition: "border-color 0.15s ease"
                }}
              />
            </div>

            {/* Step 3: Priority & SLA */}
            <div>
              <label style={{ display: "block", fontSize: 14, fontWeight: 800, color: "var(--color-slate-900)", marginBottom: 8 }}>
                3. Urgency &amp; Target SLA Response
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <button
                  type="button"
                  onClick={() => setPriority("normal")}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: priority === "normal" ? "2px solid var(--color-sky)" : "1px solid var(--color-slate-200)",
                    background: priority === "normal" ? "#f0f9ff" : "var(--color-slate-50)",
                    textAlign: "left",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    transition: "all 0.12s ease"
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 800, color: priority === "normal" ? "var(--color-sky-deep)" : "var(--color-slate-800)" }}>
                    🟢 Normal Priority
                  </div>
                  <div style={{ fontSize: 11, color: "var(--color-slate-500)" }}>
                    Standard ~24h resolution SLA
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPriority("urgent")}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: priority === "urgent" ? "2px solid var(--color-danger)" : "1px solid var(--color-slate-200)",
                    background: priority === "urgent" ? "var(--color-red-soft)" : "var(--color-slate-50)",
                    textAlign: "left",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    transition: "all 0.12s ease"
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 800, color: priority === "urgent" ? "var(--color-danger-deep)" : "var(--color-slate-800)" }}>
                    🔴 Urgent / Emergency
                  </div>
                  <div style={{ fontSize: 11, color: "var(--color-slate-500)" }}>
                    Priority express ~4h response SLA
                  </div>
                </button>
              </div>
            </div>

            {/* Step 4: Photo Attachment */}
            <div>
              <label style={{ display: "block", fontSize: 14, fontWeight: 800, color: "var(--color-slate-900)", marginBottom: 6 }}>
                4. Attach Photo or Video Evidence (Optional)
              </label>

              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                capture="environment"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFileUpload(file);
                }}
              />

              {!photoUrl ? (
                <button
                  type="button"
                  disabled={uploadingPhoto}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    width: "100%",
                    padding: "18px",
                    borderRadius: 12,
                    border: "2px dashed var(--color-slate-300)",
                    background: "var(--color-slate-50)",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                    color: "var(--color-slate-600)",
                    transition: "all 0.15s ease"
                  }}
                >
                  <Camera size={26} color="var(--color-sky)" />
                  <div style={{ fontSize: 13, fontWeight: 700 }}>
                    {uploadingPhoto ? "Uploading image to secure cloud…" : "Take a Photo or Choose from Device"}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--color-slate-400)" }}>
                    Supports JPG, PNG, WEBP (Max 25 MB)
                  </div>
                </button>
              ) : (
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid var(--color-blue-200)",
                  background: "var(--color-blue-soft)"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <img src={photoUrl} alt="Preview" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 6, border: "1px solid #93c5fd" }} />
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-info-dark)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      Photo attached successfully
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPhotoUrl("")}
                    style={{ background: "var(--color-red-bg)", border: "1px solid var(--color-red-300)", color: "var(--color-danger-deep)", borderRadius: 6, padding: "4px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            {/* Step 5: Contact Info */}
            <div style={{ background: "var(--color-slate-50)", border: "1px solid var(--color-slate-200)", borderRadius: 14, padding: "16px 18px" }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "var(--color-slate-900)", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <User size={16} color="var(--color-sky)" />
                <span>5. Where should we send updates?</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--color-slate-600)", marginBottom: 4 }}>
                    Your Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Alex Kamau (Tenant / Visitor / Staff)"
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--color-slate-300)", fontSize: 13, boxSizing: "border-box" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--color-slate-600)", marginBottom: 6 }}>
                    Notification Channel
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
                    {[
                      { id: "email", label: "Email", icon: <Mail size={13} /> },
                      { id: "whatsapp_number", label: "WhatsApp", icon: <MessageSquare size={13} /> },
                      { id: "phone", label: "Phone SMS", icon: <Phone size={13} /> },
                    ].map((ch) => (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => setContactChannel(ch.id as any)}
                        style={{
                          padding: "8px 6px",
                          borderRadius: 8,
                          border: contactChannel === ch.id ? "1.5px solid var(--color-slate-900)" : "1px solid var(--color-slate-300)",
                          background: contactChannel === ch.id ? "var(--color-slate-900)" : "#fff",
                          color: contactChannel === ch.id ? "#fff" : "var(--color-slate-700)",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 5
                        }}
                      >
                        {ch.icon}
                        <span>{ch.label}</span>
                      </button>
                    ))}
                  </div>

                  <input
                    type={contactChannel === "email" ? "email" : "text"}
                    value={contactValue}
                    onChange={(e) => setContactValue(e.target.value)}
                    placeholder={
                      contactChannel === "email"
                        ? "Enter your email for instant acknowledgement & updates"
                        : "Enter phone or WhatsApp number (e.g. 0712 345 678)"
                    }
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--color-slate-300)", fontSize: 13, boxSizing: "border-box" }}
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              style={{
                background: "linear-gradient(135deg, var(--color-sky) 0%, var(--color-sky-deep) 100%)",
                color: "#ffffff",
                border: 0,
                borderRadius: 12,
                padding: "16px 24px",
                fontSize: 16,
                fontWeight: 800,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                boxShadow: "0 6px 20px rgba(2,132,199,0.3)",
                transition: "all 0.15s ease"
              }}
            >
              {submitting ? (
                <>
                  <span style={{ display: "inline-block", width: 18, height: 18, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  <span>Submitting &amp; Routing Ticket…</span>
                </>
              ) : (
                <>
                  <Send size={18} />
                  <span>Submit Service Ticket</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* LIVE TICKET TRACKING STATE */}
        {state === "tracking" && ticket && (
          <div style={{
            background: "#ffffff",
            border: "1px solid var(--color-slate-200)",
            borderRadius: 20,
            padding: "24px 22px",
            boxShadow: "0 12px 40px -8px rgba(15,23,42,0.08)",
            display: "flex",
            flexDirection: "column",
            gap: 20
          }}>
            {/* Top Ticket Status Hero */}
            <div style={{
              background: "linear-gradient(135deg, var(--color-green-soft) 0%, var(--color-green-bg) 100%)",
              border: "1px solid var(--color-green-200)",
              borderRadius: 16,
              padding: "20px",
              textAlign: "center"
            }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "var(--color-green-text)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                Ticket Reference
              </div>
              <div style={{ fontSize: 26, fontWeight: 900, color: "#14532d", fontFamily: "monospace", letterSpacing: "0.02em" }}>
                {ticket.reference}
              </div>
              <div style={{ fontSize: 14, color: "var(--color-green-text)", fontWeight: 700, marginTop: 4 }}>
                {ticket.category} • {ticket.title}
              </div>

              <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 14 }}>
                <button
                  type="button"
                  onClick={copyTicketLink}
                  style={{
                    background: "#ffffff",
                    border: "1px solid var(--color-green-300)",
                    color: "var(--color-green-text)",
                    padding: "6px 14px",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6
                  }}
                >
                  {copied ? <Check size={14} color="var(--color-success)" /> : <Copy size={14} />}
                  <span>{copied ? "Link Copied!" : "Copy Tracking Link"}</span>
                </button>
              </div>
            </div>

            {ticket.acknowledgement_email_status === "queued" ? (
              <div style={{ padding: "11px 14px", borderRadius: 10, background: "#ecfdf5", border: "1px solid #a7f3d0", color: "var(--color-green-text)", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                <Mail size={16} /> Acknowledgement email queued for delivery. Check the inbox and spam folder.
              </div>
            ) : ticket.acknowledgement_email_status === "failed" ? (
              <div style={{ padding: "11px 14px", borderRadius: 10, background: "var(--color-orange-bg)", border: "1px solid #fed7aa", color: "#9a3412", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                <AlertCircle size={16} /> The ticket is safely recorded, but its acknowledgement email could not be sent. Keep the reference above and ask the property team to verify outbound email settings.
              </div>
            ) : ticket.acknowledgement_email_status === "not_requested" ? (
              <div style={{ padding: "11px 14px", borderRadius: 10, background: "var(--color-slate-50)", border: "1px solid var(--color-slate-200)", color: "var(--color-slate-600)", fontSize: 13, fontWeight: 700 }}>
                No email acknowledgement was requested for this ticket.
              </div>
            ) : null}

            {/* SLA & Team Assignment Info */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ background: "var(--color-slate-50)", border: "1px solid var(--color-slate-200)", borderRadius: 12, padding: "12px 16px" }}>
                <div style={{ fontSize: 11, color: "var(--color-slate-500)", fontWeight: 700, textTransform: "uppercase" }}>Dispatched Team</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "var(--color-slate-900)", marginTop: 2 }}>{ticket.assigned_team}</div>
                <div style={{ fontSize: 12, color: "var(--color-slate-600)" }}>{ticket.assigned_to || "Field Technician"}</div>
              </div>

              <div style={{ background: "var(--color-slate-50)", border: "1px solid var(--color-slate-200)", borderRadius: 12, padding: "12px 16px" }}>
                <div style={{ fontSize: 11, color: "var(--color-slate-500)", fontWeight: 700, textTransform: "uppercase" }}>Status &amp; Target SLA</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: ticket.status === "resolved" ? "var(--color-success)" : ticket.status === "closed" ? "var(--color-slate-600)" : "var(--color-sky)", marginTop: 2, textTransform: "uppercase" }}>
                  {ticket.status.replace("_", " ")} ({ticket.priority})
                </div>
                <div style={{ fontSize: 12, color: "var(--color-slate-500)" }}>
                  {ticket.sla_due_at ? `Due: ${new Date(ticket.sla_due_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Within 24 Hours"}
                </div>
              </div>
            </div>

            {/* Progress Lifecycle Stepper */}
            <div style={{ padding: "10px 6px" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "var(--color-slate-600)", marginBottom: 14 }}>
                Resolution Lifecycle:
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative" }}>
                {[
                  { key: "open", label: "Logged" },
                  { key: "assigned", label: "Assigned" },
                  { key: "in_progress", label: "In Progress" },
                  { key: "resolved", label: "Resolved" },
                  { key: "closed", label: "Closed" },
                ].map((step, idx) => {
                  const stepIndex = ["open", "assigned", "in_progress", "resolved", "closed"].indexOf(step.key);
                  const currentIdx = ticket.status === "closed" ? 4 : ticket.status === "resolved" ? 3 : ticket.status === "in_progress" ? 2 : 1;
                  const isDone = currentIdx >= stepIndex;
                  return (
                    <div key={step.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, zIndex: 2 }}>
                      <div style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: isDone ? "var(--color-success)" : "var(--color-slate-100)",
                        border: isDone ? "2px solid var(--color-success)" : "2px solid var(--color-slate-300)",
                        color: isDone ? "#ffffff" : "var(--color-slate-400)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: 900
                      }}>
                        {isDone ? "✓" : idx + 1}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: isDone ? 800 : 500, color: isDone ? "var(--color-slate-900)" : "var(--color-slate-400)" }}>
                        {step.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Resolution Notice & Actions */}
            {ticket.status === "resolved" && (
              <div style={{ background: "var(--color-green-soft)", border: "1.5px solid var(--color-green-300)", borderRadius: 14, padding: "16px 18px" }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "var(--color-green-text)", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                  <CheckCircle2 size={18} />
                  <span>Work Completed &amp; Ready for Confirmation</span>
                </div>
                <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--color-green-text)", lineHeight: 1.5 }}>
                  {ticket.resolution_notes || "The maintenance officer has completed work on this issue."}
                </p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => handleTicketAction("confirm")}
                    style={{ background: "var(--color-success)", color: "#fff", border: 0, padding: "10px 16px", borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: "pointer" }}
                  >
                    ✓ Confirm Resolution &amp; Close Ticket
                  </button>
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => handleTicketAction("reopen")}
                    style={{ background: "#fff", color: "var(--color-danger)", border: "1px solid var(--color-danger)", padding: "10px 16px", borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: "pointer" }}
                  >
                    ↻ Reopen (Issue Persists)
                  </button>
                </div>
              </div>
            )}

            {actionMessage && (
              <div style={{ padding: "10px 14px", borderRadius: 8, background: actionMessage.type === "success" ? "var(--color-green-bg)" : "var(--color-red-bg)", color: actionMessage.type === "success" ? "var(--color-green-text)" : "var(--color-danger-deep)", fontSize: 13, fontWeight: 600 }}>
                {actionMessage.text}
              </div>
            )}

            {/* Activity History */}
            {ticket.messages && ticket.messages.length > 0 && (
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "var(--color-slate-900)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                  <MessageSquare size={16} color="var(--color-sky)" />
                  <span>Activity &amp; Dialogue Timeline</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 240, overflowY: "auto" }}>
                  {ticket.messages.map((m, i) => (
                    <div key={i} style={{ background: m.is_developer_response ? "#f0f9ff" : "var(--color-slate-50)", border: "1px solid var(--color-slate-200)", borderRadius: 10, padding: "10px 14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--color-slate-500)", marginBottom: 3 }}>
                        <strong style={{ color: m.is_developer_response ? "var(--color-sky-deep)" : "var(--color-slate-900)" }}>{m.sender}</strong>
                        <span>{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      <div style={{ fontSize: 13, color: "var(--color-slate-800)", lineHeight: 1.4 }}>{m.message}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bottom Actions */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 14, borderTop: "1px solid var(--color-slate-200)" }}>
              <button
                type="button"
                onClick={() => void loadTicketStatus(ticket.reference)}
                style={{ background: "none", border: 0, color: "var(--color-sky)", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}
              >
                <RefreshCw size={14} /> Refresh Live Status
              </button>
              <button
                type="button"
                onClick={() => { setState("ready"); setTicket(null); setTicketRef(""); window.history.replaceState(null, "", window.location.pathname); }}
                style={{ background: "var(--color-slate-100)", border: "1px solid var(--color-slate-300)", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                + Raise Another Request
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer style={{ textAlign: "center", marginTop: 24, fontSize: 12, color: "var(--color-slate-400)" }}>
          Powered by CeEst ERP Smart Property Helpdesk
        </footer>
      </div>
    </div>
  );
}
