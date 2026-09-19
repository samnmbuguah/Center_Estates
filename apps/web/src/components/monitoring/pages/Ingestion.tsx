import { useEffect, useState } from "react";
import { useParams } from "@/components/monitoring/react-router-shim";
import { Bot, Download, FileSpreadsheet, Upload, ClipboardList, Scale, Edit3 } from "lucide-react";

import { convertProjectPdf, fetchIngestionStatus, generateMilestones, ingestExcelPreview, workplanTemplateUrl, boqTemplateUrl, ingestExcelCommit } from "../api";
import { ErrorBanner, ConfirmModal } from "../components";

import { useWorkspace } from "../context/WorkspaceContext";

export function Ingestion() {
  const { id: paramId = "" } = useParams();
  const { activeProjectId } = useWorkspace();
  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const queryId = searchParams?.get("id") || "";
  const queryType = searchParams?.get("type") || "";
  const id = paramId || activeProjectId || queryId || (typeof window !== "undefined" ? sessionStorage.getItem("activeProject") || "" : "");

  const [status, setStatus] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [wpDraft, setWpDraft] = useState<any[] | null>(null);
  const [boqDraft, setBoqDraft] = useState<any[] | null>(null);
  const [wpFile, setWpFile] = useState<File | null>(null);
  const [boqFile, setBoqFile] = useState<File | null>(null);
  const [showUploadConfirm, setShowUploadConfirm] = useState(false);

  const loadStatus = () => { fetchIngestionStatus(id).then(setStatus).catch(() => {}); };
  useEffect(() => { loadStatus(); }, [id]);

  const updateWpItem = (i: number, field: string, value: string) => {
    if (!wpDraft) return;
    const next = [...wpDraft];
    next[i] = { ...next[i], [field]: value };
    setWpDraft(next);
  };

  const updateBoqItem = (i: number, field: string, value: string) => {
    if (!boqDraft) return;
    const next = [...boqDraft];
    next[i] = { ...next[i], [field]: value };
    setBoqDraft(next);
  };

  const handleWpUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setWpFile(file);
    setError(null);
    setUploading(true);
    try {
      const r = await ingestExcelPreview(id, file);
      if (r.work_plan_tasks?.length) {
        setWpDraft(r.work_plan_tasks);
        setMsg(`Work Plan: ${r.work_plan_tasks.length} tasks parsed`);
      } else {
        setError("No tasks found in the file. Use the Work Plan template.");
      }
    } catch (e: any) { setError(e.message); }
    finally { setUploading(false); }
  };

  const handleBoqUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBoqFile(file);
    setError(null);
    setUploading(true);
    try {
      const r = await ingestExcelPreview(id, file);
      if (r.boq_items?.length) {
        setBoqDraft(r.boq_items);
        setMsg(`BoQ: ${r.boq_items.length} items parsed`);
      } else {
        setError("No BoQ items found. Use the BoQ template.");
      }
    } catch (e: any) { setError(e.message); }
    finally { setUploading(false); }
  };

  const handlePdfConversion = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError(null); setMsg("AI is converting the PDF into the standard template…");
    try {
      const result = await convertProjectPdf(id, file);
      if (result.work_plan_tasks?.length) setWpDraft(result.work_plan_tasks);
      if (result.boq_items?.length) setBoqDraft(result.boq_items);
      if (!result.work_plan_tasks?.length && !result.boq_items?.length) {
        setError("No BoQ items or work-plan tasks could be identified.");
      } else {
        setMsg(`AI draft ready: ${result.work_plan_tasks?.length || 0} tasks and ${result.boq_items?.length || 0} BoQ items. Review every row before committing.`);
      }
    } catch (e: any) { setError(e.message); setMsg(null); }
    finally { setUploading(false); e.target.value = ""; }
  };

  const doCommit = async () => {
    setUploading(true);
    setError(null);
    try {
      const payload: any = {};
      if (wpDraft) payload.work_plan_tasks = wpDraft;
      if (boqDraft) payload.boq_items = boqDraft;
      const r: any = await ingestExcelCommit(id, payload);
      setMsg(`Saved. ${r.work_plan_tasks || 0} tasks, ${r.boq_items || 0} BoQ items, ${r.milestones_created || 0} milestones.`);
      setWpDraft(null); setBoqDraft(null);
      setWpFile(null); setBoqFile(null);
      loadStatus();
    } catch (e: any) { setError(e.message); }
    finally { setUploading(false); }
  };

  const handleCommit = async () => {
    if (!wpDraft && !boqDraft) return;
    const existingTasks = (status?.work_plan_tasks?.length ?? 0) > 0;
    const existingBoq = (status?.boq_items?.length ?? 0) > 0;
    const willReplaceWp = wpDraft && existingTasks;
    const willReplaceBoq = boqDraft && existingBoq;
    if (willReplaceWp || willReplaceBoq) {
      setShowUploadConfirm(true);
      return;
    }
    doCommit();
  };

  const commitWithReplace = () => { setShowUploadConfirm(false); doCommit(); };

  const handleGenerateMilestones = async () => {
    setUploading(true);
    try {
      const r = await generateMilestones(id);
      setMsg(`Generated ${r.milestones_created} milestones`);
      loadStatus();
    } catch (e: any) { setError(e.message); }
    finally { setUploading(false); }
  };

  const taskCount = status?.work_plan_tasks?.length ?? 0;
  const boqCount = status?.boq_items?.length ?? 0;

  return (
    <div>
      <div className="page-head">
        <h2>BoQ &amp; Work Plan Ingestion</h2>
        <p className="muted">Upload your Work Plan and Bill of Quantities separately. Review and edit before committing.</p>
      </div>
      <ErrorBanner message={error} />

      {queryType && (
        <div
          className="card mb-md"
          style={{
            background: "var(--accent-subtle, rgba(59,130,246,0.08))",
            border: "1px solid var(--accent, #3b82f6)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 16px",
          }}
        >
          <span style={{ fontSize: 20 }}>{queryType === "boq" ? "📐" : "⏱️"}</span>
          <span style={{ fontSize: 13 }}>
            Direct setup active for <strong>{queryType === "boq" ? "Bill of Quantities (BoQ)" : "Work Programme Schedule"}</strong>. Upload your spreadsheet below or convert from a tender PDF document.
          </span>
        </div>
      )}

      <div className="card ai-conversion-card">
        <div><Bot /><span><strong>Convert an existing PDF with AI</strong><small>Upload a text-bearing BoQ or work plan PDF. The result opens below as an editable draft and is never saved until you review and commit it.</small></span></div>
        <label className="btn" style={{ cursor: "pointer" }}><Upload size={14} /> Convert PDF<input hidden type="file" accept=".pdf,application/pdf" onChange={handlePdfConversion} disabled={uploading} /></label>
      </div>

      <div className="grid-2 mb-md">
        {/* Work Plan */}
        <div
          className="card"
          style={{
            border: queryType === "workplan" ? "2px solid var(--accent, #3b82f6)" : undefined,
            boxShadow: queryType === "workplan" ? "0 0 0 3px rgba(59,130,246,0.15)" : undefined,
          }}
        >
          <div className="row flex-center mb-sm">
            <ClipboardList size={18} style={{ color: "var(--steel)" }} />
            <h3 className="fs-md" style={{ margin: 0 }}>Work Plan</h3>
            {queryType === "workplan" && (
              <span className="badge" style={{ background: "var(--accent, #3b82f6)", color: "#fff", marginLeft: "auto", fontSize: 11 }}>
                Selected Target
              </span>
            )}
          </div>
          <p className="muted fs-sm mb-sm">
            Upload your Work Plan Excel file. Tasks are parsed and weekly milestones are generated.
          </p>
          <div style={{ border: "2px dashed var(--border)", borderRadius: 10, padding: 20, textAlign: "center" }}>
            {wpDraft ? (
              <div>
                <div className="fw-700 text-success" style={{ fontSize: 24 }}>{wpDraft.length}</div>
                <div className="muted fs-base">tasks ready to commit</div>
                <button className="btn ghost sm mt-sm" onClick={() => { setWpDraft(null); setWpFile(null); }}>Remove</button>
              </div>
            ) : (
              <>
                <FileSpreadsheet size={28} style={{ opacity: 0.3, marginBottom: 8 }} />
                <label className="btn sm" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Upload size={12} /> Upload Work Plan
                  <input type="file" accept=".xlsx,.xls" onChange={handleWpUpload} style={{ display: "none" }} />
                </label>
                {wpFile && <p className="muted fs-xs mt-xs">{wpFile.name}</p>}
              </>
            )}
          </div>
          <div className="mt-sm">
            <a href={workplanTemplateUrl} className="btn ghost sm fs-sm" download style={{ textDecoration: "none" }}>
              <Download size={12} className="mr-xs" /> Download Template
            </a>
          </div>
        </div>

        {/* BoQ */}
        <div
          className="card"
          style={{
            border: queryType === "boq" ? "2px solid var(--color-violet-strong, #8b5cf6)" : undefined,
            boxShadow: queryType === "boq" ? "0 0 0 3px rgba(139,92,246,0.15)" : undefined,
          }}
        >
          <div className="row flex-center mb-sm">
            <Scale size={18} style={{ color: "var(--primary)" }} />
            <h3 className="fs-md" style={{ margin: 0 }}>Bill of Quantities</h3>
            {queryType === "boq" && (
              <span className="badge" style={{ background: "var(--color-violet-strong, #8b5cf6)", color: "#fff", marginLeft: "auto", fontSize: 11 }}>
                Selected Target
              </span>
            )}
          </div>
          <p className="muted fs-sm mb-sm">
            Upload your Bill of Quantities Excel file with sectioned items.
          </p>
          <div style={{ border: "2px dashed var(--border)", borderRadius: 10, padding: 20, textAlign: "center" }}>
            {boqDraft ? (
              <div>
                <div className="fw-700 text-success" style={{ fontSize: 24 }}>{boqDraft.length}</div>
                <div className="muted fs-base">items ready to commit</div>
                <button className="btn ghost sm mt-sm" onClick={() => { setBoqDraft(null); setBoqFile(null); }}>Remove</button>
              </div>
            ) : (
              <>
                <FileSpreadsheet size={28} style={{ opacity: 0.3, marginBottom: 8 }} />
                <label className="btn sm" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Upload size={12} /> Upload BoQ
                  <input type="file" accept=".xlsx,.xls" onChange={handleBoqUpload} style={{ display: "none" }} />
                </label>
                {boqFile && <p className="muted fs-xs mt-xs">{boqFile.name}</p>}
              </>
            )}
          </div>
          <div className="mt-sm">
            <a href={boqTemplateUrl} className="btn ghost sm fs-sm" download style={{ textDecoration: "none" }}>
              <Download size={12} className="mr-xs" /> Download Template
            </a>
          </div>
        </div>
      </div>

      {/* Commit bar */}
      {(wpDraft || boqDraft) && (
        <div className="card mb-md text-center p-md">
          <button className="btn" onClick={handleCommit} disabled={uploading} style={{ fontSize: 14, padding: "10px 24px" }}>
            {uploading ? "Saving..." : "Commit & Generate Milestones"}
          </button>
          <p className="muted fs-sm mt-sm">
            {wpDraft?.length || 0} Work Plan tasks · {boqDraft?.length || 0} BoQ items will be saved
          </p>
        </div>
      )}

      {uploading && <p className="muted text-center">Processing...</p>}
      {msg && <p className="fs-base text-success text-center mb-sm">{msg}</p>}

      {/* Draft preview tables */}
      {wpDraft && wpDraft.length > 0 && (
        <div className="card mb-md">
          <h3 className="fs-md mb-sm">
            <Edit3 size={14} className="mr-sm" />Work Plan Tasks — Review & Edit
          </h3>
          <div className="table-scroll">
            <table className="fs-sm">
              <thead><tr>
                <th>Task ID</th><th>Name</th><th>Start</th><th>End</th><th>Duration</th><th>Predecessors</th><th>Resource</th>
              </tr></thead>
              <tbody>
                {wpDraft.map((t, i) => (
                  <tr key={i}>
                    <td><input value={t.task_id || ""} onChange={e => updateWpItem(i, "task_id", e.target.value)} style={{ width: 60 }} /></td>
                    <td><input value={t.task_name || ""} onChange={e => updateWpItem(i, "task_name", e.target.value)} style={{ width: 180 }} /></td>
                    <td><input value={t.start_date || ""} onChange={e => updateWpItem(i, "start_date", e.target.value)} style={{ width: 90 }} /></td>
                    <td><input value={t.end_date || ""} onChange={e => updateWpItem(i, "end_date", e.target.value)} style={{ width: 90 }} /></td>
                    <td><input value={t.duration_days ?? ""} onChange={e => updateWpItem(i, "duration_days", e.target.value)} style={{ width: 50 }} type="number" /></td>
                    <td><input value={t.predecessors || ""} onChange={e => updateWpItem(i, "predecessors", e.target.value)} style={{ width: 80 }} /></td>
                    <td><input value={t.resource || ""} onChange={e => updateWpItem(i, "resource", e.target.value)} style={{ width: 100 }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {boqDraft && boqDraft.length > 0 && (
        <div className="card mb-md">
          <h3 className="fs-md mb-sm">
            <Edit3 size={14} className="mr-sm" />BoQ Items — Review & Edit
          </h3>
          <div className="table-scroll">
            <table className="fs-sm">
              <thead><tr>
                <th>Section</th><th>Item #</th><th>Description</th><th>Unit</th><th>Qty</th><th>Rate</th><th>Amount</th>
              </tr></thead>
              <tbody>
                {boqDraft.map((b, i) => (
                  <tr key={i}>
                    <td><input value={b.section || ""} onChange={e => updateBoqItem(i, "section", e.target.value)} style={{ width: 100 }} /></td>
                    <td><input value={b.item_number || ""} onChange={e => updateBoqItem(i, "item_number", e.target.value)} style={{ width: 60 }} /></td>
                    <td><input value={b.description || ""} onChange={e => updateBoqItem(i, "description", e.target.value)} style={{ width: 220 }} /></td>
                    <td><input value={b.unit || ""} onChange={e => updateBoqItem(i, "unit", e.target.value)} style={{ width: 60 }} /></td>
                    <td><input value={b.quantity ?? ""} onChange={e => updateBoqItem(i, "quantity", e.target.value)} style={{ width: 70 }} type="number" /></td>
                    <td><input value={b.rate ?? ""} onChange={e => updateBoqItem(i, "rate", e.target.value)} style={{ width: 80 }} type="number" /></td>
                    <td><input value={b.amount ?? ""} onChange={e => updateBoqItem(i, "amount", e.target.value)} style={{ width: 90 }} type="number" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Current data status */}
      <div className="card">
        <div className="row flex-between mb-sm">
          <div className="fs-base fw-600 text-muted">IMPORTED DATA</div>
          <button className="btn ghost sm" onClick={handleGenerateMilestones} disabled={!taskCount || uploading}>
            Regenerate Milestones
          </button>
        </div>
        <div className="grid-2 gap-md">
          <div className="text-center p-md" style={{ background: "var(--surface)", borderRadius: 8 }}>
            <div className="fw-700" style={{ fontSize: 28, color: "var(--steel)" }}>{taskCount}</div>
            <div className="muted fs-base">Work Plan Tasks</div>
          </div>
          <div className="text-center p-md" style={{ background: "var(--surface)", borderRadius: 8 }}>
            <div className="fw-700" style={{ fontSize: 28, color: "var(--primary)" }}>{boqCount}</div>
            <div className="muted fs-base">BoQ Items</div>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={showUploadConfirm}
        title="Replace existing data?"
        message="This project already has existing data. Uploading will replace it. Existing data will be lost. Continue?"
        confirmLabel="Replace"
        onConfirm={commitWithReplace}
        onCancel={() => setShowUploadConfirm(false)}
      />
    </div>
  );
}
