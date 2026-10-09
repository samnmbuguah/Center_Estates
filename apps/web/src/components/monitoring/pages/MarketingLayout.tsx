"use client";

import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "@/components/monitoring/react-router-shim";
import { ChevronDown, MessageCircle } from "lucide-react";
import { isSalesOnlyHost } from "@/lib/site-mode";

import "./marketing.css";

const WHATSAPP_NUMBER = "254712345678";
const WHATSAPP_MESSAGE = "Hi! I'm interested in CeEst ERP. Can we chat?";
const WHATSAPP_MESSAGE_SALES = "Hi! I'm interested in a property listing. Can we chat?";

const PAGE_LINKS = [
  { to: "/product", label: "Product" },
  { to: "/pricing", label: "Pricing" },
  { to: "/docs", label: "Documentation & Guides" },
  { to: "/about", label: "About" },
  { to: "/blog", label: "Blog" },
  { to: "/faq", label: "FAQ" },
  { to: "/demo", label: "Book Demo" },
];

const SALES_NAV_LINKS = [
  { to: "/properties", label: "Properties" },
  { to: "/projects", label: "Projects" },
  { to: "/search", label: "Search" },
  { to: "/buyer-portal", label: "Client Portal" },
  { to: "/about", label: "About" },
  { to: "/faq", label: "FAQ" },
];

const SALES_FOOTER_LINKS = [
  ...SALES_NAV_LINKS,
  { to: "/tenant-portal", label: "Tenant Portal" },
  { to: "/owner-portal", label: "Owner Portal" },
  { to: "/contact", label: "Contact" },
  { to: "/privacy", label: "Privacy" },
  { to: "/terms", label: "Terms" },
  { to: "/login", label: "Staff sign-in" },
];

const FOOTER_LINKS = [
  { to: "/#products", label: "Products" },
  { to: "/#solutions", label: "Solutions" },
  { to: "/#how-it-works", label: "How It Works" },
  { to: "/docs", label: "Documentation" },
  { to: "/product", label: "Product" },
  { to: "/pricing", label: "Pricing" },
  { to: "/buyer-portal", label: "Client Portal" },
  { to: "/tenant-portal", label: "Tenant Portal" },
  { to: "/owner-portal", label: "Owner Portal" },
  { to: "/about", label: "About" },
  { to: "/blog", label: "Blog" },
  { to: "/faq", label: "FAQ" },
  { to: "/demo", label: "Book Demo" },
  { to: "/login", label: "Sign In" },
  { to: "/contact", label: "Contact" },
];

