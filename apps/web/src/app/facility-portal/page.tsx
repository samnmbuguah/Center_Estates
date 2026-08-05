"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { apiFetch, csrfFromCookie } from "@/lib/api";

type RequestRow = {
  id: string; reference: string; subject: string; category: string;
  priority: string; status: string; submitted_at: string; resolved_at: string | null;
};
type Portal = {
  tenant: { id: string; name: string; code: string };
  property: null | { id: string; name: string; unit: string };
  serviceRequests: RequestRow[];
};
type Tab = "overview" | "requests";
const labels: Record<Tab, string> = { overview: "Overview", requests: "My requests" };

export default function FacilityPortalPage() {
  const { session } = useAuth();
  const organizationId = session?.activeOrganizationId ?? null;
  const [data, setData] = useState<Portal | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true); setError("");
    const response = await apiFetch("/facility/portal/", {}, organizationId);
    if (!response.ok) {
      setError(
        response.status === 403
          ? "This account is not linked to an occupant profile."
          : "Your occupant account could not be loaded.",
      );
      setLoading(false);
      return;
    }
    setData(await response.json());
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true); setError("");
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    await apiFetch("/auth/csrf/");
    const response = await apiFetch(
      "/facility/portal/service-requests/",
      {
        method: "POST",
        headers: { "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify(payload),
      },
      organizationId,
    );
    setSubmitting(false);
    if (!response.ok) {
      setError("The maintenance request could not be submitted. Please try again.");
      return;
    }
    setModal(false);
    setTab("requests");
    await load();
  }

  if (loading) return <div className="page-wrap"><div className="data-loading">Loading your occupant account…</div></div>;
  if (!data) return <div className="page-wrap"><div className="form-error">{error}</div></div>;

  const openRequests = data.serviceRequests.filter((row) => !["resolved", "closed"].includes(row.status));
  const resolvedRequests = data.serviceRequests.length - openRequests.length;

  return <div className="page-wrap property-app">
    <section className="property-heading">
      <div>
        <p className="eyebrow">Occupant self-service</p>
        <h1>Good morning, {data.tenant.name}.</h1>
        <p>Follow your maintenance requests and report new issues from your unit.</p>
      </div>
      <button className="primary-action" onClick={() => setModal(true)}>Report an issue</button>
    </section>
    <nav className="module-tabs" aria-label="Occupant portal sections">
      {(Object.keys(labels) as Tab[]).map((item) => (
        <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{labels[item]}</button>
      ))}
    </nav>
    {error && <div className="form-error">{error}</div>}
    {tab === "overview" && (
      <>
        <section className="kpi-grid">
          <button className="kpi-card" onClick={() => setTab("requests")}><span>Open requests</span><strong>{String(openRequests.length)}</strong><small>Awaiting action</small><i>View requests →</i></button>
          <button className="kpi-card" onClick={() => setTab("requests")}><span>Resolved</span><strong>{String(resolvedRequests)}</strong><small>Completed for your unit</small><i>View history →</i></button>
          <button className="kpi-card" onClick={() => setModal(true)}><span>Report an issue</span><strong>+</strong><small>Maintenance, plumbing, safety</small><i>Start request →</i></button>
        </section>
        <section className="dashboard-columns">
          <article className="data-panel">
            <header className="panel-title"><h2>Your location</h2></header>
            {data.property ? (
              <div className="portal-lease">
                <strong>{data.property.name} · Unit {data.property.unit}</strong>
                <span>Tenant account {data.tenant.code}</span>
                <span>Requests are tracked against your active lease.</span>
              </div>
            ) : <div className="empty-state">No active lease property is linked to this account.</div>}
          </article>
          <article className="data-panel">
            <header className="panel-title"><h2>Recent requests</h2><button onClick={() => setTab("requests")}>View all →</button></header>
            {data.serviceRequests.length ? (
              <div className="table-scroll"><table className="data-table">
                <thead><tr><th>Reference</th><th>Issue</th><th>Status</th></tr></thead>
                <tbody>{data.serviceRequests.slice(0, 4).map((row) => (
                  <tr key={row.id}>
                    <td>{row.reference}</td>
                    <td>{row.subject}</td>
                    <td><Status value={row.status} /></td>
                  </tr>
                ))}</tbody>
              </table></div>
            ) : <div className="empty-state">No maintenance requests yet. Report an issue to get started.</div>}
          </article>
        </section>
      </>
    )}
    {tab === "requests" && (
      <article className="data-panel collection-panel">
        <header className="collection-title">
          <div><p className="eyebrow">My account</p><h2>Maintenance requests</h2></div>
          <button className="primary-action" onClick={() => setModal(true)}>New request</button>
        </header>
        {data.serviceRequests.length ? (
          <div className="table-scroll"><table className="data-table">
            <thead><tr><th>Reference</th><th>Issue</th><th>Category</th><th>Priority</th><th>Submitted</th><th>Status</th></tr></thead>
            <tbody>{data.serviceRequests.map((row) => (
              <tr key={row.id}>
                <td>{row.reference}</td>
                <td>{row.subject}</td>
                <td>{row.category}</td>
                <td><Status value={row.priority} /></td>
                <td>{String(row.submitted_at).slice(0, 10)}</td>
                <td><Status value={row.status} /></td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <div className="empty-state">No maintenance requests yet. Report an issue to get started.</div>}
      </article>
    )}
    {modal && (
      <div className="modal-backdrop" onMouseDown={() => setModal(false)}>
        <div className="form-modal" role="dialog" aria-modal="true" aria-labelledby="occupant-request-title" onMouseDown={(event) => event.stopPropagation()}>
          <div className="modal-title">
            <div><p className="eyebrow">Occupant maintenance</p><h2 id="occupant-request-title">Report an issue</h2></div>
            <button aria-label="Close" onClick={() => setModal(false)}>×</button>
          </div>
          <form onSubmit={submitRequest}>
            <label>Subject<input name="subject" required placeholder="Leaking kitchen tap" /></label>
            <div className="form-row">
              <label>Category<input name="category" required placeholder="Plumbing" /></label>
              <label>Priority<select name="priority" defaultValue="medium"><option>low</option><option>medium</option><option>high</option><option>critical</option></select></label>
            </div>
            <label>Description<textarea name="description" required rows={4} placeholder="Describe the issue and how it affects you…" /></label>
            <div className="form-actions">
              <button type="button" onClick={() => setModal(false)}>Cancel</button>
              <button className="primary-action" disabled={submitting}>{submitting ? "Submitting…" : "Submit request"}</button>
            </div>
          </form>
        </div>
      </div>
    )}
  </div>;
}

function Status({ value }: { value: string }) {
  return <span className={`data-status status-${value}`}>{value.replaceAll("_", " ")}</span>;
}
