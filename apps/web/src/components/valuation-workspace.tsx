"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import { useAuth } from "@/components/auth-provider";
import { ModuleShell } from "@/components/module-shell";
import { apiFetch, csrfFromCookie } from "@/lib/api";
import { valuationNav } from "@/lib/module-nav";
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
  Panel,
  SearchInput,
  StatusPill,
  money,
  number,
} from "@/components/module-ui";

export type ValuationTab =
  | "overview"
  | "instructions"
  | "inspections"
  | "comparables"
  | "draft-reports"
  | "final-reports"
  | "invoices"
  | "payments"
  | "clients"
  | "analytics"
  | "reports"
  | "audit-events";

const labels: Record<ValuationTab, string> = {
  overview: "Overview",
  instructions: "Valuation Instructions",
  inspections: "Site Inspections",
  comparables: "Comparable Evidence",
  "draft-reports": "Draft Reports",
  "final-reports": "Final Reports",
  invoices: "Client Invoicing",
  payments: "Fee Collections",
  clients: "Clients & Lenders",
  analytics: "Analytics",
  reports: "Reports Catalogue",
  "audit-events": "Audit Trail",
};

type Row = Record<string, unknown>;
type Dashboard = {
  kpis?: Record<string, unknown>;
  recentInstructions?: Row[];
  upcomingInspections?: Row[];
  pipeline?: { status: string; count: number }[];
  valuationMix?: { valuation_type: string; count: number }[];
};
type Analytics = {
  teamPerformance?: Row[];
  aging?: { overdueInvoices?: number; overdueBalance?: string | number };
  reports?: Row[];
};
type Tone = "green" | "red" | "yellow" | "blue" | "cyan" | "purple" | "gray";

const PALETTE = ["#0891b2", "#6366f1", "#f59e0b", "#16a34a", "#dc2626", "#8b5cf6", "#0ea5e9", "#eab308"];
const EMPTY_ROWS: Row[] = [];
const EMPTY_PIPELINE: { status: string; count: number }[] = [];
const EMPTY_MIX: { valuation_type: string; count: number }[] = [];

/* ───────────────────────── shared helpers ───────────────────────── */

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
  return (
    d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) +
    " " +
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  );
}

function fmtMoney(v: unknown): string {
  return money.format(Number(v ?? 0));
}

function strOrNull(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  return String(v);
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

function RefText({ value }: { value: unknown }) {
  return <span className="mono" style={{ color: "var(--primary)", fontSize: 11, fontWeight: 700 }}>{String(value ?? "—")}</span>;
}

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

function TableChrome({ search, setSearch, placeholder, chips, actions, children }: {
  search: string;
  setSearch: (v: string) => void;
  placeholder: string;
  chips?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <div className="fc-table-toolbar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: "12px 14px" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <SearchInput value={search} onChange={setSearch} placeholder={placeholder} />
          {chips}
        </div>
        <div>{actions}</div>
      </div>
      {children}
    </>
  );
}

function FilterChips({ options, value, onChange }: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
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

function BarChart({ data, color = "#0891b2", height = 130 }: { data: { label: string; value: number }[]; color?: string; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height, paddingTop: 8 }}>
      {data.map((d) => (
        <div key={d.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end", minWidth: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)" }}>{d.value}</span>
          <div style={{ width: "100%", maxWidth: 46, background: d.value ? color : "var(--border)", borderRadius: "4px 4px 0 0", height: `${Math.max(3, (d.value / max) * (height - 46))}px`, opacity: d.value ? 1 : 0.4 }} />
          <span style={{ fontSize: 10, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function Donut({ segments, center }: { segments: { label: string; color: string; value: number }[]; center: ReactNode }) {
  const shown = segments.filter((s) => s.value > 0);
  const total = Math.max(1, shown.reduce((acc, s) => acc + s.value, 0));
  const parts = shown.map((s, index) => {
    const fromPct = (shown.slice(0, index).reduce((acc, x) => acc + x.value, 0) / total) * 100;
    const toPct = fromPct + (s.value / total) * 100;
    return `${s.color} ${fromPct.toFixed(2)}% ${toPct.toFixed(2)}%`;
  });
  const grad = parts.length ? `conic-gradient(${parts.join(", ")})` : "conic-gradient(#edf0f5 0% 100%)";
  return (
    <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
      <div style={{ width: 118, height: 118, borderRadius: "50%", background: grad, display: "grid", placeItems: "center", flexShrink: 0 }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "white", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>{center}</div>
      </div>
      <div style={{ display: "grid", gap: 7, minWidth: 120, flex: 1 }}>
        {shown.length ? shown.map((s) => (
          <span key={s.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--muted)" }}>
            <i style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, display: "inline-block", flexShrink: 0 }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>
            <b style={{ marginLeft: "auto", color: "var(--text)" }}>{s.value}</b>
          </span>
        )) : <span className="muted" style={{ fontSize: 12 }}>No data yet</span>}
      </div>
    </div>
  );
}

function StatBlock({ label, value, delta }: { label: string; value: ReactNode; delta?: ReactNode }) {
  return (
    <div style={{ padding: "12px 14px", background: "var(--surface-2)", borderRadius: 10, border: "1px solid var(--border)" }}>
      <span className="muted" style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      <div style={{ fontSize: 19, fontWeight: 800, marginTop: 4 }}>{value}</div>
      {delta ? <span className="muted" style={{ fontSize: 10 }}>{delta}</span> : null}
    </div>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface-2)",
  color: "var(--text)",
  fontSize: 13,
};

/* ───────────────────────── instruction helpers ───────────────────────── */

const IN_PROGRESS = ["assigned", "inspection", "drafting", "review"];
const COMPLETED = ["final", "delivered"];

function instructionTone(status: string): Tone {
  const s = String(status ?? "").toLowerCase();
  if (s === "cancelled") return "red";
  if (s === "new") return "blue";
  if (s === "assigned") return "purple";
  if (s === "inspection") return "cyan";
  if (s === "drafting" || s === "review") return "yellow";
  if (COMPLETED.includes(s)) return "green";
  return "gray";
}

function isOverdueInstruction(r: Row): boolean {
  if (COMPLETED.includes(String(r.status)) || String(r.status) === "cancelled") return false;
  const due = new Date(String(r.due_on ?? ""));
  return !Number.isNaN(due.getTime()) && due.getTime() < new Date().getTime();
}

function instructionStatus(r: Row): { label: string; tone: Tone } {
  if (isOverdueInstruction(r)) return { label: "Overdue", tone: "red" };
  return { label: String(r.status ?? "—").replace(/_/g, " "), tone: instructionTone(String(r.status ?? "")) };
}

function PriorityBadge({ value }: { value: unknown }) {
  const p = String(value ?? "normal");
  const tone = p === "urgent" ? "red" : p === "high" ? "orange" : p === "normal" ? "gray" : "gray";
  return <Badge value={p} tone={tone} />;
}

function draftTone(status: string): Tone {
  if (status === "approved") return "green";
  if (status === "changes") return "red";
  if (status === "review") return "yellow";
  return "yellow";
}

function invoiceTone(status: string): Tone {
  const s = String(status ?? "");
  if (s === "paid") return "green";
  if (s === "overdue" || s === "void") return "red";
  if (s === "partial" || s === "draft") return "yellow";
  if (s === "issued") return "blue";
  return "gray";
}

function INSTRUCTION_NEXT(row: Row): { value: string; label: string }[] {
  const s = String(row.status ?? "");
  const map: Record<string, { value: string; label: string }[]> = {
    new: [{ value: "assigned", label: "Assign valuer" }],
    assigned: [{ value: "inspection", label: "Start inspection phase" }],
    inspection: [{ value: "drafting", label: "Move to drafting" }],
    drafting: [{ value: "review", label: "Submit for review" }],
  };
  return map[s] ?? [];
}

function InstructionTimeline({ status }: { status: string }) {
  const steps = ["new", "assigned", "inspection", "drafting", "review", "final", "delivered"];
  const current = steps.indexOf(String(status));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, margin: "16px 0 20px" }}>
      {steps.map((s, i) => (
        <Fragment key={s}>
          {i > 0 ? <div style={{ flex: 1, height: 3, background: current >= i ? "#0891b2" : "var(--border)", borderRadius: 2, minWidth: 4 }} /> : null}
          <div
            title={s}
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              fontSize: 10,
              fontWeight: 800,
              color: current >= i ? "white" : "var(--muted)",
              background: current >= i ? "#0891b2" : "var(--border)",
              flexShrink: 0,
            }}
          >
            {current > i ? "✓" : i + 1}
          </div>
        </Fragment>
      ))}
    </div>
  );
}

function DonutSegments(recent: Row[], key: string, fallback: string): { label: string; color: string; value: number }[] {
  const map: Record<string, number> = {};
  for (const r of recent) {
    const name = String(r[key] ?? fallback);
    map[name] = (map[name] ?? 0) + 1;
  }
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value], i) => ({ label, value, color: PALETTE[i % PALETTE.length] }));
}

/* ───────────────────────── overview ───────────────────────── */

