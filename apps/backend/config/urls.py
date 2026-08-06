"""
URL configuration for Center Estates ERP backend.
Exposes REST endpoints and serves the bespoke single-page web app for marketing, login, and registration.
"""
import os
from django.contrib import admin
from django.urls import include, path, re_path
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.middleware.csrf import get_token
from django.views.static import serve
from django.conf import settings
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

# ---------------------------------------------------------------------------
# Shared HTML shell (nav + footer + base styles)
# ---------------------------------------------------------------------------

_BASE_HEAD = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <!-- ═══ PRIMARY SEO ═══════════════════════════════════════════════════════ -->
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">
  <meta name="googlebot" content="index, follow">
  <link rel="canonical" href="https://monitoringerp.com/">
  <meta name="theme-color" content="#6366f1">
  <meta name="color-scheme" content="dark">

  <!-- ═══ FAVICON & APP ICONS ══════════════════════════════════════════════ -->
  <link rel="icon" type="image/x-icon" href="/static/images/favicon.ico">
  <link rel="icon" type="image/png" sizes="32x32" href="/static/images/favicon-512.png">
  <link rel="icon" type="image/png" sizes="192x192" href="/static/images/icon-192.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/static/images/apple-touch-icon.png">
  <link rel="manifest" href="/static/manifest.webmanifest">

  <!-- ═══ OPEN GRAPH (Facebook, LinkedIn, WhatsApp preview) ════════════════ -->
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Center Estates ERP">
  <meta property="og:url" content="https://monitoringerp.com/">
  <meta property="og:title" content="Center Estates ERP — Enterprise Real Estate &amp; Asset Platform">
  <meta property="og:description" content="Unified enterprise platform for property portfolio management, facility maintenance, RICS valuations, construction oversight and field staff telemetry. Built for real estate professionals in Africa.">
  <meta property="og:image" content="https://monitoringerp.com/static/images/hero.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:locale" content="en_KE">

  <!-- ═══ TWITTER CARD ══════════════════════════════════════════════════════ -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Center Estates ERP — Enterprise Real Estate Platform">
  <meta name="twitter:description" content="Manage property portfolios, facility maintenance, RICS valuations, construction and field staff — all in one enterprise console.">
  <meta name="twitter:image" content="https://monitoringerp.com/static/images/hero.jpg">

  <!-- ═══ STRUCTURED DATA: Organization Schema ══════════════════════════════ -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Center Estates ERP",
    "url": "https://monitoringerp.com",
    "logo": "https://monitoringerp.com/static/images/favicon-512.png",
    "description": "Enterprise Real Estate and Asset Operations Platform for property management, facility maintenance, valuations, tenders, construction monitoring and field staff telemetry.",
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "KES",
      "description": "Free starter plan available"
    },
    "creator": {
      "@type": "Organization",
      "name": "Center Estates",
      "url": "https://monitoringerp.com"
    },
    "featureList": [
      "Property Portfolio Management",
      "Facility Maintenance & Work Orders",
      "RICS-Compliant Valuations",
      "Tender Management",
      "Construction Monitoring",
      "Field Staff Telemetry",
      "Multi-Tenant Architecture",
      "REST API with OpenAPI Docs"
    ]
  }
  </script>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <!-- ═══ THEME INITIALIZATION (Zero-Flicker) ═══════════════════════════════ -->
  <script>
    (function() {
      const saved = localStorage.getItem('ce_theme');
      const theme = saved ? saved : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      document.documentElement.setAttribute('data-theme', theme);
    })();
  </script>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root, [data-theme="light"] {
      --bg: #f8fafc;
      --surface: #ffffff;
      --surface2: #f1f5f9;
      --border: #e2e8f0;
      --border2: #cbd5e1;
      --text: #0f172a;
      --muted: #475569;
      --faint: #94a3b8;
      --accent: #4f46e5;
      --accent2: #2563eb;
      --accent3: #7c3aed;
      --green: #16a34a;
      --cyan: #0891b2;
      --amber: #d97706;
      --red: #dc2626;
      --radius: 14px;
      --radius-sm: 8px;
      --radius-lg: 20px;
      --shadow: 0 4px 20px -2px rgba(15, 23, 42, 0.06);
      --shadow-lg: 0 20px 40px -8px rgba(15, 23, 42, 0.12);
      --glass-bg: rgba(255, 255, 255, 0.88);
      --glass-bg2: rgba(241, 245, 249, 0.95);
      --modal-bg: rgba(15, 23, 42, 0.45);
      --grid-line: rgba(15, 23, 42, 0.04);
      --badge-accent-bg: rgba(79, 70, 229, 0.1); --badge-accent-text: #4338ca; --badge-accent-border: rgba(79, 70, 229, 0.2);
      --badge-green-bg: rgba(22, 163, 74, 0.1); --badge-green-text: #15803d; --badge-green-border: rgba(22, 163, 74, 0.2);
      --badge-amber-bg: rgba(217, 119, 6, 0.1); --badge-amber-text: #b45309; --badge-amber-border: rgba(217, 119, 6, 0.2);
      --badge-muted-bg: rgba(100, 116, 139, 0.1); --badge-muted-text: #475569; --badge-muted-border: rgba(100, 116, 139, 0.2);
      --alert-error-bg: #fef2f2; --alert-error-border: #fecaca; --alert-error-text: #991b1b;
      --alert-success-bg: #f0fdf4; --alert-success-border: #bbf7d0; --alert-success-text: #166534;
      --alert-info-bg: #eeefff; --alert-info-border: #c7d2fe; --alert-info-text: #3730a3;
      --hero-gradient: radial-gradient(ellipse 80% 60% at 50% -10%, rgba(79,70,229,0.12) 0%, transparent 70%),
                        radial-gradient(ellipse 60% 50% at 80% 50%, rgba(37,99,235,0.08) 0%, transparent 60%),
                        var(--bg);
    }

    [data-theme="dark"] {
      --bg: #060b14;
      --surface: #0d1625;
      --surface2: #121d30;
      --border: rgba(255, 255, 255, 0.09);
      --border2: rgba(255, 255, 255, 0.14);
      --text: #f1f5f9;
      --muted: #94a3b8;
      --faint: #475569;
      --accent: #6366f1;
      --accent2: #3b82f6;
      --accent3: #8b5cf6;
      --green: #22c55e;
      --cyan: #06b6d4;
      --amber: #f59e0b;
      --red: #ef4444;
      --shadow: 0 4px 24px -4px rgba(0, 0, 0, 0.5);
      --shadow-lg: 0 20px 60px -12px rgba(0, 0, 0, 0.7);
      --glass-bg: rgba(13, 22, 37, 0.8);
      --glass-bg2: rgba(18, 29, 48, 0.9);
      --modal-bg: rgba(0, 0, 0, 0.75);
      --grid-line: rgba(255, 255, 255, 0.025);
      --badge-accent-bg: rgba(99, 102, 241, 0.15); --badge-accent-text: #a5b4fc; --badge-accent-border: rgba(99, 102, 241, 0.3);
      --badge-green-bg: rgba(34, 197, 94, 0.15); --badge-green-text: #4ade80; --badge-green-border: rgba(34, 197, 94, 0.3);
      --badge-amber-bg: rgba(245, 158, 11, 0.15); --badge-amber-text: #fcd34d; --badge-amber-border: rgba(245, 158, 11, 0.3);
      --badge-muted-bg: rgba(100, 116, 139, 0.2); --badge-muted-text: #94a3b8; --badge-muted-border: rgba(100, 116, 139, 0.3);
      --alert-error-bg: rgba(239, 68, 68, 0.12); --alert-error-border: rgba(239, 68, 68, 0.3); --alert-error-text: #fca5a5;
      --alert-success-bg: rgba(34, 197, 94, 0.12); --alert-success-border: rgba(34, 197, 94, 0.3); --alert-success-text: #4ade80;
      --alert-info-bg: rgba(99, 102, 241, 0.12); --alert-info-border: rgba(99, 102, 241, 0.3); --alert-info-text: #a5b4fc;
      --hero-gradient: radial-gradient(ellipse 80% 60% at 50% -10%, rgba(99,102,241,0.25) 0%, transparent 70%),
                        radial-gradient(ellipse 60% 50% at 80% 50%, rgba(59,130,246,0.12) 0%, transparent 60%),
                        var(--bg);
    }

    html { scroll-behavior: smooth; }
    body {
      font-family: 'Inter', sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      overflow-x: hidden;
      transition: background-color 0.25s ease, color 0.25s ease;
    }
    /* --- Layout --- */
    .container { max-width: 1280px; margin: 0 auto; padding: 0 24px; }
    .section { padding: 96px 0; }
    .section-sm { padding: 64px 0; }
    /* --- Glassmorphism --- */
    .glass {
      background: var(--glass-bg);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--border);
    }
    .glass2 {
      background: var(--glass-bg2);
      backdrop-filter: blur(24px);
      border: 1px solid var(--border2);
    }
    /* --- Cards --- */
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      transition: border-color 0.25s, transform 0.25s, box-shadow 0.25s;
    }
    .card:hover {
      border-color: rgba(99, 102, 241, 0.4);
      transform: translateY(-3px);
      box-shadow: var(--shadow-lg);
    }
    /* --- Buttons --- */
    .btn {
      display: inline-flex; align-items: center; justify-content: center;
      gap: 8px; padding: 12px 24px; border-radius: var(--radius-sm);
      font-weight: 600; font-size: 0.92rem; cursor: pointer;
      transition: all 0.2s ease; border: none; text-decoration: none;
      white-space: nowrap;
    }
    .btn-primary {
      background: linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%);
      color: white;
      box-shadow: 0 4px 15px rgba(79, 70, 229, 0.3);
    }
    .btn-primary:hover {
      opacity: 0.92; transform: translateY(-1px);
      box-shadow: 0 8px 20px rgba(79, 70, 229, 0.45);
    }
    .btn-secondary {
      background: var(--surface2);
      color: var(--text);
      border: 1px solid var(--border2);
    }
    .btn-secondary:hover {
      background: var(--border);
      border-color: var(--border2);
    }
    .btn-outline {
      background: transparent;
      color: var(--accent);
      border: 1px solid var(--accent);
    }
    .btn-outline:hover {
      background: var(--badge-accent-bg);
      border-color: var(--accent);
    }
    .btn-sm { padding: 8px 16px; font-size: 0.82rem; }
    .btn-lg { padding: 16px 32px; font-size: 1.05rem; border-radius: 10px; }
    .btn-full { width: 100%; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; }
    /* --- Badges --- */
    .badge {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 4px 12px; border-radius: 20px;
      font-size: 0.7rem; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.06em;
    }
    .badge-accent { background: var(--badge-accent-bg); color: var(--badge-accent-text); border: 1px solid var(--badge-accent-border); }
    .badge-green  { background: var(--badge-green-bg);  color: var(--badge-green-text);  border: 1px solid var(--badge-green-border); }
    .badge-amber  { background: var(--badge-amber-bg);  color: var(--badge-amber-text);  border: 1px solid var(--badge-amber-border); }
    .badge-muted  { background: var(--badge-muted-bg);  color: var(--badge-muted-text);  border: 1px solid var(--badge-muted-border); }
    /* --- Forms --- */
    .form-group { margin-bottom: 20px; }
    .form-label { display: block; font-size: 0.82rem; font-weight: 600; color: var(--text); margin-bottom: 7px; }
    .form-input {
      width: 100%; padding: 12px 16px;
      background: var(--surface2);
      border: 1px solid var(--border2);
      border-radius: var(--radius-sm);
      color: var(--text); font-size: 0.9rem; font-family: 'Inter', sans-serif;
      transition: border-color 0.2s, box-shadow 0.2s;
      outline: none;
    }
    .form-input:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15);
    }
    .form-input::placeholder { color: var(--faint); }
    .form-input-wrap { position: relative; }
    .form-input-icon { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); }
    .form-hint { font-size: 0.78rem; color: var(--muted); margin-top: 5px; }
    .form-error { font-size: 0.8rem; color: var(--red); margin-top: 5px; }
    /* --- Alerts --- */
    .alert {
      padding: 12px 16px; border-radius: var(--radius-sm);
      font-size: 0.85rem; display: flex; align-items: center; gap: 10px;
      margin-bottom: 20px;
    }
    .alert-error   { background: var(--alert-error-bg);   border: 1px solid var(--alert-error-border);   color: var(--alert-error-text); }
    .alert-success { background: var(--alert-success-bg); border: 1px solid var(--alert-success-border); color: var(--alert-success-text); }
    .alert-info    { background: var(--alert-info-bg);    border: 1px solid var(--alert-info-border);    color: var(--alert-info-text); }
    /* --- Navbar --- */
    #navbar {
      position: sticky; top: 0; z-index: 100;
      padding: 0 32px; height: 68px;
      display: flex; align-items: center; justify-content: space-between;
    }
    .nav-logo { display: flex; align-items: center; gap: 12px; cursor: pointer; text-decoration: none; }
    .nav-logo-icon {
      width: 38px; height: 38px; border-radius: 9px;
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-weight: 900; font-family: 'Outfit'; font-size: 1.1rem;
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.35);
      flex-shrink: 0;
    }
    .nav-links { display: flex; align-items: center; gap: 32px; }
    .nav-link {
      color: var(--muted); text-decoration: none; font-size: 0.88rem; font-weight: 500;
      transition: color 0.2s; cursor: pointer; background: none; border: none;
    }
    .nav-link:hover, .nav-link.active { color: var(--text); }
    .nav-actions { display: flex; align-items: center; gap: 12px; }
    /* --- Hero gradient --- */
    .hero-bg { background: var(--hero-gradient); }
    /* --- Glow orbs --- */
    .orb {
      position: absolute; border-radius: 50%; filter: blur(80px); pointer-events: none;
    }
    /* --- Grid patterns --- */
    .grid-bg {
      background-image: linear-gradient(var(--grid-line) 1px, transparent 1px),
                        linear-gradient(90deg, var(--grid-line) 1px, transparent 1px);
      background-size: 60px 60px;
    }
    /* --- Stats --- */
    .stat-value { font-family: 'Outfit'; font-size: 2.5rem; font-weight: 800; line-height: 1; }
    .stat-label { font-size: 0.85rem; color: var(--muted); margin-top: 4px; }
    /* --- Divider --- */
    .divider { border: none; border-top: 1px solid var(--border); margin: 0; }
    /* --- Persona chips --- */
    .persona-chip {
      background: rgba(30,41,59,0.7); border: 1px solid var(--border2);
      border-radius: var(--radius-sm); padding: 7px 13px;
      font-size: 0.78rem; cursor: pointer; transition: all 0.2s; color: #cbd5e1;
      white-space: nowrap;
    }
    .persona-chip:hover { background: rgba(99,102,241,0.2); border-color: var(--accent); color: #fff; }
    /* --- Modal --- */
    .modal-overlay {
      position: fixed; inset: 0;
      background: rgba(6,11,20,0.88); backdrop-filter: blur(14px);
      z-index: 200; display: flex; align-items: center; justify-content: center;
      opacity: 0; pointer-events: none; transition: opacity 0.25s ease; padding: 20px;
    }
    .modal-overlay.active { opacity: 1; pointer-events: auto; }
    .modal-box {
      background: var(--surface); border: 1px solid var(--border2);
      border-radius: var(--radius-lg); overflow: hidden;
      box-shadow: var(--shadow-lg);
      transform: scale(0.96); transition: transform 0.25s ease;
      width: 100%; max-width: 1000px;
    }
    .modal-overlay.active .modal-box { transform: scale(1); }
    .modal-close {
      position: absolute; top: 18px; right: 18px;
      background: rgba(255,255,255,0.08); border: 1px solid var(--border);
      border-radius: 6px; color: var(--muted); cursor: pointer;
      font-size: 1rem; padding: 5px 9px; transition: all 0.2s;
    }
    .modal-close:hover { background: rgba(255,255,255,0.14); color: var(--text); }
    /* --- Split layout --- */
    .split { display: flex; }
    .split-left { flex: 1.1; }
    .split-right { flex: 1; }
    /* --- Gradient text --- */
    .grad-text {
      background: linear-gradient(135deg, #e0e7ff 0%, #818cf8 50%, #60a5fa 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    /* --- View switching --- */
    .view { display: none; }
    .view.active { display: block; }
    /* --- Spinner --- */
    .spinner {
      width: 18px; height: 18px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #fff; border-radius: 50%;
      animation: spin 0.6s linear infinite; flex-shrink: 0;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    /* --- Feature icon box --- */
    .feat-icon {
      width: 52px; height: 52px; border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.5rem; margin-bottom: 18px;
    }
    /* --- Checkbox --- */
    .checkbox-row { display: flex; align-items: flex-start; gap: 10px; }
    .checkbox-row input[type=checkbox] { margin-top: 2px; accent-color: var(--accent); width: 16px; height: 16px; flex-shrink: 0; }
    /* --- Responsive --- */
    @media (max-width: 768px) {
      #navbar { padding: 0 16px; }
      .nav-links { display: none; }
      .split { flex-direction: column; }
      .split-left { display: none; }
      .section { padding: 64px 0; }
    }
    /* --- Animations --- */
    @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    .fade-up { animation: fadeUp 0.6s ease forwards; }
    @keyframes pulse-glow { 0%,100% { box-shadow: 0 0 20px rgba(99,102,241,0.3); } 50% { box-shadow: 0 0 40px rgba(99,102,241,0.6); } }
    .pulse-glow { animation: pulse-glow 3s ease-in-out infinite; }
    /* --- Pricing --- */
    .price-card { padding: 36px 32px; }
    .price-card.featured { border-color: rgba(99,102,241,0.5); background: rgba(99,102,241,0.06); }
    .price-amount { font-family: 'Outfit'; font-size: 3rem; font-weight: 900; }
    /* --- Timeline --- */
    .timeline-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--accent); flex-shrink: 0; margin-top: 5px; }
    /* --- Scroll indicator --- */
    .scroll-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--border2); cursor: pointer; transition: background 0.2s; }
    .scroll-dot.active { background: var(--accent); width: 20px; border-radius: 3px; }
  </style>
