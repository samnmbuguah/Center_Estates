import { CalendarCheck, CheckCircle2, Clock3, Coins, Flag, Pencil, Sparkles, Target, Trash2, TrendingUp, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "@/components/monitoring/react-router-shim";

import { autoMapBoQToMilestones, createMilestone, deleteMilestone, fetchMilestones, updateMilestone } from "../api";
import { useAuth } from "../auth";
import { ErrorBanner, ConfirmModal, MiniBoQModal } from "../components";


const EVIDENCE_OPTIONS = [
  { value: "photo", label: "Photo" },
  { value: "document", label: "Document" },
  { value: "photo_360", label: "360° Photo" },
  { value: "drone", label: "Drone" },
  { value: "geo_tag", label: "Geo Tag" },
];

const ROLE_OPTIONS = [
  { value: "", label: "— Select —" },
  { value: "structural_engineer", label: "Structural Engineer" },
  { value: "architect", label: "Architect" },
  { value: "mep_engineer", label: "MEP Engineer" },
  { value: "qs", label: "Quantity Surveyor" },
  { value: "project_manager", label: "Project Manager" },
];

interface MilestoneRow {
  id: string;
  project_id: string;
  milestone_id: string;
  percent_complete: number;
  required_evidence_types: string[];
  required_certifying_role: string;
  payment_instruction: string;
  payment_value: string | null;
  submitted_at: number | null;
  created_at: number;
}

function evidenceLabel(v: string) {
  return EVIDENCE_OPTIONS.find((o) => o.value === v)?.label ?? v;
}

export function Milestones() {
  const { id = "" } = useParams();
  const { can } = useAuth();
  const [items, setItems] = useState<MilestoneRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<MilestoneRow | null>(null);
  const [selectedMiniBoQ, setSelectedMiniBoQ] = useState<MilestoneRow | null>(null);
  const [autoMappingAll, setAutoMappingAll] = useState(false);

  const [form, setForm] = useState({
    milestone_id: "",
    percent_complete: 0,
    required_evidence_types: [] as string[],
    required_certifying_role: "",
    payment_instruction: "",
    payment_value: "",
  });

  const load = useCallback(
    () => fetchMilestones(id).then(setItems).catch((e) => setError(e.message)),
    [id],
  );
  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setForm({ milestone_id: "", percent_complete: 0, required_evidence_types: [], required_certifying_role: "", payment_instruction: "", payment_value: "" });
    setEditId(null);
  };

  const handleAutoMapAll = async () => {
    if (!id) return;
    setAutoMappingAll(true);
    setError(null);
    try {
      await autoMapBoQToMilestones(id);
      await load();
    } catch (err: any) {
      setError(err.message || "Failed to auto-map BoQ to milestones");
    } finally {
      setAutoMappingAll(false);
    }
  };

  const toggleEvidence = (v: string) => {
    setForm((f) => ({
      ...f,
      required_evidence_types: f.required_evidence_types.includes(v)
        ? f.required_evidence_types.filter((x) => x !== v)
        : [...f.required_evidence_types, v],
    }));
  };

  const submit = () => {
    if (!form.milestone_id.trim()) { setError("Milestone ID is required"); return; }
    setLoading(true);
    setError(null);
    (editId
      ? updateMilestone(id, editId, form)
      : createMilestone(id, form)
    )
      .then(() => { resetForm(); load(); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  const startEdit = (m: MilestoneRow) => {
    setForm({
      milestone_id: m.milestone_id,
      percent_complete: m.percent_complete,
      required_evidence_types: m.required_evidence_types,
      required_certifying_role: m.required_certifying_role,
      payment_instruction: m.payment_instruction,
      payment_value: m.payment_value ?? "",
    });
    setEditId(m.milestone_id);
  };

  const doDelete = (m: MilestoneRow) => {
    deleteMilestone(id, m.milestone_id).then(load).catch((e) => setError(e.message));
  };

  const statusBadge = (m: MilestoneRow) =>
    m.submitted_at ? <span className="badge submitted">Submitted</span> : <span className="badge draft">Draft</span>;
  const completed = items.filter(m => m.percent_complete >= 100).length;
  const inProgress = items.filter(m => m.percent_complete > 0 && m.percent_complete < 100).length;
  const overall = items.length ? Math.round(items.reduce((sum, m) => sum + Number(m.percent_complete), 0) / items.length) : 0;

  return (
    <div>
      <div className="page-head"><div className="eyebrow">Project programme</div><h2>Programme &amp; Milestones</h2><p className="muted">Planned activities, actual progress and certification readiness</p></div>
      <ErrorBanner message={error} />
      <div className="programme-kpis">
        <div className="card programme-kpi"><TrendingUp /><span>Overall progress<strong>{overall}%</strong><small>Actual completion</small></span></div>
        <div className="card programme-kpi success"><CheckCircle2 /><span>Completed<strong>{completed}</strong><small>of {items.length} milestones</small></span></div>
        <div className="card programme-kpi warning"><Clock3 /><span>In progress<strong>{inProgress}</strong><small>Active activities</small></span></div>
        <div className="card programme-kpi"><Flag /><span>Not started<strong>{Math.max(items.length - completed - inProgress, 0)}</strong><small>Pending activities</small></span></div>
        <div className="card programme-kpi success"><Target /><span>Performance<strong>{overall >= 70 ? "On track" : "Monitor"}</strong><small>Based on actual progress</small></span></div>
      </div>

      <div className="card programme-chart">
        <div className="panel-title"><span>Programme performance</span><span className="chart-legend"><i className="planned" /> Planned <i className="actual" /> Actual</span></div>
        <div className="performance-columns">
          {items.slice(0, 12).map((m, index) => {
            const planned = Math.min(100, Math.round(((index + 1) / Math.max(items.length, 1)) * 100));
            return <div key={m.id} title={`${m.milestone_id}: ${m.percent_complete}% actual`}>
              <div className="performance-bars"><i style={{ height: `${planned}%` }} /><b style={{ height: `${m.percent_complete}%` }} /></div>
              <span>M{index + 1}</span>
            </div>;
          })}
          {items.length === 0 && <div className="empty">Upload or create milestones to display the performance curve.</div>}
        </div>
      </div>

      <div className="card programme-gantt">
        <div className="panel-title"><span>Programme activities</span><small>{items.length} activities</small></div>
        {items.slice(0, 12).map((m, index) => (
          <div className="gantt-row" key={m.id}>
            <span>Activity {index + 1}</span>
            <div className="gantt-track"><i style={{ left: `${Math.min(index * 5, 55)}%`, width: `${Math.max(12, Math.min(40, m.percent_complete / 2.5))}%` }} /></div>
            <strong>{m.percent_complete} pct</strong>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="panel-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Milestone register</span>
          <button
            className="btn ghost sm"
            onClick={handleAutoMapAll}
            disabled={autoMappingAll || loading}
            title="Automatically match project BoQ line items across all milestones"
          >
            <Sparkles size={14} className={autoMappingAll ? "spin" : ""} />
            <span>{autoMappingAll ? "Auto-Mapping..." : "Auto-Map All BoQ"}</span>
          </button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Milestone ID</th>
              <th>% Complete</th>
              <th>Required Evidence</th>
              <th>Required Role</th>
              <th>Payment Instr.</th>
              <th>Payment Value</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((m) => (
              <tr key={m.id}>
                <td className="mono">{m.milestone_id}</td>
                <td>{m.percent_complete}%</td>
                <td style={{ fontSize: 12 }}>{m.required_evidence_types.map(evidenceLabel).join(", ") || "—"}</td>
                <td>{ROLE_OPTIONS.find((r) => r.value === m.required_certifying_role)?.label || "—"}</td>
                <td style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>{m.payment_instruction || "—"}</td>
                <td className="mono">{m.payment_value ? Number(m.payment_value).toLocaleString() : "—"}</td>
                <td>{statusBadge(m)}</td>
                <td>
                  <button
                    className="btn ghost sm"
                    onClick={() => setSelectedMiniBoQ(m)}
                    title="Mini-BoQ Valuation & AI Audit"
                    style={{ marginRight: 4 }}
                  >
                    <Coins size={14} /> Mini-BoQ
                  </button>
                  {!m.submitted_at && (
                    <>
                      <button className="btn ghost sm" onClick={() => startEdit(m)} title="Edit"><Pencil size={14} /></button>
                      <button className="btn ghost sm" onClick={() => setConfirmTarget(m)} title="Delete"><Trash2 size={14} /></button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={8} className="empty">No milestones yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <details className="card collapsible-card" open={!!editId}>
        <summary><CalendarCheck size={16} /> {editId ? "Edit Milestone" : "New Milestone"}</summary>
        <div className="collapsible-content">
        <div className="row wrap" style={{ gap: 8, alignItems: "flex-start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600 }}>Milestone ID</label>
            <input
              value={form.milestone_id}
              onChange={(e) => setForm({ ...form, milestone_id: e.target.value })}
              style={{ width: 180 }}
              disabled={loading || !!editId}
              placeholder="e.g. M-001"
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600 }}>% Complete</label>
            <input
              type="number" min={0} max={100}
              value={form.percent_complete}
              onChange={(e) => setForm({ ...form, percent_complete: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
              style={{ width: 80 }}
              disabled={loading}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600 }}>Required Evidence</label>
            <div className="row wrap" style={{ gap: 6 }}>
              {EVIDENCE_OPTIONS.map((o) => (
                <label key={o.value} style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 3, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={form.required_evidence_types.includes(o.value)}
                    onChange={() => toggleEvidence(o.value)}
                    disabled={loading}
                  />
                  {o.label}
                </label>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600 }}>Certifying Role</label>
            <select
              value={form.required_certifying_role}
              onChange={(e) => setForm({ ...form, required_certifying_role: e.target.value })}
              disabled={loading}
              style={{ width: 170 }}
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600 }}>Payment Instruction</label>
            <input
              value={form.payment_instruction}
              onChange={(e) => setForm({ ...form, payment_instruction: e.target.value })}
              style={{ width: 200 }}
              disabled={loading}
              placeholder="Optional"
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600 }}>Payment Value</label>
            <input
              type="number" step="0.01"
              value={form.payment_value}
              onChange={(e) => setForm({ ...form, payment_value: e.target.value })}
              style={{ width: 150 }}
              disabled={loading}
              placeholder="KES amount"
            />
          </div>
          <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 44 }}>
            <button className="btn" onClick={submit} disabled={loading}>
              {editId ? "Update" : "Create"}
            </button>
            {editId && (
              <button className="btn ghost" onClick={resetForm} disabled={loading}>
                <X size={14} /> Cancel
              </button>
            )}
          </div>
        </div>
        </div>
      </details>
      <ConfirmModal
        open={!!confirmTarget}
        title="Delete milestone"
        message={confirmTarget ? `Delete milestone "${confirmTarget.milestone_id}"?` : ""}
        confirmLabel="Delete"
        onConfirm={() => { if (confirmTarget) doDelete(confirmTarget); setConfirmTarget(null); }}
        onCancel={() => setConfirmTarget(null)}
      />
      <MiniBoQModal
        open={!!selectedMiniBoQ}
        milestone={selectedMiniBoQ}
        projectId={id}
        onClose={() => setSelectedMiniBoQ(null)}
        onSuccess={load}
      />
    </div>
  );
}
