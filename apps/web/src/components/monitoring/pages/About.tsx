"use client";

import { useEffect, useState } from "react";
import { Link } from "@/components/monitoring/react-router-shim";
import { isSalesOnlyHost } from "@/lib/site-mode";
import {
  ShieldCheck,
  Scale,
  Globe2,
  Building2,
  CheckCircle2,
  ArrowRight,
  MapPin,
  Award,
  Phone,
  FileCheck,
} from "lucide-react";

interface AboutProps {
  isSales?: boolean;
}

export function About({ isSales }: AboutProps) {
  const [sales, setSales] = useState(() => {
    if (typeof isSales === "boolean") return isSales;
    return typeof window !== "undefined" ? isSalesOnlyHost() : false;
  });

  useEffect(() => {
    if (typeof isSales !== "boolean") {
      setSales(isSalesOnlyHost());
    }
  }, [isSales]);

  if (!sales) {
    // Legacy CeEst / MonitorERP Construction software view for .com
    return (
      <div>
        <section style={{
          padding: "60px 24px 48px", textAlign: "center",
          background: "var(--glow), var(--bg)",
        }}>
          <div style={{ maxWidth: 680, margin: "0 auto" }}>
            <h1 style={{ fontSize: 40, marginBottom: 16 }}>About MonitorERP</h1>
            <p style={{ fontSize: 17, color: "var(--muted)", lineHeight: 1.7 }}>
              We build construction management software that gives project teams a single source of truth — from the site supervisor capturing daily progress on their phone to the CEO reviewing portfolio dashboards in the boardroom.
            </p>
          </div>
        </section>

        <section style={{ padding: "40px 24px", maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, alignItems: "center" }}>
            <div>
              <h2 style={{ fontSize: 26, marginBottom: 12 }}>Our Mission</h2>
              <p style={{ color: "var(--muted)", lineHeight: 1.7, fontSize: 15 }}>
                To eliminate the gap between what happens on site and what management sees in reports. We believe every construction project deserves real-time visibility, tamper-proof evidence, and financial control — without complexity.
              </p>
            </div>
            <div style={{ padding: 32, background: "var(--surface-2)", borderRadius: 16, border: "1px solid var(--border)" }}>
              <h3 style={{ margin: "0 0 8px", textTransform: "none", letterSpacing: 0, fontSize: 16 }}>Built for the field</h3>
              <p style={{ color: "var(--muted)", lineHeight: 1.6, fontSize: 14 }}>
                Our platform was designed from the ground up with input from project managers, quantity surveyors, and site supervisors. Every feature solves a real problem encountered in daily construction operations.
              </p>
            </div>
          </div>
        </section>

        <section style={{ padding: "60px 24px", background: "var(--surface)", textAlign: "center" }}>
          <div style={{ maxWidth: 800, margin: "0 auto" }}>
            <h2 style={{ fontSize: 26, marginBottom: 32 }}>Why Construction Teams Choose Us</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20, textAlign: "left" }}>
              {[
                { title: "Tamper-Proof Evidence", desc: "Every photo, log, and milestone is geofenced and audit-sealed. What gets submitted cannot be altered." },
                { title: "Offline-First Design", desc: "Site teams work without internet. Data syncs automatically when they reconnect." },
                { title: "Real-Time Visibility", desc: "Management sees progress, costs, and issues as they happen — not weeks later." },
                { title: "Modular by Nature", desc: "Start with what you need. Add modules as your projects grow in complexity." },
              ].map(item => (
                <div key={item.title} className="card" style={{ padding: 22 }}>
                  <h3 style={{ margin: "0 0 8px", textTransform: "none", letterSpacing: 0, fontSize: 16 }}>{item.title}</h3>
                  <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, margin: 0 }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section style={{ padding: "60px 24px", textAlign: "center" }}>
          <h2 style={{ fontSize: 26, marginBottom: 12 }}>Want to learn more?</h2>
          <p style={{ color: "var(--muted)", marginBottom: 24 }}>Get in touch with our team.</p>
          <Link to="/contact" className="btn">Contact Us</Link>
        </section>
      </div>
    );
  }

  // Real estate & advisory storefront view for .co.ke
  return (
    <div>
      {/* Hero */}
      <section style={{
        padding: "72px 24px 56px",
        textAlign: "center",
        background: "radial-gradient(ellipse at top, rgba(37, 99, 235, 0.08) 0%, var(--bg) 70%)",
        borderBottom: "1px solid var(--border)",
      }}>
        <div style={{ maxWidth: 820, margin: "0 auto" }}>
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 14px",
            borderRadius: 999,
            background: "#eff6ff",
            color: "#1d4ed8",
            fontSize: 13,
            fontWeight: 700,
            marginBottom: 18,
            border: "1px solid #bfdbfe",
          }}>
            <Building2 size={15} /> Center Estates Kenya
          </span>
          <h1 style={{
            fontSize: "clamp(32px, 5vw, 48px)",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            marginBottom: 20,
            lineHeight: 1.15,
            color: "var(--text)",
          }}>
            Connecting Discerning Buyers to Verified Kenyan Real Estate
          </h1>
          <p style={{ fontSize: 18, color: "var(--muted)", lineHeight: 1.75, maxWidth: 680, margin: "0 auto" }}>
            Center Estates is an integrated property sales, residential advisory, and commercial development brokerage. We protect your investment with 100% verified title deeds, certified milestone escrow, and full Sectional Properties Act compliance.
          </p>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 32, flexWrap: "wrap" }}>
            <Link to="/properties" className="btn" style={{ padding: "12px 24px", fontSize: 15, fontWeight: 700 }}>
              Browse Available Properties
            </Link>
            <Link to="/contact" className="btn-nav-outline" style={{ padding: "12px 24px", fontSize: 15, fontWeight: 700 }}>
              Speak with a Sales Advisor
            </Link>
          </div>
        </div>
      </section>

      {/* Metrics Row */}
      <section style={{
        padding: "40px 24px",
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
      }}>
        <div style={{
          maxWidth: 1100,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 28,
          textAlign: "center",
        }}>
          <div>
            <div style={{ fontSize: 36, fontWeight: 800, color: "#2563eb", marginBottom: 4 }}>12+</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>Active Developments</div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>Nairobi, Kiambu & Mombasa</div>
          </div>
          <div>
            <div style={{ fontSize: 36, fontWeight: 800, color: "#16a34a", marginBottom: 4 }}>KES 3.5B+</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>Verified Portfolio</div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>Prime residential & commercial</div>
          </div>
          <div>
            <div style={{ fontSize: 36, fontWeight: 800, color: "#d97706", marginBottom: 4 }}>100%</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>Title Guarantee</div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>Ministry of Lands search certified</div>
          </div>
          <div>
            <div style={{ fontSize: 36, fontWeight: 800, color: "#7c3aed", marginBottom: 4 }}>6</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>Asset Classes</div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>Apartments, Villas, Offices & Land</div>
          </div>
        </div>
      </section>

      {/* Pillars / Guarantees */}
      <section style={{ padding: "64px 24px", maxWidth: 1140, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 12 }}>The Center Estates Standard</h2>
          <p style={{ color: "var(--muted)", fontSize: 16, maxWidth: 600, margin: "0 auto" }}>
            We eliminate the ambiguity and risk commonly associated with acquiring property in Kenya through systematic legal and engineering audits.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 24 }}>
          <div className="card" style={{ padding: 28 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10,
              background: "#eff6ff", color: "#2563eb",
              display: "grid", placeItems: "center", marginBottom: 18,
            }}>
              <ShieldCheck size={24} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 10px" }}>Exhaustive Title Verification</h3>
            <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.65, margin: 0 }}>
              Every property listed undergoes official registry searches at the Ministry of Lands, ground beacon confirmation with registered land surveyors, and ownership dispute audits before listing.
            </p>
          </div>

          <div className="card" style={{ padding: 28 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10,
              background: "#f0fdf4", color: "#16a34a",
              display: "grid", placeItems: "center", marginBottom: 18,
            }}>
              <Scale size={24} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 10px" }}>Sectional Properties Act 2020</h3>
            <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.65, margin: 0 }}>
              We ensure all apartment developments and commercial suites comply with the Sectional Properties Act 2020, guaranteeing distinct individual sectional title deeds registered in your name.
            </p>
          </div>

          <div className="card" style={{ padding: 28 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10,
              background: "#fffbeb", color: "#d97706",
              display: "grid", placeItems: "center", marginBottom: 18,
            }}>
              <FileCheck size={24} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 10px" }}>Milestone Escrow Protection</h3>
            <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.65, margin: 0 }}>
              Buyer stage payments on off-plan projects are tied directly to verified construction milestones certified by licensed quantity surveyors and independent structural engineers.
            </p>
          </div>

          <div className="card" style={{ padding: 28 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10,
              background: "#faf5ff", color: "#7c3aed",
              display: "grid", placeItems: "center", marginBottom: 18,
            }}>
              <Globe2 size={24} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 10px" }}>Dedicated Diaspora Desk</h3>
            <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.65, margin: 0 }}>
              Specialized cross-border purchasing support for Kenyans abroad in the US, UK, EU, UAE, and Canada. Includes digital KYC, virtual tours, secure advocate escrow, and bank mortgage coordination.
            </p>
          </div>
        </div>
      </section>

      {/* Flagship Locations */}
      <section style={{ padding: "64px 24px", background: "var(--surface)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 44 }}>
            <h2 style={{ fontSize: 30, fontWeight: 800, marginBottom: 10 }}>Prime Strategic Locations</h2>
            <p style={{ color: "var(--muted)", fontSize: 15 }}>Master-planned residential and commercial nodes across Kenya's highest-growth corridors.</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
            {[
              {
                title: "Kilimani Heights Residences",
                type: "2 & 3-Bed Luxury Apartments",
                location: "Argwings Kodhek Rd, Kilimani, Nairobi",
                desc: "Panoramic city skyline views, infinity pool, modern gym, solar water heating, and high-speed lifts.",
              },
              {
                title: "Karen Green Valley Villas",
                type: "5-Bed Signature Villas",
                location: "Mbagathi Way / Karen Triangle, Nairobi",
                desc: "Half-acre gated estate with private heated swimming pools, solar backup, mature gardens, and club house.",
              },
              {
                title: "Parklands Horizon Suites",
                type: "Executive Studios & 1-Bed Units",
                location: "3rd Parklands Avenue, Nairobi",
                desc: "Turnkey furnished investments delivering high occupancy yields near major hospitals and business districts.",
              },
              {
                title: "Westlands Business Centre",
                type: "Grade-A Commercial Suites",
                location: "Ring Road Westlands, Nairobi",
                desc: "LEED-certified green corporate office floorplates with fiber backbone, 3-phase generator, and 24/7 access.",
              },
              {
                title: "Kiambu Ridge Serviced Plots",
                type: "1/4 & 1/2 Acre Serviced Plots",
                location: "Kiambu Road / Northern Bypass Corridor",
                desc: "Ready-to-build gated community with perimeter stone wall, cabro-paved access roads, power, and piped water.",
              },
              {
                title: "Nyali Trade Centre",
                type: "Commercial Retail & Showrooms",
                location: "Links Road, Nyali, Mombasa",
                desc: "Prime coastal retail visibility, dedicated customer parking, and high-footfall shopping frontage.",
              },
            ].map(loc => (
              <div key={loc.title} className="card" style={{ padding: 24, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#2563eb", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
                    <MapPin size={14} /> {loc.location}
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 6px" }}>{loc.title}</h3>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)", marginBottom: 12 }}>{loc.type}</div>
                  <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, margin: 0 }}>{loc.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Advisory & Physical Offices */}
      <section style={{ padding: "64px 24px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 32,
          alignItems: "center",
        }}>
          <div>
            <h2 style={{ fontSize: 30, fontWeight: 800, marginBottom: 16 }}>Visit Our Advisory Centres</h2>
            <p style={{ color: "var(--muted)", lineHeight: 1.7, fontSize: 15, marginBottom: 20 }}>
              Our property specialists, legal advisors, and conveyancing teams are available for in-person consultations, architectural model viewings, and scheduled project site tours.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: "#eff6ff", color: "#2563eb", display: "grid", placeItems: "center", flex: "none" }}>
                  <MapPin size={18} />
                </div>
                <div>
                  <strong style={{ fontSize: 15, display: "block" }}>Headquarters & Sales Desk</strong>
                  <span style={{ fontSize: 14, color: "var(--muted)" }}>Westlands Business Centre, 4th Floor, Ring Road Westlands, Nairobi</span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: "#f0fdf4", color: "#16a34a", display: "grid", placeItems: "center", flex: "none" }}>
                  <MapPin size={18} />
                </div>
                <div>
                  <strong style={{ fontSize: 15, display: "block" }}>Kilimani Advisory Hub</strong>
                  <span style={{ fontSize: 14, color: "var(--muted)" }}>Kilimani Heights, Ground Floor, Argwings Kodhek Rd, Nairobi</span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: "#fffbeb", color: "#d97706", display: "grid", placeItems: "center", flex: "none" }}>
                  <Phone size={18} />
                </div>
                <div>
                  <strong style={{ fontSize: 15, display: "block" }}>Direct Sales & WhatsApp Hotline</strong>
                  <span style={{ fontSize: 14, color: "var(--muted)" }}>+254 712 345 678 | sales@centerestates.co.ke</span>
                </div>
              </div>
            </div>
          </div>

          <div style={{
            background: "linear-gradient(145deg, #1e293b, #0f172a)",
            padding: 36,
            borderRadius: 20,
            color: "#fff",
            boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
          }}>
            <h3 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12, color: "#fff" }}>Financing & Mortgage Partnerships</h3>
            <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.65, marginBottom: 24 }}>
              Center Estates works closely with Kenya's leading commercial banks and mortgage institutions to provide pre-approved developer terms, diaspora mortgage packages, and expedited valuation checks.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
              {["Stanbic Bank Kenya", "KCB Bank", "Absa Bank Kenya", "NCBA Group"].map(bank => (
                <div key={bank} style={{
                  padding: "10px 14px",
                  background: "rgba(255,255,255,0.07)",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#e2e8f0",
                  textAlign: "center",
                }}>
                  {bank}
                </div>
              ))}
            </div>
            <Link to="/contact" className="btn" style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              justifyContent: "center",
              background: "#2563eb",
              color: "#fff",
              padding: "12px 18px",
            }}>
              Enquire About Financing Options <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{
        padding: "60px 24px",
        textAlign: "center",
        background: "var(--surface-2)",
        borderTop: "1px solid var(--border)",
      }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>Ready to Find Your Ideal Property?</h2>
          <p style={{ color: "var(--muted)", marginBottom: 28, fontSize: 16 }}>
            Browse our curated portfolio of residential homes, luxury villas, commercial offices, and prime serviced plots.
          </p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <Link to="/properties" className="btn" style={{ padding: "12px 28px", fontSize: 15, fontWeight: 700 }}>
              Explore Properties
            </Link>
            <Link to="/projects" className="btn-nav-outline" style={{ padding: "12px 28px", fontSize: 15, fontWeight: 700 }}>
              View Master Developments
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
