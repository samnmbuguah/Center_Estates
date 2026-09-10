import { useState } from "react";
import { useNavigate } from "@/components/monitoring/react-router-shim";
import {
  Building2, FileText, CheckCircle2, AlertCircle, Plus, ArrowRight,
  FileCheck, Shield, Layers, Compass, Ruler, Calculator, BookOpen,
  Download, Eye, ArrowUpRight
} from "lucide-react";

const PRE_CONSTRUCTION_PROJECTS = [
  { id: "kasneb-towers-2", name: "KASNEB Towers II", client: "KASNEB", location: "Nairobi", budget: "1.85B", readiness: 100, status: "Ready for Construction", approvals: "NEMA, County Approved" },
  { id: "sunset-heights", name: "Sunset Heights", client: "Sunset Dev Ltd", location: "Kisumu", budget: "620M", readiness: 75, status: "Approvals Pending", approvals: "EIA Submitted" },
  { id: "greenview-apts", name: "Greenview Apartments", client: "Greenview Ltd", location: "Nakuru", budget: "850M", readiness: 60, status: "Design & BoQ Review", approvals: "Permits In Progress" },
];

const PRE_CONSTRUCTION_MODULES = [
  {
    title: "1. Project Planning & Feasibility",
    desc: "Land & title info, site feasibility studies, and initial scope definition.",
    icon: Compass,
    color: "var(--color-blue)",
    links: [
      { label: "Onboard New Project", path: "/app/onboarding" },
      { label: "View Portfolio Planning", path: "/app/projects" },
    ],
  },
  {
    title: "2. Design & Documentation",
    desc: "Architectural, structural, and MEP drawings, specs, and BIM models.",
    icon: Ruler,
    color: "var(--color-emerald)",
    links: [
      { label: "Project Documents & Drawings", path: "/app/project-documents" },
      { label: "BIM Models & Discrepancies", path: "/app/projects" },
    ],
  },
  {
    title: "3. Budgeting & Bills of Quantities",
    desc: "Baseline BoQs, material reconciliation, cost estimation, and rate review.",
    icon: Calculator,
    color: "var(--color-amber)",
    links: [
      { label: "BoQ Review & Rates", path: "/app/projects" },
      { label: "Cost Dashboard", path: "/app/finance" },
    ],
  },
  {
    title: "4. Statutory Approvals & Permits",
    desc: "NEMA EIA licenses, County building permits, safeguards, and compliance.",
    icon: FileCheck,
    color: "var(--color-violet-strong)",
    links: [
      { label: "Approvals & Permits Register", path: "/app/approvals" },
      { label: "Environmental & Safeguards", path: "/app/projects" },
    ],
  },
  {
    title: "5. Contracts & Appointments",
    desc: "Consultant engagement letters, main contractor agreement, and insurance.",
    icon: BookOpen,
    color: "#06b6d4",
    links: [
      { label: "Consultant Agreements", path: "/app/projects" },
      { label: "Contractor Onboarding", path: "/app/onboarding" },
    ],
  },
];

