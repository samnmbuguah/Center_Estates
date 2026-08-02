import { useState } from "react";
import { ChevronDown } from "lucide-react";

const FAQS = [
  {
    q: "What is MonitorERP?",
    a: "MonitorERP is a cloud-based construction management platform. It helps project teams track progress, manage costs, capture evidence, and generate reports — from site to boardroom. It includes modules for progress tracking, financials, procurement, quality, BIM, drone data, and more.",
  },
  {
    q: "How does the free trial work?",
    a: "You get full access to all modules for 14 days. No credit card required. After the trial, choose a plan that fits your team size and needs.",
  },
  {
    q: "Is there a mobile app?",
    a: "Yes. Our native Android app works offline — field teams can capture photos, log daily progress, and submit evidence without internet. Data syncs automatically when connectivity is restored.",
  },
  {
    q: "How is evidence protected from tampering?",
    a: "Every submission is immutable once signed off. Photos are geotagged and timestamped. Milestones, daily logs, and tickets use an audit-sealed design — data cannot be altered after submission.",
  },
  {
    q: "Can I use it without internet on site?",
    a: "Yes. The mobile app is offline-first. It works in remote areas with no connectivity. Data syncs to the cloud when the device reconnects.",
  },
  {
    q: "What modules are available?",
    a: "Core modules include: Progress Tracking, Financials (BoQ, variations, certificates), Procurement, Quality Management, Consultant Payments, BIM Models, Drone Data, and Cost Management. An optional external Sales integration slot can be enabled for partners — sales inventory/buyers are not part of the core product. You can enable only the modules you need per project.",
  },
  {
    q: "Can I integrate with my accounting software?",
    a: "Yes. We provide a REST API for integration with external systems including accounting software, ERP systems, and custom tools.",
  },
  {
    q: "How is data secured?",
    a: "All data is encrypted in transit (TLS) and at rest. We use role-based access control to ensure users only see what they're authorised to. Regular backups are maintained.",
  },
  {
    q: "What kind of support is available?",
    a: "All plans include email support. Professional and Enterprise plans include priority support. Enterprise plans include a dedicated account manager and SLA guarantees.",
  },
  {
    q: "Can I change my plan later?",
    a: "Yes. You can upgrade or downgrade your plan at any time. Changes take effect immediately.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div>
      <section style={{
        padding: "60px 24px 40px", textAlign: "center",
        background: "var(--glow), var(--bg)",
      }}>
        <h1 style={{ fontSize: 40, marginBottom: 8 }}>Frequently Asked Questions</h1>
        <p style={{ color: "var(--muted)", fontSize: 17 }}>Everything you need to know about MonitorERP.</p>
      </section>

      <section style={{ padding: "20px 24px 60px", maxWidth: 720, margin: "0 auto" }}>
        {FAQS.map((faq, i) => (
          <div key={i} style={{
            borderBottom: "1px solid var(--border)", padding: "16px 0",
            cursor: "pointer",
          }} onClick={() => setOpen(open === i ? null : i)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <strong style={{ fontSize: 16 }}>{faq.q}</strong>
              <ChevronDown size={18} style={{
                color: "var(--muted)", flex: "none",
                transform: open === i ? "rotate(180deg)" : "none",
                transition: "transform 0.18s",
              }} />
            </div>
            {open === i && (
              <p style={{ marginTop: 10, color: "var(--muted)", lineHeight: 1.7, fontSize: 15 }}>
                {faq.a}
              </p>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
