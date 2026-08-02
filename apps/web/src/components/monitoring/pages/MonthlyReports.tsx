import { FileDown, FileSpreadsheet } from "lucide-react";
import { useEffect, useState } from "react";

import { API_BASE, authHeaders, fetchMonthlyReport } from "../api";
import { EmptyState } from "../components/EmptyState";
import { ErrorBanner, Skeleton } from "../components";

export function MonthlyReports() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [report, setReport] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const projectId = sessionStorage.getItem("activeProject") || "";

  const load = () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    fetchMonthlyReport(projectId, year, month)
      .then(setReport)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [projectId, year, month]);

  const downloadPdf = () => {
    if (!projectId) return;
    const url = `${API_BASE}/reports/monthly.pdf?project_id=${encodeURIComponent(projectId)}&year=${year}&month=${month}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `monthly-report-${year}-${String(month).padStart(2, "0")}.pdf`;
    a.click();
  };

  const downloadExcel = async () => {
    if (!projectId) return;
    try {
      const res = await fetch(`${API_BASE}/reports/monthly.xlsx?project_id=${encodeURIComponent(projectId)}&year=${year}&month=${month}`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Failed to download Excel report");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `monthly-report-${year}-${String(month).padStart(2, "0")}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const summary = report?.summary ?? report;

  const cards: { label: string; value: string | number | null; color?: string }[] = [
    { label: "Total Submissions", value: summary?.total_submissions },
    { label: "Milestones Completed", value: summary?.milestones_completed },
    { label: "Avg Progress", value: summary?.avg_progress != null ? `${summary.avg_progress}%` : null },
    { label: "Issues", value: summary?.issues },
    { label: "Deliveries", value: summary?.deliveries },
    { label: "Incidents", value: summary?.incidents },
    { label: "Compliance Rate", value: summary?.compliance_rate != null ? `${summary.compliance_rate}%` : null },
  ];

  return (
    <div>
      <div className="row flex-between mb-sm">
        <h2 className="m-0">Monthly Reports</h2>
        <div className="row" style={{ gap: 8 }}>
          <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ width: 100 }}>
            {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select value={month} onChange={e => setMonth(Number(e.target.value))} style={{ width: 120 }}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{new Date(2000, m - 1).toLocaleString("default", { month: "long" })}</option>
            ))}
          </select>
        </div>
      </div>

      <ErrorBanner message={error} />

      {!projectId ? (
        <div className="card text-center" style={{ padding: 32 }}>
          <p className="muted">Select a project from the header dropdown to view monthly reports.</p>
        </div>
      ) : loading ? (
        <Skeleton count={4} height={80} style={{ marginBottom: 8 }} />
      ) : !report ? (
        <EmptyState
          icon={<FileSpreadsheet size={40} />}
          title="No report for this period"
          description="Data may not yet be available for the selected month."
        />
      ) : (
        <>
          <div className="grid mb-sm">
            {cards.map(c => (
              <div className="card card-compact" key={c.label}>
                <div className="muted fs-sm">{c.label}</div>
                <div className="fs-lg fw-700" style={c.color ? { color: c.color } : undefined}>
                  {c.value ?? "—"}
                </div>
              </div>
            ))}
          </div>

          <div className="card row" style={{ gap: 8 }}>
            <button className="btn ghost" onClick={downloadPdf}>
              <FileDown size={16} /> Download PDF
            </button>
            <button className="btn ghost" onClick={downloadExcel}>
              <FileSpreadsheet size={16} /> Download Excel (.xlsx)
            </button>
          </div>

          <div className="table-wrap">
            <div className="card">
              <h3>Weekly Breakdown</h3>
              <table>
                <thead><tr>
                  <th>Week</th><th>Submissions</th><th>Milestones</th><th>Avg Progress</th><th>Issues</th><th>Deliveries</th><th>Incidents</th>
                </tr></thead>
                <tbody>
                  {(report.weeks ?? []).map((w: any, i: number) => (
                    <tr key={i}>
                      <td>{w.week || w.week_label || `Week ${i + 1}`}</td>
                      <td>{w.submissions ?? "—"}</td>
                      <td>{w.milestones ?? w.milestones_completed ?? "—"}</td>
                      <td>{w.avg_progress != null ? `${w.avg_progress}%` : "—"}</td>
                      <td>{w.issues ?? "—"}</td>
                      <td>{w.deliveries ?? w.material_deliveries ?? "—"}</td>
                      <td>{w.incidents ?? w.hs_incidents ?? "—"}</td>
                    </tr>
                  ))}
                  {(report.weeks ?? []).length === 0 && (
                    <tr><td colSpan={7} className="empty">No weekly data for this month.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
