import { useEffect, useState } from "react";
import { useParams } from "@/components/monitoring/react-router-shim";

import { get } from "../api";
import { ErrorBanner } from "../components";
import type { WorkOrderSummary as Summary } from "../api-types";

export function WorkOrderSummary() {
  const { id = "" } = useParams();
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    get<Summary>(`/projects/${id}/work-order-summary`)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div><h2>Work Order Summary</h2><p className="muted">Loading...</p></div>;

  return (
    <div>
      <h2>Work Order Summary</h2>
      <ErrorBanner message={error} />

      {data && (
        <>
          <div className="card">
            <h3>Variance Analysis</h3>
            <table>
              <thead><tr><th>Metric</th><th>Value</th></tr></thead>
              <tbody>
                <tr><td>Total Capped</td><td className="mono">{Number(data.variance.total_capped).toLocaleString()}</td></tr>
                <tr><td>Total Certified</td><td className="mono">{Number(data.variance.total_certified).toLocaleString()}</td></tr>
                <tr><td>Total Paid</td><td className="mono">{Number(data.variance.total_paid).toLocaleString()}</td></tr>
                <tr>
                  <td>Variance (Certified - Capped)</td>
                  <td className="mono" style={{ color: Number(data.variance.variance_certified_vs_capped) > 0 ? "#e53935" : "#43a047" }}>
                    {Number(data.variance.variance_certified_vs_capped).toLocaleString()}
                  </td>
                </tr>
                <tr>
                  <td>Variance (Paid - Certified)</td>
                  <td className="mono" style={{ color: Number(data.variance.variance_paid_vs_certified) > 0 ? "#e53935" : "#43a047" }}>
                    {Number(data.variance.variance_paid_vs_certified).toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="card">
            <h3>By Subcontractor</h3>
            <table>
              <thead><tr><th>Subcontractor</th><th>Orders</th><th>Capped</th><th>Certified</th><th>Paid</th></tr></thead>
              <tbody>
                {data.by_subcontractor.map(b => (
                  <tr key={b.subcontractor_id}>
                    <td><strong>{b.subcontractor_name}</strong></td>
                    <td>{b.count}</td>
                    <td className="mono">{Number(b.total_capped).toLocaleString()}</td>
                    <td className="mono">{Number(b.total_certified).toLocaleString()}</td>
                    <td className="mono">{Number(b.total_paid).toLocaleString()}</td>
                  </tr>
                ))}
                {data.by_subcontractor.length === 0 && <tr><td colSpan={5} className="empty">No data.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h3>By Section</h3>
            <table>
              <thead><tr><th>Section</th><th>Orders</th><th>Capped</th><th>Certified</th><th>Paid</th></tr></thead>
              <tbody>
                {data.by_section.map(b => (
                  <tr key={b.section}>
                    <td><strong>{b.section}</strong></td>
                    <td>{b.count}</td>
                    <td className="mono">{Number(b.total_capped).toLocaleString()}</td>
                    <td className="mono">{Number(b.total_certified).toLocaleString()}</td>
                    <td className="mono">{Number(b.total_paid).toLocaleString()}</td>
                  </tr>
                ))}
                {data.by_section.length === 0 && <tr><td colSpan={5} className="empty">No data.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
