"use client";

import { useEffect, useState } from "react";
import { Link } from "@/components/monitoring/react-router-shim";
import { isSalesOnlyHost, resolveApiBaseUrl } from "@/lib/site-mode";
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  Clock,
  CheckCircle2,
  Send,
  Globe2,
  MessageCircle,
  AlertCircle,
} from "lucide-react";

interface ContactProps {
  isSales?: boolean;
}

export function Contact({ isSales }: ContactProps) {
  const [sales, setSales] = useState(() => {
    if (typeof isSales === "boolean") return isSales;
    return typeof window !== "undefined" ? isSalesOnlyHost() : false;
  });

  const [formState, setFormState] = useState({
    name: "",
    email: "",
    phone: "",
    category: "Apartments",
    location: "Kilimani",
    message: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successRef, setSuccessRef] = useState<string | null>(null);

  useEffect(() => {
    if (typeof isSales !== "boolean") {
      setSales(isSalesOnlyHost());
    }
  }, [isSales]);

  async function handleSalesSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const apiBase = resolveApiBaseUrl();
      const combinedMessage = `[Interest: ${formState.category} in ${formState.location}]\n${formState.message}`.trim();

      const res = await fetch(`${apiBase}/sales/public/enquiries/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formState.name.trim(),
          email: formState.email.trim(),
          phone: formState.phone.trim(),
          message: combinedMessage,
          source: "website_contact_form",
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errorMsg =
          (data.errors && Object.values(data.errors).flat().join(" ")) ||
          data.detail ||
          "Failed to submit enquiry. Please check your details and try again.";
        throw new Error(errorMsg);
      }

      setSuccessRef(data.reference || "SUBMITTED");
      setFormState({
        name: "",
        email: "",
        phone: "",
        category: "Apartments",
        location: "Kilimani",
        message: "",
      });
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // MonitorERP View for .com
  if (!sales) {
    return (
      <div>
        <section style={{
          padding: "60px 24px 40px", textAlign: "center",
          background: "var(--glow), var(--bg)",
        }}>
          <h1 style={{ fontSize: 40, marginBottom: 8 }}>Contact Us</h1>
          <p style={{ color: "var(--muted)", fontSize: 17 }}>Have questions? We'd love to hear from you.</p>
        </section>

        <section style={{ padding: "20px 24px 60px", maxWidth: 800, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
            <div>
              <h3 style={{ margin: "0 0 16px", textTransform: "none", letterSpacing: 0, fontSize: 18 }}>Get in Touch</h3>
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 4 }}>Email</p>
                <p style={{ fontSize: 15, fontWeight: 600 }}>hello@monitorerp.com</p>
              </div>
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 4 }}>Phone</p>
                <p style={{ fontSize: 15, fontWeight: 600 }}>+254 700 000 000</p>
              </div>
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 4 }}>Location</p>
                <p style={{ fontSize: 15, fontWeight: 600 }}>Nairobi, Kenya</p>
              </div>
              <div>
                <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 4 }}>Sales</p>
                <Link to="/sign-up" className="btn sm">Start Free Trial</Link>
              </div>
            </div>

            <div>
              <h3 style={{ margin: "0 0 16px", textTransform: "none", letterSpacing: 0, fontSize: 18 }}>Send a Message</h3>
              {successRef ? (
                <div style={{ padding: 20, background: "var(--surface-2)", borderRadius: 12, textAlign: "center" }}>
                  <p style={{ color: "var(--green)", fontWeight: 600 }}>Thank you! We'll get back to you shortly.</p>
                </div>
              ) : (
                <form onSubmit={(e) => { e.preventDefault(); setSuccessRef("SENT"); }}>
                  <div className="field">
                    <label>Name</label>
                    <input placeholder="Your name" required />
                  </div>
                  <div className="field">
                    <label>Email</label>
                    <input type="email" placeholder="you@example.com" required />
                  </div>
                  <div className="field">
                    <label>Message</label>
                    <textarea rows={4} placeholder="How can we help?" required />
                  </div>
                  <button className="btn" type="submit">Send Message</button>
                </form>
              )}
            </div>
          </div>
        </section>
      </div>
    );
  }

  // Center Estates Real Estate & Advisory Contact View for .co.ke
  return (
    <div>
      {/* Header */}
      <section style={{
        padding: "68px 24px 44px",
        textAlign: "center",
        background: "radial-gradient(ellipse at top, rgba(37, 99, 235, 0.08) 0%, var(--bg) 70%)",
        borderBottom: "1px solid var(--border)",
      }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 14px",
            borderRadius: 999,
            background: "#eff6ff",
            color: "#1d4ed8",
            fontSize: 13,
            fontWeight: 700,
            marginBottom: 16,
            border: "1px solid #bfdbfe",
          }}>
            <Building2 size={15} /> Property Advisory & Sales Desk
          </span>
          <h1 style={{
            fontSize: "clamp(30px, 4vw, 44px)",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            marginBottom: 14,
            color: "var(--text)",
          }}>
            Speak With Our Property Specialists
          </h1>
          <p style={{ fontSize: 17, color: "var(--muted)", lineHeight: 1.7, maxWidth: 640, margin: "0 auto" }}>
            Whether you are acquiring a family home, seeking high-yield serviced apartments, or purchasing prime commercial real estate, our advisory team is ready to guide you.
          </p>
        </div>
      </section>

      {/* Main Grid */}
      <section style={{ padding: "48px 24px 72px", maxWidth: 1140, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 36 }}>
          {/* Contact Details Column */}
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 20 }}>Advisory & Sales Offices</h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 32 }}>
              <div className="card" style={{ padding: 20 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: "#eff6ff", color: "#2563eb", display: "grid", placeItems: "center", flex: "none" }}>
                    <MapPin size={20} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 4px" }}>Westlands Headquarters</h4>
                    <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 6px", lineHeight: 1.5 }}>
                      Westlands Business Centre, 4th Floor, Ring Road Westlands, Nairobi
                    </p>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#2563eb" }}>Corporate Sales & Legal Conveyancing</span>
                  </div>
                </div>
              </div>

              <div className="card" style={{ padding: 20 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: "#f0fdf4", color: "#16a34a", display: "grid", placeItems: "center", flex: "none" }}>
                    <MapPin size={20} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 4px" }}>Kilimani Advisory Hub</h4>
                    <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 6px", lineHeight: 1.5 }}>
                      Kilimani Heights, Ground Floor, Argwings Kodhek Rd, Nairobi
                    </p>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#16a34a" }}>Showroom & Architectural Scale Models</span>
                  </div>
                </div>
              </div>

              <div className="card" style={{ padding: 20 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: "#fffbeb", color: "#d97706", display: "grid", placeItems: "center", flex: "none" }}>
                    <MapPin size={20} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 4px" }}>Mombasa Coastal Desk</h4>
                    <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 6px", lineHeight: 1.5 }}>
                      Nyali Trade Centre, Links Road, Nyali, Mombasa
                    </p>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#d97706" }}>Coastal Residential & Retail Enquiries</span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 28 }}>
              <div style={{ padding: 18, background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text)", fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                  <Phone size={16} color="#2563eb" /> Hotline
                </div>
                <div style={{ fontSize: 14, color: "var(--muted)" }}>+254 712 345 678</div>
                <div style={{ fontSize: 12, color: "#16a34a", marginTop: 4, fontWeight: 600 }}>WhatsApp Available</div>
              </div>

              <div style={{ padding: 18, background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text)", fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                  <Mail size={16} color="#2563eb" /> Sales Email
                </div>
                <div style={{ fontSize: 13, color: "var(--muted)", wordBreak: "break-all" }}>sales@centerestates.co.ke</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>diaspora@centerestates.co.ke</div>
              </div>
            </div>

            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 18px",
              borderRadius: 12,
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
            }}>
              <Clock size={18} color="#64748b" />
              <div style={{ fontSize: 13, color: "#475569" }}>
                <strong>Operating Hours:</strong> Mon – Sat: 8:00 AM – 6:00 PM EAT. Sunday viewings by prior appointment.
              </div>
            </div>
          </div>

          {/* Form Column */}
          <div style={{
            background: "var(--surface)",
            padding: 32,
            borderRadius: 20,
            border: "1px solid var(--border)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.03)",
          }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Register Your Enquiry</h2>
            <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 24, lineHeight: 1.6 }}>
              Fill out the form below. An assigned property consultant will review your specifications and get in touch.
            </p>

            {successRef ? (
              <div style={{
                padding: 32,
                borderRadius: 16,
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                textAlign: "center",
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: "50%",
                  background: "#22c55e", color: "#fff",
                  display: "grid", placeItems: "center", margin: "0 auto 16px",
                }}>
                  <CheckCircle2 size={30} />
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 800, color: "#166534", marginBottom: 8 }}>
                  Enquiry Successfully Logged!
                </h3>
                <p style={{ fontSize: 14, color: "#15803d", marginBottom: 16, lineHeight: 1.6 }}>
                  Thank you for reaching out to Center Estates. Your reference code is:
                </p>
                <div style={{
                  display: "inline-block",
                  padding: "8px 20px",
                  borderRadius: 8,
                  background: "#dcfce7",
                  border: "1px dashed #16a34a",
                  fontWeight: 800,
                  fontSize: 16,
                  color: "#166534",
                  letterSpacing: 1,
                  marginBottom: 20,
                }}>
                  {successRef}
                </div>
                <p style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.5, margin: 0 }}>
                  A sales advisor from our advisory desk will contact you shortly via phone or email.
                </p>
                <button
                  onClick={() => setSuccessRef(null)}
                  className="btn sm"
                  style={{ marginTop: 20, background: "#166534", color: "#fff" }}
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSalesSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {error && (
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: 14,
                    borderRadius: 10,
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    color: "#b91c1c",
                    fontSize: 14,
                  }}>
                    <AlertCircle size={18} style={{ flex: "none" }} />
                    <span>{error}</span>
                  </div>
                )}

                <div className="field">
                  <label style={{ fontSize: 13, fontWeight: 700 }}>Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. David Mwangi"
                    value={formState.name}
                    onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div className="field">
                    <label style={{ fontSize: 13, fontWeight: 700 }}>Phone / WhatsApp *</label>
                    <input
                      type="tel"
                      required
                      placeholder="+254 7..."
                      value={formState.phone}
                      onChange={(e) => setFormState({ ...formState, phone: e.target.value })}
                    />
                  </div>

                  <div className="field">
                    <label style={{ fontSize: 13, fontWeight: 700 }}>Email Address *</label>
                    <input
                      type="email"
                      required
                      placeholder="david@example.com"
                      value={formState.email}
                      onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div className="field">
                    <label style={{ fontSize: 13, fontWeight: 700 }}>Property Category</label>
                    <select
                      value={formState.category}
                      onChange={(e) => setFormState({ ...formState, category: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                        background: "var(--surface-2)",
                        color: "var(--text)",
                        fontSize: 14,
                      }}
                    >
                      <option value="Apartments">Apartments (2 & 3 Bed)</option>
                      <option value="Luxury Villas">Luxury Villas (Karen)</option>
                      <option value="Executive Studios">Executive Studios (Parklands)</option>
                      <option value="Commercial Office">Grade-A Commercial (Westlands)</option>
                      <option value="Serviced Land">Serviced Land Plots (Kiambu)</option>
                      <option value="Coastal Retail">Coastal Retail (Nyali)</option>
                      <option value="General Advisory">General Investment Advisory</option>
                    </select>
                  </div>

                  <div className="field">
                    <label style={{ fontSize: 13, fontWeight: 700 }}>Preferred Location</label>
                    <select
                      value={formState.location}
                      onChange={(e) => setFormState({ ...formState, location: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                        background: "var(--surface-2)",
                        color: "var(--text)",
                        fontSize: 14,
                      }}
                    >
                      <option value="Kilimani">Kilimani, Nairobi</option>
                      <option value="Karen">Karen, Nairobi</option>
                      <option value="Westlands">Westlands, Nairobi</option>
                      <option value="Parklands">Parklands, Nairobi</option>
                      <option value="Kiambu Road">Kiambu Road Corridor</option>
                      <option value="Nyali, Mombasa">Nyali, Mombasa</option>
                      <option value="Flexible / Other">Flexible / Other</option>
                    </select>
                  </div>
                </div>

                <div className="field">
                  <label style={{ fontSize: 13, fontWeight: 700 }}>Message & Specific Requirements *</label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Tell us about your budget, timeline, floor preferences, or questions regarding financing and title deeds..."
                    value={formState.message}
                    onChange={(e) => setFormState({ ...formState, message: e.target.value })}
                  />
                </div>

                <button
                  className="btn"
                  type="submit"
                  disabled={loading}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: "12px 20px",
                    fontWeight: 700,
                    fontSize: 15,
                    marginTop: 6,
                  }}
                >
                  {loading ? (
                    <span>Submitting Enquiry...</span>
                  ) : (
                    <>
                      <span>Submit Property Enquiry</span>
                      <Send size={16} />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
