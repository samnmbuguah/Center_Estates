"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth-provider";
import { ModuleShell } from "@/components/module-shell";
import { apiFetch, csrfFromCookie } from "@/lib/api";
import { salesNav } from "@/lib/module-nav";
import { usePropertyContext } from "@/lib/property-context";
import {
  Badge,
  DetailDrawer,
  EmptyState,
  ErrorBanner,
  Field,
  KpiCard,
  KpiStrip,
  LoadingState,
  Modal,
  money,
  number,
  Panel,
  SearchInput,
  StatusPill,
} from "@/components/module-ui";

export type SalesTab =
  | "overview"
  | "inventory"
  | "buyers"
  | "leads"
  | "sales"
  | "installments"
  | "payments"
  | "site-visits"
  | "commissions"
  | "handover"
  | "performance"
  | "reports"
  | "documents"
  | "audit-events"
  | "bank-reconciliation";

const labels: Record<SalesTab, string> = {
  overview: "Dashboard",
  inventory: "Projects & Units",
  buyers: "Buyers Registry",
  leads: "Leads & Prospects",
  sales: "Sales Pipeline",
  installments: "Installment Schedules",
  payments: "Payments & Verification",
  "site-visits": "Site Visits (Sales Clerk)",
  commissions: "Agent Commissions",
  handover: "Unit Handover",
  performance: "Agent Performance",
  reports: "Sales Reports",
  documents: "Legal Documents",
  "audit-events": "Audit Trail",
  "bank-reconciliation": "Bank Reconciliation",
};

type Row = Record<string, unknown>;
type Dashboard = {
  kpis?: Record<string, unknown>;
  recentSales?: Row[];
  pendingPayments?: Row[];
  inventoryByStatus?: Row[];
  salesByProject?: Row[];
  agentPerformance?: Row[];
  reports?: Row[];
  installmentExposure?: Record<string, unknown>;
};

type Tone = "green" | "red" | "yellow" | "blue" | "cyan" | "purple" | "gray";

/* -------------------------- helpers -------------------------- */

function fmtDate(v: unknown): string {
  if (!v) return "—";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function fmtDateTime(v: unknown): string {
  if (!v) return "—";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtMoney(v: unknown): string {
  return money.format(Number(v ?? 0));
}

const EMPTY_ROWS: Row[] = [];

function countBy(rows: Row[], statuses: string[]): number {
  return rows.filter((r) => statuses.includes(String(r.status ?? ""))).length;
}

function sumBy(rows: Row[], key: string, statuses?: string[]): number {
  return rows.reduce(
    (acc, r) => (statuses && !statuses.includes(String(r.status ?? "")) ? acc : acc + Number(r[key] ?? 0)),
    0,
  );
}

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as Record<string, unknown>;
    if (typeof body.detail === "string") return body.detail;
    for (const value of Object.values(body)) {
      if (typeof value === "string") return value;
      if (Array.isArray(value) && value.length > 0) return String(value[0]);
    }
    return `Request failed (${res.status}).`;
  } catch {
    return `Request failed (${res.status}).`;
  }
}

/* -------------------------- shared UI bits -------------------------- */

