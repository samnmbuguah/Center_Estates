import React, { useEffect, useState } from "react";
import { AlertTriangle, Boxes, CalendarCheck, HardHat, PackageCheck, ShieldCheck, Users } from "lucide-react";
import { useSearchParams } from "@/components/monitoring/react-router-shim";

import {
  fetchIncidents,
  fetchMaterials,
  fetchProjects,
  get,
  mediaUrl,
  type MaterialDelivery,
  type SafetyIncident,
} from "../api";
import { ErrorBanner } from "../components";

interface ProjectOption {
  id: string;
  name: string;
}

const SEVERITY: Record<SafetyIncident["severity"], { label: string; color: string }> = {
  near_miss: { label: "Near miss", color: "var(--muted)" },
  first_aid: { label: "First aid", color: "var(--warning)" },
  lost_time: { label: "Lost time", color: "var(--orange)" },
  serious: { label: "Serious", color: "var(--danger)" },
};

/** A clickable photo thumbnail that opens the full image in a new tab. */
const PhotoThumb = React.memo(function PhotoThumb({ url, alt }: { url: string; alt: string }) {
  return (
    <a href={mediaUrl(url)} target="_blank" rel="noreferrer">
      <img
        src={mediaUrl(url)}
        alt={alt}
        loading="lazy"
        style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border, var(--color-slate-700))" }}
      />
    </a>
  );
});

/**
 * Office-side view of the weekly-report source data: material deliveries and
 * H&S incidents, each with the proof photos captured on site (receipt /
 * incident images). This is where the Reports-table Deliveries / H&S pills lead.
 */
