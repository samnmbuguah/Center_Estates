"use client";

import { useEffect, useState } from "react";
import { Link } from "@/components/monitoring/react-router-shim";
import { ChevronDown, HelpCircle, Building2, ShieldCheck } from "lucide-react";
import { isSalesOnlyHost } from "@/lib/site-mode";

const ERP_FAQS = [
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

const SALES_FAQS = [
  {
    category: "Buying Process",
    q: "How do I purchase a property through Center Estates?",
    a: "Purchasing is structured into clear, transparent steps: 1) Browse our verified listings and schedule an in-person or virtual viewing with an assigned sales consultant. 2) Submit a reservation form and pay a commitment deposit into the dedicated project advocate escrow account. 3) Receive and execute the formal Letter of Offer and Agreement for Sale prepared by registered advocates. 4) Complete milestone installments tied to construction progress or authorize bank mortgage disbursement upon completion.",
  },
  {
    category: "Legal & Titles",
    q: "What legal title deed will I receive for apartments and commercial suites?",
    a: "All residential apartments and commercial suites sold through Center Estates comply strictly with the Kenyan Sectional Properties Act 2020. You will receive an independent, individual Sectional Title Deed registered directly in your name at the Ministry of Lands, giving you registered ownership with full sub-lease or freehold rights.",
  },
  {
    category: "Diaspora Desk",
    q: "Can Kenyans living in the diaspora purchase property safely without traveling to Kenya?",
    a: "Yes! Over 35% of our purchasers reside in the US, UK, Europe, the Gulf, and Canada. Our dedicated Diaspora Desk coordinates the complete transaction remotely: certified digital identity verification, independent advocate escrow accounts, 4K virtual tours, and legal representation via registered Power of Attorney or notarized documentation. You also track construction progress and statements in real time via our secure Client Portal.",
  },
  {
    category: "Payment & Escrow",
    q: "What are the deposit and payment terms for off-plan properties?",
    a: "Off-plan developments typically require a 10% to 20% booking deposit upon signing the sale agreement. The balance is structured into structured stage payments matching key building milestones (e.g. Substructure 20%, Superstructure 30%, Roof & Finishes 20%, Handover 10%) over an 18 to 24 month construction cycle. Tailored cash payment plans and bank mortgage completion terms are also available.",
  },
  {
    category: "Due Diligence",
    q: "How does Center Estates verify listings before making them available to buyers?",
    a: "Every development in our portfolio undergoes rigorous 4-step due diligence: 1) Official Ministry of Lands Registry Search confirming clean ownership and absence of encumbrances. 2) Cadastral survey beacon verification by a licensed surveyor. 3) Verification of National Construction Authority (NCA) and NEMA environmental approvals. 4) Independent escrow management by accredited conveyancing advocates.",
  },
  {
    category: "Purchase Costs",
    q: "What additional transaction fees and taxes should I budget for in Kenya?",
    a: "When buying real estate in Kenya, buyers should budget for: 1) Stamp Duty (4% of property valuation in municipalities/cities like Nairobi and Mombasa, or 2% in agricultural/rural zones). 2) Legal and Conveyancing Fees (typically 1% to 2% + VAT as regulated by the Advocates Remuneration Order). 3) Stamp Duty on Charge (approx. 0.1% if securing bank mortgage financing). 4) One-time utility meter and service charge deposit at handover.",
  },
  {
    category: "Financing & Mortgages",
    q: "Can I finance my purchase with a Kenyan bank mortgage or SACCO loan?",
    a: "Yes. All our developments are pre-appraised with Kenya's leading mortgage lenders including Stanbic Bank Kenya, KCB Bank, Absa Bank Kenya, and NCBA Group. We provide the full developer legal pack and approved architectural documentation directly to your lender's conveyancers to expedite loan approval and letter of undertaking issuance.",
  },
  {
    category: "Buyer Portal",
    q: "What is the Center Estates Client Portal and how do I access it?",
    a: "The Client Portal is your private digital dashboard accessible from any computer or smartphone. Once you reserve a unit, you receive login credentials allowing you to view monthly certified photo logs of construction progress, download signed contracts and floor plans, view statements of account and milestone receipts, and submit inquiries directly to your account executive.",
  },
  {
    category: "Site Viewings",
    q: "Can I arrange an on-site inspection or visit the show houses?",
    a: "Yes, accompanied site visits and show house tours are conducted Monday through Saturday from 8:00 AM to 5:00 PM. You can book an appointment directly from any property page, reach our WhatsApp Sales Desk at +254 712 345 678, or visit our Advisory Hub at Kilimani Heights.",
  },
];

interface FaqProps {
  isSales?: boolean;
}

export function Faq({ isSales }: FaqProps) {
  const [sales, setSales] = useState(() => {
    if (typeof isSales === "boolean") return isSales;
    return typeof window !== "undefined" ? isSalesOnlyHost() : false;
  });

  const [open, setOpen] = useState<number | null>(0);
  const [activeCategory, setActiveCategory] = useState<string>("All");

  useEffect(() => {
    if (typeof isSales !== "boolean") {
      setSales(isSalesOnlyHost());
    }
  }, [isSales]);

  if (!sales) {
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
          {ERP_FAQS.map((faq, i) => (
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

  // Real estate storefront view for .co.ke
  const categories = ["All", ...Array.from(new Set(SALES_FAQS.map(f => f.category)))];
  const filteredFaqs = activeCategory === "All"
    ? SALES_FAQS
    : SALES_FAQS.filter(f => f.category === activeCategory);

  return (
    <div>
      {/* Header */}
      <section style={{
        padding: "68px 24px 44px",
        textAlign: "center",
        background: "radial-gradient(ellipse at top, rgba(37, 99, 235, 0.08) 0%, var(--bg) 70%)",
        borderBottom: "1px solid var(--border)",
      }}>
        <div style={{ maxWidth: 740, margin: "0 auto" }}>
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
            <HelpCircle size={15} /> Buyer & Investor Knowledge Base
          </span>
          <h1 style={{
            fontSize: "clamp(30px, 4vw, 44px)",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            marginBottom: 14,
            color: "var(--text)",
          }}>
            Frequently Asked Questions
          </h1>
          <p style={{ fontSize: 17, color: "var(--muted)", lineHeight: 1.7, maxWidth: 620, margin: "0 auto" }}>
            Clear answers on the Sectional Properties Act, escrow milestone security, diaspora purchasing, and conveyancing in Kenya.
          </p>

          {/* Filter Pills */}
          <div style={{
            display: "flex",
            gap: 8,
            justifyContent: "center",
            flexWrap: "wrap",
            marginTop: 28,
          }}>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => { setActiveCategory(cat); setOpen(0); }}
                style={{
                  padding: "8px 16px",
                  borderRadius: 20,
                  fontSize: 13,
                  fontWeight: 600,
                  border: "1px solid",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  background: activeCategory === cat ? "#2563eb" : "var(--surface)",
                  color: activeCategory === cat ? "#fff" : "var(--text)",
                  borderColor: activeCategory === cat ? "#2563eb" : "var(--border)",
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Accordion */}
      <section style={{ padding: "40px 24px 72px", maxWidth: 840, margin: "0 auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {filteredFaqs.map((faq, i) => {
            const isOpen = open === i;
            return (
              <div
                key={faq.q}
                style={{
                  borderRadius: 14,
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                  overflow: "hidden",
                  transition: "box-shadow 0.15s",
                }}
              >
                <div
                  style={{
                    padding: "20px 24px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 16,
                    cursor: "pointer",
                    background: isOpen ? "var(--surface-2)" : "transparent",
                  }}
                  onClick={() => setOpen(isOpen ? null : i)}
                >
                  <div>
                    <span style={{
                      display: "inline-block",
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      color: "#2563eb",
                      marginBottom: 6,
                    }}>
                      {faq.category}
                    </span>
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--text)" }}>
                      {faq.q}
                    </h3>
                  </div>
                  <ChevronDown
                    size={20}
                    style={{
                      color: "var(--muted)",
                      flex: "none",
                      transform: isOpen ? "rotate(180deg)" : "none",
                      transition: "transform 0.2s",
                    }}
                  />
                </div>

                {isOpen && (
                  <div style={{
                    padding: "16px 24px 24px",
                    color: "var(--muted)",
                    lineHeight: 1.75,
                    fontSize: 15,
                    borderTop: "1px solid var(--border)",
                  }}>
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Support Callout */}
        <div style={{
          marginTop: 48,
          padding: 28,
          borderRadius: 16,
          background: "linear-gradient(135deg, #eff6ff, #f0fdf4)",
          border: "1px solid #bfdbfe",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
          flexWrap: "wrap",
        }}>
          <div>
            <h4 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 4px", color: "#1e3a8a" }}>
              Have a specific legal or property question?
            </h4>
            <p style={{ margin: 0, fontSize: 14, color: "#1e40af" }}>
              Our conveyancing team and sales advisors are available to answer your questions.
            </p>
          </div>
          <Link to="/contact" className="btn" style={{ fontSize: 14, padding: "10px 22px" }}>
            Contact Advisory Desk
          </Link>
        </div>
      </section>
    </div>
  );
}