function DataTable({ headers, children }: { headers: ReactNode[]; children: ReactNode }) {
  return (
    <div className="table-scroll">
      <table className="fc-data-table">
        <thead>
          <tr>{headers.map((h, i) => <th key={i}>{h}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function TableChrome({
  search,
  setSearch,
  placeholder,
  chips,
  actions,
  children,
}: {
  search: string;
  setSearch: (v: string) => void;
  placeholder: string;
  chips?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <div className="fc-table-toolbar">
        <div className="fc-table-toolbar-left">
          <SearchInput value={search} onChange={setSearch} placeholder={placeholder} />
          {chips}
        </div>
        <div className="fc-table-toolbar-right">{actions}</div>
      </div>
      {children}
    </>
  );
}

function FilterChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T | "";
  onChange: (v: T | "") => void;
}) {
  return (
    <div className="row" style={{ gap: 6 }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`btn sm ${value === o.value ? "primary" : "ghost"}`}
          style={{ fontSize: 11, padding: "4px 10px" }}
          onClick={() => onChange(value === o.value ? "" : o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function DField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="fc-detail-field">
      <label>{label}</label>
      <span>{value}</span>
    </div>
  );
}

function ProgressBar({ pct, color = "#ea580c" }: { pct: number; color?: string }) {
  return (
    <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
      <div style={{ background: "#edf0f5", borderRadius: 99, flex: 1, height: 6, minWidth: 60, overflow: "hidden" }}>
        <i style={{ background: color, borderRadius: "inherit", display: "block", height: "100%", width: `${Math.max(0, Math.min(100, pct))}%` }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700 }}>{Math.round(pct)}%</span>
    </div>
  );
}

function RefText({ value }: { value: unknown }) {
  return <span className="mono" style={{ color: "var(--primary)", fontSize: 11, fontWeight: 700 }}>{String(value ?? "—")}</span>;
}

/* -------------------------- overview -------------------------- */

function OverviewView({
  dashboard,
  setTab,
  openRegisterBuyer,
  openNewSale,
  openRecordVisit,
}: {
  dashboard: Dashboard;
  setTab: (t: SalesTab) => void;
  openRegisterBuyer: () => void;
  openNewSale: () => void;
  openRecordVisit: () => void;
}) {
  const kpis = dashboard.kpis ?? {};
  const available = Number(kpis.availableUnits ?? 0);
  const reserved = Number(kpis.reservedUnits ?? 0);
  const sold = Number(kpis.soldUnits ?? 0);
  const recentSales = dashboard.recentSales ?? [];
  const pendingPayments = dashboard.pendingPayments ?? [];
  const stage = dashboard.inventoryByStatus ?? [];
  const stageTotal = stage.reduce((s, r) => s + Number(r.count ?? 0), 0) || Math.max(available + reserved + sold, 1);
  const salesValue = Number(kpis.salesValue ?? 0);
  const verifiedPayments = Number(kpis.verifiedPayments ?? 0);
  const outstanding = salesValue - verifiedPayments;
  const collectionRate = salesValue > 0 ? Math.round((verifiedPayments / salesValue) * 100) : 0;
  const salesByProject = dashboard.salesByProject ?? [];

  const stageColors: Record<string, string> = {
    available: "#16a34a",
    reserved: "#f59e0b",
    sold: "#0284c7",
    pending: "#7c3aed",
    blocked: "#64748b",
  };
  const stageLabels: Record<string, string> = {
    available: "Available",
    reserved: "Reserved",
    sold: "Sold",
    pending: "Pending",
    blocked: "Blocked",
  };

  type StageRow = Row & { pct: number; seg: string };
  const segs: StageRow[] = stage.map((s, i) => {
    const pct = (Number(s.count ?? 0) / stageTotal) * 100;
    const start = stage.slice(0, i).reduce((acc, x) => acc + (Number(x.count ?? 0) / stageTotal) * 100, 0);
    const seg = `${stageColors[String(s.status ?? "")] ?? "#94a3b8"} ${start.toFixed(2)}% ${(start + pct).toFixed(2)}%`;
    return { ...s, pct, seg } as StageRow;
  });
  const donutBg = segs.length
    ? `conic-gradient(${segs.map((s) => s.seg).join(", ")})`
    : "conic-gradient(#e5e7eb 0% 100%)";

  return (
    <>
      <KpiStrip cols={7}>
        <KpiCard icon="🏠" iconBg="#dcfce7" iconColor="#16a34a" label="Available Units" value={number.format(available)} sub={`${number.format(reserved)} reserved · ${number.format(sold)} sold`} link="View inventory" onClick={() => setTab("inventory")} />
        <KpiCard icon="💼" iconBg="#dbeafe" iconColor="#2563eb" label="Pipeline Value" value={fmtMoney(kpis.salesValue)} sub={`${number.format(Number(kpis.pipelineDeals ?? 0))} active deals`} link="View sales" onClick={() => setTab("sales")} />
        <KpiCard icon="🏗️" iconBg="#e0f2fe" iconColor="#0284c7" label="Units Sold" value={number.format(sold)} sub={`${number.format(reserved)} reserved in progress`} link="View inventory" onClick={() => setTab("inventory")} />
        <KpiCard icon="💸" iconBg="#ffedd5" iconColor="#ea580c" label="Commissions Payable" value={fmtMoney(kpis.pendingCommissions)} sub="Unsettled agent commissions" link="View commissions" onClick={() => setTab("commissions")} />
        <KpiCard icon="💳" iconBg="#f0fdf4" iconColor="#15803d" label="Total Revenue" value={fmtMoney(kpis.verifiedPayments)} sub={`${number.format(Number(kpis.pendingPayments ?? 0))} awaiting verification`} link="View payments" onClick={() => setTab("payments")} />
        <KpiCard icon="📉" iconBg="#fee2e2" iconColor="#b91c1c" label="Total Outstanding" value={fmtMoney(outstanding)} sub="Uncollected balance" onClick={() => setTab("payments")} />
        <KpiCard icon="📊" iconBg="#ede9fe" iconColor="#7c3aed" label="Collection Rate" value={`${collectionRate}%`} sub={`${fmtMoney(verifiedPayments)} of ${fmtMoney(salesValue)}`} onClick={() => setTab("payments")} />
      </KpiStrip>

      <div className="grid-2" style={{ gridTemplateColumns: "minmax(0, 1.9fr) minmax(0, 1fr)", gap: 18, alignItems: "start" }}>
        <Panel title="Recent Sales" badge={recentSales.length} action={<button className="btn ghost sm" onClick={() => setTab("sales")}>View all →</button>}>
          {recentSales.length === 0 ? (
            <EmptyState icon="🧾" title="No recent sales" description="Newly registered sales will appear here with their buyer, unit and payment status." />
          ) : (
            <DataTable headers={["Sale Ref", "Buyer", "Project / Unit", "Price", "Paid", "Status", "Date"]}>
              {recentSales.map((s, i) => (
                <tr key={String(s.id ?? i)} onClick={() => setTab("sales")}>
                  <td><RefText value={s.reference} /></td>
                  <td><strong style={{ fontSize: 12 }}>{String(s.buyer_name ?? "—")}</strong></td>
                  <td style={{ fontSize: 12, color: "#6b7890" }}>
                    {String(s.project_name ?? "—")}
                    {s.unit_code ? <div className="mono" style={{ fontSize: 10 }}>{String(s.unit_code)}</div> : null}
                  </td>
                  <td className="mono" style={{ fontSize: 12 }}>{fmtMoney(s.agreed_price)}</td>
                  <td className="mono" style={{ fontSize: 12, color: "#16a34a" }}>{fmtMoney(s.paid_amount)}</td>
                  <td><StatusPill value={String(s.status ?? "")} /></td>
                  <td style={{ fontSize: 11, color: "#6b7890" }}>{fmtDate(s.contracted_on ?? s.created_at)}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </Panel>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <Panel title="Sales Actions">
            <div className="fc-quick-actions">
              <button className="fc-quick-action" onClick={openRegisterBuyer}>
                <span style={{ alignItems: "center", display: "flex", gap: 10 }}><span className="fc-qa-icon" style={{ background: "#ffedd5", color: "#ea580c" }}>👥</span>Register Buyer</span>
                <span className="fc-qa-chevron">›</span>
              </button>
              <button className="fc-quick-action" onClick={openNewSale}>
                <span style={{ alignItems: "center", display: "flex", gap: 10 }}><span className="fc-qa-icon" style={{ background: "#dbeafe", color: "#2563eb" }}>📝</span>New Sale</span>
                <span className="fc-qa-chevron">›</span>
              </button>
              <button className="fc-quick-action" onClick={openRecordVisit}>
                <span style={{ alignItems: "center", display: "flex", gap: 10 }}><span className="fc-qa-icon" style={{ background: "#dcfce7", color: "#16a34a" }}>📍</span>Record Site Visit (Clerk)</span>
                <span className="fc-qa-chevron">›</span>
              </button>
              <button className="fc-quick-action" onClick={() => setTab("payments")}>
                <span style={{ alignItems: "center", display: "flex", gap: 10 }}><span className="fc-qa-icon" style={{ background: "#fef3c7", color: "#92400e" }}>💳</span>Verify Pending Payments</span>
                <span className="fc-qa-chevron">›</span>
              </button>
              <button className="fc-quick-action" onClick={() => setTab("reports")}>
                <span style={{ alignItems: "center", display: "flex", gap: 10 }}><span className="fc-qa-icon" style={{ background: "#ede9fe", color: "#6d28d9" }}>📊</span>Generate Report</span>
                <span className="fc-qa-chevron">›</span>
              </button>
              <button className="fc-quick-action" onClick={() => setTab("leads")}>
                <span style={{ alignItems: "center", display: "flex", gap: 10 }}><span className="fc-qa-icon" style={{ background: "#fef3c7", color: "#92400e" }}>🧲</span>Leads & Prospects</span>
                <span className="fc-qa-chevron">›</span>
              </button>
            </div>
          </Panel>

          <Panel title="Stage Breakdown">
            <div style={{ alignItems: "center", display: "flex", gap: 16, padding: "14px 18px" }}>
              <div className="donut" style={{ background: donutBg, flexShrink: 0, height: 92, width: 92 }}>
                <strong style={{ fontSize: 16 }}>{number.format(stageTotal)}</strong>
                <small>Units</small>
              </div>
              <div className="donut-legend" style={{ flex: 1 }}>
                {segs.length === 0 && <span style={{ color: "#8a96a7", fontSize: 12 }}>No inventory staged yet.</span>}
                {segs.map((s) => (
                  <span key={String(s.status)}>
                    <i style={{ background: stageColors[String(s.status ?? "")] ?? "#94a3b8" }} />
                    {stageLabels[String(s.status ?? "")] ?? String(s.status ?? "—")}
                    <b>{number.format(Number(s.count ?? 0))}</b>
                  </span>
                ))}
              </div>
            </div>
          </Panel>

          {pendingPayments.length > 0 && (
            <Panel title="Pending Verification" badge={pendingPayments.length} action={<button className="btn ghost sm" onClick={() => setTab("payments")}>Verify →</button>}>
              <div className="fc-alert-list">
                {pendingPayments.slice(0, 4).map((p, i) => (
                  <button key={String(p.id ?? i)} className="fc-alert-item" onClick={() => setTab("payments")}>
                    <span className="fc-alert-icon warning">⏳</span>
                    <div className="fc-alert-body">
                      <strong>{String(p.buyer_name ?? "—")}</strong>
                      <small className="mono">{String(p.reference ?? "—")}</small>
                      <em>{fmtMoney(p.amount)} · {String(p.method ?? "—")}</em>
                    </div>
                    <span className="fc-alert-chevron">›</span>
                  </button>
                ))}
              </div>
            </Panel>
          )}

          {salesByProject.length > 0 && (
            <Panel title="Sales by Project" badge={salesByProject.length}>
              <div style={{ padding: 14 }}>
                {salesByProject.map((r) => {
                  const name = String(r["listing__project__name"] ?? "Unknown");
                  const count = Number(r.count ?? 0);
                  const maxCount = Math.max(...salesByProject.map((x) => Number(x.count ?? 0)), 1);
                  const pct = (count / maxCount) * 100;
                  return (
                    <div key={name} style={{ marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
                        <span style={{ fontWeight: 600 }}>{name}</span>
                        <span className="mono" style={{ fontWeight: 700, color: "#ea580c" }}>{number.format(count)} sales</span>
                      </div>
                      <div style={{ background: "#edf0f5", borderRadius: 4, height: 18, overflow: "hidden" }}>
                        <div style={{ background: "linear-gradient(90deg, #ea580c, #f59e0b)", height: "100%", width: `${pct}%`, borderRadius: 4, transition: "width 0.3s ease", minWidth: count > 0 ? 4 : 0 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          )}
        </div>
      </div>

      <div className="summary-strip">
        <span><b>{number.format(available)}</b> Available units</span>
        <span><b>{number.format(reserved)}</b> Reserved units</span>
        <span><b>{number.format(sold)}</b> Sold units</span>
        <span><b>{number.format(Number(kpis.activeBuyers ?? 0))}</b> Active buyers</span>
        <span><b>{number.format(Number(kpis.siteVisits ?? 0))}</b> Site visits recorded</span>
      </div>
    </>
  );
}

/* -------------------------- inventory -------------------------- */

function InventoryView({
  rows,
  search,
  setSearch,
  status,
  setStatus,
  canSell,
  openNewListing,
}: {
  rows: Row[];
  search: string;
  setSearch: (v: string) => void;
  status: string;
  setStatus: (v: string) => void;
  canSell: boolean;
  openNewListing: () => void;
}) {
  const [selected, setSelected] = useState<Row | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const totalValue = sumBy(rows, "list_price");

  return (
    <>
      <KpiStrip cols={5}>
        <KpiCard icon="🏢" iconBg="#e0e7ff" iconColor="#4f46e5" label="Total Listings" value={number.format(rows.length)} sub="Across all projects" />
        <KpiCard icon="🏠" iconBg="#dcfce7" iconColor="#16a34a" label="Available" value={number.format(countBy(rows, ["available"]))} sub="Open for sale" onClick={() => setStatus(status === "available" ? "" : "available")} />
        <KpiCard icon="🔒" iconBg="#fef3c7" iconColor="#92400e" label="Reserved" value={number.format(countBy(rows, ["reserved"]))} sub="Held on reservations" onClick={() => setStatus(status === "reserved" ? "" : "reserved")} />
        <KpiCard icon="✅" iconBg="#e0f2fe" iconColor="#0284c7" label="Sold" value={number.format(countBy(rows, ["sold"]))} sub="Completed sales" onClick={() => setStatus(status === "sold" ? "" : "sold")} />
        <KpiCard icon="💰" iconBg="#fff7ed" iconColor="#ea580c" label="Portfolio Value" value={fmtMoney(totalValue)} sub="Sum of list prices" />
      </KpiStrip>

      <Panel title="Projects & Units" badge={rows.length}>
        {viewMode === "grid" ? (
          <div>
            <div className="fc-table-toolbar">
              <div style={{ flex: 1 }} />
              <div className="fc-table-toolbar-right">
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn sm primary" onClick={() => setViewMode("grid")}>Grid View</button>
                  <button className="btn sm ghost" onClick={() => setViewMode("list")}>List View</button>
                  {canSell ? <button className="btn primary sm" onClick={openNewListing}>+ New Listing</button> : null}
                </div>
              </div>
            </div>
            <UnitGridView rows={rows} onSelect={(r) => setSelected(r)} />
          </div>
        ) : (
          <TableChrome
            search={search}
            setSearch={setSearch}
            placeholder="Search unit code, type or project…"
            chips={<FilterChips options={[{ value: "available", label: "Available" }, { value: "reserved", label: "Reserved" }, { value: "sold", label: "Sold" }, { value: "blocked", label: "Blocked" }]} value={status as "available" | "reserved" | "sold" | "blocked" | ""} onChange={(v) => setStatus(v)} />}
            actions={
              <div className="row" style={{ gap: 8 }}>
                <button className="btn sm ghost" onClick={() => setViewMode("grid")}>Grid View</button>
                <button className="btn sm primary" onClick={() => setViewMode("list")}>List View</button>
                {canSell ? <button className="btn primary sm" onClick={openNewListing}>+ New Listing</button> : null}
              </div>
            }
          >
            {rows.length === 0 ? (
              <EmptyState icon="🏢" title="No listings found" description={search ? "No units match the current search or status filter." : "Create a new listing to start selling units."} action={canSell ? <button className="btn primary sm" onClick={openNewListing}>+ New Listing</button> : undefined} />
            ) : (
              <DataTable headers={["Unit Code", "Project", "Floor", "Unit Type", "Price", "Progress", "Status", "Sold to", "Actions"]}>
                {rows.map((r) => (
                  <tr key={String(r.id)} onClick={() => setSelected(r)}>
                    <td><RefText value={r.unit_code} /></td>
                    <td><strong style={{ fontSize: 12 }}>{String(r.project_name ?? "—")}</strong></td>
                    <td style={{ fontSize: 12 }}>{String(r.floor ?? "—")}</td>
                    <td style={{ fontSize: 12 }}>{String(r.unit_type ?? "—")}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{fmtMoney(r.list_price)}</td>
                    <td><ProgressBar pct={Number(r.construction_progress ?? 0)} /></td>
                    <td><StatusPill value={String(r.status ?? "")} tone={toneForInventory(String(r.status ?? ""))} /></td>
                    <td style={{ fontSize: 12, color: "#8a96a7" }}>—</td>
                    <td><button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); setSelected(r); }}>Details</button></td>
                  </tr>
                ))}
              </DataTable>
            )}
          </TableChrome>
        )}
      </Panel>

      {selected && (
        <DetailDrawer title={`Unit ${String(selected.unit_code ?? "—")}`} onClose={() => setSelected(null)} width={400}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span className="fc-detail-thumb-placeholder" style={{ height: 44, width: 44, fontSize: 20 }}>🏠</span>
            <div className="fc-detail-meta">
              <strong style={{ fontSize: 14 }}>{String(selected.project_name ?? "—")}</strong>
              <small className="mono">{String(selected.unit_code ?? "—")}</small>
            </div>
            <StatusPill value={String(selected.status ?? "")} tone={toneForInventory(String(selected.status ?? ""))} />
          </div>
          <div className="fc-detail-grid">
            <DField label="Floor" value={String(selected.floor ?? "—")} />
            <DField label="Unit Type" value={String(selected.unit_type ?? "—")} />
            <DField label="List Price" value={<span className="mono">{fmtMoney(selected.list_price)}</span>} />
            <DField label="Min. Deposit" value={`${String(selected.minimum_deposit_percent ?? 0)}%`} />
            <DField label="Construction Progress" value={<ProgressBar pct={Number(selected.construction_progress ?? 0)} />} />
            <DField label="Reservation Expiry" value={selected.reservation_expires_at ? fmtDateTime(selected.reservation_expires_at) : "—"} />
          </div>
        </DetailDrawer>
      )}
    </>
  );
}

function toneForInventory(s: string): Tone {
  if (s === "available") return "green";
  if (s === "reserved") return "yellow";
  if (s === "sold") return "blue";
  return "gray";
}
function UnitGridView({ rows, onSelect }: { rows: Row[]; onSelect: (r: Row) => void }) {
  const [floor, setFloor] = useState("all");
  const floors = [...new Set(rows.map(r => String(r.floor || "Ground")))].sort();
  const filtered = floor === "all" ? rows : rows.filter(r => String(r.floor || "Ground") === floor);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="row" style={{ gap: 16, fontSize: 12 }}>
        <div className="row" style={{ gap: 6 }}><div style={{ width: 16, height: 16, borderRadius: 4, background: "#dcfce7", border: "1px solid #86efac" }} /><span>Available</span></div>
        <div className="row" style={{ gap: 6 }}><div style={{ width: 16, height: 16, borderRadius: 4, background: "#fef3c7", border: "1px solid #fcd34d" }} /><span>Reserved</span></div>
        <div className="row" style={{ gap: 6 }}><div style={{ width: 16, height: 16, borderRadius: 4, background: "#dbeafe", border: "1px solid #93c5fd" }} /><span>Sold</span></div>
        <div className="row" style={{ gap: 6 }}><div style={{ width: 16, height: 16, borderRadius: 4, background: "#f1f5f9", border: "1px solid #cbd5e1" }} /><span>Blocked</span></div>
      </div>

      <div className="row" style={{ gap: 8 }}>
        <button className={`btn sm ${floor === "all" ? "primary" : "ghost"}`} onClick={() => setFloor("all")}>All Floors</button>
        {floors.map(f => (
          <button key={f} className={`btn sm ${floor === f ? "primary" : "ghost"}`} onClick={() => setFloor(f)}>{f}</button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 8 }}>
        {filtered.map((r, i) => {
          const status = String(r.status || r.listing_status || "available");
          const colors: Record<string, string> = {
            available: "#dcfce7", reserved: "#fef3c7", sold: "#dbeafe", blocked: "#f1f5f9"
          };
          const borders: Record<string, string> = {
            available: "#86efac", reserved: "#fcd34d", sold: "#93c5fd", blocked: "#cbd5e1"
          };
          return (
            <div key={String(r.id || i)}
              onClick={() => onSelect(r)}
              style={{
                width: "100%", aspectRatio: "1", borderRadius: 10, cursor: "pointer",
                background: colors[status] || "#dcfce7", border: `2px solid ${borders[status] || "#86efac"}`,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                padding: 8, transition: "all 0.15s ease", textAlign: "center",
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.05)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "none"; }}
            >
              <span className="mono" style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>{String(r.unit_code || r.code || `U${i+1}`)}</span>
              <span style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{String(r.unit_type || r.type || "Unit")}</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: "var(--primary)", marginTop: 4 }}>KES {Number(r.list_price || r.price || 0).toLocaleString()}</span>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && <EmptyState icon="🏢" title="No units" description="No units match the selected floor." />}
    </div>
  );
}

/* -------------------------- buyers -------------------------- */

function BuyersView({
  rows,
  search,
  setSearch,
  status,
  setStatus,
  openRegisterBuyer,
  transitionBuyer,
  org,
}: {
  rows: Row[];
  search: string;
  setSearch: (v: string) => void;
  status: string;
  setStatus: (v: string) => void;
  openRegisterBuyer: () => void;
  transitionBuyer: (row: Row) => void;
  org: string | null;
}) {
  const [selected, setSelected] = useState<Row | null>(null);
  const active = countBy(rows, ["active", "qualified"]);

  return (
    <>
      <KpiStrip cols={5}>
        <KpiCard icon="👥" iconBg="#e0e7ff" iconColor="#4f46e5" label="Total Buyers" value={number.format(rows.length)} sub="Registry count" />
        <KpiCard icon="✅" iconBg="#dcfce7" iconColor="#16a34a" label="Active Buyers" value={number.format(active)} sub="Qualified or active" onClick={() => setStatus(status === "active" ? "" : "active")} />
        <KpiCard icon="🧲" iconBg="#fef3c7" iconColor="#92400e" label="Leads" value={number.format(countBy(rows, ["lead"]))} sub="Awaiting qualification" onClick={() => setStatus(status === "lead" ? "" : "lead")} />
        <KpiCard icon="🎓" iconBg="#e0f2fe" iconColor="#0284c7" label="Completed" value={number.format(countBy(rows, ["completed"]))} sub="Closed purchases" onClick={() => setStatus(status === "completed" ? "" : "completed")} />
        <KpiCard icon="💰" iconBg="#fff7ed" iconColor="#ea580c" label="Bank-Financed" value={number.format(rows.filter((r) => String(r.financing_type) === "bank").length)} sub="Purchasing via financier" />
      </KpiStrip>

      <Panel title="Buyers Registry" badge={rows.length}>
        <TableChrome
          search={search}
          setSearch={setSearch}
          placeholder="Search name, reference, ID, email…"
          chips={<FilterChips options={[{ value: "lead", label: "Leads" }, { value: "qualified", label: "Qualified" }, { value: "active", label: "Active" }, { value: "completed", label: "Completed" }, { value: "cancelled", label: "Cancelled" }]} value={status as "lead" | "qualified" | "active" | "completed" | "cancelled" | ""} onChange={(v) => setStatus(v)} />}
          actions={<button className="btn primary sm" onClick={openRegisterBuyer}>+ Register Buyer</button>}
        >
          {rows.length === 0 ? (
            <EmptyState icon="👥" title="No buyers registered" description="Register your first buyer to attach units, installments and payments." action={<button className="btn primary sm" onClick={openRegisterBuyer}>+ Register Buyer</button>} />
          ) : (
            <DataTable headers={["Ref", "Name", "ID Number", "KRA PIN", "Contact", "Email", "Financing", "Status", "Actions"]}>
              {rows.map((r) => (
                <tr key={String(r.id)} onClick={() => setSelected(r)}>
                  <td><RefText value={r.reference} /></td>
                  <td><strong style={{ fontSize: 12 }}>{String(r.full_name ?? "—")}</strong></td>
                  <td className="mono" style={{ fontSize: 12 }}>{String(r.id_number ?? "—")}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{String(r.tax_number || "—")}</td>
                  <td style={{ fontSize: 12 }}>{String(r.phone ?? "—")}</td>
                  <td style={{ fontSize: 12, color: "#6b7890" }}>{String(r.email ?? "—")}</td>
                  <td><Badge tone={r.financing_type === "bank" ? "blue" : "green"}>{r.financing_type === "bank" ? "Bank" : "Self"}</Badge></td>
                  <td><StatusPill value={String(r.status ?? "")} tone={toneForBuyer(String(r.status ?? ""))} /></td>
                  <td>
                    <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); setSelected(r); }}>Details</button>
                    {String(r.status) in BUYER_TRANSITIONS && BUYER_TRANSITIONS[String(r.status)].length > 0 ? (
                      <button className="btn ghost sm" style={{ marginLeft: 6 }} onClick={(e) => { e.stopPropagation(); transitionBuyer(r); }}>Transition</button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </TableChrome>
      </Panel>

      {selected && (
        <BuyerProfileView buyer={selected} onBack={() => setSelected(null)} org={org} />
      )}
    </>
  );
}

function toneForBuyer(s: string): Tone {
  if (s === "active" || s === "completed") return "green";
  if (s === "qualified") return "blue";
  if (s === "lead") return "yellow";
  if (s === "cancelled") return "red";
  return "gray";
}

const BUYER_TRANSITIONS: Record<string, { value: string; label: string }[]> = {
  lead: [{ value: "qualified", label: "Qualify" }, { value: "cancelled", label: "Cancel" }],
  qualified: [{ value: "active", label: "Activate" }, { value: "cancelled", label: "Cancel" }],
  active: [{ value: "completed", label: "Complete" }, { value: "cancelled", label: "Cancel" }],
  completed: [],
  cancelled: [],
};

/* -------------------------- buyer profile -------------------------- */

function BuyerProfileView({
  buyer,
  onBack,
  org,
}: {
  buyer: Row;
  onBack: () => void;
  org: string | null;
}) {
  const [activeTab, setActiveTab] = useState<"overview" | "payments" | "documents" | "activity">("overview");
  const [payments, setPayments] = useState<Row[]>([]);
  const [documents, setDocuments] = useState<Row[]>([]);
  const [activity, setActivity] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!org || activeTab === "overview") return;
    let active = true;

    const fetchData = async () => {
      setLoading(true);
      try {
        if (activeTab === "payments") {
          const res = await apiFetch(`/sales/payments/?search=${encodeURIComponent(String(buyer.full_name ?? ""))}`, {}, org);
          if (active && res.ok) {
            const data = await res.json();
            const all = Array.isArray(data) ? data : [];
            setPayments(all.filter((p: Row) => String(p.buyer_name ?? "").toLowerCase() === String(buyer.full_name ?? "").toLowerCase()));
          }
        } else if (activeTab === "documents") {
          const salesRes = await apiFetch(`/sales/sales/?search=${encodeURIComponent(String(buyer.full_name ?? ""))}`, {}, org);
          const sales = salesRes.ok ? (await salesRes.json()) : [];
          const saleList: Row[] = Array.isArray(sales) ? sales : [];
          const allDocs: Row[] = [];
          for (const sale of saleList) {
            const res = await apiFetch(`/sales/documents/?search=${encodeURIComponent(String(sale.reference ?? ""))}`, {}, org);
            if (active && res.ok) {
              const data = await res.json();
              if (Array.isArray(data)) allDocs.push(...data);
            }
          }
          if (active) setDocuments(allDocs);
        } else if (activeTab === "activity") {
          const salesRes = await apiFetch(`/sales/sales/?search=${encodeURIComponent(String(buyer.full_name ?? ""))}`, {}, org);
          const sales = salesRes.ok ? (await salesRes.json()) : [];
          const saleList: Row[] = Array.isArray(sales) ? sales : [];
          const allEvents: Row[] = [];
          for (const sale of saleList) {
            const res = await apiFetch(`/sales/audit-events/?search=${encodeURIComponent(String(sale.reference ?? ""))}`, {}, org);
            if (active && res.ok) {
              const data = await res.json();
              if (Array.isArray(data)) allEvents.push(...data);
            }
          }
          if (active) setActivity(allEvents);
        }
      } catch {
        /* silent */
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchData();
    return () => { active = false; };
  }, [org, activeTab, buyer]);

  return (
    <>
      <button className="btn ghost sm" onClick={onBack} style={{ marginBottom: 14 }}>← Back to Buyers</button>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <span className="fc-detail-thumb-placeholder" style={{ height: 48, width: 48, fontSize: 22 }}>👤</span>
        <div className="fc-detail-meta">
          <strong style={{ fontSize: 16 }}>{String(buyer.full_name ?? "—")}</strong>
          <small className="mono" style={{ fontSize: 12 }}>{String(buyer.reference ?? "—")}</small>
        </div>
        <StatusPill value={String(buyer.status ?? "")} tone={toneForBuyer(String(buyer.status ?? ""))} />
        <Badge tone={buyer.financing_type === "bank" ? "blue" : "green"}>
          {buyer.financing_type === "bank" ? "Bank Financed" : "Self Financed"}
        </Badge>
      </div>

      <div className="row" style={{ gap: 4, marginBottom: 18, borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
        {(["overview", "payments", "documents", "activity"] as const).map((t) => (
          <button
            key={t}
            className={`btn sm ${activeTab === t ? "primary" : "ghost"}`}
            onClick={() => setActiveTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="grid-2" style={{ gap: 18 }}>
          <Panel title="Buyer Information">
            <div className="fc-detail-grid">
              <DField label="Full Name" value={String(buyer.full_name ?? "—")} />
              <DField label="Email" value={String(buyer.email ?? "—")} />
              <DField label="Phone" value={String(buyer.phone ?? "—")} />
              <DField label="ID Number" value={<span className="mono">{String(buyer.id_number ?? "—")}</span>} />
              <DField label="KRA PIN" value={<span className="mono">{String(buyer.tax_number || "—")}</span>} />
              <DField label="Financing" value={String(buyer.financing_type === "bank" ? "Bank Financed" : "Self Financed")} />
              <DField label="Financier" value={String(buyer.financier || "—")} />
              <DField label="Agent" value={String(buyer.agent_name || "—")} />
              <DField label="Status" value={<StatusPill value={String(buyer.status ?? "")} tone={toneForBuyer(String(buyer.status ?? ""))} />} />
              <DField label="Confirmed" value={buyer.confirmed_at ? fmtDateTime(buyer.confirmed_at) : "Not confirmed"} />
            </div>
          </Panel>
          <Panel title="Purchase Timeline">
            <EmptyState icon="📋" title="No purchase data" description="Purchase details will appear here once a sale is linked to this buyer." />
          </Panel>
        </div>
      )}

      {activeTab === "payments" && (
        <Panel title="Payment History" badge={payments.length}>
          {loading ? <LoadingState rows={3} /> : payments.length === 0 ? (
            <EmptyState icon="💳" title="No payments" description="No payments found for this buyer." />
          ) : (
            <DataTable headers={["Payment Ref", "Sale", "Method", "Amount", "Date", "Status"]}>
              {payments.map((p) => (
                <tr key={String(p.id)}>
                  <td><RefText value={p.reference} /></td>
                  <td className="mono" style={{ fontSize: 12 }}>{String(p.sale_reference ?? "—")}</td>
                  <td style={{ fontSize: 12 }}>{String(p.method ?? "—")}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{fmtMoney(p.amount)}</td>
                  <td style={{ fontSize: 12 }}>{fmtDate(p.paid_on)}</td>
                  <td><StatusPill value={String(p.status ?? "")} /></td>
                </tr>
              ))}
            </DataTable>
          )}
        </Panel>
      )}

      {activeTab === "documents" && (
        <Panel title="Documents" badge={documents.length}>
          {loading ? <LoadingState rows={3} /> : documents.length === 0 ? (
            <EmptyState icon="📄" title="No documents" description="No documents found for this buyer's sales." />
          ) : (
            <DataTable headers={["Title", "Type", "Sale Ref", "Signed On", "Status"]}>
              {documents.map((d) => (
                <tr key={String(d.id)}>
                  <td><strong style={{ fontSize: 12 }}>{String(d.title ?? "—")}</strong></td>
                  <td><Badge tone="purple">{String(d.document_type ?? "—")}</Badge></td>
                  <td className="mono" style={{ fontSize: 12 }}>{String(d.sale_reference ?? "—")}</td>
                  <td style={{ fontSize: 12 }}>{fmtDate(d.signed_on)}</td>
                  <td><StatusPill value={d.is_final ? "Final" : "Draft"} tone={d.is_final ? "green" : "yellow"} /></td>
                </tr>
              ))}
            </DataTable>
          )}
        </Panel>
      )}

      {activeTab === "activity" && (
        <Panel title="Activity" badge={activity.length}>
          {loading ? <LoadingState rows={3} /> : activity.length === 0 ? (
            <EmptyState icon="🕘" title="No activity" description="No audit events found for this buyer's sales." />
          ) : (
            <DataTable headers={["Timestamp", "User", "Action", "Detail"]}>
              {activity.map((a) => (
                <tr key={String(a.id)}>
                  <td style={{ fontSize: 11, color: "#6b7890" }}>{fmtDateTime(a.created_at)}</td>
                  <td><strong style={{ fontSize: 12 }}>{String(a.actor_name ?? "—")}</strong></td>
                  <td><Badge tone={toneForAudit(String(a.event_type))}>{String(a.event_type ?? "—").replaceAll("_", " ")}</Badge></td>
                  <td style={{ fontSize: 11, color: "#6b7890", maxWidth: 320 }}>{String(a.notes || "—")}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </Panel>
      )}
    </>
  );
}

/* -------------------------- leads -------------------------- */

function LeadsView({
  rows,
  search,
  setSearch,
  status,
  setStatus,
  openRegisterBuyer,
  quickTransition,
}: {
  rows: Row[];
  search: string;
  setSearch: (v: string) => void;
  status: string;
  setStatus: (v: string) => void;
  openRegisterBuyer: () => void;
  quickTransition: (row: Row, target: string) => void;
}) {
  const total = rows.length;
  const newCount = countBy(rows, ["lead"]);
  const qualifiedCount = countBy(rows, ["qualified"]);
  const activeCount = countBy(rows, ["active"]);
  const completedCount = countBy(rows, ["completed"]);
  const cancelledCount = countBy(rows, ["cancelled"]);

  const funnelStages = [
    { label: "New", count: newCount, color: "#2563eb" },
    { label: "Contacted", count: 0, color: "#0891b2" },
    { label: "Site Visit", count: 0, color: "#7c3aed" },
    { label: "Interested", count: qualifiedCount, color: "#f59e0b" },
    { label: "Reserved", count: activeCount, color: "#ea580c" },
    { label: "Converted", count: completedCount, color: "#16a34a" },
    { label: "Lost", count: cancelledCount, color: "#b91c1c" },
  ];
  const maxFunnel = Math.max(...funnelStages.map((s) => s.count), 1);

  return (
    <>
      <KpiStrip cols={7}>
        <KpiCard icon="📊" iconBg="#e0e7ff" iconColor="#4f46e5" label="Total Leads" value={number.format(total)} sub="All pipeline leads" onClick={() => setStatus("")} />
        <KpiCard icon="🆕" iconBg="#dbeafe" iconColor="#2563eb" label="New" value={number.format(newCount)} sub="Awaiting first contact" onClick={() => setStatus(status === "lead" ? "" : "lead")} />
        <KpiCard icon="📞" iconBg="#e0f2fe" iconColor="#0891b2" label="Contacted" value="0" sub="No data available" />
        <KpiCard icon="🏠" iconBg="#ede9fe" iconColor="#7c3aed" label="Site Visits" value="0" sub="No data available" />
        <KpiCard icon="⭐" iconBg="#fef3c7" iconColor="#f59e0b" label="Interested" value={number.format(qualifiedCount)} sub="Qualified leads" onClick={() => setStatus(status === "qualified" ? "" : "qualified")} />
        <KpiCard icon="✅" iconBg="#dcfce7" iconColor="#16a34a" label="Converted" value={number.format(completedCount)} sub="Closed deals" onClick={() => setStatus(status === "completed" ? "" : "completed")} />
        <KpiCard icon="❌" iconBg="#fee2e2" iconColor="#b91c1c" label="Lost" value={number.format(cancelledCount)} sub="Dropped leads" onClick={() => setStatus(status === "cancelled" ? "" : "cancelled")} />
      </KpiStrip>

      <Panel title="Lead Funnel">
        <div style={{ padding: 18 }}>
          {funnelStages.map((stage) => (
            <div key={stage.label} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
                <span>{stage.label}</span>
                <span className="mono" style={{ fontWeight: 700 }}>{number.format(stage.count)}</span>
              </div>
              <div style={{ background: "#edf0f5", borderRadius: 4, height: 22, overflow: "hidden" }}>
                <div style={{ background: stage.color, height: "100%", width: `${(stage.count / maxFunnel) * 100}%`, borderRadius: 4, transition: "width 0.3s ease", minWidth: stage.count > 0 ? 2 : 0 }} />
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Leads Pipeline" badge={rows.length}>
        <TableChrome
          search={search}
          setSearch={setSearch}
          placeholder="Search name, phone, agent…"
          chips={<FilterChips options={[{ value: "lead", label: "New" }, { value: "qualified", label: "Interested" }, { value: "active", label: "Reserved" }, { value: "completed", label: "Converted" }, { value: "cancelled", label: "Lost" }]} value={status as "lead" | "qualified" | "active" | "completed" | "cancelled" | ""} onChange={(v) => setStatus(v)} />}
          actions={<button className="btn primary sm" onClick={openRegisterBuyer}>+ New Lead</button>}
        >
          {rows.length === 0 ? (
            <EmptyState icon="🧲" title="No leads found" description="Register your first lead to start tracking the sales pipeline." action={<button className="btn primary sm" onClick={openRegisterBuyer}>+ New Lead</button>} />
          ) : (
            <DataTable headers={["Name", "Phone", "Agent", "Budget", "Stage", "Actions"]}>
              {rows.map((r) => (
                <tr key={String(r.id)}>
                  <td><strong style={{ fontSize: 12 }}>{String(r.full_name ?? "—")}</strong></td>
                  <td style={{ fontSize: 12 }}>{String(r.phone ?? "—")}</td>
                  <td style={{ fontSize: 12 }}>{String(r.agent_name ?? "—")}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{r.budget ? fmtMoney(r.budget) : "—"}</td>
                  <td><StatusPill value={String(r.status ?? "")} tone={toneForBuyer(String(r.status ?? ""))} /></td>
                  <td>
                    {String(r.status) === "lead" && (
                      <>
                        <button className="btn ghost sm" onClick={() => quickTransition(r, "qualified")}>Qualify</button>
                        <button className="btn ghost sm" style={{ marginLeft: 4 }} onClick={() => quickTransition(r, "cancelled")}>Lose</button>
                      </>
                    )}
                    {String(r.status) === "qualified" && (
                      <>
                        <button className="btn ghost sm" onClick={() => quickTransition(r, "active")}>Reserve</button>
                        <button className="btn ghost sm" style={{ marginLeft: 4 }} onClick={() => quickTransition(r, "cancelled")}>Lose</button>
                      </>
                    )}
                    {String(r.status) === "active" && (
                      <>
                        <button className="btn ghost sm" onClick={() => quickTransition(r, "completed")}>Convert</button>
                        <button className="btn ghost sm" style={{ marginLeft: 4 }} onClick={() => quickTransition(r, "cancelled")}>Lose</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </TableChrome>
      </Panel>
    </>
  );
}

/* -------------------------- sales -------------------------- */

function SalesView({
  rows,
  search,
  setSearch,
  status,
  setStatus,
  canSell,
  openNewSale,
  transitionSale,
}: {
  rows: Row[];
  search: string;
  setSearch: (v: string) => void;
  status: string;
  setStatus: (v: string) => void;
  canSell: boolean;
  openNewSale: () => void;
  transitionSale: (row: Row) => void;
}) {
  const [selected, setSelected] = useState<Row | null>(null);
  const [agreementRow, setAgreementRow] = useState<Row | null>(null);
  const pipelineValue = sumBy(rows, "agreed_price", ["draft", "reserved", "contracted"]);
  const pipelineDeals = countBy(rows, ["draft", "reserved", "contracted"]);

  if (agreementRow) {
    return <SaleAgreementView sale={agreementRow} onBack={() => setAgreementRow(null)} />;
  }

  return (
    <>
      <KpiStrip cols={5}>
        <KpiCard icon="📋" iconBg="#e0e7ff" iconColor="#4f46e5" label="Total Sales" value={number.format(rows.length)} sub="All pipeline records" />
        <KpiCard icon="💼" iconBg="#fff7ed" iconColor="#ea580c" label="Pipeline Value" value={fmtMoney(pipelineValue)} sub={`${number.format(pipelineDeals)} active deals`} />
        <KpiCard icon="🔒" iconBg="#fef3c7" iconColor="#92400e" label="Reserved" value={number.format(countBy(rows, ["reserved"]))} sub="Under reservation" onClick={() => setStatus(status === "reserved" ? "" : "reserved")} />
        <KpiCard icon="📝" iconBg="#e0f2fe" iconColor="#0284c7" label="Contracted" value={number.format(countBy(rows, ["contracted"]))} sub="Agreements signed" onClick={() => setStatus(status === "contracted" ? "" : "contracted")} />
        <KpiCard icon="✅" iconBg="#dcfce7" iconColor="#16a34a" label="Completed" value={number.format(countBy(rows, ["completed"]))} sub="Fully paid & closed" onClick={() => setStatus(status === "completed" ? "" : "completed")} />
      </KpiStrip>

      <Panel title="Sales Pipeline" badge={rows.length}>
        <TableChrome
          search={search}
          setSearch={setSearch}
          placeholder="Search sale ref, buyer, unit…"
          chips={<FilterChips options={[{ value: "draft", label: "Draft" }, { value: "reserved", label: "Reserved" }, { value: "contracted", label: "Contracted" }, { value: "completed", label: "Completed" }, { value: "cancelled", label: "Cancelled" }]} value={status as "draft" | "reserved" | "contracted" | "completed" | "cancelled" | ""} onChange={(v) => setStatus(v)} />}
          actions={canSell ? <button className="btn primary sm" onClick={openNewSale}>+ New Sale</button> : null}
        >
          {rows.length === 0 ? (
            <EmptyState icon="📋" title="No sales recorded" description="Register a sale to attach a buyer, unit and installment plan." action={canSell ? <button className="btn primary sm" onClick={openNewSale}>+ New Sale</button> : undefined} />
          ) : (
            <DataTable headers={["Sale Ref", "Buyer", "Project / Unit", "Price", "Paid", "Balance", "Plan", "Status", "Date", "Actions"]}>
              {rows.map((r) => {
                const price = Number(r.agreed_price ?? 0);
                const paid = Number(r.paid_amount ?? 0);
                return (
                  <tr key={String(r.id)} onClick={() => setAgreementRow(r)}>
                    <td><RefText value={r.reference} /></td>
                    <td><strong style={{ fontSize: 12 }}>{String(r.buyer_name ?? "—")}</strong></td>
                    <td style={{ fontSize: 12, color: "#6b7890" }}>
                      {String(r.project_name ?? "—")}
                      {r.unit_code ? <div className="mono" style={{ fontSize: 10 }}>{String(r.unit_code)}</div> : null}
                    </td>
                    <td className="mono" style={{ fontSize: 12 }}>{fmtMoney(price)}</td>
                    <td className="mono" style={{ fontSize: 12, color: "#16a34a" }}>{fmtMoney(paid)}</td>
                    <td className="mono" style={{ fontSize: 12, color: paid >= price ? "#16a34a" : "#b91c1c" }}>{fmtMoney(price - paid)}</td>
                    <td style={{ fontSize: 11, color: "#6b7890" }}>{price ? `${Math.round((paid / price) * 100)}% paid` : "—"}</td>
                    <td><StatusPill value={String(r.status ?? "")} tone={toneForSale(String(r.status ?? ""))} /></td>
                    <td style={{ fontSize: 11, color: "#6b7890" }}>{fmtDate(r.contracted_on ?? r.reserved_at ?? r.created_at)}</td>
                    <td>
                      <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); setAgreementRow(r); }}>Agreement</button>
                      <button className="btn ghost sm" style={{ marginLeft: 4 }} onClick={(e) => { e.stopPropagation(); transitionSale(r); }}>Transition</button>
                    </td>
                  </tr>
                );
              })}
            </DataTable>
          )}
        </TableChrome>
      </Panel>

      {selected && (
        <DetailDrawer title={`Sale ${String(selected.reference ?? "—")}`} onClose={() => setSelected(null)} width={400}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span className="fc-detail-thumb-placeholder" style={{ height: 44, width: 44, fontSize: 20 }}>🏷️</span>
            <div className="fc-detail-meta">
              <strong style={{ fontSize: 14 }}>{String(selected.buyer_name ?? "—")}</strong>
              <small className="mono">{String(selected.reference ?? "—")}</small>
            </div>
            <StatusPill value={String(selected.status ?? "")} tone={toneForSale(String(selected.status ?? ""))} />
          </div>
          <div className="fc-detail-grid">
            <DField label="Project / Unit" value={`${String(selected.project_name ?? "—")} · ${String(selected.unit_code ?? "—")}`} />
            <DField label="Agreed Price" value={<span className="mono">{fmtMoney(selected.agreed_price)}</span>} />
            <DField label="Reservation Fee" value={<span className="mono">{fmtMoney(selected.reservation_fee)}</span>} />
            <DField label="Paid to Date" value={<span className="mono">{fmtMoney(selected.paid_amount)}</span>} />
            <DField label="Balance" value={<span className="mono">{fmtMoney(Number(selected.agreed_price ?? 0) - Number(selected.paid_amount ?? 0))}</span>} />
            <DField label="Reserved" value={selected.reserved_at ? fmtDateTime(selected.reserved_at) : "—"} />
            <DField label="Contracted" value={selected.contracted_on ? fmtDate(selected.contracted_on) : "—"} />
            <DField label="Expected Completion" value={selected.expected_completion_on ? fmtDate(selected.expected_completion_on) : "—"} />
            <DField label="Cancellation Reason" value={String(selected.cancellation_reason || "—")} />
          </div>
        </DetailDrawer>
      )}
    </>
  );
}

function toneForSale(s: string): Tone {
  if (s === "completed") return "green";
  if (s === "contracted") return "blue";
  if (s === "reserved") return "yellow";
  if (s === "draft") return "gray";
  if (s === "cancelled") return "red";
  return "gray";
}

const SALE_TRANSITIONS: Record<string, { value: string; label: string }[]> = {
  draft: [{ value: "reserved", label: "Reserve unit" }, { value: "cancelled", label: "Cancel" }],
  reserved: [{ value: "contracted", label: "Contract" }, { value: "cancelled", label: "Cancel" }],
  contracted: [{ value: "completed", label: "Complete" }, { value: "cancelled", label: "Cancel" }],
  completed: [],
  cancelled: [],
};

/* -------------------------- site visits -------------------------- */

function visitStatus(row: Row): { label: string; tone: Tone } {
  if (row.converted_buyer) return { label: "Converted", tone: "green" };
  const followUp = row.follow_up_on ? new Date(String(row.follow_up_on)) : null;
  if (followUp && followUp.getTime() < Date.now()) return { label: "Follow-up due", tone: "red" };
  return { label: "Scheduled", tone: "blue" };
}

function isFollowUpDue(row: Row): boolean {
  return Boolean(!row.converted_buyer && row.follow_up_on && new Date(String(row.follow_up_on)).getTime() < Date.now());
}

function SiteVisitsView({
  rows,
  search,
  setSearch,
  canVisit,
  openRecordVisit,
}: {
  rows: Row[];
  search: string;
  setSearch: (v: string) => void;
  canVisit: boolean;
  openRecordVisit: () => void;
}) {
  const converted = rows.filter((r) => r.converted_buyer).length;
  const followDue = rows.filter(isFollowUpDue).length;

  return (
    <>
      <KpiStrip cols={4}>
        <KpiCard icon="📍" iconBg="#e0e7ff" iconColor="#4f46e5" label="Total Visits" value={number.format(rows.length)} sub="Clerk-recorded visits" />
        <KpiCard icon="✅" iconBg="#dcfce7" iconColor="#16a34a" label="Converted" value={number.format(converted)} sub="Became buyers" />
        <KpiCard icon="⏰" iconBg="#fee2e2" iconColor="#b91c1c" label="Follow-up Due" value={number.format(followDue)} sub="Needs client follow-up" />
        <KpiCard icon="📅" iconBg="#e0f2fe" iconColor="#0284c7" label="Scheduled" value={number.format(rows.length - converted - followDue)} sub="Upcoming presentations" />
      </KpiStrip>

      <Panel title="Site Visits & Presentations" badge={rows.length}>
        <TableChrome
          search={search}
          setSearch={setSearch}
          placeholder="Search visitor, phone or project…"
          actions={canVisit ? <button className="btn primary sm" onClick={openRecordVisit}>+ Record Visit (Clerk)</button> : null}
        >
          {rows.length === 0 ? (
            <EmptyState icon="📍" title="No site visits recorded" description="Sales clerks can log visitor arrivals, unit interests and introducing agents." action={canVisit ? <button className="btn primary sm" onClick={openRecordVisit}>+ Record Visit</button> : undefined} />
          ) : (
            <DataTable headers={["Visit Ref", "Visitor", "Contact", "Project", "Interest", "Agent", "Visit Date", "Follow-up", "Status", "Notes"]}>
              {rows.map((r) => {
                const vs = visitStatus(r);
                return (
                  <tr key={String(r.id)}>
                    <td><RefText value={r.reference} /></td>
                    <td><strong style={{ fontSize: 12 }}>{String(r.visitor_name ?? "—")}</strong></td>
                    <td style={{ fontSize: 12, color: "#6b7890" }}>{String(r.phone || r.email || "—")}</td>
                    <td style={{ fontSize: 12 }}>{String(r.project_name ?? "—")}</td>
                    <td style={{ fontSize: 12 }}>{String(r.interested_unit_type || "—")}</td>
                    <td style={{ fontSize: 12 }}>{String(r.agent_name || "—")}</td>
                    <td style={{ fontSize: 12 }}>{fmtDateTime(r.visited_at)}</td>
                    <td style={{ fontSize: 12 }}>{fmtDate(r.follow_up_on)}</td>
                    <td><StatusPill value={vs.label} tone={vs.tone} /></td>
                    <td style={{ fontSize: 11, color: "#6b7890", maxWidth: 220 }}>{String(r.notes || "—")}</td>
                  </tr>
                );
              })}
            </DataTable>
          )}
        </TableChrome>
      </Panel>
    </>
  );
}

/* -------------------------- installments -------------------------- */

function InstallmentsView({ rows, search, setSearch, status, setStatus }: {
  rows: Row[];
  search: string;
  setSearch: (v: string) => void;
  status: string;
  setStatus: (v: string) => void;
}) {
  const overdue = countBy(rows, ["overdue"]);
  const outstanding = rows.reduce((s, r) => s + (Number(r.amount ?? 0) - Number(r.paid_amount ?? 0)), 0);

  function copyLink(r: Row) {
    const url = `${window.location.origin}/sales/pay?installment=${String(r.id)}`;
    navigator.clipboard?.writeText(url).then(
      () => setClipNotice(`Payment link copied for ${String(r.sale_reference ?? "installment")}.`),
      () => setClipNotice("Could not copy the payment link."),
    );
  }

  const [clipNotice, setClipNotice] = useState("");

  return (
    <>
      <KpiStrip cols={5}>
        <KpiCard icon="🗓️" iconBg="#e0e7ff" iconColor="#4f46e5" label="Total Installments" value={number.format(rows.length)} sub="Across all sales" />
        <KpiCard icon="✅" iconBg="#dcfce7" iconColor="#16a34a" label="Paid" value={number.format(countBy(rows, ["paid"]))} sub="Settled in full" onClick={() => setStatus(status === "paid" ? "" : "paid")} />
        <KpiCard icon="⏳" iconBg="#fef3c7" iconColor="#92400e" label="Pending" value={number.format(countBy(rows, ["upcoming", "due", "partial"]))} sub="Due or partly paid" onClick={() => setStatus(status === "due" ? "" : "due")} />
        <KpiCard icon="⚠️" iconBg="#fee2e2" iconColor="#b91c1c" label="Overdue" value={number.format(overdue)} sub="Past due date" onClick={() => setStatus(status === "overdue" ? "" : "overdue")} />
        <KpiCard icon="💰" iconBg="#fff7ed" iconColor="#ea580c" label="Outstanding" value={fmtMoney(outstanding)} sub="Total unpaid balance" />
      </KpiStrip>

      {clipNotice && (
        <div className="card" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.35)", padding: "10px 14px", marginBottom: 0 }}>
          <span style={{ color: "#15803d", fontSize: 13 }}>✓ {clipNotice}</span>
        </div>
      )}

      <Panel title="Installment Schedules" badge={rows.length}>
        <TableChrome
          search={search}
          setSearch={setSearch}
          placeholder="Search sale ref, buyer, milestone…"
          chips={<FilterChips options={[{ value: "paid", label: "Paid" }, { value: "partial", label: "Partial" }, { value: "due", label: "Due" }, { value: "upcoming", label: "Upcoming" }, { value: "overdue", label: "Overdue" }]} value={status as "paid" | "partial" | "due" | "upcoming" | "overdue" | ""} onChange={(v) => setStatus(v)} />}
        >
          {rows.length === 0 ? (
            <EmptyState icon="🗓️" title="No installment schedules" description="Installments are generated against a sale's payment plan." />
          ) : (
            <DataTable headers={["Installment", "Sale", "Buyer", "Due Date", "Amount", "Paid", "Balance", "Status", "Actions"]}>
              {rows.map((r) => {
                const amt = Number(r.amount ?? 0);
                const paid = Number(r.paid_amount ?? 0);
                return (
                  <tr key={String(r.id)}>
                    <td><RefText value={`${String(r.sale_reference ?? "—")} · ${String(r.sequence ?? "—")}`} /></td>
                    <td style={{ fontSize: 12 }}>{String(r.description ?? "—")}</td>
                    <td><strong style={{ fontSize: 12 }}>{String(r.buyer_name ?? "—")}</strong></td>
                    <td style={{ fontSize: 12 }}>{fmtDate(r.due_on)}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{fmtMoney(amt)}</td>
                    <td className="mono" style={{ fontSize: 12, color: "#16a34a" }}>{fmtMoney(paid)}</td>
                    <td className="mono" style={{ fontSize: 12, color: paid >= amt ? "#16a34a" : "#b91c1c" }}>{fmtMoney(amt - paid)}</td>
                    <td><StatusPill value={String(r.status ?? "")} tone={toneForInstallment(String(r.status ?? ""))} /></td>
                    <td>
                      <button className="btn ghost sm" onClick={() => copyLink(r)}>Copy Link</button>
                    </td>
                  </tr>
                );
              })}
            </DataTable>
          )}
        </TableChrome>
      </Panel>
    </>
  );
}

function toneForInstallment(s: string): Tone {
  if (s === "paid") return "green";
  if (s === "partial") return "yellow";
  if (s === "overdue") return "red";
  if (s === "due") return "blue";
  return "gray";
}

/* -------------------------- payments -------------------------- */

function PaymentsView({
  rows,
  search,
  setSearch,
  status,
  setStatus,
  openPaymentAction,
}: {
  rows: Row[];
  search: string;
  setSearch: (v: string) => void;
  status: string;
  setStatus: (v: string) => void;
  openPaymentAction: (row: Row) => void;
}) {
  const verifiedTotal = sumBy(rows, "amount", ["verified", "partial"]);

  return (
    <>
      <KpiStrip cols={4}>
        <KpiCard icon="⏳" iconBg="#fef3c7" iconColor="#92400e" label="Pending Verification" value={number.format(countBy(rows, ["pending"]))} sub="Awaiting approval" onClick={() => setStatus(status === "pending" ? "" : "pending")} />
        <KpiCard icon="✅" iconBg="#dcfce7" iconColor="#16a34a" label="Verified" value={number.format(countBy(rows, ["verified", "partial"]))} sub="Approved & applied" onClick={() => setStatus(status === "verified" ? "" : "verified")} />
        <KpiCard icon="✖️" iconBg="#fee2e2" iconColor="#b91c1c" label="Rejected" value={number.format(countBy(rows, ["rejected"]))} sub="Needs resubmission" onClick={() => setStatus(status === "rejected" ? "" : "rejected")} />
        <KpiCard icon="💰" iconBg="#fff7ed" iconColor="#ea580c" label="Total Collected" value={fmtMoney(verifiedTotal)} sub="Verified amount" />
      </KpiStrip>

      <Panel title="Payments & Verification" badge={rows.length}>
        <TableChrome
          search={search}
          setSearch={setSearch}
          placeholder="Search payment ref, buyer, external ref…"
          chips={<FilterChips options={[{ value: "pending", label: "Pending" }, { value: "verified", label: "Verified" }, { value: "partial", label: "Partial" }, { value: "rejected", label: "Rejected" }, { value: "reversed", label: "Reversed" }]} value={status as "pending" | "verified" | "partial" | "rejected" | "reversed" | ""} onChange={(v) => setStatus(v)} />}
        >
          {rows.length === 0 ? (
            <EmptyState icon="💳" title="No payments recorded" description="Buyer-submitted payments appear here for verification and reconciliation." />
          ) : (
            <DataTable headers={["Payment Ref", "Buyer", "Sale", "Method", "Amount", "Date", "External Ref", "Status", "Actions"]}>
              {rows.map((r) => (
                <tr key={String(r.id)}>
                  <td><RefText value={r.reference} /></td>
                  <td><strong style={{ fontSize: 12 }}>{String(r.buyer_name ?? "—")}</strong></td>
                  <td style={{ fontSize: 12 }} className="mono">{String(r.sale_reference ?? "—")}</td>
                  <td style={{ fontSize: 12 }}>{String(r.method ?? "—")}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{fmtMoney(r.amount)}</td>
                  <td style={{ fontSize: 12 }}>{fmtDate(r.paid_on)}</td>
                  <td className="mono" style={{ fontSize: 11, color: "#6b7890" }}>{String(r.external_reference ?? "—")}</td>
                  <td><StatusPill value={String(r.status ?? "")} tone={toneForPayment(String(r.status ?? ""))} /></td>
                  <td>
                    {["pending", "verified"].includes(String(r.status)) && (
                      <button className="btn ghost sm" onClick={() => openPaymentAction(r)}>{String(r.status) === "pending" ? "Verify" : "Reverse"}</button>
                    )}
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </TableChrome>
      </Panel>
    </>
  );
}

function toneForPayment(s: string): Tone {
  if (s === "verified" || s === "partial") return "green";
  if (s === "pending") return "yellow";
  if (s === "rejected" || s === "reversed") return "red";
  return "gray";
}

/* -------------------------- commissions -------------------------- */

function CommissionsView({
  rows,
  search,
  setSearch,
  status,
  setStatus,
  runCommissionAction,
}: {
  rows: Row[];
  search: string;
  setSearch: (v: string) => void;
  status: string;
  setStatus: (v: string) => void;
  runCommissionAction: (row: Row, action: string) => void;
}) {
  const totalValue = sumBy(rows, "amount");

  return (
    <>
      <KpiStrip cols={5}>
        <KpiCard icon="🧾" iconBg="#e0e7ff" iconColor="#4f46e5" label="Total Commissions" value={number.format(rows.length)} sub="All agent records" />
        <KpiCard icon="⏳" iconBg="#fef3c7" iconColor="#92400e" label="Pending" value={number.format(countBy(rows, ["pending"]))} sub="Waiting on gates" onClick={() => setStatus(status === "pending" ? "" : "pending")} />
        <KpiCard icon="🧪" iconBg="#e0f2fe" iconColor="#0284c7" label="Eligible" value={number.format(countBy(rows, ["eligible"]))} sub="Gates passed" onClick={() => setStatus(status === "eligible" ? "" : "eligible")} />
        <KpiCard icon="✅" iconBg="#dcfce7" iconColor="#16a34a" label="Approved" value={number.format(countBy(rows, ["approved"]))} sub="Approved for payout" onClick={() => setStatus(status === "approved" ? "" : "approved")} />
        <KpiCard icon="💰" iconBg="#fff7ed" iconColor="#ea580c" label="Value" value={fmtMoney(totalValue)} sub="Total commission value" />
      </KpiStrip>

      <Panel title="Agent Commissions" badge={rows.length}>
        <TableChrome
          search={search}
          setSearch={setSearch}
          placeholder="Search commission, agent, sale…"
          chips={<FilterChips options={[{ value: "pending", label: "Pending" }, { value: "eligible", label: "Eligible" }, { value: "approved", label: "Approved" }, { value: "paid", label: "Paid" }, { value: "held", label: "Held" }]} value={status as "pending" | "eligible" | "approved" | "paid" | "held" | ""} onChange={(v) => setStatus(v)} />}
        >
          {rows.length === 0 ? (
            <EmptyState icon="🧾" title="No commissions yet" description="Commissions are generated per sale and gated on verified payments and construction progress." />
          ) : (
            <DataTable headers={["Commission Ref", "Agent", "Sale", "Buyer", "Rate", "Amount", "Payment Gate", "Status", "Actions"]}>
              {rows.map((r) => {
                const st = String(r.status ?? "");
                return (
                  <tr key={String(r.id)}>
                    <td><RefText value={r.reference} /></td>
                    <td><strong style={{ fontSize: 12 }}>{String(r.agent_name ?? "—")}</strong></td>
                    <td className="mono" style={{ fontSize: 12 }}>{String(r.sale_reference ?? "—")}</td>
                    <td style={{ fontSize: 12 }}>{String(r.buyer_name ?? "—")}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{String(r.rate_percent ?? "—")}%</td>
                    <td className="mono" style={{ fontSize: 12 }}>{fmtMoney(r.amount)}</td>
                    <td style={{ fontSize: 11, color: "#6b7890" }}>≥ {String(r.required_paid_percent ?? 0)}% paid</td>
                    <td><StatusPill value={st} tone={toneForCommission(st)} /></td>
                    <td>
                      {st === "eligible" && <button className="btn ghost sm" onClick={() => runCommissionAction(r, "approve")}>Approve</button>}
                      {(st === "pending" || st === "eligible") && <button className="btn ghost sm" style={{ marginLeft: 6 }} onClick={() => runCommissionAction(r, "hold")}>Hold</button>}
                      {st === "approved" && <button className="btn primary sm" style={{ marginLeft: 6 }} onClick={() => runCommissionAction(r, "mark-paid")}>Mark Paid</button>}
                    </td>
                  </tr>
                );
              })}
            </DataTable>
          )}
        </TableChrome>
      </Panel>
    </>
  );
}

function toneForCommission(s: string): Tone {
  if (s === "paid" || s === "approved") return "green";
  if (s === "eligible") return "blue";
  if (s === "pending") return "yellow";
  if (s === "held") return "red";
  return "gray";
}

/* -------------------------- performance -------------------------- */

function PerformanceView({ dashboard }: { dashboard: Dashboard }) {
  const agents = dashboard.agentPerformance ?? EMPTY_ROWS;
  const exposure = dashboard.installmentExposure ?? {};
  const ranked = useMemo(
    () => [...agents].sort((a, b) => Number(b.value ?? 0) - Number(a.value ?? 0)),
    [agents],
  );
  const deals = sumBy(agents, "deals");
  const completed = sumBy(agents, "completed");
  const cancelled = sumBy(agents, "cancelled");
  const valueSold = sumBy(agents, "value");

  return (
    <>
      <KpiStrip cols={5}>
        <KpiCard icon="🧑‍💼" iconBg="#e0e7ff" iconColor="#4f46e5" label="Agents" value={number.format(agents.length)} sub="With recorded sales" />
        <KpiCard icon="🏷️" iconBg="#e0f2fe" iconColor="#0284c7" label="Units Sold" value={number.format(completed)} sub={`${number.format(deals)} total deals`} />
        <KpiCard icon="💰" iconBg="#fff7ed" iconColor="#ea580c" label="Value Sold" value={fmtMoney(valueSold)} sub="Aggregate agreed price" />
        <KpiCard icon="✖️" iconBg="#fee2e2" iconColor="#b91c1c" label="Cancellations" value={number.format(cancelled)} sub="Lost pipeline deals" />
        <KpiCard icon="⚠️" iconBg="#fef3c7" iconColor="#92400e" label="Overdue Exposure" value={fmtMoney(exposure.outstanding)} sub={`${number.format(Number(exposure.count ?? 0))} overdue installments`} />
      </KpiStrip>

      <Panel title="Agent Performance" badge={agents.length}>
        {agents.length === 0 ? (
          <EmptyState icon="🧑‍💼" title="No agent performance data" description="Once agents close sales, their units, value and conversion appear here." />
        ) : (
          <DataTable headers={["Rank", "Agent", "Units Sold", "Value Sold", "Conversion", "Avg Time to Close", "Cancellations", "Status"]}>
            {ranked.map((r, i) => {
              const d = Number(r.deals ?? 0);
              const c = Number(r.completed ?? 0);
              const conv = d ? Math.round((c / d) * 100) : 0;
              const name = `${String(r.agent__first_name ?? "")} ${String(r.agent__last_name ?? "")}`.trim() || String(r.agent__username ?? "—");
              return (
                <tr key={String(r.agent__id ?? i)}>
                  <td><span className="fc-priority-chip"><i style={{ background: i < 3 ? "#16a34a" : "#94a3b8" }} /><span>{i + 1}</span></span></td>
                  <td><strong style={{ fontSize: 12 }}>{name}</strong></td>
                  <td style={{ fontSize: 12 }}>{number.format(c)}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{fmtMoney(r.value)}</td>
                  <td><ProgressBar pct={conv} color="#0284c7" /></td>
                  <td style={{ fontSize: 12, color: "#8a96a7" }}>—</td>
                  <td style={{ fontSize: 12, color: Number(r.cancelled ?? 0) > 0 ? "#b91c1c" : "#16a34a" }}>{number.format(Number(r.cancelled ?? 0))}</td>
                  <td><StatusPill value={d ? "active" : "inactive"} tone={d ? "green" : "gray"} /></td>
                </tr>
              );
            })}
          </DataTable>
        )}
      </Panel>
    </>
  );
}

/* -------------------------- reports -------------------------- */

function ReportsView({
  rows,
  recentExports,
  exportReport,
}: {
  rows: Row[];
  recentExports: Row[];
  exportReport: (key: string, name: string) => void;
}) {
  const icons: Record<string, string> = {
    inventory: "🏠",
    sales: "📋",
    payments: "💳",
    commissions: "🧾",
    visits: "📍",
  };
  const descriptions: Record<string, string> = {
    inventory: "Unit availability, pricing and construction progress by project.",
    sales: "Sales pipeline with buyers, units, agents and sale status.",
    payments: "Reconciled payment ledger for online and offline channels.",
    commissions: "Agent commission ledger with payment and construction gates.",
    visits: "Site visit register with attribution to introducing agents.",
  };

  return (
    <>
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", marginBottom: 18 }}>
        {rows.length === 0 ? (
          <EmptyState icon="📊" title="No report catalogue" description="The analytics service will provide report definitions here." />
        ) : (
          rows.map((r) => {
            const key = String(r.key ?? "");
            const name = String(r.name ?? "Report");
            return (
              <article className="data-panel" key={key} style={{ padding: 18 }}>
                <div style={{ alignItems: "center", display: "flex", gap: 10, marginBottom: 10 }}>
                  <span className="fc-asset-icon" style={{ background: "#fff7ed", color: "#ea580c" }}>{icons[key] ?? "📄"}</span>
                  <strong style={{ fontSize: 13 }}>{name}</strong>
                </div>
                <p className="muted" style={{ fontSize: 12, lineHeight: 1.5, margin: "0 0 14px", minHeight: 36 }}>{descriptions[key] ?? "Exports the current sales dataset as CSV."}</p>
                <button className="btn primary sm" style={{ width: "100%", justifyContent: "center" }} onClick={() => exportReport(key, name)}>↓ Export CSV</button>
              </article>
            );
          })
        )}
      </div>

      <Panel title="Recent Exports" badge={recentExports.length}>
        {recentExports.length === 0 ? (
          <EmptyState icon="🕘" title="No exports yet" description="Reports you download from the catalogue will be tracked here." />
        ) : (
          <DataTable headers={["Report", "File", "Exported At"]}>
            {recentExports.map((e, i) => (
              <tr key={`${String(e.key)}-${i}`}>
                <td><strong style={{ fontSize: 12 }}>{String(e.name ?? "—")}</strong></td>
                <td className="mono" style={{ fontSize: 12 }}>sales-{String(e.key)}.csv</td>
                <td style={{ fontSize: 12 }}>{fmtDateTime(e.exportedAt)}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>
    </>
  );
}

/* -------------------------- documents -------------------------- */

function DocumentsView({ rows, search, setSearch }: {
  rows: Row[];
  search: string;
  setSearch: (v: string) => void;
}) {
  const finals = rows.filter((r) => r.is_final).length;

  return (
    <>
      <KpiStrip cols={3}>
        <KpiCard icon="📄" iconBg="#e0e7ff" iconColor="#4f46e5" label="Total Documents" value={number.format(rows.length)} sub="All legal records" />
        <KpiCard icon="✅" iconBg="#dcfce7" iconColor="#16a34a" label="Final Versions" value={number.format(finals)} sub="Checksum-immutable" />
        <KpiCard icon="📝" iconBg="#fef3c7" iconColor="#92400e" label="Draft Versions" value={number.format(rows.length - finals)} sub="Awaiting finalisation" />
      </KpiStrip>

      <Panel title="Legal Documents" badge={rows.length}>
        <TableChrome search={search} setSearch={setSearch} placeholder="Search title, type or sale ref…">
          {rows.length === 0 ? (
            <EmptyState icon="📄" title="No legal documents" description="Advocate uploads (offer letters, agreements, KYC) will be listed here as immutable records." />
          ) : (
            <DataTable headers={["Document", "Sale Ref", "Type", "Signed On", "Checksum", "Status", "Actions"]}>
              {rows.map((r) => (
                <tr key={String(r.id)}>
                  <td><strong style={{ fontSize: 12 }}>{String(r.title ?? "—")}</strong></td>
                  <td className="mono" style={{ fontSize: 12 }}>{String(r.sale_reference ?? "—")}</td>
                  <td><Badge tone="purple">{String(r.document_type ?? "—")}</Badge></td>
                  <td style={{ fontSize: 12 }}>{fmtDate(r.signed_on)}</td>
                  <td className="mono" style={{ fontSize: 10, color: "#6b7890" }}>{String(r.checksum ?? "—").slice(0, 12)}…</td>
                  <td><StatusPill value={r.is_final ? "Final" : "Draft"} tone={r.is_final ? "green" : "yellow"} /></td>
                  <td>
                    {r.file_url ? <a className="btn ghost sm" href={String(r.file_url)} target="_blank" rel="noreferrer">Download</a> : <span className="muted" style={{ fontSize: 12 }}>No file</span>}
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </TableChrome>
      </Panel>
    </>
  );
}

/* -------------------------- audit events -------------------------- */

function AuditEventsView({ rows, search, setSearch }: {
  rows: Row[];
  search: string;
  setSearch: (v: string) => void;
}) {
  const paymentEvents = rows.filter((r) => String(r.event_type).includes("payment")).length;
  const statusChanges = rows.filter((r) => String(r.event_type).includes("status")).length;

  return (
    <>
      <KpiStrip cols={4}>
        <KpiCard icon="🕘" iconBg="#e0e7ff" iconColor="#4f46e5" label="Audit Events" value={number.format(rows.length)} sub="Immutable activity log" />
        <KpiCard icon="💳" iconBg="#fef3c7" iconColor="#92400e" label="Payment Events" value={number.format(paymentEvents)} sub="Submissions & verification" />
        <KpiCard icon="🔀" iconBg="#e0f2fe" iconColor="#0284c7" label="Status Changes" value={number.format(statusChanges)} sub="Sale & commission moves" />
        <KpiCard icon="🧾" iconBg="#dcfce7" iconColor="#16a34a" label="Verified" value={number.format(rows.filter((r) => String(r.event_type).includes("verified")).length)} sub="Payments approved" />
      </KpiStrip>

      <Panel title="Audit Trail" badge={rows.length}>
        <TableChrome search={search} setSearch={setSearch} placeholder="Search event, sale ref, notes…">
          {rows.length === 0 ? (
            <EmptyState icon="🕘" title="No audit events" description="Every financial and workflow decision will be recorded here with the acting user." />
          ) : (
            <DataTable headers={["Timestamp", "User", "Action", "Entity", "Detail"]}>
              {rows.map((r) => {
                const entity = String(r.sale_reference || r.payment_reference || "—");
                const detail = typeof r.notes === "string" && r.notes ? String(r.notes) : JSON.stringify(r.details ?? "");
                return (
                  <tr key={String(r.id)}>
                    <td style={{ fontSize: 11, color: "#6b7890" }}>{fmtDateTime(r.created_at)}</td>
                    <td><strong style={{ fontSize: 12 }}>{String(r.actor_name ?? "—")}</strong></td>
                    <td><Badge tone={toneForAudit(String(r.event_type))}>{String(r.event_type ?? "—").replaceAll("_", " ")}</Badge></td>
                    <td className="mono" style={{ fontSize: 12 }}>{entity}</td>
                    <td style={{ fontSize: 11, color: "#6b7890", maxWidth: 320 }}>{detail}</td>
                  </tr>
                );
              })}
            </DataTable>
          )}
        </TableChrome>
      </Panel>
    </>
  );
}

function toneForAudit(t: string): "green" | "yellow" | "blue" | "red" | "gray" {
  if (t.includes("verified") || t.includes("approved") || t.includes("completed")) return "green";
  if (t.includes("rejected") || t.includes("reversed") || t.includes("cancelled") || t.includes("expired")) return "red";
  if (t.includes("pending") || t.includes("submitted") || t.includes("reserved")) return "yellow";
  if (t.includes("status_change") || t.includes("created") || t.includes("sale")) return "blue";
  return "gray";
}

/* -------------------------- bank reconciliation -------------------------- */

function BankReconciliationView({
  rows,
  search,
  setSearch,
  org,
}: {
  rows: Row[];
  search: string;
  setSearch: (v: string) => void;
  org: string | null;
}) {
  const [showAdjustment, setShowAdjustment] = useState(false);
  const [adjustRow, setAdjustRow] = useState<Row | null>(null);
  const [adjustReason, setAdjustReason] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const total = rows.length;
  const matched = rows.filter((r) => String(r.status) === "verified").length;
  const unmatched = rows.filter((r) => String(r.status) === "pending").length;
  const totalReconciled = sumBy(rows, "amount", ["verified", "partial"]);
  const matchedPct = total > 0 ? Math.round((matched / total) * 100) : 0;
  const unmatchedAmount = sumBy(rows, "amount", ["pending"]);

  function handleMatch(row: Row) {
    setAdjustRow(row);
    setAdjustReason("");
    setShowAdjustment(true);
  }

  async function submitAdjustment() {
    if (!adjustRow || !org || !adjustReason.trim()) return;
    await apiFetch("/auth/csrf/");
    const res = await apiFetch(`/sales/payments/${adjustRow.id}/verify/`, {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify({}),
    }, org);
    if (res.ok) {
      setShowAdjustment(false);
      setAdjustRow(null);
    }
  }

  return (
    <>
      <KpiStrip cols={4}>
        <KpiCard icon="🏦" iconBg="#e0e7ff" iconColor="#4f46e5" label="Total Transactions" value={number.format(total)} sub="From payment records" />
        <KpiCard icon="✅" iconBg="#dcfce7" iconColor="#16a34a" label="Matched" value={number.format(matched)} sub="Verified & reconciled" />
        <KpiCard icon="⚠️" iconBg="#fef3c7" iconColor="#92400e" label="Unmatched" value={number.format(unmatched)} sub="Pending verification" />
        <KpiCard icon="💰" iconBg="#fff7ed" iconColor="#ea580c" label="Total Reconciled" value={fmtMoney(totalReconciled)} sub={`${matchedPct}% matched`} />
      </KpiStrip>

      <div className="grid-2" style={{ gridTemplateColumns: "1fr 1fr", gap: 18, alignItems: "start" }}>
        <Panel title="Bank Statement Import">
          <div
            style={{
              border: `2px dashed ${dragOver ? "#ea580c" : "var(--border)"}`,
              borderRadius: 10,
              padding: 36,
              textAlign: "center",
              background: dragOver ? "rgba(234,88,12,0.04)" : "var(--surface-2)",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); }}
            onClick={() => document.getElementById("bank-stmt-input")?.click()}
          >
            <input id="bank-stmt-input" type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }} onChange={() => {}} />
            <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.4 }}>📄</div>
            <strong style={{ fontSize: 13 }}>Drop bank statement here</strong>
            <p className="muted" style={{ fontSize: 12, margin: "6px 0 0" }}>or click to browse CSV/Excel files</p>
          </div>
        </Panel>

        <Panel title="Reconciliation Summary">
          <div style={{ padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>Match Rate</span>
              <strong className="mono" style={{ fontSize: 13 }}>{matchedPct}%</strong>
            </div>
            <ProgressBar pct={matchedPct} color={matchedPct >= 80 ? "#16a34a" : matchedPct >= 50 ? "#f59e0b" : "#b91c1c"} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>Unmatched Amount</span>
              <strong className="mono" style={{ fontSize: 13, color: "#b91c1c" }}>{fmtMoney(unmatchedAmount)}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>Total Reconciled</span>
              <strong className="mono" style={{ fontSize: 13, color: "#16a34a" }}>{fmtMoney(totalReconciled)}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>Transactions</span>
              <strong className="mono" style={{ fontSize: 13 }}>{number.format(total)}</strong>
            </div>
          </div>
        </Panel>
      </div>

      <Panel title="Transaction Reconciliation" badge={rows.length}>
        <TableChrome
          search={search}
          setSearch={setSearch}
          placeholder="Search payment ref, buyer, external ref…"
        >
          {rows.length === 0 ? (
            <EmptyState icon="🏦" title="No transactions to reconcile" description="Import a bank statement or record payments to begin reconciliation." />
          ) : (
            <DataTable headers={["Payment Ref", "Date", "Description", "Amount", "System Match", "Actions"]}>
              {rows.map((r) => {
                const st = String(r.status ?? "");
                return (
                  <tr key={String(r.id)}>
                    <td><RefText value={r.reference} /></td>
                    <td style={{ fontSize: 12 }}>{fmtDate(r.paid_on)}</td>
                    <td style={{ fontSize: 12 }}>
                      {String(r.buyer_name ?? "—")}
                      <div style={{ fontSize: 10, color: "#6b7890" }}>{String(r.method ?? "")} · {String(r.external_reference ?? "")}</div>
                    </td>
                    <td className="mono" style={{ fontSize: 12 }}>{fmtMoney(r.amount)}</td>
                    <td>
                      <StatusPill
                        value={st === "verified" ? "Matched" : st === "rejected" ? "Rejected" : "Unmatched"}
                        tone={st === "verified" ? "green" : st === "rejected" ? "red" : "yellow"}
                      />
                    </td>
                    <td>
                      {st === "pending" && (
                        <>
                          <button className="btn ghost sm" onClick={() => handleMatch(r)}>Match</button>
                          <button className="btn ghost sm" style={{ marginLeft: 4 }} onClick={() => { setAdjustRow(r); setAdjustReason("Adjustment needed"); setShowAdjustment(true); }}>Adjust</button>
                        </>
                      )}
                      {st === "verified" && <span style={{ fontSize: 11, color: "#16a34a" }}>✓ Reconciled</span>}
                    </td>
                  </tr>
                );
              })}
            </DataTable>
          )}
        </TableChrome>
      </Panel>

      {showAdjustment && adjustRow && (
        <Modal title="Record Adjustment" onClose={() => setShowAdjustment(false)}>
          <div style={{ display: "grid", gap: 8, fontSize: 13, marginBottom: 16 }}>
            <div className="row" style={{ justifyContent: "space-between" }}><span className="muted">Payment</span><span className="mono">{String(adjustRow.reference ?? "—")}</span></div>
            <div className="row" style={{ justifyContent: "space-between" }}><span className="muted">Amount</span><strong className="mono">{fmtMoney(adjustRow.amount)}</strong></div>
            <div className="row" style={{ justifyContent: "space-between" }}><span className="muted">Buyer</span><span>{String(adjustRow.buyer_name ?? "—")}</span></div>
          </div>
          <Field label="Adjustment Reason" required>
            <textarea rows={3} value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="Why does this transaction need adjustment?" />
          </Field>
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => setShowAdjustment(false)}>Cancel</button>
            <button className="btn primary" disabled={!adjustReason.trim()} onClick={submitAdjustment}>Confirm Match</button>
          </div>
        </Modal>
      )}
    </>
  );
}

/* -------------------------- sale agreement -------------------------- */

function SaleAgreementView({
  sale,
  onBack,
}: {
  sale: Row;
  onBack: () => void;
}) {
  const price = Number(sale.agreed_price ?? 0);
  const paid = Number(sale.paid_amount ?? 0);
  const balance = price - paid;
  const deposit = Number(sale.reservation_fee ?? 0);

  const docs = [
    { label: "Offer Letter", checked: true },
    { label: "Sale Agreement", checked: String(sale.status) === "contracted" || String(sale.status) === "completed" },
    { label: "Buyer ID Copy", checked: true },
    { label: "KRA PIN Certificate", checked: true },
  ];

  function downloadAgreement() {
    const html = `<!DOCTYPE html>
<html><head><title>Sale Agreement - ${String(sale.reference ?? "")}</title>
<style>body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;color:#222;line-height:1.6}
h1{font-size:20px;border-bottom:2px solid #ea580c;padding-bottom:8px}
table{width:100%;border-collapse:collapse;margin:16px 0}
td{padding:8px 12px;border-bottom:1px solid #eee}
td:first-child{font-weight:600;width:40%;color:#555}
.label{color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.05em}
</style></head><body>
<h1>Sale Agreement Summary</h1>
<p class="label">Reference: ${String(sale.reference ?? "—")}</p>
<table>
<tr><td>Buyer</td><td>${String(sale.buyer_name ?? "—")}</td></tr>
<tr><td>Project</td><td>${String(sale.project_name ?? "—")}</td></tr>
<tr><td>Unit</td><td>${String(sale.unit_code ?? "—")}</td></tr>
<tr><td>Agreed Price</td><td>KES ${Number(sale.agreed_price ?? 0).toLocaleString()}</td></tr>
<tr><td>Deposit Paid</td><td>KES ${Number(sale.reservation_fee ?? 0).toLocaleString()}</td></tr>
<tr><td>Total Paid</td><td>KES ${paid.toLocaleString()}</td></tr>
<tr><td>Balance Due</td><td>KES ${balance.toLocaleString()}</td></tr>
<tr><td>Status</td><td>${String(sale.status ?? "—")}</td></tr>
</table>
<h2>Terms &amp; Conditions</h2>
<ol>
<li>The buyer agrees to pay the balance in accordance with the agreed installment schedule.</li>
<li>Transfer of title shall occur upon full payment of the purchase price.</li>
<li>The seller warrants that the property is free from encumbrances at the time of sale.</li>
<li>Any late payment shall attract a penalty of 2% per month on the outstanding amount.</li>
<li>This agreement is governed by the laws of the Republic of Kenya.</li>
</ol>
<h2>Payment Schedule</h2>
<p>Deposit: KES ${deposit.toLocaleString()} (paid)</p>
<p>Balance: KES ${balance.toLocaleString()} — to be paid per installment plan.</p>
<hr><p style="font-size:12px;color:#888">Generated on ${new Date().toLocaleDateString("en-GB")} — Center Estates ERP</p>
</body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  }

  return (
    <>
      <button className="btn ghost sm" onClick={onBack} style={{ marginBottom: 14 }}>← Back to Sales</button>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <span className="fc-detail-thumb-placeholder" style={{ height: 48, width: 48, fontSize: 22 }}>📄</span>
        <div className="fc-detail-meta">
          <strong style={{ fontSize: 16 }}>Sale Agreement — {String(sale.reference ?? "—")}</strong>
          <small className="mono" style={{ fontSize: 12 }}>{String(sale.buyer_name ?? "—")} · {String(sale.unit_code ?? "—")}</small>
        </div>
        <StatusPill value={String(sale.status ?? "")} tone={toneForSale(String(sale.status ?? ""))} />
      </div>

      <div className="grid-2" style={{ gap: 18 }}>
        <Panel title="Sale Header">
          <div className="fc-detail-grid">
            <DField label="Sale Reference" value={<RefText value={sale.reference} />} />
            <DField label="Buyer" value={String(sale.buyer_name ?? "—")} />
            <DField label="Unit" value={String(sale.unit_code ?? "—")} />
            <DField label="Project" value={String(sale.project_name ?? "—")} />
            <DField label="Status" value={<StatusPill value={String(sale.status ?? "")} tone={toneForSale(String(sale.status ?? ""))} />} />
            <DField label="Contracted On" value={sale.contracted_on ? fmtDate(sale.contracted_on) : "—"} />
          </div>
        </Panel>

        <Panel title="Financial Summary">
          <div className="fc-detail-grid">
            <DField label="Agreed Price" value={<span className="mono" style={{ fontWeight: 700 }}>{fmtMoney(price)}</span>} />
            <DField label="Deposit" value={<span className="mono">{fmtMoney(deposit)}</span>} />
            <DField label="Paid to Date" value={<span className="mono" style={{ color: "#16a34a" }}>{fmtMoney(paid)}</span>} />
            <DField label="Balance Due" value={<span className="mono" style={{ color: balance > 0 ? "#b91c1c" : "#16a34a", fontWeight: 700 }}>{fmtMoney(balance)}</span>} />
          </div>
          <div style={{ padding: "12px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
              <span>Payment Progress</span>
              <span className="mono" style={{ fontWeight: 700 }}>{price > 0 ? Math.round((paid / price) * 100) : 0}%</span>
            </div>
            <ProgressBar pct={price > 0 ? (paid / price) * 100 : 0} />
          </div>
        </Panel>
      </div>

      <div className="grid-2" style={{ gap: 18, marginTop: 18 }}>
        <Panel title="Terms &amp; Conditions">
          <div style={{ padding: 18, fontSize: 13, lineHeight: 1.7 }}>
            <ol style={{ margin: 0, paddingLeft: 18 }}>
              <li>The buyer agrees to pay the balance in accordance with the agreed installment schedule.</li>
              <li>Transfer of title shall occur upon full payment of the purchase price.</li>
              <li>The seller warrants that the property is free from encumbrances at the time of sale.</li>
              <li>Any late payment shall attract a penalty of 2% per month on the outstanding amount.</li>
              <li>This agreement is governed by the laws of the Republic of Kenya.</li>
            </ol>
          </div>
        </Panel>

        <Panel title="Documents Checklist">
          <div style={{ padding: 18 }}>
            {docs.map((d) => (
              <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                <span style={{ fontSize: 16 }}>{d.checked ? "✅" : "⬜"}</span>
                <span style={{ fontSize: 13, fontWeight: d.checked ? 600 : 400 }}>{d.label}</span>
              </div>
            ))}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button className="btn primary sm" onClick={downloadAgreement}>↓ Download Agreement</button>
              <button className="btn ghost sm" disabled title="Email integration coming soon">✉ Send to Buyer</button>
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
}

/* -------------------------- handover -------------------------- */

function HandoverView({
  rows,
  search,
  setSearch,
}: {
  rows: Row[];
  search: string;
  setSearch: (v: string) => void;
}) {
  const [handoverStatus, setHandoverStatus] = useState<Record<string, string>>({});

  const totalUnits = rows.length;
  const readyCount = rows.filter((r) => handoverStatus[String(r.id)] === "ready").length;
  const handedOverCount = rows.filter((r) => handoverStatus[String(r.id)] === "handed_over").length;
  const pendingCount = totalUnits - readyCount - handedOverCount;

  function markReady(id: string) {
    setHandoverStatus((prev) => ({ ...prev, [id]: "ready" }));
  }

  function completeHandover(id: string) {
    setHandoverStatus((prev) => ({ ...prev, [id]: "handed_over" }));
  }

  function exportCsv() {
    const header = "Unit Code,Project,Buyer,Sale Date,Inspection,Handover Date,Status\n";
    const body = rows.map((r) => {
      const st = handoverStatus[String(r.id)] ?? "pending";
      return [
        String(r.unit_code ?? ""),
        String(r.project_name ?? ""),
        String(r.buyer_name ?? ""),
        String(r.contracted_on ?? ""),
        st === "handed_over" ? "Passed" : st === "ready" ? "Scheduled" : "Pending",
        st === "handed_over" ? new Date().toLocaleDateString("en-GB") : "",
        st,
      ].join(",");
    }).join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "handover-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <KpiStrip cols={4}>
        <KpiCard icon="🏠" iconBg="#e0e7ff" iconColor="#4f46e5" label="Total Units" value={number.format(totalUnits)} sub="Completed sales eligible" />
        <KpiCard icon="📦" iconBg="#dcfce7" iconColor="#16a34a" label="Ready for Handover" value={number.format(readyCount)} sub="Awaiting handover completion" />
        <KpiCard icon="✅" iconBg="#e0f2fe" iconColor="#0284c7" label="Handed Over" value={number.format(handedOverCount)} sub="Units fully delivered" />
        <KpiCard icon="⏳" iconBg="#fef3c7" iconColor="#92400e" label="Pending Inspection" value={number.format(pendingCount)} sub="Not yet ready" />
      </KpiStrip>

      <Panel title="Unit Handover" badge={rows.length}>
        <TableChrome
          search={search}
          setSearch={setSearch}
          placeholder="Search unit code, buyer, project…"
          actions={<button className="btn primary sm" onClick={exportCsv}>↓ Export Handover Report</button>}
        >
          {rows.length === 0 ? (
            <EmptyState icon="🏠" title="No units ready for handover" description="Completed sales that are candidates for handover will appear here." />
          ) : (
            <DataTable headers={["Unit Code", "Property", "Buyer", "Sale Date", "Inspection", "Handover Date", "Status", "Actions"]}>
              {rows.map((r) => {
                const st = handoverStatus[String(r.id)] ?? "pending";
                return (
                  <tr key={String(r.id)}>
                    <td><RefText value={r.unit_code} /></td>
                    <td><strong style={{ fontSize: 12 }}>{String(r.project_name ?? "—")}</strong></td>
                    <td style={{ fontSize: 12 }}>{String(r.buyer_name ?? "—")}</td>
                    <td style={{ fontSize: 11, color: "#6b7890" }}>{fmtDate(r.contracted_on ?? r.created_at)}</td>
                    <td><StatusPill value={st === "handed_over" ? "Passed" : st === "ready" ? "Scheduled" : "Pending"} /></td>
                    <td style={{ fontSize: 11, color: "#6b7890" }}>{st === "handed_over" ? fmtDate(new Date().toISOString()) : "—"}</td>
                    <td><StatusPill value={st === "handed_over" ? "completed" : st === "ready" ? "ready" : "pending"} /></td>
                    <td>
                      {st === "pending" && <button className="btn ghost sm" onClick={() => markReady(String(r.id))}>Mark Ready for Handover</button>}
                      {st === "ready" && <button className="btn primary sm" onClick={() => completeHandover(String(r.id))}>Complete Handover</button>}
                      {st === "handed_over" && <span style={{ fontSize: 11, color: "#16a34a" }}>✓ Done</span>}
                    </td>
                  </tr>
                );
              })}
            </DataTable>
          )}
        </TableChrome>
      </Panel>
    </>
  );
}

/* -------------------------- modals -------------------------- */

function FormError({ error }: { error: string }) {
  if (!error) return null;
  return (
    <div className="error-banner" style={{ background: "var(--danger-bg)", border: "1px solid var(--danger)", borderRadius: 8, color: "var(--danger)", padding: "10px 14px", marginBottom: 12, fontSize: 12 }}>
      ⚠️ {error}
    </div>
  );
}

function RegisterBuyerModal({ open, onClose, onSubmit, error }: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, string>) => void;
  error: string;
}) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<Record<string, string>>({
    reference: "",
    full_name: "",
    email: "",
    phone: "",
    id_number: "",
    tax_number: "",
    financing_type: "self",
    financier: "",
    address: "",
    sale_project: "",
    sale_unit: "",
    agreed_price: "",
    reservation_fee: "",
  });
  const [docsCheck, setDocsCheck] = useState({ offer_letter: false, id_copy: false, kra_pin: false });

  if (!open) return null;

  function updateField(key: string, value: string) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  function nextStep() {
    if (step < 3) setStep(step + 1);
  }

  function prevStep() {
    if (step > 1) setStep(step - 1);
  }

  function handleSubmit() {
    const payload: Record<string, string> = {};
    for (const [k, v] of Object.entries(formData)) {
      if (v) payload[k] = v;
    }
    onSubmit(payload);
  }

  const stepLabels = ["Buyer Info", "Purchase Details", "Review & Submit"];

  return (
    <Modal title="Register Buyer" onClose={onClose} wide>
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 20 }}>
        {stepLabels.map((label, i) => (
          <div key={label} style={{ display: "flex", alignItems: "center", flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 700,
                  background: i + 1 <= step ? "#ea580c" : "#edf0f5",
                  color: i + 1 <= step ? "#fff" : "#8a96a7",
                  transition: "all 0.15s ease",
                }}
              >
                {i + 1}
              </span>
              <span style={{ fontSize: 12, fontWeight: i + 1 === step ? 700 : 400, color: i + 1 === step ? "var(--text)" : "var(--muted)" }}>{label}</span>
            </div>
            {i < stepLabels.length - 1 && (
              <div style={{ flex: 1, height: 2, background: i + 1 < step ? "#ea580c" : "#edf0f5", margin: "0 12px", borderRadius: 1 }} />
            )}
          </div>
        ))}
      </div>

      <FormError error={error} />

      {step === 1 && (
        <div>
          <div className="grid-2">
            <Field label="Buyer Reference" required>
              <input value={formData.reference} onChange={(e) => updateField("reference", e.target.value)} required placeholder="BUY-2026-0001" />
            </Field>
            <Field label="Full Legal Name" required>
              <input value={formData.full_name} onChange={(e) => updateField("full_name", e.target.value)} required placeholder="e.g. Apex Holdings Ltd" />
            </Field>
          </div>
          <div className="grid-2">
            <Field label="Email Address">
              <input type="email" value={formData.email} onChange={(e) => updateField("email", e.target.value)} placeholder="buyer@domain.co.ke" />
            </Field>
            <Field label="Phone Number">
              <input value={formData.phone} onChange={(e) => updateField("phone", e.target.value)} placeholder="+254 700 000 000" />
            </Field>
          </div>
          <div className="grid-2">
            <Field label="National / Company ID" required>
              <input value={formData.id_number} onChange={(e) => updateField("id_number", e.target.value)} required placeholder="12345678" />
            </Field>
            <Field label="KRA PIN">
              <input value={formData.tax_number} onChange={(e) => updateField("tax_number", e.target.value)} placeholder="A000000000X" />
            </Field>
          </div>
          <div className="grid-2">
            <Field label="Financing Type">
              <select value={formData.financing_type} onChange={(e) => updateField("financing_type", e.target.value)}>
                <option value="self">Self-Financed</option>
                <option value="bank">Bank-Financed</option>
              </select>
            </Field>
            <Field label="Financier (if bank-financed)">
              <input value={formData.financier} onChange={(e) => updateField("financier", e.target.value)} placeholder="e.g. KCB Bank" />
            </Field>
          </div>
          <Field label="Address">
            <textarea rows={2} value={formData.address} onChange={(e) => updateField("address", e.target.value)} placeholder="Postal / physical address" />
          </Field>
        </div>
      )}

      {step === 2 && (
        <div>
          <div className="grid-2">
            <Field label="Project">
              <input value={formData.sale_project} onChange={(e) => updateField("sale_project", e.target.value)} placeholder="Project name or ID" />
            </Field>
            <Field label="Unit">
              <input value={formData.sale_unit} onChange={(e) => updateField("sale_unit", e.target.value)} placeholder="Unit code" />
            </Field>
          </div>
          <div className="grid-2">
            <Field label="Agreed Price (KES)">
              <input type="number" min="1" value={formData.agreed_price} onChange={(e) => updateField("agreed_price", e.target.value)} placeholder="12500000" />
            </Field>
            <Field label="Deposit Amount (KES)">
              <input type="number" min="0" value={formData.reservation_fee} onChange={(e) => updateField("reservation_fee", e.target.value)} placeholder="0" />
            </Field>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <Panel title="Buyer Summary" style={{ marginBottom: 14 }}>
            <div className="fc-detail-grid">
              <DField label="Name" value={formData.full_name || "—"} />
              <DField label="Email" value={formData.email || "—"} />
              <DField label="Phone" value={formData.phone || "—"} />
              <DField label="ID" value={<span className="mono">{formData.id_number || "—"}</span>} />
              <DField label="KRA PIN" value={<span className="mono">{formData.tax_number || "—"}</span>} />
              <DField label="Financing" value={formData.financing_type === "bank" ? "Bank-Financed" : "Self-Financed"} />
              <DField label="Financier" value={formData.financier || "—"} />
              {formData.agreed_price && <DField label="Price" value={<span className="mono">{fmtMoney(formData.agreed_price)}</span>} />}
              {formData.reservation_fee && <DField label="Deposit" value={<span className="mono">{fmtMoney(formData.reservation_fee)}</span>} />}
            </div>
          </Panel>

          <Panel title="Documents Checklist">
            <div style={{ padding: 18 }}>
              {([
                { key: "offer_letter", label: "Offer Letter" },
                { key: "id_copy", label: "Buyer ID Copy" },
                { key: "kra_pin", label: "KRA PIN Certificate" },
              ] as const).map((d) => (
                <label key={d.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={docsCheck[d.key]}
                    onChange={(e) => setDocsCheck((prev) => ({ ...prev, [d.key]: e.target.checked }))}
                    style={{ width: 16, height: 16 }}
                  />
                  <span style={{ fontSize: 13 }}>{d.label}</span>
                </label>
              ))}
            </div>
          </Panel>
        </div>
      )}

      <div className="modal-actions" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", gap: 8, width: "100%", justifyContent: "space-between" }}>
          <div>
            {step > 1 && <button type="button" className="btn ghost" onClick={prevStep}>← Previous</button>}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
            {step < 3 ? (
              <button type="button" className="btn primary" onClick={nextStep}>Next →</button>
            ) : (
              <button type="button" className="btn primary" onClick={handleSubmit}>Register Buyer</button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function NewSaleModal({ open, onClose, onSubmit, error, buyers, listings }: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, string>) => void;
  error: string;
  buyers: Row[];
  listings: Row[];
}) {
  if (!open) return null;
  return (
    <Modal title="+ New Sale" onClose={onClose}>
      <FormError error={error} />
      <form onSubmit={(e) => {
        e.preventDefault();
        onSubmit(Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>);
      }}>
        <div className="grid-2">
          <Field label="Sale Reference" required>
            <input name="reference" required placeholder="SALE-2026-0001" />
          </Field>
          <Field label="Buyer" required>
            <select name="buyer" required defaultValue="">
              <option value="" disabled>Select buyer…</option>
              {buyers.map((b) => <option key={String(b.id)} value={String(b.id)}>{String(b.full_name ?? "—")} · {String(b.reference ?? "—")}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Unit Listing" required>
          <select name="listing" required defaultValue="">
            <option value="" disabled>Select listing…</option>
            {listings.map((l) => <option key={String(l.id)} value={String(l.id)}>{String(l.project_name ?? "—")} · {String(l.unit_code ?? "—")} · {fmtMoney(l.list_price)}</option>)}
          </select>
        </Field>
        <div className="grid-2">
          <Field label="Agreed Price (KES)" required>
            <input name="agreed_price" type="number" min="1" required placeholder="12500000" />
          </Field>
          <Field label="Reservation Fee (KES)">
            <input name="reservation_fee" type="number" min="0" defaultValue="0" />
          </Field>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary">Create Sale</button>
        </div>
      </form>
    </Modal>
  );
}

function RecordVisitModal({ open, onClose, onSubmit, error, projects }: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, string>) => void;
  error: string;
  projects: Row[];
}) {
  if (!open) return null;
  return (
    <Modal title="📍 Record Site Visit (Clerk)" onClose={onClose}>
      <FormError error={error} />
      <form onSubmit={(e) => {
        e.preventDefault();
        const payload = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>;
        if (payload.visited_at) payload.visited_at = new Date(payload.visited_at).toISOString();
        onSubmit(payload);
      }}>
        <div className="grid-2">
          <Field label="Visit Reference" required>
            <input name="reference" required placeholder="VS-2026-0001" />
          </Field>
          <Field label="Visitor Name" required>
            <input name="visitor_name" required placeholder="Client full name" />
          </Field>
        </div>
        <div className="grid-2">
          <Field label="Phone">
            <input name="phone" placeholder="+254 700 000 000" />
          </Field>
          <Field label="Email">
            <input name="email" type="email" placeholder="visitor@domain.co.ke" />
          </Field>
        </div>
        <div className="grid-2">
          <Field label="Project" required>
            <select name="project" required defaultValue="">
              <option value="" disabled>Select project…</option>
              {projects.map((p) => <option key={String(p.id)} value={String(p.id)}>{String(p.name ?? "—")}</option>)}
            </select>
          </Field>
          <Field label="Interested Unit Type">
            <input name="interested_unit_type" placeholder="e.g. 3-Bedroom Apartment" />
          </Field>
        </div>
        <Field label="Visit Date & Time" required>
          <input name="visited_at" type="datetime-local" required />
        </Field>
        <Field label="Notes">
          <textarea name="notes" rows={3} placeholder="Presentation summary, financing interest, next steps…" />
        </Field>
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary">Record Visit</button>
        </div>
      </form>
    </Modal>
  );
}

function NewListingModal({ open, onClose, onSubmit, error, projects, units }: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, string>) => void;
  error: string;
  projects: Row[];
  units: Row[];
}) {
  if (!open) return null;
  return (
    <Modal title="+ New Listing" onClose={onClose}>
      <FormError error={error} />
      <form onSubmit={(e) => {
        e.preventDefault();
        onSubmit(Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>);
      }}>
        <Field label="Project" required>
          <select name="project" required defaultValue="">
            <option value="" disabled>Select project…</option>
            {projects.map((p) => <option key={String(p.id)} value={String(p.id)}>{String(p.name ?? "—")}</option>)}
          </select>
        </Field>
        <Field label="Unit" required>
          <select name="unit" required defaultValue="">
            <option value="" disabled>Select unit…</option>
            {units.map((u) => <option key={String(u.id)} value={String(u.id)}>{String(u.code ?? "—")} · {String(u.unit_type ?? "—")} · Floor {String(u.floor ?? "—")}</option>)}
          </select>
        </Field>
        <div className="grid-2">
          <Field label="List Price (KES)" required>
            <input name="list_price" type="number" min="1" required placeholder="12500000" />
          </Field>
          <Field label="Min. Deposit %">
            <input name="minimum_deposit_percent" type="number" min="0" max="100" defaultValue="10" />
          </Field>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary">Create Listing</button>
        </div>
      </form>
    </Modal>
  );
}

function PaymentActionModal({ payment, onClose, onAction, error }: {
  payment: Row | null;
  onClose: () => void;
  onAction: (payload: { action: "verify" | "reject" | "reverse"; reason?: string }) => void;
  error: string;
}) {
  const [reason, setReason] = useState("");
  if (!payment) return null;
  const status = String(payment.status ?? "");

  return (
    <Modal title={status === "pending" ? `Verify Payment ${String(payment.reference ?? "")}` : `Reverse Payment ${String(payment.reference ?? "")}`} onClose={onClose}>
      <FormError error={error} />
      <div style={{ display: "grid", gap: 8, fontSize: 13, marginBottom: 16 }}>
        <div className="row" style={{ justifyContent: "space-between" }}><span className="muted">Buyer</span><strong>{String(payment.buyer_name ?? "—")}</strong></div>
        <div className="row" style={{ justifyContent: "space-between" }}><span className="muted">Sale</span><span className="mono">{String(payment.sale_reference ?? "—")}</span></div>
        <div className="row" style={{ justifyContent: "space-between" }}><span className="muted">Method</span><span>{String(payment.method ?? "—")}</span></div>
        <div className="row" style={{ justifyContent: "space-between" }}><span className="muted">Amount</span><strong className="mono">{fmtMoney(payment.amount)}</strong></div>
        <div className="row" style={{ justifyContent: "space-between" }}><span className="muted">External Ref</span><span className="mono">{String(payment.external_reference ?? "—")}</span></div>
      </div>
      {status === "pending" ? (
        <>
          <p className="muted" style={{ fontSize: 12, margin: "0 0 14px" }}>
            Approving allocates the full amount to the linked installment and recalculates commission gates. Rejecting requires a reason that is retained in the audit trail.
          </p>
          <Field label="Rejection Reason (required to reject)">
            <textarea name="reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. M-Pesa reference does not match, duplicate submission…" />
          </Field>
          <div className="modal-actions">
            <button className="btn ghost" disabled={!reason.trim()} onClick={() => onAction({ action: "reject", reason })}>Reject</button>
            <button className="btn primary" onClick={() => onAction({ action: "verify" })}>✓ Approve Payment</button>
          </div>
        </>
      ) : (
        <>
          <Field label="Reversal Reason" required>
            <textarea name="reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this verified payment being reversed?" />
          </Field>
          <div className="modal-actions">
            <button className="btn ghost" onClick={onClose}>Cancel</button>
            <button className="btn danger" onClick={() => onAction({ action: "reverse", reason })}>↩ Reverse Payment</button>
          </div>
        </>
      )}
    </Modal>
  );
}

function TransitionModal({ title, row, options, onClose, onSubmit, error }: {
  title: string;
  row: Row | null;
  options: { value: string; label: string }[];
  onClose: () => void;
  onSubmit: (payload: { status: string; notes?: string }) => void;
  error: string;
}) {
  const [target, setTarget] = useState("");
  const [notes, setNotes] = useState("");
  if (!row) return null;
  const needsNotes = target === "cancelled";

  return (
    <Modal title={title} onClose={onClose}>
      <FormError error={error} />
      <div style={{ display: "grid", gap: 8, fontSize: 13, marginBottom: 16 }}>
        <div className="row" style={{ justifyContent: "space-between" }}><span className="muted">Reference</span><span className="mono">{String(row.reference ?? "—")}</span></div>
        <div className="row" style={{ justifyContent: "space-between" }}><span className="muted">Current Status</span><StatusPill value={String(row.status ?? "—")} /></div>
      </div>
      <Field label="Move to" required>
        <select value={target} onChange={(e) => setTarget(e.target.value)} required>
          <option value="" disabled>Select next status…</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>
      <Field label={needsNotes ? "Reason (required for cancellation)" : "Notes"}>
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={needsNotes ? "Required — retained in the audit trail." : "Optional note for the audit trail."} />
      </Field>
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!target || (needsNotes && !notes.trim())} onClick={() => onSubmit({ status: target, notes })}>Apply Transition</button>
      </div>
    </Modal>
  );
}

/* -------------------------- main workspace -------------------------- */

export function SalesWorkspace({ initialTab = "overview" }: { initialTab?: string }) {
  const { session, can } = useAuth();
  const { activeProperty } = usePropertyContext();
  const org = session?.activeOrganizationId ?? null;
  const canSell = can("sales.selling");
  const canVisit = can("sales.visits");

  const [tab, setTab] = useState<SalesTab>(() => {
    if (typeof window !== "undefined") {
      const q = new URLSearchParams(window.location.search).get("tab");
      if (q && q in labels) return q as SalesTab;
    }
    return initialTab in labels ? (initialTab as SalesTab) : "overview";
  });
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  // Modals
  const [showRegisterBuyer, setShowRegisterBuyer] = useState(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("register") === "1");
  const [showNewSale, setShowNewSale] = useState(false);
  const [showRecordVisit, setShowRecordVisit] = useState(false);
  const [showNewListing, setShowNewListing] = useState(false);
  const [paymentAction, setPaymentAction] = useState<Row | null>(null);
  const [transitionSaleRow, setTransitionSaleRow] = useState<Row | null>(null);
  const [transitionBuyerRow, setTransitionBuyerRow] = useState<Row | null>(null);

  const [options, setOptions] = useState<{ buyers: Row[]; listings: Row[]; projects: Row[]; units: Row[] }>({ buyers: [], listings: [], projects: [], units: [] });
  const [recentExports, setRecentExports] = useState<Row[]>([]);

  const loadVersion = useRef(0);

  const loadData = useCallback(async () => {
    if (!org) return;
    const version = ++loadVersion.current;
    setLoading(true);
    setError("");

    const isAnalytics = tab === "performance" || tab === "reports";
    const isHandover = tab === "handover";
    const isBankRecon = tab === "bank-reconciliation";
    let path = "/sales/dashboard/";
    if (isAnalytics) path = "/sales/analytics/";
    else if (isHandover) path = "/sales/sales/?status=completed";
    else if (isBankRecon) path = `/sales/payments/?search=${encodeURIComponent(search)}${status ? `&status=${encodeURIComponent(status)}` : ""}`;
    else if (tab === "leads") path = `/sales/buyers/?search=${encodeURIComponent(search)}${status ? `&status=${encodeURIComponent(status)}` : ""}`;
    else if (tab !== "overview") path = `/sales/${tab}/?search=${encodeURIComponent(search)}${status ? `&status=${encodeURIComponent(status)}` : ""}`;

    try {
      const res = await apiFetch(path, {}, org);
      if (version !== loadVersion.current) return;
      if (!res.ok) {
        setRows([]);
        setDashboard(null);
        return;
      }
      const data = (await res.json()) as Dashboard;
      if (version !== loadVersion.current) return;
      if (tab === "overview" || isAnalytics) setDashboard(data);
      if (tab === "performance") setRows(data.agentPerformance ?? []);
      else if (tab === "reports") setRows(data.reports ?? []);
      else if (tab === "overview") setRows([]);
      else setRows(Array.isArray(data) ? (data as unknown as Row[]) : []);
    } catch {
      if (version === loadVersion.current) setError("Unable to connect to the property sales service.");
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [tab, search, status, org, activeProperty?.id]);

  useEffect(() => {
    const timer = setTimeout(loadData, search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [loadData, search]);

  // Load dependent options when a creation modal opens.
  useEffect(() => {
    if (!org || !showNewSale) return;
    let active = true;
    apiFetch("/sales/buyers/", {}, org).then((r) => (r.ok ? r.json() : [])).then((d) => active && setOptions((o) => ({ ...o, buyers: Array.isArray(d) ? d : [] })));
    apiFetch("/sales/inventory/", {}, org).then((r) => (r.ok ? r.json() : [])).then((d) => active && setOptions((o) => ({ ...o, listings: Array.isArray(d) ? d : [] })));
    return () => { active = false; };
  }, [org, showNewSale]);

  useEffect(() => {
    if (!org) return;
    if (showRecordVisit || showNewListing) {
      let active = true;
      apiFetch("/property/projects/", {}, org).then((r) => (r.ok ? r.json() : [])).then((d) => active && setOptions((o) => ({ ...o, projects: Array.isArray(d) ? d : [] })));
      return () => { active = false; };
    }
  }, [org, showRecordVisit, showNewListing]);

  useEffect(() => {
    if (!org || !showNewListing) return;
    let active = true;
    apiFetch("/property/units/", {}, org).then((r) => (r.ok ? r.json() : [])).then((d) => active && setOptions((o) => ({ ...o, units: Array.isArray(d) ? d : [] })));
    return () => { active = false; };
  }, [org, showNewListing]);

  const selectTab = (id: string) => {
    setSearch("");
    setStatus("");
    setRows([]);
    setTab(id as SalesTab);
  };

  async function submitRegisterBuyer(payload: Record<string, string>) {
    await apiFetch("/auth/csrf/");
    const res = await apiFetch("/sales/buyers/", {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify(payload),
    }, org);
    if (res.ok) {
      setShowRegisterBuyer(false);
      setFormError("");
      setTab("buyers");
      loadData();
    } else {
      setFormError(await readError(res));
    }
  }

  async function submitNewSale(payload: Record<string, string>) {
    await apiFetch("/auth/csrf/");
    const res = await apiFetch("/sales/sales/", {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify(payload),
    }, org);
    if (res.ok) {
      setShowNewSale(false);
      setFormError("");
      setTab("sales");
      loadData();
    } else {
      setFormError(await readError(res));
    }
  }

  async function submitRecordVisit(payload: Record<string, string>) {
    await apiFetch("/auth/csrf/");
    const res = await apiFetch("/sales/site-visits/", {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify(payload),
    }, org);
    if (res.ok) {
      setShowRecordVisit(false);
      setFormError("");
      setTab("site-visits");
      loadData();
    } else {
      setFormError(await readError(res));
    }
  }

  async function submitNewListing(payload: Record<string, string>) {
    await apiFetch("/auth/csrf/");
    const res = await apiFetch("/sales/inventory/", {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify(payload),
    }, org);
    if (res.ok) {
      setShowNewListing(false);
      setFormError("");
      setTab("inventory");
      loadData();
    } else {
      setFormError(await readError(res));
    }
  }

  async function submitPaymentAction(payload: { action: "verify" | "reject" | "reverse"; reason?: string }) {
    if (!paymentAction) return;
    const endpoint = payload.action === "verify" ? "verify" : payload.action === "reject" ? "reject" : "reverse";
    await apiFetch("/auth/csrf/");
    const res = await apiFetch(`/sales/payments/${paymentAction.id}/${endpoint}/`, {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: payload.action === "verify" ? "{}" : JSON.stringify({ reason: payload.reason ?? "" }),
    }, org);
    if (res.ok) {
      setPaymentAction(null);
      setFormError("");
      loadData();
    } else {
      setFormError(await readError(res));
    }
  }

  async function submitTransitionSale(payload: { status: string; notes?: string }) {
    if (!transitionSaleRow) return;
    await apiFetch("/auth/csrf/");
    const res = await apiFetch(`/sales/sales/${transitionSaleRow.id}/transition/`, {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify(payload),
    }, org);
    if (res.ok) {
      setTransitionSaleRow(null);
      setFormError("");
      loadData();
    } else {
      setFormError(await readError(res));
    }
  }

  async function submitTransitionBuyer(payload: { status: string; notes?: string }) {
    if (!transitionBuyerRow) return;
    await apiFetch("/auth/csrf/");
    const res = await apiFetch(`/sales/buyers/${transitionBuyerRow.id}/transition/`, {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify({ status: payload.status }),
    }, org);
    if (res.ok) {
      setTransitionBuyerRow(null);
      setFormError("");
      loadData();
    } else {
      setFormError(await readError(res));
    }
  }

  async function quickTransitionBuyer(row: Row, targetStatus: string) {
    await apiFetch("/auth/csrf/");
    const res = await apiFetch(`/sales/buyers/${row.id}/transition/`, {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify({ status: targetStatus }),
    }, org);
    if (res.ok) {
      loadData();
    } else {
      setError(await readError(res));
    }
  }

  async function runCommissionAction(row: Row, action: string) {
    await apiFetch("/auth/csrf/");
    let body = "{}";
    if (action === "hold") {
      const reason = window.prompt("Reason for holding this commission:");
      if (!reason) return;
      body = JSON.stringify({ reason });
    }
    const res = await apiFetch(`/sales/commissions/${row.id}/${action}/`, {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body,
    }, org);
    if (res.ok) {
      loadData();
    } else {
      setError(await readError(res));
    }
  }

  async function exportReport(key: string, name: string) {
    const res = await apiFetch(`/sales/analytics/exports/${key}/`, {}, org);
    if (!res.ok) {
      setError("Report export failed.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales-${key}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setRecentExports((prev) => [{ key, name, exportedAt: new Date().toISOString() }, ...prev].slice(0, 8));
  }

  const openBuyerRegistration = () => { setFormError(""); setShowRegisterBuyer(true); };
  const openNewSaleModal = () => { setFormError(""); setShowNewSale(true); };
  const openRecordVisitModal = () => { setFormError(""); setShowRecordVisit(true); };
  const openNewListingModal = () => { setFormError(""); setShowNewListing(true); };
  const openPaymentAction = (row: Row) => { setFormError(""); setPaymentAction(row); };
  const openTransitionSale = (row: Row) => { setFormError(""); setTransitionSaleRow(row); };
  const openTransitionBuyer = (row: Row) => { setFormError(""); setTransitionBuyerRow(row); };

  const saleOptions = SALE_TRANSITIONS[String(transitionSaleRow?.status ?? "")] ?? [];
  const buyerOptions = BUYER_TRANSITIONS[String(transitionBuyerRow?.status ?? "")] ?? [];

  return (
    <ModuleShell
      moduleKey="sales"
      moduleName="Sales Management"
      eyebrow="Sales & Marketing Workspace"
      title="Sales Management"
      subtitle="Multi-project unit sales, buyer onboarding, payments, site visits & commissions."
      accent="#ea580c"
      activeId={tab}
      onSelect={selectTab}
      actions={
        <div className="row">
          <button className="btn primary sm" onClick={openBuyerRegistration}>+ Register Buyer</button>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {error && <ErrorBanner message={error} onRetry={loadData} />}

        {loading ? (
          <LoadingState rows={5} />
        ) : tab === "overview" && dashboard ? (
          <OverviewView
            dashboard={dashboard}
            setTab={setTab}
            openRegisterBuyer={openBuyerRegistration}
            openNewSale={openNewSaleModal}
            openRecordVisit={openRecordVisitModal}
          />
        ) : tab === "inventory" ? (
          <InventoryView rows={rows} search={search} setSearch={setSearch} status={status} setStatus={setStatus} canSell={canSell} openNewListing={openNewListingModal} />
        ) : tab === "buyers" ? (
          <BuyersView rows={rows} search={search} setSearch={setSearch} status={status} setStatus={setStatus} openRegisterBuyer={openBuyerRegistration} transitionBuyer={openTransitionBuyer} org={org} />
        ) : tab === "leads" ? (
          <LeadsView rows={rows} search={search} setSearch={setSearch} status={status} setStatus={setStatus} openRegisterBuyer={openBuyerRegistration} quickTransition={quickTransitionBuyer} />
        ) : tab === "sales" ? (
          <SalesView rows={rows} search={search} setSearch={setSearch} status={status} setStatus={setStatus} canSell={canSell} openNewSale={openNewSaleModal} transitionSale={openTransitionSale} />
        ) : tab === "site-visits" ? (
          <SiteVisitsView rows={rows} search={search} setSearch={setSearch} canVisit={canVisit} openRecordVisit={openRecordVisitModal} />
        ) : tab === "installments" ? (
          <InstallmentsView rows={rows} search={search} setSearch={setSearch} status={status} setStatus={setStatus} />
        ) : tab === "payments" ? (
          <PaymentsView rows={rows} search={search} setSearch={setSearch} status={status} setStatus={setStatus} openPaymentAction={openPaymentAction} />
        ) : tab === "commissions" ? (
          <CommissionsView rows={rows} search={search} setSearch={setSearch} status={status} setStatus={setStatus} runCommissionAction={runCommissionAction} />
        ) : tab === "performance" && dashboard ? (
          <PerformanceView dashboard={dashboard} />
        ) : tab === "reports" ? (
          <ReportsView rows={rows} recentExports={recentExports} exportReport={exportReport} />
        ) : tab === "documents" ? (
          <DocumentsView rows={rows} search={search} setSearch={setSearch} />
        ) : tab === "handover" ? (
          <HandoverView rows={rows} search={search} setSearch={setSearch} />
        ) : tab === "audit-events" ? (
          <AuditEventsView rows={rows} search={search} setSearch={setSearch} />
        ) : tab === "bank-reconciliation" ? (
          <BankReconciliationView rows={rows} search={search} setSearch={setSearch} org={org} />
        ) : (
          <EmptyState icon="📋" title={labels[tab]} description="No data available for this scope yet." />
        )}
      </div>

      {/* Modals */}
      <RegisterBuyerModal open={showRegisterBuyer} onClose={() => setShowRegisterBuyer(false)} onSubmit={submitRegisterBuyer} error={formError} />
      <NewSaleModal open={showNewSale} onClose={() => setShowNewSale(false)} onSubmit={submitNewSale} error={formError} buyers={options.buyers} listings={options.listings} />
      <RecordVisitModal open={showRecordVisit} onClose={() => setShowRecordVisit(false)} onSubmit={submitRecordVisit} error={formError} projects={options.projects} />
      <NewListingModal open={showNewListing} onClose={() => setShowNewListing(false)} onSubmit={submitNewListing} error={formError} projects={options.projects} units={options.units} />
      <PaymentActionModal payment={paymentAction} onClose={() => setPaymentAction(null)} onAction={submitPaymentAction} error={formError} />
      <TransitionModal title="Transition Sale Status" row={transitionSaleRow} options={saleOptions} onClose={() => setTransitionSaleRow(null)} onSubmit={submitTransitionSale} error={formError} />
      <TransitionModal title="Transition Buyer Status" row={transitionBuyerRow} options={buyerOptions} onClose={() => setTransitionBuyerRow(null)} onSubmit={submitTransitionBuyer} error={formError} />
    </ModuleShell>
  );
}
