import { useEffect } from "react";
import { Link } from "@/components/monitoring/react-router-shim";

export function Home() {
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash) {
        const el = document.querySelector(hash);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
    handleHash();
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest<HTMLAnchorElement>("a[href^='/#'], a[href^='#']");
      if (!anchor) return;
      const hash = anchor.getAttribute("href")?.replace(/^\//, "");
      if (!hash || !hash.startsWith("#")) return;
      const el = document.querySelector(hash);
      if (el) {
        e.preventDefault();
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        window.history.replaceState(null, "", hash);
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <div>
      {/* ═══════════════ HERO ═══════════════ */}
      <section className="hero">
        <div className="hero-bg-fallback" />
        <div className="hero-overlay" />
        <div className="hero-left">
          <div className="hero-badge">
            <span className="hero-badge-dot" />
            One connected estate operations platform · Kenya
          </div>

          <h1 className="hero-h1">
            Run every <strong>estate</strong><br />
            with clarity &amp;<br />
            control
          </h1>

          <p className="hero-lead">
            Manage properties, facilities, tenants, sales, tenders, valuations and
            daily team work from one secure, subscription-aware workspace.
          </p>

          <div className="hero-ctas">
            <Link to="/product" className="btn-hero-primary">
              Explore the platform
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </Link>
            <a href="#solutions" className="btn-hero-secondary">
              Explore Solutions
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
            </a>
          </div>

          <div className="hero-feature-row">
            <div className="hero-feature">
              <div className="hero-feature-icon">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              </div>
              Independent Verification
            </div>
            <div className="hero-feature">
              <div className="hero-feature-icon">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              </div>
              Real-Time Site Data
            </div>
            <div className="hero-feature">
              <div className="hero-feature-icon">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
              </div>
              Audit-Sealed Evidence
            </div>
            <div className="hero-feature">
              <div className="hero-feature-icon">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>
              </div>
              Multi-Stakeholder Access
            </div>
            <div className="hero-feature">
              <div className="hero-feature-icon">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>
              </div>
              Connected Operations
            </div>
          </div>
        </div>

        {/* Dashboard mockup */}
        <div className="hero-right">
          <div style={{ position: "relative" }}>
            <div className="dash-card">
              <div className="dash-topbar">
                <div className="dash-dot r" />
                <div className="dash-dot y" />
                <div className="dash-dot g" />
                <div className="dash-url-bar">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
                  centerestates.co.ke/workspaces
                </div>
              </div>

              <div className="dash-body">
                <div className="dash-kpi-row">
                  <div className="dash-kpi">
                    <div className="dash-kpi-label">Projects</div>
                    <div className="dash-kpi-val">12</div>
                    <div className="dash-kpi-sub up">+7% on track</div>
                  </div>
                  <div className="dash-kpi">
                    <div className="dash-kpi-label">Cashflow</div>
                    <div className="dash-kpi-val">5.2M</div>
                    <div className="dash-kpi-sub up">45/80 certified</div>
                  </div>
                  <div className="dash-kpi">
                    <div className="dash-kpi-label">Occupancy</div>
                    <div className="dash-kpi-val">84%</div>
                    <div className="dash-kpi-sub up">+4% this quarter</div>
                  </div>
                </div>

                <div className="dash-mid">
                  <div className="dash-donut-wrap">
                    <svg viewBox="0 0 86 86">
                      <circle className="dash-donut-bg" cx="43" cy="43" r="35" />
                      <circle className="dash-donut-fg" cx="43" cy="43" r="35" />
                    </svg>
                    <div className="dash-donut-label">
                      68%
                      <span>Progress</span>
                    </div>
                  </div>
                  <div className="dash-side-stats">
                    <div className="dash-side-stat">
                      <span className="dash-side-stat-label">Defects</span>
                      <span className="dash-side-stat-val red">23</span>
                    </div>
                    <div className="dash-side-stat">
                      <span className="dash-side-stat-label">Cashflow $$$</span>
                      <span className="dash-side-stat-val">45 / 80</span>
                    </div>
                    <div className="dash-side-stat">
                      <span className="dash-side-stat-label">Sites Active</span>
                      <span className="dash-side-stat-val green">9</span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="dash-table-head">
                    <div className="dash-table-title">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                      Open Defects
                    </div>
                    <span className="dash-table-see">See all</span>
                  </div>
                  <table className="dash-table">
                    <thead>
                      <tr>
                        <th>Issue</th>
                        <th>Site</th>
                        <th>Date</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Roofing Issue</td><td>Westlands B</td><td>Mar 15</td>
                        <td><span className="dash-badge open">Open</span></td>
                      </tr>
                      <tr>
                        <td>Electrical Fault</td><td>Karen Ph. 2</td><td>Mar 15</td>
                        <td><span className="dash-badge review">Review</span></td>
                      </tr>
                      <tr>
                        <td>Plumbing Leak</td><td>Kilimani</td><td>Mar 15</td>
                        <td><span className="dash-badge open">Open</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="hero-float-1">
              <div className="float-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <div>
                <div className="float-label">23 Defects Verified</div>
                <div className="float-sub">Real-time audit trail</div>
              </div>
            </div>

            <div className="hero-float-2">
              <div className="float-icon-sm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink)" }}>Live Updates</div>
                <div style={{ fontSize: 10, color: "var(--ink3)" }}>9 sites active</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ FEATURES BAR ═══════════════ */}
      <div className="features-bar">
        <div className="fbar-item">
          <div className="fbar-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
          </div>
          Independent Verification
        </div>
        <div className="fbar-divider" />
        <div className="fbar-item">
          <div className="fbar-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
          </div>
          Real-Time Site Data
        </div>
        <div className="fbar-divider" />
        <div className="fbar-item">
          <div className="fbar-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
          </div>
          Audit-Sealed Evidence
        </div>
        <div className="fbar-divider" />
        <div className="fbar-item">
          <div className="fbar-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></svg>
          </div>
          Multi-Stakeholder Access
        </div>
        <div className="fbar-divider" />
        <div className="fbar-item">
          <div className="fbar-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>
          </div>
          Procurement Tracking
        </div>
      </div>

      {/* ═══════════════ PRODUCTS ═══════════════ */}
      <section className="section" id="products">
        <div className="section-inner">
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div className="section-tag" style={{ justifyContent: "center" }}>Our Products</div>
            <h2 className="section-h2">One platform for every estate decision</h2>
            <p className="section-lead" style={{ margin: "12px auto 0" }}>Subscribe to the modules your team needs, with one shared view of your properties and people.</p>
          </div>

          <div className="products-grid">
            {/* Property Management */}
            <div className="product-card">
              <div className="pc-img pc-img-construction">
                <div className="pc-img-icon">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="14" rx="2" /><path d="M12 6V4" /><path d="M6 20v-2" /><path d="M18 20v-2" /><path d="M8 12h8" /><path d="M8 16h5" /></svg>
                </div>
              </div>
              <div className="pc-body">
                <div className="pc-title">Property Management</div>
                <p className="pc-desc">Keep occupancy, leases, collections, service charges and property records in sync.</p>
                <ul className="pc-list">
                  <li><span className="pc-list-dot"><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg></span>Occupancy &amp; tenancy</li>
                  <li><span className="pc-list-dot"><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg></span>Collections &amp; reporting</li>
                </ul>
                <a href="#contact" className="pc-learn">
                  Learn More
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                </a>
              </div>
            </div>

            {/* Financial Tracking */}
            <div className="product-card">
              <div className="pc-img pc-img-financial">
                <div className="pc-img-icon">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>
                </div>
              </div>
              <div className="pc-body">
                <div className="pc-title">Financial Tracking</div>
                <p className="pc-desc">Cashflow and budget management linked directly to verified site work.</p>
                <ul className="pc-list">
                  <li><span className="pc-list-dot"><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg></span>Payment certifications</li>
                  <li><span className="pc-list-dot"><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg></span>Outstanding balances</li>
                </ul>
                <a href="#contact" className="pc-learn">
                  Learn More
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                </a>
              </div>
            </div>

            {/* Evidence & compliance — core differentiator */}
            <div className="product-card featured">
              <div className="featured-label">Key Feature</div>
              <div className="pc-img pc-img-sales">
                <div className="pc-img-icon">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                </div>
              </div>
              <div className="pc-body">
                <div className="pc-title">Evidence Integrity &amp; Audit Seals</div>
                <p className="pc-desc">Immutable site evidence with biometric signatures, geofencing, and payment-ready audit certificates.</p>
                <ul className="pc-list">
                  <li><span className="pc-list-dot"><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg></span>Camera-only geotagged capture</li>
                  <li><span className="pc-list-dot"><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg></span>Ed25519 biometric signatures</li>
                  <li><span className="pc-list-dot"><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg></span>PDF audit certificates</li>
                </ul>
                <a href="#contact" className="pc-learn">
                  Learn More
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                </a>
              </div>
            </div>

            {/* Procurement Tracking */}
            <div className="product-card">
              <div className="pc-img pc-img-procurement">
                <div className="pc-img-icon">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>
                </div>
              </div>
              <div className="pc-body">
                <div className="pc-title">Procurement Tracking</div>
                <p className="pc-desc">Verify site deliveries against supplier orders with full material tracking.</p>
                <ul className="pc-list">
                  <li><span className="pc-list-dot"><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg></span>Delivery verification</li>
                  <li><span className="pc-list-dot"><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg></span>Supplier logs</li>
                </ul>
                <a href="#contact" className="pc-learn">
                  Learn More
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ ECOSYSTEM ═══════════════ */}
      <section className="section section-alt" id="solutions">
        <div className="section-inner">
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div className="section-tag" style={{ justifyContent: "center" }}>Connected Estate Operations</div>
            <h2 className="section-h2">Built for Real-World Use in Kenya</h2>
            <p className="section-lead" style={{ margin: "12px auto 0", maxWidth: 600 }}>
              Center Estates connects owners, managers, operators, tenants and service teams through one trusted operational record.
            </p>
          </div>

          <div className="ecosystem-grid">
            {[
              { icon: "blue", label: "Mobile App", desc: "Capture site data, upload photos, and update progress directly from site.",
                svg: <><rect x="5" y="2" width="14" height="20" rx="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></> },
              { icon: "teal", label: "In-App Chat", desc: "Communicate with teams, contractors, and stakeholders within the system.",
                svg: <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /> },
              { icon: "indigo", label: "Calendar & Scheduling", desc: "Track inspections, milestones, and key project activities.",
                svg: <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><polyline points="9 16 11 18 15 14" /></> },
              { icon: "amber", label: "Notifications & Alerts", desc: "Get real-time alerts on delays, payments, and project updates.",
                svg: <><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /><circle cx="19" cy="5" r="3" fill="var(--brand)" stroke="none" /></> },
              { icon: "green", label: "WhatsApp Integration", desc: "Send updates, alerts, and reports directly via WhatsApp.",
                svg: <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" /> },
              { icon: "mpesa", label: "M-PESA Integration", desc: "Track and reconcile payments seamlessly through M-Pesa.",
                svg: <><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></> },
              { icon: "brand", label: "Client & Buyer Portals", desc: "Give buyers and stakeholders controlled access to view progress, payments, and reports.",
                svg: <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></> },
              { icon: "slate", label: "Role-Based Dashboards", desc: "Tailored views for developers, agents, financiers, and buyers — everyone sees what they need.",
                svg: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></> },
            ].map(e => (
              <div key={e.label} className="eco-card">
                <div className={`eco-icon eco-icon-${e.icon}`}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    {e.svg}
                  </svg>
                </div>
                <div className="eco-body">
                  <div className="eco-title">{e.label === "M-PESA Integration"
                    ? <><span style={{ color: "#4caf50", fontWeight: 800 }}>M</span><span style={{ color: "#e53935", fontWeight: 800 }}>-PESA</span> Integration</>
                    : e.label}</div>
                  <p className="eco-desc">{e.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ HOW IT WORKS ═══════════════ */}
      <section className="section" id="how-it-works">
        <div className="section-inner">
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <div className="section-tag" style={{ justifyContent: "center" }}>How It Works</div>
            <h2 className="section-h2">Four steps to full project transparency</h2>
            <p className="section-lead" style={{ margin: "12px auto 0" }}>From on-site data capture to financier reports — everything is verified.</p>
          </div>

          <div className="steps-grid">
            <div className="steps-connector" />
            {[
              {
                num: 1, imgClass: "construction",
                icon: <><rect x="5" y="2" width="14" height="20" rx="2" /><line x1="12" y1="18" x2="12.01" y2="18" /><path d="M9 7h6" /><path d="M9 11h6" /></>,
                check: "Site Data Captured (Mobile + Real-Time Sync)",
                title: "Field teams use a mobile app for live data capture",
                desc: "Site Agent record photos, progress updates, measurements, and site notes directly from site. All data syncs in real time to the system."
              },
              {
                num: 2, imgClass: "person",
                icon: <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></>,
                check: "Independent Digital Verification Layer",
                title: "Verified using technologies",
                desc: "Data is independently validated using drone imagery, GIS mapping, and GPS-based site tracking, ensuring accuracy, progress authenticity, and location integrity before approval into the system."
              },
              {
                num: 3, imgClass: "laptop",
                icon: <><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></>,
                check: "Dashboard Updates",
                title: "Live project intelligence for all stakeholders",
                desc: "Project progress, cost performance, and sales data update instantly across dashboards for developers, consultants, and financiers."
              },
              {
                num: 4, imgClass: "report",
                icon: <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></>,
                check: "Reports Shared",
                title: "Automated, audit-ready reporting engine",
                desc: "Time-stamped reports are automatically generated and securely distributed to banks, financiers, and clients on scheduled intervals."
              },
            ].map(s => (
              <div key={s.num} className="step">
                <div className="step-num-wrap"><div className="step-num">{s.num}</div></div>
                <div className={`step-img step-img-${s.imgClass}`}>
                  <div className="step-img-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {s.icon}
                    </svg>
                  </div>
                </div>
                <div className="step-check">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  {s.check}
                </div>
                <div className="step-title">{s.title}</div>
                <p className="step-desc">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ PILLARS (dark) ═══════════════ */}
      <section className="section section-dark">
        <div className="section-inner">
          <div style={{ marginBottom: 44 }}>
            <div className="section-tag">Built For</div>
            <h2 className="section-h2">Transparency &amp; Accountability</h2>
            <p className="section-lead" style={{ color: "rgba(255,255,255,.5)" }}>Every feature is designed around independent verification and audit trails.</p>
          </div>

          <div className="pillars-grid">
            <div className="pillar">
              <div className="pillar-icon-wrap red">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              </div>
              <div className="pillar-title">Time-Stamped Reports</div>
              <p className="pillar-desc">Every data point is automatically timestamped, ensuring an immutable, court-admissible audit trail for all stakeholders.</p>
            </div>
            <div className="pillar">
              <div className="pillar-icon-wrap blue">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
              </div>
              <div className="pillar-title">Photo &amp; Audit Trail</div>
              <p className="pillar-desc">Site photos, inspection notes, and approval signatures are attached to every record — making disputes easy to resolve.</p>
            </div>
            <div className="pillar">
              <div className="pillar-icon-wrap green">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
              </div>
              <div className="pillar-title">Role-Based Access</div>
              <p className="pillar-desc">Developers, financiers, clerks, sales agents, and buyers each see exactly what they need. Sensitive data is compartmentalised.</p>
            </div>
          </div>

          {/* Metrics */}
          <div style={{ marginTop: 52, marginBottom: 18 }}>
            <div className="section-tag">Real-Time Project Insights</div>
          </div>
          <div className="metrics-grid">
            {[
              { val: "12", label: "Projects On Track", trend: "+7%", trendClass: "up", sparkClass: "green", icon: <polyline points="20 6 9 17 4 12" />,
                sparkPath: "M0 40 L15 32 L30 35 L45 28 L60 22 L75 25 L90 16 L105 10 L120 6" },
              { val: "8", label: "Delayed Projects", trend: "69%", trendClass: "down", sparkClass: "red", icon: <><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>,
                sparkPath: "M0 10 L15 18 L30 14 L45 22 L60 28 L75 20 L90 32 L105 28 L120 36" },
              { val: "5.2M", label: "Cashflow Status", trend: "Live", trendClass: "up", sparkClass: "blue", icon: <><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></>,
                sparkPath: "M0 34 L15 30 L30 32 L45 26 L60 20 L75 24 L90 14 L105 18 L120 10" },
              { val: "84%", label: "Portfolio Occupancy", trend: "+4%", trendClass: "up", sparkClass: "amber", icon: <><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>,
                sparkPath: "M0 38 L15 34 L30 30 L45 28 L60 24 L75 20 L90 16 L105 12 L120 8" },
            ].map(m => (
              <div key={m.label} className="metric-card">
                <div className="metric-card-top">
                  <div className="metric-icon-row">
                    <div className={`metric-icon ${m.sparkClass}`}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">{m.icon}</svg>
                    </div>
                    <span className={`metric-trend-pill ${m.trendClass}`}>{m.trend}</span>
                  </div>
                  <div className="metric-val">{m.val}</div>
                  <div className="metric-label">{m.label}</div>
                </div>
                <div className={`metric-spark spark-${m.sparkClass}`}>
                  <svg viewBox="0 0 120 44" preserveAspectRatio="none">
                    <path className="spark-area" d={`${m.sparkPath} L120 44 L0 44 Z`} />
                    <path className="spark-line" d={m.sparkPath} />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ STAKEHOLDERS ═══════════════ */}
      <section className="section section-alt" id="stakeholders">
        <div className="section-inner">
          <div style={{ textAlign: "center", marginBottom: 44 }}>
            <div className="section-tag" style={{ justifyContent: "center" }}>Who It's For</div>
            <h2 className="section-h2">Built for Every Stakeholder<br />in the Project Lifecycle</h2>
            <p className="section-lead" style={{ margin: "12px auto 0" }}>From groundbreaking to handover, every team gets a tailored view with exactly the data they need.</p>
          </div>

          <div className="stakeholders-grid">
            {[
              { portraitClass: "dev", svg: <><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></>, name: "Developers",
                desc: "Manage projects, track progress, control costs, and coordinate all stakeholders in one system." },
              { portraitClass: "pm", svg: <><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><path d="M9 12h6M9 16h4" /></>, name: "Project Consultants",
                desc: "Architect, engineer, QS, and site teams collaborate in real time with verified project data and reporting tools." },
              { portraitClass: "agent", svg: <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></>, name: "Conveyancing Teams",
                desc: "See sales dashboards, access project documentation, compliance records, and transaction status for smooth property transfer." },
              { portraitClass: "buyer", svg: <><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>, name: "Home Buyers & Investors",
                desc: "Track project progress, view updates, verify milestones, and stay informed from start to handover." },
              { portraitClass: "bank", svg: <><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></>, name: "Financiers & Banks",
                desc: "Track project performance, monitor overall project health, and manage risks through real-time project visibility." },
            ].map(sh => (
              <div key={sh.name} className="stakeholder">
                <div className="sh-portrait">
                  <div className={`sh-portrait-bg ${sh.portraitClass}`} />
                  <div className="sh-portrait-figure">
                    <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      {sh.svg}
                    </svg>
                  </div>
                </div>
                <div className="sh-name">{sh.name}</div>
                <div className="sh-desc">{sh.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ CTA ═══════════════ */}
      <section className="cta-section">
        <div className="cta-inner">
          <h2 className="cta-h2">Ready to Transform Your Project Oversight?</h2>
          <p className="cta-lead">Join developers, banks, and inspectors across Kenya who trust MonitoringErp for end-to-end project transparency.</p>
          <div className="cta-actions">
            <Link to="/login" className="btn-cta-white">
              Book a Demo
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
            </Link>
            <Link to="/login" className="btn-cta-outline">
              Sign In
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
