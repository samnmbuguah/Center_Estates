"use client";

import {
  Download,
  FileText,
  Presentation,
  Smartphone,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  HardHat,
  Database,
  Building,
  Layers,
  Copy,
  Check
} from "lucide-react";
import { useState } from "react";

export function Resources() {
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(id);
    setTimeout(() => setCopiedLink(null), 2500);
  };

  const PRESENTATION_ITEMS = [
    {
      id: "interactive-live-deck",
      title: "Interactive Web Presentation Deck (Browser Slides)",
      badge: "Launch Live in Browser",
      badgeColor: "#dc2626",
      badgeBg: "#fee2e2",
      format: "HTML5 Deck",
      size: "Instant Load",
      slides: "11 Fullscreen Slides (← / → / F)",
      description:
        "Present directly from your browser with keyboard navigation, fullscreen toggle, interactive Mobile App UI mockups, and Earned Value S-Curve tables.",
      downloadUrl: "/presentations/live-deck.html",
      previewUrl: "/presentations/live-deck.html",
      isPrimary: true,
      icon: Presentation,
    },
    {
      id: "construction-pptx",
      title: "Construction Oversight & Mobile Field App (PowerPoint)",
      badge: "Today's Feature Deck",
      badgeColor: "#dc2626",
      badgeBg: "#fee2e2",
      format: "PPTX",
      size: "1.3 MB",
      slides: "11 Widescreen Slides (16:9)",
      description:
        "Executive PowerPoint deck featuring 300-DPI Mobile App UI mockups (BoQ gate intake & stage-gate lockouts), Earned Value S-Curve charts, and Mini-BoQ IPC tables.",
      downloadUrl: "/presentations/Center_Estates_Construction_and_Mobile_Presentation.pptx",
      isPrimary: true,
      icon: Presentation,
    },
    {
      id: "construction-pdf",
      title: "Construction Oversight & Mobile Field App (PDF Deck)",
      badge: "Presenter Ready",
      badgeColor: "#0284c7",
      badgeBg: "#e0f2fe",
      format: "PDF",
      size: "1.1 MB",
      slides: "11 High-Res Vector Slides",
      description:
        "Complete high-resolution slide deck with embedded UI mockups ready to present on laptops, iPads, tablets, or send directly to clients and financiers.",
      downloadUrl: "/presentations/Center_Estates_Construction_and_Mobile_Presentation.pdf",
      previewUrl: "/presentations/Center_Estates_Construction_and_Mobile_Presentation.pdf",
      isPrimary: false,
      icon: FileText,
    },
    {
      id: "cheat-sheet",
      title: "5-Step Live Demonstration Script & Presenter Guide",
      badge: "Demo Run of Show",
      badgeColor: "#16a34a",
      badgeBg: "#dcfce7",
      format: "Markdown / Doc",
      size: "14 KB",
      slides: "Step-by-step narrative & Q&A defense",
      description:
        "Word-for-word presentation script, timings, screen switching steps (Web ERP ↔ Mobile App), project codes, and answers to tough stakeholder questions.",
      downloadUrl: "/presentations/presentation_cheat_sheet.md",
      previewUrl: "/presentations/presentation_cheat_sheet.md",
      isPrimary: false,
      icon: Layers,
    },
    {
      id: "enterprise-erp-pptx",
      title: "Center Estates Comprehensive ERP Deck (Property & Facility)",
      badge: "Full Suite",
      badgeColor: "#4f46e5",
      badgeBg: "#e0e7ff",
      format: "PPTX & PDF",
      size: "2.8 MB Bundle",
      slides: "16 Extended Slides",
      description:
        "Extended presentation covering property management, tenancy onboarding, billing engines, PPM calendars, and RICS asset valuation lifecycles.",
      downloadUrl: "/presentations/CeEst_ERP_Live_Demo_Presentation.pptx",
      previewUrl: "/presentations/CeEst_ERP_Live_Demo_Presentation.pdf",
      isPrimary: false,
      icon: Building,
    },
  ];

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 20px" }}>
      {/* Hero Header */}
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 14px",
            borderRadius: 20,
            background: "#fee2e2",
            color: "#b91c1c",
            fontSize: 12,
            fontWeight: 700,
            marginBottom: 16,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          <HardHat size={16} /> Stakeholder Resource Center
        </div>
        <h1
          style={{
            fontSize: "clamp(28px, 4vw, 42px)",
            fontWeight: 800,
            color: "var(--text, #0f172a)",
            lineHeight: 1.2,
            marginBottom: 16,
          }}
        >
          Presentations, Live Demos & Field Guides
        </h1>
        <p
          style={{
            fontSize: 17,
            color: "var(--muted, #64748b)",
            maxWidth: 720,
            margin: "0 auto",
            lineHeight: 1.6,
          }}
        >
          Official slide decks, live mobile tunnels, and demonstration assets for
          the <strong>Center Estates Construction Oversight & Mobile Telemetry</strong> platform.
        </p>
      </div>

      {/* Presentation Downloads Grid */}
      <div style={{ marginBottom: 56 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--text, #0f172a)", margin: 0 }}>
            Presentation Decks & Scripts
          </h2>
          <span style={{ fontSize: 13, color: "var(--muted, #64748b)" }}>
            Direct Downloads • No sign-up required
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 20,
          }}
        >
          {PRESENTATION_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                style={{
                  background: "var(--surface, #ffffff)",
                  borderRadius: 12,
                  border: item.isPrimary ? "2px solid #dc2626" : "1px solid var(--border, #e2e8f0)",
                  padding: 24,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  boxShadow: item.isPrimary
                    ? "0 10px 25px -5px rgba(220, 38, 38, 0.1), 0 8px 10px -6px rgba(220, 38, 38, 0.1)"
                    : "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
                  position: "relative",
                  transition: "transform 0.2s ease, box-shadow 0.2s ease",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 10,
                        background: item.badgeBg,
                        color: item.badgeColor,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon size={24} />
                    </div>
                    <span
                      style={{
                        padding: "4px 10px",
                        borderRadius: 12,
                        background: item.badgeBg,
                        color: item.badgeColor,
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      {item.badge}
                    </span>
                  </div>

                  <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text, #0f172a)", marginBottom: 8, lineHeight: 1.3 }}>
                    {item.title}
                  </h3>

                  <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--muted, #64748b)", marginBottom: 14, fontWeight: 500 }}>
                    <span>Format: <strong>{item.format}</strong></span>
                    <span>•</span>
                    <span>Size: <strong>{item.size}</strong></span>
                    <span>•</span>
                    <span>{item.slides}</span>
                  </div>

                  <p style={{ fontSize: 13.5, color: "var(--muted, #475569)", lineHeight: 1.5, marginBottom: 20 }}>
                    {item.description}
                  </p>
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: "auto" }}>
                  <a
                    href={item.downloadUrl}
                    download
                    style={{
                      flex: 1,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      padding: "10px 16px",
                      borderRadius: 8,
                      background: item.isPrimary ? "#dc2626" : "var(--primary, #0f172a)",
                      color: "#ffffff",
                      fontSize: 13,
                      fontWeight: 600,
                      textDecoration: "none",
                      transition: "opacity 0.2s",
                    }}
                  >
                    <Download size={15} /> Download {item.format}
                  </a>

                  {item.previewUrl && (
                    <a
                      href={item.previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        padding: "10px 14px",
                        borderRadius: 8,
                        background: "var(--surface-sunken, #f1f5f9)",
                        color: "var(--text, #1e293b)",
                        border: "1px solid var(--border, #cbd5e1)",
                        fontSize: 13,
                        fontWeight: 600,
                        textDecoration: "none",
                      }}
                      title="Preview in browser"
                    >
                      <ExternalLink size={15} /> Preview
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live Demo Access & QR Section */}
      <div
        style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          borderRadius: 16,
          padding: "36px 32px",
          color: "#ffffff",
          marginBottom: 56,
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 32, alignItems: "center" }}>
          <div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 12px",
                borderRadius: 20,
                background: "rgba(34, 197, 94, 0.2)",
                color: "#4ade80",
                fontSize: 12,
                fontWeight: 700,
                marginBottom: 14,
              }}
            >
              <Smartphone size={14} /> LIVE MOBILE DEMO TUNNEL
            </div>
            <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 12, color: "#ffffff" }}>
              Test the Field App on Any Phone in Seconds
            </h2>
            <p style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.6, marginBottom: 24 }}>
              The Clerk of Works field app is actively bundled and accessible over the cloud tunnel.
              You do not need a custom APK or App Store account to evaluate the live field experience.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <CheckCircle2 size={18} color="#22c55e" />
                <span style={{ fontSize: 13.5, color: "#cbd5e1" }}>
                  <strong>Step 1:</strong> Install free <strong>Expo Go</strong> from Google Play or Apple App Store.
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <CheckCircle2 size={18} color="#22c55e" />
                <span style={{ fontSize: 13.5, color: "#cbd5e1" }}>
                  <strong>Step 2:</strong> Open camera or scan the tunnel URL below.
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <CheckCircle2 size={18} color="#22c55e" />
                <span style={{ fontSize: 13.5, color: "#cbd5e1" }}>
                  <strong>Step 3:</strong> Test live material deliveries, BoQ shields & stage-gate locks.
                </span>
              </div>
            </div>
          </div>

          <div
            style={{
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: 12,
              padding: 24,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 8, textTransform: "uppercase" }}>
              Active Expo Go Metro URL
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "rgba(0, 0, 0, 0.3)",
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid rgba(255, 255, 255, 0.1)",
                marginBottom: 16,
              }}
            >
              <code style={{ fontSize: 13, color: "#38bdf8", wordBreak: "break-all" }}>
                exp://vpofj68-anonymous-8081.exp.direct
              </code>
              <button
                onClick={() => copyToClipboard("exp://vpofj68-anonymous-8081.exp.direct", "expo")}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#94a3b8",
                  cursor: "pointer",
                  padding: 4,
                  display: "flex",
                  alignItems: "center",
                }}
                title="Copy URL"
              >
                {copiedLink === "expo" ? <Check size={16} color="#4ade80" /> : <Copy size={16} />}
              </button>
            </div>

            <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 8, textTransform: "uppercase" }}>
              Cloudflare Web Tunnel (Direct HTTP)
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "rgba(0, 0, 0, 0.3)",
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid rgba(255, 255, 255, 0.1)",
              }}
            >
              <code style={{ fontSize: 12, color: "#a5b4fc", wordBreak: "break-all" }}>
                https://further-camcorders-recruitment-subscriber.trycloudflare.com
              </code>
              <button
                onClick={() =>
                  copyToClipboard("https://further-camcorders-recruitment-subscriber.trycloudflare.com", "cf")
                }
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#94a3b8",
                  cursor: "pointer",
                  padding: 4,
                  display: "flex",
                  alignItems: "center",
                }}
                title="Copy URL"
              >
                {copiedLink === "cf" ? <Check size={16} color="#4ade80" /> : <Copy size={16} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Demo Credentials & Baseline Reference */}
      <div
        style={{
          background: "var(--surface, #ffffff)",
          border: "1px solid var(--border, #e2e8f0)",
          borderRadius: 12,
          padding: 28,
        }}
      >
        <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text, #0f172a)", marginBottom: 16 }}>
          Live Demonstration Project Specifications
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
          <div style={{ padding: 14, borderRadius: 8, background: "var(--surface-sunken, #f8fafc)", border: "1px solid var(--border, #e2e8f0)" }}>
            <div style={{ fontSize: 12, color: "var(--muted, #64748b)", fontWeight: 600 }}>TARGET PROJECT</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text, #0f172a)", marginTop: 2 }}>
              Karam Apartments — Lang'ata
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
              Code: <strong style={{ color: "#0f172a" }}>PRJ-KRM-01</strong> • ID: ce-construction-karam-001
            </div>
          </div>

          <div style={{ padding: 14, borderRadius: 8, background: "var(--surface-sunken, #f8fafc)", border: "1px solid var(--border, #e2e8f0)" }}>
            <div style={{ fontSize: 12, color: "var(--muted, #64748b)", fontWeight: 600 }}>STAGE-GATE DEMO KEY</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#dc2626", marginTop: 2 }}>
              Superstructure Frame
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
              Prerequisite: <em>Substructure & Raft Foundation (at 50%)</em>
            </div>
          </div>

          <div style={{ padding: 14, borderRadius: 8, background: "var(--surface-sunken, #f8fafc)", border: "1px solid var(--border, #e2e8f0)" }}>
            <div style={{ fontSize: 12, color: "var(--muted, #64748b)", fontWeight: 600 }}>BACKEND PRODUCTION API</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#0284c7", marginTop: 4, wordBreak: "break-all" }}>
              https://api.centerestates.com/api/v1/construction
            </div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
              Django 5.0 • MySQL • SSL • Biometric verification
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
