"""
URL configuration for Center Estates ERP backend.
Exposes REST endpoints and serves the bespoke single-page web app for marketing and login.
"""
import os
from django.contrib import admin
from django.urls import include, path, re_path
from django.http import HttpResponse
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

HTML_APP_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Center Estates ERP - Enterprise Real Estate & Asset Platform</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: #090d16; color: #f8fafc; min-height: 100vh; display: flex; flex-direction: column; overflow-x: hidden; }
    .bg-gradient { background: radial-gradient(circle at 50% 0%, rgba(30, 58, 138, 0.4) 0%, rgba(9, 13, 22, 1) 70%); }
    .glass { background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.1); }
    .card { background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 14px; transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); }
    .card:hover { border-color: rgba(99, 102, 241, 0.4); transform: translateY(-3px); box-shadow: 0 12px 24px -10px rgba(0, 0, 0, 0.5); }
    .btn-primary { background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; font-weight: 600; border: none; border-radius: 10px; cursor: pointer; transition: all 0.2s ease; display: inline-flex; align-items: center; justify-content: center; gap: 8px; text-decoration: none; }
    .btn-primary:hover { opacity: 0.92; box-shadow: 0 4px 16px rgba(37, 99, 235, 0.45); transform: translateY(-1px); }
    .btn-secondary { background: rgba(255, 255, 255, 0.08); color: #f1f5f9; font-weight: 600; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 10px; cursor: pointer; transition: all 0.2s ease; display: inline-flex; align-items: center; justify-content: center; gap: 8px; text-decoration: none; }
    .btn-secondary:hover { background: rgba(255, 255, 255, 0.14); border-color: rgba(255, 255, 255, 0.25); }
    .badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
    .badge-core { background: rgba(37, 99, 235, 0.2); color: #60a5fa; border: 1px solid rgba(96, 165, 250, 0.35); }
    .badge-dormant { background: rgba(100, 116, 139, 0.2); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.3); }
    .persona-chip { background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 8px 12px; font-size: 0.8rem; cursor: pointer; transition: all 0.2s; color: #cbd5e1; }
    .persona-chip:hover { background: rgba(99, 102, 241, 0.2); border-color: #6366f1; color: #fff; }
    /* Modal styles */
    .modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(12px); z-index: 100; display: flex; align-items: center; justify-content: center; opacity: 0; pointer-events: none; transition: opacity 0.25s ease; padding: 20px; }
    .modal-overlay.active { opacity: 1; pointer-events: auto; }
    .modal-container { background: #0f172a; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 20px; max-width: 960px; width: 100%; overflow: hidden; display: flex; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7); transform: scale(0.95); transition: transform 0.25s ease; }
    .modal-overlay.active .modal-container { transform: scale(1); }
  </style>
</head>
<body class="bg-gradient">
  <!-- Top Navigation Header -->
  <header class="glass" style="position: sticky; top: 0; z-index: 50; padding: 16px 32px; display: flex; align-items: center; justify-content: space-between;">
    <div style="display: flex; align-items: center; gap: 14px; cursor: pointer;" onclick="showTab('marketing')">
      <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #6366f1, #3b82f6); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 800; font-family: 'Outfit'; font-size: 1.25rem; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);">CE</div>
      <div>
        <h1 style="font-family: 'Outfit'; font-size: 1.2rem; font-weight: 800; letter-spacing: -0.02em;">Center Estates</h1>
        <p style="font-size: 0.75rem; color: #94a3b8; font-weight: 600;">Enterprise Real Estate Platform</p>
      </div>
    </div>
    
    <nav style="display: flex; align-items: center; gap: 24px;">
      <a href="javascript:void(0)" onclick="showTab('marketing')" style="color: #f8fafc; text-decoration: none; font-size: 0.9rem; font-weight: 600;">Overview</a>
      <a href="javascript:void(0)" onclick="showTab('property')" style="color: #94a3b8; text-decoration: none; font-size: 0.9rem; font-weight: 500;">Property Management</a>
      <a href="javascript:void(0)" onclick="showTab('facility')" style="color: #94a3b8; text-decoration: none; font-size: 0.9rem; font-weight: 500;">Facility Management</a>
      <a href="javascript:void(0)" onclick="showTab('valuation')" style="color: #94a3b8; text-decoration: none; font-size: 0.9rem; font-weight: 500;">Valuation</a>
      <a href="javascript:void(0)" onclick="showTab('companion')" style="color: #94a3b8; text-decoration: none; font-size: 0.9rem; font-weight: 500;">Companion App</a>
      <a href="/api/v1/docs/" target="_blank" style="color: #60a5fa; text-decoration: none; font-size: 0.9rem; font-weight: 600; display: flex; align-items: center; gap: 4px;">API Specs ↗</a>
    </nav>

    <div style="display: flex; align-items: center; gap: 14px;">
      <button onclick="openLoginModal()" class="btn-primary" style="padding: 10px 20px; font-size: 0.88rem;">
        <span>Login to Platform</span>
      </button>
    </div>
  </header>

  <!-- Marketing Overview View -->
  <main id="view-marketing" style="max-width: 1240px; margin: 40px auto; padding: 0 24px; flex: 1;">
    <!-- Hero Banner with 8K Generated Real Estate Visuals -->
    <div class="card" style="position: relative; overflow: hidden; margin-bottom: 48px; border: 1px solid rgba(99, 102, 241, 0.25);">
      <div style="position: absolute; inset: 0; background: url('/static/images/hero.jpg') center/cover no-repeat; opacity: 0.35;"></div>
      <div style="position: absolute; inset: 0; background: linear-gradient(90deg, #090d16 0%, rgba(9, 13, 22, 0.85) 60%, rgba(9, 13, 22, 0.4) 100%);"></div>
      
      <div style="position: relative; z-index: 2; padding: 56px 48px; max-width: 680px;">
        <span class="badge badge-core" style="margin-bottom: 16px;">Restricted Client Scope Enabled</span>
        <h1 style="font-family: 'Outfit'; font-size: 3rem; font-weight: 800; line-height: 1.1; margin-bottom: 16px; color: #ffffff;">
          Unified Real Estate & Asset Operations Engine
        </h1>
        <p style="color: #94a3b8; font-size: 1.1rem; line-height: 1.6; margin-bottom: 32px;">
          Manage portfolio leases, maintenance work orders, RICS compliant valuations, and field staff telemetry in one high-performance enterprise console.
        </p>
        <div style="display: flex; gap: 14px;">
          <button onclick="openLoginModal()" class="btn-primary" style="padding: 14px 28px; font-size: 1rem;">
            <span>Launch Platform Login</span> →
          </button>
          <a href="/api/v1/docs/" target="_blank" class="btn-secondary" style="padding: 14px 24px; font-size: 1rem;">
            <span>Interactive API Docs</span>
          </a>
        </div>
      </div>
    </div>

    <!-- Active Restricted Core Scope Grid -->
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px;">
      <div>
        <h3 style="font-family: 'Outfit'; font-size: 1.4rem; font-weight: 700; color: #f8fafc;">Active Platform Scope (4 Modules)</h3>
        <p style="font-size: 0.88rem; color: #94a3b8;">Restricted client operational scope enabled for default user accounts.</p>
      </div>
      <span class="badge badge-core">Core Scope Active</span>
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(270px, 1fr)); gap: 24px; margin-bottom: 56px;">
      <div class="card" style="padding: 28px; cursor: pointer;" onclick="showTab('property')">
        <div style="width: 48px; height: 48px; border-radius: 12px; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; margin-bottom: 16px;">🏢</div>
        <h4 style="font-family: 'Outfit'; font-size: 1.2rem; font-weight: 700; margin-bottom: 8px;">Property Management</h4>
        <p style="font-size: 0.88rem; color: #94a3b8; line-height: 1.55; margin-bottom: 20px;">Lease lifecycle tracking, tenant onboarding, automated rent invoicing, and unit occupancy analytics.</p>
        <span style="color: #60a5fa; font-size: 0.85rem; font-weight: 600; display: flex; align-items: center; gap: 4px;">Explore Module →</span>
      </div>

      <div class="card" style="padding: 28px; cursor: pointer;" onclick="showTab('facility')">
        <div style="width: 48px; height: 48px; border-radius: 12px; background: rgba(34, 197, 94, 0.15); border: 1px solid rgba(34, 197, 94, 0.3); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; margin-bottom: 16px;">🛠️</div>
        <h4 style="font-family: 'Outfit'; font-size: 1.2rem; font-weight: 700; margin-bottom: 8px;">Facility Management</h4>
        <p style="font-size: 0.88rem; color: #94a3b8; line-height: 1.55; margin-bottom: 20px;">Asset maintenance schedules, work order ticketing, SLA tracking, and technician dispatch.</p>
        <span style="color: #4ade80; font-size: 0.85rem; font-weight: 600; display: flex; align-items: center; gap: 4px;">Explore Module →</span>
      </div>

      <div class="card" style="padding: 28px; cursor: pointer;" onclick="showTab('valuation')">
        <div style="width: 48px; height: 48px; border-radius: 12px; background: rgba(6, 182, 212, 0.15); border: 1px solid rgba(6, 182, 212, 0.3); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; margin-bottom: 16px;">📊</div>
        <h4 style="font-family: 'Outfit'; font-size: 1.2rem; font-weight: 700; margin-bottom: 8px;">Valuation Services</h4>
        <p style="font-size: 0.88rem; color: #94a3b8; line-height: 1.55; margin-bottom: 20px;">Valuation instructions, site inspection data, market comparability, and formal valuation certs.</p>
        <span style="color: #22d3ee; font-size: 0.85rem; font-weight: 600; display: flex; align-items: center; gap: 4px;">Explore Module →</span>
      </div>

      <div class="card" style="padding: 28px; cursor: pointer;" onclick="showTab('companion')">
        <div style="width: 48px; height: 48px; border-radius: 12px; background: rgba(20, 184, 166, 0.15); border: 1px solid rgba(20, 184, 166, 0.3); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; margin-bottom: 16px;">📱</div>
        <h4 style="font-family: 'Outfit'; font-size: 1.2rem; font-weight: 700; margin-bottom: 8px;">Staff Companion App</h4>
        <p style="font-size: 0.88rem; color: #94a3b8; line-height: 1.55; margin-bottom: 20px;">Field staff telemetry, location check-ins, task completion metrics, and live clickstream logging.</p>
        <span style="color: #2dd4bf; font-size: 0.85rem; font-weight: 600; display: flex; align-items: center; gap: 4px;">Explore Module →</span>
      </div>
    </div>

    <!-- Super Admin Convertible Modules -->
    <div class="card" style="padding: 32px; background: rgba(15, 23, 42, 0.6); border: 1px dashed rgba(255, 255, 255, 0.15); margin-bottom: 48px;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
        <div>
          <h4 style="font-family: 'Outfit'; font-size: 1.15rem; font-weight: 700; color: #f1f5f9;">Super Admin Convertible Modules (On-Demand Activation)</h4>
          <p style="font-size: 0.85rem; color: #94a3b8;">Super Administrators can instantly toggle these dormant modules ON in Profile Settings to unlock full suite capability.</p>
        </div>
        <span class="badge badge-dormant">Profile Settings Toggle</span>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px;">
        <div style="background: rgba(30, 41, 59, 0.4); padding: 16px; border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.05);">
          <strong style="font-size: 0.9rem; color: #cbd5e1; display: block; margin-bottom: 4px;">🏗️ Construction Monitoring</strong>
          <small style="color: #64748b; font-size: 0.78rem;">IPC certification, project milestones & site audits</small>
        </div>
        <div style="background: rgba(30, 41, 59, 0.4); padding: 16px; border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.05);">
          <strong style="font-size: 0.9rem; color: #cbd5e1; display: block; margin-bottom: 4px;">🤝 Sales Management</strong>
          <small style="color: #64748b; font-size: 0.78rem;">Buyer leads, sales pipeline & legal conveyancing</small>
        </div>
        <div style="background: rgba(30, 41, 59, 0.4); padding: 16px; border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.05);">
          <strong style="font-size: 0.9rem; color: #cbd5e1; display: block; margin-bottom: 4px;">📋 Tender Management</strong>
          <small style="color: #64748b; font-size: 0.78rem;">Tender invitations, bidder evaluation & contract awards</small>
        </div>
      </div>
    </div>
  </main>

  <!-- Module Details View -->
  <main id="view-module" style="display: none; max-width: 1240px; margin: 40px auto; padding: 0 24px; flex: 1;">
    <button onclick="showTab('marketing')" class="btn-secondary" style="margin-bottom: 24px; padding: 8px 16px; font-size: 0.85rem;">
      ← Back to Platform Overview
    </button>
    <div id="module-detail-content" class="card" style="padding: 40px;">
      <!-- Content populated dynamically -->
    </div>
  </main>

  <!-- Split-Screen Interactive Login Modal / Page -->
  <div id="login-modal" class="modal-overlay">
    <div class="modal-container">
      <!-- Left Visual Hero Panel -->
      <div style="flex: 1.1; background: url('/static/images/facility.jpg') center/cover no-repeat; position: relative; padding: 40px; display: flex; flex-direction: column; justify-content: space-between; border-right: 1px solid rgba(255,255,255,0.1);">
        <div style="position: absolute; inset: 0; background: linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 27, 75, 0.85) 100%);"></div>
        
        <div style="position: relative; z-index: 2;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
            <div style="width: 36px; height: 36px; border-radius: 8px; background: linear-gradient(135deg, #6366f1, #3b82f6); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 800; font-size: 1.1rem;">CE</div>
            <strong style="font-family: 'Outfit'; font-size: 1.2rem; color: #fff;">Center Estates</strong>
          </div>
          <span class="badge badge-core" style="margin-bottom: 16px;">Restricted Client Scope</span>
          <h2 style="font-family: 'Outfit'; font-size: 1.8rem; font-weight: 800; line-height: 1.2; margin-bottom: 12px; color: #fff;">
            Enterprise Access Gateway
          </h2>
          <p style="color: #94a3b8; font-size: 0.88rem; line-height: 1.5; margin-bottom: 24px;">
            Sign in with your organization credentials or select a quick demo persona to access authorized module workspaces.
          </p>
        </div>

        <div style="position: relative; z-index: 2;">
          <div style="font-size: 0.78rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 10px;">
            1-Click Persona Quick Fill:
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            <button type="button" class="persona-chip" onclick="fillQuickLogin('admin')">👑 Admin</button>
            <button type="button" class="persona-chip" onclick="fillQuickLogin('role-property-manager')">🏢 Property Mgr</button>
            <button type="button" class="persona-chip" onclick="fillQuickLogin('role-facility-inspector')">🛠️ Facility Inspector</button>
            <button type="button" class="persona-chip" onclick="fillQuickLogin('role-valuation-reviewer')">📊 Valuer</button>
            <button type="button" class="persona-chip" onclick="fillQuickLogin('role-companion-operator')">📱 Staff Field</button>
          </div>
        </div>
      </div>

      <!-- Right Form Panel -->
      <div style="flex: 1; padding: 44px; display: flex; flex-direction: column; justify-content: center; background: #0f172a; position: relative;">
        <button onclick="closeLoginModal()" style="position: absolute; top: 20px; right: 20px; background: none; border: none; color: #94a3b8; font-size: 1.4rem; cursor: pointer;">✕</button>

        <h3 style="font-family: 'Outfit'; font-size: 1.6rem; font-weight: 800; margin-bottom: 6px; color: #f8fafc;">Sign In to Account</h3>
        <p style="color: #94a3b8; font-size: 0.88rem; margin-bottom: 28px;">Enter your username and password below.</p>

        <div id="login-error-banner" style="display: none; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #fca5a5; padding: 12px; border-radius: 8px; font-size: 0.85rem; margin-bottom: 20px;"></div>

        <form id="login-form" onsubmit="handleLoginSubmit(event)">
          <div style="margin-bottom: 18px;">
            <label style="display: block; font-size: 0.82rem; font-weight: 600; color: #cbd5e1; margin-bottom: 6px;">Username</label>
            <input type="text" id="login-username" required placeholder="Enter username or email" style="width: 100%; padding: 12px 14px; background: #1e293b; border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; color: #fff; font-size: 0.9rem; outline: none;" />
          </div>

          <div style="margin-bottom: 24px;">
            <label style="display: block; font-size: 0.82rem; font-weight: 600; color: #cbd5e1; margin-bottom: 6px;">Password</label>
            <div style="position: relative;">
              <input type="password" id="login-password" required placeholder="••••••••" style="width: 100%; padding: 12px 40px 12px 14px; background: #1e293b; border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; color: #fff; font-size: 0.9rem; outline: none;" />
              <button type="button" onclick="togglePasswordVisibility()" style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 0.9rem;">👁️</button>
            </div>
          </div>

          <button type="submit" id="login-submit-btn" class="btn-primary" style="width: 100%; padding: 14px; font-size: 0.95rem;">
            <span>Authenticate & Access Platform</span> →
          </button>
        </form>
      </div>
    </div>
  </div>

  <footer style="padding: 24px; border-top: 1px solid rgba(255,255,255,0.08); text-align: center; font-size: 0.8rem; color: #64748b; margin-top: auto;">
    Center Estates ERP Enterprise Platform &copy; 2026. All rights reserved.
  </footer>

  <script>
    function openLoginModal() {
      document.getElementById('login-modal').classList.add('active');
    }
    function closeLoginModal() {
      document.getElementById('login-modal').classList.remove('active');
    }
    function togglePasswordVisibility() {
      const pwd = document.getElementById('login-password');
      pwd.type = pwd.type === 'password' ? 'text' : 'password';
    }
    function fillQuickLogin(username) {
      document.getElementById('login-username').value = username;
      document.getElementById('login-password').value = 'admin123';
      document.getElementById('login-error-banner').style.display = 'none';
    }

    async function handleLoginSubmit(e) {
      e.preventDefault();
      const u = document.getElementById('login-username').value;
      const p = document.getElementById('login-password').value;
      const btn = document.getElementById('login-submit-btn');
      const errBanner = document.getElementById('login-error-banner');

      btn.disabled = true;
      btn.innerText = 'Authenticating...';
      errBanner.style.display = 'none';

      try {
        const resp = await fetch('/api/v1/auth/login/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: u, password: p })
        });
        const data = await resp.json();
        if (resp.ok) {
          closeLoginModal();
          alert('Welcome, ' + (data.user?.first_name || u) + '! Authentication successful.');
          window.location.href = '/api/v1/docs/';
        } else {
          errBanner.innerText = data.detail || 'Authentication failed. Please check credentials.';
          errBanner.style.display = 'block';
        }
      } catch (err) {
        errBanner.innerText = 'Server error. Please try again.';
        errBanner.style.display = 'block';
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>Authenticate & Access Platform</span> →';
      }
    }

    const moduleData = {
      property: {
        title: '🏢 Property Management Module',
        badge: 'Active Core Scope',
        desc: 'Comprehensive lease administration, property portfolio tracking, tenant onboarding, rent collection schedules, and automated invoicing.',
        features: ['Lease Agreement Lifecycle', 'Tenant Directory & Portal Access', 'Rent Escalation Invoices', 'Unit Occupancy Dashboard']
      },
      facility: {
        title: '🛠️ Facility Management Module',
        badge: 'Active Core Scope',
        desc: 'Complete asset lifecycle management, maintenance work order ticketing, preventive SLA schedules, and technician dispatch.',
        features: ['Asset Registry & Service Logs', 'Work Order SLAs & Ticketing', 'PPM Preventive Maintenance', 'Vendor & Dispatch Routing']
      },
      valuation: {
        title: '📊 Valuation Services Module',
        badge: 'Active Core Scope',
        desc: 'RICS-compliant valuation instructions, physical site inspection reports, market comparative metrics, and certified valuation reports.',
        features: ['Valuation Instruction Desk', 'Site Inspection Checklists', 'Market Comparables Database', 'Signed Valuation Certificate Exports']
      },
      companion: {
        title: '📱 Staff Companion & Field Telemetry',
        badge: 'Active Core Scope',
        desc: 'Real-time staff field check-ins, work task execution logs, telemetry analytics, and location verification.',
        features: ['Field Staff Check-ins', 'Task Execution Verification', 'Page & User Telemetry Analytics', 'Performance Monitoring Console']
      }
    };

    function showTab(tab) {
      if (tab === 'marketing') {
        document.getElementById('view-marketing').style.display = 'block';
        document.getElementById('view-module').style.display = 'none';
      } else if (moduleData[tab]) {
        const m = moduleData[tab];
        document.getElementById('module-detail-content').innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
            <h2 style="font-family: 'Outfit'; font-size: 2rem; font-weight: 800; color: #fff;">${m.title}</h2>
            <span class="badge badge-core">${m.badge}</span>
          </div>
          <p style="color: #94a3b8; font-size: 1.05rem; line-height: 1.6; margin-bottom: 32px;">${m.desc}</p>
          <h4 style="font-size: 1rem; font-weight: 700; color: #e2e8f0; margin-bottom: 16px;">Core Capabilities:</h4>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 36px;">
            ${m.features.map(f => `
              <div style="background: rgba(30, 41, 59, 0.6); padding: 16px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; gap: 10px;">
                <span style="color: #3b82f6;">✓</span>
                <span style="font-size: 0.9rem; font-weight: 600; color: #f1f5f9;">${f}</span>
              </div>
            `).join('')}
          </div>
          <div style="display: flex; gap: 14px;">
            <button onclick="openLoginModal()" class="btn-primary" style="padding: 12px 24px;">Login to Access ${m.title.split(' ')[1]}</button>
            <a href="/api/v1/docs/" target="_blank" class="btn-secondary" style="padding: 12px 24px;">View Module API Specs</a>
          </div>
        `;
        document.getElementById('view-marketing').style.display = 'none';
        document.getElementById('view-module').style.display = 'block';
      }
    }

    // Auto open login modal if path is /login
    if (window.location.pathname === '/login') {
      openLoginModal();
    }
  </script>
</body>
</html>
"""

def root_web_view(request):
    return HttpResponse(HTML_APP_TEMPLATE, content_type="text/html")

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
    # Catch-all web page view for all non-API paths (/login, /, /property, /facility, etc.)
    re_path(r'^.*$', root_web_view, name='root-web-app'),
]
