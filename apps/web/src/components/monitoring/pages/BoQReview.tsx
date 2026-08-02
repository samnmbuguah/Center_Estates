import { useEffect, useState } from "react";
import { useParams, Link } from "@/components/monitoring/react-router-shim";
import { Check, DownloadCloud, FileText, X } from "lucide-react";
import { boqTemplateUrl } from "../api";
import { useAuth } from "../auth";
import { ErrorBanner } from "../components";

export function BoQReview() {
  const { id = "" } = useParams();
  const { can } = useAuth();
  const [draft, setDraft] = useState<any[]>([]);
  const [approvedCount, setApprovedCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { get } = await import("../api");
      const data = await get<any>(`/projects/${id}/boq-review`);
      setDraft(data.draft ?? []);
      setApprovedCount(data.approved_count ?? 0);
      setTotal(data.total ?? 0);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleAction = async (itemId: number, action: "approve" | "reject") => {
    try {
      const { post } = await import("../api");
      await post(`/boq-items/${itemId}/approve`, { action });
      setActionMsg(`Item ${action === "approve" ? "approved" : "rejected"}`);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleBulkApprove = async () => {
    try {
      const { post } = await import("../api");
      await post(`/projects/${id}/ingest/approve`, { action: "approve" });
      setActionMsg("All draft items approved");
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h2>BoQ Review & Approval</h2>
        <a href={boqTemplateUrl} className="btn ghost sm" download style={{ textDecoration: "none" }}>
          <DownloadCloud size={14} style={{ marginRight: 4 }} /> Download Template
        </a>
      </div>
      <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
        {approvedCount} of {total} items approved &middot; {draft.length} items pending review
      </p>
      <ErrorBanner message={error} />
      {actionMsg && <div style={{ padding: "8px 12px", background: "rgba(34,197,94,0.1)", color: "var(--green)", borderRadius: 6, marginBottom: 12, fontSize: 13 }}>{actionMsg}</div>}

      {loading ? <p className="muted">Loading...</p> : (draft.length === 0 && total === 0 ? <p className="muted">No items pending review.</p> : (
      <>
      {draft.length > 0 && (
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Draft Items ({draft.length})</h3>
            {can("projects.edit") && (
              <button className="btn sm" onClick={handleBulkApprove}>
                <Check size={14} style={{ marginRight: 4 }} /> Approve All
              </button>
            )}
          </div>
          <table style={{ fontSize: 13 }}>
            <thead><tr><th>Section</th><th>Item</th><th>Description</th><th>Unit</th><th>Qty</th><th>Rate</th><th>Amount</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {draft.map((item: any) => (
                <tr key={item.id}>
                  <td>{item.section}</td>
                  <td className="mono">{item.item_number}</td>
                  <td>{item.description}</td>
                  <td>{item.unit}</td>
                  <td className="num">{item.quantity}</td>
                  <td className="num">{Number(item.rate).toLocaleString()}</td>
                  <td className="num">{Number(item.amount).toLocaleString()}</td>
                  <td><span className="badge" style={{ background: "var(--warning)" }}>Draft</span></td>
                  <td>
                    {can("projects.edit") && (
                      <div className="row" style={{ gap: 4 }}>
                        <button className="btn sm" style={{ fontSize: 11 }} onClick={() => handleAction(item.id, "approve")}>
                          <Check size={12} /> Approve
                        </button>
                        <button className="btn ghost sm" style={{ fontSize: 11 }} onClick={() => handleAction(item.id, "reject")}>
                          <X size={12} /> Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {draft.length === 0 && total > 0 && (
        <div className="card" style={{ textAlign: "center", padding: 32 }}>
          <FileText size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
          <p>All {total} BoQ items have been reviewed and approved.</p>
          <Link to={`/app/projects/${id}/cost-dashboard`} className="btn">View Cost Dashboard</Link>
        </div>
      )}

      {total === 0 && (
        <div className="card" style={{ textAlign: "center", padding: 32 }}>
          <p className="muted">No BoQ items yet. Upload a BoQ Excel file first.</p>
          <Link to={`/app/projects/${id}/ingestion`} className="btn">Upload BoQ</Link>
        </div>
      )}
      </>
      ))}
    </div>
  );
}