</head>
<body>"""

_NAVBAR = """
  <!-- ========== NAVBAR ========== -->
  <nav id="navbar" class="glass">
    <a class="nav-logo" onclick="showView('home')" href="javascript:void(0)">
      <div class="nav-logo-icon">CE</div>
      <div>
        <div style="font-family:'Outfit';font-weight:800;font-size:1.05rem;letter-spacing:-0.02em">Center Estates</div>
        <div style="font-size:0.68rem;color:var(--muted);font-weight:600;margin-top:-1px">Enterprise ERP Platform</div>
      </div>
    </a>
    <div class="nav-links">
      <button class="nav-link" onclick="showView('console')" id="nl-console" style="display:none;color:var(--accent);font-weight:700">Command Center</button>
      <button class="nav-link" onclick="showView('home')" id="nl-home">Overview</button>
      <button class="nav-link" onclick="showView('modules')" id="nl-modules">Modules</button>
      <button class="nav-link" onclick="showView('pricing')" id="nl-pricing">Pricing</button>
      <button class="nav-link" onclick="showView('about')" id="nl-about">About</button>
      <button class="nav-link" onclick="showView('contact')" id="nl-contact">Contact</button>
      <a href="/api/v1/docs/" target="_blank" class="nav-link" style="color:var(--cyan)">API Docs ↗</a>
    </div>
    <div class="nav-actions" id="nav-actions">
      <button onclick="toggleTheme()" id="theme-toggle-btn" class="btn btn-secondary btn-sm" title="Switch Theme">☀️ Light</button>
      <button class="btn btn-secondary btn-sm" onclick="openModal('login-modal')">Sign In</button>
      <button class="btn btn-primary btn-sm" onclick="openModal('register-modal')">Get Started</button>
    </div>
  </nav>

  <!-- ========== ACTIVE SESSION BANNER ========== -->
  <div id="session-banner" style="display:none;background:var(--surface2);border-bottom:1px solid var(--border);padding:10px 0;font-size:0.83rem">
    <div class="container" style="display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--green)"></span>
        <span>Active Session: <strong id="sb-user">...</strong></span>
        <span class="badge badge-accent" id="sb-org">Center Estates Demo</span>
      </div>
      <div style="display:flex;gap:12px;align-items:center">
        <a href="/api/v1/docs/" target="_blank" style="color:var(--cyan);text-decoration:none;font-weight:600">Swagger API Console ↗</a>
        <a href="/admin/" id="sb-admin-link" target="_blank" style="color:var(--amber);text-decoration:none;font-weight:600;display:none">Django Admin ↗</a>
        <button onclick="handleLogout()" style="background:none;border:1px solid var(--border);color:var(--muted);padding:4px 12px;border-radius:6px;cursor:pointer">Sign Out</button>
      </div>
    </div>
  </div>"""


_FOOTER = """
  <!-- ========== FOOTER ========== -->
  <footer style="margin-top:auto;border-top:1px solid var(--border);padding:40px 0">
    <div class="container" style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:40px">
      <div>
        <div class="nav-logo" style="margin-bottom:16px">
          <div class="nav-logo-icon">CE</div>
          <div>
            <div style="font-family:'Outfit';font-weight:800;font-size:1rem">Center Estates</div>
            <div style="font-size:0.7rem;color:var(--muted)">Enterprise Real Estate Platform</div>
          </div>
        </div>
        <p style="font-size:0.82rem;color:var(--muted);line-height:1.7;max-width:300px">
          Unified enterprise-grade platform for property portfolio management, facility maintenance, RICS valuations, and construction oversight.
        </p>
        <div style="margin-top:16px;display:flex;gap:10px">
          <span class="badge badge-green">v2.4.0</span>
          <span class="badge badge-accent">ISO 27001</span>
        </div>
      </div>
      <div>
        <div style="font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--faint);margin-bottom:16px">Platform</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          <button onclick="showView('home')" class="nav-link" style="text-align:left;font-size:0.85rem">Overview</button>
          <button onclick="showView('modules')" class="nav-link" style="text-align:left;font-size:0.85rem">Modules</button>
          <button onclick="showView('pricing')" class="nav-link" style="text-align:left;font-size:0.85rem">Pricing</button>
          <a href="/api/v1/docs/" target="_blank" class="nav-link" style="font-size:0.85rem">API Reference</a>
        </div>
      </div>
      <div>
        <div style="font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--faint);margin-bottom:16px">Company</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          <button onclick="showView('about')" class="nav-link" style="text-align:left;font-size:0.85rem">About Us</button>
          <button onclick="showView('contact')" class="nav-link" style="text-align:left;font-size:0.85rem">Contact</button>
          <a href="mailto:support@monitoringerp.com" class="nav-link" style="font-size:0.85rem">Support</a>
        </div>
      </div>
      <div>
        <div style="font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--faint);margin-bottom:16px">Account</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          <button onclick="openModal('login-modal')" class="nav-link" style="text-align:left;font-size:0.85rem">Sign In</button>
          <button onclick="openModal('register-modal')" class="nav-link" style="text-align:left;font-size:0.85rem">Register</button>
          <button onclick="openModal('forgot-modal')" class="nav-link" style="text-align:left;font-size:0.85rem">Forgot Password</button>
        </div>
      </div>
    </div>
    <div class="container" style="margin-top:32px;padding-top:24px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap">
      <span style="font-size:0.78rem;color:var(--faint)">&copy; 2026 Center Estates ERP. All rights reserved.</span>
      <span style="font-size:0.78rem;color:var(--faint)">Crafted for enterprise real estate operations.</span>
    </div>
  </footer>"""

_MODALS = """
  <!-- ========== LOGIN MODAL ========== -->
  <div id="login-modal" class="modal-overlay" onclick="handleOverlayClick(event,'login-modal')">
    <div class="modal-box split" style="max-width:920px">
      <!-- Left panel -->
      <div class="split-left" style="background:url('/static/images/facility.jpg') center/cover no-repeat;position:relative;padding:44px;display:flex;flex-direction:column;justify-content:space-between">
        <div style="position:absolute;inset:0;background:linear-gradient(135deg,rgba(6,11,20,0.92) 0%,rgba(30,27,75,0.88) 100%)"></div>
        <div style="position:relative;z-index:2">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">
            <div class="nav-logo-icon" style="width:32px;height:32px;font-size:0.95rem">CE</div>
            <strong style="font-family:'Outfit';font-size:1rem;color:#fff">Center Estates</strong>
          </div>
          <span class="badge badge-accent" style="margin-bottom:18px;display:inline-flex">Enterprise Access Gateway</span>
          <h2 style="font-family:'Outfit';font-size:1.9rem;font-weight:800;color:#fff;line-height:1.2;margin-bottom:12px">Welcome Back</h2>
          <p style="color:var(--muted);font-size:0.88rem;line-height:1.6">Sign in with your organisation credentials to access your module workspace.</p>
        </div>
        <div style="position:relative;z-index:2">
          <div style="font-size:0.72rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px">Quick Demo Fill</div>
          <div style="display:flex;flex-wrap:wrap;gap:7px">
            <button class="persona-chip" onclick="fillLogin('admin')">&#128081; Admin</button>
            <button class="persona-chip" onclick="fillLogin('role-property-manager')">&#127962; Property Mgr</button>
            <button class="persona-chip" onclick="fillLogin('role-facility-inspector')">&#128296; Facility</button>
            <button class="persona-chip" onclick="fillLogin('role-valuation-reviewer')">&#128202; Valuer</button>
            <button class="persona-chip" onclick="fillLogin('role-companion-operator')">&#128241; Field Staff</button>
            <button class="persona-chip" onclick="fillLogin('role-tender-evaluator')">&#128203; Tender</button>
          </div>
          <p style="font-size:0.7rem;color:var(--faint);margin-top:10px">Demo password: <code style="background:rgba(255,255,255,0.07);padding:2px 6px;border-radius:4px;color:#a5b4fc">admin123</code></p>
        </div>
      </div>
      <!-- Right panel -->
      <div class="split-right" style="padding:44px;display:flex;flex-direction:column;justify-content:center;position:relative;background:var(--surface2)">
        <button class="modal-close" onclick="closeModal('login-modal')">&#10005;</button>
        <h3 style="font-family:'Outfit';font-size:1.6rem;font-weight:800;margin-bottom:6px">Sign In</h3>
        <p style="color:var(--muted);font-size:0.85rem;margin-bottom:28px">Enter your credentials to continue</p>
        <div id="login-alert" class="alert alert-error" style="display:none"></div>
        <form id="login-form" onsubmit="handleLogin(event)">
          <div class="form-group">
            <label class="form-label">Username</label>
            <input class="form-input" type="text" id="l-username" required placeholder="Username or email" autocomplete="username">
          </div>
          <div class="form-group">
            <label class="form-label">Password</label>
            <div class="form-input-wrap">
              <input class="form-input" type="password" id="l-password" required placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;" autocomplete="current-password" style="padding-right:44px">
              <button type="button" class="form-input-icon" onclick="togglePwd('l-password',this)" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:0.9rem">&#128065;</button>
            </div>
          </div>
          <div style="display:flex;justify-content:flex-end;margin-bottom:24px">
            <button type="button" onclick="closeModal('login-modal');openModal('forgot-modal')" style="background:none;border:none;color:var(--accent);font-size:0.82rem;cursor:pointer;font-weight:600">Forgot password?</button>
          </div>
          <button type="submit" id="login-btn" class="btn btn-primary btn-full btn-lg">
            <span id="login-btn-text">Sign In to Platform</span>
          </button>
        </form>
        <p style="text-align:center;font-size:0.83rem;color:var(--muted);margin-top:24px">
          Don't have an account?
          <button onclick="closeModal('login-modal');openModal('register-modal')" style="background:none;border:none;color:var(--accent);cursor:pointer;font-weight:600">Register here</button>
        </p>
      </div>
    </div>
  </div>

  <!-- ========== REGISTER MODAL ========== -->
  <div id="register-modal" class="modal-overlay" onclick="handleOverlayClick(event,'register-modal')">
    <div class="modal-box" style="max-width:560px;padding:44px;background:var(--surface2);position:relative">
      <button class="modal-close" onclick="closeModal('register-modal')">&#10005;</button>
      <div style="text-align:center;margin-bottom:28px">
        <div class="nav-logo-icon" style="margin:0 auto 14px;width:44px;height:44px;font-size:1.2rem">CE</div>
        <h2 style="font-family:'Outfit';font-size:1.7rem;font-weight:800;margin-bottom:6px">Create Account</h2>
        <p style="color:var(--muted);font-size:0.85rem">Set up your Center Estates ERP access</p>
      </div>
      <div id="register-alert" class="alert alert-error" style="display:none"></div>
      <div id="register-success" class="alert alert-success" style="display:none"></div>
      <form id="register-form" onsubmit="handleRegister(event)">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div class="form-group">
            <label class="form-label">First Name</label>
            <input class="form-input" type="text" id="r-first" required placeholder="First name" autocomplete="given-name">
          </div>
          <div class="form-group">
            <label class="form-label">Last Name</label>
            <input class="form-input" type="text" id="r-last" required placeholder="Last name" autocomplete="family-name">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Email Address</label>
          <input class="form-input" type="email" id="r-email" required placeholder="you@company.com" autocomplete="email">
        </div>
        <div class="form-group">
          <label class="form-label">Username</label>
          <input class="form-input" type="text" id="r-username" required placeholder="Choose a username" autocomplete="username">
        </div>
        <div class="form-group">
          <label class="form-label">Password</label>
          <div class="form-input-wrap">
            <input class="form-input" type="password" id="r-password" required placeholder="Min. 12 characters" autocomplete="new-password" style="padding-right:44px" oninput="checkPwdStrength(this.value)">
            <button type="button" class="form-input-icon" onclick="togglePwd('r-password',this)" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:0.9rem">&#128065;</button>
          </div>
          <div id="pwd-strength" style="margin-top:8px;display:flex;gap:4px">
            <div class="pwd-bar" style="height:3px;flex:1;border-radius:2px;background:var(--border)"></div>
            <div class="pwd-bar" style="height:3px;flex:1;border-radius:2px;background:var(--border)"></div>
            <div class="pwd-bar" style="height:3px;flex:1;border-radius:2px;background:var(--border)"></div>
            <div class="pwd-bar" style="height:3px;flex:1;border-radius:2px;background:var(--border)"></div>
          </div>
          <p class="form-hint">Use 12+ characters with uppercase, numbers and symbols.</p>
        </div>
        <div class="form-group">
          <label class="form-label">Organisation Name <span style="color:var(--faint)">(optional)</span></label>
          <input class="form-input" type="text" id="r-org" placeholder="Your company / organization">
        </div>
        <div class="checkbox-row form-group">
          <input type="checkbox" id="r-terms" required>
          <label for="r-terms" style="font-size:0.82rem;color:var(--muted)">
            I agree to the <a href="#" style="color:var(--accent)">Terms of Service</a> and <a href="#" style="color:var(--accent)">Privacy Policy</a>
          </label>
        </div>
        <button type="submit" id="register-btn" class="btn btn-primary btn-full" style="padding:14px">
          <span id="register-btn-text">Create Account</span>
        </button>
      </form>
      <p style="text-align:center;font-size:0.83rem;color:var(--muted);margin-top:20px">
        Already have an account?
        <button onclick="closeModal('register-modal');openModal('login-modal')" style="background:none;border:none;color:var(--accent);cursor:pointer;font-weight:600">Sign in</button>
      </p>
    </div>
  </div>

  <!-- ========== FORGOT PASSWORD MODAL ========== -->
  <div id="forgot-modal" class="modal-overlay" onclick="handleOverlayClick(event,'forgot-modal')">
    <div class="modal-box" style="max-width:440px;padding:44px;background:var(--surface2);position:relative">
      <button class="modal-close" onclick="closeModal('forgot-modal')">&#10005;</button>
      <div style="text-align:center;margin-bottom:28px">
        <div style="font-size:2.5rem;margin-bottom:12px">&#128272;</div>
        <h2 style="font-family:'Outfit';font-size:1.6rem;font-weight:800;margin-bottom:6px">Reset Password</h2>
        <p style="color:var(--muted);font-size:0.85rem">Enter your email and we'll send reset instructions</p>
      </div>
      <div id="forgot-alert" class="alert" style="display:none"></div>
      <form id="forgot-form" onsubmit="handleForgot(event)">
        <div class="form-group">
          <label class="form-label">Email Address</label>
          <input class="form-input" type="email" id="f-email" required placeholder="you@company.com" autocomplete="email">
        </div>
        <button type="submit" id="forgot-btn" class="btn btn-primary btn-full" style="padding:14px">
          <span id="forgot-btn-text">Send Reset Link</span>
        </button>
      </form>
      <p style="text-align:center;font-size:0.83rem;color:var(--muted);margin-top:20px">
        Remembered it?
        <button onclick="closeModal('forgot-modal');openModal('login-modal')" style="background:none;border:none;color:var(--accent);cursor:pointer;font-weight:600">Back to login</button>
      </p>
    </div>
  </div>

  <!-- ========== DATA INSPECTOR MODAL ========== -->
  <div id="data-modal" class="modal-overlay" onclick="handleOverlayClick(event,'data-modal')">
    <div class="modal-box" style="max-width:760px;padding:36px;background:var(--surface2);position:relative">
      <button class="modal-close" onclick="closeModal('data-modal')">&#10005;</button>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
        <div style="font-size:1.6rem" id="dm-icon">&#128187;</div>
        <div>
          <h2 style="font-family:'Outfit';font-size:1.5rem;font-weight:800" id="dm-title">Module Data Inspector</h2>
          <span class="badge badge-accent" id="dm-endpoint">/api/v1/property/properties/</span>
        </div>
      </div>
      <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:16px;max-height:400px;overflow-y:auto;font-family:monospace;font-size:0.82rem;color:var(--cyan)" id="dm-content">
        Loading API response...
      </div>
      <div style="display:flex;justify-content:flex-end;margin-top:20px">
        <button class="btn btn-secondary btn-sm" onclick="closeModal('data-modal')">Close Inspector</button>
      </div>
    </div>
  </div>"""


_SCRIPTS = """
  <script>
    // ─── Modal helpers ───────────────────────────────────────────────────────
    function openModal(id) {
      document.getElementById(id).classList.add('active');
      document.body.style.overflow = 'hidden';
    }
    function closeModal(id) {
      document.getElementById(id).classList.remove('active');
      document.body.style.overflow = '';
    }
    function handleOverlayClick(e, id) {
      if (e.target.id === id) closeModal(id);
    }
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        ['login-modal','register-modal','forgot-modal','data-modal'].forEach(closeModal);
      }
    });

    // ─── View switching ──────────────────────────────────────────────────────
    const VIEWS = ['home','console','workspace','property','facility','sales','tender','valuation','construction','companion','modules','pricing','about','contact'];
    const VIEW_SEO = {
      home:         { title: 'Center Estates ERP — Enterprise Real Estate & Asset Platform', desc: 'Unified enterprise platform for property management, facility maintenance, RICS valuations, construction monitoring and field staff telemetry.' },
      console:      { title: 'Command Center Console — Center Estates ERP', desc: 'Unified enterprise operations dashboard across all 7 platform modules.' },
      workspace:    { title: 'Workspace Switcher & Persona Desk — Center Estates ERP', desc: 'Manage multi-tenant organization workspaces and switch demo role personas.' },
      property:     { title: 'Property & Lease Portfolio Workspace — Center Estates ERP', desc: 'Manage properties, buildings, units, tenant leases, billing invoices and service charges.' },
      facility:     { title: 'Facility Maintenance & Work Orders Workspace — Center Estates ERP', desc: 'Track asset registers, work order tickets, SLA enforcement, and contractor dispatch.' },
      sales:        { title: 'Off-Plan Sales & Buyer Workspace — Center Estates ERP', desc: 'Manage unit inventory listings, buyer directory, reservation agreements, and payment schedules.' },
      tender:       { title: 'Tender Procurement Desk — Center Estates ERP', desc: 'Issue procurement tenders, receive proposals, review financial bids, and track board awards.' },
      valuation:    { title: 'RICS Valuation Workbench — Center Estates ERP', desc: 'Process valuation instructions, site inspection checklists, comparable evidence, and signed report certificates.' },
      construction: { title: 'Construction Oversight & S-Curve Workspace — Center Estates ERP', desc: 'Monitor site progress, S-curve drawdowns, milestone verification, BOQ items, and daily site logs.' },
      companion:    { title: 'Field Staff Telemetry Workspace — Center Estates ERP', desc: 'Assign field task templates, receive GPS telemetry, monitor staff performance scores, and track field check-ins.' },
      modules:      { title: 'Platform Modules — Center Estates ERP', desc: 'Explore all 7 enterprise modules: Property Management, Facility, Valuations, Tenders, Construction Monitoring, Sales & Staff Companion.' },
      pricing:      { title: 'Pricing Plans — Center Estates ERP', desc: 'Transparent, module-based pricing for real estate enterprises in Africa. Starter, Professional and Enterprise plans available.' },
      about:        { title: 'About Center Estates ERP — Our Story', desc: 'Built for real estate professionals in Kenya and Africa. Learn about our mission, team and values.' },
      contact:      { title: 'Contact Center Estates ERP — Get in Touch', desc: 'Reach the Center Estates team for demos, pricing inquiries or technical support.' },
    };

    function showView(name) {
      VIEWS.forEach(v => {
        const el = document.getElementById('view-' + v);
        if (el) el.classList.toggle('active', v === name);
      });
      VIEWS.forEach(v => {
        const nl = document.getElementById('nl-' + v);
        if (nl) nl.classList.toggle('active', v === name);
      });
      const topNav = document.getElementById('navbar');
      const isAppView = ['console','workspace','property','facility','sales','tender','valuation','construction','companion'].includes(name);
      if (topNav) topNav.style.display = isAppView ? 'none' : 'flex';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      const path = name === 'home' ? '/' : '/' + name;
      history.pushState({ view: name }, '', path);
      const seo = VIEW_SEO[name] || VIEW_SEO.home;
      document.title = seo.title;
      const descEl = document.querySelector('meta[name="description"]');
      if (descEl) descEl.setAttribute('content', seo.desc);
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) ogTitle.setAttribute('content', seo.title);
      const ogDesc = document.querySelector('meta[property="og:description"]');
      if (ogDesc) ogDesc.setAttribute('content', seo.desc);
      const ogUrl = document.querySelector('meta[property="og:url"]');
      if (ogUrl) ogUrl.setAttribute('content', 'https://monitoringerp.com' + path);
      const canonical = document.querySelector('link[rel="canonical"]');
      if (canonical) canonical.setAttribute('href', 'https://monitoringerp.com' + path);
    }

    async function loadModuleWorkspace(moduleKey) {
      showView(moduleKey);
      const container = document.getElementById('mw-content-' + moduleKey);
      if (!container) return;
      container.innerHTML = '<div style="padding:40px;color:var(--muted)"><div class="spinner" style="border-color:var(--accent);display:inline-block;margin-right:10px"></div> Loading ' + moduleKey + ' module records...</div>';
      
      const endpoints = {
        property: '/api/v1/property/properties/',
        facility: '/api/v1/facility/work-orders/',
        sales: '/api/v1/sales/listings/',
        tender: '/api/v1/tender/tenders/',
        valuation: '/api/v1/valuation/instructions/',
        construction: '/api/v1/construction/projects/',
        companion: '/api/v1/companion/tasks/'
      };

      const url = endpoints[moduleKey];
      if (!url) return;

      try {
        const resp = await fetch(url, { credentials: 'same-origin' });
        if (!resp.ok) {
          container.innerHTML = '<div class="alert alert-error">Access denied or endpoint error (' + resp.status + '). Sign in with a role that has ' + moduleKey + ' module permissions.</div>';
          return;
        }
        const data = await resp.json();
        const items = Array.isArray(data) ? data : (data.results || []);
        renderModuleTable(moduleKey, items, container);
      } catch (err) {
        container.innerHTML = '<div class="alert alert-error">Network error: ' + err.message + '</div>';
      }
    }

    function renderModuleTable(moduleKey, items, container) {
      if (!items || items.length === 0) {
        container.innerHTML = `<div style="padding:40px;text-align:center;color:var(--muted)">No records found in this workspace yet.<br><br><button onclick="loadModuleData('${moduleKey}')" class="btn btn-secondary btn-sm">Inspect Raw API ↗</button></div>`;
        return;
      }

      let cols = [];
      let rowFn = item => '';

      if (moduleKey === 'property') {
        cols = ['Property Name', 'Code', 'Category', 'City / Location', 'Units', 'Status', 'Actions'];
        rowFn = item => `
          <tr style="border-bottom:1px solid var(--border)">
            <td style="padding:12px 16px;font-weight:700;color:var(--text)">${item.name || 'Unnamed Property'}</td>
            <td style="padding:12px 16px"><span class="badge badge-accent">${item.code || 'N/A'}</span></td>
            <td style="padding:12px 16px">${item.category || 'Commercial'}</td>
            <td style="padding:12px 16px">${item.city || item.address || 'Nairobi'}</td>
            <td style="padding:12px 16px"><strong>${item.units_count || item.total_units || 0}</strong> units</td>
            <td style="padding:12px 16px"><span class="badge badge-green">${item.is_active !== false ? 'Active' : 'Archived'}</span></td>
            <td style="padding:12px 16px"><button onclick="loadModuleData('property')" class="btn btn-secondary btn-sm" style="padding:4px 8px;font-size:0.75rem">Inspect Data ↗</button></td>
          </tr>`;
      } else if (moduleKey === 'facility') {
        cols = ['Work Order #', 'Title / Asset', 'Category', 'Priority', 'Status', 'Cost (KES)', 'Actions'];
        rowFn = item => `
          <tr style="border-bottom:1px solid var(--border)">
            <td style="padding:12px 16px"><span class="badge badge-accent">${item.number || 'WO-REC'}</span></td>
            <td style="padding:12px 16px;font-weight:700;color:var(--text)">${item.title || 'Work Order'}<br><small style="color:var(--muted)">${item.asset_name || ''}</small></td>
            <td style="padding:12px 16px">${item.category || 'General'}</td>
            <td style="padding:12px 16px"><span class="badge ${item.priority === 'critical' ? 'badge-amber' : 'badge-accent'}">${(item.priority || 'medium').toUpperCase()}</span></td>
            <td style="padding:12px 16px"><span class="badge badge-green">${(item.status || 'in_progress').toUpperCase()}</span></td>
            <td style="padding:12px 16px"><strong>KES ${(item.total_cost || 0).toLocaleString()}</strong></td>
            <td style="padding:12px 16px"><button onclick="loadModuleData('facility')" class="btn btn-secondary btn-sm" style="padding:4px 8px;font-size:0.75rem">Inspect Data ↗</button></td>
          </tr>`;
      } else if (moduleKey === 'sales') {
        cols = ['Listing Title', 'Unit #', 'Asking Price (KES)', 'Status', 'Buyer', 'Commission', 'Actions'];
        rowFn = item => `
          <tr style="border-bottom:1px solid var(--border)">
            <td style="padding:12px 16px;font-weight:700;color:var(--text)">${item.title || item.property_name || 'Unit Listing'}</td>
            <td style="padding:12px 16px"><span class="badge badge-accent">${item.unit_number || 'U-101'}</span></td>
            <td style="padding:12px 16px"><strong style="color:var(--green)">KES ${(item.asking_price || item.price || 0).toLocaleString()}</strong></td>
            <td style="padding:12px 16px"><span class="badge badge-cyan">${(item.status || 'available').toUpperCase()}</span></td>
            <td style="padding:12px 16px">${item.buyer_name || 'Available'}</td>
            <td style="padding:12px 16px">${item.commission_rate || '2.5'}%</td>
            <td style="padding:12px 16px"><button onclick="loadModuleData('sales')" class="btn btn-secondary btn-sm" style="padding:4px 8px;font-size:0.75rem">Inspect Data ↗</button></td>
          </tr>`;
      } else if (moduleKey === 'tender') {
        cols = ['Ref #', 'Tender Title', 'Category', 'Estimated Budget', 'Proposals', 'Status', 'Actions'];
        rowFn = item => `
          <tr style="border-bottom:1px solid var(--border)">
            <td style="padding:12px 16px"><span class="badge badge-accent">${item.reference_number || 'TND-01'}</span></td>
            <td style="padding:12px 16px;font-weight:700;color:var(--text)">${item.title || 'Procurement Tender'}</td>
            <td style="padding:12px 16px">${item.category || 'Civil Works'}</td>
            <td style="padding:12px 16px"><strong>KES ${(item.estimated_budget || 0).toLocaleString()}</strong></td>
            <td style="padding:12px 16px"><span class="badge badge-green">${item.proposals_count || 0} bids</span></td>
            <td style="padding:12px 16px"><span class="badge badge-amber">${(item.status || 'open').toUpperCase()}</span></td>
            <td style="padding:12px 16px"><button onclick="loadModuleData('tender')" class="btn btn-secondary btn-sm" style="padding:4px 8px;font-size:0.75rem">Inspect Data ↗</button></td>
          </tr>`;
      } else if (moduleKey === 'valuation') {
        cols = ['Instruction #', 'Property Name', 'Client', 'Purpose', 'Market Value (KES)', 'Status', 'Actions'];
        rowFn = item => `
          <tr style="border-bottom:1px solid var(--border)">
            <td style="padding:12px 16px"><span class="badge badge-accent">${item.reference_number || 'VAL-01'}</span></td>
            <td style="padding:12px 16px;font-weight:700;color:var(--text)">${item.property_name || 'Subject Asset'}</td>
            <td style="padding:12px 16px">${item.client_name || 'Client'}</td>
            <td style="padding:12px 16px">${item.purpose || 'Mortgage Security'}</td>
            <td style="padding:12px 16px"><strong style="color:var(--accent)">KES ${(item.market_value || item.capital_value || 0).toLocaleString()}</strong></td>
            <td style="padding:12px 16px"><span class="badge badge-green">${(item.status || 'completed').toUpperCase()}</span></td>
            <td style="padding:12px 16px"><button onclick="loadModuleData('valuation')" class="btn btn-secondary btn-sm" style="padding:4px 8px;font-size:0.75rem">Inspect Data ↗</button></td>
          </tr>`;
      } else if (moduleKey === 'construction') {
        cols = ['Code', 'Project Name', 'Location', 'Physical Progress', 'Financial Drawdown', 'Status', 'Actions'];
        rowFn = item => `
          <tr style="border-bottom:1px solid var(--border)">
            <td style="padding:12px 16px"><span class="badge badge-accent">${item.code || 'P1'}</span></td>
            <td style="padding:12px 16px;font-weight:700;color:var(--text)">${item.name || 'Construction Project'}</td>
            <td style="padding:12px 16px">${item.location || 'Site Location'}</td>
            <td style="padding:12px 16px">
              <div style="display:flex;align-items:center;gap:8px">
                <div style="flex:1;height:8px;background:var(--border);border-radius:4px;overflow:hidden">
                  <div style="width:${item.physical_progress || 45}%;height:100%;background:var(--green)"></div>
                </div>
                <span style="font-size:0.78rem;font-weight:700">${item.physical_progress || 45}%</span>
              </div>
            </td>
            <td style="padding:12px 16px"><strong>${item.financial_progress || 40}%</strong></td>
            <td style="padding:12px 16px"><span class="badge badge-amber">${(item.status || 'in_progress').toUpperCase()}</span></td>
            <td style="padding:12px 16px"><button onclick="loadModuleData('construction')" class="btn btn-secondary btn-sm" style="padding:4px 8px;font-size:0.75rem">Inspect Data ↗</button></td>
          </tr>`;
      } else {
        cols = ['Task Title', 'Assignee', 'Priority', 'Status', 'Check-in Time', 'Actions'];
        rowFn = item => `
          <tr style="border-bottom:1px solid var(--border)">
            <td style="padding:12px 16px;font-weight:700;color:var(--text)">${item.title || 'Field Inspection Task'}</td>
            <td style="padding:12px 16px">${item.assigned_to_name || 'Field Officer'}</td>
            <td style="padding:12px 16px"><span class="badge badge-accent">${(item.priority || 'normal').toUpperCase()}</span></td>
            <td style="padding:12px 16px"><span class="badge badge-green">${(item.status || 'completed').toUpperCase()}</span></td>
            <td style="padding:12px 16px"><small style="color:var(--muted)">${item.updated_at || 'Today'}</small></td>
            <td style="padding:12px 16px"><button onclick="loadModuleData('companion')" class="btn btn-secondary btn-sm" style="padding:4px 8px;font-size:0.75rem">Inspect Data ↗</button></td>
          </tr>`;
      }

      container.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <div><strong style="font-size:0.95rem">${items.length} Records Loaded</strong></div>
          <button onclick="loadModuleData('${moduleKey}')" class="btn btn-secondary btn-sm">Inspect Full API JSON ↗</button>
        </div>
        <div style="overflow-x:auto;border:1px solid var(--border);border-radius:var(--radius-sm)">
          <table style="width:100%;border-collapse:collapse;font-size:0.88rem;text-align:left">
            <thead>
              <tr style="background:var(--surface2);border-bottom:1px solid var(--border)">
                ${cols.map(c => `<th style="padding:12px 16px;font-size:0.78rem;font-weight:700;text-transform:uppercase;color:var(--muted)">${c}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${items.map(rowFn).join('')}
            </tbody>
          </table>
        </div>`;
    }

    // ─── Password helpers ────────────────────────────────────────────────────
    function togglePwd(id, btn) {
      const inp = document.getElementById(id);
      inp.type = inp.type === 'password' ? 'text' : 'password';
      btn.textContent = inp.type === 'password' ? '\\u{1F441}' : '\\u{1F441}\\u{FE0F}\\u{200D}\\u{1F5E8}\\u{FE0F}';
    }
    function fillLogin(u) {
      document.getElementById('l-username').value = u;
      document.getElementById('l-password').value = 'admin123';
      document.getElementById('login-alert').style.display = 'none';
    }
    function checkPwdStrength(val) {
      let score = 0;
      if (val.length >= 12) score++;
      if (/[A-Z]/.test(val)) score++;
      if (/[0-9]/.test(val)) score++;
      if (/[^A-Za-z0-9]/.test(val)) score++;
      const colors = ['#ef4444','#f59e0b','#3b82f6','#22c55e'];
      const bars = document.querySelectorAll('.pwd-bar');
      bars.forEach((b, i) => {
        b.style.background = i < score ? colors[score - 1] : 'var(--border)';
      });
    }

    // ─── Theme Switcher ───────────────────────────────────────────────────────
    function toggleTheme() {
      const cur = document.documentElement.getAttribute('data-theme') || 'light';
      const next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('ce_theme', next);
      updateThemeBtn();
    }
    function updateThemeBtn() {
      const cur = document.documentElement.getAttribute('data-theme') || 'light';
      const btn = document.getElementById('theme-toggle-btn');
      if (btn) {
        btn.innerHTML = cur === 'dark' ? '🌙 Dark' : '☀️ Light';
      }
    }

    // ─── Session State & Command Center ─────────────────────────────────────
    let _sessionData = null;

    async function updateSessionState() {
      try {
        const r = await fetch('/api/v1/auth/me/', { credentials: 'same-origin' });
        if (r.ok) {
          _sessionData = await r.json();
          const user = _sessionData.user;
          const org = _sessionData.organizations?.[0]?.name || 'Center Estates Demo';
          
          const nlConsole = document.getElementById('nl-console');
          if (nlConsole) nlConsole.style.display = 'inline-block';
          
          const sbUser = document.getElementById('sb-user');
          if (sbUser) sbUser.textContent = user.firstName ? `${user.firstName} ${user.lastName} (@${user.username})` : user.username;
          const sbOrg = document.getElementById('sb-org');
          if (sbOrg) sbOrg.textContent = org;
          const sb = document.getElementById('session-banner');
          if (sb) sb.style.display = 'block';
          
          const ccUser = document.getElementById('cc-user-display');
          if (ccUser) ccUser.textContent = user.firstName ? `${user.firstName} ${user.lastName}` : user.username;
          const ccOrg = document.getElementById('cc-org-name');
          if (ccOrg) ccOrg.textContent = org;

          const sideWs = document.getElementById('sidebar-ws-name');
          if (sideWs) sideWs.textContent = org;
          const sideUser = document.getElementById('sidebar-user-name');
          if (sideUser) sideUser.textContent = user.firstName ? `${user.firstName} ${user.lastName}` : user.username;
          const sideAvatar = document.getElementById('sidebar-user-avatar');
          if (sideAvatar) sideAvatar.textContent = (user.username || 'A')[0].toUpperCase();

          if (user.isSuperuser) {
            const adminLink = document.getElementById('sb-admin-link');
            if (adminLink) adminLink.style.display = 'inline-block';
            const ccAdmin = document.getElementById('cc-admin-btn');
            if (ccAdmin) ccAdmin.style.display = 'inline-block';
          }

          const navActions = document.getElementById('nav-actions');
          if (navActions) {
            const initial = (user.username || 'U')[0].toUpperCase();
            const curTheme = document.documentElement.getAttribute('data-theme') || 'light';
            navActions.innerHTML = `
              <div style="display:flex;align-items:center;gap:12px">
                <button onclick="toggleTheme()" id="theme-toggle-btn" class="btn btn-secondary btn-sm" title="Switch Theme">${curTheme === 'dark' ? '🌙 Dark' : '☀️ Light'}</button>
                <button onclick="showView('console')" class="btn btn-primary btn-sm" style="padding:6px 14px">Command Center ↗</button>
                <div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent2));display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.85rem;color:#fff">${initial}</div>
                <div style="display:flex;flex-direction:column;text-align:left">
                  <span style="font-size:0.82rem;font-weight:700;line-height:1.2">${user.username}</span>
                  <span style="font-size:0.7rem;color:var(--green);font-weight:600">&#9679; Signed In</span>
                </div>
                <button onclick="handleLogout()" class="btn btn-secondary btn-sm" style="margin-left:8px;padding:6px 12px">Sign Out</button>
              </div>
            `;
          }

          fetchConsoleKPIs();
          refreshAuditFeed();

          const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
          if (currentPath === '/login') {
            showView('workspace');
          }
        } else {
          const sb = document.getElementById('session-banner');
          if (sb) sb.style.display = 'none';
        }
      } catch {
        const sb = document.getElementById('session-banner');
        if (sb) sb.style.display = 'none';
      }
    }

    async function fetchConsoleKPIs() {
      try {
        const [props, orders, sales, consts] = await Promise.all([
          fetch('/api/v1/property/properties/').then(r=>r.json()).catch(()=>[]),
          fetch('/api/v1/facility/work-orders/').then(r=>r.json()).catch(()=>[]),
          fetch('/api/v1/sales/sales/').then(r=>r.json()).catch(()=>[]),
          fetch('/api/v1/construction/projects/').then(r=>r.json()).catch(()=>[]),
        ]);
        const pCount = Array.isArray(props) ? props.length : (props.count || 0);
        const oCount = Array.isArray(orders) ? orders.length : (orders.count || 0);
        const sCount = Array.isArray(sales) ? sales.length : (sales.count || 0);
        const cCount = Array.isArray(consts) ? consts.length : (consts.count || 0);

        const elP = document.getElementById('cc-stat-props'); if (elP) elP.textContent = pCount + ' Properties';
        const elO = document.getElementById('cc-stat-orders'); if (elO) elO.textContent = oCount + ' Work Orders';
        const elS = document.getElementById('cc-stat-sales'); if (elS) elS.textContent = sCount + ' Active Sales';
        const elC = document.getElementById('cc-stat-const'); if (elC) elC.textContent = cCount + ' Projects';
      } catch {}
    }

    async function refreshAuditFeed() {
      const container = document.getElementById('audit-feed-list');
      if (!container) return;
      try {
        const res = await fetch('/api/v1/audit/events/');
        if (res.ok) {
          const data = await res.json();
          const items = Array.isArray(data) ? data : (data.results || []);
          if (items.length === 0) {
            container.innerHTML = '<div style="color:var(--muted);font-size:0.88rem;padding:12px 0">No audit events recorded yet. Perform an action to see real-time log stream.</div>';
            return;
          }
          container.innerHTML = items.slice(0, 8).map(evt => `
            <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);padding:14px 18px;display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap">
              <div style="display:flex;align-items:center;gap:12px">
                <span class="badge badge-accent" style="font-size:0.75rem">${evt.action}</span>
                <span style="font-weight:600;font-size:0.85rem">${evt.entity_type} / ${(evt.entity_id || '').slice(0,8)}</span>
              </div>
              <div style="display:flex;align-items:center;gap:16px;font-size:0.8rem;color:var(--muted)">
                <span>Actor: <strong style="color:var(--text)">${evt.actor_username || 'System'}</strong></span>
                <span>${new Date(evt.created_at).toLocaleTimeString()}</span>
              </div>
            </div>
          `).join('');
        }
      } catch {
        container.innerHTML = '<div style="color:var(--muted);font-size:0.88rem">Unable to load audit stream.</div>';
      }
    }

    const ENDPOINTS = {
      property:     { title: 'Property Management API', icon: '&#127962;', url: '/api/v1/property/properties/' },
      facility:     { title: 'Facility Work Orders API', icon: '&#128295;', url: '/api/v1/facility/work-orders/' },
      sales:        { title: 'Sales Inventory API', icon: '&#128179;', url: '/api/v1/sales/sales/' },
      tender:       { title: 'Tender Management API', icon: '&#128221;', url: '/api/v1/tender/tenders/' },
      valuation:    { title: 'Valuation Services API', icon: '&#128200;', url: '/api/v1/valuation/instructions/' },
      construction: { title: 'Construction Projects API', icon: '&#127959;', url: '/api/v1/construction/projects/' },
      companion:    { title: 'Field Staff Tasks API', icon: '&#128241;', url: '/api/v1/companion/tasks/' },
      audit:        { title: 'System Audit Events API', icon: '&#128274;', url: '/api/v1/audit/events/' },
    };

    async function loadModuleData(key) {
      const cfg = ENDPOINTS[key] || ENDPOINTS.property;
      document.getElementById('dm-title').textContent = cfg.title;
      document.getElementById('dm-icon').innerHTML = cfg.icon;
      document.getElementById('dm-endpoint').textContent = cfg.url;
      document.getElementById('dm-content').textContent = 'Loading API response from ' + cfg.url + ' ...';
      openModal('data-modal');
      try {
        const res = await fetch(cfg.url);
        const data = await res.json();
        document.getElementById('dm-content').textContent = JSON.stringify(data, null, 2);
      } catch (err) {
        document.getElementById('dm-content').textContent = 'Error fetching API endpoint: ' + err.message;
      }
    }

    async function handleLogout() {
      try {
        await fetch('/api/v1/auth/logout/', { method: 'POST', credentials: 'same-origin' });
      } catch {}
      window.location.reload();
    }

    // ─── Login ───────────────────────────────────────────────────────────────
    async function handleLogin(e) {
      e.preventDefault();
      const u = document.getElementById('l-username').value.trim();
      const p = document.getElementById('l-password').value;
      const btn = document.getElementById('login-btn');
      const txt = document.getElementById('login-btn-text');
      const alertEl = document.getElementById('login-alert');
      alertEl.style.display = 'none';
      btn.disabled = true;
      txt.innerHTML = '<div class="spinner"></div> Authenticating...';
      try {
        const resp = await fetch('/api/v1/auth/login/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: u, password: p })
        });
        const data = await resp.json().catch(() => ({}));
        if (resp.ok) {
          closeModal('login-modal');
          showView('console');
          await updateSessionState();
        } else {
          const msg = data.detail || data.non_field_errors?.[0] || data.password?.[0] || 'Authentication failed. Check your credentials.';
          alertEl.textContent = msg;
          alertEl.className = 'alert alert-error';
          alertEl.style.display = 'flex';
        }
      } catch {
        alertEl.textContent = 'Network error. Please try again.';
        alertEl.className = 'alert alert-error';
        alertEl.style.display = 'flex';
      } finally {
        btn.disabled = false;
        txt.textContent = 'Sign In to Platform';
      }
    }

    // ─── Register ────────────────────────────────────────────────────────────
    async function handleRegister(e) {
      e.preventDefault();
      const btn = document.getElementById('register-btn');
      const txt = document.getElementById('register-btn-text');
      const alertEl = document.getElementById('register-alert');
      const successEl = document.getElementById('register-success');
      alertEl.style.display = 'none';
      successEl.style.display = 'none';
      btn.disabled = true;
      txt.innerHTML = '<div class="spinner"></div> Creating account...';
      const payload = {
        username: document.getElementById('r-username').value.trim(),
        email: document.getElementById('r-email').value.trim(),
        first_name: document.getElementById('r-first').value.trim(),
        last_name: document.getElementById('r-last').value.trim(),
        password: document.getElementById('r-password').value,
        organization_name: document.getElementById('r-org').value.trim() || undefined,
      };
      try {
        const resp = await fetch('/api/v1/auth/register/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await resp.json().catch(() => ({}));
        if (resp.ok || resp.status === 201) {
          successEl.textContent = '\u2713 Account created! You can now sign in.';
          successEl.style.display = 'flex';
          document.getElementById('register-form').reset();
          document.querySelectorAll('.pwd-bar').forEach(b => b.style.background = 'var(--border)');
          setTimeout(() => { closeModal('register-modal'); openModal('login-modal'); }, 2500);
        } else {
          const msgs = Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' | ');
          alertEl.textContent = msgs || 'Registration failed. Please check your details.';
          alertEl.className = 'alert alert-error';
          alertEl.style.display = 'flex';
        }
      } catch {
        alertEl.textContent = 'Network error. Please try again.';
        alertEl.className = 'alert alert-error';
        alertEl.style.display = 'flex';
      } finally {
        btn.disabled = false;
        txt.textContent = 'Create Account';
      }
    }

    // ─── Forgot password ─────────────────────────────────────────────────────
    async function handleForgot(e) {
      e.preventDefault();
      const btn = document.getElementById('forgot-btn');
      const txt = document.getElementById('forgot-btn-text');
      const alertEl = document.getElementById('forgot-alert');
      alertEl.style.display = 'none';
      btn.disabled = true;
      txt.innerHTML = '<div class="spinner"></div> Sending...';
      try {
        await fetch('/api/v1/auth/password-reset/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: document.getElementById('f-email').value.trim() })
        });
        alertEl.textContent = '\u2713 If an account with that email exists, you will receive a reset link.';
        alertEl.className = 'alert alert-success';
        alertEl.style.display = 'flex';
        document.getElementById('forgot-form').reset();
      } catch {
        alertEl.textContent = '\u2713 If an account with that email exists, you will receive a reset link.';
        alertEl.className = 'alert alert-success';
        alertEl.style.display = 'flex';
      } finally {
        btn.disabled = false;
        txt.textContent = 'Send Reset Link';
      }
    }

    function getCookie(name) {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop().split(';').shift();
      return '';
    }

    async function switchRolePersona(username) {
      try {
        const resp = await fetch('/api/v1/auth/login/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
          body: JSON.stringify({ username: username, password: 'admin123' })
        });
        if (resp.ok) {
          window.location.reload();
        } else {
          const err = await resp.json().catch(() => ({}));
          alert('Could not switch to persona ' + username + ': ' + (err.detail || 'Access denied'));
        }
      } catch (err) {
        alert('Error switching persona: ' + err.message);
      }
    }

    // ─── Routing on load ─────────────────────────────────────────────────────
    (function initRoute() {
      const path = window.location.pathname.replace(/\/+$/, '') || '/';
      const map = { '/': 'home', '/console': 'console', '/workspace': 'workspace', '/workspaces': 'workspace', '/property': 'property', '/facility': 'facility', '/sales': 'sales', '/tender': 'tender', '/valuation': 'valuation', '/construction': 'construction', '/companion': 'companion', '/modules': 'modules', '/pricing': 'pricing', '/about': 'about', '/contact': 'contact', '/login': 'home', '/register': 'home' };
      const view = map[path] || 'home';
      showView(view);
      if (['property','facility','sales','tender','valuation','construction','companion'].includes(view)) {
        loadModuleWorkspace(view);
      }
      if (path === '/login') openModal('login-modal');
      if (path === '/register') openModal('register-modal');
      updateThemeBtn();
      updateSessionState();
    })();
    window.addEventListener('popstate', e => { if (e.state?.view) showView(e.state.view); });
  </script>"""

# ---------------------------------------------------------------------------
# HOME VIEW
# ---------------------------------------------------------------------------

_VIEW_HOME = """
  <!-- ========== HOME VIEW ========== -->
  <div id="view-home" class="view">
    <!-- Hero -->
    <section class="hero-bg grid-bg" style="position:relative;padding:100px 0 80px;overflow:hidden">
      <div class="orb" style="width:600px;height:600px;top:-200px;left:-100px;background:rgba(99,102,241,0.08)"></div>
      <div class="orb" style="width:400px;height:400px;top:100px;right:-100px;background:rgba(59,130,246,0.07)"></div>
      <div class="container" style="position:relative;z-index:2;display:grid;grid-template-columns:1.1fr 1fr;gap:64px;align-items:center">
        <div class="fade-up">
          <span class="badge badge-accent" style="margin-bottom:24px">&#9679; Enterprise Grade Platform</span>
          <h1 style="font-family:'Outfit';font-size:3.6rem;font-weight:900;line-height:1.05;letter-spacing:-0.03em;margin-bottom:24px">
            <span class="grad-text">Unified Real Estate</span><br>& Asset Operations
          </h1>
          <p style="font-size:1.05rem;color:var(--muted);line-height:1.7;margin-bottom:36px;max-width:480px">
            Manage property portfolios, facility maintenance, RICS valuations, construction oversight, and field staff telemetry — all in one high-performance enterprise console.
          </p>
          <div style="display:flex;gap:14px;flex-wrap:wrap">
            <button onclick="openModal('login-modal')" class="btn btn-primary btn-lg pulse-glow">
              Launch Platform <span style="font-size:1rem">&#8594;</span>
            </button>
            <a href="/api/v1/docs/" target="_blank" class="btn btn-secondary btn-lg">
              Interactive API Docs &#8599;
            </a>
          </div>
          <div style="display:flex;gap:32px;margin-top:48px">
            <div><div class="stat-value grad-text">4+</div><div class="stat-label">Enterprise Modules</div></div>
            <div style="width:1px;background:var(--border)"></div>
            <div><div class="stat-value grad-text">99.9%</div><div class="stat-label">Uptime SLA</div></div>
            <div style="width:1px;background:var(--border)"></div>
            <div><div class="stat-value grad-text">2.4</div><div class="stat-label">Platform Version</div></div>
          </div>
        </div>
        <div style="position:relative">
          <div style="border-radius:var(--radius-lg);overflow:hidden;border:1px solid var(--border2);box-shadow:var(--shadow-lg)">
            <img src="/static/images/hero.jpg" alt="Center Estates ERP Dashboard" style="width:100%;display:block;opacity:0.9">
          </div>
          <div class="glass" style="position:absolute;bottom:-16px;left:-16px;padding:14px 18px;border-radius:var(--radius);box-shadow:var(--shadow)">
            <div style="font-size:0.72rem;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Live Portfolio</div>
            <div style="font-size:1.5rem;font-weight:800;font-family:'Outfit';color:var(--green)">&#8679; 96.5% Occupancy</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Module Cards -->
    <section class="section-sm">
      <div class="container">
        <div style="text-align:center;margin-bottom:56px">
          <span class="badge badge-accent" style="margin-bottom:16px">Active Core Scope</span>
          <h2 style="font-family:'Outfit';font-size:2.5rem;font-weight:800;letter-spacing:-0.02em;margin-bottom:14px">Enterprise Module Suite</h2>
          <p style="color:var(--muted);font-size:1rem;max-width:520px;margin:0 auto;line-height:1.7">
            Four production-ready modules with full CRUD APIs, role-based access control and audit trails.
          </p>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px">
          <div class="card" style="padding:32px;cursor:pointer" onclick="showModuleDetail('property')">
            <div class="feat-icon" style="background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.25)">&#127962;</div>
            <h3 style="font-family:'Outfit';font-size:1.25rem;font-weight:700;margin-bottom:10px">Property Management</h3>
            <p style="font-size:0.85rem;color:var(--muted);line-height:1.6;margin-bottom:20px">Lease lifecycle, tenant onboarding, automated rent invoicing, and unit occupancy analytics.</p>
            <span class="badge badge-green">Active</span>
            <div style="margin-top:16px;color:var(--accent);font-size:0.85rem;font-weight:600">Explore Module &#8594;</div>
          </div>
          <div class="card" style="padding:32px;cursor:pointer" onclick="showModuleDetail('facility')">
            <div class="feat-icon" style="background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.25)">&#128296;</div>
            <h3 style="font-family:'Outfit';font-size:1.25rem;font-weight:700;margin-bottom:10px">Facility Management</h3>
            <p style="font-size:0.85rem;color:var(--muted);line-height:1.6;margin-bottom:20px">Asset maintenance schedules, work order ticketing, SLA tracking, and technician dispatch.</p>
            <span class="badge badge-green">Active</span>
            <div style="margin-top:16px;color:var(--green);font-size:0.85rem;font-weight:600">Explore Module &#8594;</div>
          </div>
          <div class="card" style="padding:32px;cursor:pointer" onclick="showModuleDetail('valuation')">
            <div class="feat-icon" style="background:rgba(6,182,212,0.12);border:1px solid rgba(6,182,212,0.25)">&#128202;</div>
            <h3 style="font-family:'Outfit';font-size:1.25rem;font-weight:700;margin-bottom:10px">Valuation Services</h3>
            <p style="font-size:0.85rem;color:var(--muted);line-height:1.6;margin-bottom:20px">RICS-compliant instructions, site inspections, market comparables, and certified reports.</p>
            <span class="badge badge-green">Active</span>
            <div style="margin-top:16px;color:var(--cyan);font-size:0.85rem;font-weight:600">Explore Module &#8594;</div>
          </div>
          <div class="card" style="padding:32px;cursor:pointer" onclick="showModuleDetail('companion')">
            <div class="feat-icon" style="background:rgba(20,184,166,0.12);border:1px solid rgba(20,184,166,0.25)">&#128241;</div>
            <h3 style="font-family:'Outfit';font-size:1.25rem;font-weight:700;margin-bottom:10px">Staff Companion App</h3>
            <p style="font-size:0.85rem;color:var(--muted);line-height:1.6;margin-bottom:20px">Field staff telemetry, location check-ins, task completion metrics, and live analytics.</p>
            <span class="badge badge-green">Active</span>
            <div style="margin-top:16px;color:#2dd4bf;font-size:0.85rem;font-weight:600">Explore Module &#8594;</div>
          </div>
        </div>
        <div style="margin-top:24px;padding:24px 28px;border:1px dashed rgba(255,255,255,0.12);border-radius:var(--radius);display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap">
          <div>
            <div style="font-weight:700;color:#f1f5f9;margin-bottom:4px">&#128272; Super Admin Convertible Modules</div>
            <div style="font-size:0.82rem;color:var(--muted)">Toggle dormant modules ON via Profile Settings: Construction Monitoring, Sales Management, Tender Management</div>
          </div>
          <span class="badge badge-muted">On-Demand Activation</span>
        </div>
      </div>
    </section>

    <!-- Module detail drawer -->
    <div id="module-drawer" style="display:none;position:fixed;inset:0;z-index:150;padding:40px 24px;overflow-y:auto;background:rgba(6,11,20,0.95);backdrop-filter:blur(16px)">
      <div style="max-width:800px;margin:0 auto">
        <button onclick="document.getElementById('module-drawer').style.display='none'" class="btn btn-secondary btn-sm" style="margin-bottom:24px">&#8592; Back</button>
        <div id="module-drawer-content"></div>
      </div>
    </div>

    <!-- CTA Banner -->
    <section style="padding:80px 0;background:linear-gradient(135deg,rgba(99,102,241,0.12) 0%,rgba(59,130,246,0.08) 100%);border-top:1px solid var(--border);border-bottom:1px solid var(--border)">
      <div class="container" style="text-align:center">
        <h2 style="font-family:'Outfit';font-size:2.5rem;font-weight:800;margin-bottom:16px">Ready to Transform Your Portfolio?</h2>
        <p style="color:var(--muted);font-size:1rem;max-width:480px;margin:0 auto 36px;line-height:1.7">Join enterprise real estate organisations already running on Center Estates ERP.</p>
        <div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap">
          <button onclick="openModal('register-modal')" class="btn btn-primary btn-lg">Get Started Free</button>
          <button onclick="openModal('login-modal')" class="btn btn-secondary btn-lg">Sign In</button>
        </div>
      </div>
    </section>
  </div>"""

# ---------------------------------------------------------------------------
# COMMAND CENTER CONSOLE VIEW (POST-LOGIN)
# ---------------------------------------------------------------------------

_VIEW_CONSOLE = """
  <!-- ========== COMMAND CENTER WORKSPACE VIEW (Enterprise Left Sidebar Layout) ========== -->
  <div id="view-console" class="view">
    <div style="display:flex;min-height:100vh;background:var(--bg)">

      <!-- ═══ LEFT ERP SIDEBAR ═══════════════════════════════════════════════ -->
      <aside style="width:280px;flex-shrink:0;background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;position:sticky;top:0;height:100vh;z-index:90;overflow-y:auto">

        <!-- Sidebar Brand Logo -->
        <div style="padding:22px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
          <a class="nav-logo" onclick="showView('home')" href="javascript:void(0)">
            <div class="nav-logo-icon">CE</div>
            <div>
              <div style="font-family:'Outfit';font-weight:800;font-size:1.05rem;letter-spacing:-0.02em">Center Estates</div>
              <div style="font-size:0.68rem;color:var(--muted);font-weight:600;margin-top:-1px">Command Center</div>
            </div>
          </a>
          <button onclick="toggleTheme()" id="theme-toggle-btn" class="btn btn-secondary btn-sm" style="padding:4px 8px;font-size:0.75rem" title="Switch Theme">☀️</button>
        </div>

        <!-- Workspace Selector Dropdown Capsule -->
        <div style="padding:16px 20px;border-bottom:1px solid var(--border);background:var(--surface2)">
          <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--muted);margin-bottom:8px">Active Workspace (/workspace)</div>
          <div style="display:flex;align-items:center;gap:10px;background:var(--surface);border:1px solid var(--border);padding:10px 12px;border-radius:var(--radius-sm)">
            <div style="width:30px;height:30px;border-radius:6px;background:linear-gradient(135deg,var(--accent),var(--accent2));display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:0.8rem;flex-shrink:0">&#127970;</div>
            <div style="flex:1;overflow:hidden">
              <div style="font-size:0.85rem;font-weight:800;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis" id="sidebar-ws-name">Center Estates Demo</div>
              <div style="font-size:0.7rem;color:var(--green);font-weight:600">&#9679; Connected Workspace</div>
            </div>
          </div>
        </div>

        <!-- Role Identity Switcher -->
        <div style="padding:16px 20px;border-bottom:1px solid var(--border)">
          <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--muted);margin-bottom:10px">Workspace Role Personas</div>
          <div style="display:flex;flex-direction:column;gap:6px">
            <button onclick="switchRolePersona('admin')" class="btn btn-secondary btn-sm" style="justify-content:flex-start;font-size:0.8rem;padding:7px 12px">
              <span>&#9733;</span> <span style="font-weight:600">Platform Admin</span>
            </button>
            <button onclick="switchRolePersona('role-property-manager')" class="btn btn-secondary btn-sm" style="justify-content:flex-start;font-size:0.8rem;padding:7px 12px">
              <span>&#127960;</span> <span>Property Manager</span>
            </button>
            <button onclick="switchRolePersona('role-facility-manager')" class="btn btn-secondary btn-sm" style="justify-content:flex-start;font-size:0.8rem;padding:7px 12px">
              <span>&#128295;</span> <span>Facility Manager</span>
            </button>
            <button onclick="switchRolePersona('role-sales-agent')" class="btn btn-secondary btn-sm" style="justify-content:flex-start;font-size:0.8rem;padding:7px 12px">
              <span>&#128179;</span> <span>Sales Agent</span>
            </button>
            <button onclick="switchRolePersona('role-valuer-inspector')" class="btn btn-secondary btn-sm" style="justify-content:flex-start;font-size:0.8rem;padding:7px 12px">
              <span>&#128208;</span> <span>Valuation Inspector</span>
            </button>
            <button onclick="switchRolePersona('role-clerk-of-works')" class="btn btn-secondary btn-sm" style="justify-content:flex-start;font-size:0.8rem;padding:7px 12px">
              <span>&#127959;</span> <span>Construction CoW</span>
            </button>
          </div>
        </div>

        <!-- Sidebar Module Nav Links -->
        <nav style="padding:16px 12px;flex:1">
          <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--muted);padding:0 8px 10px">Modules &amp; Workspaces</div>
          <div style="display:flex;flex-direction:column;gap:4px">
            <a href="javascript:void(0)" onclick="loadModuleData('property')" style="display:flex;align-items:center;gap:12px;padding:9px 12px;border-radius:var(--radius-sm);color:var(--text);text-decoration:none;font-size:0.85rem;font-weight:600" class="sidebar-link">
              <span style="font-size:1.1rem">&#127962;</span> <span>Property Portfolio</span>
            </a>
            <a href="javascript:void(0)" onclick="loadModuleData('facility')" style="display:flex;align-items:center;gap:12px;padding:9px 12px;border-radius:var(--radius-sm);color:var(--text);text-decoration:none;font-size:0.85rem;font-weight:600" class="sidebar-link">
              <span style="font-size:1.1rem">&#128295;</span> <span>Facility Maintenance</span>
            </a>
            <a href="javascript:void(0)" onclick="loadModuleData('sales')" style="display:flex;align-items:center;gap:12px;padding:9px 12px;border-radius:var(--radius-sm);color:var(--text);text-decoration:none;font-size:0.85rem;font-weight:600" class="sidebar-link">
              <span style="font-size:1.1rem">&#128179;</span> <span>Sales &amp; Revenue</span>
            </a>
            <a href="javascript:void(0)" onclick="loadModuleData('tender')" style="display:flex;align-items:center;gap:12px;padding:9px 12px;border-radius:var(--radius-sm);color:var(--text);text-decoration:none;font-size:0.85rem;font-weight:600" class="sidebar-link">
              <span style="font-size:1.1rem">&#128196;</span> <span>Tender Desk</span>
            </a>
            <a href="javascript:void(0)" onclick="loadModuleData('valuation')" style="display:flex;align-items:center;gap:12px;padding:9px 12px;border-radius:var(--radius-sm);color:var(--text);text-decoration:none;font-size:0.85rem;font-weight:600" class="sidebar-link">
              <span style="font-size:1.1rem">&#128202;</span> <span>RICS Valuations</span>
            </a>
            <a href="javascript:void(0)" onclick="loadModuleData('construction')" style="display:flex;align-items:center;gap:12px;padding:9px 12px;border-radius:var(--radius-sm);color:var(--text);text-decoration:none;font-size:0.85rem;font-weight:600" class="sidebar-link">
              <span style="font-size:1.1rem">&#127959;</span> <span>Construction S-Curve</span>
            </a>
            <a href="javascript:void(0)" onclick="loadModuleData('companion')" style="display:flex;align-items:center;gap:12px;padding:9px 12px;border-radius:var(--radius-sm);color:var(--text);text-decoration:none;font-size:0.85rem;font-weight:600" class="sidebar-link">
              <span style="font-size:1.1rem">&#128241;</span> <span>Staff Companion</span>
            </a>
            <a href="javascript:void(0)" onclick="refreshAuditFeed()" style="display:flex;align-items:center;gap:12px;padding:9px 12px;border-radius:var(--radius-sm);color:var(--text);text-decoration:none;font-size:0.85rem;font-weight:600" class="sidebar-link">
              <span style="font-size:1.1rem">&#128269;</span> <span>Central Audit Stream</span>
            </a>
            <a href="javascript:void(0)" onclick="showView('home')" style="display:flex;align-items:center;gap:12px;padding:9px 12px;border-radius:var(--radius-sm);color:var(--muted);text-decoration:none;font-size:0.85rem;font-weight:600;margin-top:12px" class="sidebar-link">
              <span style="font-size:1.1rem">&#127960;</span> <span>Public Website ↗</span>
            </a>
          </div>
        </nav>

        <!-- Sidebar User Footer Capsule -->
        <div style="padding:16px 20px;border-top:1px solid var(--border);background:var(--surface2)">
          <div style="display:flex;align-items:center;gap:12px">
            <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent2));display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.9rem;color:#fff" id="sidebar-user-avatar">A</div>
            <div style="flex:1;overflow:hidden">
              <div style="font-size:0.85rem;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis" id="sidebar-user-name">admin</div>
              <div style="font-size:0.7rem;color:var(--green);font-weight:600">&#9679; Active Session</div>
            </div>
            <button onclick="handleLogout()" title="Sign Out" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:1rem">&#10006;</button>
          </div>
        </div>

      </aside>

      <!-- ═══ MAIN WORKSPACE CONTENT ═════════════════════════════════════════ -->
      <main style="flex:1;padding:32px 40px;overflow-y:auto;max-width:calc(100vw - 280px)">

        <!-- Workspace Top Header Bar -->
        <div style="display:flex;justify-content:space-between;align-items:center;gap:24px;margin-bottom:32px;flex-wrap:wrap">
          <div>
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
              <span class="badge badge-green">&#9679; ACTIVE WORKSPACE</span>
              <span class="badge badge-accent" id="cc-org-name">Center Estates Demo</span>
            </div>
            <h1 style="font-family:'Outfit';font-size:2.2rem;font-weight:900;letter-spacing:-0.02em">
              Command Center Workspace, <span class="grad-text" id="cc-user-display">Administrator</span>
            </h1>
            <p style="color:var(--muted);font-size:0.92rem">
              Real-time enterprise operational control, live KPI telemetry, and cross-module REST data inspectors.
            </p>
          </div>
          <div style="display:flex;gap:12px;align-items:center">
            <a href="/api/v1/docs/" target="_blank" class="btn btn-secondary btn-sm" style="padding:10px 18px">Swagger API ↗</a>
            <a href="/admin/" id="cc-admin-btn" target="_blank" class="btn btn-primary btn-sm" style="padding:10px 18px;display:none">Django Admin ↗</a>
          </div>
        </div>

        <!-- Key Metrics Strip -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:20px;margin-bottom:40px">
          <div class="card" style="padding:24px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
              <span style="color:var(--muted);font-size:0.78rem;font-weight:700;text-transform:uppercase">Managed Portfolio</span>
              <span style="font-size:1.4rem">&#127962;</span>
            </div>
            <div style="font-family:'Outfit';font-size:2rem;font-weight:800;color:var(--text)" id="cc-stat-props">...</div>
            <div style="font-size:0.78rem;color:var(--green);margin-top:4px">● Active Property Portfolio</div>
          </div>

          <div class="card" style="padding:24px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
              <span style="color:var(--muted);font-size:0.78rem;font-weight:700;text-transform:uppercase">Facility Maintenance</span>
              <span style="font-size:1.4rem">&#128295;</span>
            </div>
            <div style="font-family:'Outfit';font-size:2rem;font-weight:800;color:var(--text)" id="cc-stat-orders">...</div>
            <div style="font-size:0.78rem;color:var(--accent);margin-top:4px">● Work Orders &amp; Maintenance</div>
          </div>

          <div class="card" style="padding:24px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
              <span style="color:var(--muted);font-size:0.78rem;font-weight:700;text-transform:uppercase">Sales &amp; Revenue</span>
              <span style="font-size:1.4rem">&#128179;</span>
            </div>
            <div style="font-family:'Outfit';font-size:2rem;font-weight:800;color:var(--text)" id="cc-stat-sales">...</div>
            <div style="font-size:0.78rem;color:var(--cyan);margin-top:4px">● Property Sales &amp; Installments</div>
          </div>

          <div class="card" style="padding:24px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
              <span style="color:var(--muted);font-size:0.78rem;font-weight:700;text-transform:uppercase">Construction Monitoring</span>
              <span style="font-size:1.4rem">&#127959;</span>
            </div>
            <div style="font-family:'Outfit';font-size:2rem;font-weight:800;color:var(--text)" id="cc-stat-const">...</div>
            <div style="font-size:0.78rem;color:var(--amber);margin-top:4px">● Projects &amp; BOQ Drawdowns</div>
          </div>
        </div>

        <!-- Module Console Launchpads -->
        <h2 style="font-family:'Outfit';font-size:1.5rem;font-weight:800;margin-bottom:20px;display:flex;align-items:center;gap:12px">
          <span>Enterprise Module Launchpads</span>
          <span style="font-size:0.8rem;color:var(--muted);font-weight:500">(Click to inspect live API data)</span>
        </h2>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:24px;margin-bottom:48px">

          <!-- 1. Property Management -->
          <div class="card" style="padding:28px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
              <div>
                <span class="badge badge-accent" style="margin-bottom:8px">Property Management</span>
                <h3 style="font-family:'Outfit';font-size:1.25rem;font-weight:800">Leases &amp; Tenant Portfolios</h3>
              </div>
              <div style="font-size:2rem">&#127962;</div>
            </div>
            <p style="color:var(--muted);font-size:0.88rem;line-height:1.6;margin-bottom:20px">
              Manage properties, buildings, units, tenant leases, billing invoices, receipts, service charges, and credit notes.
            </p>
            <div style="display:flex;gap:10px">
              <button onclick="loadModuleData('property')" class="btn btn-secondary btn-sm">Inspect Data ↗</button>
              <a href="/api/v1/docs/#/property" target="_blank" class="nav-link" style="font-size:0.82rem;align-self:center">API Endpoints ↗</a>
            </div>
          </div>

          <!-- 2. Facility Management -->
          <div class="card" style="padding:28px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
              <div>
                <span class="badge badge-green" style="margin-bottom:8px">Facility Operations</span>
                <h3 style="font-family:'Outfit';font-size:1.25rem;font-weight:800">Assets &amp; Work Orders</h3>
              </div>
              <div style="font-size:2rem">&#128295;</div>
            </div>
            <p style="color:var(--muted);font-size:0.88rem;line-height:1.6;margin-bottom:20px">
              Track asset registers, work order lifecycles, planned maintenance, inspections, contractors, and utility meters.
            </p>
            <div style="display:flex;gap:10px">
              <button onclick="loadModuleData('facility')" class="btn btn-secondary btn-sm">Inspect Data ↗</button>
              <a href="/api/v1/docs/#/facility" target="_blank" class="nav-link" style="font-size:0.82rem;align-self:center">API Endpoints ↗</a>
            </div>
          </div>

          <!-- 3. Sales Management -->
          <div class="card" style="padding:28px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
              <div>
                <span class="badge badge-cyan" style="margin-bottom:8px">Sales &amp; Marketing</span>
                <h3 style="font-family:'Outfit';font-size:1.25rem;font-weight:800">Off-Plan Sales &amp; Buyers</h3>
              </div>
              <div style="font-size:2rem">&#128179;</div>
            </div>
            <p style="color:var(--muted);font-size:0.88rem;line-height:1.6;margin-bottom:20px">
              Manage unit inventory listings, buyers, reservation agreements, installment schedules, payments, and commissions.
            </p>
            <div style="display:flex;gap:10px">
              <button onclick="loadModuleData('sales')" class="btn btn-secondary btn-sm">Inspect Data ↗</button>
              <a href="/api/v1/docs/#/sales" target="_blank" class="nav-link" style="font-size:0.82rem;align-self:center">API Endpoints ↗</a>
            </div>
          </div>

          <!-- 4. Tender Management -->
          <div class="card" style="padding:28px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
              <div>
                <span class="badge badge-amber" style="margin-bottom:8px">Procurement &amp; Tenders</span>
                <h3 style="font-family:'Outfit';font-size:1.25rem;font-weight:800">Tenders &amp; Proposals</h3>
              </div>
              <div style="font-size:2rem">&#128221;</div>
            </div>
            <p style="color:var(--muted);font-size:0.88rem;line-height:1.6;margin-bottom:20px">
              Issue procurement tenders, receive proposals, conduct financial item reviews, record committee decisions, and track outcomes.
            </p>
            <div style="display:flex;gap:10px">
              <button onclick="loadModuleData('tender')" class="btn btn-secondary btn-sm">Inspect Data ↗</button>
              <a href="/api/v1/docs/#/tender" target="_blank" class="nav-link" style="font-size:0.82rem;align-self:center">API Endpoints ↗</a>
            </div>
          </div>

          <!-- 5. Valuation Services -->
          <div class="card" style="padding:28px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
              <div>
                <span class="badge badge-accent" style="margin-bottom:8px">Valuations</span>
                <h3 style="font-family:'Outfit';font-size:1.25rem;font-weight:800">RICS Valuation Reports</h3>
              </div>
              <div style="font-size:2rem">&#128200;</div>
            </div>
            <p style="color:var(--muted);font-size:0.88rem;line-height:1.6;margin-bottom:20px">
              Process client valuation instructions, site inspections, comparable sales evidence, draft reports, and finalized certificates.
            </p>
            <div style="display:flex;gap:10px">
              <button onclick="loadModuleData('valuation')" class="btn btn-secondary btn-sm">Inspect Data ↗</button>
              <a href="/api/v1/docs/#/valuation" target="_blank" class="nav-link" style="font-size:0.82rem;align-self:center">API Endpoints ↗</a>
            </div>
          </div>

          <!-- 6. Construction Monitoring -->
          <div class="card" style="padding:28px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
              <div>
                <span class="badge badge-green" style="margin-bottom:8px">Construction Oversight</span>
                <h3 style="font-family:'Outfit';font-size:1.25rem;font-weight:800">Projects, BOQs &amp; Milestones</h3>
              </div>
              <div style="font-size:2rem">&#127959;</div>
            </div>
            <p style="color:var(--muted);font-size:0.88rem;line-height:1.6;margin-bottom:20px">
              Track site progress, milestone verification, BOQ drawdowns, daily site logs, BIM model discrepancies, and material requisitions.
            </p>
            <div style="display:flex;gap:10px">
              <button onclick="loadModuleData('construction')" class="btn btn-secondary btn-sm">Inspect Data ↗</button>
              <a href="/api/v1/docs/#/construction" target="_blank" class="nav-link" style="font-size:0.82rem;align-self:center">API Endpoints ↗</a>
            </div>
          </div>

          <!-- 7. Staff Companion -->
          <div class="card" style="padding:28px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
              <div>
                <span class="badge badge-cyan" style="margin-bottom:8px">Field Staff Companion</span>
                <h3 style="font-family:'Outfit';font-size:1.25rem;font-weight:800">Telemetry &amp; Field Tasks</h3>
              </div>
              <div style="font-size:2rem">&#128241;</div>
            </div>
            <p style="color:var(--muted);font-size:0.88rem;line-height:1.6;margin-bottom:20px">
              Assign field task templates, receive GPS/device telemetry, monitor staff performance scores, and handle offline synchronization.
            </p>
            <div style="display:flex;gap:10px">
              <button onclick="loadModuleData('companion')" class="btn btn-secondary btn-sm">Inspect Data ↗</button>
              <a href="/api/v1/docs/#/companion" target="_blank" class="nav-link" style="font-size:0.82rem;align-self:center">API Endpoints ↗</a>
            </div>
          </div>

          <!-- 8. System Audit Log -->
          <div class="card" style="padding:28px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
              <div>
                <span class="badge badge-amber" style="margin-bottom:8px">System Audit</span>
                <h3 style="font-family:'Outfit';font-size:1.25rem;font-weight:800">Unified Audit Stream</h3>
              </div>
              <div style="font-size:2rem">&#128274;</div>
            </div>
            <p style="color:var(--muted);font-size:0.88rem;line-height:1.6;margin-bottom:20px">
              Real-time immutable audit trail capturing every creation, modification, and deletion across all 7 enterprise modules.
            </p>
            <div style="display:flex;gap:10px">
              <button onclick="loadModuleData('audit')" class="btn btn-secondary btn-sm">Inspect Audit Log ↗</button>
              <a href="/api/v1/audit/events/" target="_blank" class="nav-link" style="font-size:0.82rem;align-self:center">Audit API ↗</a>
            </div>
          </div>

        </div>

        <!-- Live Audit Feed Stream -->
        <div class="card" style="padding:32px;margin-bottom:40px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap">
            <div>
              <h3 style="font-family:'Outfit';font-size:1.4rem;font-weight:800">Live System Audit &amp; Activity Stream</h3>
              <p style="color:var(--muted);font-size:0.85rem;margin-top:2px">Real-time immutable event stream across your active organization.</p>
            </div>
            <button onclick="refreshAuditFeed()" class="btn btn-secondary btn-sm">Refresh Stream 🔄</button>
        </div>

      </main>

    </div>
  </div>