function OverviewView({ dashboard, setTab, openNewInstruction }: {
  dashboard: Dashboard | null;
  setTab: (t: ValuationTab) => void;
  openNewInstruction: () => void;
}) {
  const kpis = dashboard?.kpis ?? {};
  const recent = dashboard?.recentInstructions ?? EMPTY_ROWS;
  const inspections = dashboard?.upcomingInspections ?? EMPTY_ROWS;
  const pipeline = dashboard?.pipeline ?? EMPTY_PIPELINE;
  const mix = dashboard?.valuationMix ?? EMPTY_MIX;

  const totalInstructions = pipeline.reduce((acc, p) => acc + Number(p.count ?? 0), 0);
  const inProgress = pipeline.filter((p) => IN_PROGRESS.includes(String(p.status))).reduce((acc, p) => acc + Number(p.count ?? 0), 0);
  const completed = pipeline.filter((p) => COMPLETED.includes(String(p.status))).reduce((acc, p) => acc + Number(p.count ?? 0), 0);
  const overdueCount = recent.filter(isOverdueInstruction).length;
  const draftReports = Number(kpis.draftsInReview ?? 0);
  const finalReports = Number(kpis.finalReports ?? 0);
  const turnaround = totalInstructions ? Math.round((completed / totalInstructions) * 100) : 0;
  const outstanding = Number(kpis.outstanding ?? 0);
  const revenue = Number(kpis.revenue ?? 0);

  const months = useMemo(() => {
    const now = new Date();
    const bucket: { label: string; value: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      bucket.push({ label: d.toLocaleDateString("en-GB", { month: "short" }), value: 0 });
    }
    for (const r of recent) {
      const v = new Date(String(r.instructed_on ?? ""));
      if (Number.isNaN(v.getTime())) continue;
      const idx = (now.getFullYear() - v.getFullYear()) * 12 + (now.getMonth() - v.getMonth());
      if (idx >= 0 && idx < bucket.length) bucket[5 - idx].value += 1;
    }
    return bucket;
  }, [recent]);

  const bankDonut = useMemo(() => DonutSegments(recent, "client_name", "Unassigned client"), [recent]);

  const feed = useMemo(() => {
    const items: { at: string; icon: string; text: string }[] = [];
    for (const r of recent) items.push({ at: String(r.instructed_on ?? ""), icon: "📐", text: `New instruction received · ${String(r.reference ?? "—")} — ${String(r.client_name ?? "—")}` });
    for (const i of inspections) items.push({ at: String(i.scheduled_at ?? ""), icon: "📍", text: `Inspection scheduled · ${String(i.reference ?? "—")} for ${String(i.property_description ?? "—")}` });
    return items.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 6);
  }, [recent, inspections]);

  const typeMix = useMemo(() => mix.map((m, i) => ({ label: String(m.valuation_type ?? "—"), value: Number(m.count ?? 0), color: PALETTE[i % PALETTE.length] })), [mix]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <KpiStrip cols={8}>
        <KpiCard icon="📐" iconBg="#e0e7ff" iconColor="#4f46e5" label="Total Instructions" value={number.format(totalInstructions || Number(kpis.activeInstructions ?? 0))} sub="Across the pipeline" link="View instructions" onClick={() => setTab("instructions")} />
        <KpiCard icon="⚙️" iconBg="#dbeafe" iconColor="#2563eb" label="In Progress" value={number.format(inProgress)} sub={`${Number(kpis.dueThisWeek ?? 0)} due this week`} link="View queue" onClick={() => setTab("instructions")} />
        <KpiCard icon="✅" iconBg="#dcfce7" iconColor="#16a34a" label="Completed" value={number.format(completed)} sub="Delivered or finalised" onClick={() => setTab("instructions")} />
        <KpiCard icon="📝" iconBg="#fef3c7" iconColor="#92400e" label="Draft Reports" value={number.format(draftReports)} sub="Awaiting review" link="Review drafts" onClick={() => setTab("draft-reports")} />
        <KpiCard icon="📄" iconBg="#cffafe" iconColor="#0e7490" label="Final Reports" value={number.format(finalReports)} sub="Signed & issued" link="View reports" onClick={() => setTab("final-reports")} />
        <KpiCard icon="⏰" iconBg="#fee2e2" iconColor="#b91c1c" label="Overdue" value={number.format(overdueCount)} sub="Past target date" onClick={() => setTab("instructions")} />
        <KpiCard icon="📈" iconBg="#e0e7ff" iconColor="#6d28d9" label="Turnaround" value={`${turnaround}%`} sub="Completed on time" onClick={() => setTab("analytics")} />
        <KpiCard icon="💰" iconBg="#fff7ed" iconColor="#ea580c" label="Fees" value={fmtMoney(outstanding)} sub={`${fmtMoney(revenue)} collected YTD`} link="View invoicing" onClick={() => setTab("invoices")} />
      </KpiStrip>

      <div className="grid-2" style={{ gridTemplateColumns: "minmax(0, 1.55fr) minmax(0, 1fr)", alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="grid-2" style={{ alignItems: "start" }}>
            <Panel title="Instructions Trend">
              {months.some((m) => m.value > 0) ? (
                <BarChart data={months} height={140} />
              ) : (
                <EmptyState icon="📈" title="No trend yet" description="Monthly instruction intake will appear here once instructions are instructed." />
              )}
            </Panel>
            <Panel title="Volume of Work by Bank">
              {bankDonut.length ? (
                <Donut segments={bankDonut} center={<><strong style={{ fontSize: 18 }}>{recent.length}</strong><small className="muted" style={{ fontSize: 10 }}>Recent</small></>} />
              ) : (
                <EmptyState icon="🏦" title="No bank volume" description="Instruction mix by bank/lender will appear once instructions are recorded." />
              )}
            </Panel>
          </div>

          <Panel
            title="Recent Valuation Instructions"
            badge={recent.length}
            action={<button className="btn ghost sm" onClick={() => setTab("instructions")}>View all →</button>}
          >
            {recent.length ? (
              <DataTable headers={["Instruction No", "Bank / Client", "Property", "Type", "Instructed On", "Target", "Status", "Valuer"]}>
                {recent.map((r) => {
                  const st = instructionStatus(r);
                  return (
                    <tr key={String(r.id ?? r.reference)}>
                      <td><RefText value={r.reference} /></td>
                      <td><strong style={{ fontSize: 12 }}>{String(r.client_name ?? "—")}</strong></td>
                      <td style={{ fontSize: 12 }}>{String(r.property_description ?? "—")}</td>
                      <td style={{ fontSize: 12 }}>{String(r.valuation_type ?? "—")}</td>
                      <td style={{ fontSize: 12 }}>{fmtDate(r.instructed_on)}</td>
                      <td style={{ fontSize: 12 }}>{fmtDate(r.due_on)}</td>
                      <td><StatusPill value={st.label} tone={st.tone} /></td>
                      <td style={{ fontSize: 12 }}>{String(r.valuer_name || "—")}</td>
                    </tr>
                  );
                })}
              </DataTable>
            ) : (
              <EmptyState icon="📋" title="No instructions recorded" description="Create the first valuation instruction to seed the register." action={<button className="btn primary sm" onClick={openNewInstruction}>+ New Instruction</button>} />
            )}
          </Panel>

          <Panel title="Type Mix (YTD)">
            {typeMix.length ? (
              <BarChart data={typeMix.map((t) => ({ label: t.label, value: t.value }))} height={120} />
            ) : (
              <EmptyState icon="🧩" title="No type data" description="Instructions by valuation type will appear here as the pipeline grows." />
            )}
          </Panel>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Panel title="Recent Activity">
            {feed.length ? (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {feed.map((f, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 14px", borderBottom: "1px solid var(--border)", fontSize: 12 }}>
                    <span style={{ fontSize: 15 }}>{f.icon}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600 }}>{f.text}</div>
                      <span className="muted" style={{ fontSize: 11 }}>{f.at ? fmtDate(f.at) : "—"}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon="🕘" title="No activity yet" description="Instruction and inspection events will stream into this feed." />
            )}
          </Panel>

          <Panel title="Key Performance Indicators (YTD)">
            <div className="grid-2" style={{ gap: 10 }}>
              <StatBlock label="Instructions" value={number.format(totalInstructions || Number(kpis.activeInstructions ?? 0))} delta="vs last year" />
              <StatBlock label="Completed" value={number.format(completed)} delta={`${turnaround}% on time`} />
              <StatBlock label="Final Reports" value={number.format(finalReports)} delta="Signed & issued" />
              <StatBlock label="Fees YTD" value={fmtMoney(revenue)} delta={`${fmtMoney(outstanding)} outstanding`} />
            </div>
          </Panel>

        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── instructions ───────────────────────── */

function InstructionsView({ rows, search, setSearch, status, setStatus, canCoordinate, onTransition, setShowAddModal, setTab }: {
  rows: Row[];
  search: string;
  setSearch: (v: string) => void;
  status: string;
  setStatus: (v: string) => void;
  canCoordinate: boolean;
  onTransition: (row: Row, target: string) => Promise<boolean>;
  setShowAddModal: () => void;
  setTab: (t: ValuationTab) => void;
}) {
  const [selected, setSelected] = useState<Row | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const dateFiltered = useMemo(() => {
    return rows.filter((r) => {
      if (dateFrom && String(r.instructed_on ?? "").slice(0, 10) < dateFrom) return false;
      if (dateTo && String(r.instructed_on ?? "").slice(0, 10) > dateTo) return false;
      return true;
    });
  }, [rows, dateFrom, dateTo]);

  const inProgress = dateFiltered.filter((r) => IN_PROGRESS.includes(String(r.status))).length;
  const completed = dateFiltered.filter((r) => COMPLETED.includes(String(r.status))).length;
  const overdue = dateFiltered.filter(isOverdueInstruction).length;
  const filtered = useMemo(() => {
    if (!status) return dateFiltered;
    if (status === "new") return dateFiltered.filter((r) => String(r.status) === "new");
    if (status === "in-progress") return dateFiltered.filter((r) => IN_PROGRESS.includes(String(r.status)));
    if (status === "drafting") return dateFiltered.filter((r) => ["drafting", "review"].includes(String(r.status)));
    if (status === "completed") return dateFiltered.filter((r) => COMPLETED.includes(String(r.status)));
    if (status === "overdue") return dateFiltered.filter(isOverdueInstruction);
    return dateFiltered;
  }, [dateFiltered, status]);

  const overdueList = useMemo(() => rows.filter(isOverdueInstruction), [rows]);
  const upcomingList = useMemo(
    () =>
      rows
        .filter((r) => !COMPLETED.includes(String(r.status)) && String(r.status) !== "cancelled" && !isOverdueInstruction(r))
        .sort((a, b) => String(a.due_on).localeCompare(String(b.due_on)))
        .slice(0, 4),
    [rows],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <KpiStrip cols={5}>
        <KpiCard icon="📐" iconBg="#e0e7ff" iconColor="#4f46e5" label="All Instructions" value={number.format(rows.length)} sub="Total register" onClick={() => setStatus("")} />
        <KpiCard icon="⚙️" iconBg="#dbeafe" iconColor="#2563eb" label="In Progress" value={number.format(inProgress)} sub="Assigned to drafting" onClick={() => setStatus(status === "in-progress" ? "" : "in-progress")} />
        <KpiCard icon="✅" iconBg="#dcfce7" iconColor="#16a34a" label="Completed" value={number.format(completed)} sub="Final or delivered" onClick={() => setStatus(status === "completed" ? "" : "completed")} />
        <KpiCard icon="📝" iconBg="#fef3c7" iconColor="#92400e" label="Draft / Review" value={number.format(rows.filter((r) => ["drafting", "review"].includes(String(r.status))).length)} sub="In report preparation" onClick={() => setStatus(status === "drafting" ? "" : "drafting")} />
        <KpiCard icon="⏰" iconBg="#fee2e2" iconColor="#b91c1c" label="Overdue" value={number.format(overdue)} sub="Past target date" onClick={() => setStatus(status === "overdue" ? "" : "overdue")} />
      </KpiStrip>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 240px", gap: 20, alignItems: "start" }}>
        <Panel title="Valuation Instructions" badge={filtered.length}>
          <TableChrome
            search={search}
            setSearch={setSearch}
            placeholder="Search instruction no., client, property, type…"
            chips={
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <FilterChips options={[
                  { value: "", label: "All" },
                  { value: "new", label: "New" },
                  { value: "in-progress", label: "In Progress" },
                  { value: "drafting", label: "Draft / Review" },
                  { value: "completed", label: "Completed" },
                  { value: "overdue", label: "Overdue" },
                ]} value={status} onChange={setStatus} />
                <div style={{ display: "flex", gap: 6, alignItems: "center", marginLeft: 4 }}>
                  <label style={{ fontSize: 11, color: "var(--muted)" }}>From</label>
                  <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 12 }} />
                  <label style={{ fontSize: 11, color: "var(--muted)" }}>To</label>
                  <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 12 }} />
                </div>
              </div>
            }
          >
            {filtered.length === 0 ? (
              <EmptyState icon="📋" title="No instructions found" description={search ? "No instructions match the current search or status filter." : "Create a new valuation instruction to start the pipeline."} />
            ) : (
              <DataTable headers={["Instruction No", "Bank / Client", "Property", "Type", "Purpose", "Instructed", "Due", "Fee", "Priority", "Status", "Valuer", "Actions"]}>
                {filtered.map((r) => {
                  const st = instructionStatus(r);
                  return (
                    <tr key={String(r.id ?? r.reference)}>
                      <td><RefText value={r.reference} /></td>
                      <td><strong style={{ fontSize: 12 }}>{String(r.client_name ?? "—")}</strong></td>
                      <td style={{ fontSize: 12, maxWidth: 180 }}>{String(r.property_description ?? "—")}</td>
                      <td style={{ fontSize: 12 }}>{String(r.valuation_type ?? "—")}</td>
                      <td style={{ fontSize: 12 }}>{String(r.purpose ?? "—")}</td>
                      <td style={{ fontSize: 12 }}>{fmtDate(r.instructed_on)}</td>
                      <td style={{ fontSize: 12 }}>{fmtDate(r.due_on)}</td>
                      <td className="mono" style={{ fontSize: 12 }}>{fmtMoney(r.quoted_fee)}</td>
                      <td><PriorityBadge value={r.priority} /></td>
                      <td><StatusPill value={st.label} tone={st.tone} /></td>
                      <td style={{ fontSize: 12 }}>{String(r.valuer_name || "—")}</td>
                      <td>
                        <button className="btn ghost sm" onClick={() => setSelected(r)}>Details</button>
                      </td>
                    </tr>
                  );
                })}
              </DataTable>
            )}
          </TableChrome>
        </Panel>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          <Panel title="Overdue Instructions" badge={overdueList.length}>
            {overdueList.length ? (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {overdueList.slice(0, 5).map((r) => (
                  <button key={String(r.id ?? r.reference)} onClick={() => setSelected(r)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid var(--border)", background: "none", borderLeft: 0, borderRight: 0, borderTop: 0, cursor: "pointer", textAlign: "left", width: "100%" }}>
                    <div style={{ minWidth: 0 }}>
                      <RefText value={r.reference} />
                      <div style={{ fontSize: 12, marginTop: 2 }}>{String(r.property_description ?? "—")}</div>
                    </div>
                    <StatusPill value="Overdue" tone="red" />
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState icon="✅" title="Nothing overdue" description="All active instructions are on track." />
            )}
          </Panel>

          <Panel title="Upcoming Deadlines" badge={upcomingList.length}>
            {upcomingList.length ? (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {upcomingList.map((r) => (
                  <button key={String(r.id ?? r.reference)} onClick={() => setSelected(r)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid var(--border)", background: "none", borderLeft: 0, borderRight: 0, borderTop: 0, cursor: "pointer", textAlign: "left", width: "100%" }}>
                    <div style={{ minWidth: 0 }}>
                      <RefText value={r.reference} />
                      <div style={{ fontSize: 12, marginTop: 2 }}>{String(r.client_name ?? "—")}</div>
                    </div>
                    <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{fmtDate(r.due_on)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState icon="🗓️" title="No upcoming deadlines" description="Active instructions with future due dates will appear here." />
            )}
          </Panel>
        </div>
      </div>

      {selected && (
        <DetailDrawer title={<RefText value={selected.reference} />} onClose={() => setSelected(null)} width={400}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <StatusPill value={instructionStatus(selected).label} tone={instructionStatus(selected).tone} />
            <PriorityBadge value={selected.priority} />
          </div>
          <InstructionTimeline status={String(selected.status ?? "")} />
          <div className="grid-2" style={{ gap: 12 }}>
            <Field label="Bank / Client"><strong style={{ fontSize: 13 }}>{String(selected.client_name ?? "—")}</strong></Field>
            <Field label="Property"><span style={{ fontSize: 13 }}>{String(selected.property_description ?? "—")}</span></Field>
          </div>
          <div className="grid-2" style={{ gap: 12, marginTop: 12 }}>
            <Field label="Valuation Type"><span style={{ fontSize: 13 }}>{String(selected.valuation_type ?? "—")}</span></Field>
            <Field label="Purpose"><span style={{ fontSize: 13 }}>{String(selected.purpose ?? "—")}</span></Field>
          </div>
          <div className="grid-2" style={{ gap: 12, marginTop: 12 }}>
            <Field label="Instructed On"><span style={{ fontSize: 13 }}>{fmtDate(selected.instructed_on)}</span></Field>
            <Field label="Due On"><span style={{ fontSize: 13 }}>{fmtDate(selected.due_on)}</span></Field>
          </div>
          <div className="grid-2" style={{ gap: 12, marginTop: 12 }}>
            <Field label="Quoted Fee (KES)"><span className="mono" style={{ fontSize: 13 }}>{fmtMoney(selected.quoted_fee)}</span></Field>
            <Field label="Valuer"><span style={{ fontSize: 13 }}>{String(selected.valuer_name || "—")}</span></Field>
          </div>
          {canCoordinate && INSTRUCTION_NEXT(selected).length > 0 && (
            <div style={{ marginTop: 18, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)", margin: "0 0 10px" }}>Workflow Action</p>
              <div className="row">
                {INSTRUCTION_NEXT(selected).map((opt) => (
                  <button key={opt.value} className="btn primary sm" onClick={() => { void onTransition(selected, opt.value).then((ok) => { if (ok) setSelected(null); }); }}>
                    {opt.label} →
                  </button>
                ))}
              </div>
            </div>
          )}
        </DetailDrawer>
      )}
    </div>
  );
}

/* ───────────────────────── inspections ───────────────────────── */

function InspectionsView({ rows, search, setSearch, setShowAddModal }: {
  rows: Row[];
  search: string;
  setSearch: (v: string) => void;
  setShowAddModal: () => void;
}) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedInspection, setSelectedInspection] = useState<Row | null>(null);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (dateFrom && String(r.scheduled_at ?? "").slice(0, 10) < dateFrom) return false;
      if (dateTo && String(r.scheduled_at ?? "").slice(0, 10) > dateTo) return false;
      return true;
    });
  }, [rows, dateFrom, dateTo]);

  const total = filtered.length;
  const completed = filtered.filter((r) => String(r.status) === "completed").length;
  const inProgress = filtered.filter((r) => String(r.status) === "in_progress").length;
  const scheduled = filtered.filter((r) => ["scheduled", "rescheduled"].includes(String(r.status))).length;
  const overdue = filtered.filter((r) => {
    if (String(r.status) === "completed") return false;
    const at = new Date(String(r.scheduled_at ?? ""));
    return !Number.isNaN(at.getTime()) && at.getTime() < new Date().getTime();
  }).length;

  const overdueList = filtered.filter((r) => {
    if (String(r.status) === "completed") return false;
    const at = new Date(String(r.scheduled_at ?? ""));
    return !Number.isNaN(at.getTime()) && at.getTime() < new Date().getTime();
  });

  const now = new Date();
  const thisMonthRows = rows.filter((r) => {
    const d = new Date(String(r.scheduled_at ?? ""));
    return !Number.isNaN(d.getTime()) && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const monthCompleted = thisMonthRows.filter((r) => String(r.status) === "completed").length;
  const monthInProgress = thisMonthRows.filter((r) => String(r.status) === "in_progress").length;
  const monthScheduled = thisMonthRows.filter((r) => ["scheduled", "rescheduled"].includes(String(r.status))).length;
  const monthOverdue = thisMonthRows.filter((r) => {
    if (String(r.status) === "completed") return false;
    const at = new Date(String(r.scheduled_at ?? ""));
    return !Number.isNaN(at.getTime()) && at.getTime() < new Date().getTime();
  }).length;
  const monthMax = Math.max(1, monthCompleted, monthInProgress, monthScheduled, monthOverdue);
  const monthStatuses = [
    { label: "Completed", count: monthCompleted, color: "#16a34a" },
    { label: "In Progress", count: monthInProgress, color: "#2563eb" },
    { label: "Scheduled", count: monthScheduled, color: "#f59e0b" },
    { label: "Overdue", count: monthOverdue, color: "#dc2626" },
  ];

  const checklistItems = ["Property Access", "Building Exterior", "Interior Inspection", "Systems & Equipment", "Safety & Compliance"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <KpiStrip cols={5}>
        <KpiCard icon="📍" iconBg="#e0e7ff" iconColor="#4f46e5" label="Total Inspections" value={number.format(total)} sub="Across all instructions" />
        <KpiCard icon="✅" iconBg="#dcfce7" iconColor="#16a34a" label="Completed" value={number.format(completed)} sub="Evidence captured" />
        <KpiCard icon="⚙️" iconBg="#dbeafe" iconColor="#2563eb" label="In Progress" value={number.format(inProgress)} sub="Fieldwork underway" />
        <KpiCard icon="📅" iconBg="#fef3c7" iconColor="#92400e" label="Scheduled" value={number.format(scheduled)} sub="Upcoming visits" />
        <KpiCard icon="⏰" iconBg="#fee2e2" iconColor="#b91c1c" label="Overdue" value={number.format(overdue)} sub="Past schedule" />
      </KpiStrip>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 240px", gap: 20, alignItems: "start" }}>
        <Panel title="Site Inspections & Evidence" badge={filtered.length}>
          <TableChrome
            search={search}
            setSearch={setSearch}
            placeholder="Search inspection ref, instruction no., property…"
            chips={
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <label style={{ fontSize: 11, color: "var(--muted)" }}>From</label>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 12 }} />
                <label style={{ fontSize: 11, color: "var(--muted)" }}>To</label>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 12 }} />
              </div>
            }
          >
            {filtered.length === 0 ? (
              <EmptyState icon="📍" title="No inspections scheduled" description="Inspections created against instructions will appear here with schedule, status and evidence." />
            ) : (
              <DataTable headers={["Inspection Ref", "Instruction", "Property", "Location", "Inspector", "Inspection Date", "Status", "Evidence", "Actions"]}>
                {filtered.map((r) => {
                  const lat = String(r.latitude ?? "").trim();
                  const lng = String(r.longitude ?? "").trim();
                  const location = lat && lng ? `${lat}, ${lng}` : "—";
                  const evidence = Number(r.evidence_count ?? 0);
                  return (
                    <tr key={String(r.id ?? r.reference)}>
                      <td><RefText value={r.reference} /></td>
                      <td className="mono" style={{ fontSize: 12 }}>{String(r.instruction_reference ?? "—")}</td>
                      <td style={{ fontSize: 12, maxWidth: 180 }}>{String(r.property_description ?? "—")}</td>
                      <td style={{ fontSize: 12 }}>{location}</td>
                      <td style={{ fontSize: 12 }}>{String(r.inspector_name || "—")}</td>
                      <td style={{ fontSize: 12 }}>{fmtDateTime(r.scheduled_at)}</td>
                      <td><StatusPill value={strOrNull(r.status)} /></td>
                      <td>{String(r.status) === "completed" ? <Badge tone="green">{evidence}</Badge> : <span className="muted" style={{ fontSize: 12 }}>{evidence || "—"}</span>}</td>
                      <td><button className="btn ghost sm" onClick={() => setSelectedInspection(r)}>View</button></td>
                    </tr>
                  );
                })}
              </DataTable>
            )}
          </TableChrome>
        </Panel>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

          <Panel title="Status This Month">
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {monthStatuses.map((s) => (
                <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 80, fontSize: 12 }}>{s.label}</span>
                  <div style={{ flex: 1, height: 8, borderRadius: 4, background: "var(--surface-3, #e5e7eb)" }}>
                    <div style={{ height: "100%", borderRadius: 4, width: `${(s.count / monthMax) * 100}%`, background: s.color }} />
                  </div>
                  <span className="mono" style={{ fontSize: 11 }}>{s.count}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Overdue Inspections" badge={overdueList.length}>
            {overdueList.length ? (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {overdueList.slice(0, 4).map((r) => (
                  <button key={String(r.id ?? r.reference)} onClick={() => setSelectedInspection(r)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "8px 10px", borderBottom: "1px solid var(--border)", background: "none", borderLeft: 0, borderRight: 0, borderTop: 0, cursor: "pointer", textAlign: "left", width: "100%" }}>
                    <div style={{ minWidth: 0 }}>
                      <RefText value={r.reference} />
                      <div style={{ fontSize: 11, marginTop: 2 }}>{String(r.property_description ?? "—")}</div>
                    </div>
                    <span className="mono" style={{ fontSize: 10, color: "var(--muted)", whiteSpace: "nowrap" }}>{fmtDate(r.scheduled_at)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState icon="✅" title="No overdue" description="All inspections on time." />
            )}
          </Panel>
        </div>
      </div>

      {selectedInspection && (
        <DetailDrawer title={<><RefText value={selectedInspection.reference} /> <span className="muted" style={{ fontSize: 11 }}>({String(selectedInspection.instruction_reference ?? "—")})</span></>} onClose={() => setSelectedInspection(null)} width={420}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <Field label="Property"><span style={{ fontSize: 13 }}>{String(selectedInspection.property_description ?? "—")}</span></Field>
            <Field label="Location"><span style={{ fontSize: 13 }}>{(() => { const lat = String(selectedInspection.latitude ?? "").trim(); const lng = String(selectedInspection.longitude ?? "").trim(); return lat && lng ? `${lat}, ${lng}` : "—"; })()}</span></Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <Field label="Inspector"><span style={{ fontSize: 13 }}>{String(selectedInspection.inspector_name || "—")}</span></Field>
            <Field label="Date"><span style={{ fontSize: 13 }}>{fmtDateTime(selectedInspection.scheduled_at)}</span></Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <Field label="Status"><StatusPill value={strOrNull(selectedInspection.status)} /></Field>
            <Field label="Evidence Count"><span className="mono" style={{ fontSize: 13 }}>{Number(selectedInspection.evidence_count ?? 0)}</span></Field>
          </div>

          <div style={{ marginTop: 8, marginBottom: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)", margin: "0 0 8px" }}>Inspection Checklist</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {checklistItems.map((item) => {
                const checklist = selectedInspection.checklist as Record<string, boolean> | undefined;
                const checked = checklist ? Boolean(checklist[item]) : false;
                return (
                  <label key={item} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "default" }}>
                    <input type="checkbox" checked={checked} readOnly style={{ accentColor: "var(--primary)" }} />
                    {item}
                  </label>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <Field label="Findings">
              <textarea readOnly value={String(selectedInspection.findings ?? "")} rows={4} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13, resize: "vertical" }} />
            </Field>
          </div>

          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)", margin: "0 0 8px" }}>Photos & Documents</p>
            <div style={{ padding: "12px 14px", background: "var(--surface-2)", borderRadius: 8, border: "1px solid var(--border)", fontSize: 13 }}>
              {Number(selectedInspection.evidence_count ?? 0) > 0 ? (
                <span>{Number(selectedInspection.evidence_count ?? 0)} file(s) attached</span>
              ) : (
                <span className="muted">No photos or documents uploaded yet.</span>
              )}
            </div>
          </div>

          <button className="btn ghost" onClick={() => setSelectedInspection(null)} style={{ width: "100%", justifyContent: "center" }}>Close</button>
        </DetailDrawer>
      )}
    </div>
  );
}

/* ───────────────────────── comparables ───────────────────────── */

function ComparablesView({ rows, search, setSearch }: {
  rows: Row[];
  search: string;
  setSearch: (v: string) => void;
}) {
  return (
    <Panel title="Comparable Sales Evidence" badge={rows.length}>
      <TableChrome
        search={search}
        setSearch={setSearch}
        placeholder="Search comparable ref, address, type or source…"
      >
        {rows.length === 0 ? (
          <EmptyState icon="📊" title="No comparables recorded" description="Comparable sales evidence added to instructions will be listed here with rates and adjustments." />
        ) : (
          <DataTable headers={["Comparable Ref", "Instruction", "Property / Address", "Type", "Sale Price", "Area (m²)", "Rate/m²", "Sale Date", "Source", "Adjustment"]}>
            {rows.map((r) => {
              const adj = Number(r.adjustment_percent ?? 0);
              return (
                <tr key={String(r.id ?? r.reference)}>
                  <td><RefText value={r.reference} /></td>
                  <td className="mono" style={{ fontSize: 12 }}>{String(r.instruction_reference ?? "—")}</td>
                  <td style={{ fontSize: 12, maxWidth: 200 }}>{String(r.address ?? "—")}</td>
                  <td><Badge tone="purple">{String(r.property_type ?? "—")}</Badge></td>
                  <td className="mono" style={{ fontSize: 12 }}>{fmtMoney(r.transaction_price)}</td>
                  <td style={{ fontSize: 12 }}>{Number(r.area ?? 0).toLocaleString()}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{fmtMoney(r.rate_per_area)}</td>
                  <td style={{ fontSize: 12 }}>{fmtDate(r.transaction_date)}</td>
                  <td style={{ fontSize: 12 }}>{String(r.source ?? "—")}</td>
                  <td>{adj === 0 ? <Badge tone="gray">As-is</Badge> : <Badge tone="yellow">{adj}%</Badge>}</td>
                </tr>
              );
            })}
          </DataTable>
        )}
      </TableChrome>
    </Panel>
  );
}

/* ───────────────────────── draft reports ───────────────────────── */

function DraftReportsView({ rows, search, setSearch, canReview, openReview, setShowAddModal }: {
  rows: Row[];
  search: string;
  setSearch: (v: string) => void;
  canReview: boolean;
  openReview: (r: Row) => void;
  setShowAddModal: () => void;
}) {
  const inReview = rows.filter((r) => String(r.status) === "review").length;
  const approved = rows.filter((r) => String(r.status) === "approved").length;
  const changes = rows.filter((r) => String(r.status) === "changes").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <KpiStrip cols={4}>
        <KpiCard icon="📝" iconBg="#e0e7ff" iconColor="#4f46e5" label="Draft Reports" value={number.format(rows.length)} sub="All versions" />
        <KpiCard icon="👁️" iconBg="#fef3c7" iconColor="#92400e" label="In Review" value={number.format(inReview)} sub="Awaiting reviewer" />
        <KpiCard icon="✅" iconBg="#dcfce7" iconColor="#16a34a" label="Approved" value={number.format(approved)} sub="Ready to finalise" />
        <KpiCard icon="🔁" iconBg="#fee2e2" iconColor="#b91c1c" label="Changes Required" value={number.format(changes)} sub="Returned to valuer" />
      </KpiStrip>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 240px", gap: 20, alignItems: "start" }}>
        <Panel title="Draft Report Register" badge={rows.length}>
          <TableChrome
            search={search}
            setSearch={setSearch}
            placeholder="Search instruction no., property, method or template…"
          >
            {rows.length === 0 ? (
              <EmptyState icon="📝" title="No draft reports" description="Draft reports submitted for review will be tracked here with version and approval progress." />
            ) : (
              <DataTable headers={["Report Ref", "Instruction", "Property", "Valuer", "Draft Date", "Assessed Value", "Status", "Actions"]}>
                {rows.map((r) => {
                  const ref = `${String(r.instruction_reference ?? "—")}/v${String(r.version ?? "1")}`;
                  return (
                    <tr key={String(r.id)}>
                      <td><RefText value={ref} /></td>
                      <td className="mono" style={{ fontSize: 12 }}>{String(r.instruction_reference ?? "—")}</td>
                      <td style={{ fontSize: 12, maxWidth: 180 }}>{String(r.property_description ?? "—")}</td>
                      <td style={{ fontSize: 12 }}>{String(r.prepared_by_name || "—")}</td>
                      <td style={{ fontSize: 12 }}>{fmtDateTime(r.created_at)}</td>
                      <td className="mono" style={{ fontSize: 12 }}>{fmtMoney(r.assessed_value)}</td>
                      <td><StatusPill value={strOrNull(r.status)} tone={draftTone(String(r.status))} /></td>
                      <td>
                        {canReview && String(r.status) === "review" ? (
                          <button className="btn primary sm" onClick={() => openReview(r)}>Review</button>
                        ) : (
                          <button className="btn ghost sm" onClick={() => openReview(r)}>View</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </DataTable>
            )}
          </TableChrome>
        </Panel>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── final reports ───────────────────────── */

function FinalReportsView({ rows, search, setSearch, setTab }: {
  rows: Row[];
  search: string;
  setSearch: (v: string) => void;
  setTab: (t: ValuationTab) => void;
}) {
  const [selected, setSelected] = useState<Row | null>(null);

  const now = new Date();
  const thisMonthRows = rows.filter((r) => {
    const d = new Date(String(r.issued_on ?? ""));
    return !Number.isNaN(d.getTime()) && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const delivered = thisMonthRows.filter((r) => Boolean(r.delivered_at)).length;
  const issued = thisMonthRows.filter((r) => !Boolean(r.delivered_at)).length;
  const deliveryMax = Math.max(1, delivered, issued);
  const deliveryStatuses = [
    { label: "Delivered", count: delivered, color: "#16a34a" },
    { label: "Issued", count: issued, color: "#0891b2" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 240px", gap: 20, alignItems: "start" }}>
        <Panel title="Final Signed Reports" badge={rows.length}>
          <TableChrome
            search={search}
            setSearch={setSearch}
            placeholder="Search report no., instruction no., client or property…"
          >
            {rows.length === 0 ? (
              <EmptyState icon="📄" title="No final reports issued" description="Final reports signed from approved drafts will be listed here as immutable, checksummed records." />
            ) : (
              <DataTable headers={["Report No", "Instruction", "Property", "Client", "Issue Date", "Signed By", "Status", "Actions"]}>
                {rows.map((r) => {
                  const delivered = Boolean(r.delivered_at);
                  return (
                    <tr key={String(r.id ?? r.report_number)}>
                      <td><RefText value={r.report_number} /></td>
                      <td className="mono" style={{ fontSize: 12 }}>{String(r.instruction_reference ?? "—")}</td>
                      <td style={{ fontSize: 12, maxWidth: 180 }}>{String(r.property_description ?? "—")}</td>
                      <td style={{ fontSize: 12 }}>{String(r.client_name ?? "—")}</td>
                      <td style={{ fontSize: 12 }}>{fmtDate(r.issued_on)}</td>
                      <td style={{ fontSize: 12 }}>{String(r.signed_by ?? "—")}</td>
                      <td>{delivered ? <Badge tone="green">Delivered</Badge> : <Badge tone="cyan">Issued</Badge>}</td>
                      <td>
                        <button className="btn ghost sm" onClick={() => setSelected(r)}>View</button>
                      </td>
                    </tr>
                  );
                })}
              </DataTable>
            )}
          </TableChrome>

          {selected && (
            <DetailDrawer title={<RefText value={selected.report_number} />} onClose={() => setSelected(null)} width={400}>
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <StatusPill value={Boolean(selected.delivered_at) ? "Delivered" : "Issued"} tone={Boolean(selected.delivered_at) ? "green" : "cyan"} />
                <StatusPill value="Signed" tone="green" />
              </div>
              <Field label="Instruction No"><span className="mono" style={{ fontSize: 13 }}>{String(selected.instruction_reference ?? "—")}</span></Field>
              <div className="grid-2" style={{ gap: 12, marginTop: 12 }}>
                <Field label="Client / Bank"><span style={{ fontSize: 13 }}>{String(selected.client_name ?? "—")}</span></Field>
                <Field label="Property"><span style={{ fontSize: 13 }}>{String(selected.property_description ?? "—")}</span></Field>
              </div>
              <div className="grid-2" style={{ gap: 12, marginTop: 12 }}>
                <Field label="Issue Date"><span style={{ fontSize: 13 }}>{fmtDate(selected.issued_on)}</span></Field>
                <Field label="Market Value"><span className="mono" style={{ fontSize: 13 }}>{fmtMoney(selected.market_value)}</span></Field>
              </div>
              <div className="grid-2" style={{ gap: 12, marginTop: 12 }}>
                <Field label="Signed By (ID)"><span style={{ fontSize: 13 }}>{String(selected.signed_by ?? "—")}</span></Field>
                <Field label="Delivery"><span style={{ fontSize: 13 }}>{Boolean(selected.delivered_at) ? fmtDateTime(selected.delivered_at) : "Not delivered"}</span></Field>
              </div>
              {selected.delivery_method ? <div style={{ marginTop: 12 }}><Field label="Delivery Method"><span style={{ fontSize: 13 }}>{String(selected.delivery_method)}</span></Field></div> : null}
              <div style={{ marginTop: 12 }}>
                <Field label="Integrity Checksum"><span className="mono" style={{ fontSize: 10, color: "var(--muted)", wordBreak: "break-all" }}>{String(selected.checksum ?? "—")}</span></Field>
              </div>
              {selected.file_url ? (
                <div style={{ marginTop: 18 }}>
                  <a className="btn primary sm" style={{ width: "100%", justifyContent: "center" }} href={String(selected.file_url)} target="_blank" rel="noreferrer">↓ Download Report</a>
                </div>
              ) : null}
            </DetailDrawer>
          )}
        </Panel>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

          <Panel title="Delivery Status (This Month)">
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {deliveryStatuses.map((s) => (
                <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 80, fontSize: 12 }}>{s.label}</span>
                  <div style={{ flex: 1, height: 8, borderRadius: 4, background: "var(--surface-3, #e5e7eb)" }}>
                    <div style={{ height: "100%", borderRadius: 4, width: `${(s.count / deliveryMax) * 100}%`, background: s.color }} />
                  </div>
                  <span className="mono" style={{ fontSize: 11 }}>{s.count}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── invoices ───────────────────────── */

function InvoicesView({ rows, search, setSearch, setShowRecordPayment, setShowCreateInvoice }: {
  rows: Row[];
  search: string;
  setSearch: (v: string) => void;
  setShowRecordPayment: () => void;
  setShowCreateInvoice: () => void;
}) {
  const [selected, setSelected] = useState<Row | null>(null);
  const invoiced = rows.reduce((acc, r) => acc + Number(r.total ?? 0), 0);
  const collected = rows.reduce((acc, r) => acc + (Number(r.total ?? 0) - Number(r.balance ?? 0)), 0);
  const outstanding = rows.reduce((acc, r) => acc + Number(r.balance ?? 0), 0);

  const aging = useMemo(() => {
    const open = rows.filter((r) => !["paid", "void"].includes(String(r.status)));
    const buckets = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 } as Record<string, number>;
    for (const r of open) {
      const due = new Date(String(r.due_on ?? ""));
      if (Number.isNaN(due.getTime())) continue;
      const days = Math.floor((new Date().getTime() - due.getTime()) / 86400000);
      const key = days <= 30 ? "0-30" : days <= 60 ? "31-60" : days <= 90 ? "61-90" : "90+";
      buckets[key] += Number(r.balance ?? 0);
    }
    return buckets;
  }, [rows]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <KpiStrip cols={3}>
        <KpiCard icon="🧾" iconBg="#e0e7ff" iconColor="#4f46e5" label="Invoiced" value={fmtMoney(invoiced)} sub={`${rows.length} invoices issued`} />
        <KpiCard icon="✅" iconBg="#dcfce7" iconColor="#16a34a" label="Collected" value={fmtMoney(collected)} sub="Payments received" />
        <KpiCard icon="⏳" iconBg="#fee2e2" iconColor="#b91c1c" label="Outstanding" value={fmtMoney(outstanding)} sub="Unpaid balance" />
      </KpiStrip>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 240px", gap: 20, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Panel title="Aging Summary (Outstanding)">
            {rows.length === 0 ? (
              <EmptyState icon="🕘" title="No invoicing yet" description="Invoice aging by bucket will appear once invoices are issued." />
            ) : (
              <div className="grid-4" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, padding: 14 }}>
                {Object.entries(aging).map(([bucket, value]) => (
                  <div key={bucket} style={{ padding: "12px 14px", background: "var(--surface-2)", borderRadius: 10, border: "1px solid var(--border)" }}>
                    <span className="muted" style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>{bucket} days</span>
                    <div style={{ fontSize: 16, fontWeight: 800, marginTop: 4, color: Number(value) > 0 ? "#b91c1c" : "var(--text)" }}>{fmtMoney(value)}</div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Client Invoices" badge={rows.length}>
            <TableChrome
              search={search}
              setSearch={setSearch}
              placeholder="Search invoice no., instruction no., client…"
            >
              {rows.length === 0 ? (
                <EmptyState icon="🧾" title="No invoices" description="Invoices raised against completed instructions will appear here." />
              ) : (
                <DataTable headers={["Invoice No", "Instruction", "Client", "Issue Date", "Due Date", "Amount", "Paid", "Balance", "Status", "Actions"]}>
                  {rows.map((r) => (
                    <tr key={String(r.id ?? r.number)}>
                      <td><RefText value={r.number} /></td>
                      <td className="mono" style={{ fontSize: 12 }}>{String(r.instruction_reference ?? "—")}</td>
                      <td style={{ fontSize: 12 }}>{String(r.client_name ?? "—")}</td>
                      <td style={{ fontSize: 12 }}>{fmtDate(r.issued_on)}</td>
                      <td style={{ fontSize: 12 }}>{fmtDate(r.due_on)}</td>
                      <td className="mono" style={{ fontSize: 12 }}>{fmtMoney(r.total)}</td>
                      <td className="mono" style={{ fontSize: 12, color: "#16a34a" }}>{fmtMoney(Number(r.total ?? 0) - Number(r.balance ?? 0))}</td>
                      <td className="mono" style={{ fontSize: 12 }}>{fmtMoney(r.balance)}</td>
                      <td><StatusPill value={strOrNull(r.status)} tone={invoiceTone(String(r.status))} /></td>
                      <td><button className="btn ghost sm" onClick={() => setSelected(r)}>View</button></td>
                    </tr>
                  ))}
                </DataTable>
              )}
            </TableChrome>
          </Panel>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        </div>
      </div>

      {selected && (
        <DetailDrawer title={<RefText value={selected.number} />} onClose={() => setSelected(null)} width={400}>
          <StatusPill value={strOrNull(selected.status)} tone={invoiceTone(String(selected.status))} />
          <div style={{ marginTop: 12 }}>
            <Field label="Instruction No"><span className="mono" style={{ fontSize: 13 }}>{String(selected.instruction_reference ?? "—")}</span></Field>
          </div>
          <div style={{ marginTop: 12 }}>
            <Field label="Client / Bank"><strong style={{ fontSize: 13 }}>{String(selected.client_name ?? "—")}</strong></Field>
          </div>
          <div className="grid-2" style={{ gap: 12, marginTop: 12 }}>
            <Field label="Issue Date"><span style={{ fontSize: 13 }}>{fmtDate(selected.issued_on)}</span></Field>
            <Field label="Due Date"><span style={{ fontSize: 13 }}>{fmtDate(selected.due_on)}</span></Field>
          </div>
          <div className="grid-2" style={{ gap: 12, marginTop: 12 }}>
            <Field label="Subtotal"><span className="mono" style={{ fontSize: 13 }}>{fmtMoney(selected.subtotal)}</span></Field>
            <Field label="Tax"><span className="mono" style={{ fontSize: 13 }}>{fmtMoney(selected.tax)}</span></Field>
          </div>
          <div className="grid-2" style={{ gap: 12, marginTop: 12 }}>
            <Field label="Total"><span className="mono" style={{ fontSize: 13 }}>{fmtMoney(selected.total)}</span></Field>
            <Field label="Balance"><span className="mono" style={{ fontSize: 13, color: Number(selected.balance) > 0 ? "#b91c1c" : "var(--text)" }}>{fmtMoney(selected.balance)}</span></Field>
          </div>
        </DetailDrawer>
      )}
    </div>
  );
}

/* ───────────────────────── payments ───────────────────────── */

function PaymentsView({ rows, search, setSearch, canFinance, openRecordPayment }: {
  rows: Row[];
  search: string;
  setSearch: (v: string) => void;
  canFinance: boolean;
  openRecordPayment: () => void;
}) {
  const total = rows.reduce((acc, r) => acc + Number(r.amount ?? 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <KpiStrip cols={3}>
        <KpiCard icon="💳" iconBg="#e0e7ff" iconColor="#4f46e5" label="Payments" value={number.format(rows.length)} sub="Fee collections" />
        <KpiCard icon="💰" iconBg="#dcfce7" iconColor="#16a34a" label="Collected" value={fmtMoney(total)} sub="Total received" />
        <KpiCard icon="✅" iconBg="#cffafe" iconColor="#0e7490" label="Allocations" value={number.format(rows.filter((r) => !["rejected", "unapplied"].includes(String(r.status))).length)} sub="Applied to invoices" />
      </KpiStrip>

      <Panel title="Fee Collections & Allocations" badge={rows.length} action={canFinance ? <button className="btn primary sm" onClick={openRecordPayment}>+ Record Payment</button> : undefined}>
        <TableChrome
          search={search}
          setSearch={setSearch}
          placeholder="Search payment ref, invoice no., client…"
        >
          {rows.length === 0 ? (
            <EmptyState icon="💳" title="No payments recorded" description="Payments received against invoices are applied here and reduce the outstanding balance." action={canFinance ? <button className="btn primary sm" onClick={openRecordPayment}>+ Record Payment</button> : undefined} />
          ) : (
            <DataTable headers={["Payment Ref", "Invoice", "Client", "Method", "Amount", "Date", "Status", "Actions"]}>
              {rows.map((r) => (
                <tr key={String(r.id ?? r.reference)}>
                  <td><RefText value={r.reference} /></td>
                  <td className="mono" style={{ fontSize: 12 }}>{String(r.invoice_number ?? "—")}</td>
                  <td style={{ fontSize: 12 }}>{String(r.client_name ?? "—")}</td>
                  <td><Badge tone="blue">{String(r.method ?? "—")}</Badge></td>
                  <td className="mono" style={{ fontSize: 12 }}>{fmtMoney(r.amount)}</td>
                  <td style={{ fontSize: 12 }}>{fmtDate(r.paid_on)}</td>
                  <td><StatusPill value="Applied" tone="green" /></td>
                  <td><span className="muted" style={{ fontSize: 12 }}>{String(r.external_reference || "Auto")}</span></td>
                </tr>
              ))}
            </DataTable>
          )}
        </TableChrome>
      </Panel>
    </div>
  );
}

/* ───────────────────────── clients ───────────────────────── */

function ClientsView({ rows, search, setSearch, canCoordinate, openNewClient }: {
  rows: Row[];
  search: string;
  setSearch: (v: string) => void;
  canCoordinate: boolean;
  openNewClient: () => void;
}) {
  const [selected, setSelected] = useState<Row | null>(null);

  return (
    <Panel title="Clients & Lenders Vault" badge={rows.length} action={canCoordinate ? <button className="btn primary sm" onClick={openNewClient}>+ New Client</button> : undefined}>
      <TableChrome
        search={search}
        setSearch={setSearch}
        placeholder="Search name, code, contact or email…"
      >
        {rows.length === 0 ? (
          <EmptyState icon="🏢" title="No clients registered" description="Banks, lenders and corporate clients instructing valuations will appear here." action={canCoordinate ? <button className="btn primary sm" onClick={openNewClient}>+ New Client</button> : undefined} />
        ) : (
          <DataTable headers={["Client / Lender", "Type", "Contact", "Email", "Phone", "Terms (Days)", "Status", "Actions"]}>
            {rows.map((r) => (
              <tr key={String(r.id ?? r.code)}>
                <td>
                  <strong style={{ fontSize: 12 }}>{String(r.name ?? "—")}</strong>
                  <div className="mono muted" style={{ fontSize: 10 }}>{String(r.code ?? "—")}</div>
                </td>
                <td><Badge tone="purple">{String(r.client_type ?? "—")}</Badge></td>
                <td style={{ fontSize: 12 }}>{String(r.contact_name || "—")}</td>
                <td style={{ fontSize: 12 }}>{String(r.email || "—")}</td>
                <td style={{ fontSize: 12 }}>{String(r.phone || "—")}</td>
                <td style={{ fontSize: 12 }}>{Number(r.payment_terms_days ?? 0) || "—"}</td>
                <td><StatusPill value="Active" tone="green" /></td>
                <td><button className="btn ghost sm" onClick={() => setSelected(r)}>View</button></td>
              </tr>
            ))}
          </DataTable>
        )}
      </TableChrome>

      {selected && (
        <DetailDrawer title={<strong style={{ fontSize: 14 }}>{String(selected.name ?? "—")}</strong>} onClose={() => setSelected(null)} width={400}>
          <div style={{ marginBottom: 10 }}>
            <Badge tone="purple">{String(selected.client_type ?? "—")}</Badge>
            <span className="mono muted" style={{ fontSize: 11, marginLeft: 8 }}>{String(selected.code ?? "—")}</span>
          </div>
          <Field label="Contact Name"><span style={{ fontSize: 13 }}>{String(selected.contact_name || "—")}</span></Field>
          <div className="grid-2" style={{ gap: 12, marginTop: 12 }}>
            <Field label="Email"><span style={{ fontSize: 13 }}>{String(selected.email || "—")}</span></Field>
            <Field label="Phone"><span style={{ fontSize: 13 }}>{String(selected.phone || "—")}</span></Field>
          </div>
          <div className="grid-2" style={{ gap: 12, marginTop: 12 }}>
            <Field label="Tax Number"><span className="mono" style={{ fontSize: 13 }}>{String(selected.tax_number || "—")}</span></Field>
            <Field label="Payment Terms"><span style={{ fontSize: 13 }}>{Number(selected.payment_terms_days ?? 0) ? `${String(selected.payment_terms_days)} days` : "—"}</span></Field>
          </div>
          <div style={{ marginTop: 12 }}>
            <Field label="Registered"><span style={{ fontSize: 13 }}>{fmtDateTime(selected.created_at)}</span></Field>
          </div>
        </DetailDrawer>
      )}
    </Panel>
  );
}

/* ───────────────────────── analytics ───────────────────────── */

function AnalyticsView({ analytics, dashboard }: { analytics: Analytics | null; dashboard: Dashboard | null }) {
  const team = analytics?.teamPerformance ?? EMPTY_ROWS;
  const aging = analytics?.aging ?? {};
  const recent = dashboard?.recentInstructions ?? EMPTY_ROWS;
  const pipeline = dashboard?.pipeline ?? EMPTY_PIPELINE;
  const mix = dashboard?.valuationMix ?? EMPTY_MIX;

  const totalInstructions = team.reduce((acc, r) => acc + Number(r.instructions ?? 0), 0);
  const delivered = team.reduce((acc, r) => acc + Number(r.delivered ?? 0), 0);
  const feeEstimate = team.reduce((acc, r) => acc + Number(r.instructions ?? 0) * Number(r.averageFee ?? 0), 0);
  const completionRate = totalInstructions ? Math.round((delivered / totalInstructions) * 100) : 0;
  const overdueInvoices = Number(aging.overdueInvoices ?? 0);
  const overdueBalance = Number(aging.overdueBalance ?? 0);

  const avgTurnaround = useMemo(() => {
    const completed = recent.filter((r) => COMPLETED.includes(String(r.status)));
    if (completed.length === 0) return null;
    const totalDays = completed.reduce((acc, r) => {
      const instructed = new Date(String(r.instructed_on ?? ""));
      const due = new Date(String(r.due_on ?? ""));
      if (Number.isNaN(instructed.getTime()) || Number.isNaN(due.getTime())) return acc;
      return acc + Math.round((due.getTime() - instructed.getTime()) / 86400000);
    }, 0);
    return Math.round(totalDays / completed.length);
  }, [recent]);

  const bankDonut = useMemo(() => DonutSegments(recent, "client_name", "Unassigned client"), [recent]);
  const typeBars = useMemo(() => mix.map((m, i) => ({ label: String(m.valuation_type ?? "—"), value: Number(m.count ?? 0), color: PALETTE[i % PALETTE.length] })), [mix]);
  const pipelineBars = useMemo(() => pipeline.map((p) => ({ label: String(p.status ?? "—").replace(/_/g, " "), value: Number(p.count ?? 0) })), [pipeline]);
  const feeBars = useMemo(
    () => team.map((r) => ({ label: String(r.valuer__username ?? r.valuer__first_name ?? "Valuer"), value: Number(r.instructions ?? 0) * Number(r.averageFee ?? 0) })),
    [team],
  );
  const bankMax = Math.max(1, ...bankDonut.map((s) => s.value));
  const bankTotal = bankDonut.reduce((acc, s) => acc + s.value, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <KpiStrip cols={7}>
        <KpiCard icon="📐" iconBg="#e0e7ff" iconColor="#4f46e5" label="Instructions YTD" value={number.format(totalInstructions)} sub="Assigned workload" />
        <KpiCard icon="✅" iconBg="#dcfce7" iconColor="#16a34a" label="Completed" value={number.format(delivered)} sub="Delivered on time" />
        <KpiCard icon="⏱️" iconBg="#fef3c7" iconColor="#92400e" label="Avg Turnaround" value={avgTurnaround !== null ? `${avgTurnaround} days` : "Data pending"} sub="Completed instruction avg" />
        <KpiCard icon="💰" iconBg="#fff7ed" iconColor="#ea580c" label="Quoted Fees" value={fmtMoney(feeEstimate)} sub="Across the pipeline" />
        <KpiCard icon="🎯" iconBg="#cffafe" iconColor="#0e7490" label="Completion Rate" value={`${completionRate}%`} sub="Of assigned work" />
        <KpiCard icon="📤" iconBg="#ede9fe" iconColor="#6d28d9" label="On-time %" value="—" sub="Delivery SLA pending" />
        <KpiCard icon="⚠️" iconBg="#fee2e2" iconColor="#b91c1c" label="Overdue Rate" value={number.format(overdueInvoices)} sub={`${fmtMoney(overdueBalance)} aged`} />
      </KpiStrip>

      <div className="grid-2" style={{ alignItems: "start" }}>
        <Panel title="Instructions Trend (This Period)">
          {pipelineBars.length ? <BarChart data={pipelineBars} height={150} /> : <EmptyState icon="📈" title="No trend data" description="Pipeline distribution by status will render once instructions are recorded." />}
        </Panel>
        <Panel title="Volume of Work by Bank">
          {bankDonut.length ? <Donut segments={bankDonut} center={<><strong style={{ fontSize: 18 }}>{bankTotal}</strong><small className="muted" style={{ fontSize: 10 }}>Total</small></>} /> : <EmptyState icon="🏦" title="No bank volume" description="Instruction mix by bank/lender will appear here." />}
        </Panel>
      </div>

      <div className="grid-2" style={{ alignItems: "start" }}>
        <Panel title="Instructions by Type">
          {typeBars.length ? <BarChart data={typeBars.map((t) => ({ label: t.label, value: t.value }))} height={140} /> : <EmptyState icon="🧩" title="No type data" description="Valuation type distribution will appear here." />}
        </Panel>
        <Panel title="Fee Analysis (This Period)">
          {feeBars.length ? <BarChart data={feeBars} color="#ea580c" height={140} /> : <EmptyState icon="💰" title="No fee data" description="Quoted fee value by valuer will appear once instructions are recorded." />}
        </Panel>
      </div>

      <div className="grid-2" style={{ alignItems: "start" }}>
        <Panel title="Team Performance" badge={team.length}>
          {team.length === 0 ? (
            <EmptyState icon="🧑‍💼" title="No team data" description="Valuer performance (instructions, delivery and average fees) will appear here." />
          ) : (
            <DataTable headers={["Valuer", "Instructions", "Delivered", "Avg Fee", "Completion"]}>
              {team.map((r, i) => {
                const ins = Number(r.instructions ?? 0);
                const del = Number(r.delivered ?? 0);
                const pct = ins ? Math.round((del / ins) * 100) : 0;
                const name = String(r.valuer__first_name || "") + " " + String(r.valuer__last_name || "") || String(r.valuer__username || "—");
                return (
                  <tr key={i}>
                    <td><strong style={{ fontSize: 12 }}>{name.trim() || "—"}</strong></td>
                    <td style={{ fontSize: 12 }}>{number.format(ins)}</td>
                    <td style={{ fontSize: 12 }}>{number.format(del)}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{fmtMoney(r.averageFee)}</td>
                    <td>
                      <div className="progress" style={{ width: 90 }}>
                        <span style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </DataTable>
          )}
        </Panel>

        <Panel title="Bank Performance (This Period)">
          {bankDonut.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 14 }}>
              {bankDonut.map((s) => (
                <div key={s.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{s.label}</span>
                    <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{s.value} · {Math.round((s.value / bankMax) * 100)}%</span>
                  </div>
                  <div className="progress" style={{ height: 6 }}>
                    <span style={{ width: `${Math.max(0, Math.min(100, (s.value / bankMax) * 100))}%`, background: s.color }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon="🏦" title="No bank performance" description="Share of work by bank/lender will render here once instructions are recorded." />
          )}
        </Panel>
      </div>

      <Panel title="Turnaround Time Analysis">
        <EmptyState icon="⏱️" title="Turnaround segmentation pending" description="Average days per stage (instruction → inspection → draft → final) will be published here once SLA timings are recorded server-side." />
      </Panel>
    </div>
  );
}

/* ───────────────────────── reports ───────────────────────── */

function ReportsView({ reports, recentExports, onExport }: {
  reports: Row[];
  recentExports: { key: string; name: string; exportedAt: string }[];
  onExport: (key: string, name: string) => void;
}) {
  const icons: Record<string, string> = { instructions: "📐", inspections: "📍", comparables: "📊", reports: "📄", fees: "💰" };
  const descriptions: Record<string, string> = {
    instructions: "Instruction pipeline and SLA compliance by valuer and client.",
    inspections: "Inspection evidence register with GPS, findings and checklist coverage.",
    comparables: "Comparable evidence analysis with rates and adjustments.",
    reports: "Final signed valuation reports with delivery and checksum records.",
    fees: "Fees, payments and outstanding aging across clients.",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Panel title="Report Catalogue" badge={reports.length}>
        {reports.length === 0 ? (
          <EmptyState icon="📊" title="No report catalogue" description="The analytics service will provide report definitions here." />
        ) : (
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", padding: 16 }}>
            {reports.map((r) => {
              const key = String(r.key ?? "");
              const name = String(r.name ?? "Report");
              return (
                <article className="data-panel" key={key} style={{ padding: 18 }}>
                  <div style={{ alignItems: "center", display: "flex", gap: 10, marginBottom: 10 }}>
                    <span style={{ background: "#e0f2fe", borderRadius: 10, color: "#0891b2", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 16, height: 38, width: 38 }}>{icons[key] ?? "📄"}</span>
                    <strong style={{ fontSize: 13 }}>{name}</strong>
                  </div>
                  <p className="muted" style={{ fontSize: 12, lineHeight: 1.5, margin: "0 0 14px", minHeight: 36 }}>{descriptions[key] ?? "Exports the current valuation dataset as CSV."}</p>
                  <button className="btn primary sm" style={{ width: "100%", justifyContent: "center" }} onClick={() => onExport(key, name)}>↓ Export CSV</button>
                </article>
              );
            })}
          </div>
        )}
      </Panel>

      <Panel title="Recent Reports">
        {reports.length === 0 ? (
          <EmptyState icon="📄" title="No recent reports" description="Recent report definitions will be listed here." />
        ) : (
          <DataTable headers={["Report", "Key", "Kind"]}>
            {reports.map((r) => (
              <tr key={String(r.key ?? r.name)}>
                <td><strong style={{ fontSize: 12 }}>{String(r.name ?? "—")}</strong></td>
                <td className="mono" style={{ fontSize: 12 }}>{String(r.key ?? "—")}</td>
                <td><Badge tone="cyan">CSV Export</Badge></td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>

      <Panel title="Recent Exports" badge={recentExports.length}>
        {recentExports.length === 0 ? (
          <EmptyState icon="🕘" title="No exports yet" description="Reports you download from the catalogue will be tracked here." />
        ) : (
          <DataTable headers={["Report", "File", "Exported At"]}>
            {recentExports.map((e, i) => (
              <tr key={`${e.key}-${i}`}>
                <td><strong style={{ fontSize: 12 }}>{e.name}</strong></td>
                <td className="mono" style={{ fontSize: 12 }}>valuation-{e.key}.csv</td>
                <td style={{ fontSize: 12 }}>{fmtDateTime(e.exportedAt)}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>
    </div>
  );
}

/* ───────────────────────── audit events ───────────────────────── */

function AuditEventsView({ rows, search, setSearch }: {
  rows: Row[];
  search: string;
  setSearch: (v: string) => void;
}) {
  const statusChanges = rows.filter((r) => String(r.event_type).includes("status")).length;
  const financial = rows.filter((r) => ["invoice", "payment"].some((k) => String(r.event_type).includes(k))).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <KpiStrip cols={4}>
        <KpiCard icon="🕘" iconBg="#e0e7ff" iconColor="#4f46e5" label="Audit Events" value={number.format(rows.length)} sub="Immutable activity log" />
        <KpiCard icon="🔀" iconBg="#fef3c7" iconColor="#92400e" label="Status Changes" value={number.format(statusChanges)} sub="Instruction moves" />
        <KpiCard icon="💳" iconBg="#dcfce7" iconColor="#16a34a" label="Financial Events" value={number.format(financial)} sub="Invoices & payments" />
        <KpiCard icon="🧾" iconBg="#cffafe" iconColor="#0e7490" label="Reports" value={number.format(rows.filter((r) => String(r.event_type).includes("draft") || String(r.event_type).includes("final")).length)} sub="Draft & final events" />
      </KpiStrip>

      <Panel title="Audit Trail" badge={rows.length}>
        <TableChrome
          search={search}
          setSearch={setSearch}
          placeholder="Search instruction ref, event type or notes…"
        >
          {rows.length === 0 ? (
            <EmptyState icon="🕘" title="No audit events" description="Every controlled action (creation, transition, approval, issue and allocation) will be recorded here with the acting user." />
          ) : (
            <DataTable headers={["Timestamp", "User", "Action", "Entity", "Detail"]}>
              {rows.map((r) => {
                let detail = String(r.notes ?? "");
                if (!detail && r.details) detail = JSON.stringify(r.details).slice(0, 140);
                return (
                  <tr key={String(r.id)}>
                    <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>{fmtDateTime(r.created_at)}</td>
                    <td style={{ fontSize: 12 }}><strong>{String(r.actor_name ?? "—")}</strong></td>
                    <td><Badge value={strOrNull(r.event_type)} tone="cyan" /></td>
                    <td className="mono" style={{ fontSize: 12 }}>{String(r.instruction_reference ?? "—")}</td>
                    <td className="muted" style={{ fontSize: 11, maxWidth: 260 }}>{detail || "—"}</td>
                  </tr>
                );
              })}
            </DataTable>
          )}
        </TableChrome>
      </Panel>
    </div>
  );
}

/* ───────────────────────── modals ───────────────────────── */

function NewInstructionModal({ clients, error, onSubmit, onClose }: {
  clients: Row[];
  error: string;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  return (
    <Modal title="+ New Valuation Instruction" onClose={onClose} wide>
      {error ? <ErrorBanner message={error} onRetry={() => {}} /> : null}
      <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="grid-2">
          <Field label="Instruction Ref" required>
            <input name="reference" required placeholder="e.g. VAL-2026-0186" style={inputStyle} />
          </Field>
          <Field label="Client / Lender" required>
            <select name="client" required defaultValue="" style={inputStyle}>
              <option value="" disabled>Select client…</option>
              {clients.map((c) => <option key={String(c.id)} value={String(c.id)}>{String(c.name)}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Property Description & L.R. No" required>
          <input name="property_description" required placeholder="e.g. Commercial Complex L.R. 209/1844" style={inputStyle} />
        </Field>
        <div className="grid-2">
          <Field label="Valuation Type" required>
            <input name="valuation_type" required placeholder="e.g. Commercial Asset" style={inputStyle} />
          </Field>
          <Field label="Purpose" required>
            <input name="purpose" required placeholder="e.g. Mortgage Security" style={inputStyle} />
          </Field>
        </div>
        <div className="grid-2">
          <Field label="Instruction Date" required>
            <input name="instructed_on" type="date" required style={inputStyle} />
          </Field>
          <Field label="Due Date" required>
            <input name="due_on" type="date" required style={inputStyle} />
          </Field>
        </div>
        <div className="grid-2">
          <Field label="Quoted Fee (KES)" required>
            <input name="quoted_fee" type="number" required min="0" placeholder="450000" style={inputStyle} />
          </Field>
          <Field label="Priority">
            <select name="priority" defaultValue="normal" style={inputStyle}>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </Field>
        </div>
        <div className="row" style={{ justifyContent: "flex-end", marginTop: 6 }}>
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary">Create Instruction</button>
        </div>
      </form>
    </Modal>
  );
}

function NewClientModal({ error, onSubmit, onClose }: {
  error: string;
  onSubmit: (payload: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [clientType, setClientType] = useState("bank");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [tax, setTax] = useState("");
  const [terms, setTerms] = useState("30");

  return (
    <Modal title="+ New Client / Lender" onClose={onClose} wide>
      {error ? <ErrorBanner message={error} onRetry={() => {}} /> : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="grid-2">
          <Field label="Client Code" required>
            <input value={code} onChange={(e) => setCode(e.target.value)} required placeholder="e.g. ABC-001" style={inputStyle} />
          </Field>
          <Field label="Client Name" required>
            <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. ABC Bank" style={inputStyle} />
          </Field>
        </div>
        <div className="grid-2">
          <Field label="Client Type" required>
            <select value={clientType} onChange={(e) => setClientType(e.target.value)} style={inputStyle}>
              <option value="bank">Bank</option>
              <option value="corporate">Corporate</option>
              <option value="government">Government</option>
              <option value="individual">Individual</option>
              <option value="legal">Legal firm</option>
            </select>
          </Field>
          <Field label="Payment Terms (Days)">
            <input value={terms} onChange={(e) => setTerms(e.target.value)} type="number" min="0" style={inputStyle} />
          </Field>
        </div>
        <Field label="Contact Name">
          <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Primary contact" style={inputStyle} />
        </Field>
        <div className="grid-2">
          <Field label="Email">
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="contact@client.co.ke" style={inputStyle} />
          </Field>
          <Field label="Phone">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+254 700 000 000" style={inputStyle} />
          </Field>
        </div>
        <Field label="Tax Number">
          <input value={tax} onChange={(e) => setTax(e.target.value)} placeholder="P/NIN" style={inputStyle} />
        </Field>
        <div className="row" style={{ justifyContent: "flex-end", marginTop: 6 }}>
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn primary"
            onClick={() =>
              onSubmit({
                code,
                name,
                client_type: clientType,
                contact_name: contact,
                email,
                phone,
                tax_number: tax,
                payment_terms_days: Number(terms) || 30,
              })
            }
          >
            Create Client
          </button>
        </div>
      </div>
    </Modal>
  );
}

function DraftReviewModal({ report, error, busy, onSubmit, onClose }: {
  report: Row;
  error: string;
  busy: boolean;
  onSubmit: (action: "approve" | "request-changes", notes: string) => void;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState("");
  const inReview = String(report.status) === "review";
  const ref = `${String(report.instruction_reference ?? "—")}/v${String(report.version ?? "1")}`;

  return (
    <Modal title={`Review ${ref}`} onClose={onClose}>
      {error ? <ErrorBanner message={error} onRetry={() => {}} /> : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="grid-2" style={{ gap: 12 }}>
          <Field label="Instruction"><span className="mono" style={{ fontSize: 13 }}>{String(report.instruction_reference ?? "—")}</span></Field>
          <Field label="Assessed Value"><span className="mono" style={{ fontSize: 13 }}>{fmtMoney(report.assessed_value)}</span></Field>
        </div>
        <Field label="Valuer"><span style={{ fontSize: 13 }}>{String(report.prepared_by_name || "—")}</span></Field>
        <Field label="Review Comment">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Approval note or required changes…" style={{ ...inputStyle, resize: "vertical" }} />
        </Field>
        {!inReview ? (
          <p className="muted" style={{ fontSize: 12, margin: 0 }}>Only a report in review can be actioned — current status: <StatusPill value={strOrNull(report.status)} tone={draftTone(String(report.status))} />.</p>
        ) : null}
        <div className="row" style={{ justifyContent: "flex-end", marginTop: 6 }}>
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn ghost sm" disabled={!inReview || busy} style={{ padding: "9px 14px" }} onClick={() => onSubmit("request-changes", notes)}>Request Changes</button>
          <button type="button" className="btn primary" disabled={!inReview || busy} onClick={() => onSubmit("approve", notes)}>Approve Report</button>
        </div>
      </div>
    </Modal>
  );
}

function RecordPaymentModal({ invoices, error, busy, onSubmit, onClose }: {
  invoices: Row[];
  error: string;
  busy: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const [invoice, setInvoice] = useState("");
  const [paidOn, setPaidOn] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("M-Pesa");
  const [external, setExternal] = useState("");

  return (
    <Modal title="Allocate Payment" onClose={onClose}>
      {error ? <ErrorBanner message={error} onRetry={() => {}} /> : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Field label="Invoice" required>
          <select value={invoice} onChange={(e) => setInvoice(e.target.value)} required style={inputStyle}>
            <option value="" disabled>Select invoice…</option>
            {invoices.map((i) => <option key={String(i.id)} value={String(i.id)}>{String(i.number)} — {String(i.client_name ?? "—")}</option>)}
          </select>
        </Field>
        <div className="grid-2">
          <Field label="Payment Date" required>
            <input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} required style={inputStyle} />
          </Field>
          <Field label="Amount (KES)" required>
            <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required placeholder="0" style={inputStyle} />
          </Field>
        </div>
        <div className="grid-2">
          <Field label="Method" required>
            <select value={method} onChange={(e) => setMethod(e.target.value)} style={inputStyle}>
              <option value="M-Pesa">M-Pesa</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Cheque">Cheque</option>
              <option value="Cash">Cash</option>
            </select>
          </Field>
          <Field label="External Reference">
            <input value={external} onChange={(e) => setExternal(e.target.value)} placeholder="e.g. STK transaction id" style={inputStyle} />
          </Field>
        </div>
        <div className="row" style={{ justifyContent: "flex-end", marginTop: 6 }}>
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn primary" disabled={busy || !invoice || !paidOn || !amount} onClick={() => onSubmit({ invoice, paid_on: paidOn, amount: Number(amount), method, external_reference: external })}>
            Allocate Payment
          </button>
        </div>
      </div>
    </Modal>
  );
}

function CreateInvoiceModal({ finalReports, invoices, error, busy, onSubmit, onClose }: {
  finalReports: Row[];
  invoices: Row[];
  error: string;
  busy: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const invoicedInstructionIds = useMemo(() => new Set(invoices.map((i) => String(i.instruction ?? ""))), [invoices]);
  const available = useMemo(() => finalReports.filter((r) => !invoicedInstructionIds.has(String(r.instruction ?? ""))), [finalReports, invoicedInstructionIds]);

  const [instruction, setInstruction] = useState("");
  const [subtotal, setSubtotal] = useState("");
  const [taxRate, setTaxRate] = useState("16");
  const [dueOn, setDueOn] = useState("");
  const [notes, setNotes] = useState("");

  const amount = Number(subtotal) || 0;
  const tax = Math.round(amount * (Number(taxRate) || 0) / 100 * 100) / 100;
  const total = amount + tax;

  return (
    <Modal title="+ Create Invoice" onClose={onClose}>
      {error ? <ErrorBanner message={error} onRetry={() => {}} /> : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Field label="Instruction Ref" required>
          <select value={instruction} onChange={(e) => setInstruction(e.target.value)} required style={inputStyle}>
            <option value="" disabled>Select instruction…</option>
            {available.map((r) => (
              <option key={String(r.id)} value={String(r.instruction ?? "")}>{String(r.instruction_reference ?? "—")} — {String(r.client_name ?? "—")}</option>
            ))}
          </select>
        </Field>
        <div className="grid-2">
          <Field label="Amount (KES)" required>
            <input type="number" min="0" value={subtotal} onChange={(e) => setSubtotal(e.target.value)} required placeholder="0" style={inputStyle} />
          </Field>
          <Field label="Tax Rate (%)">
            <input type="number" min="0" max="100" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} style={inputStyle} />
          </Field>
        </div>
        <div className="grid-2">
          <Field label="Tax (KES)">
            <input type="number" readOnly value={tax.toFixed(2)} style={{ ...inputStyle, background: "var(--surface-3)", opacity: 0.7 }} />
          </Field>
          <Field label="Total (KES)">
            <input type="number" readOnly value={total.toFixed(2)} style={{ ...inputStyle, background: "var(--surface-3)", opacity: 0.7, fontWeight: 700 }} />
          </Field>
        </div>
        <Field label="Due Date" required>
          <input type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} required style={inputStyle} />
        </Field>
        <Field label="Notes">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional notes…" style={{ ...inputStyle, resize: "vertical" }} />
        </Field>
        {available.length === 0 && (
          <p className="muted" style={{ fontSize: 12, margin: 0 }}>All final reports have been invoiced. No outstanding instructions available.</p>
        )}
        <div className="row" style={{ justifyContent: "flex-end", marginTop: 6 }}>
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn primary" disabled={busy || !instruction || !subtotal || !dueOn} onClick={() => onSubmit({
            instruction: Number(instruction),
            number: `INV-${Date.now().toString(36).toUpperCase()}`,
            issued_on: new Date().toISOString().slice(0, 10),
            due_on: dueOn,
            subtotal: Number(subtotal),
            tax,
          })}>Create Invoice</button>
        </div>
      </div>
    </Modal>
  );
}

/* ───────────────────────── workspace ───────────────────────── */

export function ValuationWorkspace({ initialTab = "overview" }: { initialTab?: string }) {
  const { session, can } = useAuth();
  const { activeProperty } = usePropertyContext();
  const org = session?.activeOrganizationId ?? null;

  const [tab, setTab] = useState<ValuationTab>(() => (initialTab in labels ? (initialTab as ValuationTab) : "overview"));
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  const [clients, setClients] = useState<Row[]>([]);
  const [invoiceOptions, setInvoiceOptions] = useState<Row[]>([]);
  const [recentExports, setRecentExports] = useState<{ key: string; name: string; exportedAt: string }[]>([]);

  const [showNewInstruction, setShowNewInstruction] = useState(false);
  const [showNewClient, setShowNewClient] = useState(false);
  const [showDraftReview, setShowDraftReview] = useState<Row | null>(null);
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [createInvoiceOptions, setCreateInvoiceOptions] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);

  const canCoordinate = can("valuation.coordinate");
  const canFinance = can("valuation.finance");
  const canReview = can("valuation.review");

  const loadVersion = useRef(0);

  const loadData = useCallback(async () => {
    if (!org) return;
    const version = ++loadVersion.current;
    setLoading(true);
    setError("");
    try {
      if (tab === "overview") {
        const res = await apiFetch("/valuation/dashboard/", {}, org);
        if (version !== loadVersion.current) return;
        if (res.ok) {
          const data = (await res.json()) as Dashboard;
          if (version !== loadVersion.current) return;
          setDashboard(data);
          setRows([]);
        } else {
          setDashboard(null);
        }
      } else if (tab === "analytics" || tab === "reports") {
        const res = await apiFetch("/valuation/analytics/", {}, org);
        if (version !== loadVersion.current) return;
        if (res.ok) {
          const data = (await res.json()) as Analytics;
          if (version !== loadVersion.current) return;
          setAnalytics(data);
          setRows(tab === "analytics" ? (data.teamPerformance ?? []) : (data.reports ?? []));
        } else {
          setAnalytics(null);
          setRows([]);
        }
        if (tab === "analytics") {
          const dres = await apiFetch("/valuation/dashboard/", {}, org);
          if (version !== loadVersion.current) return;
          if (dres.ok) setDashboard((await dres.json()) as Dashboard);
        }
      } else {
        const res = await apiFetch(`/valuation/${tab}/?search=${encodeURIComponent(search)}`, {}, org);
        if (version !== loadVersion.current) return;
        if (res.ok) {
          const data = await res.json();
          if (version !== loadVersion.current) return;
          setRows(Array.isArray(data) ? (data as Row[]) : []);
        } else {
          setRows([]);
        }
      }
    } catch {
      if (version === loadVersion.current) setError("Unable to connect to the valuation tracker service.");
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [tab, search, org, activeProperty?.id]);

  useEffect(() => {
    const timer = setTimeout(loadData, search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [loadData, search]);

  useEffect(() => {
    if (!org || !showNewInstruction) return;
    apiFetch("/valuation/clients/", {}, org)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setClients(Array.isArray(d) ? (d as Row[]) : []));
  }, [org, showNewInstruction]);

  useEffect(() => {
    if (!org || !showRecordPayment) return;
    apiFetch("/valuation/invoices/", {}, org)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setInvoiceOptions(Array.isArray(d) ? (d as Row[]) : []));
  }, [org, showRecordPayment]);

  useEffect(() => {
    if (!org || !showCreateInvoice) return;
    apiFetch("/valuation/final-reports/", {}, org)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setCreateInvoiceOptions(Array.isArray(d) ? (d as Row[]) : []));
  }, [org, showCreateInvoice]);

  const selectTab = (id: string) => {
    setSearch("");
    setStatus("");
    setTab(id as ValuationTab);
  };

  const openNewInstruction = () => { setFormError(""); setShowNewInstruction(true); };
  const openNewClient = () => { setFormError(""); setShowNewClient(true); };
  const openReview = (r: Row) => { setFormError(""); setShowDraftReview(r); };
  const openRecordPayment = () => { setFormError(""); setShowRecordPayment(true); };
  const openCreateInvoice = () => { setFormError(""); setShowCreateInvoice(true); };

  async function submitNewInstruction(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setFormError("");
    const form = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {
      ...Object.fromEntries(form.entries()),
      valuer: session?.user.id,
      status: "new",
    };
    await apiFetch("/auth/csrf/");
    const res = await apiFetch("/valuation/instructions/", {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify(payload),
    }, org);
    setBusy(false);
    if (res.ok) {
      setShowNewInstruction(false);
      setTab("instructions");
      loadData();
    } else {
      setFormError(await readError(res));
    }
  }

  async function submitNewClient(payload: Record<string, unknown>) {
    setBusy(true);
    setFormError("");
    await apiFetch("/auth/csrf/");
    const res = await apiFetch("/valuation/clients/", {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify(payload),
    }, org);
    setBusy(false);
    if (res.ok) {
      setShowNewClient(false);
      loadData();
    } else {
      setFormError(await readError(res));
    }
  }

  async function submitDraftReview(report: Row, action: "approve" | "request-changes", notes: string) {
    setBusy(true);
    setFormError("");
    const endpoint = action === "approve" ? "approve" : "request-changes";
    await apiFetch("/auth/csrf/");
    const res = await apiFetch(`/valuation/draft-reports/${String(report.id)}/${endpoint}/`, {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify({ notes }),
    }, org);
    setBusy(false);
    if (res.ok) {
      setShowDraftReview(null);
      loadData();
    } else {
      setFormError(await readError(res));
    }
  }

  async function submitRecordPayment(payload: Record<string, unknown>) {
    setBusy(true);
    setFormError("");
    await apiFetch("/auth/csrf/");
    const res = await apiFetch("/valuation/payments/", {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify(payload),
    }, org);
    setBusy(false);
    if (res.ok) {
      setShowRecordPayment(false);
      loadData();
    } else {
      setFormError(await readError(res));
    }
  }

  async function submitCreateInvoice(payload: Record<string, unknown>) {
    setBusy(true);
    setFormError("");
    await apiFetch("/auth/csrf/");
    const res = await apiFetch("/valuation/invoices/", {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify(payload),
    }, org);
    setBusy(false);
    if (res.ok) {
      setShowCreateInvoice(false);
      loadData();
    } else {
      setFormError(await readError(res));
    }
  }

  const runTransition = useCallback(async (row: Row, target: string): Promise<boolean> => {
    setError("");
    await apiFetch("/auth/csrf/");
    const res = await apiFetch(`/valuation/instructions/${String(row.id)}/transition/`, {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify({ status: target }),
    }, org);
    if (res.ok) {
      loadData();
      return true;
    }
    setError(await readError(res));
    return false;
  }, [org, loadData]);

  async function exportReport(key: string, name: string) {
    const res = await apiFetch(`/valuation/analytics/exports/${key}/`, {}, org);
    if (!res.ok) {
      setError("Report export failed.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `valuation-${key}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setRecentExports((prev) => [{ key, name, exportedAt: new Date().toISOString() }, ...prev].slice(0, 8));
  }

  const todayStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  return (
    <ModuleShell
      moduleKey="valuation"
      moduleName="Valuation Tracker"
      eyebrow="Property Valuation Workspace"
      title="Valuation Management"
      subtitle="Valuation instructions, site inspections, comparable sales, draft reports & fee invoicing."
      accent="#0891b2"
      activeId={tab}
      onSelect={selectTab}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {error ? <ErrorBanner message={error} onRetry={loadData} /> : null}
        {formError ? <ErrorBanner message={formError} onRetry={() => setFormError("")} /> : null}

        {loading ? (
          <LoadingState rows={5} />
        ) : tab === "overview" ? (
          <OverviewView dashboard={dashboard} setTab={setTab} openNewInstruction={openNewInstruction} />
        ) : tab === "instructions" ? (
          <InstructionsView rows={rows} search={search} setSearch={setSearch} status={status} setStatus={setStatus} canCoordinate={canCoordinate} onTransition={runTransition} setShowAddModal={openNewInstruction} setTab={setTab} />
        ) : tab === "inspections" ? (
          <InspectionsView rows={rows} search={search} setSearch={setSearch} setShowAddModal={openNewInstruction} />
        ) : tab === "comparables" ? (
          <ComparablesView rows={rows} search={search} setSearch={setSearch} />
        ) : tab === "draft-reports" ? (
          <DraftReportsView rows={rows} search={search} setSearch={setSearch} canReview={canReview} openReview={openReview} setShowAddModal={openNewInstruction} />
        ) : tab === "final-reports" ? (
          <FinalReportsView rows={rows} search={search} setSearch={setSearch} setTab={setTab} />
        ) : tab === "invoices" ? (
          <InvoicesView rows={rows} search={search} setSearch={setSearch} setShowRecordPayment={openRecordPayment} setShowCreateInvoice={openCreateInvoice} />
        ) : tab === "payments" ? (
          <PaymentsView rows={rows} search={search} setSearch={setSearch} canFinance={canFinance} openRecordPayment={openRecordPayment} />
        ) : tab === "clients" ? (
          <ClientsView rows={rows} search={search} setSearch={setSearch} canCoordinate={canCoordinate} openNewClient={openNewClient} />
        ) : tab === "analytics" ? (
          <AnalyticsView analytics={analytics} dashboard={dashboard} />
        ) : tab === "reports" ? (
          <ReportsView reports={rows} recentExports={recentExports} onExport={exportReport} />
        ) : (
          <AuditEventsView rows={rows} search={search} setSearch={setSearch} />
        )}
      </div>

      {showNewInstruction ? <NewInstructionModal key="new-instruction" clients={clients} error={formError} onSubmit={submitNewInstruction} onClose={() => setShowNewInstruction(false)} /> : null}
      {showNewClient ? <NewClientModal key="new-client" error={formError} onSubmit={submitNewClient} onClose={() => setShowNewClient(false)} /> : null}
      {showDraftReview ? <DraftReviewModal key={`review-${String(showDraftReview.id)}`} report={showDraftReview} error={formError} busy={busy} onSubmit={(action, notes) => { void submitDraftReview(showDraftReview, action, notes); }} onClose={() => setShowDraftReview(null)} /> : null}
      {showRecordPayment ? <RecordPaymentModal key="record-payment" invoices={invoiceOptions} error={formError} busy={busy} onSubmit={submitRecordPayment} onClose={() => setShowRecordPayment(false)} /> : null}
      {showCreateInvoice ? <CreateInvoiceModal key="create-invoice" finalReports={createInvoiceOptions} invoices={rows} error={formError} busy={busy} onSubmit={(p) => { void submitCreateInvoice(p); }} onClose={() => setShowCreateInvoice(false)} /> : null}
    </ModuleShell>
  );
}
