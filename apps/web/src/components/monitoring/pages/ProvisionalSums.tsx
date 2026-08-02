import { useEffect, useRef, useState } from "react";
import { useParams } from "@/components/monitoring/react-router-shim";
import { Download, Upload } from "lucide-react";

import { API_BASE, get, patch, post, authHeaders } from "../api";
import { useAuth } from "../auth";
import { ErrorBanner, FormField, SubmitButton } from "../components";

export function ProvisionalSums() {
  const { id = "" } = useParams();
  const { can } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ item_number: "", description: "", budgeted_amount: "", notes: "" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [editId, setEditId] = useState<number | null>(null);
  const [editAscertained, setEditAscertained] = useState("");

  // Excel upload state
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<any[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);

  const load = () => {
    setError(null);
    get<any[]>(`/projects/${id}/provisional-sums`)
      .then(data => { setItems(data); if (data.length > 0) setLocked(true); })
      .catch(e => setError(e.message));
  };
  useEffect(() => { load(); }, [id]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.item_number.trim()) errs.item_number = "Required";
    if (!form.description.trim()) errs.description = "Required";
    if (!form.budgeted_amount) errs.budgeted_amount = "Required";
    else if (isNaN(Number(form.budgeted_amount)) || Number(form.budgeted_amount) <= 0) errs.budgeted_amount = "Must be positive";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = () => {
    if (!validate()) return;
    setLoading(true);
    setError(null);
    post(`/projects/${id}/provisional-sums`, form).then(() => {
      setForm({ item_number: "", description: "", budgeted_amount: "", notes: "" });
      setFieldErrors({});
      load();
    }).catch(e => setError(e.message)).finally(() => setLoading(false));
  };

  const updateAscertained = (psId: number) => {
    patch(`/provisional-sums/${psId}`, { ascertained_amount: editAscertained }).then(() => {
      setEditId(null); setEditAscertained(""); load();
    }).catch(e => setError(e.message));
  };

  const closePs = (psId: number) => {
    patch(`/provisional-sums/${psId}`, { status: "closed" }).then(load).catch(e => setError(e.message));
  };

  // Excel upload
  const handleFile = async (f: File) => {
    setUploadMsg(null); setError(null);
    const fd = new FormData();
    fd.append("file", f);
    try {
      setUploading(true);
      const res = await fetch(`${API_BASE}/projects/${id}/ingest/cost-preview`, {
        method: "POST", headers: { ...authHeaders() }, body: fd,
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Preview failed"); }
      const r = await res.json();
      setPreview(r.provisional_sum_items || []);
      if (!r.contingency_items?.length && !r.provisional_sum_items?.length) {
        setUploadMsg("No data found. Check sheet is named 'Provisional Sums'.");
      }
    } catch (e: any) { setError(e.message); }
    finally { setUploading(false); }
  };

  const commitPreview = async () => {
    if (!preview) return;
    setUploadMsg(null); setError(null);
    try {
      setUploading(true);
      const res = await fetch(`${API_BASE}/projects/${id}/ingest/cost-commit`, {
        method: "POST", headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ provisional_sum_items: preview }),
      });
      const r = await res.json();
      if (!res.ok) throw new Error(r.error || "Commit failed");
      setUploadMsg(`Committed ${r.provisional_sum_items} provisional sums, ${r.contingency_items} contingency drawdowns.`);
      setPreview(null);
      load();
    } catch (e: any) { setError(e.message); }
    finally { setUploading(false); }
  };

  const discardPreview = () => { setPreview(null); setUploadMsg(null); };

  return (
    <div>
      <h2>Provisional Sums</h2>
      <ErrorBanner message={error} />

      {/* Excel upload — only if not locked */}
      {can("finance.admin") && !locked && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="row" style={{ gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <strong style={{ fontSize: 14 }}>Bulk Upload (Excel)</strong>
            <a className="btn ghost sm" href={`${API_BASE}/templates/provisional-sums`} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
              <Download size={14} /> PS Template
            </a>
            <a className="btn ghost sm" href={`${API_BASE}/templates/contingency`} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
              <Download size={14} /> Contingency Template
            </a>
            <input type="file" accept=".xlsx,.xls" ref={fileRef} style={{ display: "none" }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
            <button className="btn sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <Upload size={14} /> {uploading ? "Uploading…" : "Upload Excel"}
            </button>
            {uploadMsg && <span style={{ fontSize: 13, color: "var(--green)" }}>{uploadMsg}</span>}
          </div>

          {/* Preview table */}
          {preview && preview.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Preview — {preview.length} item(s)</p>
              <div style={{ maxHeight: 240, overflow: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
                <table style={{ fontSize: 13, width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--surface-2)", position: "sticky", top: 0 }}>
                      <th style={{ padding: "4px 6px" }}>Item</th>
                      <th style={{ padding: "4px 6px" }}>Description</th>
                      <th style={{ padding: "4px 6px", textAlign: "right" }}>Budgeted</th>
                      <th style={{ padding: "4px 6px", textAlign: "right" }}>Ascertained</th>
                      <th style={{ padding: "4px 6px" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((p, i) => (
                      <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                        <td style={{ padding: "2px 6px" }}>{p.item_number}</td>
                        <td style={{ padding: "2px 6px" }}>{p.description}</td>
                        <td style={{ padding: "2px 6px", textAlign: "right" }}>{p.budgeted_amount ? Number(p.budgeted_amount).toLocaleString() : "—"}</td>
                        <td style={{ padding: "2px 6px", textAlign: "right" }}>{p.ascertained_amount ? Number(p.ascertained_amount).toLocaleString() : "0"}</td>
                        <td style={{ padding: "2px 6px" }}><span className={`badge ${p.status}`}>{p.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="row" style={{ gap: 8, marginTop: 8 }}>
                <button className="btn sm" onClick={commitPreview} disabled={uploading}>Commit</button>
                <button className="btn ghost sm" onClick={discardPreview}>Discard</button>
              </div>
            </div>
          )}
        </div>
      )}

      {locked && (
        <div className="card" style={{ marginBottom: 16, padding: "12px 16px", background: "var(--surface-2)" }}>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>Cost data has been committed and is locked. Delete existing records first to re-import.</span>
        </div>
      )}

      <div className="card">
        <table>
          <thead><tr><th>Item</th><th>Description</th><th>Budgeted</th><th>Ascertained</th><th>Variance</th><th>Status</th><th>Budget use</th></tr></thead>
          <tbody>
            {items.map(ps => (
              <tr key={ps.id}>
                <td>{ps.item_number}</td><td>{ps.description}</td>
                <td className="mono">{Number(ps.budgeted_amount).toLocaleString()}</td>
                <td className="mono">
                  {editId === ps.id ? (
                    <span className="row" style={{ gap: 4 }}>
                      <input type="number" step="0.01" value={editAscertained} onChange={e => setEditAscertained(e.target.value)} style={{ width: 100 }} />
                      <button className="btn ghost sm" onClick={() => updateAscertained(ps.id)}>Save</button>
                      <button className="btn ghost sm" onClick={() => setEditId(null)}>Cancel</button>
                    </span>
                  ) : (
                    <span>{Number(ps.ascertained_amount).toLocaleString()} {can("finance.admin") && ps.status !== "closed" && <button className="btn ghost sm" onClick={() => { setEditId(ps.id); setEditAscertained(ps.ascertained_amount); }}>Edit</button>}</span>
                  )}
                </td>
                <td className="mono" style={{ color: Number(ps.variance) > 0 ? "var(--danger)" : "var(--success)" }}>{Number(ps.variance).toLocaleString()}</td>
                <td><span className={`badge ${ps.status}`}>{ps.status === "closed" ? "committed" : ps.status}</span></td>
                <td>{can("finance.admin") && ps.status !== "closed" && Number(ps.ascertained_amount) > 0 && <button className="btn ghost sm" onClick={() => closePs(ps.id)}>Commit budget use</button>}</td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={7} className="empty">No provisional sums.</td></tr>}
          </tbody>
        </table>
      </div>

      {can("finance.admin") && !locked && (
        <div className="card">
          <h3>New Provisional Sum</h3>
          <div className="row wrap" style={{ gap: 8, alignItems: "flex-start" }}>
            <FormField label="Item No" required error={fieldErrors.item_number}>
              <input value={form.item_number} onChange={e => { setForm({ ...form, item_number: e.target.value }); setFieldErrors(f => ({ ...f, item_number: "" })); }}
                style={{ width: 120 }} disabled={loading} autoFocus />
            </FormField>
            <FormField label="Description" required error={fieldErrors.description}>
              <input value={form.description} onChange={e => { setForm({ ...form, description: e.target.value }); setFieldErrors(f => ({ ...f, description: "" })); }}
                style={{ width: 200 }} disabled={loading} />
            </FormField>
            <FormField label="Budgeted Amount" required error={fieldErrors.budgeted_amount}>
              <input type="number" step="0.01" value={form.budgeted_amount} onChange={e => { setForm({ ...form, budgeted_amount: e.target.value }); setFieldErrors(f => ({ ...f, budgeted_amount: "" })); }}
                style={{ width: 140 }} disabled={loading} />
            </FormField>
            <FormField label="Notes">
              <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                style={{ width: 200 }} disabled={loading} />
            </FormField>
            <SubmitButton onClick={submit} loading={loading} disabled={loading} style={{ marginTop: 22 }}>Create</SubmitButton>
          </div>
        </div>
      )}
    </div>
  );
}
