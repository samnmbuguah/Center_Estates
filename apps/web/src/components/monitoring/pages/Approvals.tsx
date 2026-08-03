import { useEffect, useState } from "react";
import { Link } from "@/components/monitoring/react-router-shim";
import { Shield } from "lucide-react";
import { useAuth } from "../auth";
import { ErrorBanner } from "../components";
import { get } from "../api";

export function Approvals() {
  const { can } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>({
    verifications: [], boqDraft: 0, variations: [], contingencies: [], consultantPayments: [],
  });
  const [loading, setLoading] = useState(true);
  const projectId = sessionStorage.getItem("activeProject");

  useEffect(() => {
    setLoading(true);
    if (!projectId) { setLoading(false); return; }
    const api = `/projects/${projectId}`;
    Promise.all([
      get<any[]>("/milestones/pending-verification").catch(() => []),
      get<any>(`${api}/boq-review`).catch(() => ({ draft: [] })),
      get<any[]>(`${api}/variations`).catch(() => []),
      get<any[]>(`${api}/contingency-drawdowns`).catch(() => []),
    ]).then(([v, b, va, c]) => {
      setData({
        verifications: Array.isArray(v) ? v : [],
        boqDraft: Array.isArray(b?.draft) ? b.draft.length : 0,
        variations: Array.isArray(va) ? va.filter((x: any) => x.status === "submitted") : [],
        contingencies: Array.isArray(c) ? c.filter((x: any) => x.status === "submitted") : [],
      });
    }).finally(() => setLoading(false));
  }, [projectId]);

  const totalPending = data.verifications.length + data.boqDraft +
    data.variations.length + data.contingencies.length;

  return (
    <div>
      <div className="row flex-center mb-md">
        <Shield size={24} />
        <div>
          <h2 style={{ margin: 0 }}>Approvals & Reviews</h2>
          <p className="muted fs-base">
            {totalPending} items pending your review
          </p>
        </div>
      </div>
      <ErrorBanner message={error} />

      {loading ? (
        <p className="muted">Loading...</p>
      ) : (
        <div className="gap-lg" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>


          <div className="card card-accent" style={{ borderLeftColor: data.boqDraft ? "var(--warning)" : "var(--success)" }}>
            <div className="row flex-between mb-sm">
              <h3 className="fs-md" style={{ margin: 0 }}>BoQ Items</h3>
              <span className="badge" style={{ background: data.boqDraft ? "var(--warning)" : "var(--success)" }}>
                {data.boqDraft} draft
              </span>
            </div>
            {data.boqDraft === 0 ? (
              <p className="muted fs-base">All items approved.</p>
            ) : (
              <Link to={`/app/projects/${projectId}/boq-review`} className="btn sm mt-sm fs-sm">
                <Shield size={12} className="mr-xs" /> Review {data.boqDraft} draft items
              </Link>
            )}
          </div>

          <div className="card card-accent" style={{ borderLeftColor: data.variations.length ? "var(--warning)" : "var(--success)" }}>
            <div className="row flex-between mb-sm">
              <h3 className="fs-md" style={{ margin: 0 }}>Variation Orders</h3>
              <span className="badge" style={{ background: data.variations.length ? "var(--warning)" : "var(--success)" }}>
                {data.variations.length}
              </span>
            </div>
            {data.variations.length === 0 && <p className="muted fs-base">No pending variations.</p>}
            {data.variations.map((v: any) => (
              <div key={v.id} className="fs-sm" style={{ padding: "4px 0" }}>
                {v.variation_number}: {v.description?.slice(0, 40)}
              </div>
            ))}
            {data.variations.length > 0 && (
              <Link to={`/app/projects/${projectId}/variations`} className="btn sm mt-sm fs-sm">
                Review {data.variations.length} variations
              </Link>
            )}
          </div>

          <div className="card card-accent" style={{ borderLeftColor: data.contingencies.length ? "var(--warning)" : "var(--success)" }}>
            <div className="row flex-between mb-sm">
              <h3 className="fs-md" style={{ margin: 0 }}>Contingency Drawdowns</h3>
              <span className="badge">{data.contingencies.length}</span>
            </div>
            {data.contingencies.length === 0 && <p className="muted fs-base">No pending drawdowns.</p>}
            {data.contingencies.length > 0 && (
              <Link to={`/app/projects/${projectId}/contingency-drawdowns`} className="btn sm mt-sm fs-sm">
                Review {data.contingencies.length} drawdowns
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}