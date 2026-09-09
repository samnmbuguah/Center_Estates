"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { apiErrorMessage, apiFetch } from "@/lib/api";
import { Chip, CircularProgress } from "@mui/material";
import { Building2, CalendarDays, CreditCard, Gauge, TrendingUp, Users, Wallet } from "lucide-react";

type Row = Record<string, string | number | boolean | null>;
type Portal = {
  agent: Row;
  kpis: { openLeads: number; pipelineDeals: number; siteVisits: number; earnedCommission: number; paidCommission: number; pendingCommission: number };
  leads: Row[];
  pipeline: Row[];
  visits: Row[];
  commissions: Row[];
  availableUnits: Row[];
};

type Tab = "overview" | "leads" | "pipeline" | "visits" | "commissions" | "inventory";
const labels: Record<Tab, string> = {
  overview: "My Dashboard",
  leads: "My Leads",
  pipeline: "My Deals",
  visits: "Site Visits",
  commissions: "Commissions",
  inventory: "Available Units",
};
const tabIcons: Record<Tab, React.ReactNode> = {
  overview: <Gauge size={17} />,
  leads: <Users size={17} />,
  pipeline: <TrendingUp size={17} />,
  visits: <CalendarDays size={17} />,
  commissions: <Wallet size={17} />,
  inventory: <Building2 size={17} />,
};
const cash = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 });
const friendlyDate = (value: unknown) => {
  if (!value) return "—";
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" });
};