export function PreConstruction() {
  const navigate = useNavigate();
  const downloadClearanceReport = () => {
    const rows = [["Project", "Client", "Location", "Budget", "Readiness", "Status", "Approvals"], ...PRE_CONSTRUCTION_PROJECTS.map(p => [p.name, p.client, p.location, p.budget, `${p.readiness}%`, p.status, p.approvals])];
    const csv = rows.map(row => row.map(v => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "pre-construction-clearance-register.csv"; a.click();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "var(--muted)", textTransform: "uppercase", marginBottom: 2 }}>
            Stage 1 of 6 Lifecycle
          </div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Pre-Construction Hub</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>
            Project planning, statutory approvals, drawings, BoQs, and contract appointments before site mobilization
          </p>
        </div>
        <button className="btn primary" onClick={() => navigate("/app/onboarding")} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={16} /> Start New Project Onboarding
        </button>
        <button className="btn ghost" onClick={downloadClearanceReport} style={{ display: "flex", alignItems: "center", gap: 6 }}><Download size={15} /> Clearance Report</button>
      </div>

      {/* 4 KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {[
          { label: "Projects in Pre-Construction", value: "3", sub: "1 Ready, 2 In Progress", color: "var(--color-blue)" },
          { label: "Pending Permits & Approvals", value: "7", sub: "NEMA & County Permits", color: "var(--color-amber)" },
          { label: "BoQs & Designs Uploaded", value: "5", sub: "Baseline costed", color: "var(--color-emerald)" },
          { label: "Consultant Contracts Signed", value: "4", sub: "Architects, Engineers, QS", color: "var(--color-violet-strong)" },
        ].map(k => (
          <div key={k.label} style={{
            padding: "16px 18px", borderRadius: 12, background: "var(--surface)",
            border: "1px solid var(--border)", borderTop: `3px solid ${k.color}`,
          }}>
            <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, marginBottom: 2 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)" }}>{k.value}</div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Active Pre-Construction Projects Table */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", background: "var(--surface-2)", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 800, fontSize: 14 }}>PROJECTS IN PRE-CONSTRUCTION STAGE</span>
          <button className="btn ghost sm" onClick={() => navigate("/app/projects")} style={{ fontSize: 12, color: "var(--color-danger)" }}>
            View Full Portfolio →
          </button>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)", color: "var(--muted)", textAlign: "left" }}>
              {["Project Name", "Client", "Location", "Budget (KES)", "Statutory Approvals", "Readiness", "Status", "Action"].map(h => (
                <th key={h} style={{ padding: "10px 16px", fontWeight: 700 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PRE_CONSTRUCTION_PROJECTS.map(p => (
              <tr key={p.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text)" }}>{p.name}</td>
                <td style={{ padding: "12px 16px", color: "var(--muted)" }}>{p.client}</td>
                <td style={{ padding: "12px 16px" }}>{p.location}</td>
                <td style={{ padding: "12px 16px", fontFamily: "monospace", fontWeight: 700 }}>{p.budget}</td>
                <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--muted)" }}>{p.approvals}</td>
                <td style={{ padding: "12px 16px", minWidth: 100 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 2, color: p.readiness === 100 ? "var(--color-emerald)" : "var(--color-amber)" }}>{p.readiness}%</div>
                  <div style={{ height: 5, borderRadius: 3, background: "var(--surface-3)", overflow: "hidden" }}>
                    <div style={{ width: `${p.readiness}%`, height: "100%", background: p.readiness === 100 ? "var(--color-emerald)" : "var(--color-amber)", borderRadius: 3 }} />
                  </div>
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 10, background: p.readiness === 100 ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)", color: p.readiness === 100 ? "var(--color-emerald)" : "var(--color-amber)" }}>
                    {p.status}
                  </span>
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <button className="btn ghost sm" onClick={() => navigate(`/app/onboarding/${p.id}`)} style={{ fontSize: 11 }}>
                    {p.readiness === 100 ? "View Wizard" : "Continue Onboarding"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pre-Construction Key Modules Grid */}
      <div>
        <h3 style={{ margin: "8px 0 14px", fontSize: 16, fontWeight: 800 }}>PRE-CONSTRUCTION STAGE MODULES</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          {PRE_CONSTRUCTION_MODULES.map(m => {
            const Icon = m.icon;
            return (
              <div key={m.title} style={{
                background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
                padding: "18px 20px", display: "flex", flexDirection: "column", justifyContent: "space-between",
              }}>
                <div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: `color-mix(in srgb, ${m.color} 9%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon size={18} style={{ color: m.color }} />
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text)" }}>{m.title}</div>
                  </div>
                  <p style={{ margin: "0 0 14px", fontSize: 12, color: "var(--muted)", lineHeight: 1.4 }}>{m.desc}</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                  {m.links.map(link => (
                    <button key={link.label} onClick={() => navigate(link.path)} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "6px 8px", borderRadius: 6, border: 0, background: "var(--surface-2)",
                      fontSize: 12, fontWeight: 600, color: "var(--text)", cursor: "pointer", textAlign: "left",
                    }}>
                      <span>{link.label}</span>
                      <ArrowRight size={12} style={{ color: "var(--muted)" }} />
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
