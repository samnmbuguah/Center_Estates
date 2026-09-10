import { useEffect, useRef, useState } from "react";
import { useParams } from "@/components/monitoring/react-router-shim";
import { 
  Download, Upload, Plane, MapPin, Calendar, FileText,
  Activity, AlertTriangle, CheckCircle2, Eye, Layers,
  Search, BarChart3, Globe
} from "lucide-react";

import { get, patch, post } from "../api";
import { droneUploadChunk } from "../api";
import { useAuth } from "../auth";
import { ErrorBanner, ConfirmModal } from "../components";

type DroneRow = Record<string, any>;
type ReviewRow = { id: number; annotation: string; annotation_type: string; reviewer: string; created_at: number; };
type AuditRow = { action: string; user__username: string | null; ip_address: string | null; created_at: number; };

const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB per chunk

export function DroneDatasets() {
  const { id = "" } = useParams();
  const { can } = useAuth();
  const [datasets, setDatasets] = useState<DroneRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<DroneRow | null>(null);
  const [activeTab, setActiveTab] = useState<"reviews" | "audit" | "sign" | "analytics">("reviews");
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditRow[]>([]);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [annotation, setAnnotation] = useState("");
  const [annotationType, setAnnotationType] = useState("general");
  const [form, setForm] = useState({ data_type: "image", operator_id: "", flight_date: "", classification: "informational", external_url: "", thumbnail_url: "", file_hash: "", file_size_bytes: "", compliance_declared: false, milestone_id: "", sales_campaign_id: "" });
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadForm, setUploadForm] = useState({ data_type: "image", operator_id: "", flight_date: "", classification: "informational", milestone_id: "" });
  const [confirmAction, setConfirmAction] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  
  // Enhanced filtering and analytics
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const load = () => get<DroneRow[]>(`/projects/${id}/drone-datasets`).then(setDatasets).catch(e => setError(e.message));
  useEffect(() => { load(); }, [id]);

  // Filter datasets
  const filteredDatasets = datasets.filter(ds => {
    const matchesType = !filterType || ds.data_type === filterType;
    const matchesStatus = !filterStatus || ds.review_status === filterStatus;
    const matchesSearch = !searchQuery || 
      ds.operator_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ds.data_type?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesStatus && matchesSearch;
  });

  // Calculate statistics
  const stats = {
    total: datasets.length,
    byType: datasets.reduce((acc, ds) => {
      acc[ds.data_type] = (acc[ds.data_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    byStatus: datasets.reduce((acc, ds) => {
      acc[ds.review_status] = (acc[ds.review_status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    compliant: datasets.filter(ds => ds.compliance_declared).length,
    storageDistribution: datasets.reduce((acc, ds) => {
      acc[ds.storage_tier] = (acc[ds.storage_tier] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };

  const submit = () => {
    setError(null);
    post(`/projects/${id}/drone-datasets`, form).then(() => {
      setForm({ data_type: "image", operator_id: "", flight_date: "", classification: "informational", external_url: "", thumbnail_url: "", file_hash: "", file_size_bytes: "", compliance_declared: false, milestone_id: "", sales_campaign_id: "" });
      load();
    }).catch(e => setError(e.message));
  };

  const archive = (datasetId: number) => {
    setError(null);
    patch(`/projects/${id}/drone-datasets/${datasetId}/archive`, {}).then(load).catch(e => setError(e.message));
  };

  function select(ds: DroneRow) {
    setSelected(ds);
    setActiveTab("reviews");
    setAnnotation("");
    setSignedUrl(null);
    setReviews([]);
    setAuditLogs([]);
    get<AuditRow[]>(`/drone-datasets/${ds.id}/audit-log`).then(setAuditLogs).catch(() => {});
  }

  function submitReview() {
    if (!selected || !annotation.trim()) return;
    post(`/drone-datasets/${selected.id}/review`, { annotation, annotation_type: annotationType }).then((r: any) => {
      setReviews(prev => [r, ...prev]);
      setAnnotation("");
      load();
    }).catch(e => setError(e.message));
  }

  function completeReview() {
    if (!selected) return;
    post(`/drone-datasets/${selected.id}/review/complete`, {}).then(() => {
      load();
      if (selected) setSelected({ ...selected, review_status: "reviewed" });
    }).catch(e => setError(e.message));
  }

  function generateSignedUrl() {
    if (!selected) return;
    get<any>(`/drone-datasets/${selected.id}/sign-url?ttl=3600`).then(r => {
      setSignedUrl(r.signed_url);
      load();
    }).catch(e => setError(e.message));
  }

  function coldArchive() {
    if (!selected) return;
    post(`/drone-datasets/${selected.id}/cold-archive`, {}).then(() => {
      load();
      if (selected) setSelected({ ...selected, storage_tier: "cold", is_archived: true, review_status: "archived" });
    }).catch(e => setError(e.message));
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    setUploadProgress(0);

    try {
      const extra: Record<string, string> = {
        data_type: uploadForm.data_type,
        flight_date: uploadForm.flight_date,
        classification: uploadForm.classification,
        milestone_id: uploadForm.milestone_id,
      };
      // Remove empty extras
      for (const [k, v] of Object.entries(extra)) { if (!v) delete extra[k]; }

      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);
        await droneUploadChunk(id, uploadId, chunk, i, totalChunks, file.name, extra);
        setUploadProgress(Math.round(((i + 1) / totalChunks) * 100));
      }
      setUploadProgress(null);
      load();
      setUploadForm({ data_type: "image", operator_id: "", flight_date: "", classification: "informational", milestone_id: "" });
    } catch (e: any) {
      setError(e.message);
      setUploadProgress(null);
    }
    e.target.value = "";
  }

  return (
    <div>
      <h2>Drone &amp; Satellite Datasets</h2>
      <ErrorBanner message={error} />

      {/* Statistics Dashboard */}
      <div className="grid mb-md" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 20 }}>
        <div className="card card-compact" style={{ borderLeft: "4px solid var(--primary)" }}>
          <div className="row" style={{ gap: 8, alignItems: "center", marginBottom: 8 }}>
            <Plane size={20} style={{ color: "var(--primary)" }} />
            <span className="muted fs-xs">Total Datasets</span>
          </div>
          <div className="fw-700 fs-24">{stats.total}</div>
        </div>
        
        <div className="card card-compact" style={{ borderLeft: "4px solid var(--color-green)" }}>
          <div className="row" style={{ gap: 8, alignItems: "center", marginBottom: 8 }}>
            <CheckCircle2 size={20} style={{ color: "var(--color-green)" }} />
            <span className="muted fs-xs">Compliant</span>
          </div>
          <div className="fw-700 fs-24">{stats.compliant}</div>
        </div>
        
        <div className="card card-compact" style={{ borderLeft: "4px solid var(--color-amber)" }}>
          <div className="row" style={{ gap: 8, alignItems: "center", marginBottom: 8 }}>
            <Activity size={20} style={{ color: "var(--color-amber)" }} />
            <span className="muted fs-xs">Under Review</span>
          </div>
          <div className="fw-700 fs-24">{stats.byStatus.under_review || 0}</div>
        </div>
        
        <div className="card card-compact" style={{ borderLeft: "4px solid var(--color-danger)" }}>
          <div className="row" style={{ gap: 8, alignItems: "center", marginBottom: 8 }}>
            <AlertTriangle size={20} style={{ color: "var(--color-danger)" }} />
            <span className="muted fs-xs">Pending</span>
          </div>
          <div className="fw-700 fs-24">{stats.byStatus.pending || 0}</div>
        </div>
      </div>

      {/* Enhanced Filters */}
      <div className="card mb-md" style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div className="row" style={{ gap: 8, alignItems: "center", flex: 1, minWidth: 200 }}>
            <Search size={16} style={{ color: "var(--muted)" }} />
            <input
              placeholder="Search by operator or type..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ flex: 1, minWidth: 0 }}
            />
          </div>
          
          <select 
            value={filterType} 
            onChange={e => setFilterType(e.target.value)}
            style={{ minWidth: 150 }}
          >
            <option value="">All Types</option>
            <option value="image">Image</option>
            <option value="video">Video</option>
            <option value="orthomosaic">Orthomosaic</option>
            <option value="point_cloud">Point Cloud</option>
            <option value="3d_model">3D Model</option>
            <option value="measurement">Measurement</option>
          </select>
          
          <select 
            value={filterStatus} 
            onChange={e => setFilterStatus(e.target.value)}
            style={{ minWidth: 150 }}
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="under_review">Under Review</option>
            <option value="reviewed">Reviewed</option>
            <option value="linked">Linked</option>
            <option value="archived">Archived</option>
          </select>
          
          <div className="row" style={{ gap: 8 }}>
            <button 
              className={`btn sm ${viewMode === "grid" ? "" : "ghost"}`}
              onClick={() => setViewMode("grid")}
            >
              <Layers size={14} />
            </button>
            <button 
              className={`btn sm ${viewMode === "list" ? "" : "ghost"}`}
              onClick={() => setViewMode("list")}
            >
              <FileText size={14} />
            </button>
          </div>
          
          {(filterType || filterStatus || searchQuery) && (
            <button 
              className="btn ghost sm"
              onClick={() => { setFilterType(""); setFilterStatus(""); setSearchQuery(""); }}
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Datasets Display */}
      {viewMode === "grid" ? (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16, marginBottom: 20 }}>
          {filteredDatasets.map(d => (
            <div 
              key={d.id} 
              className={`card ${selected?.id === d.id ? "active-card" : ""}`}
              style={{ 
                cursor: "pointer",
                border: selected?.id === d.id ? "2px solid var(--primary)" : "1px solid var(--border)",
                transition: "all 0.2s"
              }}
              onClick={() => select(d)}
            >
              <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
                <span className="badge badge-muted" style={{ textTransform: "capitalize" }}>
                  {d.data_type}
                </span>
                <span className={`badge badge-${d.review_status === "reviewed" || d.review_status === "linked" ? "success" : d.review_status === "under_review" ? "warn" : "muted"}`}>
                  {d.review_status}
                </span>
              </div>
              
              <div className="row" style={{ gap: 8, marginBottom: 8, fontSize: 12, color: "var(--muted)" }}>
                <Calendar size={14} />
                <span>{d.flight_date || "—"}</span>
              </div>
              
              <div className="row" style={{ gap: 8, marginBottom: 8, fontSize: 12, color: "var(--muted)" }}>
                <MapPin size={14} />
                <span className="mono">{d.operator_id || "—"}</span>
              </div>
              
              <div className="row" style={{ gap: 8, marginBottom: 12, fontSize: 12, color: "var(--muted)" }}>
                <Globe size={14} />
                <span style={{ textTransform: "capitalize" }}>{d.classification}</span>
              </div>
              
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                <div className="row" style={{ gap: 8, fontSize: 11 }}>
                  <span style={{ color: "var(--muted)" }}>{d.storage_tier}</span>
                  {d.compliance_declared && (
                    <span style={{ color: "var(--color-green)" }}>✓ Compliant</span>
                  )}
                </div>
                <div className="row" style={{ gap: 4 }}>
                  {d.key_outputs && Object.keys(d.key_outputs).length > 0 && (
                    <span className="badge badge-muted" style={{ fontSize: 10 }}>
                      {Object.keys(d.key_outputs).length} outputs
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {filteredDatasets.length === 0 && (
            <div className="card" style={{ gridColumn: "1 / -1", textAlign: "center", padding: 40 }}>
              <Plane size={48} style={{ color: "var(--muted)", marginBottom: 16 }} />
              <p className="muted">No drone datasets found matching your filters.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 20 }}>
          <table>
            <thead><tr>
              <th>Type</th><th>Flight Date</th><th>Operator</th><th>Classification</th>
              <th>Status</th><th>Tier</th><th>Compliant</th><th>Outputs</th><th></th><th></th>
            </tr></thead>
            <tbody>
              {filteredDatasets.map(d => (
                <tr key={d.id} className={selected?.id === d.id ? "active-row" : ""}>
                  <td>{d.data_type}</td><td>{d.flight_date}</td>
                  <td className="mono">{d.operator_id || "—"}</td>
                  <td>{d.classification}</td>
                  <td><span className={`badge badge-${d.review_status === "reviewed" || d.review_status === "linked" ? "success" : d.review_status === "under_review" ? "warn" : "muted"}`}>{d.review_status}</span></td>
                  <td>{d.storage_tier}</td>
                  <td>{d.compliance_declared ? "Yes" : "No"}</td>
                  <td>{Object.keys(d.key_outputs || {}).length}</td>
                  <td><button className="btn ghost sm" onClick={() => select(d)}>Review</button></td>
                  <td>{can("documents.upload") && <button className="btn ghost sm" onClick={() => setConfirmAction({ title: "Archive dataset", message: "Archive this dataset?", onConfirm: () => archive(d.id) })}>Archive</button>}</td>
                </tr>
              ))}
              {filteredDatasets.length === 0 && <tr><td colSpan={10} className="empty">No drone datasets found matching your filters.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="card">
          <div className="row space-between">
            <h3>Dataset #{selected.id} — {selected.data_type}</h3>
            <div className="row" style={{ gap: 8 }}>
              <button className={`btn ghost sm${activeTab === "reviews" ? " active" : ""}`} onClick={() => setActiveTab("reviews")}>Review</button>
              <button className={`btn ghost sm${activeTab === "sign" ? " active" : ""}`} onClick={() => setActiveTab("sign")}>Signed URL</button>
              <button className={`btn ghost sm${activeTab === "audit" ? " active" : ""}`} onClick={() => setActiveTab("audit")}>Audit Log</button>
              <button className={`btn ghost sm${activeTab === "analytics" ? " active" : ""}`} onClick={() => setActiveTab("analytics")}>Analytics</button>
            </div>
          </div>

          {activeTab === "reviews" && (
            <div>
              {Object.keys(selected.key_outputs || {}).length > 0 && (
                <>
                  <h4>Key Outputs</h4>
                  <div className="grid" style={{ marginBottom: 12 }}>
                    {Object.entries(selected.key_outputs || {}).map(([label, url]) => (
                      <div className="card" key={label} style={{ padding: 12 }}>
                        <div className="row space-between">
                          <strong style={{ textTransform: "capitalize" }}>{label.replaceAll("_", " ")}</strong>
                          <a className="btn ghost sm" href={String(url)} target="_blank" rel="noreferrer">Open</a>
                        </div>
                        <p className="mono muted" style={{ wordBreak: "break-all", marginBottom: 0 }}>{String(url)}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="row wrap" style={{ gap: 8, marginBottom: 12 }}>
                <textarea rows={2} placeholder="Annotation / review comment" value={annotation} onChange={e => setAnnotation(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
                <select value={annotationType} onChange={e => setAnnotationType(e.target.value)}>
                  <option value="general">General</option>
                  <option value="structural">Structural</option>
                  <option value="compliance">Compliance</option>
                  <option value="measurement">Measurement</option>
                </select>
                <button className="btn" onClick={submitReview} disabled={!annotation.trim()}>Add Review</button>
              </div>

              {selected.review_status !== "reviewed" && selected.review_status !== "linked" && selected.review_status !== "archived" && (
                <button className="btn success" onClick={() => setConfirmAction({ title: "Mark reviewed", message: "Mark this dataset as reviewed?", onConfirm: () => completeReview() })}>✓ Mark Reviewed</button>
              )}

              <hr />
              <h4>Cold Archive</h4>
              <p className="muted">Move dataset to cold storage. External URL will be replaced with an archive reference.</p>
              <button className="btn danger sm" onClick={() => setConfirmAction({ title: "Cold archive", message: "Move this dataset to cold storage? This cannot be undone.", onConfirm: () => coldArchive() })} disabled={selected.storage_tier === "cold"}>Move to Cold Storage</button>

              {reviews.length > 0 && (
                <>
                  <hr />
                  <h4>Reviews</h4>
                  {reviews.map(r => (
                    <div key={r.id} className="card" style={{ padding: 8 }}>
                      <div className="row space-between">
                        <strong>{r.reviewer}</strong>
                        <span className="badge badge-muted">{r.annotation_type}</span>
                      </div>
                      <p>{r.annotation}</p>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {activeTab === "sign" && (
            <div>
              <button className="btn" onClick={generateSignedUrl}>Generate Signed URL (1hr TTL)</button>
              {signedUrl && (
                <div className="card" style={{ marginTop: 12 }}>
                  <p className="mono" style={{ wordBreak: "break-all" }}>{signedUrl}</p>
                  <div className="row" style={{ gap: 8, marginTop: 8 }}>
                    <button className="btn ghost sm" onClick={() => navigator.clipboard.writeText(signedUrl)}>Copy</button>
                    <a href={signedUrl} target="_blank" rel="noreferrer" className="btn ghost sm">Open</a>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "analytics" && (
            <div>
              <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 16 }}>
                <div className="card card-compact">
                  <div className="muted fs-xs mb-xs">Data Type</div>
                  <div className="fw-700 fs-18" style={{ textTransform: "capitalize" }}>{selected.data_type}</div>
                </div>
                <div className="card card-compact">
                  <div className="muted fs-xs mb-xs">Classification</div>
                  <div className="fw-700 fs-18" style={{ textTransform: "capitalize" }}>{selected.classification}</div>
                </div>
                <div className="card card-compact">
                  <div className="muted fs-xs mb-xs">Storage Tier</div>
                  <div className="fw-700 fs-18" style={{ textTransform: "capitalize" }}>{selected.storage_tier}</div>
                </div>
                <div className="card card-compact">
                  <div className="muted fs-xs mb-xs">File Size</div>
                  <div className="fw-700 fs-18">{selected.file_size_bytes ? `${(Number(selected.file_size_bytes) / 1024 / 1024).toFixed(2)} MB` : "—"}</div>
                </div>
              </div>

              <div className="card" style={{ marginBottom: 16 }}>
                <h4 style={{ marginTop: 0 }}>Key Outputs</h4>
                {Object.keys(selected.key_outputs || {}).length > 0 ? (
                  <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                    {Object.entries(selected.key_outputs || {}).map(([label, url]) => (
                      <div key={label} style={{ 
                        padding: 12, 
                        background: "var(--surface-2)", 
                        borderRadius: 8,
                        border: "1px solid var(--border)"
                      }}>
                        <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
                          <strong style={{ textTransform: "capitalize", fontSize: 12 }}>{label.replaceAll("_", " ")}</strong>
                          <a className="btn ghost sm" href={String(url)} target="_blank" rel="noreferrer" style={{ fontSize: 10 }}>
                            <Eye size={12} />
                          </a>
                        </div>
                        <p className="mono muted" style={{ 
                          wordBreak: "break-all", 
                          marginBottom: 0, 
                          fontSize: 10,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap"
                        }}>{String(url)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted">No key outputs available for this dataset.</p>
                )}
              </div>

              <div className="card">
                <h4 style={{ marginTop: 0 }}>Metadata</h4>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                  <div>
                    <div className="muted fs-xs mb-xs">Flight Date</div>
                    <div>{selected.flight_date || "—"}</div>
                  </div>
                  <div>
                    <div className="muted fs-xs mb-xs">Operator ID</div>
                    <div className="mono">{selected.operator_id || "—"}</div>
                  </div>
                  <div>
                    <div className="muted fs-xs mb-xs">Milestone</div>
                    <div className="mono">{selected.milestone_id || "—"}</div>
                  </div>
                  <div>
                    <div className="muted fs-xs mb-xs">Sales Campaign</div>
                    <div className="mono">{selected.sales_campaign_id || "—"}</div>
                  </div>
                  <div>
                    <div className="muted fs-xs mb-xs">File Hash</div>
                    <div className="mono" style={{ fontSize: 10 }}>{selected.file_hash || "—"}</div>
                  </div>
                  <div>
                    <div className="muted fs-xs mb-xs">Compliance</div>
                    <div>{selected.compliance_declared ? "✓ Declared" : "—"}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "audit" && (
            <div>
              <table>
                <thead><tr><th>Action</th><th>User</th><th>IP</th><th>Timestamp</th></tr></thead>
                <tbody>
                  {auditLogs.map((a, i) => (
                    <tr key={i}>
                      <td><span className={`badge badge-${a.action === "sign_url" ? "warn" : "muted"}`}>{a.action}</span></td>
                      <td>{a.user__username || "system"}</td>
                      <td className="mono">{a.ip_address || "—"}</td>
                      <td>{new Date(a.created_at).toISOString().slice(0, 19).replace("T", " ")}</td>
                    </tr>
                  ))}
                  {auditLogs.length === 0 && <tr><td colSpan={4} className="empty">No audit log entries.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="card">
        <h3>Upload Drone File</h3>
        <p className="muted">Select a file (image, video, LiDAR, etc.) to upload directly. Large files are split into 5 MB chunks automatically.</p>
        <div className="row wrap" style={{ gap: 8, marginBottom: 8 }}>
          <select value={uploadForm.data_type} onChange={e => setUploadForm({ ...uploadForm, data_type: e.target.value })}>
            <option value="image">Image</option>
            <option value="video">Video</option>
            <option value="orthomosaic">Orthomosaic</option>
            <option value="point_cloud">Point Cloud</option>
            <option value="3d_model">3D Model</option>
            <option value="measurement">Measurement</option>
          </select>
          <input placeholder="Operator ID" value={uploadForm.operator_id} onChange={e => setUploadForm({ ...uploadForm, operator_id: e.target.value })} />
          <input type="date" placeholder="Flight date *" value={uploadForm.flight_date} onChange={e => setUploadForm({ ...uploadForm, flight_date: e.target.value })} />
          <select value={uploadForm.classification} onChange={e => setUploadForm({ ...uploadForm, classification: e.target.value })}>
            <option value="informational">Informational</option>
            <option value="verification">Verification</option>
            <option value="measurement">Measurement</option>
          </select>
          <input placeholder="Milestone ID" value={uploadForm.milestone_id} onChange={e => setUploadForm({ ...uploadForm, milestone_id: e.target.value })} />
        </div>
        <input type="file" ref={fileRef} onChange={handleFileUpload} style={{ marginBottom: 8 }} />
        {uploadProgress !== null && (
          <div className="progress" style={{ marginTop: 4 }}>
            <span style={{ width: `${uploadProgress}%` }} />
            <span className="muted" style={{ marginLeft: 8 }}>{uploadProgress}%</span>
          </div>
        )}
      </div>

      <div className="card">
        <h3>Record External Dataset</h3>
        <p className="muted">Or manually record a dataset already hosted at an external URL.</p>
        <div className="row wrap" style={{ gap: 8 }}>
          <select value={form.data_type} onChange={e => setForm({ ...form, data_type: e.target.value })}>
            <option value="image">Image</option>
            <option value="video">Video</option>
            <option value="orthomosaic">Orthomosaic</option>
            <option value="point_cloud">Point Cloud</option>
            <option value="3d_model">3D Model</option>
            <option value="measurement">Measurement</option>
          </select>
          <input placeholder="Operator ID" value={form.operator_id} onChange={e => setForm({ ...form, operator_id: e.target.value })} />
          <input type="date" placeholder="Flight date *" value={form.flight_date} onChange={e => setForm({ ...form, flight_date: e.target.value })} />
          <select value={form.classification} onChange={e => setForm({ ...form, classification: e.target.value })}>
            <option value="informational">Informational</option>
            <option value="verification">Verification</option>
            <option value="measurement">Measurement</option>
          </select>
          <input placeholder="External URL *" value={form.external_url} onChange={e => setForm({ ...form, external_url: e.target.value })} />
          <input placeholder="Thumbnail URL" value={form.thumbnail_url} onChange={e => setForm({ ...form, thumbnail_url: e.target.value })} />
          <input placeholder="File hash (SHA-256)" value={form.file_hash} onChange={e => setForm({ ...form, file_hash: e.target.value })} />
          <input placeholder="File size (bytes)" type="number" value={form.file_size_bytes} onChange={e => setForm({ ...form, file_size_bytes: e.target.value })} />
          <label><input type="checkbox" checked={form.compliance_declared} onChange={e => setForm({ ...form, compliance_declared: e.target.checked })} /> Compliance declared</label>
          <input placeholder="Milestone ID" value={form.milestone_id} onChange={e => setForm({ ...form, milestone_id: e.target.value })} />
          <button className="btn" onClick={submit}>Record</button>
        </div>
      </div>

      <ConfirmModal
        open={!!confirmAction}
        title={confirmAction?.title ?? ""}
        message={confirmAction?.message ?? ""}
        confirmLabel="Confirm"
        onConfirm={() => { confirmAction?.onConfirm(); setConfirmAction(null); }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
