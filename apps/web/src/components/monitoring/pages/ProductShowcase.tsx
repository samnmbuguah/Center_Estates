import { CheckCircle, Cloud, Cpu, HardHat, Monitor, Smartphone } from "lucide-react";
import { Link } from "@/components/monitoring/react-router-shim";

const MODULE_GROUPS = [
  {
    title: "Preconstruction & Planning",
    items: [
      "Estimating & budgeting with detailed BoQ",
      "Gantt chart scheduling and resource planning",
      "Price databases for cost comparison",
      "Project setup with custom metadata",
    ],
  },
  {
    title: "Site Execution & Progress",
    items: [
      "Milestone tracking with photo evidence",
      "Daily logs with geofenced timestamps",
      "Progress certificates linked to actual work",
      "Ticket system for defects and issues",
    ],
  },
  {
    title: "Procurement & Logistics",
    items: [
      "Purchase order management",
      "Supplier comparison and selection",
      "Warehouse and inventory tracking",
      "Material transfer between sites",
    ],
  },
  {
    title: "Financial & Cost Control",
    items: [
      "Budget vs actual variance analysis",
      "Variation order management",
      "Provisional sums and contingency drawdowns",
      "Advance payment and recovery tracking",
    ],
  },
  {
    title: "Quality & Compliance",
    items: [
      "Quality test tracking (concrete, steel, materials)",
      "Consultant payment certification workflow",
      "Environmental and social safeguards (IGP)",
      "Drone imagery and compliance audits",
    ],
  },
  {
    title: "Reporting & Analytics",
    items: [
      "Executive dashboard with KPIs and S-curves",
      "Cost dashboard with tender/budget/actual comparison",
      "Custom reports and export",
      "Progress forecasting",
    ],
  },
];

const TECH_FEATURES = [
  { icon: Cloud, title: "Cloud-Based", desc: "Access from any browser, anywhere. No installation required." },
  { icon: Smartphone, title: "Mobile App", desc: "Native Android app for field teams. Works offline, syncs automatically." },
  { icon: Monitor, title: "Desktop Optimised", desc: "Full-featured web interface for office-based planning and analysis." },
  { icon: Cpu, title: "REST API", desc: "Integrate with your existing accounting and ERP systems." },
];

export function ProductShowcase() {
  return (
    <div>
      <section style={{
        padding: "60px 24px 48px", textAlign: "center",
        background: "var(--glow), var(--bg)",
      }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <h1 style={{ fontSize: 40, marginBottom: 12 }}>Complete Construction ERP</h1>
          <p style={{ fontSize: 17, color: "var(--muted)", lineHeight: 1.6, marginBottom: 24 }}>
            One platform covering the full project lifecycle — from estimating and procurement to site execution, financial control, and handover.
          </p>
          <Link to="/sign-up" className="btn">Start Free Trial</Link>
        </div>
      </section>

      <section style={{ padding: "40px 24px 60px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
            {MODULE_GROUPS.map(g => (
              <div key={g.title} className="card" style={{ padding: 24 }}>
                <h3 style={{ margin: "0 0 12px", textTransform: "none", letterSpacing: 0, fontSize: 16, color: "var(--text)" }}>{g.title}</h3>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {g.items.map(item => (
                    <li key={item} style={{ display: "flex", gap: 8, padding: "5px 0", fontSize: 14, color: "var(--muted)" }}>
                      <CheckCircle size={16} style={{ color: "var(--green)", flex: "none", marginTop: 2 }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: "60px 24px", background: "var(--surface)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <h2 style={{ textAlign: "center", fontSize: 28, marginBottom: 36 }}>Technology</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
            {TECH_FEATURES.map(t => (
              <div key={t.title} style={{ textAlign: "center", padding: 20 }}>
                <div className="stat-icon" style={{ margin: "0 auto 12px" }}>
                  <t.icon size={24} />
                </div>
                <h3 style={{ margin: "0 0 6px", textTransform: "none", letterSpacing: 0, fontSize: 16 }}>{t.title}</h3>
                <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.5, margin: 0 }}>{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: "60px 24px", textAlign: "center" }}>
        <h2 style={{ fontSize: 28, marginBottom: 12 }}>Want to see it in action?</h2>
        <p style={{ color: "var(--muted)", marginBottom: 24 }}>Book a personalised demo with our team.</p>
        <Link to="/contact" className="btn">Schedule a Demo</Link>
      </section>
    </div>
  );
}