"""

_VIEW_WORKSPACE = """
  <!-- ========== WORKSPACE SWITCHER VIEW ========== -->
  <div id="view-workspace" class="view">
    <div style="display:flex;min-height:100vh;background:var(--bg)">

      <!-- ERP SIDEBAR -->
      <aside style="width:280px;flex-shrink:0;background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;position:sticky;top:0;height:100vh;z-index:90;overflow-y:auto">
        <div style="padding:22px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
          <a class="nav-logo" onclick="showView('home')" href="javascript:void(0)">
            <div class="nav-logo-icon">CE</div>
            <div>
              <div style="font-family:'Outfit';font-weight:800;font-size:1.05rem">Center Estates</div>
              <div style="font-size:0.68rem;color:var(--muted)">Workspaces Desk</div>
            </div>
          </a>
          <button onclick="toggleTheme()" class="btn btn-secondary btn-sm" style="padding:4px 8px;font-size:0.75rem">☀️</button>
        </div>

        <nav style="padding:16px 12px;flex:1">
          <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;color:var(--muted);padding:0 8px 10px">Workspace Navigation</div>
          <div style="display:flex;flex-direction:column;gap:4px">
            <a href="javascript:void(0)" onclick="showView('console')" class="sidebar-link" style="display:flex;align-items:center;gap:12px;padding:9px 12px;color:var(--text);text-decoration:none;font-weight:600"><span>📊</span> Command Center</a>
            <a href="javascript:void(0)" onclick="showView('workspace')" class="sidebar-link active" style="display:flex;align-items:center;gap:12px;padding:9px 12px;color:var(--accent);text-decoration:none;font-weight:700"><span>🏢</span> Workspace Switcher</a>
            <a href="javascript:void(0)" onclick="loadModuleWorkspace('property')" class="sidebar-link" style="display:flex;align-items:center;gap:12px;padding:9px 12px;color:var(--text);text-decoration:none;font-weight:600"><span>🏡</span> Property Portfolio</a>
            <a href="javascript:void(0)" onclick="loadModuleWorkspace('facility')" class="sidebar-link" style="display:flex;align-items:center;gap:12px;padding:9px 12px;color:var(--text);text-decoration:none;font-weight:600"><span>🔧</span> Facility Maintenance</a>
            <a href="javascript:void(0)" onclick="loadModuleWorkspace('sales')" class="sidebar-link" style="display:flex;align-items:center;gap:12px;padding:9px 12px;color:var(--text);text-decoration:none;font-weight:600"><span>💳</span> Sales &amp; Off-Plan</a>
            <a href="javascript:void(0)" onclick="loadModuleWorkspace('tender')" class="sidebar-link" style="display:flex;align-items:center;gap:12px;padding:9px 12px;color:var(--text);text-decoration:none;font-weight:600"><span>📄</span> Tender Desk</a>
            <a href="javascript:void(0)" onclick="loadModuleWorkspace('valuation')" class="sidebar-link" style="display:flex;align-items:center;gap:12px;padding:9px 12px;color:var(--text);text-decoration:none;font-weight:600"><span>📐</span> RICS Valuations</a>
            <a href="javascript:void(0)" onclick="loadModuleWorkspace('construction')" class="sidebar-link" style="display:flex;align-items:center;gap:12px;padding:9px 12px;color:var(--text);text-decoration:none;font-weight:600"><span>🏗️</span> Construction S-Curve</a>
            <a href="javascript:void(0)" onclick="loadModuleWorkspace('companion')" class="sidebar-link" style="display:flex;align-items:center;gap:12px;padding:9px 12px;color:var(--text);text-decoration:none;font-weight:600"><span>📱</span> Staff Companion</a>
          </div>
        </nav>
      </aside>

      <main style="flex:1;padding:32px 40px;overflow-y:auto">
        <div style="margin-bottom:32px">
          <span class="badge badge-accent" style="margin-bottom:8px">Multi-Tenant Management</span>
          <h1 style="font-family:'Outfit';font-size:2.2rem;font-weight:900">Workspace Selection &amp; Persona Switcher</h1>
          <p style="color:var(--muted);font-size:0.92rem">Manage organization memberships, join tenant workspaces, or switch demo personas.</p>
        </div>

        <div class="card" style="padding:28px;margin-bottom:32px">
          <h2 style="font-family:'Outfit';font-size:1.3rem;font-weight:800;margin-bottom:16px">Active Organization Workspace</h2>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap">
            <div style="display:flex;align-items:center;gap:16px">
              <div style="width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,var(--accent),var(--accent2));display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:1.2rem">&#127970;</div>
              <div>
                <h3 style="font-weight:800;font-size:1.1rem">Center Estates Demo</h3>
                <span class="badge badge-green">Enterprise Tier</span>
                <span style="font-size:0.8rem;color:var(--muted);margin-left:10px">ID: 6dfa6219-2aeb-4153-bf67-9c4f286fc0bb</span>
              </div>
            </div>
            <button onclick="showView('console')" class="btn btn-primary">Enter Command Center ↗</button>
          </div>
        </div>

        <h2 style="font-family:'Outfit';font-size:1.4rem;font-weight:800;margin-bottom:20px">Switch Role Workspace Persona</h2>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px">
          <div class="card" style="padding:20px;display:flex;align-items:center;justify-content:space-between">
            <div>
              <span class="badge badge-accent">Super Admin</span>
              <h4 style="font-weight:800;margin-top:6px">Platform Administrator</h4>
              <small style="color:var(--muted)">Full system control across all modules</small>
            </div>
            <button onclick="switchRolePersona('admin')" class="btn btn-secondary btn-sm">Join Workspace ↗</button>
          </div>
          <div class="card" style="padding:20px;display:flex;align-items:center;justify-content:space-between">
            <div>
              <span class="badge badge-accent">Property</span>
              <h4 style="font-weight:800;margin-top:6px">Property Manager (Amina)</h4>
              <small style="color:var(--muted)">Leases, buildings, units &amp; billing</small>
            </div>
            <button onclick="switchRolePersona('role-property-manager')" class="btn btn-secondary btn-sm">Join Workspace ↗</button>
          </div>
          <div class="card" style="padding:20px;display:flex;align-items:center;justify-content:space-between">
            <div>
              <span class="badge badge-green">Facility</span>
              <h4 style="font-weight:800;margin-top:6px">Facilities Manager (Daniel)</h4>
              <small style="color:var(--muted)">Assets, work orders &amp; SLA tickets</small>
            </div>
            <button onclick="switchRolePersona('role-facility-manager')" class="btn btn-secondary btn-sm">Join Workspace ↗</button>
          </div>
          <div class="card" style="padding:20px;display:flex;align-items:center;justify-content:space-between">
            <div>
              <span class="badge badge-cyan">Sales</span>
              <h4 style="font-weight:800;margin-top:6px">Sales Agent (Irene)</h4>
              <small style="color:var(--muted)">Off-plan inventory &amp; buyers</small>
            </div>
            <button onclick="switchRolePersona('role-sales-agent')" class="btn btn-secondary btn-sm">Join Workspace ↗</button>
          </div>
          <div class="card" style="padding:20px;display:flex;align-items:center;justify-content:space-between">
            <div>
              <span class="badge badge-amber">Tender</span>
              <h4 style="font-weight:800;margin-top:6px">Tender Manager (Nathan)</h4>
              <small style="color:var(--muted)">Procurement RFPs &amp; proposals</small>
            </div>
            <button onclick="switchRolePersona('role-tender-manager')" class="btn btn-secondary btn-sm">Join Workspace ↗</button>
          </div>
          <div class="card" style="padding:20px;display:flex;align-items:center;justify-content:space-between">
            <div>
              <span class="badge badge-accent">Valuation</span>
              <h4 style="font-weight:800;margin-top:6px">Valuer Inspector (Tom)</h4>
              <small style="color:var(--muted)">RICS inspection reports &amp; certs</small>
            </div>
            <button onclick="switchRolePersona('role-valuer-inspector')" class="btn btn-secondary btn-sm">Join Workspace ↗</button>
          </div>
          <div class="card" style="padding:20px;display:flex;align-items:center;justify-content:space-between">
            <div>
              <span class="badge badge-green">Construction</span>
              <h4 style="font-weight:800;margin-top:6px">Clerk of Works (Xavier)</h4>
              <small style="color:var(--muted)">S-curve progress &amp; BOQ drawdowns</small>
            </div>
            <button onclick="switchRolePersona('role-clerk-of-works')" class="btn btn-secondary btn-sm">Join Workspace ↗</button>
          </div>
        </div>
      </main>
    </div>
  </div>
