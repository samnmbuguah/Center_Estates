import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "@/components/monitoring/react-router-shim";

import { get, post } from "../api";
import { useAuth } from "../auth";
import { ErrorBanner } from "../components";

export function QualityTests() {
  const { id = "" } = useParams();
  const { can } = useAuth();
  const [tests, setTests] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ test_type: "concrete_cube", sample_id: "", location: "", grade: "", test_date: "", result_date: "", result_value: "", passed: "", notes: "" });

  const load = () => {
    setLoading(true);
    get<any[]>(`/projects/${id}/quality-tests`).then(setTests).catch(e => setError(e.message)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [id]);

  const submit = () => {
    setError(null);
    const body: any = { ...form };
    if (form.passed !== "") body.passed = form.passed === "true";
    post(`/projects/${id}/quality-tests`, body).then(() => {
      setForm({ test_type: "concrete_cube", sample_id: "", location: "", grade: "", test_date: "", result_date: "", result_value: "", passed: "", notes: "" });
      load();
    }).catch(e => setError(e.message));
  };
  const exportCsv = () => {
    const rows = [["Sample ID", "Type", "Location", "Grade", "Test Date", "Result", "Passed"], ...tests.map(t => [t.sample_id, t.test_type, t.location, t.grade, t.test_date, t.result_value, t.passed == null ? "" : t.passed ? "Yes" : "No"] )];
    const csv = rows.map(row => row.map(v => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = `quality-tests-${id || "project"}.csv`; a.click();
  };

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}><h2>Quality Tests</h2><button className="btn ghost sm" onClick={exportCsv}><Download size={14} /> Export CSV</button></div>
      <ErrorBanner message={error} />
      {loading ? <p className="muted">Loading...</p> : (
      <div className="card">
        <table>
          <thead><tr><th>Sample ID</th><th>Type</th><th>Location</th><th>Grade</th><th>Test Date</th><th>Result</th><th>Passed</th></tr></thead>
          <tbody>
            {tests.map(t => (
              <tr key={t.id}>
                <td>{t.sample_id}</td><td>{t.test_type}</td><td>{t.location}</td><td>{t.grade}</td>
                <td>{t.test_date}</td><td>{t.result_value}</td>
                <td>{t.passed === true ? "Yes" : t.passed === false ? "No" : "—"}</td>
              </tr>
            ))}
            {tests.length === 0 && <tr><td colSpan={7} className="empty">No quality tests recorded.</td></tr>}
          </tbody>
        </table>
      </div>
      )}

      {can("site.reporting.daily.manage") && (
        <div className="card">
          <h3>Record Test</h3>
          <div className="row wrap" style={{ gap: 8 }}>
            <input placeholder="Sample ID *" value={form.sample_id} onChange={e => setForm({ ...form, sample_id: e.target.value })} />
            <select value={form.test_type} onChange={e => setForm({ ...form, test_type: e.target.value })}>
              <option value="concrete_cube">Concrete Cube</option>
              <option value="steel">Steel</option>
              <option value="soil">Soil</option>
              <option value="asphalt">Asphalt</option>
              <option value="water">Water</option>
              <option value="other">Other</option>
            </select>
            <input placeholder="Location" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
            <input placeholder="Grade" value={form.grade} onChange={e => setForm({ ...form, grade: e.target.value })} />
            <input type="date" value={form.test_date} onChange={e => setForm({ ...form, test_date: e.target.value })} />
            <input type="date" value={form.result_date} placeholder="Result date" onChange={e => setForm({ ...form, result_date: e.target.value })} />
            <input placeholder="Result value" value={form.result_value} onChange={e => setForm({ ...form, result_value: e.target.value })} />
            <select value={form.passed} onChange={e => setForm({ ...form, passed: e.target.value })}>
              <option value="">Pass/Fail</option>
              <option value="true">Pass</option>
              <option value="false">Fail</option>
            </select>
            <input placeholder="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            <button className="btn" onClick={submit}>Record</button>
          </div>
        </div>
      )}
    </div>
  );
}
