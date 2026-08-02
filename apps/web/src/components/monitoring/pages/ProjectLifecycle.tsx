import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronRight, ClipboardPlus, Download, ExternalLink, Trash2 } from "lucide-react";
import { useParams } from "@/components/monitoring/react-router-shim";

import { del, get, patch, post } from "../api";
import { useAuth } from "../auth";
import { ErrorBanner } from "../components";

type StageKey = "pre_construction" | "construction" | "monitoring" | "drawdowns" | "practical_completion" | "defects_liability";
type LifecycleRecord = {
  id: number; stage: StageKey; record_type: string; title: string; reference: string;
  description: string; status: string; responsible_party: string; authority: string;
  amount: number | null; due_date: string | null; completed_date: string | null;
  document_url: string; created_by: string; reviewed_by: string | null;
};
type LifecycleResponse = { records: LifecycleRecord[]; stage_types: Record<StageKey, string[]> };

const STAGES: { key: StageKey; label: string; color: string }[] = [
  { key: "pre_construction", label: "Pre-construction", color: "#1479b8" },
  { key: "construction", label: "Construction", color: "#62a744" },
  { key: "monitoring", label: "Monitoring", color: "#e9a600" },
  { key: "drawdowns", label: "Drawdowns", color: "#70429a" },
  { key: "practical_completion", label: "Practical completion", color: "#138b8d" },
  { key: "defects_liability", label: "Defects liability", color: "#e96800" },
];
const LABELS: Record<string, string> = {
  feasibility_study: "Feasibility study", land_title: "Land & title record",
  design_drawing: "Design / drawing", contract_appointment: "Contract / appointment",
  insurance: "Insurance", approval_permit: "Approval / permit", risk_assessment: "Risk assessment",
  project_programme: "Project programme", site_mobilisation: "Site mobilisation",
  execution_of_works: "Execution of works", inspection_checklist: "Inspection / checklist",
  labour_material_equipment: "Labour, materials & equipment", site_diary: "Site diary",
  progress_report: "Progress report", compliance_item: "Compliance item",
  safety_environment: "Safety & environment", corrective_action: "Corrective action",
  performance_review: "Performance review", drawdown_request: "Drawdown request",
  document_review: "Document review", valuation_verification: "Valuation & verification",
  drawdown_approval: "Drawdown approval", disbursement_tracking: "Disbursement tracking",
  completion_inspection: "Completion inspection", completion_certificate: "Completion certificate",
  handover_document: "Handover document", snagging_item: "Snagging item",
  as_built_drawing: "As-built drawing", final_account: "Final account",
  occupancy_certificate: "Occupancy certificate", lessons_learned: "Lessons learned",
  defect: "Defect", rectification: "Rectification", retention_release: "Retention release",
  closeout_report: "Close-out report", project_evaluation: "Project evaluation",
  archive_readiness: "Archive readiness",
};
const STATUSES = ["draft", "in_progress", "submitted", "under_review", "approved", "rejected", "completed", "closed"];
const blankForm = {
  record_type: "", title: "", reference: "", description: "", status: "draft",
  responsible_party: "", authority: "", amount: "", due_date: "", document_url: "",
};