"""

def _build_mod_view(key, title, badge, desc, icon):
    return f"""
  <!-- ========== {title.upper()} MODULE VIEW ========== -->
  <div id="view-{key}" class="view">
    <div style="display:flex;min-height:100vh;background:var(--bg)">
      <aside style="width:280px;flex-shrink:0;background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;position:sticky;top:0;height:100vh;z-index:90;overflow-y:auto">
        <div style="padding:22px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
          <a class="nav-logo" onclick="showView('home')" href="javascript:void(0)">
            <div class="nav-logo-icon">CE</div>
            <div>
              <div style="font-family:'Outfit';font-weight:800;font-size:1.05rem">Center Estates</div>
              <div style="font-size:0.68rem;color:var(--muted)">{title} Workspace</div>
            </div>
          </a>
          <button onclick="toggleTheme()" class="btn btn-secondary btn-sm" style="padding:4px 8px;font-size:0.75rem">☀️</button>
        </div>

        <nav style="padding:16px 12px;flex:1">
          <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;color:var(--muted);padding:0 8px 10px">ERP Workspaces</div>
          <div style="display:flex;flex-direction:column;gap:4px">
            <a href="javascript:void(0)" onclick="showView('console')" class="sidebar-link" style="display:flex;align-items:center;gap:12px;padding:9px 12px;color:var(--text);text-decoration:none;font-weight:600"><span>📊</span> Command Center</a>
            <a href="javascript:void(0)" onclick="showView('workspace')" class="sidebar-link" style="display:flex;align-items:center;gap:12px;padding:9px 12px;color:var(--text);text-decoration:none;font-weight:600"><span>🏢</span> Workspace Switcher</a>
            <a href="javascript:void(0)" onclick="loadModuleWorkspace('property')" class="sidebar-link" style="display:flex;align-items:center;gap:12px;padding:9px 12px;color:var(--text);text-decoration:none;font-weight:600"><span>🏡</span> Property Portfolio</a>
            <a href="javascript:void(0)" onclick="loadModuleWorkspace('facility')" class="sidebar-link" style="display:flex;align-items:center;gap:12px;padding:9px 12px;color:var(--text);text-decoration:none;font-weight:600"><span>🔧</span> Facility Maintenance</a>
            <a href="javascript:void(0)" onclick="loadModuleWorkspace('sales')" class="sidebar-link" style="display:flex;align-items:center;gap:12px;padding:9px 12px;color:var(--text);text-decoration:none;font-weight:600"><span>💳</span> Sales &amp; Off-Plan</a>
            <a href="javascript:void(0)" onclick="loadModuleWorkspace('tender')" class="sidebar-link" style="display:flex;align-items:center;gap:12px;padding:9px 12px;color:var(--text);text-decoration:none;font-weight:600"><span>📄</span> Tender Desk</a>
            <a href="javascript:void(0)" onclick="loadModuleWorkspace('valuation')" class="sidebar-link" style="display:flex;align-items:center;gap:12px;padding:9px 12px;color:var(--text);text-decoration:none;font-weight:600"><span>📐</span> RICS Valuations</a>
            <a href="javascript:void(0)" onclick="loadModuleWorkspace('construction')" class="sidebar-link" style="display:flex;align-items:center;gap:12px;padding:9px 12px;color:var(--text);text-decoration:none;font-weight:600"><span>🏗️</span> Construction S-Curve</a>
            <a href="javascript:void(0)" onclick="loadModuleWorkspace('companion')" class="sidebar-link" style="display:flex;align-items:center;gap:12px;padding:9px 12px;color:var(--text);text-decoration:none;font-weight:600"><span>📱</span> Staff Companion</a>
          </div>
        </nav>
      </aside>

      <main style="flex:1;padding:32px 40px;overflow-y:auto">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:32px;flex-wrap:wrap">
          <div>
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
              <span class="badge badge-{badge}">{title.upper()} WORKSPACE</span>
              <span class="badge badge-accent">Center Estates Demo</span>
            </div>
            <h1 style="font-family:'Outfit';font-size:2.2rem;font-weight:900">{icon} {title} Module</h1>
            <p style="color:var(--muted);font-size:0.92rem">{desc}</p>
          </div>
          <div style="display:flex;gap:12px">
            <button onclick="loadModuleWorkspace('{key}')" class="btn btn-primary btn-sm">Load Live Data 🔄</button>
            <a href="/api/v1/docs/#/{key}" target="_blank" class="btn btn-secondary btn-sm">Swagger API ↗</a>
          </div>
        </div>

        <div class="card" style="padding:28px" id="mw-content-{key}">
          <div style="padding:40px;text-align:center;color:var(--muted)">
            <button onclick="loadModuleWorkspace('{key}')" class="btn btn-primary btn-lg">Load {title} Live Records</button>
          </div>
        </div>
      </main>
    </div>
  </div>