export default function AgentPortalPage() {
  const { session } = useAuth();
  const organizationId = session?.activeOrganizationId ?? null;
  const [data, setData] = useState<Portal | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/sales/agent-portal/", {}, organizationId);
      if (!res.ok) {
        setError(res.status === 403 ? "This account is not linked to a sales agent profile." : await apiErrorMessage(res, "Your agent account could not be loaded."));
        setLoading(false);
        return;
      }
      setData((await res.json()) as Portal);
    } catch {
      setError("Unable to load your sales agent dashboard. Please retry.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => { const t = setTimeout(() => void load(), 0); return () => clearTimeout(t); }, [load]);

  if (loading) return (
    <div className="page-wrap"><div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center", padding: 60 }}><CircularProgress size={32} /><strong>Preparing your agent workspace…</strong></div></div>
  );
  if (!data) return <div className="page-wrap"><div className="form-error">{error}</div></div>;

  const k = data.kpis ?? { openLeads: 0, pipelineDeals: 0, siteVisits: 0, earnedCommission: 0, paidCommission: 0, pendingCommission: 0 };

  return (
    <div className="page-wrap tenant-portal-page">
      <div className="tenant-mobile-header">
        <div className="tenant-mobile-brand">
          <span className="tenant-portal-badge">Agent</span>
          <span className="tenant-mobile-unit">{String(data.agent?.name ?? "")}</span>
        </div>
      </div>
      <div className="tenant-portal-layout">
        <aside className="tenant-portal-sidebar">
          <div className="tenant-sidebar-profile">
            <div className="tenant-avatar-circle">{String(data.agent?.name ?? "?").slice(0, 2).toUpperCase()}</div>
            <div className="tenant-sidebar-user-meta">
              <strong className="tenant-sidebar-name">{String(data.agent?.name ?? "")}</strong>
              <span className="tenant-sidebar-code">{String(data.agent?.username ?? "")}</span>
            </div>
          </div>
          <nav className="tenant-sidebar-nav">
            {(Object.keys(labels) as Tab[]).map((item) => (
              <button key={item} type="button" className={`tenant-sidebar-nav-item ${tab === item ? "active" : ""}`} onClick={() => setTab(item)}>
                <span className="tenant-nav-icon">{tabIcons[item]}</span>
                <span className="tenant-nav-label">{labels[item]}</span>
              </button>
            ))}
          </nav>
          <div className="tenant-sidebar-footer">
            <div className="tenant-support-card">
              <strong>Sales Accounting</strong>
              <p>Commission approvals and payouts are handled by the finance team.</p>
            </div>
          </div>
        </aside>
        <main className="tenant-portal-main">
          <section className="tenant-portal-hero">
            <div>
              <p className="eyebrow">Sales agent self-service</p>
              <h1>Good day, {String(data.agent?.name ?? "").split(" ")[0]}.</h1>
              <p>Your leads, deals, site visits and commission pipeline at a glance.</p>
            </div>
          </section>
          {error && <div className="form-error">{error}</div>}
          <nav className="portal-tabbar" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
            {(Object.keys(labels) as Tab[]).map((item) => (
              <button key={item} type="button" onClick={() => setTab(item)} className={`btn sm ${tab === item ? "primary" : "ghost"}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: tab === item ? 800 : 500 }}>
                {tabIcons[item]} {labels[item]}
              </button>
            ))}
          </nav>

          {tab === "overview" && (
            <>
              <section className="kpi-grid">
                <KpiCard label="Open leads" value={String(Number(k.openLeads))} />
                <KpiCard label="Active deals" value={String(Number(k.pipelineDeals))} />
                <KpiCard label="Site visits" value={String(Number(k.siteVisits))} />
              </section>
              <section className="kpi-grid" style={{ marginTop: 10 }}>
                <KpiCard label="Commission earned" value={cash.format(Number(k.earnedCommission))} />
                <KpiCard label="Commission paid" value={cash.format(Number(k.paidCommission))} />
                <KpiCard label="Pending" value={cash.format(Number(k.pendingCommission))} />
              </section>
              <section className="data-panel" style={{ marginTop: 18 }}>
                <h3 style={{ marginTop: 0 }}>Recent deals</h3>
                {data.pipeline.length ? (
                  <Table headers={["Sale", "Buyer", "Project", "Unit", "Price", "Status"]} rows={data.pipeline.map((r) => [String(r.reference ?? ""), String(r.buyer_name ?? ""), String(r.project_name ?? ""), String(r.unit_code ?? ""), cash.format(Number(r.agreed_price ?? 0)), <Chip key="s" size="small" label={String(r.status ?? "")} color="default" />])} />
                ) : <p style={{ margin: 0 }}>No deals in your pipeline yet.</p>}
              </section>
            </>
          )}

          {tab === "leads" && (
            <section className="data-panel">
              <h3 style={{ marginTop: 0 }}>Your leads</h3>
              {data.leads.length ? (
                <Table headers={["Ref", "Name", "Phone", "Financing", "Stage"]} rows={data.leads.map((r) => [String(r.reference ?? ""), String(r.full_name ?? ""), String(r.phone ?? ""), String(r.financing_type ?? ""), <Chip key="s" size="small" label={String(r.status ?? "")} color="default" />])} />
              ) : <p style={{ margin: 0 }}>No open leads assigned to you.</p>}
            </section>
          )}

          {tab === "pipeline" && (
            <section className="data-panel">
              <h3 style={{ marginTop: 0 }}>Your deals</h3>
              {data.pipeline.length ? (
                <Table headers={["Sale", "Buyer", "Project", "Unit", "Agreed", "Verified", "Balance", "Status"]} rows={data.pipeline.map((r) => [String(r.reference ?? ""), String(r.buyer_name ?? ""), String(r.project_name ?? ""), String(r.unit_code ?? ""), cash.format(Number(r.agreed_price ?? 0)), cash.format(Number(r.paid_amount ?? 0)), cash.format(Number(r.agreed_price ?? 0) - Number(r.paid_amount ?? 0)), <Chip key="s" size="small" label={String(r.status ?? "")} color="default" />])} />
              ) : <p style={{ margin: 0 }}>No active deals in your pipeline.</p>}
            </section>
          )}

          {tab === "visits" && (
            <section className="data-panel">
              <h3 style={{ marginTop: 0 }}>Site visits you introduced</h3>
              {data.visits.length ? (
                <Table headers={["Ref", "Visitor", "Project", "Interest", "Visited", "Follow up"]} rows={data.visits.map((r) => [String(r.reference ?? ""), String(r.visitor_name ?? ""), String(r.project_name ?? ""), String(r.interested_unit_type ?? ""), friendlyDate(r.visited_at), friendlyDate(r.follow_up_on)])} />
              ) : <p style={{ margin: 0 }}>No site visits recorded for you.</p>}
            </section>
          )}

          {tab === "commissions" && (
            <section className="data-panel">
              <h3 style={{ marginTop: 0 }}>Your commissions</h3>
              {data.commissions.length ? (
                <Table headers={["Ref", "Sale", "Buyer", "Rate", "Amount", "Status"]} rows={data.commissions.map((r) => [String(r.reference ?? ""), String(r.sale_reference ?? ""), String(r.buyer_name ?? ""), `${String(r.rate_percent ?? "")}%`, cash.format(Number(r.amount ?? 0)), <Chip key="s" size="small" label={String(r.status ?? "")} color={String(r.status) === "paid" ? "success" : "default"} />])} />
              ) : <p style={{ margin: 0 }}>No commissions recorded for you.</p>}
            </section>
          )}

          {tab === "inventory" && (
            <section className="data-panel">
              <h3 style={{ marginTop: 0 }}>Available units to sell</h3>
              {data.availableUnits.length ? (
                <Table headers={["Project", "Unit", "Type", "Floor", "Price", "Progress"]} rows={data.availableUnits.map((r) => [String(r.project_name ?? ""), String(r.unit_code ?? ""), String(r.unit_type ?? ""), String(r.floor ?? ""), cash.format(Number(r.list_price ?? 0)), `${String(r.construction_progress ?? "0")}%`])} />
              ) : <p style={{ margin: 0 }}>No units currently available for sale.</p>}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="tenant-kpi-card" style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 16, background: "var(--surface)" }}>
      <span className="tenant-kpi-label">{label}</span>
      <strong className="tenant-kpi-value">{value}</strong>
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div className="table-scroll">
      <table className="fc-data-table">
        <thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>{row.map((cell, j) => <td key={j} style={{ fontSize: 12 }}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}