export function ProjectLifecycle() {
  const { id = "" } = useParams();
  const { can } = useAuth();
  const editable = can("projects.edit");
  const [data, setData] = useState<LifecycleResponse | null>(null);
  const [stage, setStage] = useState<StageKey>("pre_construction");
  const [form, setForm] = useState(blankForm);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => get<LifecycleResponse>(`/projects/${id}/lifecycle`).then(setData).catch(e => setError(e.message));
  useEffect(() => { load(); }, [id]);
  useEffect(() => {
    const firstType = data?.stage_types[stage]?.[0] || "";
    setForm(f => ({ ...blankForm, record_type: firstType || f.record_type }));
  }, [stage, data]);
  const records = useMemo(() => data?.records.filter(record => record.stage === stage) || [], [data, stage]);

  const save = async () => {
    if (!form.title.trim()) return setError("Enter a title for this record.");
    setBusy(true); setError(null);
    try {
      await post(`/projects/${id}/lifecycle`, { ...form, stage, amount: form.amount || null, due_date: form.due_date || null });
      setForm({ ...blankForm, record_type: data?.stage_types[stage]?.[0] || "" });
      setShowForm(false); await load();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  const changeStatus = async (record: LifecycleRecord, status: string) => {
    setError(null);
    try { await patch(`/projects/${id}/lifecycle/${record.id}`, { status }); await load(); }
    catch (e: any) { setError(e.message); }
  };
  const remove = async (record: LifecycleRecord) => {
    if (!window.confirm(`Delete "${record.title}"?`)) return;
    try { await del(`/projects/${id}/lifecycle/${record.id}`); await load(); }
    catch (e: any) { setError(e.message); }
  };
  const exportCsv = () => {
    const rows = [["Stage", "Record type", "Title", "Reference", "Status", "Responsible party", "Due date", "Completed date"], ...(data?.records || []).map(r => [r.stage, r.record_type, r.title, r.reference, r.status, r.responsible_party, r.due_date || "", r.completed_date || ""] )];
    const csv = rows.map(row => row.map(v => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = `lifecycle-closeout-${id || "project"}.csv`; a.click();
  };

  return <div>
    <div className="page-head">
      <div className="eyebrow">Project lifecycle flow</div>
      <h2>Lifecycle & Close-out</h2>
      <p className="muted">Track every approval, inspection, drawdown, handover and defects-liability obligation through closure.</p>
      <button className="btn ghost sm" onClick={exportCsv}><Download size={14} /> Export lifecycle register</button>
    </div>
    <ErrorBanner message={error} />

    <div className="lifecycle-flow">
      {STAGES.map((item, index) => {
        const all = data?.records.filter(record => record.stage === item.key) || [];
        const done = all.filter(record => ["approved", "completed", "closed"].includes(record.status)).length;
        return <div className="lifecycle-flow-item" key={item.key}>
          <button className={`lifecycle-stage ${stage === item.key ? "active" : ""}`} style={{ "--stage-color": item.color } as React.CSSProperties} onClick={() => setStage(item.key)}>
            <span className="stage-number">{index + 1}</span>
            <strong>{item.label}</strong>
            <small>{done}/{all.length} complete</small>
          </button>
          {index < STAGES.length - 1 && <ChevronRight className="flow-arrow" size={18} />}
        </div>;
      })}
    </div>

    <div className="row" style={{ justifyContent: "space-between", margin: "20px 0 10px" }}>
      <div><h3 style={{ margin: 0 }}>{STAGES.find(item => item.key === stage)?.label}</h3><span className="muted">{records.length} register item{records.length === 1 ? "" : "s"}</span></div>
      {editable && <button className="btn" onClick={() => setShowForm(value => !value)}><ClipboardPlus size={17} /> Add record</button>}
    </div>

    {showForm && <div className="card lifecycle-form">
      <div className="grid-3">
        <div className="field"><label>Record type</label><select value={form.record_type} onChange={e => setForm({ ...form, record_type: e.target.value })}>{data?.stage_types[stage]?.map(type => <option value={type} key={type}>{LABELS[type] || type}</option>)}</select></div>
        <div className="field"><label>Title *</label><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Record title" /></div>
        <div className="field"><label>Reference</label><input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} placeholder="Certificate, contract or request no." /></div>
        <div className="field"><label>Responsible party</label><input value={form.responsible_party} onChange={e => setForm({ ...form, responsible_party: e.target.value })} /></div>
        <div className="field"><label>Authority / reviewer</label><input value={form.authority} onChange={e => setForm({ ...form, authority: e.target.value })} /></div>
        <div className="field"><label>Due date</label><input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
        <div className="field"><label>Amount (if applicable)</label><input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
        <div className="field"><label>Status</label><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>{STATUSES.map(value => <option value={value} key={value}>{value.replaceAll("_", " ")}</option>)}</select></div>
        <div className="field"><label>Document URL</label><input type="url" value={form.document_url} onChange={e => setForm({ ...form, document_url: e.target.value })} placeholder="https://…" /></div>
      </div>
      <div className="field"><label>Description / findings</label><textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
      <div className="row"><button className="btn" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save record"}</button><button className="btn ghost" onClick={() => setShowForm(false)}>Cancel</button></div>
    </div>}

    <div className="card">
      <table>
        <thead><tr><th>Item</th><th>Reference</th><th>Responsible</th><th>Due</th><th>Status</th><th>Evidence</th>{editable && <th>Actions</th>}</tr></thead>
        <tbody>
          {records.map(record => <tr key={record.id}>
            <td><strong>{record.title}</strong><br /><span className="muted">{LABELS[record.record_type] || record.record_type}</span></td>
            <td>{record.reference || "—"}</td><td>{record.responsible_party || record.authority || "—"}</td><td>{record.due_date || "—"}</td>
            <td>{editable ? <select aria-label={`Status for ${record.title}`} value={record.status} onChange={e => changeStatus(record, e.target.value)}>{STATUSES.map(value => <option value={value} key={value}>{value.replaceAll("_", " ")}</option>)}</select> : <span className="badge" style={{ background: ["approved", "completed", "closed"].includes(record.status) ? "var(--success)" : "var(--steel)" }}>{record.status.replaceAll("_", " ")}</span>}</td>
            <td>{record.document_url ? <a href={record.document_url} target="_blank" rel="noreferrer" title="Open evidence"><ExternalLink size={17} /></a> : "—"}</td>
            {editable && <td><button className="btn ghost sm" onClick={() => remove(record)} title="Delete"><Trash2 size={15} /></button></td>}
          </tr>)}
          {!records.length && <tr><td colSpan={editable ? 7 : 6} className="empty"><CheckCircle2 size={20} /> No records yet. Add the first requirement for this stage.</td></tr>}
        </tbody>
      </table>
    </div>
  </div>;
}