"""

_VIEW_PROPERTY = _build_mod_view('property', 'Property Management', 'accent', 'Manage property portfolios, building inventories, tenant leases, and billing invoices.', '🏡')
_VIEW_FACILITY = _build_mod_view('facility', 'Facility Operations', 'green', 'Track equipment asset registers, maintenance work orders, SLA enforcement, and contractor dispatch.', '🔧')
_VIEW_SALES = _build_mod_view('sales', 'Sales & Marketing', 'cyan', 'Manage off-plan unit listings, buyer directory, reservation agreements, and installment progress.', '💳')
_VIEW_TENDER = _build_mod_view('tender', 'Tender Procurement', 'amber', 'Issue procurement RFPs, receive vendor proposals, conduct financial item reviews, and record board awards.', '📄')
_VIEW_VALUATION = _build_mod_view('valuation', 'RICS Valuations', 'accent', 'Process valuation instructions, digital site inspection logs, comparable sales evidence, and signed report certificates.', '📐')
_VIEW_CONSTRUCTION = _build_mod_view('construction', 'Construction Oversight', 'green', 'Monitor site progress, S-curve drawdowns, milestone verification, BOQ items, and daily site logs.', '🏗️')
_VIEW_COMPANION = _build_mod_view('companion', 'Field Staff Companion', 'cyan', 'Assign field task templates, receive GPS/device telemetry, monitor staff performance scores, and track field check-ins.', '📱')


# ---------------------------------------------------------------------------
# MODULES VIEW
# ---------------------------------------------------------------------------

_VIEW_MODULES = """
  <!-- ========== MODULES VIEW ========== -->
  <div id="view-modules" class="view">
    <section class="section">
      <div class="container">
        <div style="text-align:center;margin-bottom:64px">
          <span class="badge badge-accent" style="margin-bottom:16px">Full Module Suite</span>
          <h1 style="font-family:'Outfit';font-size:3rem;font-weight:900;letter-spacing:-0.03em;margin-bottom:14px">Platform Modules</h1>
          <p style="color:var(--muted);font-size:1rem;max-width:520px;margin:0 auto;line-height:1.7">Explore each enterprise module in detail. All modules share a unified data model with role-based access control.</p>
        </div>
        <div style="display:grid;gap:24px">
          <div class="card" style="padding:40px;display:grid;grid-template-columns:1fr 2fr;gap:40px;align-items:center">
            <div>
              <div class="feat-icon" style="background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.25)">&#127962;</div>
              <h2 style="font-family:'Outfit';font-size:1.8rem;font-weight:800;margin-bottom:8px">Property Management</h2>
              <span class="badge badge-green" style="margin-bottom:16px">Active Core</span>
              <p style="color:var(--muted);font-size:0.9rem;line-height:1.7">Full lease administration, tenant onboarding, rent collection schedules, and occupancy analytics with real-time dashboards.</p>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
              <div style="background:rgba(255,255,255,0.03);padding:16px;border-radius:10px;border:1px solid var(--border)"><strong style="font-size:0.85rem;color:#f1f5f9;display:block;margin-bottom:4px">&#10003; Lease Lifecycle</strong><small style="color:var(--muted)">Draft → Active → Renewal → Termination</small></div>
              <div style="background:rgba(255,255,255,0.03);padding:16px;border-radius:10px;border:1px solid var(--border)"><strong style="font-size:0.85rem;color:#f1f5f9;display:block;margin-bottom:4px">&#10003; Tenant Directory</strong><small style="color:var(--muted)">KYC, contacts, payment history</small></div>
              <div style="background:rgba(255,255,255,0.03);padding:16px;border-radius:10px;border:1px solid var(--border)"><strong style="font-size:0.85rem;color:#f1f5f9;display:block;margin-bottom:4px">&#10003; Rent Invoicing</strong><small style="color:var(--muted)">Automated escalation & statements</small></div>
              <div style="background:rgba(255,255,255,0.03);padding:16px;border-radius:10px;border:1px solid var(--border)"><strong style="font-size:0.85rem;color:#f1f5f9;display:block;margin-bottom:4px">&#10003; Occupancy Analytics</strong><small style="color:var(--muted)">Unit-level vacancy tracking</small></div>
            </div>
          </div>
          <div class="card" style="padding:40px;display:grid;grid-template-columns:1fr 2fr;gap:40px;align-items:center">
            <div>
              <div class="feat-icon" style="background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.25)">&#128296;</div>
              <h2 style="font-family:'Outfit';font-size:1.8rem;font-weight:800;margin-bottom:8px">Facility Management</h2>
              <span class="badge badge-green" style="margin-bottom:16px">Active Core</span>
              <p style="color:var(--muted);font-size:0.9rem;line-height:1.7">Asset lifecycle management, work order ticketing, preventive maintenance scheduling, and contractor dispatch.</p>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
              <div style="background:rgba(255,255,255,0.03);padding:16px;border-radius:10px;border:1px solid var(--border)"><strong style="font-size:0.85rem;color:#f1f5f9;display:block;margin-bottom:4px">&#10003; Asset Registry</strong><small style="color:var(--muted)">Equipment, installations & service logs</small></div>
              <div style="background:rgba(255,255,255,0.03);padding:16px;border-radius:10px;border:1px solid var(--border)"><strong style="font-size:0.85rem;color:#f1f5f9;display:block;margin-bottom:4px">&#10003; Work Orders</strong><small style="color:var(--muted)">SLA tracking & technician assignment</small></div>
              <div style="background:rgba(255,255,255,0.03);padding:16px;border-radius:10px;border:1px solid var(--border)"><strong style="font-size:0.85rem;color:#f1f5f9;display:block;margin-bottom:4px">&#10003; PPM Schedules</strong><small style="color:var(--muted)">Planned preventive maintenance</small></div>
              <div style="background:rgba(255,255,255,0.03);padding:16px;border-radius:10px;border:1px solid var(--border)"><strong style="font-size:0.85rem;color:#f1f5f9;display:block;margin-bottom:4px">&#10003; Vendor Dispatch</strong><small style="color:var(--muted)">Contractor portal & routing</small></div>
            </div>
          </div>
          <div class="card" style="padding:40px;display:grid;grid-template-columns:1fr 2fr;gap:40px;align-items:center">
            <div>
              <div class="feat-icon" style="background:rgba(6,182,212,0.12);border:1px solid rgba(6,182,212,0.25)">&#128202;</div>
              <h2 style="font-family:'Outfit';font-size:1.8rem;font-weight:800;margin-bottom:8px">Valuation Services</h2>
              <span class="badge badge-green" style="margin-bottom:16px">Active Core</span>
              <p style="color:var(--muted);font-size:0.9rem;line-height:1.7">RICS-compliant valuation desk with instruction management, site inspections, market comparables and certificate exports.</p>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
              <div style="background:rgba(255,255,255,0.03);padding:16px;border-radius:10px;border:1px solid var(--border)"><strong style="font-size:0.85rem;color:#f1f5f9;display:block;margin-bottom:4px">&#10003; Instruction Desk</strong><small style="color:var(--muted)">Full instruction lifecycle management</small></div>
              <div style="background:rgba(255,255,255,0.03);padding:16px;border-radius:10px;border:1px solid var(--border)"><strong style="font-size:0.85rem;color:#f1f5f9;display:block;margin-bottom:4px">&#10003; Site Inspections</strong><small style="color:var(--muted)">Digital checklists & photos</small></div>
              <div style="background:rgba(255,255,255,0.03);padding:16px;border-radius:10px;border:1px solid var(--border)"><strong style="font-size:0.85rem;color:#f1f5f9;display:block;margin-bottom:4px">&#10003; Market Comparables</strong><small style="color:var(--muted)">Comparable sales database</small></div>
              <div style="background:rgba(255,255,255,0.03);padding:16px;border-radius:10px;border:1px solid var(--border)"><strong style="font-size:0.85rem;color:#f1f5f9;display:block;margin-bottom:4px">&#10003; Cert Exports</strong><small style="color:var(--muted)">Signed valuation certificate PDFs</small></div>
            </div>
          </div>
          <div class="card" style="padding:40px;display:grid;grid-template-columns:1fr 2fr;gap:40px;align-items:center">
            <div>
              <div class="feat-icon" style="background:rgba(20,184,166,0.12);border:1px solid rgba(20,184,166,0.25)">&#128241;</div>
              <h2 style="font-family:'Outfit';font-size:1.8rem;font-weight:800;margin-bottom:8px">Staff Companion</h2>
              <span class="badge badge-green" style="margin-bottom:16px">Active Core</span>
              <p style="color:var(--muted);font-size:0.9rem;line-height:1.7">Real-time field staff telemetry, location check-ins, task execution logs, and performance monitoring console.</p>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
              <div style="background:rgba(255,255,255,0.03);padding:16px;border-radius:10px;border:1px solid var(--border)"><strong style="font-size:0.85rem;color:#f1f5f9;display:block;margin-bottom:4px">&#10003; Field Check-ins</strong><small style="color:var(--muted)">GPS-verified location logging</small></div>
              <div style="background:rgba(255,255,255,0.03);padding:16px;border-radius:10px;border:1px solid var(--border)"><strong style="font-size:0.85rem;color:#f1f5f9;display:block;margin-bottom:4px">&#10003; Task Execution</strong><small style="color:var(--muted)">Work task verification & sign-off</small></div>
              <div style="background:rgba(255,255,255,0.03);padding:16px;border-radius:10px;border:1px solid var(--border)"><strong style="font-size:0.85rem;color:#f1f5f9;display:block;margin-bottom:4px">&#10003; Telemetry Analytics</strong><small style="color:var(--muted)">Page & user interaction tracking</small></div>
              <div style="background:rgba(255,255,255,0.03);padding:16px;border-radius:10px;border:1px solid var(--border)"><strong style="font-size:0.85rem;color:#f1f5f9;display:block;margin-bottom:4px">&#10003; Performance Console</strong><small style="color:var(--muted)">Staff KPI dashboards</small></div>
            </div>
          </div>
        </div>
        <div style="margin-top:48px;text-align:center">
          <button onclick="openModal('login-modal')" class="btn btn-primary btn-lg">Access All Modules &#8594;</button>
        </div>
      </div>
    </section>
  </div>"""

# ---------------------------------------------------------------------------
# PRICING VIEW
# ---------------------------------------------------------------------------

_VIEW_PRICING = """
  <!-- ========== PRICING VIEW ========== -->
  <div id="view-pricing" class="view">
    <section class="section">
      <div class="container">
        <div style="text-align:center;margin-bottom:64px">
          <span class="badge badge-amber" style="margin-bottom:16px">Transparent Pricing</span>
          <h1 style="font-family:'Outfit';font-size:3rem;font-weight:900;letter-spacing:-0.03em;margin-bottom:14px">Plans Built for Enterprise</h1>
          <p style="color:var(--muted);font-size:1rem;max-width:480px;margin:0 auto;line-height:1.7">All plans include full API access, audit trails, role-based permissions, and 99.9% uptime SLA.</p>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:24px;align-items:start">
          <div class="card price-card">
            <div style="margin-bottom:24px">
              <div style="font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--muted);margin-bottom:10px">Starter</div>
              <div class="price-amount" style="color:var(--text)">KES 0</div>
              <div style="color:var(--muted);font-size:0.85rem;margin-top:4px">Per month &mdash; forever free</div>
            </div>
            <hr class="divider" style="margin:24px 0">
            <ul style="list-style:none;display:flex;flex-direction:column;gap:12px;margin-bottom:32px">
              <li style="font-size:0.88rem;color:var(--muted);display:flex;gap:10px"><span style="color:var(--green)">&#10003;</span> 1 Organisation</li>
              <li style="font-size:0.88rem;color:var(--muted);display:flex;gap:10px"><span style="color:var(--green)">&#10003;</span> 2 Modules (Property + Facility)</li>
              <li style="font-size:0.88rem;color:var(--muted);display:flex;gap:10px"><span style="color:var(--green)">&#10003;</span> 5 User Seats</li>
              <li style="font-size:0.88rem;color:var(--muted);display:flex;gap:10px"><span style="color:var(--green)">&#10003;</span> REST API Access</li>
              <li style="font-size:0.88rem;color:var(--faint);display:flex;gap:10px"><span>&#10005;</span> Priority Support</li>
              <li style="font-size:0.88rem;color:var(--faint);display:flex;gap:10px"><span>&#10005;</span> Custom Integrations</li>
            </ul>
            <button onclick="openModal('register-modal')" class="btn btn-secondary btn-full">Get Started Free</button>
          </div>
          <div class="card price-card featured">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px">
              <div>
                <div style="font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--accent);margin-bottom:10px">Professional</div>
                <div class="price-amount grad-text">KES 25K</div>
                <div style="color:var(--muted);font-size:0.85rem;margin-top:4px">Per month, billed annually</div>
              </div>
              <span class="badge badge-accent">Popular</span>
            </div>
            <hr class="divider" style="margin:24px 0">
            <ul style="list-style:none;display:flex;flex-direction:column;gap:12px;margin-bottom:32px">
              <li style="font-size:0.88rem;color:var(--text);display:flex;gap:10px"><span style="color:var(--green)">&#10003;</span> 3 Organisations</li>
              <li style="font-size:0.88rem;color:var(--text);display:flex;gap:10px"><span style="color:var(--green)">&#10003;</span> All 4 Core Modules</li>
              <li style="font-size:0.88rem;color:var(--text);display:flex;gap:10px"><span style="color:var(--green)">&#10003;</span> 25 User Seats</li>
              <li style="font-size:0.88rem;color:var(--text);display:flex;gap:10px"><span style="color:var(--green)">&#10003;</span> Priority Email Support</li>
              <li style="font-size:0.88rem;color:var(--text);display:flex;gap:10px"><span style="color:var(--green)">&#10003;</span> Audit Trail Exports</li>
              <li style="font-size:0.88rem;color:var(--faint);display:flex;gap:10px"><span>&#10005;</span> Custom Integrations</li>
            </ul>
            <button onclick="openModal('register-modal')" class="btn btn-primary btn-full">Start Professional</button>
          </div>
          <div class="card price-card">
            <div style="margin-bottom:24px">
              <div style="font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--muted);margin-bottom:10px">Enterprise</div>
              <div class="price-amount" style="color:var(--text)">Custom</div>
              <div style="color:var(--muted);font-size:0.85rem;margin-top:4px">Tailored for large portfolios</div>
            </div>
            <hr class="divider" style="margin:24px 0">
            <ul style="list-style:none;display:flex;flex-direction:column;gap:12px;margin-bottom:32px">
              <li style="font-size:0.88rem;color:var(--muted);display:flex;gap:10px"><span style="color:var(--green)">&#10003;</span> Unlimited Organisations</li>
              <li style="font-size:0.88rem;color:var(--muted);display:flex;gap:10px"><span style="color:var(--green)">&#10003;</span> All 7 Modules + Add-ons</li>
              <li style="font-size:0.88rem;color:var(--muted);display:flex;gap:10px"><span style="color:var(--green)">&#10003;</span> Unlimited Seats</li>
              <li style="font-size:0.88rem;color:var(--muted);display:flex;gap:10px"><span style="color:var(--green)">&#10003;</span> 24/7 Dedicated Support</li>
              <li style="font-size:0.88rem;color:var(--muted);display:flex;gap:10px"><span style="color:var(--green)">&#10003;</span> Custom Integrations & SSO</li>
              <li style="font-size:0.88rem;color:var(--muted);display:flex;gap:10px"><span style="color:var(--green)">&#10003;</span> On-premise Deployment</li>
            </ul>
            <button onclick="showView('contact')" class="btn btn-secondary btn-full">Contact Sales</button>
          </div>
        </div>
        <p style="text-align:center;color:var(--faint);font-size:0.82rem;margin-top:32px">All prices in Kenyan Shillings. VAT applicable. 14-day free trial on paid plans.</p>
      </div>
    </section>
  </div>"""

# ---------------------------------------------------------------------------
# ABOUT VIEW
# ---------------------------------------------------------------------------

_VIEW_ABOUT = """
  <!-- ========== ABOUT VIEW ========== -->
  <div id="view-about" class="view">
    <section class="section">
      <div class="container">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:center;margin-bottom:80px">
          <div>
            <span class="badge badge-accent" style="margin-bottom:16px">About Center Estates</span>
            <h1 style="font-family:'Outfit';font-size:3rem;font-weight:900;letter-spacing:-0.03em;margin-bottom:20px">Built for Real Estate Professionals</h1>
            <p style="color:var(--muted);font-size:1rem;line-height:1.75;margin-bottom:20px">
              Center Estates ERP is an enterprise-grade platform purpose-built for property portfolio managers, facility teams, RICS-certified valuers, and construction project supervisors.
            </p>
            <p style="color:var(--muted);font-size:1rem;line-height:1.75;margin-bottom:32px">
              Our platform consolidates fragmented workflows across leasing, maintenance, valuation, and field operations into a single high-performance console — with full REST API access for seamless integrations.
            </p>
            <div style="display:flex;gap:24px">
              <div><div class="stat-value grad-text">7+</div><div class="stat-label">Enterprise Modules</div></div>
              <div><div class="stat-value grad-text">2.4</div><div class="stat-label">Platform Version</div></div>
              <div><div class="stat-value grad-text">99.9%</div><div class="stat-label">Uptime SLA</div></div>
            </div>
          </div>
          <div style="border-radius:var(--radius-lg);overflow:hidden;border:1px solid var(--border2);box-shadow:var(--shadow-lg)">
            <img src="/static/images/facility.jpg" alt="Premium Real Estate" style="width:100%;display:block">
          </div>
        </div>

        <!-- Values grid -->
        <div style="text-align:center;margin-bottom:48px">
          <h2 style="font-family:'Outfit';font-size:2rem;font-weight:800;margin-bottom:12px">Our Core Principles</h2>
          <p style="color:var(--muted);font-size:0.95rem">What makes Center Estates ERP different</p>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:24px">
          <div class="card" style="padding:28px">
            <div style="font-size:1.8rem;margin-bottom:14px">&#128274;</div>
            <h3 style="font-weight:700;margin-bottom:8px">Security First</h3>
            <p style="color:var(--muted);font-size:0.85rem;line-height:1.65">Cookie-based JWT with CSRF protection, HTTPS-only, and comprehensive audit trails on every data mutation.</p>
          </div>
          <div class="card" style="padding:28px">
            <div style="font-size:1.8rem;margin-bottom:14px">&#128200;</div>
            <h3 style="font-weight:700;margin-bottom:8px">API-First Design</h3>
            <p style="color:var(--muted);font-size:0.85rem;line-height:1.65">Every feature is exposed through a versioned REST API with interactive OpenAPI documentation and SDKs.</p>
          </div>
          <div class="card" style="padding:28px">
            <div style="font-size:1.8rem;margin-bottom:14px">&#129309;</div>
            <h3 style="font-weight:700;margin-bottom:8px">Multi-Tenant Ready</h3>
            <p style="color:var(--muted);font-size:0.85rem;line-height:1.65">Manage multiple organisations, properties, and portfolios under a single platform instance with full data isolation.</p>
          </div>
          <div class="card" style="padding:28px">
            <div style="font-size:1.8rem;margin-bottom:14px">&#9889;</div>
            <h3 style="font-weight:700;margin-bottom:8px">Performance Optimised</h3>
            <p style="color:var(--muted);font-size:0.85rem;line-height:1.65">Deployed on enterprise-grade infrastructure with response rate throttling, caching and horizontal scaling support.</p>
          </div>
        </div>
      </div>
    </section>
  </div>"""

# ---------------------------------------------------------------------------
# CONTACT VIEW
# ---------------------------------------------------------------------------

_VIEW_CONTACT = """
  <!-- ========== CONTACT VIEW ========== -->
  <div id="view-contact" class="view">
    <section class="section">
      <div class="container">
        <div style="display:grid;grid-template-columns:1fr 1.2fr;gap:64px;align-items:start">
          <div>
            <span class="badge badge-accent" style="margin-bottom:16px">Get in Touch</span>
            <h1 style="font-family:'Outfit';font-size:3rem;font-weight:900;letter-spacing:-0.03em;margin-bottom:20px">Let's Talk</h1>
            <p style="color:var(--muted);font-size:1rem;line-height:1.75;margin-bottom:40px">
              Whether you need a product demo, have a technical question, or want to discuss enterprise licensing — we're here to help.
            </p>
            <div style="display:flex;flex-direction:column;gap:24px">
              <div style="display:flex;align-items:center;gap:16px">
                <div class="feat-icon" style="background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.25);width:48px;height:48px;font-size:1.2rem;margin-bottom:0">&#128231;</div>
                <div>
                  <div style="font-weight:700;margin-bottom:2px">Email Support</div>
                  <a href="mailto:support@monitoringerp.com" style="color:var(--accent);font-size:0.9rem">support@monitoringerp.com</a>
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:16px">
                <div class="feat-icon" style="background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.25);width:48px;height:48px;font-size:1.2rem;margin-bottom:0">&#128196;</div>
                <div>
                  <div style="font-weight:700;margin-bottom:2px">API Documentation</div>
                  <a href="/api/v1/docs/" target="_blank" style="color:var(--cyan);font-size:0.9rem">View Interactive Docs &#8599;</a>
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:16px">
                <div class="feat-icon" style="background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.25);width:48px;height:48px;font-size:1.2rem;margin-bottom:0">&#9200;</div>
                <div>
                  <div style="font-weight:700;margin-bottom:2px">Response Time</div>
                  <span style="color:var(--muted);font-size:0.9rem">Within 24 hours on business days</span>
                </div>
              </div>
            </div>
          </div>
          <div class="card" style="padding:40px">
            <h2 style="font-family:'Outfit';font-size:1.5rem;font-weight:800;margin-bottom:24px">Send a Message</h2>
            <div id="contact-alert" class="alert" style="display:none"></div>
            <form id="contact-form" onsubmit="handleContact(event)">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
                <div class="form-group">
                  <label class="form-label">First Name</label>
                  <input class="form-input" type="text" id="c-first" required placeholder="First name">
                </div>
                <div class="form-group">
                  <label class="form-label">Last Name</label>
                  <input class="form-input" type="text" id="c-last" required placeholder="Last name">
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Email</label>
                <input class="form-input" type="email" id="c-email" required placeholder="you@company.com">
              </div>
              <div class="form-group">
                <label class="form-label">Subject</label>
                <select class="form-input" id="c-subject">
                  <option value="">Select a topic...</option>
                  <option>Product Demo Request</option>
                  <option>Enterprise Pricing</option>
                  <option>Technical Support</option>
                  <option>Integration Question</option>
                  <option>General Enquiry</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Message</label>
                <textarea class="form-input" id="c-message" required rows="4" placeholder="Describe what you need..."></textarea>
              </div>
              <button type="submit" id="contact-btn" class="btn btn-primary btn-full" style="padding:14px">
                <span id="contact-btn-text">Send Message</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  </div>"""

# ---------------------------------------------------------------------------
# Contact handler script
# ---------------------------------------------------------------------------

_CONTACT_SCRIPT = """
  <script>
    async function handleContact(e) {
      e.preventDefault();
      const btn = document.getElementById('contact-btn');
      const txt = document.getElementById('contact-btn-text');
      const alertEl = document.getElementById('contact-alert');
      alertEl.style.display = 'none';
      btn.disabled = true;
      txt.innerHTML = '<div class="spinner"></div> Sending...';
      // Simulate send (no backend endpoint yet)
      await new Promise(r => setTimeout(r, 1200));
      alertEl.textContent = '\\u2713 Thank you! We will get back to you within 24 hours.';
      alertEl.className = 'alert alert-success';
      alertEl.style.display = 'flex';
      document.getElementById('contact-form').reset();
      btn.disabled = false;
      txt.textContent = 'Send Message';
    }

    // ─── Module detail drawer ────────────────────────────────────────────────
    const moduleDetails = {
      property: {
        icon: '&#127962;', title: 'Property Management',
        color: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.3)',
        desc: 'Comprehensive lease administration, tenant lifecycle management, automated rent invoicing, and real-time occupancy analytics.',
        features: ['Lease Lifecycle (Draft → Active → Renewal → Termination)', 'Tenant KYC & Contact Directory', 'Rent Escalation & Automated Invoicing', 'Unit & Portfolio Occupancy Dashboard', 'Arrears Tracking & Payment History', 'Landlord & Tenant Portal Access'],
      },
      facility: {
        icon: '&#128296;', title: 'Facility Management',
        color: 'rgba(34,197,94,0.15)', borderColor: 'rgba(34,197,94,0.3)',
        desc: 'End-to-end asset lifecycle management, work order ticketing with SLA enforcement, PPM scheduling, and contractor dispatch.',
        features: ['Asset & Equipment Registry', 'Work Order Ticketing with SLA', 'Preventive Maintenance (PPM)', 'Contractor & Vendor Portal', 'Fault Reporting & Escalation', 'Service Log & Compliance Records'],
      },
      valuation: {
        icon: '&#128202;', title: 'Valuation Services',
        color: 'rgba(6,182,212,0.15)', borderColor: 'rgba(6,182,212,0.3)',
        desc: 'RICS-compliant valuation instruction desk, digital site inspections, market comparable database, and certified valuation report exports.',
        features: ['Valuation Instruction Lifecycle', 'Digital Site Inspection Checklists', 'Market Comparables Database', 'Signed Certificate PDF Exports', 'Client & Instruction Portal', 'Quality Review Workflow'],
      },
      companion: {
        icon: '&#128241;', title: 'Staff Companion & Telemetry',
        color: 'rgba(20,184,166,0.15)', borderColor: 'rgba(20,184,166,0.3)',
        desc: 'Real-time field staff location telemetry, task execution logging, and performance KPI dashboards for supervisors.',
        features: ['GPS-Verified Field Check-ins', 'Task Execution Verification', 'Page & User Telemetry Analytics', 'Staff Performance KPI Dashboards', 'Live Activity Streams', 'Mobile-Optimised Companion App'],
      },
    };
    function showModuleDetail(key) {
      const m = moduleDetails[key];
      if (!m) return;
      document.getElementById('module-drawer-content').innerHTML = `
        <div class="card" style="padding:40px">
          <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px">
            <div class="feat-icon" style="background:${m.color};border:1px solid ${m.borderColor};font-size:2rem;width:64px;height:64px;margin-bottom:0">${m.icon}</div>
            <div>
              <h2 style="font-family:'Outfit';font-size:2rem;font-weight:800">${m.title}</h2>
              <span class="badge badge-green">Active Core Module</span>
            </div>
          </div>
          <p style="color:var(--muted);font-size:1rem;line-height:1.7;margin-bottom:32px">${m.desc}</p>
          <h3 style="font-weight:700;margin-bottom:16px">Core Capabilities</h3>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:36px">
            ${m.features.map(f => `<div style="background:rgba(255,255,255,0.03);padding:16px;border-radius:10px;border:1px solid var(--border);display:flex;gap:10px;align-items:center"><span style="color:var(--accent)">&#10003;</span><span style="font-size:0.88rem;font-weight:600;color:#f1f5f9">${f}</span></div>`).join('')}
          </div>
          <div style="display:flex;gap:14px">
            <button onclick="openModal('login-modal')" class="btn btn-primary">Login to Access Module</button>
            <a href="/api/v1/docs/" target="_blank" class="btn btn-secondary">View API Docs &#8599;</a>
          </div>
        </div>
      `;
      document.getElementById('module-drawer').style.display = 'block';
      document.getElementById('module-drawer').scrollTop = 0;
    }
  </script>"""

# ---------------------------------------------------------------------------
# Full HTML template
# ---------------------------------------------------------------------------

HTML_APP_TEMPLATE = (
    _BASE_HEAD
    + '<meta name="description" content="Center Estates ERP — Enterprise platform for property portfolio management, facility maintenance, RICS valuations, tender management, construction monitoring and field staff telemetry. Built for real estate professionals in Kenya and Africa.">'
    + '<meta name="keywords" content="real estate ERP Kenya, property management software Africa, facility management system, RICS valuation software, construction monitoring ERP, tenant management, lease management, property portfolio software, enterprise real estate platform">'
    + '<meta name="author" content="Center Estates">'
    + '<meta name="publisher" content="Center Estates">'
    + '<meta name="geo.region" content="KE">'
    + '<meta name="geo.placename" content="Nairobi, Kenya">'
    + '<meta name="language" content="English">'
    + '<meta name="category" content="Real Estate, Property Management, Enterprise Software">'
    + '<meta name="classification" content="Business">'
    + '<meta name="rating" content="General">'
    + '<meta name="revisit-after" content="7 days">'
    + '<title>Center Estates ERP — Enterprise Real Estate &amp; Asset Platform</title>'
    + '</head>'
    + _NAVBAR
    + _VIEW_CONSOLE
    + _VIEW_WORKSPACE
    + _VIEW_PROPERTY
    + _VIEW_FACILITY
    + _VIEW_SALES
    + _VIEW_TENDER
    + _VIEW_VALUATION
    + _VIEW_CONSTRUCTION
    + _VIEW_COMPANION
    + _VIEW_HOME
    + _VIEW_MODULES
    + _VIEW_PRICING
    + _VIEW_ABOUT
    + _VIEW_CONTACT
    + _MODALS
    + _FOOTER
    + _SCRIPTS
    + _CONTACT_SCRIPT
    + '</body></html>'
)

# ---------------------------------------------------------------------------
# Views
# ---------------------------------------------------------------------------

_NEXT_STATIC_DIR = os.path.abspath(os.path.join(settings.BASE_DIR, '../web/.next/static'))
_NEXT_SERVER_DIR = os.path.abspath(os.path.join(settings.BASE_DIR, '../web/.next/server/app'))

def serve_nextjs_static(request, path):
    return serve(request, path, document_root=_NEXT_STATIC_DIR)

@ensure_csrf_cookie
def root_web_view(request):
    """
    Serve pre-rendered Next.js HTML from .next/server/app/.
    These files are complete — they include the RSC payload (self.__next_f.push),
    all correct script tags, CSS links, and the full hydration data.
    """
    raw_path = request.path.strip('/')
    # Resolve logical page name
    if not raw_path or raw_path == 'console':
        page_slug = 'workspaces'
    else:
        # e.g. "property/properties" -> try that, fall back to top-level "property"
        page_slug = raw_path

    # Try exact match first, then top-level segment as fallback
    candidates = [
        os.path.join(_NEXT_SERVER_DIR, f'{page_slug}.html'),
        os.path.join(_NEXT_SERVER_DIR, page_slug.split('/')[0] + '.html'),
        os.path.join(_NEXT_SERVER_DIR, 'workspaces.html'),
        os.path.join(_NEXT_SERVER_DIR, 'index.html'),
    ]

    for html_path in candidates:
        if os.path.exists(html_path):
            with open(html_path, 'r', encoding='utf-8') as f:
                content = f.read()
            response = HttpResponse(content, content_type='text/html; charset=utf-8')
            get_token(request)
            return response

    return HttpResponse(HTML_APP_TEMPLATE, content_type="text/html; charset=utf-8")


_ROBOTS_TXT = """User-agent: *
Allow: /
Allow: /modules
Allow: /pricing
Allow: /about
Allow: /contact
Allow: /login
Allow: /register
Allow: /static/

Disallow: /admin/
Disallow: /api/

Sitemap: https://monitoringerp.com/sitemap.xml
"""

_SITEMAP_XML = """<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://monitoringerp.com/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://monitoringerp.com/modules</loc>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://monitoringerp.com/pricing</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://monitoringerp.com/about</loc>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://monitoringerp.com/contact</loc>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://monitoringerp.com/login</loc>
    <changefreq>yearly</changefreq>
    <priority>0.5</priority>
  </url>
</urlset>
"""

def robots_txt(request):
    return HttpResponse(_ROBOTS_TXT.strip(), content_type="text/plain; charset=utf-8")


def sitemap_xml(request):
    return HttpResponse(_SITEMAP_XML.strip(), content_type="application/xml; charset=utf-8")


urlpatterns = [
    path('_next/static/<path:path>', serve_nextjs_static, name='nextjs-static'),
    path('api/v1/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/v1/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('admin/', admin.site.urls),
    path('api/v1/', include('core.urls')),
    path('api/v1/audit/', include('audit.urls')),
    path('api/v1/documents/', include('documents.urls')),
    path('api/v1/property/', include('properties.urls')),
    path('api/v1/facility/', include('facilities.urls')),
    path('api/v1/sales/', include('sales.urls')),
    path('api/v1/tender/', include('tenders.urls')),
    path('api/v1/valuation/', include('valuations.urls')),
    path('api/v1/construction/', include('construction.urls')),
    path('api/v1/companion/', include('companion.urls')),
    path('api/v1/subscriptions/', include('subscriptions.urls')),
    # SEO infrastructure
    path('robots.txt', robots_txt, name='robots-txt'),
    path('sitemap.xml', sitemap_xml, name='sitemap-xml'),
    # Catch-all: serve the SPA for all non-API paths
    re_path(r'^.*$', root_web_view, name='root-web-app'),
]
