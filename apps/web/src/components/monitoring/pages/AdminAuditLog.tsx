import { useEffect, useState } from "react";

import { fetchAuditLogs } from "../api";
import { ErrorBanner } from "../components/ErrorBanner";


const CATEGORIES = ["system", "users", "tenants", "permissions", "data", "financial", "certificates", "exports"];

export function AdminAuditLog() {
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState("");
  const [outcome, setOutcome] = useState("");
  const [search, setSearch] = useState("");

  const load = async (off: number) => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetchAuditLogs({ category, outcome, search, limit: 50, offset: off });
      setRows(res.results);
      setTotal(res.total);
      setOffset(res.offset);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(0); }, [category, outcome, search]);

  return (
    <div>
      <div className="page-head"><div className="eyebrow">Admin</div><h2>Audit Trail</h2></div>
      <ErrorBanner message={error} />

      <div className="card">
        <div style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
          <div className="field" style={{ minWidth: 160 }}>
            <label>Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)}>
              <option value="">All</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field" style={{ minWidth: 120 }}>
            <label>Outcome</label>
            <select value={outcome} onChange={e => setOutcome(e.target.value)}>
              <option value="">All</option>
              <option value="success">Success</option>
              <option value="error">Error</option>
              <option value="blocked">Blocked</option>
              <option value="partial">Partial</option>
            </select>
          </div>
          <div className="field" style={{ minWidth: 200 }}>
            <label>Search</label>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search actions, details…" />
          </div>
        </div>
      </div>

      {loading ? <p className="muted">Loading...</p> : (
      <div className="card">
        <div style={{ opacity: 0.6, marginBottom: 8 }}>{total} entries</div>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Category</th>
                <th>Action</th>
                <th>Resource</th>
                <th>Outcome</th>
                <th>Details</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{new Date(r.timestamp).toLocaleString()}</td>
                  <td>{r.user}</td>
                  <td><span className="badge">{r.category}</span></td>
                  <td style={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis" }}>{r.action}</td>
                  <td>{r.resource}</td>
                  <td>
                    <span className={`badge ${r.outcome === "success" ? "badge-green" : r.outcome === "error" ? "badge-red" : "badge-yellow"}`}>
                      {r.outcome}
                    </span>
                  </td>
                  <td style={{ maxWidth: 360 }}>
                    <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={typeof r.details === "string" ? r.details : JSON.stringify(r.details ?? {})}>
                      {r.error_message || (r.details?.message ?? (r.details ? JSON.stringify(r.details) : "—"))}
                    </div>
                    {r.details?.url && <div className="muted" style={{ fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.details.url}</div>}
                  </td>
                  <td className="mono">{r.ip_address}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={8} className="empty">No audit log entries.</td></tr>}
            </tbody>
          </table>
        </div>

        {total > 50 && (
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12 }}>
            <button className="btn ghost sm" disabled={offset === 0} onClick={() => load(Math.max(0, offset - 50))}>{'<'} Previous</button>
            <span style={{ opacity: 0.6 }}>{offset + 1}–{Math.min(offset + 50, total)} of {total}</span>
            <button className="btn ghost sm" disabled={offset + 50 >= total} onClick={() => load(offset + 50)}>Next {'>'}</button>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
