import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Check, Eye, X } from "lucide-react";
import { API_BASE, authHeaders, get } from "../api";

interface PendingItem {
  model: string;
  id: string;
  label: string;
  project_id: string | null;
  created_at: number;
}

const MODEL_COLORS: Record<string, string> = {
  "daily-log": "var(--steel, #38bdf8)",
  "material-delivery": "var(--warning)",
  "safety-incident": "var(--danger)",
  "ticket": "var(--primary)",
  "observation": "var(--warning)",
  "ticket-comment": "var(--muted)",
  "quality-test": "var(--success)",
};
const MODEL_ICONS: Record<string, string> = {
  "daily-log": "📋",
  "material-delivery": "📦",
  "safety-incident": "⚠️",
  "ticket": "🎫",
  "observation": "👁️",
  "ticket-comment": "💬",
  "quality-test": "🧪",
};

/** Fetch full details of a pending record for review before verifying. */
async function fetchDetail(model: string, id: string): Promise<Record<string, unknown>> {
  try {
    switch (model) {
      case "daily-log": {
        const data = await get<any>("/daily-logs?limit=100");
        const items = Array.isArray(data) ? data : (data.results ?? []);
        return items.find((i: any) => String(i.id) === id) || {};
      }
      case "material-delivery": {
        const data = await get<any>("/materials?limit=100");
        const items = Array.isArray(data) ? data : (data.results ?? []);
        return items.find((i: any) => String(i.id) === id) || {};
      }
      case "safety-incident": {
        const data = await get<any>("/hs-incidents?limit=100");
        const items = Array.isArray(data) ? data : (data.results ?? []);
        return items.find((i: any) => String(i.id) === id) || {};
      }
      case "ticket": {
        return await get<any>(`/tickets/${id}`);
      }
      default: {
        // For observations, quality-tests, etc., return the label as detail
        return { id, body: id };
      }
    }
  } catch {
    return {};
  }
}

