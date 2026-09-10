import { AlertCircle, CheckCircle2, CloudUpload, Download, FileSpreadsheet, X } from "lucide-react";
import { useState } from "react";
import { addDocument, ingestExcelCommit, ingestExcelPreview, saveOnboardingStep3, uploadFile, sampleIfcUrl, boqTemplateUrl, workplanTemplateUrl } from "../../api";
import { IngestionPreview, IngestionDraft, SetIngestionDraft } from "./IngestionPreview";

export interface StepDocumentsProps {
  project: any;
  hasModule: (key: string) => boolean;
  loadStatus: () => void;
  setError: (v: string | null) => void;
}

/** An upload chip shown after a file is added */
function FileChip({ name, status, onRemove }: { name: string; status: "uploading" | "done" | "error"; onRemove?: () => void }) {
  const color = status === "done" ? "var(--color-emerald)" : status === "error" ? "var(--color-danger)" : "var(--muted)";
  const bg = status === "done" ? "rgba(16,185,129,0.08)" : status === "error" ? "rgba(239,68,68,0.08)" : "var(--surface-3)";
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px",
      borderRadius: 20, background: bg, border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`, fontSize: 12,
    }}>
      {status === "uploading" && <span style={{ color, fontSize: 10 }}>⏳</span>}
      {status === "done" && <CheckCircle2 size={12} style={{ color }} />}
      {status === "error" && <AlertCircle size={12} style={{ color }} />}
      <span style={{ color: "var(--text)" }}>{name.length > 30 ? name.slice(0, 28) + "…" : name}</span>
      {onRemove && (
        <button type="button" onClick={onRemove} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 0, display: "flex" }}>
          <X size={11} />
        </button>
      )}
    </div>
  );
}

/** A document upload section with instruction banner and drag hint */
function UploadSection({
  emoji, title, description, accept, onFile, children, templateHref, templateLabel, instruction,
}: {
  emoji: string; title: string; description?: string; accept: string;
  onFile: (f: File) => void; children?: React.ReactNode;
  templateHref?: string; templateLabel?: string; instruction?: string;
}) {
  const [dragging, setDragging] = useState(false);

  return (
    <div style={{
      border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", marginBottom: 16,
    }}>
      {/* Section header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
        background: "var(--surface-2)", borderBottom: "1px solid var(--border)",
      }}>
        <span style={{ fontSize: 18 }}>{emoji}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{title}</div>
          {description && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 1 }}>{description}</div>}
        </div>
        {templateHref && (
          <a href={templateHref} download className="btn ghost sm" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
            <Download size={13} /> {templateLabel || "Download Template"}
          </a>
        )}
      </div>

      <div style={{ padding: "14px 16px" }}>
        {/* Instruction banner */}
        {instruction && (
          <div style={{
            display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 12px",
            background: "rgba(0,163,255,0.06)", border: "1px solid rgba(0,163,255,0.2)",
            borderRadius: 8, marginBottom: 12, fontSize: 12, color: "var(--text)",
          }}>
            <AlertCircle size={14} style={{ color: "var(--primary)", flexShrink: 0, marginTop: 1 }} />
            <span>{instruction}</span>
          </div>
        )}

        {/* Drop zone */}
        <label
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => {
            e.preventDefault(); setDragging(false);
            const f = e.dataTransfer.files?.[0]; if (f) onFile(f);
          }}
          style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
            padding: "20px 16px", borderRadius: 10, cursor: "pointer",
            border: `2px dashed ${dragging ? "var(--primary)" : "var(--border)"}`,
            background: dragging ? "rgba(0,163,255,0.05)" : "var(--surface-2)",
            transition: "all 0.15s",
          }}
        >
          <CloudUpload size={24} style={{ color: dragging ? "var(--primary)" : "var(--muted)" }} />
          <span style={{ fontSize: 13, color: "var(--muted)", textAlign: "center" }}>
            Drag & drop a file here, or <span style={{ color: "var(--primary)", fontWeight: 600 }}>browse</span>
          </span>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>Accepted: {accept}</span>
          <input type="file" accept={accept} style={{ display: "none" }}
            onChange={e => { const f = e.target.files?.[0]; if (f) { onFile(f); e.target.value = ""; } }}
          />
        </label>

        {/* Uploaded files / children */}
        {children && <div style={{ marginTop: 12 }}>{children}</div>}
      </div>
    </div>
  );
}

export function StepDocuments({ project, hasModule, loadStatus, setError }: StepDocumentsProps) {
  const [submitting, setSubmitting] = useState(false);
  const [approvalType, setApprovalType] = useState("");
  const [approvalAuthority, setApprovalAuthority] = useState("");
  const [approvalIssueDate, setApprovalIssueDate] = useState("");

  const [ingestionUploading, setIngestionUploading] = useState(false);
  const [ingestionResult, setIngestionResult] = useState<string | null>(null);
  const [ingestionDraft, setIngestionDraft] = useState<IngestionDraft | null>(null);

  const [uploads, setUploads] = useState<{ name: string; status: "uploading" | "done" | "error"; type: string }[]>([]);

  const addUpload = async (type: string, file: File, handler: (url: string) => Promise<void>) => {
    const entry = { name: file.name, status: "uploading" as const, type };
    setUploads(u => [...u, entry]);
    try {
      const url = await uploadFile(file);
      await handler(url);
      setUploads(u => u.map(e => e.name === file.name ? { ...e, status: "done" as const } : e));
    } catch {
      setUploads(u => u.map(e => e.name === file.name ? { ...e, status: "error" as const } : e));
    }
  };

  const uploadDrawing = (discipline: "architectural" | "structural", file: File) => {
    if (!project) return;
    const label = discipline === "architectural" ? "Architectural Drawing" : "Structural Drawing";
    addUpload(label, file, async (url) => {
      await addDocument(project.id, { doc_type: "drawing", title: `${label} — ${file.name}`, remote_url: url, discipline });
      await loadStatus();
    });
  };

  const uploadExtra = (docType: string, file: File) => {
    if (!project) return;
    const label = { contract: "Contract", permit: "Permit", report: "Report", photo: "Site Photo", other: "Document" }[docType] || docType;
    addUpload(label, file, async (url) => {
      await addDocument(project.id, { doc_type: docType, title: `${label} — ${file.name}`, remote_url: url });
      await loadStatus();
    });
  };

  const uploadBoQ = async (file: File) => {
    if (!project) return;
    setIngestionUploading(true); setIngestionResult(null);
    try {
      const r = await ingestExcelPreview(project.id, file);
      if (r.boq_items?.length) {
        setIngestionDraft(prev => ({ ...prev, boq_items: r.boq_items }));
        setIngestionResult(`✓ ${r.boq_items.length} BoQ items parsed — review below before committing`);
      } else {
        setIngestionResult("No BoQ items found in this file. Check that you used the template.");
      }
    } catch (err: any) { setIngestionResult("Upload failed: " + err.message); }
    setIngestionUploading(false);
  };

  const uploadWorkplan = async (file: File) => {
    if (!project) return;
    setIngestionUploading(true); setIngestionResult(null);
    try {
      const r = await ingestExcelPreview(project.id, file);
      if (r.work_plan_tasks?.length) {
        setIngestionDraft(prev => ({ ...prev, work_plan_tasks: r.work_plan_tasks }));
        setIngestionResult(`✓ ${r.work_plan_tasks.length} work plan tasks parsed — review below before committing`);
      } else {
        setIngestionResult("No tasks found. Check that you used the template.");
      }
    } catch (err: any) { setIngestionResult("Upload failed: " + err.message); }
    setIngestionUploading(false);
  };

  async function commitIngestion() {
    if (!project || !ingestionDraft) return;
    setSubmitting(true); setError(null);
    try {
      const r = await ingestExcelCommit(project.id, {
        boq_items: ingestionDraft.boq_items || [],
        work_plan_tasks: ingestionDraft.work_plan_tasks || [],
      });
      setIngestionResult(`Committed ${r.boq_items} BoQ items, ${r.work_plan_tasks} tasks. Generated ${r.milestones_created} milestones.`);
      setIngestionDraft(null);
    } catch (err: any) {
      setError("Commit failed: " + (err.message || "unknown error"));
    }
    setSubmitting(false);
  }

  async function addApproval() {
    if (!project || !approvalType || !approvalAuthority) {
      setError("Select an approval type and enter the authority name"); return;
    }
    setSubmitting(true); setError(null);
    try {
      await saveOnboardingStep3(project.id, {
        approval: { approval_type: approvalType, authority: approvalAuthority, status: "approved", issue_date: approvalIssueDate },
      });
      setApprovalType(""); setApprovalAuthority(""); setApprovalIssueDate("");
      await loadStatus();
    } catch (e) { setError((e as Error).message); }
    setSubmitting(false);
  }

  const drawingUploads = uploads.filter(u => u.type.includes("Drawing"));
  const boqUploads = uploads.filter(u => u.type === "BoQ");
  const otherUploads = uploads.filter(u => !u.type.includes("Drawing") && u.type !== "BoQ");

  return (
    <div>
      <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 20, padding: "10px 14px", background: "var(--surface-2)", borderRadius: 8, borderLeft: "3px solid var(--primary)" }}>
        <strong>Upload order matters.</strong> Start with drawings, then upload BoQ and Work Plan using the official templates. Approvals and contracts can be added at any time.
      </p>

      {/* 1 — Drawings (always first) */}
      <UploadSection
        emoji="📐" title="Architectural Drawing"
        description="PDF, DWG, DXF, or image files accepted"
        accept=".pdf,.dwg,.dxf,.png,.jpg,.svg"
        onFile={f => uploadDrawing("architectural", f)}
        templateHref={sampleIfcUrl} templateLabel="Download IFC sample"
        instruction="Upload the latest approved architectural drawings. These should be positioned before all other documents."
      >
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {drawingUploads.filter(u => u.name.toLowerCase().includes("arch") || !u.name.toLowerCase().includes("struct")).map(u => (
            <FileChip key={u.name} name={u.name} status={u.status} />
          ))}
        </div>
      </UploadSection>

      <UploadSection
        emoji="🏗️" title="Structural Drawing"
        description="PDF, DWG, DXF, or image files accepted"
        accept=".pdf,.dwg,.dxf,.png,.jpg,.svg"
        onFile={f => uploadDrawing("structural", f)}
        instruction="Upload structural/engineering drawings. Position these after architectural drawings."
      >
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {drawingUploads.filter(u => u.name.toLowerCase().includes("struct")).map(u => (
            <FileChip key={u.name} name={u.name} status={u.status} />
          ))}
        </div>
      </UploadSection>

      {/* 2 — BoQ & Work Plan */}
      {(hasModule("financials") || hasModule("progress_tracking")) && (
        <>
          <UploadSection
            emoji="📊" title="Bill of Quantities (BoQ)"
            description="Excel (.xlsx) only — must use the official template"
            accept=".xlsx,.xls"
            onFile={uploadBoQ}
            templateHref={boqTemplateUrl} templateLabel="Step 1 — Download BoQ Template"
            instruction="Download the template first, fill it in without changing column headings, then upload it here. The system will validate and show you a preview before committing."
          >
            {ingestionUploading && <div style={{ fontSize: 13, color: "var(--muted)" }}>⏳ Parsing file…</div>}
            {ingestionResult?.includes("BoQ") && (
              <div style={{
                fontSize: 13, padding: "8px 12px", borderRadius: 8,
                background: ingestionResult.includes("✓") ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
                color: ingestionResult.includes("✓") ? "var(--color-emerald)" : "var(--color-danger)",
                display: "flex", gap: 6, alignItems: "center",
              }}>
                <FileSpreadsheet size={14} />
                {ingestionResult}
              </div>
            )}
          </UploadSection>

          <UploadSection
            emoji="📋" title="Work Plan / Programme"
            description="Excel (.xlsx) only — must use the official template"
            accept=".xlsx,.xls"
            onFile={uploadWorkplan}
            templateHref={workplanTemplateUrl} templateLabel="Step 1 — Download Workplan Template"
            instruction="Download the template, complete it, then upload here. Tasks from this file become milestones in the project timeline."
          >
            {ingestionResult?.includes("tasks") && (
              <div style={{
                fontSize: 13, padding: "8px 12px", borderRadius: 8,
                background: ingestionResult.includes("✓") ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
                color: ingestionResult.includes("✓") ? "var(--color-emerald)" : "var(--color-danger)",
                display: "flex", gap: 6, alignItems: "center",
              }}>
                <FileSpreadsheet size={14} />
                {ingestionResult}
              </div>
            )}
          </UploadSection>

          {/* Ingestion Preview + Commit */}
          {ingestionDraft && (ingestionDraft.boq_items?.length || ingestionDraft.work_plan_tasks?.length) && (
            <div style={{ marginBottom: 16 }}>
              <IngestionPreview ingestionDraft={ingestionDraft} setIngestionDraft={setIngestionDraft as SetIngestionDraft} committing={submitting} onCommit={commitIngestion} />
            </div>
          )}

          {ingestionResult && ingestionResult.includes("Committed") && (
            <div style={{ marginBottom: 16, padding: "12px 16px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 10, fontSize: 13, color: "var(--color-emerald)", display: "flex", gap: 8, alignItems: "center" }}>
              <CheckCircle2 size={16} /> {ingestionResult}
            </div>
          )}
        </>
      )}

      {/* 3 — Statutory Approvals */}
      <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
        <div style={{ padding: "12px 16px", background: "var(--surface-2)", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
          ✅ Statutory Approvals
        </div>
        <div style={{ padding: "14px 16px" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Approval Type</label>
              <select value={approvalType} onChange={e => setApprovalType(e.target.value)} style={{ minWidth: 160 }}>
                <option value="">Select type…</option>
                <option value="NEMA">NEMA</option>
                <option value="NCA">NCA</option>
                <option value="County">County Approval</option>
                <option value="EIA">EIA Certificate</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Issuing Authority</label>
              <input value={approvalAuthority} onChange={e => setApprovalAuthority(e.target.value)} placeholder="e.g. Nairobi County" style={{ minWidth: 180 }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Issue Date</label>
              <input type="date" value={approvalIssueDate} onChange={e => setApprovalIssueDate(e.target.value)} />
            </div>
            <button className="btn sm" onClick={addApproval} disabled={submitting} style={{ marginBottom: 1 }}>
              + Add Approval
            </button>
          </div>
        </div>
      </div>

      {/* 4 — Contracts & Extra Documents */}
      <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
        <div style={{ padding: "12px 16px", background: "var(--surface-2)", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: 14 }}>
          📎 Contracts & Other Documents
        </div>
        <div style={{ padding: "14px 16px" }}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {[
              { type: "contract", emoji: "📝", label: "Contract" },
              { type: "permit", emoji: "🏛️", label: "Permit" },
              { type: "report", emoji: "📑", label: "Report" },
              { type: "photo", emoji: "📷", label: "Site Photo" },
              { type: "other", emoji: "📎", label: "Other" },
            ].map(doc => (
              <label key={doc.type} style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                padding: "14px 16px", borderRadius: 10, cursor: "pointer", minWidth: 80,
                border: "2px dashed var(--border)", background: "var(--surface-2)",
                fontSize: 13, fontWeight: 500, color: "var(--muted)", textAlign: "center",
                transition: "all 0.15s",
              }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--primary)")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
              >
                <span style={{ fontSize: 22 }}>{doc.emoji}</span>
                {doc.label}
                <input type="file" style={{ display: "none" }} onChange={e => {
                  const f = e.target.files?.[0]; if (f) { uploadExtra(doc.type, f); e.target.value = ""; }
                }} />
              </label>
            ))}
          </div>
          {otherUploads.length > 0 && (
            <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
              {otherUploads.map(u => <FileChip key={u.name} name={u.name} status={u.status} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
