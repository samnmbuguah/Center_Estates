import { AlertTriangle, BarChart3, Building2, CalendarDays, CheckCircle2, CheckSquare, ClipboardList, Clock3, Coins, FileSpreadsheet, FileText, GitCompareArrows, HandCoins, History, MapPin, Pencil, Scale, ScanLine, Ticket, Trash2, TestTube, TrendingUp, Umbrella, Users, Wallet, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "@/components/monitoring/react-router-shim";

import { addApproval, addDocument, addProjectMember, completeOnboarding, deleteApproval, deleteDocument,
  fetchModuleConfig, fetchProject, fetchProjectMembers, fetchProjectAuditLog, fetchUsers, get, removeProjectMember,
  updateApproval, updateModuleConfig,
} from "../api";
import { useAuth } from "../auth";
import { ErrorBanner, ConfirmModal, MiniBoQModal } from "../components";

import { ProjectAssistant } from "../components/ProjectAssistant";
import { apiFetch } from "@/lib/api";

function ModuleConfigRow({ projectId, moduleKey }: { projectId: string; moduleKey: string }) {
  const { can } = useAuth();
  const [editing, setEditing] = useState(false);
  const [threshold, setThreshold] = useState("20");
  const loadCfg = useCallback(() => {
    fetchModuleConfig(projectId, moduleKey).then(c => {
      const t = c.settings?.inflation_threshold;
      if (t != null) setThreshold(String(t));
    }).catch(() => {});
  }, [projectId, moduleKey]);
  useEffect(() => { loadCfg(); }, [loadCfg]);
  if (!editing) {
    return (
      <tr>
        <td style={{ textTransform: "capitalize" }}>{moduleKey}</td>
        <td>{threshold}%</td>
        <td>{can("projects.edit") && <button className="btn ghost sm" onClick={() => setEditing(true)}><Pencil size={14} /></button>}</td>
      </tr>
    );
  }
  const save = () => {
    updateModuleConfig(projectId, moduleKey, { inflation_threshold: parseInt(threshold, 10) || 20 })
      .then(() => setEditing(false))
      .catch(() => {});
  };
  return (
    <tr>
      <td style={{ textTransform: "capitalize" }}>{moduleKey}</td>
      <td>
        <input type="number" min={0} max={100} value={threshold}
          onChange={e => setThreshold(e.target.value)}
          style={{ width: 70 }} /> %
      </td>
      <td>
        <button className="btn sm" onClick={save}>Save</button>
        <button className="btn ghost sm" onClick={() => setEditing(false)}><X size={14} /></button>
      </td>
    </tr>
  );
}

export function ProjectDetail() {
  const { id = "" } = useParams();
  const { can } = useAuth();
  const [p, setP] = useState<any>(null);
  const [doc, setDoc] = useState({ title: "", doc_type: "drawing", remote_url: "", format: "pdf" });
  const [appr, setAppr] = useState({ approval_type: "", authority: "", status: "pending" });
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [addUserId, setAddUserId] = useState("");
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [selectedMiniBoQ, setSelectedMiniBoQ] = useState<any | null>(null);
  const [showAudit, setShowAudit] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [cost, setCost] = useState<any>(null);
  const [issues, setIssues] = useState<any[]>([]);
  const [consultantFees, setConsultantFees] = useState<any[]>([]);
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [extending, setExtending] = useState(false);
  const [extendSuccess, setExtendSuccess] = useState<any>(null);
  const [defaultPrice, setDefaultPrice] = useState("12500000");
  const [defaultDeposit, setDefaultDeposit] = useState("10");

  const load = () => fetchProject(id).then(setP).catch((e) => setError(e.message));
  const loadMembers = () => fetchProjectMembers(id).then(setMembers).catch(() => {});
  useEffect(() => {
    load();
    loadMembers();
    fetchUsers().then(setAllUsers).catch(() => {});
    get<any[]>(`/projects/${id}/milestones`).then(setMilestones).catch(() => {});
    get<any>(`/projects/${id}/cost-dashboard`).then(setCost).catch(() => {});
    get<any[]>(`/issues?project_id=${encodeURIComponent(id)}`).then(setIssues).catch(() => {});
    get<any[]>(`/projects/${id}/consultant-payments`).then(setConsultantFees).catch(() => {});
  }, [id]);
  const run = (fn: () => Promise<unknown>) => { setError(null); fn().then(load).catch((e) => setError((e as Error).message)); };

  if (!p) return error ? <ErrorBanner message={error} /> : <p className="muted">Loading…</p>;
  const averageProgress = milestones.length
    ? Math.round(milestones.reduce((sum, m) => sum + Number(m.percent_complete || 0), 0) / milestones.length)
    : (p.stage === "complete" || p.stage === "closed" ? 100 : p.stage === "active" ? 50 : 0);
  const completedMilestones = milestones.filter(m => Number(m.percent_complete) >= 100).length;
  const nextMilestone = milestones.find(m => Number(m.percent_complete) < 100);
  const budget = Number(cost?.budget ?? p.budget ?? p.tender_amount ?? 0);
  const committed = Number(cost?.committed ?? cost?.certified_to_date ?? 0);
  const budgetPct = budget > 0 ? Math.round((committed / budget) * 100) : 0;
  const money = (v: unknown) => `KES ${Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  return (
    <div>
      <div className="workspace-page-title">
        <div><h2>{p.name}</h2><div className="muted"><MapPin size={13} /> {p.location || "Location not set"} · {String(p.project_type || "standard").replace(/_/g, " ")}</div></div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            className="btn primary sm"
            onClick={() => { setShowExtendModal(true); setExtendSuccess(null); }}
            title="Promote this construction scheme to Sales Management for off-plan and unit sales"
          >
            🚀 Extend to Sales
          </button>
          <Link to={`/app/onboarding/${id}`} className="btn ghost sm">
            <ClipboardList size={14} style={{ marginRight: 4 }} />
            {p.onboarding_complete ? "Edit Onboarding" : "Continue Onboarding"}
          </Link>
        </div>
      </div>

      <div className="workspace-kpis">
        <div className="card workspace-kpi"><div><span>Overall progress</span><strong>{averageProgress}%</strong><small className="success-text">Across {milestones.length} milestones</small></div><div className="ring" style={{ "--value": averageProgress } as any}><span>{averageProgress}%</span></div></div>
        <div className="card workspace-kpi"><div><span>Time status</span><strong className="success-text">{p.stage === "on_hold" ? "On hold" : "On track"}</strong><small>{p.planned_completion_date || "Completion date not set"}</small></div><Clock3 className="success-text" /></div>
        <div className="card workspace-kpi"><div><span>Budget status</span><strong className={budgetPct > 100 ? "danger-text" : ""}>{budgetPct}% committed</strong><small>{money(committed)} of {money(budget)}</small></div><Wallet /></div>
        <div className="card workspace-kpi"><div><span>Next milestone</span><strong>{nextMilestone?.milestone_id || "No pending milestone"}</strong><small>{completedMilestones} of {milestones.length} completed</small></div><CalendarDays /></div>
      </div>

      <div className="workspace-overview-grid">
        <div className="card workspace-panel">
          <div className="panel-title">Project details</div>
          <dl className="project-detail-list">
            <div><dt>Project code</dt><dd>{p.code || "—"}</dd></div>
            <div><dt>Stage</dt><dd className="capitalize">{String(p.stage).replace(/_/g, " ")}</dd></div>
            <div><dt>Start date</dt><dd>{p.planned_start_date || "—"}</dd></div>
            <div><dt>Completion</dt><dd>{p.planned_completion_date || "—"}</dd></div>
            <div><dt>Team members</dt><dd>{members.length}</dd></div>
            <div><dt>Project value</dt><dd>{money(budget)}</dd></div>
          </dl>
        </div>
        <div className="card workspace-panel span-2">
          <div className="panel-title"><span>Progress overview</span><Link to={`/app/projects/${id}/milestones`}>View programme</Link></div>
          <div className="progress-visual">
            <div className="progress-big"><TrendingUp /><strong>{averageProgress}%</strong><span>actual progress</span></div>
            <div className="milestone-bars">
              {milestones.slice(0, 6).map(m => <div key={m.id}><span>{m.milestone_id}</span><div className="progress"><i style={{ width: `${m.percent_complete}%` }} /></div><strong>{m.percent_complete}%</strong></div>)}
              {milestones.length === 0 && <p className="muted">Upload a work plan to generate the project programme.</p>}
            </div>
          </div>
        </div>
        <div className="card workspace-panel">
          <div className="panel-title"><span>Milestones</span><Link to={`/app/projects/${id}/milestones`}>View all</Link></div>
          <div className="compact-list">
            {milestones.slice(0, 6).map(m => (
              <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, overflow: "hidden" }}>
                  {Number(m.percent_complete) >= 100 ? <CheckCircle2 className="success-text" size={14} /> : <Clock3 className="warning-text" size={14} />}
                  <span style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>{m.milestone_id}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  <strong>{m.percent_complete}%</strong>
                  <button
                    className="btn ghost sm"
                    style={{ padding: "2px 6px", fontSize: 11 }}
                    onClick={() => setSelectedMiniBoQ(m)}
                    title="View Mini-BoQ Valuation & AI Audit"
                  >
                    <Coins size={12} /> BoQ
                  </button>
                </div>
              </div>
            ))}
            {milestones.length === 0 && <p className="muted">No milestones yet.</p>}
          </div>
        </div>
        <div className="card workspace-panel span-2">
          <div className="panel-title"><span>Financial summary</span><Link to={`/app/projects/${id}/cost-dashboard`}>View details</Link></div>
          <div className="financial-summary">
            <div><span>Approved budget</span><strong>{money(budget)}</strong></div>
            <div><span>Committed</span><strong>{money(committed)}</strong></div>
            <div><span>Certified</span><strong>{money(cost?.certified_to_date)}</strong></div>
            <div><span>Paid</span><strong>{money(cost?.paid_to_date)}</strong></div>
          </div>
          <div className="progress progress-lg"><span style={{ width: `${Math.min(budgetPct, 100)}%` }} /></div>
        </div>
        <div className="card workspace-panel">
          <div className="panel-title"><span>Top risks & issues</span><Link to={`/app/issues?project_id=${id}`}>View all</Link></div>
          <div className="compact-list">
            {issues.slice(0, 5).map(issue => <div key={issue.id}><AlertTriangle className={issue.flag === "urgent" ? "danger-text" : "warning-text"} /><span>{issue.body || issue.title || "Project issue"}</span><strong>{issue.flag}</strong></div>)}
            {issues.length === 0 && <div className="empty-state-inline"><CheckCircle2 /> No open project issues</div>}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="panel-title">Project quick actions</div>
        <div className="row wrap" style={{ marginTop: 12, gap: 8 }}>
          {(p.modules ?? []).includes("quality") && (
            <Link to={`/app/projects/${id}/quality-tests`} className="btn ghost"><TestTube size={16} /> Quality Tests</Link>
          )}
          {(p.modules ?? []).includes("consultant") && (
            <Link to={`/app/projects/${id}/consultant-payments`} className="btn ghost"><Wallet size={16} /> Consultant Payments</Link>
          )}
          {(p.modules ?? []).includes("bim") && (
            <Link to={`/app/projects/${id}/bim-models`} className="btn ghost"><Building2 size={16} /> BIM Models</Link>
          )}
          {(p.modules ?? []).includes("drone") && (
            <Link to={`/app/projects/${id}/drone-datasets`} className="btn ghost"><ScanLine size={16} /> Drone Datasets</Link>
          )}
          {(p.modules ?? []).includes("cost") && (
            <>
              <Link to={`/app/projects/${id}/cost-dashboard`} className="btn ghost"><BarChart3 size={16} /> Cost Dashboard</Link>
              <Link to={`/app/projects/${id}/variations`} className="btn ghost"><GitCompareArrows size={16} /> Variations</Link>
              <Link to={`/app/projects/${id}/provisional-sums`} className="btn ghost"><Scale size={16} /> Provisional Sums</Link>
              <Link to={`/app/projects/${id}/contingency-drawdowns`} className="btn ghost"><Umbrella size={16} /> Contingency</Link>
              <Link to={`/app/projects/${id}/advance-payments`} className="btn ghost"><HandCoins size={16} /> Advance Payments</Link>
            </>
          )}
          <Link to={`/app/projects/${id}/milestones`} className="btn ghost"><ClipboardList size={16} /> Milestones</Link>
          <Link to={`/app/projects/${id}/ingestion`} className="btn ghost"><FileSpreadsheet size={16} /> BoQ / Work Plan</Link>
<Link to={`/app/projects/${id}/boq-review`} className="btn ghost"><CheckSquare size={16} /> BoQ Review</Link>
          <Link to={`/app/tickets?project_id=${id}`} className="btn ghost"><Ticket size={16} /> Tickets</Link>
        </div>
      </div>

      <h3>Documents</h3>
      <div className="card">
        <table>
          <thead><tr><th>Title</th><th>Type</th><th>Version</th>{can("documents.upload") && <th></th>}</tr></thead>
          <tbody>
            {(p.documents ?? []).map((d: any) => (
              <tr key={d.id}>
                <td>{d.latest_url ? <a href={d.latest_url} target="_blank" rel="noreferrer">{d.title}</a> : d.title}</td>
                <td>{d.doc_type}</td><td className="mono">v{d.current_version}</td>
                {can("documents.upload") && (
                  <td><button className="btn ghost sm" title="Delete" onClick={() => setConfirmAction({ title: "Delete document", message: `Delete "${d.title}"?`, onConfirm: () => run(() => deleteDocument(id, d.id)) })}><Trash2 size={14} /></button></td>
                )}
              </tr>
            ))}
            {(p.documents ?? []).length === 0 && <tr><td colSpan={4} className="empty">No documents.</td></tr>}
          </tbody>
        </table>
        {can("documents.upload") && (
          <div className="row" style={{ marginTop: 8 }}>
            <input placeholder="Title" value={doc.title} onChange={(e) => setDoc({ ...doc, title: e.target.value })} />
            <input placeholder="URL (upload first)" value={doc.remote_url} onChange={(e) => setDoc({ ...doc, remote_url: e.target.value })} />
            <button className="btn" onClick={() => addDocument(id, doc).then(() => { setDoc({ ...doc, title: "", remote_url: "" }); load(); })}>
              Add
            </button>
          </div>
        )}
      </div>

      <h3>Module Settings</h3>
      <div className="card">
        <table>
          <thead><tr><th>Module</th><th>Inflation Threshold (%)</th><th></th></tr></thead>
          <tbody>
            {["quality", "consultant", "bim", "drone"].filter(m => (p.modules ?? []).includes(m)).map(m => (
              <ModuleConfigRow key={m} projectId={id} moduleKey={m} />
            ))}
            {(p.modules ?? []).filter((m: string) => ["quality", "consultant", "bim", "drone"].includes(m)).length === 0 &&
              <tr><td colSpan={3} className="empty">No modular features enabled for this project.</td></tr>}
          </tbody>
        </table>
      </div>

      <h3>Project Members</h3>
      <div className="card">
        <table>
          <thead><tr><th>User</th><th>Email</th><th>Role</th><th>Label</th>{can("projects.edit") && <th></th>}</tr></thead>
          <tbody>
            {members.map(m => (
              <tr key={m.id}>
                <td>{m.username}</td><td>{m.email}</td>
                <td>{m.role_name || "—"}</td><td>{m.label || "—"}</td>
                {can("projects.edit") && (
                  <td><button className="btn ghost sm" title="Remove"
                    onClick={() => setConfirmAction({ title: "Remove member", message: `Remove ${m.username} from project?`, onConfirm: () => removeProjectMember(id, m.id).then(loadMembers) })}><Trash2 size={14} /></button></td>
                )}
              </tr>
            ))}
            {members.length === 0 && <tr><td colSpan={5} className="empty">No members.</td></tr>}
          </tbody>
        </table>
        {can("projects.edit") && (
          <div className="row" style={{ marginTop: 8 }}>
            <select value={addUserId} onChange={e => setAddUserId(e.target.value)} style={{ flex: 1 }}>
              <option value="">Select user to add...</option>
              {allUsers
                .filter(u => !members.find((m: any) => m.username === u.username))
                .map((u: any) => (
                  <option key={u.id} value={u.id}>{u.username}{u.email ? ` (${u.email})` : ""}</option>
                ))}
            </select>
            <button className="btn" disabled={!addUserId} onClick={() =>
              addProjectMember(id, { user_id: addUserId }).then(() => { setAddUserId(""); loadMembers(); })
            }>Add</button>
          </div>
        )}
        <div style={{ marginTop: 18, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
          <div className="row flex-between mb-sm"><strong>Approved Consultant Fees</strong><span className="muted fs-sm">Loaded for this project</span></div>
          {consultantFees.length === 0 ? <div className="muted fs-sm">No approved consultant fees have been entered.</div> : <table><thead><tr><th>Consultant</th><th>Role</th><th>Approved Fee</th><th>Paid</th><th>Outstanding</th></tr></thead><tbody>
            {Object.values(consultantFees.reduce((acc: Record<string, any>, c: any) => { const k = c.consultant_name; const row = acc[k] || { name: k, role: c.consultant_role, approved: 0, paid: 0 }; row.approved = Math.max(row.approved, Number(c.approved_fee || 0)); if (c.status === "paid") row.paid += Number(c.amount || 0); acc[k] = row; return acc; }, {})).map((c: any) => <tr key={c.name}><td>{c.name}</td><td>{String(c.role || "").replace(/_/g, " ")}</td><td className="mono">KES {c.approved.toLocaleString()}</td><td className="mono">KES {c.paid.toLocaleString()}</td><td className="mono">KES {Math.max(c.approved - c.paid, 0).toLocaleString()}</td></tr>)}
          </tbody></table>}
        </div>
      </div>

      <h3>Approvals &amp; Permits</h3>
      <div className="card">
        <table>
          <thead><tr><th>Type</th><th>Authority</th><th>Status</th><th>Expired</th>{can("projects.edit") && <th></th>}</tr></thead>
          <tbody>
            {(p.approvals ?? []).map((a: any) => (
              <tr key={a.id}>
                <td>{a.approval_type}</td><td>{a.authority}</td>
                <td>
                  {can("projects.edit") ? (
                    <select value={a.status} onChange={(e) => run(() => updateApproval(id, a.id, { status: e.target.value }))}>
                      {["pending", "approved", "rejected", "expired"].map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  ) : a.status}
                </td>
                <td style={{ color: a.expired ? "var(--danger)" : undefined }}>{a.expired ? "EXPIRED" : "—"}</td>
                {can("projects.edit") && (
                  <td><button className="btn ghost sm" title="Delete" onClick={() => setConfirmAction({ title: "Delete approval", message: "Delete this approval?", onConfirm: () => run(() => deleteApproval(id, a.id)) })}><Trash2 size={14} /></button></td>
                )}
              </tr>
            ))}
            {(p.approvals ?? []).length === 0 && <tr><td colSpan={5} className="empty">No approvals.</td></tr>}
          </tbody>
        </table>
        {can("projects.edit") && (
          <div className="row" style={{ marginTop: 8 }}>
            <input placeholder="Type (e.g. NEMA)" value={appr.approval_type} onChange={(e) => setAppr({ ...appr, approval_type: e.target.value })} />
            <input placeholder="Authority" value={appr.authority} onChange={(e) => setAppr({ ...appr, authority: e.target.value })} />
            <button className="btn" onClick={() => addApproval(id, appr).then(() => { setAppr({ approval_type: "", authority: "", status: "pending" }); load(); })}>
              Add
            </button>
          </div>
        )}
      </div>

      {/* Change History */}
      <div style={{ marginTop: 16 }}>
        <button className="btn ghost" onClick={() => {
          if (!showAudit) fetchProjectAuditLog(id).then(d => setAuditLog(d.results ?? [])).catch(() => {});
          setShowAudit(!showAudit);
        }}>
          <History size={14} style={{ marginRight: 6 }} />
          {showAudit ? "Hide" : "Show"} Change History
        </button>
        {showAudit && (
          <div className="card" style={{ marginTop: 8 }}>
            <h4 style={{ margin: 0, marginBottom: 8 }}>Change History</h4>
            {auditLog.length === 0 ? (
              <p className="muted" style={{ fontSize: 13 }}>No changes recorded yet.</p>
            ) : (
              <table style={{ fontSize: 12 }}>
                <thead><tr><th>Date</th><th>User</th><th>Action</th><th>Details</th></tr></thead>
                <tbody>
                  {auditLog.map((e: any) => (
                    <tr key={e.id}>
                      <td className="muted" style={{ whiteSpace: "nowrap" }}>
                        {new Date(e.timestamp / 1000).toLocaleDateString()}
                      </td>
                      <td>{e.user}</td>
                      <td><code style={{ fontSize: 11 }}>{e.action}</code></td>
                      <td style={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis" }}>{e.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      <ProjectAssistant projectId={id} projectName={p.name} />

      <ConfirmModal
        open={!!confirmAction}
        title={confirmAction?.title ?? ""}
        message={confirmAction?.message ?? ""}
        confirmLabel="Confirm"
        onConfirm={() => { confirmAction?.onConfirm(); setConfirmAction(null); }}
        onCancel={() => setConfirmAction(null)}
      />

      {showExtendModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(15, 23, 42, 0.65)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        }}>
          <div style={{
            background: "var(--surface, #ffffff)", borderRadius: 12,
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
            maxWidth: 480, width: "100%", padding: 24, border: "1px solid var(--border)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                🚀 Extend Project to Sales Management
              </h3>
              <button type="button" className="btn ghost sm" onClick={() => setShowExtendModal(false)}>✕</button>
            </div>

            {extendSuccess ? (
              <div style={{ textAlign: "center", padding: "12px 0" }}>
                <div style={{ fontSize: 44, marginBottom: 8 }}>🎉</div>
                <h4 style={{ margin: "0 0 6px" }}>Successfully Extended to Sales!</h4>
                <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
                  {extendSuccess.message || "Project is now linked to Sales Management."}
                  {extendSuccess.listings_created > 0 && ` Created ${extendSuccess.listings_created} unit listings.`}
                </p>
                <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                  <button type="button" className="btn ghost sm" onClick={() => setShowExtendModal(false)}>Close</button>
                  <a href="/sales?tab=inventory" className="btn primary sm">Open Sales CRM &rarr;</a>
                </div>
              </div>
            ) : (
              <form onSubmit={async (e) => {
                e.preventDefault();
                setExtending(true);
                setError(null);
                try {
                  const res = await apiFetch("/sales/projects/extend-from-construction/", {
                    method: "POST",
                    body: JSON.stringify({
                      construction_project_id: id,
                      default_list_price: defaultPrice || undefined,
                      default_deposit_percent: defaultDeposit || 10,
                    }),
                  });
                  if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.detail || err.message || "Failed to extend project to Sales");
                  }
                  const data = await res.json();
                  setExtendSuccess(data);
                } catch (err: any) {
                  setError(err.message);
                } finally {
                  setExtending(false);
                }
              }}>
                <p className="muted" style={{ fontSize: 13, margin: "0 0 16px" }}>
                  This will register <strong>{p.name}</strong> as an active Sales Project in the Sales module, carrying over its building profile and feeding construction progress into sales listings.
                </p>

                <div style={{ display: "grid", gap: 12, marginBottom: 18 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Default Unit List Price (KES)</label>
                    <input
                      type="number"
                      min="1"
                      className="form-control"
                      style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border)" }}
                      value={defaultPrice}
                      onChange={(e) => setDefaultPrice(e.target.value)}
                      placeholder="12500000"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Minimum Deposit %</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      className="form-control"
                      style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border)" }}
                      value={defaultDeposit}
                      onChange={(e) => setDefaultDeposit(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button type="button" className="btn ghost" onClick={() => setShowExtendModal(false)}>Cancel</button>
                  <button type="submit" className="btn primary" disabled={extending}>
                    {extending ? "Extending..." : "Launch in Sales"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      <MiniBoQModal
        open={!!selectedMiniBoQ}
        milestone={selectedMiniBoQ}
        projectId={id}
        onClose={() => setSelectedMiniBoQ(null)}
      />
    </div>
  );
}

