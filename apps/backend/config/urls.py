"""
URL configuration for Center Estates ERP backend.
"""
from django.contrib import admin
from django.urls import include, path, re_path
from django.http import HttpResponse, JsonResponse
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
    .bg-gradient { background: radial-gradient(circle at 50% 0%, rgba(30, 58, 138, 0.35) 0%, rgba(9, 13, 22, 1) 70%); }
    .glass { background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.1); }
    .card { background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; transition: all 0.2s ease; }
    .card:hover { border-color: rgba(99, 102, 241, 0.4); transform: translateY(-2px); }
    .btn-primary { background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; font-weight: 600; border: none; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; }
    .btn-primary:hover { opacity: 0.92; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4); }
    .badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
    .badge-core { background: rgba(37, 99, 235, 0.2); color: #60a5fa; border: 1px solid rgba(96, 165, 250, 0.3); }
    .badge-dormant { background: rgba(100, 116, 139, 0.2); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.3); }
  </style>
</head>
<body class="bg-gradient">
  <header class="glass" style="position: sticky; top: 0; z-index: 50; padding: 16px 24px; display: flex; align-items: center; justify-content: space-between;">
    <div style="display: flex; align-items: center; gap: 12px;">
      <div style="width: 36px; height: 36px; background: linear-gradient(135deg, #2563eb, #7c3aed); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-family: 'Outfit'; font-size: 1.2rem;">CE</div>
      <div>
        <h1 style="font-family: 'Outfit'; font-size: 1.15rem; font-weight: 700; letter-spacing: -0.02em;">Center Estates ERP</h1>
        <p style="font-size: 0.75rem; color: #94a3b8;">Enterprise Real Estate & Asset Platform</p>
      </div>
    </div>
    <div style="display: flex; align-items: center; gap: 16px;">
      <a href="/api/v1/docs/" target="_blank" style="color: #94a3b8; text-decoration: none; font-size: 0.85rem; font-weight: 500; display: flex; align-items: center; gap: 6px;">
        <span>API Docs (Swagger)</span> ↗
      </a>
      <a href="/login" class="btn-primary" style="padding: 8px 16px; text-decoration: none; font-size: 0.85rem;">Login to Platform</a>
    </div>
  </header>

  <main style="max-width: 1200px; margin: 40px auto; padding: 0 24px; flex: 1;">
    <div style="text-align: center; margin-bottom: 48px;">
      <span class="badge badge-core" style="margin-bottom: 12px;">System Scope Enabled</span>
      <h2 style="font-family: 'Outfit'; font-size: 2.5rem; font-weight: 800; margin-bottom: 12px; background: linear-gradient(to right, #ffffff, #94a3b8); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Unified Multi-Module Enterprise Platform</h2>
      <p style="color: #94a3b8; font-size: 1.05rem; max-width: 680px; margin: 0 auto;">Streamlining Property Management, Facility Operations, Valuation Services, and Staff Telemetry Companion into a single central system.</p>
    </div>

    <!-- Active Core Modules Grid -->
    <h3 style="font-family: 'Outfit'; font-size: 1.25rem; font-weight: 700; margin-bottom: 16px; color: #e2e8f0; display: flex; align-items: center; gap: 8px;">
      <span style="color: #3b82f6;">●</span> Active Core Modules (Client Scope)
    </h3>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 20px; margin-bottom: 40px;">
      <div class="card" style="padding: 24px;">
        <div style="font-size: 1.8rem; margin-bottom: 12px;">🏢</div>
        <h4 style="font-family: 'Outfit'; font-size: 1.1rem; font-weight: 700; margin-bottom: 6px;">Property Management</h4>
        <p style="font-size: 0.85rem; color: #94a3b8; line-height: 1.5; margin-bottom: 16px;">Tenant onboarding, lease tracking, rent invoicing, and unit allocation.</p>
        <span class="badge badge-core">Active</span>
      </div>
      <div class="card" style="padding: 24px;">
        <div style="font-size: 1.8rem; margin-bottom: 12px;">🛠️</div>
        <h4 style="font-family: 'Outfit'; font-size: 1.1rem; font-weight: 700; margin-bottom: 6px;">Facility Management</h4>
        <p style="font-size: 0.85rem; color: #94a3b8; line-height: 1.5; margin-bottom: 16px;">Asset maintenance, work orders, vendor dispatch, and preventive service.</p>
        <span class="badge badge-core">Active</span>
      </div>
      <div class="card" style="padding: 24px;">
        <div style="font-size: 1.8rem; margin-bottom: 12px;">📊</div>
        <h4 style="font-family: 'Outfit'; font-size: 1.1rem; font-weight: 700; margin-bottom: 6px;">Valuation</h4>
        <p style="font-size: 0.85rem; color: #94a3b8; line-height: 1.5; margin-bottom: 16px;">Valuation instructions, inspection reports, market analysis, and certs.</p>
        <span class="badge badge-core">Active</span>
      </div>
      <div class="card" style="padding: 24px;">
        <div style="font-size: 1.8rem; margin-bottom: 12px;">📱</div>
        <h4 style="font-family: 'Outfit'; font-size: 1.1rem; font-weight: 700; margin-bottom: 6px;">Companion App</h4>
        <p style="font-size: 0.85rem; color: #94a3b8; line-height: 1.5; margin-bottom: 16px;">Staff field telemetry, check-ins, task execution, and activity tracking.</p>
        <span class="badge badge-core">Active</span>
      </div>
    </div>

    <!-- On-Demand Modules Grid -->
    <h3 style="font-family: 'Outfit'; font-size: 1.25rem; font-weight: 700; margin-bottom: 16px; color: #e2e8f0; display: flex; align-items: center; gap: 8px;">
      <span style="color: #64748b;">●</span> Dormant Modules (Admin Toggle in Settings)
    </h3>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 20px; margin-bottom: 48px;">
      <div class="card" style="padding: 20px; opacity: 0.75;">
        <h4 style="font-family: 'Outfit'; font-size: 1rem; font-weight: 600; margin-bottom: 4px;">Construction Monitoring</h4>
        <p style="font-size: 0.8rem; color: #64748b; margin-bottom: 12px;">IPC certification, project progress, and site audits.</p>
        <span class="badge badge-dormant">Super Admin Convertible</span>
      </div>
      <div class="card" style="padding: 20px; opacity: 0.75;">
        <h4 style="font-family: 'Outfit'; font-size: 1rem; font-weight: 600; margin-bottom: 4px;">Sales Management</h4>
        <p style="font-size: 0.8rem; color: #64748b; margin-bottom: 12px;">Buyer leads, sales pipelines, commissions, and legal conveyancing.</p>
        <span class="badge badge-dormant">Super Admin Convertible</span>
      </div>
      <div class="card" style="padding: 20px; opacity: 0.75;">
        <h4 style="font-family: 'Outfit'; font-size: 1rem; font-weight: 600; margin-bottom: 4px;">Tender Management</h4>
        <p style="font-size: 0.8rem; color: #64748b; margin-bottom: 12px;">Tender invitations, bidder evaluations, and contract awards.</p>
        <span class="badge badge-dormant">Super Admin Convertible</span>
      </div>
    </div>

    <!-- Quick Access Links -->
    <div class="card" style="padding: 28px; text-align: center;">
      <h3 style="font-family: 'Outfit'; font-size: 1.3rem; font-weight: 700; margin-bottom: 8px;">Ready to Access the System?</h3>
      <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 20px;">Use your credentials to sign in, or open the interactive Swagger API console.</p>
      <div style="display: flex; gap: 12px; justify-content: center;">
        <a href="/login" class="btn-primary" style="padding: 10px 24px; text-decoration: none;">Launch Login Page</a>
        <a href="/api/v1/docs/" target="_blank" style="padding: 10px 24px; background: rgba(255,255,255,0.08); color: white; border-radius: 8px; text-decoration: none; font-weight: 600;">Explore Swagger API Docs</a>
      </div>
    </div>
  </main>

  <footer style="padding: 24px; border-top: 1px solid rgba(255,255,255,0.08); text-align: center; font-size: 0.8rem; color: #64748b;">
    Center Estates ERP Enterprise Platform &copy; 2026. All rights reserved.
  </footer>
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
