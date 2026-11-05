import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  Compass,
  ExternalLink,
  Layers,
  MapPin,
  Maximize2,
  Minimize2,
  Navigation,
  ShieldCheck,
} from "lucide-react";

interface SiteGeofenceMapProps {
  project: {
    id: string;
    name: string;
    code?: string;
    location?: string;
    site_latitude?: number | null;
    site_longitude?: number | null;
    geofence_radius_m?: number | null;
  };
  dailyLogs?: Array<{
    id: string;
    log_date: string;
    notes?: string;
    labour_count?: number;
    weather?: string;
  }>;
  incidents?: Array<{
    id: string;
    incident_date: string;
    severity: string;
    description: string;
  }>;
}

export function SiteGeofenceMap({
  project,
  dailyLogs = [],
  incidents = [],
}: SiteGeofenceMapProps) {
  const [mapType, setMapType] = useState<"satellite" | "streets">("satellite");
  const [showGeofence, setShowGeofence] = useState(true);
  const [showIncidents, setShowIncidents] = useState(true);
  const [showLogs, setShowLogs] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  // Defaults for Lang'ata Karam Apartments if unset
  const lat = project.site_latitude != null ? Number(project.site_latitude) : -1.332;
  const lng = project.site_longitude != null ? Number(project.site_longitude) : 36.758;
  const radius = project.geofence_radius_m != null ? Number(project.geofence_radius_m) : 350;
  const projectName = project.name || "Construction Site";
  const projectCode = project.code || "PRJ-SITE";
  const location = project.location || "Lang'ata, Nairobi";

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

  // Build the sandboxed Leaflet map document
  const mapHtml = useMemo(() => {
    const tileUrl =
      mapType === "satellite"
        ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

    const attribution =
      mapType === "satellite"
        ? "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
        : "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors";

    const logPins = showLogs
      ? dailyLogs.slice(0, 8).map((l, idx) => {
          // Slight mock jitter within site for visual representation
          const pLat = lat + (Math.sin(idx + 1) * radius * 0.000004);
          const pLng = lng + (Math.cos(idx + 1) * radius * 0.000004);
          return {
            lat: pLat,
            lng: pLng,
            title: `Daily Log ${l.log_date}`,
            text: `${l.notes || "Site diary record"} (Labour: ${l.labour_count || "—"})`,
          };
        })
      : [];

    const incidentPins = showIncidents
      ? incidents.map((inc, idx) => {
          const pLat = lat + (Math.cos(idx + 2) * radius * 0.000005);
          const pLng = lng + (Math.sin(idx + 2) * radius * 0.000005);
          return {
            lat: pLat,
            lng: pLng,
            title: `🚨 H&S: ${inc.severity.replace("_", " ").toUpperCase()}`,
            text: inc.description,
          };
        })
      : [];

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #0f172a; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    .leaflet-popup-content-wrapper { background: #1e293b; color: #f8fafc; border-radius: 8px; border: 1px solid #334155; }
    .leaflet-popup-tip { background: #1e293b; }
    .pin-title { font-weight: 700; font-size: 13px; color: #38bdf8; margin-bottom: 4px; }
    .pin-desc { font-size: 11px; color: #cbd5e1; }
    .hud-chip { position: absolute; bottom: 12px; left: 12px; z-index: 1000; background: rgba(15,23,42,0.85); backdrop-filter: blur(4px); color: #e2e8f0; padding: 6px 12px; border-radius: 6px; font-size: 11px; border: 1px solid #334155; font-family: monospace; }
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="hud-chip">
    LAT: ${lat.toFixed(6)} | LNG: ${lng.toFixed(6)} | GEOFENCE: ${radius}m
  </div>
  <script>
    var map = L.map('map', { zoomControl: true }).setView([${lat}, ${lng}], 17);

    L.tileLayer('${tileUrl}', {
      maxZoom: 19,
      attribution: "${attribution}"
    }).addTo(map);

    // Site Center Datum
    var centerIcon = L.divIcon({
      className: 'site-datum-marker',
      html: '<div style="background:#0ea5e9;width:18px;height:18px;border-radius:50%;border:3px solid #ffffff;box-shadow:0 0 12px #0ea5e9;"></div>',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
    var centerMarker = L.marker([${lat}, ${lng}], { icon: centerIcon }).addTo(map);
    centerMarker.bindPopup('<div class="pin-title">[${projectCode}] ${projectName}</div><div class="pin-desc">Datum Coordinate: ${lat.toFixed(5)}, ${lng.toFixed(5)}<br/>Enforced Geofence: ${radius}m radius</div>');

    ${
      showGeofence
        ? `
    // Geofence Circle Boundary
    L.circle([${lat}, ${lng}], {
      color: '#10b981',
      fillColor: '#10b981',
      fillOpacity: 0.18,
      weight: 2,
      dashArray: '6, 8',
      radius: ${radius}
    }).addTo(map).bindPopup('<div class="pin-title">Site Geofence Perimeter</div><div class="pin-desc">Radius: ${radius}m around project datum. Mobile Clerk submissions are verified against this polygon boundary.</div>');
    `
        : ""
    }

    // Daily Logs Pins
    var logPins = ${JSON.stringify(logPins)};
    var logIcon = L.divIcon({
      className: 'log-marker',
      html: '<div style="background:#10b981;width:12px;height:12px;border-radius:50%;border:2px solid #ffffff;box-shadow:0 0 8px #10b981;"></div>',
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });
    logPins.forEach(function(pin) {
      L.marker([pin.lat, pin.lng], { icon: logIcon }).addTo(map)
        .bindPopup('<div class="pin-title">' + pin.title + '</div><div class="pin-desc">' + pin.text + '</div>');
    });

    // Safety Incident Pins
    var incPins = ${JSON.stringify(incidentPins)};
    var incIcon = L.divIcon({
      className: 'incident-marker',
      html: '<div style="background:#ef4444;width:14px;height:14px;border-radius:50%;border:2px solid #ffffff;box-shadow:0 0 10px #ef4444;"></div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });
    incPins.forEach(function(pin) {
      L.marker([pin.lat, pin.lng], { icon: incIcon }).addTo(map)
        .bindPopup('<div class="pin-title" style="color:#ef4444;">' + pin.title + '</div><div class="pin-desc">' + pin.text + '</div>');
    });
  </script>
</body>
</html>`;
  }, [lat, lng, radius, mapType, showGeofence, showIncidents, showLogs, projectName, projectCode, dailyLogs, incidents]);

  return (
    <div
      className="card"
      style={{
        marginTop: 16,
        padding: 0,
        overflow: "hidden",
        border: "1px solid #cbd5e1",
        borderRadius: 8,
      }}
    >
      {/* Header Toolbar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          background: "#f8fafc",
          borderBottom: "1px solid #e2e8f0",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Compass size={18} style={{ color: "#0ea5e9" }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>
              Interactive Site Aerial GIS & Geofence Boundary
            </div>
            <div style={{ fontSize: 11, color: "#64748b" }}>
              {location} · Datum: {lat.toFixed(4)}, {lng.toFixed(4)} · Boundary: {radius}m
            </div>
          </div>
        </div>

        {/* Action Buttons & Toggles */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {/* Map Layer Switcher */}
          <div
            style={{
              display: "flex",
              background: "#e2e8f0",
              borderRadius: 6,
              padding: 2,
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            <button
              type="button"
              onClick={() => setMapType("satellite")}
              style={{
                border: "none",
                background: mapType === "satellite" ? "#ffffff" : "transparent",
                color: mapType === "satellite" ? "#0f172a" : "#64748b",
                padding: "4px 8px",
                borderRadius: 4,
                cursor: "pointer",
                boxShadow: mapType === "satellite" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
              }}
            >
              Satellite
            </button>
            <button
              type="button"
              onClick={() => setMapType("streets")}
              style={{
                border: "none",
                background: mapType === "streets" ? "#ffffff" : "transparent",
                color: mapType === "streets" ? "#0f172a" : "#64748b",
                padding: "4px 8px",
                borderRadius: 4,
                cursor: "pointer",
                boxShadow: mapType === "streets" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
              }}
            >
              Street Map
            </button>
          </div>

          {/* Layer Checkboxes */}
          <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#475569", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={showGeofence}
              onChange={(e) => setShowGeofence(e.target.checked)}
            />
            Geofence ({radius}m)
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#475569", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={showLogs}
              onChange={(e) => setShowLogs(e.target.checked)}
            />
            Logs ({dailyLogs.length})
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#475569", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={showIncidents}
              onChange={(e) => setShowIncidents(e.target.checked)}
            />
            H&S ({incidents.length})
          </label>

          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn ghost sm"
            style={{ fontSize: 11, padding: "4px 8px", display: "inline-flex", alignItems: "center", gap: 4 }}
            title="Open in Google Maps"
          >
            <ExternalLink size={12} /> Google Maps
          </a>

          <button
            type="button"
            className="btn ghost sm"
            style={{ fontSize: 11, padding: "4px 8px" }}
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? "Collapse view" : "Expand view"}
          >
            {isExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>
      </div>

      {/* Map Canvas Frame */}
      <div style={{ position: "relative", width: "100%", height: isExpanded ? 520 : 340 }}>
        <iframe
          title="Site Geofence Map"
          srcDoc={mapHtml}
          style={{ width: "100%", height: "100%", border: "none" }}
          sandbox="allow-scripts allow-same-origin"
        />
      </div>

      {/* Footer Info Strip */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 16px",
          background: "#f1f5f9",
          borderTop: "1px solid #e2e8f0",
          fontSize: 12,
          color: "#475569",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <ShieldCheck size={14} style={{ color: "#10b981" }} />
          <span>
            <strong>Anti-Fraud Geofencing Active:</strong> All Clerk of Works photos and daily logs are verified within {radius}m of site datum.
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#0ea5e9" }} /> Datum Center
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }} /> Diary Logs
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444" }} /> H&S Incidents
          </span>
        </div>
      </div>
    </div>
  );
}
