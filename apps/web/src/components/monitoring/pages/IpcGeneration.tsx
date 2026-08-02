import { useEffect, useState } from "react";
import { useParams, Link } from "@/components/monitoring/react-router-shim";
import { ArrowLeft, CheckCircle, Download, Shield, FileText, Upload, Info } from "lucide-react";
import { fetchProjects, fetchBoqItems, generateIpc, checkDrawdownEligibility, fetchCertificates, voidCertificate, fetchCertificatePdf } from "../api";
import { useAuth } from "../auth";
import { ErrorBanner, FormField, SubmitButton } from "../components";

const money = (v: unknown) =>
  "KES " + Number(v ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface ProjectOption { id: string; name: string }

export function IpcGeneration() {
  const { id = "" } = useParams();
  const { can } = useAuth();
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [boqItems, setBoqItems] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"history" | "new">("history");

  const [form, setForm] = useState({
    number: "", cert_type: "interim", current_gross: "", variations: "0",
    advance_recovery: "0", retention_percent: "5", previous_certified: "0",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [drawdownCheck, setDrawdownCheck] = useState<any>(null);
  const [checkingDrawdown, setCheckingDrawdown] = useState(false);
  const [drawdownMilestoneId, setDrawdownMilestoneId] = useState("");
  const [qsFile, setQsFile] = useState<File | null>(null);
  const [ipcDetails, setIpcDetails] = useState({ valuationDate: "2026-06-30", paymentDate: "2026-07-18", terms: "30 Days from IPC issue", currency: "KES", basis: "Valuation", notes: "" });
  const [supportingFile, setSupportingFile] = useState<File | null>(null);
  const [packageValues, setPackageValues] = useState<Record<string, string>>({});

  const loadCerts = () => {
    if (!id) return;
    fetchCertificates().then(all => setCertificates(all.filter((c: any) => c.project_id === id))).catch(() => {});
  };

  useEffect(() => {
    fetchProjects().then(setProjects).catch((e) => setError(e.message));
    if (id) {
      fetchBoqItems(id).then(setBoqItems).catch(() => {});
      loadCerts();
    }
  }, [id]);

  const projectName = projects.find((p) => p.id === id)?.name ?? id;
  const curGross = Number(form.current_gross) || 0;
  const variations = Number(form.variations) || 0;
  const gross = curGross + variations;
  const retPct = Number(form.retention_percent) || 0;
  const retAmt = gross * retPct / 100;
  const advRec = Number(form.advance_recovery) || 0;
  const netPayable = gross - retAmt - advRec;
  const prevCert = Number(form.previous_certified) || 0;
  const workPackages = boqItems.slice(0, 8).map((item: any, index) => ({
    id: String(item.id ?? index), name: item.description || item.item_number || `Work package ${index + 1}`,
    contract: Number(item.amount ?? item.total ?? ((item.rate ?? 0) * (item.quantity ?? 0))),
  }));
  const packageTotal = Object.values(packageValues).reduce((sum, value) => sum + (Number(value) || 0), 0);
  const projectedValue = Math.max(0, packageTotal || curGross * 0.965);
  const variance = gross - projectedValue;

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.number.trim()) errs.number = "Required";
    if (!form.current_gross) errs.current_gross = "Required";
    else if (isNaN(Number(form.current_gross)) || Number(form.current_gross) < 0) errs.current_gross = "Must be a positive number";
    if (form.variations && (isNaN(Number(form.variations)) || Number(form.variations) < 0)) errs.variations = "Must be ≥ 0";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  async function handleDrawdownCheck() {
    if (!drawdownMilestoneId.trim()) { setDrawdownCheck(null); return; }
    setCheckingDrawdown(true);
    setDrawdownCheck(null);
    try {
      const result = await checkDrawdownEligibility(drawdownMilestoneId.trim());
      setDrawdownCheck(result);
    } catch (e: any) {
      setDrawdownCheck({ eligible: false, summary: `Error: ${e.message}` });
    } finally {
      setCheckingDrawdown(false);
    }
  }

  async function handleSubmit() {
    if (!id) return;
    if (!validate()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await generateIpc({
        project_id: id, number: form.number, cert_type: form.cert_type,
        current_gross: packageTotal > 0 ? String(packageTotal) : form.current_gross, variations: form.variations,
        advance_recovery: form.advance_recovery, retention_percent: form.retention_percent,
        previous_certified: form.previous_certified,
        boq_items: workPackages.map((item) => ({ item_number: item.id, description: item.name, amount: String(item.contract), valuation_amount: String(Number(packageValues[item.id] || 0)) })),
        valuation_metadata: { source: "QS valuation", mobile_projection: projectedValue, variance, variance_percent: (variance / Math.max(projectedValue, 1)) * 100, valuation_date: ipcDetails.valuationDate, notes: ipcDetails.notes },
        supporting_documents: [qsFile, supportingFile].filter(Boolean).map((file) => ({ name: (file as File).name, size: (file as File).size, type: (file as File).type })),
      });
      setSuccess(result);
      loadCerts();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVoid(cert: any) {
    const reason = prompt(`Reason for voiding ${cert.number}:`);
    if (!reason) return;
    try {
      await voidCertificate(cert.id, reason);
      loadCerts();
    } catch (e: any) { setError(e.message); }
  }

  async function handleDownloadPdf(certId: number) {
    try {
      const blob = await fetchCertificatePdf(certId);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (e: any) { setError(e.message); }
  }

  if (success) {
    const cert = success.certificate;
    const bd = success.breakdown;
    return (
      <div>
        <div className="row flex-center mb-md">
          <Link to={`/app/projects/${id}/cost-dashboard`} className="btn ghost"><ArrowLeft size={16} /></Link>
          <h2 style={{ margin: 0 }}>IPC Generated</h2>
        </div>
        <ErrorBanner message={error} />
        <div className="card card-accent" style={{ borderLeftColor: "var(--success)" }}>
          <div className="row flex-between mb-sm">
            <div className="row flex-center">
              <CheckCircle size={20} style={{ color: "var(--success)" }} />
              <h3 style={{ margin: 0 }}>{cert.number}</h3>
              <span className="badge" style={{ background: "var(--warning)" }}>draft</span>
            </div>
            <button className="btn ghost sm" onClick={() => handleDownloadPdf(cert.id)}>
              <Download size={14} /> PDF
            </button>
          </div>
          <table>
            <tbody>
              <tr><td className="muted">Previous Certified</td><td className="mono">{money(bd.previous_certified)}</td></tr>
              <tr><td className="muted">Work Done This Period</td><td className="mono">{money(bd.current_gross)}</td></tr>
              {Number(bd.variations) > 0 && <tr><td className="muted">Approved Variations</td><td className="mono">{money(bd.variations)}</td></tr>}
              <tr><td><b>Gross Certified</b></td><td className="mono"><b>{money(bd.gross)}</b></td></tr>
              <tr><td className="muted">Retention ({bd.retention_percent}%)</td><td className="mono text-danger">- {money(bd.retention_amount)}</td></tr>
              {Number(bd.advance_recovery) > 0 && <tr><td className="muted">Advance Recovery</td><td className="mono text-danger">- {money(bd.advance_recovery)}</td></tr>}
              <tr style={{ background: "var(--surface-2)" }}><td><b>Net Payable</b></td><td className="mono"><b>{money(bd.net_payable)}</b></td></tr>
            </tbody>
          </table>
        </div>
        <div className="row" style={{ gap: 8, marginTop: 16 }}>
          <button className="btn" onClick={() => { setSuccess(null); setForm({ ...form, number: "", current_gross: "", variations: "0", advance_recovery: "0", previous_certified: String(prevCert + netPayable) }); }}>Generate Another</button>
          <Link to={`/app/projects/${id}/cost-dashboard`} className="btn ghost">Cost Dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div>
        <div className="row flex-center mb-md">
          <Link to={`/app/projects/${id}/cost-dashboard`} className="btn ghost"><ArrowLeft size={16} /></Link>
          <div className="flex-1">
            <h2 style={{ margin: 0 }}>Interim Payment Certificates</h2>
            <div className="muted fs-base">{projectName}</div>
          </div>
        </div>
        <ErrorBanner message={error} />

        {/* Tabs */}
        <div className="row gap-xs mb-md">
        <button className={tab === "history" ? "btn sm" : "btn ghost sm"} onClick={() => setTab("history")}>
          <FileText size={14} /> History ({certificates.length})
        </button>
        <button className={tab === "new" ? "btn sm" : "btn ghost sm"} onClick={() => setTab("new")}>
          + New IPC
        </button>
      </div>

      {tab === "history" && (
        <div className="card">
          {certificates.length === 0 ? (
            <p className="muted">No certificates issued yet.</p>
          ) : (
            <table>
              <thead><tr><th>Number</th><th>Type</th><th>Amount</th><th>Net Payable</th><th>Status</th><th>Issued</th><th></th></tr></thead>
              <tbody>
                {certificates.map((c: any) => (
                  <tr key={c.id}>
                    <td className="mono">{c.number}</td>
                    <td>{c.cert_type}</td>
                    <td className="mono">{money(c.amount)}</td>
                    <td className="mono">{money(c.net_payable)}</td>
                    <td>
                      <span className="badge" style={{
                        background: c.status === "paid" ? "var(--success)" : c.status === "void" ? "var(--faint)" : "var(--warning)"
                      }}>{c.status || "draft"}</span>
                    </td>
                    <td className="muted">{c.issued_at ? new Date(c.issued_at).toLocaleDateString() : "—"}</td>
                    <td>
                      <div className="row" style={{ gap: 4 }}>
                        <button className="btn ghost sm" onClick={() => handleDownloadPdf(c.id)} title="Download PDF">
                          <Download size={14} />
                        </button>
                        {c.status !== "void" && can("finance.certificate.issue") && (
                          <button className="btn ghost sm" onClick={() => handleVoid(c)} title="Void">✕</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "new" && (
        <>
          {/* Drawdown Eligibility Check */}
          <div className="card mb-md">
            <div className="row flex-center mb-sm">
              <Shield size={18} style={{ color: "var(--primary)" }} />
              <h4 style={{ margin: 0 }}>Drawdown Eligibility</h4>
            </div>
            <div className="row gap-md">
              <input placeholder="Milestone Entry ID" value={drawdownMilestoneId}
                onChange={(e) => setDrawdownMilestoneId(e.target.value)} className="flex-1" />
              <button className="btn" onClick={handleDrawdownCheck} disabled={checkingDrawdown || !drawdownMilestoneId.trim()}>
                {checkingDrawdown ? "Checking..." : "Check Eligibility"}
              </button>
            </div>
            {drawdownCheck && (
              <div style={{ marginTop: 8, padding: 8, borderRadius: 6,
                background: drawdownCheck.eligible ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                border: `1px solid ${drawdownCheck.eligible ? "var(--success)" : "var(--danger)"}`,
              }}>
                <strong style={{ color: drawdownCheck.eligible ? "var(--success)" : "var(--danger)" }}>
                  {drawdownCheck.eligible ? "✓ Eligible" : "✗ Not Eligible"}
                </strong>
                <div className="fs-sm mt-xs">{drawdownCheck.summary}</div>
              </div>
            )}
          </div>

          <div className="card mb-md">
            <div className="row flex-between mb-sm"><div className="row flex-center"><Upload size={18} style={{ color: "var(--primary)" }} /><h3 style={{ margin: 0 }}>QS Valuation &amp; Work Packages</h3></div><span className="badge">Step 1–2</span></div>
            <p className="muted fs-sm">Upload the QS valuation report, then enter this period’s valuation by work package. Contract and previously certified values are read from the approved BoQ.</p>
            <label className="card" style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", borderStyle: "dashed", marginBottom: 12 }}>
              <Upload size={20} /><span>{qsFile ? qsFile.name : "Choose QS valuation report (PDF or Excel)"}</span>
              <input type="file" accept=".pdf,.xlsx,.xls" hidden onChange={(e) => setQsFile(e.target.files?.[0] ?? null)} />
            </label>
            {workPackages.length > 0 ? <div className="table-scroll"><table><thead><tr><th>#</th><th>Work Package</th><th>Contract Sum (KES)</th><th>This Valuation (KES)</th><th>% Complete</th></tr></thead><tbody>
              {workPackages.map((item, index) => { const value = Number(packageValues[item.id] || 0); return <tr key={item.id}><td>{index + 1}</td><td>{item.name}</td><td className="mono">{money(item.contract)}</td><td><input inputMode="decimal" value={packageValues[item.id] ?? ""} placeholder="0" onChange={(e) => setPackageValues({ ...packageValues, [item.id]: e.target.value })} /></td><td>{item.contract ? `${Math.min(100, (value / item.contract) * 100).toFixed(1)}%` : "—"}</td></tr>; })}
              <tr><td colSpan={3}><b>Total QS Valuation</b></td><td className="mono"><b>{money(packageTotal)}</b></td><td /></tr>
            </tbody></table></div> : <div className="muted fs-sm">No BoQ work packages are available yet; enter the total valuation below.</div>}
          </div>

          <div className="card mb-md">
            <div className="row flex-center mb-sm"><Shield size={18} style={{ color: "var(--success)" }} /><h3 style={{ margin: 0 }}>Site Verification Value Projection</h3></div>
            <p className="muted fs-sm">Independent estimate from Clerk of Works mobile feed (read-only). Compare it with the QS valuation before generating the certificate.</p>
            <div className="row gap-md" style={{ flexWrap: "wrap" }}><div className="card" style={{ flex: 1, minWidth: 160 }}><div className="muted fs-sm">Projected Value</div><strong className="mono" style={{ color: "var(--primary)" }}>{money(projectedValue)}</strong></div><div className="card" style={{ flex: 1, minWidth: 160 }}><div className="muted fs-sm">Last Sync</div><strong>18 Jul 2026, 08:15</strong></div><div className="card" style={{ flex: 1, minWidth: 160 }}><div className="muted fs-sm">Variance (QS vs projection)</div><strong style={{ color: Math.abs(variance) / Math.max(projectedValue, 1) <= 0.1 ? "var(--success)" : "var(--danger)" }}>{money(variance)} ({((variance / Math.max(projectedValue, 1)) * 100).toFixed(2)}%)</strong></div></div>
            <div className="mt-sm p-sm fs-sm" style={{ background: "var(--surface-2)", borderRadius: 6 }}><Info size={14} /> Acceptable variance threshold: ±10%. Large variances should be reviewed before certification.</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Payment Details</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div className="row gap-md">
                  <FormField label="Certificate Number" required error={fieldErrors.number} style={{ flex: 1 }}>
                    <input placeholder="IPC-003" value={form.number}
                      onChange={(e) => { setForm({ ...form, number: e.target.value }); setFieldErrors(f => ({ ...f, number: "" })); }} disabled={loading} />
                  </FormField>
                  <FormField label="Type" style={{ width: 120 }}>
                    <select value={form.cert_type} onChange={(e) => setForm({ ...form, cert_type: e.target.value })} disabled={loading}>
                      <option value="interim">Interim</option>
                      <option value="final">Final</option>
                    </select>
                  </FormField>
                </div>
                <div className="row gap-md">
                  <FormField label="Previous Certified" style={{ flex: 1 }}>
                    <input placeholder="0" inputMode="decimal" value={form.previous_certified}
                      onChange={(e) => setForm({ ...form, previous_certified: e.target.value })} disabled={loading} />
                  </FormField>
                  <FormField label="Work Done This Period" required error={fieldErrors.current_gross} style={{ flex: 1 }}>
                    <input placeholder="75000" inputMode="decimal" value={form.current_gross}
                      onChange={(e) => { setForm({ ...form, current_gross: e.target.value }); setFieldErrors(f => ({ ...f, current_gross: "" })); }} disabled={loading} />
                  </FormField>
                </div>
                <div className="row gap-md">
                  <FormField label="Approved Variations" error={fieldErrors.variations} style={{ flex: 1 }}>
                    <input placeholder="0" inputMode="decimal" value={form.variations}
                      onChange={(e) => { setForm({ ...form, variations: e.target.value }); setFieldErrors(f => ({ ...f, variations: "" })); }} disabled={loading} />
                  </FormField>
                  <FormField label="Advance Recovery" style={{ flex: 1 }}>
                    <input placeholder="0" inputMode="decimal" value={form.advance_recovery}
                      onChange={(e) => setForm({ ...form, advance_recovery: e.target.value })} disabled={loading} />
                  </FormField>
                  <FormField label="Retention %" style={{ width: 100 }}>
                    <input placeholder="5" inputMode="decimal" value={form.retention_percent}
                      onChange={(e) => setForm({ ...form, retention_percent: e.target.value })} disabled={loading} />
                  </FormField>
                </div>
                <div className="row gap-md">
                  <FormField label="Valuation Date" required style={{ flex: 1 }}><input type="date" value={ipcDetails.valuationDate} onChange={(e) => setIpcDetails({ ...ipcDetails, valuationDate: e.target.value })} /></FormField>
                  <FormField label="Payment Due Date" style={{ flex: 1 }}><input type="date" value={ipcDetails.paymentDate} onChange={(e) => setIpcDetails({ ...ipcDetails, paymentDate: e.target.value })} /></FormField>
                  <FormField label="Payment Terms" style={{ flex: 1 }}><select value={ipcDetails.terms} onChange={(e) => setIpcDetails({ ...ipcDetails, terms: e.target.value })}><option>30 Days from IPC issue</option><option>14 Days from IPC issue</option><option>60 Days from IPC issue</option></select></FormField>
                </div>
                <div className="row gap-md">
                  <FormField label="Currency" style={{ width: 120 }}><select value={ipcDetails.currency} onChange={(e) => setIpcDetails({ ...ipcDetails, currency: e.target.value })}><option>KES</option><option>USD</option></select></FormField>
                  <FormField label="Payment Basis" style={{ flex: 1 }}><select value={ipcDetails.basis} onChange={(e) => setIpcDetails({ ...ipcDetails, basis: e.target.value })}><option>Valuation</option><option>Progress claim</option><option>Milestone</option></select></FormField>
                  <FormField label="Supporting Document" style={{ flex: 1 }}><input type="file" accept=".pdf,.xlsx,.xls" onChange={(e) => setSupportingFile(e.target.files?.[0] ?? null)} /></FormField>
                </div>
                <FormField label="Notes (optional)"><textarea rows={2} placeholder="Enter any additional notes" value={ipcDetails.notes} onChange={(e) => setIpcDetails({ ...ipcDetails, notes: e.target.value })} /></FormField>
                <div className="row flex-between" style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                  <button type="button" className="btn ghost" onClick={() => setTab("history")}><ArrowLeft size={14} /> Cancel</button>
                  <div className="row gap-sm"><button type="button" className="btn ghost" onClick={() => setError("Draft saved locally. Generate the IPC when the review is complete.")}>Save Draft</button>
                <SubmitButton onClick={handleSubmit} loading={loading} disabled={loading}>
                  Generate IPC
                </SubmitButton>
                  </div>
                </div>
              </div>
            </div>

            <div className="card" style={{ position: "sticky", top: 16 }}>
              <h3 style={{ marginTop: 0 }}>Live Preview</h3>
              <table className="fs-base">
                <tbody>
                  <tr><td className="muted">Work Done</td><td className="mono">{money(curGross)}</td></tr>
                  {variations > 0 && <tr><td className="muted">Variations</td><td className="mono">{money(variations)}</td></tr>}
                  <tr><td><b>Gross</b></td><td className="mono"><b>{money(gross)}</b></td></tr>
                  <tr><td className="muted">Retention ({retPct}%)</td><td className="mono text-danger">- {money(retAmt)}</td></tr>
                  {advRec > 0 && <tr><td className="muted">Advance Recovery</td><td className="mono text-danger">- {money(advRec)}</td></tr>}
                  <tr style={{ borderTop: "2px solid var(--border)" }}><td><b>Net Payable</b></td><td className="mono"><b>{money(netPayable)}</b></td></tr>
                </tbody>
              </table>
              {prevCert > 0 && (
                <div className="mt-sm p-sm fs-sm" style={{ background: "var(--surface-2)", borderRadius: 6 }}>
                  <div className="muted">Cumulative: {money(prevCert + gross)}</div>
                  <div><b>Outstanding: {money(prevCert + netPayable)}</b></div>
                </div>
              )}
            </div>
          </div>

          {boqItems.length > 0 && (
            <div className="card mt-md">
              <h3 style={{ marginTop: 0 }}>BoQ Items</h3>
              <div className="table-scroll" style={{ maxHeight: 200 }}>
                <table>
                  <thead><tr><th>Item</th><th>Description</th><th className="num">Qty</th><th className="num">Rate</th><th className="num">Amount</th><th>State</th></tr></thead>
                  <tbody>
                    {boqItems.slice(0, 20).map((item: any) => (
                      <tr key={item.id}>
                        <td className="mono">{item.item_number}</td>
                        <td>{item.description}</td>
                        <td className="num">{item.quantity}</td>
                        <td className="num">{Number(item.rate).toLocaleString()}</td>
                        <td className="num">{Number(item.amount).toLocaleString()}</td>
                        <td><span className="badge" style={{ background: item.cost_state === "certified" ? "var(--success)" : "var(--muted)" }}>{item.cost_state}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