function NavDropdown({ label, links, closeMobile }: { label: string; links: { to: string; label: string }[]; closeMobile: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="nav-dropdown" ref={ref}>
      <button className="nav-dropdown-toggle" onClick={() => setOpen(!open)}>
        {label} <ChevronDown size={12} style={{ transition: "transform .2s", transform: open ? "rotate(180deg)" : "rotate(0)" }} />
      </button>
      {open && (
        <div className="nav-dropdown-menu">
          {links.map(l => (
            <Link key={l.to} to={l.to} onClick={() => { closeMobile(); setOpen(false); }}>{l.label}</Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function MarketingLayout({ children, isSales }: { children?: React.ReactNode; isSales?: boolean }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [sales, setSales] = useState(() => {
    if (typeof isSales === "boolean") return isSales;
    return typeof window !== "undefined" ? isSalesOnlyHost() : false;
  });
  const { pathname } = useLocation();

  useEffect(() => {
    if (typeof isSales !== "boolean") {
      setSales(isSalesOnlyHost());
    }
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isSales]);

  const closeMobile = () => setMobileOpen(false);
  const isHome = pathname === "/";

  return (
    <div className="marketing-page">
      {/* Google Fonts */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,300&display=swap"
      />

      {/* ── Nav ─────────────────────────────────── */}
      <nav className={`marketing-nav${scrolled ? " scrolled" : ""}`}>
        <Link to="/" className="nav-brand" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <img src="/logo.png" alt={sales ? "Center Estates" : "CeEst"} style={{ height: 44, width: 38, objectFit: "cover", objectPosition: "top", background: "var(--surface)", borderRadius: 8 }} />
          <span className="brand-text">{sales ? "Center Estates" : <>CeEst <span>ERP</span></>}</span>
        </Link>

        <div className="nav-links">
          {sales ? (
            SALES_NAV_LINKS.map((link) => (
              <NavLink key={link.to} to={link.to} onClick={closeMobile}>{link.label}</NavLink>
            ))
          ) : (
            <>
              <NavLink to={isHome ? "/#products" : "/#products"} onClick={closeMobile}>Products</NavLink>
              <NavLink to={isHome ? "/#solutions" : "/#solutions"} onClick={closeMobile}>Solutions</NavLink>
              <NavLink to={isHome ? "/#how-it-works" : "/#how-it-works"} onClick={closeMobile}>How It Works</NavLink>
              <NavLink to={"/pricing"} onClick={closeMobile}>Pricing</NavLink>
              <NavDropdown label="Learn" links={PAGE_LINKS} closeMobile={closeMobile} />
            </>
          )}
        </div>

        <div className="nav-actions">
          {sales ? (
            <>
              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE_SALES)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 14px",
                  borderRadius: 20,
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  color: "#166534",
                  fontSize: 13,
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                <MessageCircle size={15} color="#22c55e" />
                <span>Sales Desk</span>
              </a>
              <Link to="/contact" className="btn-nav-outline" style={{ fontSize: 13, padding: "8px 14px" }}>
                List Property
              </Link>
              <Link to="/login" className="btn-nav-primary" style={{ fontSize: 13, padding: "8px 14px" }} title="Staff & Agent Sign In">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
                Portal
              </Link>
            </>
          ) : (
            <>
              <Link to="/contact" className="btn-nav-outline">Contact Us</Link>
              <Link to="/login" className="btn-nav-primary">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
                Log In
              </Link>
            </>
          )}
          <button
            className={`nav-burger${mobileOpen ? " open" : ""}`}
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
          >
            <span /><span /><span />
          </button>
        </div>
      </nav>

      <div className={`mobile-nav${mobileOpen ? " open" : ""}`}>
        {sales ? (
          <>
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE_SALES)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={closeMobile}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 14px",
                borderRadius: 10,
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                color: "#166534",
                fontWeight: 700,
                fontSize: 14,
                marginBottom: 8,
              }}
            >
              <MessageCircle size={18} color="#22c55e" /> WhatsApp Sales Desk
            </a>
            {SALES_NAV_LINKS.map(l => <Link key={l.to} to={l.to} onClick={closeMobile}>{l.label}</Link>)}
            <Link to="/contact" onClick={closeMobile}>List Property / Advisory</Link>
            <Link to="/login" onClick={closeMobile}>Staff & Agent Portal</Link>
          </>
        ) : (
          <>
            <Link to={isHome ? "/#products" : "/"} onClick={closeMobile}>Products</Link>
            <Link to={isHome ? "/#solutions" : "/"} onClick={closeMobile}>Solutions</Link>
            <Link to={isHome ? "/#how-it-works" : "/"} onClick={closeMobile}>How It Works</Link>
            <Link to="/pricing" onClick={closeMobile}>Pricing</Link>
            {PAGE_LINKS.map(l => <Link key={l.to} to={l.to} onClick={closeMobile}>{l.label}</Link>)}
            <Link to="/contact" onClick={closeMobile}>Contact Us</Link>
          </>
        )}
      </div>

      {/* ── Content ────────────────────────────── */}
      <main className="marketing-main">
        {children ?? <Outlet />}
      </main>

      {/* WhatsApp floating widget */}
      <a
        href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(sales ? WHATSAPP_MESSAGE_SALES : WHATSAPP_MESSAGE)}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 100,
          width: 56, height: 56, borderRadius: "50%",
          background: "linear-gradient(140deg, #25D366, #128C7E)",
          display: "grid", placeItems: "center",
          boxShadow: "0 4px 20px rgba(37, 211, 102, 0.4)",
          color: "#fff", transition: "transform 0.15s, box-shadow 0.15s",
        }}
        onMouseOver={e => { e.currentTarget.style.transform = "scale(1.1)"; e.currentTarget.style.boxShadow = "0 6px 28px rgba(37, 211, 102, 0.5)"; }}
        onMouseOut={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(37, 211, 102, 0.4)"; }}
        title="Chat with us on WhatsApp"
      >
        <MessageCircle size={26} />
      </a>

      {/* ── Footer ─────────────────────────────── */}
      <footer className="marketing-footer">
        <div className="footer-inner">
          <div className="footer-top">
            <div className="footer-brand-col">
              <div className="footer-logo-row">
                <span className="footer-logo-mark">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                </span>
                <span className="footer-wordmark">{sales ? "Center Estates" : <>CeEst <span>ERP</span></>}</span>
              </div>
              <div className="footer-tagline">
                {sales
                  ? "Verified homes, land and commercial property across Kenya."
                  : "One connected platform for property, facilities, construction, sales, tenders and valuation"}
              </div>
            </div>
            <div className="footer-links">
              {sales ? (
                SALES_FOOTER_LINKS.map((link) => <Link key={link.to} to={link.to}>{link.label}</Link>)
              ) : (
                <>
                  <Link to="/#products">Products</Link>
                  <Link to="/#solutions">Solutions</Link>
                  <Link to="/#how-it-works">How It Works</Link>
                  <Link to="/login">Sign In</Link>
                  <Link to="/contact">Contact</Link>
                </>
              )}
            </div>
          </div>
          <div className="footer-bottom">
            <span>&copy; {new Date().getFullYear()} {sales ? "Center Estates" : "CeEst ERP"}. All rights reserved.</span>
            <span>{sales ? "Find it. Enquire. Own it." : "Connected operations. Clear accountability."}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