export function SiteRecords() {
  const [params, setParams] = useSearchParams();
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectId, setProjectId] = useState(params.get("project") ?? "");
  const [deliveries, setDeliveries] = useState<MaterialDelivery[]>([]);
  const [incidents, setIncidents] = useState<SafetyIncident[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    fetchProjects()
      .then((p: ProjectOption[]) => setProjects(p))
      .catch((e) => setError((e as Error).message));
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetchMaterials(projectId || undefined),
      fetchIncidents(projectId || undefined),
      get<any>(`/daily-logs?limit=30${projectId ? `&project_id=${encodeURIComponent(projectId)}` : ""}`),
    ])
      .then(([d, i, l]) => {
        setDeliveries(d);
        setIncidents(i);
        setLogs(l.results ?? l ?? []);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [projectId]);

  function onProject(id: string) {
    setProjectId(id);
    setParams(id ? { project: id } : {}, { replace: true });
  }

  return (
    <div>
      <div className="page-head"><div className="eyebrow">Live site operations</div><h2>Construction</h2><p className="muted">Daily progress, workforce, materials, equipment, quality and safety</p></div>
      <ErrorBanner message={error} />

      <div className="card row">
        <label htmlFor="records-project">Project</label>
        <select id="records-project" value={projectId} onChange={(e) => onProject(e.target.value)}>
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        {loading && <span className="muted">Loading…</span>}
      </div>

      <div className="construction-kpis">
        <div className="card construction-kpi"><HardHat /><span>Site reports<strong>{logs.length}</strong><small>Last 30 records</small></span></div>
        <div className="card construction-kpi success"><Users /><span>Labour on site<strong>{logs[0]?.labour_count ?? 0}</strong><small>Latest diary entry</small></span></div>
        <div className="card construction-kpi"><PackageCheck /><span>Deliveries<strong>{deliveries.length}</strong><small>Recorded materials</small></span></div>
        <div className="card construction-kpi warning"><AlertTriangle /><span>Safety incidents<strong>{incidents.length}</strong><small>{incidents.filter(i => ["lost_time","serious"].includes(i.severity)).length} high priority</small></span></div>
        <div className="card construction-kpi success"><ShieldCheck /><span>Safety status<strong>{incidents.some(i => i.severity === "serious") ? "Attention" : "Good"}</strong><small>Based on reported incidents</small></span></div>
      </div>

      <div className="construction-overview">
        <div className="card">
          <div className="panel-title">Labour trend</div>
          <div className="labour-chart">
            {logs.slice(0, 12).reverse().map((log, index) => <div key={log.id || index}><i style={{ height: `${Math.min(100, Number(log.labour_count || 0))}%` }} /><span>{String(log.log_date || "").slice(5)}</span></div>)}
            {logs.length === 0 && <p className="muted">No site diary labour records.</p>}
          </div>
        </div>
        <div className="card">
          <div className="panel-title">Latest site diary</div>
          <div className="site-diary-snapshot">
            {logs.slice(0, 4).map(log => <div key={log.id}><CalendarCheck /><span><strong>{log.log_date}</strong>{log.notes || "Daily site record"}</span><small>{log.labour_count || 0} workers</small></div>)}
            {logs.length === 0 && <p className="muted">No site diary records.</p>}
          </div>
        </div>
        <div className="card">
          <div className="panel-title">Materials snapshot</div>
          <div className="compact-list">
            {deliveries.slice(0, 5).map(d => <div key={d.id}><Boxes /><span>{d.material}</span><strong>{d.quantity} {d.unit}</strong></div>)}
            {deliveries.length === 0 && <p className="muted">No deliveries recorded.</p>}
          </div>
        </div>
      </div>

      {/* Geotagged Site Photo Gallery Showcase */}
      <div className="card" style={{ padding: 18, marginBottom: 16 }}>
        <div className="panel-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <strong style={{ fontSize: 16 }}>Live Geotagged Site Photos & Audit Imagery</strong>
          <span className="muted" style={{ fontSize: 12 }}>High-Resolution Ground Truth Capture</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          <div style={{ borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)", background: "var(--surface-2)" }}>
            <img src="/images/site_inspection.png" alt="Rebar Inspection" style={{ width: "100%", height: 160, objectFit: "cover" }} />
            <div style={{ padding: 10 }}>
              <strong style={{ fontSize: 13, display: "block" }}>Rebar & Concrete Quality Inspection</strong>
              <span className="muted" style={{ fontSize: 11 }}>Level 4 Slab • Geotagged: -1.2921 N, 36.8219 E • Verified by CoW</span>
            </div>
          </div>
          <div style={{ borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)", background: "var(--surface-2)" }}>
            <img src="/images/kasneb_towers.png" alt="Structural Frame" style={{ width: "100%", height: 160, objectFit: "cover" }} />
            <div style={{ padding: 10 }}>
              <strong style={{ fontSize: 13, display: "block" }}>Structural Steel Frame & Cranes</strong>
              <span className="muted" style={{ fontSize: 11 }}>Main Tower • Geotagged: -1.2925 N, 36.8210 E • Active Construction</span>
            </div>
          </div>
          <div style={{ borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)", background: "var(--surface-2)" }}>
            <img src="/images/drone_orthomosaic.png" alt="Drone Survey" style={{ width: "100%", height: 160, objectFit: "cover" }} />
            <div style={{ padding: 10 }}>
              <strong style={{ fontSize: 13, display: "block" }}>Aerial Drone Orthomosaic Map</strong>
              <span className="muted" style={{ fontSize: 11 }}>Top-Down Nadir Survey • Scale 1:500 • 120m AGL Flight</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card" id="deliveries">
        <div className="panel-title"><span>Material deliveries</span><strong>{deliveries.length} records</strong></div>
        <table>
          <thead>
            <tr><th>Date</th><th>Material</th><th>Qty</th><th>Supplier</th><th>Received by</th><th>Receipt</th></tr>
          </thead>
          <tbody>
            {deliveries.map((d) => (
              <tr key={d.id}>
                <td>{d.delivery_date}</td>
                <td>{d.material}{d.remarks ? <span className="muted"> — {d.remarks}</span> : null}</td>
                <td>{d.quantity}{d.unit ? ` ${d.unit}` : ""}</td>
                <td>{d.supplier || "—"}</td>
                <td>{d.received_by}</td>
                <td>{d.receipt_url ? <PhotoThumb url={d.receipt_url} alt={`Receipt for ${d.material}`} /> : <span className="muted">none</span>}</td>
              </tr>
            ))}
            {deliveries.length === 0 && (
              <tr><td colSpan={6} className="muted">{loading ? "Loading…" : "No material deliveries."}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card" id="incidents">
        <div className="panel-title"><span>Health &amp; safety incidents</span><strong>{incidents.length} records</strong></div>
        <table>
          <thead>
            <tr><th>Date</th><th>Severity</th><th>What happened</th><th>Action taken</th><th>Reported by</th><th>Photos</th></tr>
          </thead>
          <tbody>
            {incidents.map((i) => (
              <tr key={i.id}>
                <td>{i.incident_date}</td>
                <td><span className="badge" style={{ background: SEVERITY[i.severity].color }}>{SEVERITY[i.severity].label}</span></td>
                <td>{i.description}</td>
                <td>{i.action_taken || "—"}</td>
                <td>{i.reported_by}</td>
                <td>
                  {i.photo_urls.length > 0 ? (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {i.photo_urls.map((u) => (
                        <PhotoThumb key={u} url={u} alt={`Incident photo (${i.incident_date})`} />
                      ))}
                    </div>
                  ) : (
                    <span className="muted">none</span>
                  )}
                </td>
              </tr>
            ))}
            {incidents.length === 0 && (
              <tr><td colSpan={6} className="muted">{loading ? "Loading…" : "No safety incidents."}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
