import { useEffect, useState } from "react";
import { useParams, Link } from "@/components/monitoring/react-router-shim";
import { ArrowLeft, CheckCircle, Download, Shield, FileText, Upload, Info } from "lucide-react";
import {
  fetchProjects,
  fetchBoqItems,
  fetchCostDashboard,
  generateIpc,
  checkDrawdownEligibility,
  fetchCertificates,
  voidCertificate,
  fetchCertificatePdf,
} from "../api";
import { useAuth } from "../auth";
import { ErrorBanner, FormField, SubmitButton } from "../components";
import { moneyExact as money, formatDateTime } from "../lib/format";

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
    number: "",
    cert_type: "interim",
    current_gross: "",
    materials_on_site: "0",
    variations: "0",
    advance_recovery: "0",
    retention_percent: "5",
    previous_certified: "0",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [drawdownCheck, setDrawdownCheck] = useState<any>(null);
  const [checkingDrawdown, setCheckingDrawdown] = useState(false);
  const [drawdownMilestoneId, setDrawdownMilestoneId] = useState("");
  const [qsFile, setQsFile] = useState<File | null>(null);
  const todayIso = new Date().toISOString().slice(0, 10);
  const [ipcDetails, setIpcDetails] = useState({
    valuationDate: todayIso,
    paymentDate: "",
    terms: "30 Days from IPC issue",
    currency: "KES",
    basis: "Valuation",
    notes: "",
  });
  const [supportingFile, setSupportingFile] = useState<File | null>(null);
  const [packageValues, setPackageValues] = useState<Record<string, string>>({});

  const loadCerts = () => {
    if (!id) return;
    fetchCertificates()
      .then((all) => {
        const projCerts = all.filter((c: any) => c.project_id === id);
        setCertificates(projCerts);
        const activeCerts = projCerts.filter((c: any) => c.status !== "void");
        const prevTotal = activeCerts.reduce((s: number, c: any) => s + Number(c.current_gross ?? c.amount ?? 0), 0);
        setForm((prev) => ({
          ...prev,
          number: prev.number || `IPC-${String(projCerts.length + 1).padStart(3, "0")}`,
          previous_certified: prevTotal > 0 ? String(prevTotal.toFixed(2)) : prev.previous_certified,
        }));
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchProjects().then(setProjects).catch((e) => setError(e.message));
    if (id) {
      fetchBoqItems(id)
        .then((items) => {
          setBoqItems(items);
          const initialVals: Record<string, string> = {};
          for (const it of items as any[]) {
            const certAmt = Number(it.certified_amount || 0);
            const execAmt = Number(it.executed_quantity || 0) * Number(it.rate || 0);
            const best = Math.max(certAmt, execAmt);
            if (best > 0) {
              initialVals[String(it.id)] = String(best.toFixed(2));
            }
          }
          setPackageValues(initialVals);
        })
        .catch(() => {});
      fetchCostDashboard(id)
        .then((cd: any) => {
          setForm((prev) => ({
            ...prev,
            variations: Number(cd?.approved_variations || 0) > 0 ? String(cd.approved_variations) : prev.variations,
            materials_on_site: Number(cd?.materials_on_site || 0) > 0 ? String(cd.materials_on_site) : prev.materials_on_site,
          }));
        })
        .catch(() => {});
      loadCerts();
    }
  }, [id]);

  const projectName = projects.find((p) => p.id === id)?.name ?? id;
  // Include ALL project BoQ items (no artificial .slice(0, 8) cap)
  const workPackages = boqItems.map((item: any, index) => ({
    id: String(item.id ?? index),
    section: item.section || "general",
    code: item.item_number || `${index + 1}`,
    name: item.description || item.item_number || `Work package ${index + 1}`,
    contract: Number(item.amount ?? item.total ?? ((item.rate ?? 0) * (item.quantity ?? 0))),
    executedValue: Number(item.executed_quantity || 0) * Number(item.rate || 0),
    certifiedValue: Number(item.certified_amount || 0),
  }));

  const packageTotal = Object.values(packageValues).reduce((sum, value) => sum + (Number(value) || 0), 0);
  const curGross = packageTotal > 0 ? packageTotal : (Number(form.current_gross) || 0);
  const mosVal = Number(form.materials_on_site) || 0;
  const variations = Number(form.variations) || 0;
  const gross = curGross + mosVal + variations;
  const retPct = Number(form.retention_percent) || 0;
  const retAmt = (gross * retPct) / 100;
  const advRec = Number(form.advance_recovery) || 0;
  const netPayable = Math.max(0, gross - retAmt - advRec);
  const prevCert = Number(form.previous_certified) || 0;

  // Compute independent field projection from Clerk of Works executed_quantity + certified_amount
  const fieldMeasuredTotal = workPackages.reduce(
    (sum, wp) => sum + Math.max(wp.executedValue, wp.certifiedValue),
    0
  );
  const projectedValue = fieldMeasuredTotal > 0 ? fieldMeasuredTotal : Math.max(0, curGross);
  const variance = curGross - projectedValue;

  // Derive real latest sync timestamp from BoQ items or certificates
  const latestSyncMs = Math.max(
    0,
    ...boqItems.map((b: any) => Number(b.progress_updated_at || 0)),
    ...certificates.map((c: any) => Number(c.issued_at || 0))
  );
  const lastSyncLabel = latestSyncMs > 0 ? formatDateTime(latestSyncMs) : "Live connected";

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.number.trim()) errs.number = "Required";
    const effectiveGross = packageTotal > 0 ? packageTotal : Number(form.current_gross);
    if (!effectiveGross || isNaN(effectiveGross) || effectiveGross <= 0) {
      errs.current_gross = "Enter work package valuations or Work Done This Period (> 0)";
    }
    if (form.variations && (isNaN(Number(form.variations)) || Number(form.variations) < 0)) {
      errs.variations = "Must be ≥ 0";
    }
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
        project_id: id,
        number: form.number,
        cert_type: form.cert_type,
        current_gross: String(curGross),
        materials_on_site: String(mosVal),
        variations: form.variations,
        advance_recovery: form.advance_recovery,
        retention_percent: form.retention_percent,
        previous_certified: form.previous_certified,
        boq_items: workPackages.map((item) => ({
          boq_item_id: item.id,
          item_number: item.code,
          description: item.name,
          amount: String(item.contract),
          valuation_amount: String(Number(packageValues[item.id] || 0)),
          is_incremental: prevCert > 0,
        })),
        valuation_metadata: {
          source: "QS valuation",
          mobile_projection: projectedValue,
          materials_on_site: mosVal,
          variance,
          variance_percent: (variance / Math.max(projectedValue, 1)) * 100,
          valuation_date: ipcDetails.valuationDate,
          notes: ipcDetails.notes,
        },
        supporting_documents: [qsFile, supportingFile]
          .filter(Boolean)
          .map((file) => ({ name: (file as File).name, size: (file as File).size, type: (file as File).type })),
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
              <span className="badge" style={{ background: "var(--success)", color: "#fff" }}>{cert.status || "issued"}</span>
            </div>
            <button className="btn ghost sm" onClick={() => handleDownloadPdf(cert.id)}>
              <Download size={14} /> PDF
            </button>
          </div>
          <table>
            <tbody>
              <tr><td className="muted">Previous Certified</td><td className="mono">{money(bd.previous_certified)}</td></tr>
              <tr><td className="muted">Permanent Work Executed This Period</td><td className="mono">{money(bd.current_gross)}</td></tr>
              {Number(bd.materials_on_site) > 0 && <tr><td className="muted">Materials on Site (Unfixed @ 80%)</td><td className="mono">{money(bd.materials_on_site)}</td></tr>}
              {Number(bd.variations) > 0 && <tr><td className="muted">Approved Variations</td><td className="mono">{money(bd.variations)}</td></tr>}
              <tr><td><b>Gross Certified</b></td><td className="mono"><b>{money(bd.gross)}</b></td></tr>
              <tr><td className="muted">Retention ({bd.retention_percent}%)</td><td className="mono text-danger">- {money(bd.retention_amount)}</td></tr>
              {Number(bd.advance_recovery) > 0 && <tr><td className="muted">Advance Recovery</td><td className="mono text-danger">- {money(bd.advance_recovery)}</td></tr>}
              <tr style={{ background: "var(--surface-2)" }}><td><b>Net Payable</b></td><td className="mono"><b>{money(bd.net_payable)}</b></td></tr>
            </tbody>
          </table>
        </div>
        <div className="row" style={{ gap: 8, marginTop: 16 }}>
          <button
            className="btn"
            onClick={() => {
              setSuccess(null);
              setForm({
                ...form,
                number: `IPC-${String(certificates.length + 1).padStart(3, "0")}`,
                current_gross: "",
                previous_certified: String((prevCert + gross).toFixed(2)),
              });
            }}
          >
            Generate Another
          </button>
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
          <h2 style={{ margin: 0 }}>Interim Payment Certificates (JBC / FIDIC Valuation)</h2>
          <div className="muted fs-base">{projectName}</div>
        </div>
      </div>
      <ErrorBanner message={error} />

      {/* Tabs */}
      <div className="row gap-xs mb-md">
        <button className={tab === "history" ? "btn sm" : "btn ghost sm"} onClick={() => setTab("history")}>
          <FileText size={14} /> History ({certificates.length})
        </button>
        {can("finance.certificate.issue") && (
          <button className={tab === "new" ? "btn sm" : "btn ghost sm"} onClick={() => setTab("new")}>
            + New IPC Valuation
          </button>
        )}
      </div>

      {tab === "history" && (
        <div className="card table-scroll">
          {certificates.length === 0 ? (
            <p className="muted">No certificates issued yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Type</th>
                  <th>Gross Valuation</th>
                  <th>Retention</th>
                  <th>Net Payable</th>
                  <th>Status</th>
                  <th>Issued</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {certificates.map((c: any) => (
                  <tr key={c.id}>
                    <td className="mono"><strong>{c.number}</strong></td>
                    <td>{c.cert_type}</td>
                    <td className="mono">{money(c.amount)}</td>
                    <td className="mono text-danger">{money(c.retention_amount)}</td>
                    <td className="mono"><strong>{money(c.net_payable)}</strong></td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: c.status === "paid" ? "var(--success)" : c.status === "void" ? "var(--faint)" : "var(--warning)",
                        }}
                      >
                        {c.status || "issued"}
                      </span>
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
              <h4 style={{ margin: 0 }}>Stage-Gate Drawdown Eligibility</h4>
            </div>
            <div className="row gap-md" style={{ flexWrap: "wrap" }}>
              <input
                placeholder="Enter Milestone ID or UUID to verify stage-gate & photo evidence..."
                value={drawdownMilestoneId}
                onChange={(e) => setDrawdownMilestoneId(e.target.value)}
                className="flex-1"
                style={{ minWidth: 220 }}
              />
              <button className="btn" onClick={handleDrawdownCheck} disabled={checkingDrawdown || !drawdownMilestoneId.trim()}>
                {checkingDrawdown ? "Checking..." : "Check Eligibility"}
              </button>
            </div>
            {drawdownCheck && (
              <div
                style={{
                  marginTop: 8,
                  padding: 8,
                  borderRadius: 6,
                  background: drawdownCheck.eligible ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                  border: `1px solid ${drawdownCheck.eligible ? "var(--success)" : "var(--danger)"}`,
                }}
              >
                <strong style={{ color: drawdownCheck.eligible ? "var(--success)" : "var(--danger)" }}>
                  {drawdownCheck.eligible ? "✓ Eligible for Certification" : "✗ Stage-Gate Blocked"}
                </strong>
                <div className="fs-sm mt-xs">{drawdownCheck.summary || drawdownCheck.reason}</div>
              </div>
            )}
          </div>

          <div className="card mb-md">
            <div className="row flex-between mb-sm">
              <div className="row flex-center">
                <Upload size={18} style={{ color: "var(--primary)" }} />
                <h3 style={{ margin: 0 }}>QS Valuation &amp; Bill of Quantities Work Packages ({workPackages.length} items)</h3>
              </div>
              <span className="badge">Step 1–2</span>
            </div>
            <p className="muted fs-sm">
              Upload the QS valuation sheet or review each BoQ work package below. Certified values from verified Mini-BoQ milestones and Clerk of Works site measurements are pre-populated automatically.
            </p>
            <label className="card" style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", borderStyle: "dashed", marginBottom: 12 }}>
              <Upload size={20} />
              <span>{qsFile ? qsFile.name : "Choose QS valuation report (PDF or Excel)"}</span>
              <input type="file" accept=".pdf,.xlsx,.xls" hidden onChange={(e) => setQsFile(e.target.files?.[0] ?? null)} />
            </label>
            {workPackages.length > 0 ? (
              <>
                <div className="row gap-xs mb-sm" style={{ flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn ghost sm"
                    onClick={() => {
                      const next: Record<string, string> = {};
                      for (const wp of workPackages) {
                        const uncert = Math.max(0, wp.executedValue - wp.certifiedValue);
                        if (uncert > 0) next[wp.id] = uncert.toFixed(2);
                      }
                      setPackageValues(next);
                    }}
                  >
                    Pre-fill Uncertified Progress
                  </button>
                  <button
                    type="button"
                    className="btn ghost sm"
                    onClick={() => {
                      const next: Record<string, string> = {};
                      for (const wp of workPackages) {
                        const best = Math.max(wp.executedValue, wp.certifiedValue);
                        if (best > 0) next[wp.id] = best.toFixed(2);
                      }
                      setPackageValues(next);
                    }}
                  >
                    Pre-fill Cumulative Executed
                  </button>
                  <button
                    type="button"
                    className="btn ghost sm"
                    onClick={() => setPackageValues({})}
                  >
                    Clear All
                  </button>
                </div>
                <div className="table-scroll" style={{ maxHeight: 360 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Section</th>
                        <th>Work Package Description</th>
                        <th className="num">Contract Sum (KES)</th>
                        <th className="num">Prev. Certified (KES)</th>
                        <th className="num">This Valuation (KES)</th>
                        <th className="num">Cum. % Certified</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workPackages.map((item) => {
                        const value = Number(packageValues[item.id] || 0);
                        const cumCert = prevCert > 0 ? item.certifiedValue + value : Math.max(item.certifiedValue, value);
                        return (
                          <tr key={item.id}>
                            <td className="mono">{item.code}</td>
                            <td style={{ textTransform: "capitalize" }}>{item.section}</td>
                            <td>{item.name}</td>
                            <td className="mono num">{money(item.contract, "")}</td>
                            <td className="mono num muted">{money(item.certifiedValue, "")}</td>
                            <td className="num">
                              <input
                                inputMode="decimal"
                                value={packageValues[item.id] ?? ""}
                                placeholder="0"
                                style={{ width: 130, textAlign: "right" }}
                                onChange={(e) => setPackageValues({ ...packageValues, [item.id]: e.target.value })}
                              />
                            </td>
                            <td className="mono num">
                              {item.contract ? `${Math.min(100, (cumCert / item.contract) * 100).toFixed(1)}%` : "—"}
                            </td>
                          </tr>
                        );
                      })}
                      <tr style={{ background: "var(--surface-2)" }}>
                        <td colSpan={4}><b>Total QS Work Package Valuation</b></td>
                        <td className="mono num muted"><b>{money(workPackages.reduce((s, w) => s + w.certifiedValue, 0))}</b></td>
                        <td className="mono num"><b>{money(packageTotal)}</b></td>
                        <td />
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="muted fs-sm">No BoQ work packages are available yet; enter the total valuation below.</div>
            )}
          </div>

          <div className="card mb-md">
            <div className="row flex-center mb-sm">
              <Shield size={18} style={{ color: "var(--success)" }} />
              <h3 style={{ margin: 0 }}>Site Verification Value Projection</h3>
            </div>
            <p className="muted fs-sm">
              Independent estimate derived from Clerk of Works field measurements and verified Mini-BoQ stage-gates.
            </p>
            <div className="row gap-md" style={{ flexWrap: "wrap" }}>
              <div className="card" style={{ flex: 1, minWidth: 160 }}>
                <div className="muted fs-sm">Field Projected Value</div>
                <strong className="mono" style={{ color: "var(--primary)" }}>{money(projectedValue)}</strong>
              </div>
              <div className="card" style={{ flex: 1, minWidth: 160 }}>
                <div className="muted fs-sm">Latest Field Sync</div>
                <strong>{lastSyncLabel}</strong>
              </div>
              <div className="card" style={{ flex: 1, minWidth: 160 }}>
                <div className="muted fs-sm">Variance (QS vs Field)</div>
                <strong style={{ color: Math.abs(variance) / Math.max(projectedValue, 1) <= 0.1 ? "var(--success)" : "var(--danger)" }}>
                  {money(variance)} ({((variance / Math.max(projectedValue, 1)) * 100).toFixed(2)}%)
                </strong>
              </div>
            </div>
            <div className="mt-sm p-sm fs-sm" style={{ background: "var(--surface-2)", borderRadius: 6 }}>
              <Info size={14} /> Acceptable variance threshold: ±10%. Large variances between QS valuation and field measurements should be reconciled before certification.
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, alignItems: "start" }}>
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Payment Details &amp; Contractual Deductions</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div className="row gap-md" style={{ flexWrap: "wrap" }}>
                  <FormField label="Certificate Number" required error={fieldErrors.number} style={{ flex: 1, minWidth: 160 }}>
                    <input
                      placeholder="IPC-001"
                      value={form.number}
                      onChange={(e) => { setForm({ ...form, number: e.target.value }); setFieldErrors((f) => ({ ...f, number: "" })); }}
                      disabled={loading}
                    />
                  </FormField>
                  <FormField label="Type" style={{ width: 130 }}>
                    <select value={form.cert_type} onChange={(e) => setForm({ ...form, cert_type: e.target.value })} disabled={loading}>
                      <option value="interim">Interim</option>
                      <option value="final">Final</option>
                    </select>
                  </FormField>
                </div>
                <div className="row gap-md" style={{ flexWrap: "wrap" }}>
                  <FormField label="Previous Certified (KES)" style={{ flex: 1, minWidth: 160 }}>
                    <input
                      placeholder="0"
                      inputMode="decimal"
                      value={form.previous_certified}
                      onChange={(e) => setForm({ ...form, previous_certified: e.target.value })}
                      disabled={loading}
                    />
                  </FormField>
                  <FormField label="Work Done This Period (KES)" required error={fieldErrors.current_gross} style={{ flex: 1, minWidth: 160 }}>
                    <input
                      placeholder="75000"
                      inputMode="decimal"
                      value={packageTotal > 0 ? String(packageTotal.toFixed(2)) : form.current_gross}
                      onChange={(e) => { setForm({ ...form, current_gross: e.target.value }); setFieldErrors((f) => ({ ...f, current_gross: "" })); }}
                      disabled={loading || packageTotal > 0}
                    />
                  </FormField>
                </div>
                <div className="row gap-md" style={{ flexWrap: "wrap" }}>
                  <FormField label="Materials on Site (Unfixed @ 80%)" style={{ flex: 1, minWidth: 150 }}>
                    <input
                      placeholder="0"
                      inputMode="decimal"
                      value={form.materials_on_site}
                      onChange={(e) => setForm({ ...form, materials_on_site: e.target.value })}
                      disabled={loading}
                    />
                  </FormField>
                  <FormField label="Approved Variations (KES)" error={fieldErrors.variations} style={{ flex: 1, minWidth: 150 }}>
                    <input
                      placeholder="0"
                      inputMode="decimal"
                      value={form.variations}
                      onChange={(e) => { setForm({ ...form, variations: e.target.value }); setFieldErrors((f) => ({ ...f, variations: "" })); }}
                      disabled={loading}
                    />
                  </FormField>
                </div>
                <div className="row gap-md" style={{ flexWrap: "wrap" }}>
                  <FormField label="Advance Recovery (KES)" style={{ flex: 1, minWidth: 150 }}>
                    <input
                      placeholder="0"
                      inputMode="decimal"
                      value={form.advance_recovery}
                      onChange={(e) => setForm({ ...form, advance_recovery: e.target.value })}
                      disabled={loading}
                    />
                  </FormField>
                  <FormField label="Retention %" style={{ width: 120 }}>
                    <input
                      placeholder="5"
                      inputMode="decimal"
                      value={form.retention_percent}
                      onChange={(e) => setForm({ ...form, retention_percent: e.target.value })}
                      disabled={loading}
                    />
                  </FormField>
                </div>
                <div className="row gap-md" style={{ flexWrap: "wrap" }}>
                  <FormField label="Valuation Date" required style={{ flex: 1, minWidth: 140 }}>
                    <input type="date" value={ipcDetails.valuationDate} onChange={(e) => setIpcDetails({ ...ipcDetails, valuationDate: e.target.value })} />
                  </FormField>
                  <FormField label="Payment Due Date" style={{ flex: 1, minWidth: 140 }}>
                    <input type="date" value={ipcDetails.paymentDate} onChange={(e) => setIpcDetails({ ...ipcDetails, paymentDate: e.target.value })} />
                  </FormField>
                  <FormField label="Payment Terms" style={{ flex: 1, minWidth: 160 }}>
                    <select value={ipcDetails.terms} onChange={(e) => setIpcDetails({ ...ipcDetails, terms: e.target.value })}>
                      <option>30 Days from IPC issue</option>
                      <option>14 Days from IPC issue</option>
                      <option>60 Days from IPC issue</option>
                    </select>
                  </FormField>
                </div>
                <div className="row gap-md" style={{ flexWrap: "wrap" }}>
                  <FormField label="Currency" style={{ width: 120 }}>
                    <select value={ipcDetails.currency} onChange={(e) => setIpcDetails({ ...ipcDetails, currency: e.target.value })}>
                      <option>KES</option>
                      <option>USD</option>
                    </select>
                  </FormField>
                  <FormField label="Payment Basis" style={{ flex: 1, minWidth: 140 }}>
                    <select value={ipcDetails.basis} onChange={(e) => setIpcDetails({ ...ipcDetails, basis: e.target.value })}>
                      <option>Valuation</option>
                      <option>Progress claim</option>
                      <option>Milestone</option>
                    </select>
                  </FormField>
                  <FormField label="Supporting Document" style={{ flex: 1, minWidth: 180 }}>
                    <input type="file" accept=".pdf,.xlsx,.xls" onChange={(e) => setSupportingFile(e.target.files?.[0] ?? null)} />
                  </FormField>
                </div>
                <FormField label="Notes (optional)">
                  <textarea rows={2} placeholder="Enter any additional QS certification notes" value={ipcDetails.notes} onChange={(e) => setIpcDetails({ ...ipcDetails, notes: e.target.value })} />
                </FormField>
                <div className="row flex-between" style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                  <button type="button" className="btn ghost" onClick={() => setTab("history")}><ArrowLeft size={14} /> Cancel</button>
                  <div className="row gap-sm">
                    <SubmitButton onClick={handleSubmit} loading={loading} disabled={loading}>
                      Certify &amp; Issue IPC
                    </SubmitButton>
                  </div>
                </div>
              </div>
            </div>

            <div className="card" style={{ position: "sticky", top: 16 }}>
              <h3 style={{ marginTop: 0 }}>Live IPC Valuation Summary</h3>
              <table className="fs-base">
                <tbody>
                  <tr><td className="muted">Permanent Works</td><td className="mono num">{money(curGross)}</td></tr>
                  {mosVal > 0 && <tr><td className="muted">Materials on Site (80%)</td><td className="mono num">{money(mosVal)}</td></tr>}
                  {variations > 0 && <tr><td className="muted">Approved Variations</td><td className="mono num">{money(variations)}</td></tr>}
                  <tr><td><b>Gross Valuation</b></td><td className="mono num"><b>{money(gross)}</b></td></tr>
                  <tr><td className="muted">Retention ({retPct}%)</td><td className="mono num text-danger">- {money(retAmt)}</td></tr>
                  {advRec > 0 && <tr><td className="muted">Advance Recovery</td><td className="mono num text-danger">- {money(advRec)}</td></tr>}
                  <tr style={{ borderTop: "2px solid var(--border)" }}>
                    <td><b>Net Payable</b></td>
                    <td className="mono num" style={{ color: "var(--success)" }}><b>{money(netPayable)}</b></td>
                  </tr>
                </tbody>
              </table>
              {prevCert > 0 && (
                <div className="mt-sm p-sm fs-sm" style={{ background: "var(--surface-2)", borderRadius: 6 }}>
                  <div className="muted">Previously Certified: {money(prevCert)}</div>
                  <div><b>Cumulative Certified to Date: {money(prevCert + gross)}</b></div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