export default function PendingVerification() {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<{ model: string; id: string; data: Record<string, unknown> } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const fetchPending = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/pending-record-verifications`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to fetch");
      setItems(await res.json());
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  const verify = async (model: string, id: string) => {
    setVerifyingId(id);
    try {
      const res = await fetch(`${API_BASE}/verify/${model}/${id}`, {
        method: "POST", headers: { ...authHeaders(), "Content-Type": "application/json" },
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || err.error || "Verification failed"); }
      setItems((prev) => prev.filter((i) => !(i.model === model && i.id === id)));
      setDetail(null);
    } catch (e: any) { setError(e.message); }
    finally { setVerifyingId(null); }
  };

  const reject = async (model: string, id: string) => {
    setVerifyingId(id);
    try {
      const res = await fetch(`${API_BASE}/verify/${model}/${id}`, {
        method: "POST", headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "rejected", note: "Rejected after review" }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || err.error || "Rejection failed"); }
      setItems((prev) => prev.filter((i) => !(i.model === model && i.id === id)));
      setDetail(null);
    } catch (e: any) { setError(e.message); }
    finally { setVerifyingId(null); }
  };

  const showDetail = async (item: PendingItem) => {
    setDetailLoading(true);
    const data = await fetchDetail(item.model, item.id);
    setDetail({ model: item.model, id: item.id, data });
    setDetailLoading(false);
  };

  const renderDetail = () => {
    if (!detail) return null;
    const d = detail.data;
    const isEmpty = Object.keys(d).length === 0;

    return (
      <div className="card mt-md" style={{ borderLeft: `4px solid ${MODEL_COLORS[detail.model] || "var(--muted)"}` }}>
        <div className="row flex-between mb-sm">
          <h3 className="flex-center" style={{ margin: 0 }}>
            <span style={{ fontSize: 18 }}>{MODEL_ICONS[detail.model] || "📄"}</span>
            {detail.model.replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase())} Details
          </h3>
          <button className="btn ghost sm" onClick={() => setDetail(null)}><X size={14} /></button>
        </div>

        {isEmpty ? (
          <div className="text-center p-md">
            <p className="muted">Could not load details for this record.</p>
            <p className="muted fs-sm">Record ID: {detail.id}</p>
          </div>
        ) : (
          <>
            {detail.model === "daily-log" && (
              <div className="grid-2 gap-md fs-md">
                <div><strong>Date:</strong> {String(d.log_date ?? "—")}</div>
                <div><strong>Weather:</strong> {String(d.weather ?? "—")}</div>
                <div><strong>Labour Count:</strong> {String(d.labour_count ?? "—")}</div>
                <div><strong>Author:</strong> {String(d.author ?? "—")}</div>
                <div style={{ gridColumn: "1 / -1" }}><strong>Notes:</strong> {String(d.notes ?? "—")}</div>
              </div>
            )}

            {detail.model === "material-delivery" && (
              <div className="grid-2 gap-md fs-md">
                <div><strong>Delivery Date:</strong> {String(d.delivery_date ?? "—")}</div>
                <div><strong>Material:</strong> {String(d.material ?? "—")}</div>
                <div><strong>Quantity:</strong> {String(d.quantity ?? "—")}</div>
                <div><strong>Unit:</strong> {String(d.unit ?? "—")}</div>
                <div><strong>Supplier:</strong> {String(d.supplier ?? "—")}</div>
              </div>
            )}

            {detail.model === "safety-incident" && (
              <div className="grid-2 gap-md fs-md">
                <div><strong>Incident Date:</strong> {String(d.incident_date ?? "—")}</div>
                <div><strong>Severity:</strong> {String(d.severity ?? "—")}</div>
                <div style={{ gridColumn: "1 / -1" }}><strong>Description:</strong> {String(d.description ?? "—")}</div>
                <div style={{ gridColumn: "1 / -1" }}><strong>Action Taken:</strong> {String(d.action_taken ?? "—")}</div>
              </div>
            )}

            {detail.model === "ticket" && (
              <div className="grid-2 gap-md fs-md">
                <div><strong>Title:</strong> {String(d.title ?? d.body ?? "—")}</div>
                <div><strong>Priority:</strong> {String(d.priority ?? "—")}</div>
                <div><strong>Risk Level:</strong> {String(d.risk_level ?? "—")}</div>
                <div><strong>Status:</strong> {String(d.status ?? "—")}</div>
                <div style={{ gridColumn: "1 / -1" }}><strong>Body:</strong> {String(d.body ?? "—")}</div>
              </div>
            )}

            {!["daily-log","material-delivery","safety-incident","ticket"].includes(detail.model) && (
              <div className="fs-md p-sm" style={{ background: "var(--surface)", borderRadius: 6 }}>
                <div><strong>Record ID:</strong> {detail.id}</div>
                <div className="mt-xs"><strong>Content:</strong> {String(d.body ?? d.label ?? d.id ?? "—")}</div>
              </div>
            )}
          </>
        )}

        <div className="row gap-md mt-md" style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
          <button className="btn sm" onClick={() => verify(detail.model, detail.id)} disabled={verifyingId === detail.id}>
            {verifyingId === detail.id ? "Verifying…" : <><Check size={14} className="mr-xs" /> Verify</>}
          </button>
          <button className="btn ghost sm" style={{ color: "var(--danger)" }} onClick={() => reject(detail.model, detail.id)} disabled={verifyingId === detail.id}>
            <X size={14} className="mr-xs" /> Reject
          </button>
        </div>
      </div>
    );
  };

  if (loading) return (
    <div>
      <h2>Pending Verifications</h2>
      <div className="card text-center p-md">
        <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
        <p className="muted">Loading pending verifications…</p>
      </div>
    </div>
  );

  return (
    <div>
      <h2>Pending Verifications</h2>
      {error && (
        <div className="error-banner" style={{ marginBottom: 12, padding: 8, borderRadius: 6 }}>
          <span style={{ color: "var(--danger)" }}>✕</span> {error}
          <button className="btn ghost sm" onClick={() => setError("")} style={{ marginLeft: 8, fontSize: 11 }}>Dismiss</button>
        </div>
      )}
      {items.length === 0 ? (
        <div className="card empty-state">
          <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
          <h3 style={{ marginBottom: 4 }}>All clear!</h3>
          <p className="muted">No records pending verification.</p>
        </div>
      ) : (
        <>
          <p className="muted fs-base mb-sm">
            {items.length} item{items.length !== 1 ? "s" : ""} pending review. Click Review to see details before deciding.
          </p>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ padding: "10px 16px", textAlign: "left", borderBottom: "1px solid var(--border)" }}>Type</th>
                  <th style={{ padding: "10px 16px", textAlign: "left", borderBottom: "1px solid var(--border)" }}>Content</th>
                  <th style={{ padding: "10px 16px", textAlign: "left", borderBottom: "1px solid var(--border)" }}>Project</th>
                  <th style={{ padding: "10px 16px", textAlign: "left", borderBottom: "1px solid var(--border)" }}>Submitted</th>
                  <th style={{ padding: "10px 16px", textAlign: "left", borderBottom: "1px solid var(--border)" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={`${item.model}-${item.id}`}
                    style={{ borderBottom: "1px solid var(--border)", background: detail?.model === item.model && detail?.id === item.id ? "var(--surface)" : "transparent" }}
                    onClick={() => showDetail(item)}
                  >
                    <td style={{ padding: "10px 16px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span>{MODEL_ICONS[item.model] || "📄"}</span>
                        <span style={{ color: MODEL_COLORS[item.model] || "var(--muted)", fontSize: 13, textTransform: "capitalize" }}>
                          {item.model.replace("-", " ")}
                        </span>
                      </span>
                    </td>
                    <td style={{ padding: "10px 16px", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.label.slice(0, 60)}
                    </td>
                    <td style={{ padding: "10px 16px", fontFamily: "monospace", fontSize: 13, color: "var(--muted)" }}>
                      {item.project_id?.slice(0, 8) ?? "—"}
                    </td>
                    <td style={{ padding: "10px 16px", fontSize: 13 }}>
                      {item.created_at ? new Date(item.created_at).toLocaleDateString() : "—"}
                    </td>
                    <td style={{ padding: "10px 16px" }}>
                      <div className="row gap-xs">
                        <button className="btn sm" onClick={(e) => { e.stopPropagation(); showDetail(item); }}>
                          <Eye size={12} style={{ marginRight: 4 }} /> Review
                        </button>
                        <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); verify(item.model, item.id); }} disabled={verifyingId === item.id}>
                          <Check size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {detailLoading && (
        <div className="card mt-md text-center p-md">
          <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
          <p className="muted">Loading record details…</p>
        </div>
      )}
      {renderDetail()}
    </div>
  );
}
