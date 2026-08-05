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
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

# ---------------------------------------------------------------------------
# Shared HTML shell (nav + footer + base styles)
# ---------------------------------------------------------------------------

_BASE_HEAD = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="index, follow">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #060b14; --surface: #0d1625; --surface2: #121d30;
      --border: rgba(255,255,255,0.09); --border2: rgba(255,255,255,0.14);
      --text: #f1f5f9; --muted: #94a3b8; --faint: #475569;
      --accent: #6366f1; --accent2: #3b82f6; --accent3: #8b5cf6;
      --green: #22c55e; --cyan: #06b6d4; --amber: #f59e0b;
      --red: #ef4444;
      --radius: 14px; --radius-sm: 8px; --radius-lg: 20px;
      --shadow: 0 4px 24px -4px rgba(0,0,0,0.5);
      --shadow-lg: 0 20px 60px -12px rgba(0,0,0,0.7);
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
    }
    /* --- Layout --- */
    .container { max-width: 1280px; margin: 0 auto; padding: 0 24px; }
    .section { padding: 96px 0; }
    .section-sm { padding: 64px 0; }
    /* --- Glassmorphism --- */
    .glass {
      background: rgba(13, 22, 37, 0.8);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--border);
    }
    .glass2 {
      background: rgba(18, 29, 48, 0.9);
      backdrop-filter: blur(24px);
      border: 1px solid var(--border2);
    }
    /* --- Cards --- */
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      transition: border-color 0.25s, transform 0.25s, box-shadow 0.25s;
    }
    .card:hover {
      border-color: rgba(99, 102, 241, 0.4);
      transform: translateY(-3px);
      box-shadow: var(--shadow);
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
      background: linear-gradient(135deg, #6366f1 0%, #3b82f6 100%);
      color: white;
      box-shadow: 0 4px 15px rgba(99, 102, 241, 0.35);
    }
    .btn-primary:hover {
      opacity: 0.9; transform: translateY(-1px);
      box-shadow: 0 8px 20px rgba(99, 102, 241, 0.5);
    }
    .btn-secondary {
      background: rgba(255,255,255,0.07);
      color: var(--text);
      border: 1px solid var(--border2);
    }
    .btn-secondary:hover {
      background: rgba(255,255,255,0.12);
      border-color: rgba(255,255,255,0.25);
    }
    .btn-outline {
      background: transparent;
      color: var(--accent);
      border: 1px solid rgba(99,102,241,0.4);
    }
    .btn-outline:hover {
      background: rgba(99,102,241,0.1);
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
    .badge-accent { background: rgba(99,102,241,0.15); color: #a5b4fc; border: 1px solid rgba(99,102,241,0.3); }
    .badge-green { background: rgba(34,197,94,0.15); color: #4ade80; border: 1px solid rgba(34,197,94,0.3); }
    .badge-amber { background: rgba(245,158,11,0.15); color: #fcd34d; border: 1px solid rgba(245,158,11,0.3); }
    .badge-muted { background: rgba(100,116,139,0.2); color: #94a3b8; border: 1px solid rgba(100,116,139,0.3); }
    /* --- Forms --- */
    .form-group { margin-bottom: 20px; }
    .form-label { display: block; font-size: 0.82rem; font-weight: 600; color: #cbd5e1; margin-bottom: 7px; }
    .form-input {
      width: 100%; padding: 12px 16px;
      background: rgba(255,255,255,0.04);
      border: 1px solid var(--border2);
      border-radius: var(--radius-sm);
      color: var(--text); font-size: 0.9rem; font-family: 'Inter', sans-serif;
      transition: border-color 0.2s, box-shadow 0.2s;
      outline: none;
    }
    .form-input:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(99,102,241,0.15);
    }
    .form-input::placeholder { color: var(--faint); }
    .form-input-wrap { position: relative; }
    .form-input-icon { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); }
    .form-hint { font-size: 0.78rem; color: var(--muted); margin-top: 5px; }
    .form-error { font-size: 0.8rem; color: #fca5a5; margin-top: 5px; }
    /* --- Alerts --- */
    .alert {
      padding: 12px 16px; border-radius: var(--radius-sm);
      font-size: 0.85rem; display: flex; align-items: center; gap: 10px;
      margin-bottom: 20px;
    }
    .alert-error { background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.3); color: #fca5a5; }
    .alert-success { background: rgba(34,197,94,0.12); border: 1px solid rgba(34,197,94,0.3); color: #4ade80; }
    .alert-info { background: rgba(99,102,241,0.12); border: 1px solid rgba(99,102,241,0.3); color: #a5b4fc; }
    /* --- Navbar --- */
    #navbar {
      position: sticky; top: 0; z-index: 100;
      padding: 0 32px; height: 68px;
      display: flex; align-items: center; justify-content: space-between;
    }
    .nav-logo { display: flex; align-items: center; gap: 12px; cursor: pointer; text-decoration: none; }
    .nav-logo-icon {
      width: 38px; height: 38px; border-radius: 9px;
      background: linear-gradient(135deg, #6366f1, #3b82f6);
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-weight: 900; font-family: 'Outfit'; font-size: 1.1rem;
      box-shadow: 0 4px 12px rgba(99,102,241,0.4);
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
    .hero-bg {
      background: radial-gradient(ellipse 80% 60% at 50% -10%, rgba(99,102,241,0.25) 0%, transparent 70%),
                  radial-gradient(ellipse 60% 50% at 80% 50%, rgba(59,130,246,0.12) 0%, transparent 60%),
                  var(--bg);
    }
    /* --- Glow orbs --- */
    .orb {
      position: absolute; border-radius: 50%; filter: blur(80px); pointer-events: none;
    }
    /* --- Grid patterns --- */
    .grid-bg {
      background-image: linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
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
      <button class="nav-link" onclick="showView('home')" id="nl-home">Overview</button>
      <button class="nav-link" onclick="showView('modules')" id="nl-modules">Modules</button>
      <button class="nav-link" onclick="showView('pricing')" id="nl-pricing">Pricing</button>
      <button class="nav-link" onclick="showView('about')" id="nl-about">About</button>
      <button class="nav-link" onclick="showView('contact')" id="nl-contact">Contact</button>
      <a href="/api/v1/docs/" target="_blank" class="nav-link" style="color:var(--cyan)">API Docs ↗</a>
    </div>
    <div class="nav-actions">
      <button class="btn btn-secondary btn-sm" onclick="openModal('login-modal')">Sign In</button>
      <button class="btn btn-primary btn-sm" onclick="openModal('register-modal')">Get Started</button>
    </div>
  </nav>"""

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
  </div>"""

_SCRIPTS = """
  <script>
    // ─── CSRF ────────────────────────────────────────────────────────────────
    let _csrf = null;
    async function getCSRF() {
      if (_csrf) return _csrf;
      const r = await fetch('/api/v1/auth/csrf/', { credentials: 'same-origin' });
      const d = await r.json();
      _csrf = d.csrfToken;
      return _csrf;
    }

    // ─── Modal helpers ───────────────────────────────────────────────────────
    function openModal(id) {
      document.getElementById(id).classList.add('active');
      document.body.style.overflow = 'hidden';
      // Pre-fetch CSRF when opening login/register
      if (id === 'login-modal' || id === 'register-modal') getCSRF();
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
        ['login-modal','register-modal','forgot-modal'].forEach(closeModal);
      }
    });

    // ─── View switching ──────────────────────────────────────────────────────
    const VIEWS = ['home','modules','pricing','about','contact'];
    function showView(name) {
      VIEWS.forEach(v => {
        const el = document.getElementById('view-' + v);
        if (el) el.classList.toggle('active', v === name);
      });
      VIEWS.forEach(v => {
        const nl = document.getElementById('nl-' + v);
        if (nl) nl.classList.toggle('active', v === name);
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      // Update URL without reloading
      const path = name === 'home' ? '/' : '/' + name;
      history.pushState({ view: name }, '', path);
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

    // ─── Login ───────────────────────────────────────────────────────────────
    async function handleLogin(e) {
      e.preventDefault();
      const u = document.getElementById('l-username').value.trim();
      const p = document.getElementById('l-password').value;
      const btn = document.getElementById('login-btn');
      const txt = document.getElementById('login-btn-text');
      const alert = document.getElementById('login-alert');
      alert.style.display = 'none';
      btn.disabled = true;
      txt.innerHTML = '<div class="spinner"></div> Authenticating...';
      try {
        const csrf = await getCSRF();
        const resp = await fetch('/api/v1/auth/login/', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
          body: JSON.stringify({ username: u, password: p })
        });
        const data = await resp.json().catch(() => ({}));
        if (resp.ok) {
          closeModal('login-modal');
          window.location.href = '/api/v1/docs/';
        } else {
          const msg = data.detail || data.non_field_errors?.[0] || data.password?.[0] || 'Authentication failed. Check your credentials.';
          alert.textContent = msg;
          alert.className = 'alert alert-error';
          alert.style.display = 'flex';
          _csrf = null; // reset so next attempt fetches fresh token
        }
      } catch {
        alert.textContent = 'Network error. Please try again.';
        alert.className = 'alert alert-error';
        alert.style.display = 'flex';
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
        const csrf = await getCSRF();
        const resp = await fetch('/api/v1/auth/register/', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
          body: JSON.stringify(payload)
        });
        const data = await resp.json().catch(() => ({}));
        if (resp.ok || resp.status === 201) {
          successEl.textContent = '\\u2713 Account created! You can now sign in with your credentials.';
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
        const csrf = await getCSRF();
        const resp = await fetch('/api/v1/auth/password-reset/', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
          body: JSON.stringify({ email: document.getElementById('f-email').value.trim() })
        });
        // Always show success to prevent email enumeration
        alertEl.textContent = '\\u2713 If an account with that email exists, you will receive a reset link shortly.';
        alertEl.className = 'alert alert-success';
        alertEl.style.display = 'flex';
        document.getElementById('forgot-form').reset();
      } catch {
        alertEl.textContent = '\\u2713 If an account with that email exists, you will receive a reset link shortly.';
        alertEl.className = 'alert alert-success';
        alertEl.style.display = 'flex';
      } finally {
        btn.disabled = false;
        txt.textContent = 'Send Reset Link';
      }
    }

    // ─── Routing on load ─────────────────────────────────────────────────────
    (function initRoute() {
      const path = window.location.pathname.replace(/\\/+$/, '') || '/';
      const map = { '/': 'home', '/modules': 'modules', '/pricing': 'pricing', '/about': 'about', '/contact': 'contact', '/login': 'home', '/register': 'home' };
      const view = map[path] || 'home';
      showView(view);
      if (path === '/login') openModal('login-modal');
      if (path === '/register') openModal('register-modal');
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
    + '<meta name="description" content="Center Estates ERP — Enterprise platform for property management, facility maintenance, RICS valuations, and field staff telemetry.">'
    + '<title>Center Estates ERP — Enterprise Real Estate Platform</title>'
    + '</head>'
    + _NAVBAR
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

@ensure_csrf_cookie
def root_web_view(request):
    return HttpResponse(HTML_APP_TEMPLATE, content_type="text/html; charset=utf-8")


urlpatterns = [
    path('api/v1/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/v1/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('admin/', admin.site.urls),
    path('api/v1/', include('core.urls')),
    path('api/v1/property/', include('properties.urls')),
    path('api/v1/facility/', include('facilities.urls')),
    path('api/v1/sales/', include('sales.urls')),
    path('api/v1/tender/', include('tenders.urls')),
    path('api/v1/valuation/', include('valuations.urls')),
    path('api/v1/construction/', include('construction.urls')),
    path('api/v1/companion/', include('companion.urls')),
    # Catch-all: serve the SPA for all non-API paths
    re_path(r'^.*$', root_web_view, name='root-web-app'),
]
