"use client";

import { Fragment, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { ModuleShell } from "@/components/module-shell";
import { apiFetch, csrfFromCookie } from "@/lib/api";
import { tenderNav } from "@/lib/module-nav";
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
  SearchInput,
  StatusPill,
  money,
} from "@/components/module-ui";

export type TenderTab =
  | "overview"
  | "tenders"
  | "requirements"
  | "decisions"
  | "tasks"
  | "company-documents"
  | "proposals"
  | "financial-items"
  | "reviews"
  | "packaging"
  | "submissions"
  | "outcomes"
  | "reports"
  | "audit-events";

type Row = Record<string, unknown>;

type Dashboard = {
  kpis: Record<string, string | number>;
  recentTenders: Row[];
  urgentTasks: Row[];
  stageFunnel: { stage: string; count: number }[];
};

type Analytics = {
  metrics: { submitted: number; awarded: number; regretted: number; winRate: number };
  outcomes: { stage: string; count: number; value: string | number }[];
  reports: { key: string; name: string }[];
};

const labels: Record<TenderTab, string> = {
  overview: "Dashboard",
  tenders: "Invitations · Step 1",
  requirements: "AI Analysis · Step 2",
  decisions: "Bid / No-Bid · Step 3",
  tasks: "Planning · Step 4",
  "company-documents": "Company Documents · Step 5",
  proposals: "Technical Proposal · Step 6",
  "financial-items": "Financial Proposal · Step 7",
  reviews: "Review & Approval · Step 8",
  packaging: "Packaging · Step 9",
  submissions: "Submission · Step 10",
  outcomes: "Award / Regret · Step 11",
  reports: "Tender Reports",
  "audit-events": "Audit Trail",
};

const stageToneMap: Record<string, "green" | "red" | "yellow" | "blue" | "cyan" | "purple" | "gray"> = {
  invitation: "gray",
  analysis: "cyan",
  decision: "purple",
  planning: "yellow",
  technical: "blue",
  financial: "blue",
  review: "yellow",
  packaging: "purple",
  submitted: "blue",
  awarded: "green",
  regretted: "red",
};

const TASK_TRANSITIONS: Record<string, string[]> = {
  pending: ["in_progress", "blocked"],
  in_progress: ["blocked", "completed"],
  blocked: ["in_progress"],
  completed: [],
};

const PROPOSAL_TRANSITIONS: Record<string, string[]> = {
  draft: ["review"],
  review: ["draft", "approved"],
  approved: [],
};

/* ─── helpers ─── */

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

function fmtDetail(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v;
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function truncate(v: unknown, max = 90): string {
  const s = String(v ?? "").replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

/* ─── shared UI bits ─── */

function FormError({ error }: { error: string }) {
  if (!error) return null;
  return (
    <div className="error-banner" style={{ background: "var(--danger-bg)", border: "1px solid var(--danger)", borderRadius: 8, color: "var(--danger)", padding: "10px 14px", marginBottom: 12, fontSize: 12 }}>
      ⚠️ {error}
    </div>
  );
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

function StagePill({ value }: { value: unknown }) {
  const stage = String(value ?? "");
  return <StatusPill value={stage} tone={stageToneMap[stage] ?? "gray"} />;
}

function ProgressBar({ pct }: { pct: number }) {
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  return (
    <div style={{ alignItems: "center", display: "flex", gap: 8, minWidth: 120 }}>
      <div className="progress" style={{ flex: 1 }}>
        <span style={{ width: `${p}%` }} />
      </div>
      <span className="mono" style={{ color: "var(--muted)", fontSize: 11 }}>{p}%</span>
    </div>
  );
}

function Donut({ pct, color, value, label, size = 96 }: { pct: number; color: string; value: ReactNode; label: string; size?: number }) {
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  return (
    <div className="donut" style={{ background: `conic-gradient(${color} 0% ${p}%, #edf0f5 ${p}% 100%)`, height: size, width: size }}>
      <strong style={{ fontSize: 15 }}>{value}</strong>
      <small>{label}</small>
    </div>
  );
}

function DetailField({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ color: "var(--muted)", fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", marginBottom: 3, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 13, wordBreak: "break-word" }}>{children ?? "—"}</div>
    </div>
  );
}

function SectionHeader({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) {
  return (
    <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
      <div>
        <p style={{ color: "var(--primary)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: "0.14em", margin: "0 0 2px", textTransform: "uppercase" }}>{eyebrow}</p>
        <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>{title}</h2>
      </div>
      {action}
    </div>
  );
}

/* ─── Step 1 · Invitations ─── */

function TendersView({ rows, search, setSearch, openRegister, canRegister }: {
  rows: Row[];
  search: string;
  setSearch: (v: string) => void;
  openRegister: () => void;
  canRegister: boolean;
}) {
  const [stageFilter, setStageFilter] = useState("all");
  const [selected, setSelected] = useState<Row | null>(null);

  const active = rows.filter((r) => !["awarded", "regretted"].includes(String(r.stage)));
  const pipelineValue = active.reduce((s, r) => s + Number(r.estimated_value ?? 0), 0);
  const dueSoon = useMemo(() => {
    const cutoff = new Date().getTime() + 7 * 86400000;
    return rows.filter((r) => {
      if (["awarded", "regretted"].includes(String(r.stage))) return false;
      const d = new Date(String(r.submission_deadline)).getTime();
      if (Number.isNaN(d)) return false;
      return d <= cutoff;
    }).length;
  }, [rows]);

  const stages = useMemo(() => ["all", ...Array.from(new Set(rows.map((r) => String(r.stage)).filter(Boolean))).sort()], [rows]);
  const filtered = stageFilter === "all" ? rows : rows.filter((r) => String(r.stage) === stageFilter);

  return (
    <>
      <KpiStrip cols={4}>
        <KpiCard icon="📋" iconBg="rgba(124,58,237,0.12)" iconColor="#7c3aed" label="Active Tenders" value={active.length} sub={`${rows.length} registered total`} link="View register" onClick={() => setStageFilter("all")} />
        <KpiCard icon="💼" iconBg="rgba(16,185,129,0.12)" iconColor="#059669" label="Pipeline Value" value={money.format(pipelineValue)} sub="Open invitations" link="Review pipeline" onClick={() => setStageFilter("all")} />
        <KpiCard icon="⚖️" iconBg="rgba(245,158,11,0.12)" iconColor="#d97706" label="Awaiting Decision" value={rows.filter((r) => String(r.stage) === "decision").length} sub="Bid / no-bid gate" link="Open decisions" onClick={() => setStageFilter("decision")} />
        <KpiCard icon="⏳" iconBg="rgba(239,68,68,0.12)" iconColor="#dc2626" label="Due Within 7 Days" value={dueSoon} sub="Submission deadlines" link="Check deadlines" onClick={() => setStageFilter("all")} />
      </KpiStrip>

      <div className="data-panel">
        <div className="panel-title" style={{ borderBottom: "1px solid var(--line)" }}>
          <div style={{ alignItems: "center", display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 800 }}>Invitation Register</span>
            <span className="muted" style={{ fontSize: 12 }}>({filtered.length})</span>
            <div style={{ alignItems: "center", display: "flex", gap: 6, flexWrap: "wrap" }}>
              {stages.map((s) => (
                <button key={s} type="button" className={`btn sm ${stageFilter === s ? "primary" : "ghost"}`} style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => setStageFilter(s)}>
                  {s === "all" ? "All" : String(s).replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <SearchInput value={search} onChange={setSearch} placeholder="Search reference, title, client…" />
            {canRegister && <button type="button" className="btn primary sm" onClick={openRegister}>+ Register Invitation</button>}
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon="📨" title="No tender invitations" description="Register the first invitation or adjust your search and stage filters." action={canRegister ? <button type="button" className="btn primary sm" onClick={openRegister}>+ Register Invitation</button> : undefined} />
        ) : (
          <DataTable headers={["Tender No", "Title", "Client", "Category", "Budget", "Deadline", "Readiness", "Stage", "Actions"]}>
            {filtered.map((r) => (
              <tr key={String(r.id)}>
                <td><span className="mono" style={{ color: "#7c3aed", fontWeight: 700 }}>{String(r.reference ?? "—")}</span></td>
                <td>
                  <strong style={{ display: "block", fontSize: 12 }}>{String(r.title ?? "—")}</strong>
                  <small className="muted">{truncate(r.description, 46)}</small>
                </td>
                <td style={{ fontSize: 12 }}>{String(r.client ?? "—")}</td>
                <td style={{ fontSize: 12 }}>{String(r.category ?? "—")}</td>
                <td><span className="mono" style={{ fontSize: 12 }}>{money.format(Number(r.estimated_value ?? 0))}</span></td>
                <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>{fmtDateTime(r.submission_deadline)}</td>
                <td><ProgressBar pct={Number(r.readiness_score ?? 0)} /></td>
                <td><StagePill value={r.stage} /></td>
                <td>
                  <button type="button" className="btn ghost sm" onClick={() => setSelected(r)}>Details</button>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>

      {selected && (
        <DetailDrawer title={`${String(selected.reference ?? "Tender")} · Details`} onClose={() => setSelected(null)} width={400}>
          <DetailField label="Tender Reference"><span className="mono" style={{ color: "#7c3aed", fontWeight: 700 }}>{String(selected.reference ?? "—")}</span></DetailField>
          <DetailField label="Title">{String(selected.title ?? "—")}</DetailField>
          <DetailField label="Client">{String(selected.client ?? "—")}</DetailField>
          <DetailField label="Category">{String(selected.category ?? "—")}</DetailField>
          <DetailField label="Description">{String(selected.description ?? "—")}</DetailField>
          <div className="grid-2">
            <DetailField label="Estimated Value">{money.format(Number(selected.estimated_value ?? 0))}</DetailField>
            <DetailField label="Currency">{String(selected.currency ?? "KES")}</DetailField>
          </div>
          <DetailField label="Submission Deadline">{fmtDateTime(selected.submission_deadline)}</DetailField>
          <DetailField label="Clarification Deadline">{fmtDateTime(selected.clarification_deadline)}</DetailField>
          <DetailField label="Published On">{fmtDate(selected.published_on)}</DetailField>
          <DetailField label="Owner">{String(selected.owner_name ?? "—")}</DetailField>
          <DetailField label="Source">{String(selected.source ?? "—")}</DetailField>
          <DetailField label="Stage"><StagePill value={selected.stage} /></DetailField>
          <DetailField label="Readiness"><ProgressBar pct={Number(selected.readiness_score ?? 0)} /></DetailField>
          {selected.source_document_url ? (
            <a href={String(selected.source_document_url)} target="_blank" rel="noreferrer" className="btn primary sm">Open Source Document</a>
          ) : null}
        </DetailDrawer>
      )}

    </>
  );
}

/* ─── Step 2 · AI Requirement Analysis ─── */
function RequirementCard({ reqs, tender, confirmRow, canConfirm }: {
  reqs: Row[];
  tender: Row | undefined;
  confirmRow: (r: Row) => void;
  canConfirm: boolean;
}) {
  const categories = useMemo(() => {
    const c = new Map<string, Row[]>();
    reqs.forEach((r) => {
      const cat = String(r.category || "General");
      const list = c.get(cat);
      if (list) list.push(r);
      else c.set(cat, [r]);
    });
    return Array.from(c.entries());
  }, [reqs]);

  return (
    <article className="data-panel" style={{ padding: 18 }}>
      <div style={{ alignItems: "center", display: "flex", gap: 12, justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap" }}>
        <div>
          <span className="mono" style={{ color: "#7c3aed", fontSize: 12, fontWeight: 700 }}>{String(tender?.reference ?? "—")}</span>
          <h3 style={{ fontSize: 15, fontWeight: 800, margin: "2px 0 0" }}>{String(tender?.title ?? "Tender")}</h3>
          <small className="muted">{String(tender?.client ?? "—")}</small>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <Badge value="AI" tone="cyan" />
          <span className="muted" style={{ fontSize: 11 }}>{reqs.length} findings</span>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
        {categories.map(([cat, items]) => (
          <div key={cat} style={{ background: "var(--surface-2)", borderRadius: 8, border: "1px solid var(--line)", padding: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", margin: "0 0 10px", textTransform: "uppercase", color: "#7c3aed" }}>{cat} · {items.length}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {items.map((req) => (
                <div key={String(req.id)} style={{ borderLeft: `3px solid ${String(req.status) === "gap" ? "var(--danger)" : String(req.status) === "met" ? "var(--success)" : "var(--border-strong)"}`, paddingLeft: 10 }}>
                  <div style={{ fontSize: 12, lineHeight: 1.45 }}>{String(req.text ?? "—")}</div>
                  <div style={{ alignItems: "center", display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                    {Boolean(req.mandatory) && <Badge value="Mandatory" tone="orange" />}
                    <StatusPill value={String(req.status ?? "pending")} />
                    {req.confidence !== null && req.confidence !== undefined && <span className="mono" style={{ color: "var(--muted)", fontSize: 11 }}>{Number(req.confidence)}% conf.</span>}
                    {req.citation ? <span className="mono" style={{ color: "var(--muted)", fontSize: 10 }}>§ {String(req.citation)}</span> : null}
                    {req.model_version ? <span className="mono" style={{ color: "var(--muted)", fontSize: 10 }}>{String(req.model_version)}</span> : null}
                    {canConfirm && String(req.status) === "pending" && (
                      <button type="button" className="btn primary sm" style={{ marginLeft: "auto", fontSize: 11, padding: "4px 10px" }} onClick={() => confirmRow(req)}>Confirm</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function RequirementsView({ rows, search, setSearch, tenderIndex, confirmRow, canConfirm }: {
  rows: Row[];
  search: string;
  setSearch: (v: string) => void;
  tenderIndex: Row[];
  confirmRow: (r: Row) => void;
  canConfirm: boolean;
}) {
  const tenderById = useMemo(() => {
    const m = new Map<string, Row>();
    tenderIndex.forEach((t) => m.set(String(t.id), t));
    return m;
  }, [tenderIndex]);

  const groups = useMemo(() => {
    const g = new Map<string, Row[]>();
    rows.forEach((r) => {
      const id = String(r.tender);
      const list = g.get(id);
      if (list) list.push(r);
      else g.set(id, [r]);
    });
    return Array.from(g.entries()).sort((a, b) => String(tenderById.get(a[0])?.reference ?? a[0]).localeCompare(String(tenderById.get(b[0])?.reference ?? b[0])));
  }, [rows, tenderById]);

  const pendingTotal = rows.filter((r) => String(r.status) === "pending").length;

  return (
    <>
      <SectionHeader eyebrow="Step 2 · AI Analysis" title="Extracted Tender Intelligence" action={
        <div className="row" style={{ gap: 8 }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search requirement text, category…" />
        </div>
      } />

      <KpiStrip cols={4}>
        <KpiCard icon="🤖" iconBg="rgba(124,58,237,0.12)" iconColor="#7c3aed" label="Extracted Findings" value={rows.length} sub="Across analysed tenders" />
        <KpiCard icon="⚠️" iconBg="rgba(239,68,68,0.12)" iconColor="#dc2626" label="Awaiting Confirmation" value={pendingTotal} sub="Pending human sign-off" />
        <KpiCard icon="🧾" iconBg="rgba(16,185,129,0.12)" iconColor="#059669" label="Mandatory Clauses" value={rows.filter((r) => Boolean(r.mandatory)).length} sub="Hard compliance gates" />
        <KpiCard icon="📄" iconBg="rgba(59,130,246,0.12)" iconColor="#2563eb" label="Tenders Analysed" value={groups.length} sub="Distinct invitations" />
      </KpiStrip>

      {groups.length === 0 ? (
        <EmptyState icon="✨" title="No AI analyses yet" description="AI extraction output appears here per tender once invitations are analysed. Findings preserve confidence, citations and the model version used." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {groups.map(([tenderId, reqs]) => (
            <RequirementCard key={tenderId} reqs={reqs} tender={tenderById.get(tenderId)} confirmRow={confirmRow} canConfirm={canConfirm} />
          ))}
        </div>
      )}
    </>
  );
}

/* ─── Step 3 · Bid / No-Bid ─── */

function DecisionsView({ rows, search, setSearch, tenderIndex, openDecide, canDecide }: {
  rows: Row[];
  search: string;
  setSearch: (v: string) => void;
  tenderIndex: Row[];
  openDecide: (r: Row) => void;
  canDecide: boolean;
}) {
  const tenderById = useMemo(() => {
    const m = new Map<string, Row>();
    tenderIndex.forEach((t) => m.set(String(t.id), t));
    return m;
  }, [tenderIndex]);

  const approved = rows.filter((r) => String(r.decision) === "approved").length;
  const declined = rows.filter((r) => String(r.decision) === "declined").length;
  const pending = rows.filter((r) => String(r.decision) === "pending").length;
  const avgRisk = rows.length ? Math.round(rows.reduce((s, r) => s + Number(r.risk_score ?? 0), 0) / rows.length) : 0;

  return (
    <>
      <div className="data-panel">
        <div className="panel-title" style={{ borderBottom: "1px solid var(--line)" }}>
          <span style={{ fontSize: 13, fontWeight: 800 }}>Bid / No-Bid Register</span>
          <SearchInput value={search} onChange={setSearch} placeholder="Search tender title or rationale…" />
        </div>
        {rows.length === 0 ? (
          <EmptyState icon="⚖️" title="No bid decisions" description="Scored bid / no-bid recommendations appear here once tenders reach the decision gate." />
        ) : (
          <DataTable headers={["Tender", "Recommendation", "Eligibility", "Profitability", "Capacity", "Risk", "Decision", "Approved By", "Date", "Actions"]}>
            {rows.map((r) => (
              <tr key={String(r.id)}>
                <td>
                  <strong style={{ display: "block", fontSize: 12 }}>{String(tenderById.get(String(r.tender))?.title ?? "—")}</strong>
                  <small className="mono" style={{ fontSize: 10 }}>{String(tenderById.get(String(r.tender))?.reference ?? r.tender)}</small>
                </td>
                <td><StatusPill value={String(r.recommendation ?? "—")} tone={String(r.recommendation) === "bid" ? "green" : String(r.recommendation) === "no_bid" ? "red" : "yellow"} /></td>
                <td className="mono" style={{ fontSize: 12 }}>{Number(r.eligibility_score ?? 0)}</td>
                <td className="mono" style={{ fontSize: 12 }}>{Number(r.profitability_score ?? 0)}</td>
                <td className="mono" style={{ fontSize: 12 }}>{Number(r.capacity_score ?? 0)}</td>
                <td><ProgressBar pct={Number(r.risk_score ?? 0)} /></td>
                <td><StatusPill value={String(r.decision ?? "pending")} tone={String(r.decision) === "approved" ? "green" : String(r.decision) === "declined" ? "red" : "yellow"} /></td>
                <td style={{ fontSize: 12 }}>{String(r.decided_by ?? "—")}</td>
                <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>{fmtDateTime(r.decided_at)}</td>
                <td>
                  {canDecide && String(r.decision) === "pending" ? (
                    <button type="button" className="btn primary sm" onClick={() => openDecide(r)}>Decide</button>
                  ) : (
                    <span className="muted" style={{ fontSize: 11 }}>{String(r.rationale ?? "—") || "—"}</span>
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>

      <KpiStrip cols={4}>
        <KpiCard icon="✅" iconBg="rgba(16,185,129,0.12)" iconColor="#059669" label="Approved to Bid" value={approved} sub="Green-lit pursuits" />
        <KpiCard icon="🚫" iconBg="rgba(239,68,68,0.12)" iconColor="#dc2626" label="Declined" value={declined} sub="No-bid decisions" />
        <KpiCard icon="⏳" iconBg="rgba(245,158,11,0.12)" iconColor="#d97706" label="Pending" value={pending} sub="Awaiting board decision" />
        <KpiCard icon="⚠️" iconBg="rgba(124,58,237,0.12)" iconColor="#7c3aed" label="Avg. Risk Score" value={`${avgRisk}/100`} sub="Across decisions" />
      </KpiStrip>
    </>
  );
}

/* ─── Step 4 · Planning ─── */

function TasksView({ rows, search, setSearch, openTask, canTask }: {
  rows: Row[];
  search: string;
  setSearch: (v: string) => void;
  openTask: (r: Row) => void;
  canTask: boolean;
}) {
  const range = useMemo(() => {
    const valid = rows
      .map((r) => [new Date(String(r.starts_on)).getTime(), new Date(String(r.due_on)).getTime()])
      .filter(([a, b]) => !Number.isNaN(a) && !Number.isNaN(b) && a <= b);
    if (valid.length === 0) return null;
    const min = Math.min(...valid.map((d) => d[0]));
    const max = Math.max(...valid.map((d) => d[1]));
    return { min, max, span: Math.max(max - min, 86400000) };
  }, [rows]);

  const completed = rows.filter((r) => String(r.status) === "completed").length;
  const inProgress = rows.filter((r) => String(r.status) === "in_progress").length;
  const blocked = rows.filter((r) => String(r.status) === "blocked").length;

  return (
    <>
      <div className="data-panel">
        <div className="panel-title" style={{ borderBottom: "1px solid var(--line)" }}>
          <span style={{ fontSize: 13, fontWeight: 800 }}>Bid Plan Work Breakdown</span>
          <SearchInput value={search} onChange={setSearch} placeholder="Search task, tender, owner…" />
        </div>
        {rows.length === 0 ? (
          <EmptyState icon="📅" title="No planning tasks" description="Work breakdown, milestones and owners appear here once a bid plan is approved." />
        ) : (
          <DataTable headers={["Task", "Tender", "Milestone", "Owner", "Start", "Due", "Status", "Progress", "Actions"]}>
            {rows.map((r) => (
              <tr key={String(r.id)}>
                <td><strong style={{ fontSize: 12 }}>{String(r.title ?? "—")}</strong></td>
                <td style={{ fontSize: 12 }}>{String(r.tender_title ?? "—")}</td>
                <td><StatusPill value={String(r.stage ?? "—")} /></td>
                <td style={{ fontSize: 12 }}>{String(r.owner_name ?? "—")}</td>
                <td className="mono" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{fmtDate(r.starts_on)}</td>
                <td className="mono" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{fmtDate(r.due_on)}</td>
                <td><StatusPill value={String(r.status ?? "—")} /></td>
                <td><ProgressBar pct={Number(r.progress ?? 0)} /></td>
                <td>
                  {canTask && TASK_TRANSITIONS[String(r.status)]?.length ? (
                    <button type="button" className="btn ghost sm" onClick={() => openTask(r)}>Update</button>
                  ) : (
                    <span className="muted" style={{ fontSize: 11 }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>

      {range && rows.length > 0 && (
        <div className="data-panel" style={{ padding: 18 }}>
          <SectionHeader eyebrow="Gantt" title="Timeline View" />
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 720 }}>
              {rows.map((r) => {
                const start = new Date(String(r.starts_on)).getTime();
                const due = new Date(String(r.due_on)).getTime();
                if (Number.isNaN(start) || Number.isNaN(due)) return null;
                const left = ((start - range.min) / range.span) * 100;
                const width = ((due - start) / range.span) * 100;
                return (
                  <div key={String(r.id)} style={{ alignItems: "center", display: "grid", gridTemplateColumns: "220px 1fr", gap: 12, marginBottom: 8 }}>
                    <span style={{ fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{String(r.title ?? "—")}</span>
                    <div style={{ background: "var(--surface-2)", borderRadius: 4, height: 18, position: "relative" }}>
                      <div style={{ background: String(r.status) === "completed" ? "#10b981" : "#7c3aed", borderRadius: 4, height: "100%", left: `${Math.max(0, left)}%`, opacity: 0.85, position: "absolute", width: `${Math.max(3, width)}%` }} title={`${fmtDate(r.starts_on)} → ${fmtDate(r.due_on)}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <KpiStrip cols={4}>
        <KpiCard icon="✅" iconBg="rgba(16,185,129,0.12)" iconColor="#059669" label="Completed" value={completed} sub="Done tasks" />
        <KpiCard icon="⚙️" iconBg="rgba(59,130,246,0.12)" iconColor="#2563eb" label="In Progress" value={inProgress} sub="Active tasks" />
        <KpiCard icon="🚧" iconBg="rgba(239,68,68,0.12)" iconColor="#dc2626" label="Blocked" value={blocked} sub="Need unblocking" />
        <KpiCard icon="☑️" iconBg="rgba(124,58,237,0.12)" iconColor="#7c3aed" label="Total Tasks" value={rows.length} sub="Across bid plans" />
      </KpiStrip>
    </>
  );
}

/* ─── Step 5 · Company Documents ─── */

function CompanyDocumentsView({ rows, search, setSearch, setShowUploadDoc }: {
  rows: Row[];
  search: string;
  setSearch: (v: string) => void;
  setShowUploadDoc: () => void;
}) {
  const valid = rows.filter((r) => String(r.status) === "valid").length;
  const expiring = rows.filter((r) => String(r.status) === "expiring").length;
  const expired = rows.filter((r) => String(r.status) === "expired").length;

  return (
    <>
      <div className="data-panel">
        <div className="panel-title" style={{ borderBottom: "1px solid var(--line)" }}>
          <span style={{ fontSize: 13, fontWeight: 800 }}>Company Document Vault</span>
          <div className="row" style={{ gap: 8 }}>
            <SearchInput value={search} onChange={setSearch} placeholder="Search document, type, version…" />
            <button type="button" className="btn primary sm" onClick={setShowUploadDoc}>+ Upload Document</button>
          </div>
        </div>
        {rows.length === 0 ? (
          <EmptyState icon="🗄️" title="No vault documents" description="Reusable company documents — certificates, registrations and permits — appear here with expiry tracking. Vault evidence is immutable; upload a new version to replace a file." />
        ) : (
          <DataTable headers={["Document", "Type", "Version", "Issued", "Expiry", "Status", "Checksum", "Actions"]}>
            {rows.map((r) => (
              <tr key={String(r.id)}>
                <td><strong style={{ fontSize: 12 }}>{String(r.name ?? "—")}</strong></td>
                <td><StatusPill value={String(r.document_type ?? "—")} /></td>
                <td><span className="mono" style={{ fontSize: 12 }}>{String(r.version ?? "—")}</span></td>
                <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>{fmtDate(r.issued_on)}</td>
                <td><StatusPill value={String(r.expires_on ?? "—")} tone={String(r.status) === "valid" ? "green" : String(r.status) === "expiring" ? "yellow" : "red"} /></td>
                <td><StatusPill value={String(r.status ?? "—")} /></td>
                <td><span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>{truncate(r.checksum, 14)}</span></td>
                <td>
                  {r.file_url ? (
                    <a href={String(r.file_url)} target="_blank" rel="noreferrer" className="btn ghost sm">Download</a>
                  ) : (
                    <span className="muted" style={{ fontSize: 11 }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>

      <KpiStrip cols={3}>
        <KpiCard icon="✅" iconBg="rgba(16,185,129,0.12)" iconColor="#059669" label="Valid" value={valid} sub="In date documents" />
        <KpiCard icon="⏰" iconBg="rgba(245,158,11,0.12)" iconColor="#d97706" label="Expiring Soon" value={expiring} sub="Within 30 days" />
        <KpiCard icon="⛔" iconBg="rgba(239,68,68,0.12)" iconColor="#dc2626" label="Expired" value={expired} sub="Need renewal" />
      </KpiStrip>
    </>
  );
}

/* ─── Step 6 · Technical Proposal ─── */

function ProposalsView({ rows, search, setSearch, openProposal, canPropose }: {
  rows: Row[];
  search: string;
  setSearch: (v: string) => void;
  openProposal: (r: Row) => void;
  canPropose: boolean;
}) {
  const approved = rows.filter((r) => String(r.status) === "approved").length;
  const inReview = rows.filter((r) => String(r.status) === "review").length;
  const drafts = rows.filter((r) => String(r.status) === "draft").length;

  return (
    <>
      <div className="data-panel">
        <div className="panel-title" style={{ borderBottom: "1px solid var(--line)" }}>
          <span style={{ fontSize: 13, fontWeight: 800 }}>Technical Proposal Sections</span>
          <SearchInput value={search} onChange={setSearch} placeholder="Search section, tender, owner…" />
        </div>
        {rows.length === 0 ? (
          <EmptyState icon="📝" title="No proposal sections" description="Technical, financial and form sections with owners, versions and AI-assisted drafting appear here." />
        ) : (
          <DataTable headers={["Section", "Tender", "Type", "Owner", "Version", "AI Assisted", "Status", "Actions"]}>
            {rows.map((r) => (
              <tr key={String(r.id)}>
                <td>
                  <strong style={{ display: "block", fontSize: 12 }}>{String(r.title ?? "—")}</strong>
                  <small className="muted">{truncate(r.content, 42)}</small>
                </td>
                <td style={{ fontSize: 12 }}>{String(r.tender_title ?? "—")}</td>
                <td><StatusPill value={String(r.section_type ?? "—")} tone={String(r.section_type) === "technical" ? "blue" : String(r.section_type) === "financial" ? "purple" : "cyan"} /></td>
                <td style={{ fontSize: 12 }}>{String(r.owner_name ?? "—")}</td>
                <td><span className="mono" style={{ fontSize: 12 }}>v{Number(r.version ?? 1)}</span></td>
                <td>{Boolean(r.ai_assisted) ? <Badge value="AI" tone="cyan" /> : <span className="muted" style={{ fontSize: 11 }}>—</span>}</td>
                <td><StatusPill value={String(r.status ?? "draft")} /></td>
                <td>
                  {canPropose && PROPOSAL_TRANSITIONS[String(r.status)]?.length ? (
                    <button type="button" className="btn ghost sm" onClick={() => openProposal(r)}>Review</button>
                  ) : (
                    <span className="muted" style={{ fontSize: 11 }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>

      <KpiStrip cols={4}>
        <KpiCard icon="✅" iconBg="rgba(16,185,129,0.12)" iconColor="#059669" label="Approved" value={approved} sub="Immutable sections" />
        <KpiCard icon="🔍" iconBg="rgba(245,158,11,0.12)" iconColor="#d97706" label="In Review" value={inReview} sub="Pending approval" />
        <KpiCard icon="📝" iconBg="rgba(59,130,246,0.12)" iconColor="#2563eb" label="Drafts" value={drafts} sub="Work in progress" />
        <KpiCard icon="🤖" iconBg="rgba(124,58,237,0.12)" iconColor="#7c3aed" label="AI Assisted" value={rows.filter((r) => Boolean(r.ai_assisted)).length} sub="Drafted sections" />
      </KpiStrip>
    </>
  );
}

/* ─── Step 7 · Financial Proposal ─── */

function FinancialItemsView({ rows, search, setSearch, onApprove, canPrice }: {
  rows: Row[];
  search: string;
  setSearch: (v: string) => void;
  onApprove: (r: Row) => void;
  canPrice: boolean;
}) {
  const total = rows.reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const approvedValue = rows.filter((r) => Boolean(r.approved)).reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const approvedCount = rows.filter((r) => Boolean(r.approved)).length;
  const unapproved = rows.filter((r) => !Boolean(r.approved)).length;

  return (
    <>
      <div className="data-panel">
        <div className="panel-title" style={{ borderBottom: "1px solid var(--line)" }}>
          <span style={{ fontSize: 13, fontWeight: 800 }}>BOQ · Bill of Quantities</span>
          <SearchInput value={search} onChange={setSearch} placeholder="Search code, description, tender…" />
        </div>
        {rows.length === 0 ? (
          <EmptyState icon="💰" title="No BOQ items" description="Priced line items with quantities, unit rates and server-calculated totals appear here. Approved pricing is immutable." />
        ) : (
          <DataTable headers={["Code", "Description", "Tender", "Qty", "Unit", "Unit Rate", "Total", "Status", "Actions"]}>
            {rows.map((r) => (
              <tr key={String(r.id)}>
                <td><span className="mono" style={{ color: "#7c3aed", fontSize: 12, fontWeight: 700 }}>{String(r.code ?? "—")}</span></td>
                <td style={{ fontSize: 12 }}>{String(r.description ?? "—")}</td>
                <td style={{ fontSize: 12 }}>{String(r.tender_title ?? "—")}</td>
                <td className="mono" style={{ fontSize: 12 }}>{Number(r.quantity ?? 0)}</td>
                <td style={{ fontSize: 12 }}>{String(r.unit ?? "—")}</td>
                <td><span className="mono" style={{ fontSize: 12 }}>{money.format(Number(r.unit_rate ?? 0))}</span></td>
                <td><span className="mono" style={{ fontSize: 12, fontWeight: 700 }}>{money.format(Number(r.amount ?? 0))}</span></td>
                <td>{Boolean(r.approved) ? <StatusPill value="approved" /> : <StatusPill value="pending" />}</td>
                <td>
                  {canPrice && !Boolean(r.approved) ? (
                    <button type="button" className="btn primary sm" onClick={() => onApprove(r)}>Approve</button>
                  ) : (
                    <span className="muted" style={{ fontSize: 11 }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>

      <div className="grid-2">
        <div className="data-panel" style={{ padding: 18 }}>
          <SectionHeader eyebrow="Pricing" title="Total Bid Summary" />
          <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
            <Donut pct={total ? Math.round((approvedValue / total) * 100) : 0} color="#7c3aed" value={total ? `${Math.round((approvedValue / total) * 100)}%` : "0%"} label="Approved" />
            <div style={{ flex: 1, minWidth: 200 }}>
              <DetailField label="Total Bid Value">{money.format(total)}</DetailField>
              <DetailField label="Approved Value">{money.format(approvedValue)}</DetailField>
              <DetailField label="Line Items">{rows.length} total · {approvedCount} approved · {unapproved} pending</DetailField>
            </div>
          </div>
        </div>
        <div className="data-panel" style={{ padding: 18 }}>
          <SectionHeader eyebrow="Restricted" title="Pricing Controls" />
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>
              Totals are computed server-side as <span className="mono">quantity × unit_rate</span>. Only approved items count toward packaging, and approved pricing cannot be overwritten.
            </p>
            <div style={{ background: "var(--surface-2)", borderRadius: 8, border: "1px solid var(--line)", padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                <span className="muted">Approval coverage</span>
                <strong>{total ? Math.round((approvedValue / total) * 100) : 0}%</strong>
              </div>
              <div className="progress"><span style={{ width: `${total ? Math.round((approvedValue / total) * 100) : 0}%` }} /></div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Step 8 · Review & Approval ─── */

function ReviewsView({ rows, search, setSearch, tenderIndex, openReview, canReview }: {
  rows: Row[];
  search: string;
  setSearch: (v: string) => void;
  tenderIndex: Row[];
  openReview: (r: Row) => void;
  canReview: boolean;
}) {
  const tenderById = useMemo(() => {
    const m = new Map<string, Row>();
    tenderIndex.forEach((t) => m.set(String(t.id), t));
    return m;
  }, [tenderIndex]);

  const approved = rows.filter((r) => String(r.status) === "approved").length;
  const pending = rows.filter((r) => String(r.status) === "pending").length;
  const changes = rows.filter((r) => String(r.status) === "changes").length;

  return (
    <>
      <div className="data-panel">
        <div className="panel-title" style={{ borderBottom: "1px solid var(--line)" }}>
          <span style={{ fontSize: 13, fontWeight: 800 }}>Review Gates</span>
          <SearchInput value={search} onChange={setSearch} placeholder="Search gate, tender, comments…" />
        </div>
        {rows.length === 0 ? (
          <EmptyState icon="✅" title="No review gates" description="Final readiness gates with executive summary, tender readiness and approval workflow appear here." />
        ) : (
          <DataTable headers={["Tender", "Gate", "Executive Summary", "Readiness", "Reviewer", "Status", "Reviewed At", "Actions"]}>
            {rows.map((r) => (
              <tr key={String(r.id)}>
                <td style={{ fontSize: 12 }}>{String(r.tender_title ?? "—")}</td>
                <td><StatusPill value={String(r.gate ?? "—")} /></td>
                <td style={{ fontSize: 12 }}>{truncate(r.comments, 60) || "—"}</td>
                <td><ProgressBar pct={Number(tenderById.get(String(r.tender))?.readiness_score ?? 0)} /></td>
                <td style={{ fontSize: 12 }}>{String(r.reviewer_name ?? "—")}</td>
                <td><StatusPill value={String(r.status ?? "pending")} /></td>
                <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>{fmtDateTime(r.reviewed_at)}</td>
                <td>
                  {canReview && String(r.status) === "pending" ? (
                    <button type="button" className="btn primary sm" onClick={() => openReview(r)}>Approve / Reject</button>
                  ) : (
                    <span className="muted" style={{ fontSize: 11 }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>

      <KpiStrip cols={3}>
        <KpiCard icon="✅" iconBg="rgba(16,185,129,0.12)" iconColor="#059669" label="Approved Gates" value={approved} sub="Passed review" />
        <KpiCard icon="⏳" iconBg="rgba(245,158,11,0.12)" iconColor="#d97706" label="Pending" value={pending} sub="Awaiting approver" />
        <KpiCard icon="🔁" iconBg="rgba(239,68,68,0.12)" iconColor="#dc2626" label="Changes Required" value={changes} sub="Returned for edits" />
      </KpiStrip>
    </>
  );
}

/* ─── Step 9 · Packaging ─── */

function PackagingView({ rows, search, setSearch, tenderIndex }: {
  rows: Row[];
  search: string;
  setSearch: (v: string) => void;
  tenderIndex: Row[];
}) {
  const [selected, setSelected] = useState<Row | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const tenderById = useMemo(() => {
    const m = new Map<string, Row>();
    tenderIndex.forEach((t) => m.set(String(t.id), t));
    return m;
  }, [tenderIndex]);

  const readyToSubmit = rows.filter((r) => String(r.status) === "ready").length;
  const pendingAssembly = rows.filter((r) => String(r.status) === "draft" || String(r.status) === "assembling").length;
  const submitted = rows.filter((r) => String(r.status) === "submitted").length;

  const handleAutoGenerateTOC = useCallback(() => {
    const toc = rows.map((r, i) => `${i + 1}. ${String(r.package_ref ?? r.id)} — ${String(r.tender_title ?? tenderById.get(String(r.tender))?.title ?? "Tender")}`).join("\n");
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(`<html><head><title>Table of Contents</title><style>body{font-family:monospace;padding:40px;font-size:13px}h1{font-size:16px}pre{white-space:pre-wrap}</style></head><body><h1>Package — Table of Contents</h1><pre>${toc}</pre></body></html>`);
      w.document.close();
    }
  }, [rows, tenderById]);

  const handleExportPDF = useCallback(() => {
    const csvRows = [["Package Ref", "Tender", "Sections", "TOC Generated", "Status"]];
    rows.forEach((r) => {
      csvRows.push([
        String(r.package_ref ?? ""),
        String(r.tender_title ?? tenderById.get(String(r.tender))?.title ?? ""),
        String(r.sections_count ?? 0),
        r.toc_generated ? "Yes" : "No",
        String(r.status ?? ""),
      ]);
    });
    const csv = csvRows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tender-packages.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [rows, tenderById]);

  const handleSubmitPackage = useCallback(async (pkg: Row) => {
    if (!window.confirm(`Submit package ${String(pkg.package_ref ?? pkg.id)}? This will record it as submitted.`)) return;
    await apiFetch("/auth/csrf/");
    const res = await apiFetch("/tender/submissions/", {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify({
        tender: pkg.tender,
        channel: "Portal",
        receipt_reference: `PKG-${String(pkg.package_ref ?? pkg.id)}`,
        package_version: "v1.0",
        package_checksum: `SHA-${Date.now()}`,
        compliant: true,
      }),
    }, null);
    if (res.ok) {
      window.location.reload();
    }
  }, []);

  return (
    <>
      <SectionHeader eyebrow="Step 9 · Packaging" title="Tender Packages" action={
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn ghost sm" onClick={handleAutoGenerateTOC}>Auto-generate TOC</button>
          <button type="button" className="btn ghost sm" onClick={handleExportPDF}>Export as CSV</button>
          <button type="button" className="btn primary sm" onClick={() => setCreateOpen(true)}>+ Create Package</button>
        </div>
      } />

      <KpiStrip cols={4}>
        <KpiCard icon="📦" iconBg="rgba(124,58,237,0.12)" iconColor="#7c3aed" label="Total Packages" value={rows.length} sub="Created packages" />
        <KpiCard icon="✅" iconBg="rgba(16,185,129,0.12)" iconColor="#059669" label="Ready to Submit" value={readyToSubmit} sub="Awaiting submission" />
        <KpiCard icon="🔧" iconBg="rgba(245,158,11,0.12)" iconColor="#d97706" label="Pending Assembly" value={pendingAssembly} sub="In progress" />
        <KpiCard icon="📤" iconBg="rgba(59,130,246,0.12)" iconColor="#2563eb" label="Submitted" value={submitted} sub="Delivered" />
      </KpiStrip>

      <div className="data-panel">
        <div className="panel-title" style={{ borderBottom: "1px solid var(--line)" }}>
          <span style={{ fontSize: 13, fontWeight: 800 }}>Package Register</span>
          <SearchInput value={search} onChange={setSearch} placeholder="Search package ref, tender…" />
        </div>
        {rows.length === 0 ? (
          <EmptyState icon="📦" title="No packages created" description="Create a package to assemble approved proposal sections and financial items into a submission-ready bundle." action={<button type="button" className="btn primary sm" onClick={() => setCreateOpen(true)}>+ Create Package</button>} />
        ) : (
          <DataTable headers={["Package Ref", "Tender", "Sections", "TOC Generated", "Status", "Actions"]}>
            {rows.map((r) => (
              <tr key={String(r.id)}>
                <td><span className="mono" style={{ color: "#7c3aed", fontWeight: 700 }}>{String(r.package_ref ?? `PKG-${String(r.id)}`)}</span></td>
                <td style={{ fontSize: 12 }}>{String(r.tender_title ?? tenderById.get(String(r.tender))?.title ?? "—")}</td>
                <td className="mono" style={{ fontSize: 12 }}>{Number(r.sections_count ?? 0)}</td>
                <td>{r.toc_generated ? <Badge value="Yes" tone="green" /> : <StatusPill value="No" tone="gray" />}</td>
                <td><StatusPill value={String(r.status ?? "draft")} tone={String(r.status) === "ready" || String(r.status) === "submitted" ? "green" : String(r.status) === "submitted" ? "blue" : "yellow"} /></td>
                <td>
                  <div className="row" style={{ gap: 4 }}>
                    <button type="button" className="btn ghost sm" onClick={() => setSelected(r)}>Details</button>
                    {String(r.status) === "ready" && <button type="button" className="btn primary sm" onClick={() => handleSubmitPackage(r)}>Submit</button>}
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>

      {selected && (
        <DetailDrawer title={`Package ${String(selected.package_ref ?? selected.id)} · Details`} onClose={() => setSelected(null)} width={420}>
          <DetailField label="Package Reference"><span className="mono" style={{ color: "#7c3aed", fontWeight: 700 }}>{String(selected.package_ref ?? `PKG-${String(selected.id)}`)}</span></DetailField>
          <DetailField label="Tender">{String(selected.tender_title ?? tenderById.get(String(selected.tender))?.title ?? "—")}</DetailField>
          <DetailField label="Sections Included">{String(selected.sections_count ?? 0)}</DetailField>
          <DetailField label="TOC Generated">{selected.toc_generated ? "Yes" : "No"}</DetailField>
          <DetailField label="Status"><StatusPill value={String(selected.status ?? "draft")} /></DetailField>
          {selected.status === "ready" && (
            <button type="button" className="btn primary" style={{ marginTop: 12 }} onClick={() => handleSubmitPackage(selected)}>Submit Package</button>
          )}
        </DetailDrawer>
      )}

      {createOpen && (
        <CreatePackageModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          tenders={tenderIndex}
          onSubmit={async (payload) => {
            await apiFetch("/auth/csrf/");
            const res = await apiFetch("/tender/packages/", {
              method: "POST",
              headers: { "X-CSRFToken": csrfFromCookie() },
              body: JSON.stringify(payload),
            }, null);
            if (res.ok) {
              setCreateOpen(false);
              window.location.reload();
            }
          }}
          error=""
        />
      )}
    </>
  );
}

function CreatePackageModal({ open, onClose, tenders, onSubmit, error }: {
  open: boolean;
  onClose: () => void;
  tenders: Row[];
  onSubmit: (payload: Record<string, string>) => void;
  error: string;
}) {
  if (!open) return null;
  const eligible = tenders.filter((t) => String(t.stage) === "review" || String(t.stage) === "packaging");
  return (
    <Modal title="+ Create Package · Step 9" onClose={onClose} wide>
      <FormError error={error} />
      {eligible.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>No tenders are at the review or packaging stage. Advance a tender through review & approval first.</p>
      ) : (
        <form onSubmit={(e) => {
          e.preventDefault();
          onSubmit(Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>);
        }}>
          <Field label="Tender" required>
            <select name="tender" required defaultValue="">
              <option value="" disabled>Select tender…</option>
              {eligible.map((t) => <option key={String(t.id)} value={String(t.id)}>{String(t.reference ?? "—")} · {String(t.title ?? "—")}</option>)}
            </select>
          </Field>
          <Field label="Package Reference" required>
            <input name="package_ref" required placeholder="e.g. PKG-2026-001" />
          </Field>
          <Field label="Sections to Include">
            <textarea name="sections_description" rows={2} placeholder="List section titles to include, one per line, or leave blank for all approved sections" />
          </Field>
          <div className="modal-actions">
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn primary">Create Package</button>
          </div>
        </form>
      )}
    </Modal>
  );
}

/* ─── Step 10 · Submission ─── */

function SubmissionsView({ rows, search, setSearch, openRecord, canRecord }: {
  rows: Row[];
  search: string;
  setSearch: (v: string) => void;
  openRecord: () => void;
  canRecord: boolean;
}) {
  const [selected, setSelected] = useState<Row | null>(null);
  const recorded = rows.length;

  return (
    <>
      <div className="data-panel">
        <div className="panel-title" style={{ borderBottom: "1px solid var(--line)" }}>
          <span style={{ fontSize: 13, fontWeight: 800 }}>Packaging & Submission Receipts</span>
          <div className="row" style={{ gap: 8 }}>
            <SearchInput value={search} onChange={setSearch} placeholder="Search tender, receipt reference…" />
            {canRecord && <button type="button" className="btn primary sm" onClick={openRecord}>+ Record Submission</button>}
          </div>
        </div>
        {rows.length === 0 ? (
          <EmptyState icon="📦" title="No submissions recorded" description="Record a submission once the approved package reaches the packaging stage. Submission receipts are immutable." action={canRecord ? <button type="button" className="btn primary sm" onClick={openRecord}>+ Record Submission</button> : undefined} />
        ) : (
          <DataTable headers={["Tender", "Submitted At", "Channel", "Reference", "Package", "Received", "Actions"]}>
            {rows.map((r) => (
              <tr key={String(r.id)}>
                <td><strong style={{ fontSize: 12 }}>{String(r.tender_title ?? "—")}</strong></td>
                <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>{fmtDateTime(r.submitted_at)}</td>
                <td><StatusPill value={String(r.channel ?? "—")} /></td>
                <td><span className="mono" style={{ fontSize: 12, color: "#7c3aed", fontWeight: 700 }}>{String(r.receipt_reference ?? "—")}</span></td>
                <td><span className="mono" style={{ fontSize: 11 }}>v{String(r.package_version ?? "—")}</span></td>
                <td>{Boolean(r.compliant) ? <StatusPill value="received" /> : <StatusPill value="incomplete" />}</td>
                <td>
                  <button type="button" className="btn ghost sm" onClick={() => setSelected(r)}>Details</button>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>

      <KpiStrip cols={3}>
        <KpiCard icon="📦" iconBg="rgba(124,58,237,0.12)" iconColor="#7c3aed" label="Recorded Submissions" value={recorded} sub="Packaged bids delivered" />
        <KpiCard icon="🧾" iconBg="rgba(16,185,129,0.12)" iconColor="#059669" label="Compliant" value={rows.filter((r) => Boolean(r.compliant)).length} sub="Acknowledgements held" />
        <KpiCard icon="🔒" iconBg="rgba(59,130,246,0.12)" iconColor="#2563eb" label="Immutable Receipts" value={rows.length} sub="Evidence cannot be edited" />
      </KpiStrip>

      {selected && (
        <DetailDrawer title="Submission Receipt" onClose={() => setSelected(null)} width={400}>
          <DetailField label="Tender">{String(selected.tender_title ?? "—")}</DetailField>
          <DetailField label="Channel">{String(selected.channel ?? "—")}</DetailField>
          <DetailField label="Submitted At">{fmtDateTime(selected.submitted_at)}</DetailField>
          <DetailField label="Submitted By">{String(selected.submitted_by ?? "—")}</DetailField>
          <DetailField label="Receipt Reference"><span className="mono">{String(selected.receipt_reference ?? "—")}</span></DetailField>
          <DetailField label="Package Version"><span className="mono">v{String(selected.package_version ?? "—")}</span></DetailField>
          <DetailField label="Package Checksum"><span className="mono" style={{ fontSize: 11 }}>{String(selected.package_checksum ?? "—")}</span></DetailField>
          <DetailField label="Compliant">{Boolean(selected.compliant) ? "Yes" : "No"}</DetailField>
          {selected.acknowledgement_url ? (
            <a href={String(selected.acknowledgement_url)} target="_blank" rel="noreferrer" className="btn primary sm">Open Acknowledgement</a>
          ) : null}
        </DetailDrawer>
      )}
    </>
  );
}

/* ─── Step 11 · Award / Regret ─── */

function OutcomesView({ rows, search, setSearch, tenderIndex, openRecord, canRecord }: {
  rows: Row[];
  search: string;
  setSearch: (v: string) => void;
  tenderIndex: Row[];
  openRecord: () => void;
  canRecord: boolean;
}) {
  const tenderById = useMemo(() => {
    const m = new Map<string, Row>();
    tenderIndex.forEach((t) => m.set(String(t.id), t));
    return m;
  }, [tenderIndex]);

  const [selected, setSelected] = useState<Row | null>(null);
  const awarded = rows.filter((r) => String(r.result) === "awarded").length;
  const regretted = rows.filter((r) => String(r.result) === "regretted").length;
  const cancelled = rows.filter((r) => String(r.result) === "cancelled").length;

  return (
    <>
      <div className="data-panel">
        <div className="panel-title" style={{ borderBottom: "1px solid var(--line)" }}>
          <span style={{ fontSize: 13, fontWeight: 800 }}>Outcomes & Lessons Learned</span>
          <div className="row" style={{ gap: 8 }}>
            <SearchInput value={search} onChange={setSearch} placeholder="Search tender, winner, feedback…" />
            {canRecord && <button type="button" className="btn primary sm" onClick={openRecord}>+ Record Outcome</button>}
          </div>
        </div>
        {rows.length === 0 ? (
          <EmptyState icon="🏆" title="No outcomes recorded" description="Award, regret and cancellation outcomes with notified dates and lessons learned appear here." action={canRecord ? <button type="button" className="btn primary sm" onClick={openRecord}>+ Record Outcome</button> : undefined} />
        ) : (
          <DataTable headers={["Tender", "Outcome", "Award Amount", "Client", "Notified On", "Winner", "Lessons", "Actions"]}>
            {rows.map((r) => (
              <tr key={String(r.id)}>
                <td><strong style={{ fontSize: 12 }}>{String(r.tender_title ?? "—")}</strong></td>
                <td><StatusPill value={String(r.result ?? "—")} tone={String(r.result) === "awarded" ? "green" : String(r.result) === "regretted" ? "red" : "gray"} /></td>
                <td><span className="mono" style={{ fontSize: 12 }}>{r.awarded_value ? money.format(Number(r.awarded_value)) : "—"}</span></td>
                <td style={{ fontSize: 12 }}>{String(tenderById.get(String(r.tender))?.client ?? "—")}</td>
                <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>{fmtDate(r.notified_on)}</td>
                <td style={{ fontSize: 12 }}>{String(r.winner ?? "—")}</td>
                <td style={{ fontSize: 12 }}>{truncate(r.lessons_learned, 60) || "—"}</td>
                <td>
                  <button type="button" className="btn ghost sm" onClick={() => setSelected(r)}>Details</button>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>

      <KpiStrip cols={3}>
        <KpiCard icon="🏆" iconBg="rgba(16,185,129,0.12)" iconColor="#059669" label="Awarded" value={awarded} sub="Won tenders" />
        <KpiCard icon="💔" iconBg="rgba(239,68,68,0.12)" iconColor="#dc2626" label="Regretted" value={regretted} sub="Lost tenders" />
        <KpiCard icon="🚫" iconBg="rgba(245,158,11,0.12)" iconColor="#d97706" label="Cancelled" value={cancelled} sub="Withdrawn" />
      </KpiStrip>

      {selected && (
        <DetailDrawer title="Outcome Record" onClose={() => setSelected(null)} width={400}>
          <DetailField label="Tender">{String(selected.tender_title ?? "—")}</DetailField>
          <DetailField label="Result"><StatusPill value={String(selected.result ?? "—")} /></DetailField>
          <DetailField label="Notified On">{fmtDate(selected.notified_on)}</DetailField>
          <DetailField label="Awarded Value">{selected.awarded_value ? money.format(Number(selected.awarded_value)) : "—"}</DetailField>
          <DetailField label="Winner">{String(selected.winner ?? "—")}</DetailField>
          <DetailField label="Feedback">{String(selected.feedback ?? "—")}</DetailField>
          <DetailField label="Lessons Learned">{String(selected.lessons_learned ?? "—")}</DetailField>
        </DetailDrawer>
      )}
    </>
  );
}

/* ─── Reports ─── */

function ReportsView({ analytics, reports, recentExports, onExport }: {
  analytics: Analytics | null;
  reports: { key: string; name: string }[];
  recentExports: { key: string; name: string; exportedAt: string }[];
  onExport: (key: string, name: string) => void;
}) {
  const metrics = analytics?.metrics;

  return (
    <>
      <SectionHeader eyebrow="Insights" title="Report Catalogue" />
      <KpiStrip cols={4}>
        <KpiCard icon="📤" iconBg="rgba(59,130,246,0.12)" iconColor="#2563eb" label="Submitted Bids" value={metrics?.submitted ?? 0} sub="To client" />
        <KpiCard icon="🏆" iconBg="rgba(16,185,129,0.12)" iconColor="#059669" label="Awarded" value={metrics?.awarded ?? 0} sub="Won tenders" />
        <KpiCard icon="💔" iconBg="rgba(239,68,68,0.12)" iconColor="#dc2626" label="Regretted" value={metrics?.regretted ?? 0} sub="Lost tenders" />
        <KpiCard icon="📈" iconBg="rgba(124,58,237,0.12)" iconColor="#7c3aed" label="Win Rate" value={`${metrics?.winRate ?? 0}%`} sub="Of closed tenders" />
      </KpiStrip>

      <div className="grid-2">
        <div className="data-panel" style={{ padding: 18 }}>
          <SectionHeader eyebrow="Downloadable" title="CSV Registers" />
          {reports.length === 0 ? (
            <EmptyState icon="📊" title="No reports available" description="Analytics reports will appear here once tender data exists." />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
              {reports.map((r) => (
                <div key={r.key} className="card" style={{ display: "flex", flexDirection: "column", gap: 10, padding: 16 }}>
                  <span style={{ fontSize: 22 }}>{r.key === "pipeline" ? "🔀" : r.key === "requirements" ? "🧾" : r.key === "tasks" ? "📅" : r.key === "pricing" ? "💰" : "🏆"}</span>
                  <strong style={{ fontSize: 13, lineHeight: 1.35 }}>{r.name}</strong>
                  <small className="muted" style={{ fontSize: 11 }}>tender-{r.key}.csv</small>
                  <button type="button" className="btn ghost sm" onClick={() => onExport(r.key, r.name)}>↓ Export CSV</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="data-panel" style={{ padding: 18 }}>
          <SectionHeader eyebrow="Activity" title="Recent Reports" />
          {recentExports.length === 0 ? (
            <EmptyState icon="🕘" title="No recent exports" description="Reports you generate this session are listed here." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {recentExports.map((e, i) => (
                <div key={i} style={{ alignItems: "center", borderBottom: "1px solid var(--line)", display: "flex", gap: 10, padding: "12px 0" }}>
                  <span style={{ fontSize: 16 }}>📄</span>
                  <div style={{ flex: 1 }}>
                    <strong style={{ display: "block", fontSize: 12 }}>{e.name}</strong>
                    <small className="muted">{fmtDateTime(e.exportedAt)} · tender-{e.key}.csv</small>
                  </div>
                  <button type="button" className="btn ghost sm" onClick={() => onExport(e.key, e.name)}>Re-export</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ─── Audit Trail ─── */

function AuditEventsView({ rows, search, setSearch }: {
  rows: Row[];
  search: string;
  setSearch: (v: string) => void;
}) {
  return (
    <div className="data-panel">
      <div className="panel-title" style={{ borderBottom: "1px solid var(--line)" }}>
        <span style={{ fontSize: 13, fontWeight: 800 }}>Audit Events</span>
        <SearchInput value={search} onChange={setSearch} placeholder="Search reference, event, notes…" />
      </div>
      {rows.length === 0 ? (
        <EmptyState icon="🛡️" title="No audit events" description="Stage transitions, bid decisions, requirement confirmations and submission events are recorded here." />
      ) : (
        <DataTable headers={["Timestamp", "User", "Action", "Tender", "Transition", "Detail"]}>
          {rows.map((r) => (
            <tr key={String(r.id)}>
              <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>{fmtDateTime(r.created_at)}</td>
              <td><span className="mono" style={{ fontSize: 12 }}>{String(r.actor_name ?? "—")}</span></td>
              <td><StatusPill value={String(r.event_type ?? "—")} tone={String(r.event_type).includes("reject") || String(r.event_type).includes("regret") ? "red" : String(r.event_type).includes("submitted") || String(r.event_type).includes("approved") ? "green" : String(r.event_type).includes("pending") ? "yellow" : "blue"} /></td>
              <td><span className="mono" style={{ fontSize: 12, color: "#7c3aed" }}>{String(r.tender_reference ?? "—")}</span></td>
              <td style={{ fontSize: 12 }}>
                {r.from_stage && r.to_stage ? (
                  <span className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                    <StagePill value={r.from_stage} /> <span style={{ color: "var(--muted)" }}>→</span> <StagePill value={r.to_stage} />
                  </span>
                ) : (
                  <span className="muted" style={{ fontSize: 11 }}>—</span>
                )}
              </td>
              <td style={{ fontSize: 12 }}>{truncate(r.notes || fmtDetail(r.details), 70)}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}

/* ─── Overview ─── */

function OverviewView({ dash, setTab, openRegister, canRegister }: {
  dash: Dashboard;
  setTab: (t: TenderTab) => void;
  openRegister: () => void;
  canRegister: boolean;
}) {
  const kpis = dash.kpis ?? {};
  const funnel = dash.stageFunnel ?? [];
  const stageCount = (s: string) => funnel.find((f) => f.stage === s)?.count ?? 0;

  const active = Number(kpis.activeTenders ?? 0);
  const pipelineValue = Number(kpis.pipelineValue ?? 0);
  const drafted = stageCount("invitation");
  const submitted = Number(kpis.submitted ?? 0);
  const won = stageCount("awarded");
  const regretted = stageCount("regretted");
  const awardRate = won + regretted > 0 ? Math.round((won / (won + regretted)) * 100) : 0;
  const compliance = funnel.length ? Math.round(stageCount("submitted") / funnel.reduce((s, f) => s + f.count, 0) * 100) : 0;

  const steps: { label: string; tab: TenderTab }[] = [
    { label: "Invitation", tab: "tenders" },
    { label: "AI Analysis", tab: "requirements" },
    { label: "Bid / No-Bid", tab: "decisions" },
    { label: "Planning", tab: "tasks" },
    { label: "Company Documents", tab: "company-documents" },
    { label: "Technical Proposal", tab: "proposals" },
    { label: "Financial Proposal", tab: "financial-items" },
    { label: "Review", tab: "reviews" },
    { label: "Packaging", tab: "packaging" },
    { label: "Submission", tab: "submissions" },
    { label: "Award / Regret", tab: "outcomes" },
  ];

  return (
    <>
      <KpiStrip cols={6}>
        <KpiCard icon="📋" iconBg="rgba(124,58,237,0.12)" iconColor="#7c3aed" label="Active Tenders" value={active} sub={`${Number(kpis.dueThisWeek ?? 0)} due this week`} link="Open register" onClick={() => setTab("tenders")} />
        <KpiCard icon="💼" iconBg="rgba(16,185,129,0.12)" iconColor="#059669" label="Pipeline Value" value={money.format(pipelineValue)} sub="Live open pipeline" link="View pipeline" onClick={() => setTab("tenders")} />
        <KpiCard icon="📝" iconBg="rgba(59,130,246,0.12)" iconColor="#2563eb" label="Drafted" value={drafted} sub="Invitations registered" link="See invitations" onClick={() => setTab("tenders")} />
        <KpiCard icon="📤" iconBg="rgba(6,182,212,0.12)" iconColor="#0891b2" label="Submitted" value={submitted} sub="Bids delivered" link="View submissions" onClick={() => setTab("submissions")} />
        <KpiCard icon="🏆" iconBg="rgba(16,185,129,0.12)" iconColor="#059669" label="Won" value={won} sub="Awards secured" link="See outcomes" onClick={() => setTab("outcomes")} />
        <KpiCard icon="📈" iconBg="rgba(245,158,11,0.12)" iconColor="#d97706" label="Award Rate" value={`${awardRate}%`} sub="Of closed tenders" link="Analyse wins" onClick={() => setTab("outcomes")} />
      </KpiStrip>

      <div className="data-panel" style={{ padding: 16 }}>
        <SectionHeader eyebrow="Workflow" title="11-Step Bid Pipeline" />
        <div style={{ alignItems: "center", display: "flex", gap: 4, overflowX: "auto", paddingBottom: 6 }}>
          {steps.map((s, i) => (
            <Fragment key={s.label}>
              <button type="button" className="btn ghost sm" style={{ alignItems: "center", display: "flex", gap: 6, flexShrink: 0, fontSize: 11, padding: "5px 9px" }} onClick={() => setTab(s.tab)}>
                <span style={{ alignItems: "center", background: "linear-gradient(145deg, #7c3aed, #a855f7)", borderRadius: "50%", color: "#fff", display: "flex", fontSize: 10, height: 18, justifyContent: "center", width: 18 }}>{i + 1}</span>
                {s.label}
              </button>
              {i < steps.length - 1 && <span style={{ color: "var(--muted)", flexShrink: 0, fontSize: 11 }}>→</span>}
            </Fragment>
          ))}
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: "start", gridTemplateColumns: "1.6fr 1fr" }}>
        <div className="data-panel">
          <div className="panel-title" style={{ borderBottom: "1px solid var(--line)" }}>
            <span style={{ fontSize: 13, fontWeight: 800 }}>Recent Tender Invitations</span>
            <button type="button" className="btn ghost sm" onClick={() => setTab("tenders")}>View All →</button>
          </div>
          {(dash.recentTenders ?? []).length === 0 ? (
            <EmptyState icon="📨" title="No recent invitations" description="Register the first tender invitation to start your pipeline." action={canRegister ? <button type="button" className="btn primary sm" onClick={openRegister}>+ Register Invitation</button> : undefined} />
          ) : (
            <DataTable headers={["Tender No", "Title", "Client", "Deadline", "Value", "Stage"]}>
              {(dash.recentTenders ?? []).map((r) => (
                <tr key={String(r.id)}>
                  <td><span className="mono" style={{ color: "#7c3aed", fontSize: 12, fontWeight: 700 }}>{String(r.reference ?? "—")}</span></td>
                  <td><strong style={{ fontSize: 12 }}>{String(r.title ?? "—")}</strong></td>
                  <td style={{ fontSize: 12 }}>{String(r.client ?? "—")}</td>
                  <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>{fmtDateTime(r.submission_deadline)}</td>
                  <td><span className="mono" style={{ fontSize: 12 }}>{money.format(Number(r.estimated_value ?? 0))}</span></td>
                  <td><StagePill value={r.stage} /></td>
                </tr>
              ))}
            </DataTable>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="data-panel" style={{ padding: 18 }}>
            <SectionHeader eyebrow="Alerts" title="Urgent Bid Tasks" />
            {(dash.urgentTasks ?? []).length === 0 ? (
              <div className="muted" style={{ fontSize: 12, padding: "12px 0", textAlign: "center" }}>No urgent tasks. All clear ✓</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {(dash.urgentTasks ?? []).slice(0, 5).map((t) => (
                  <button key={String(t.id)} type="button" style={{ alignItems: "center", background: "none", border: 0, borderBottom: "1px solid var(--line)", cursor: "pointer", display: "flex", gap: 10, padding: "10px 0", textAlign: "left", width: "100%" }} onClick={() => setTab("tasks")}>
                    <span style={{ fontSize: 16 }}>⚠️</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong style={{ display: "block", fontSize: 12 }}>{String(t.title ?? "—")}</strong>
                      <small className="muted">{String(t.tender_title ?? "—")} · due {fmtDate(t.due_on)}</small>
                    </div>
                    <StatusPill value={String(t.status ?? "—")} />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="data-panel" style={{ padding: 18 }}>
            <SectionHeader eyebrow="Snapshot" title="Pipeline Health" />
            <div style={{ alignItems: "center", display: "flex", gap: 16, flexWrap: "wrap" }}>
              <Donut pct={compliance} color="#7c3aed" value={`${compliance}%`} label="Submitted" />
              <div style={{ display: "flex", flex: 1, flexDirection: "column", gap: 8 }}>
                {funnel.slice(0, 6).map((f) => (
                  <div key={f.stage} style={{ alignItems: "center", display: "flex", fontSize: 11, gap: 8 }}>
                    <i style={{ background: stageToneMap[f.stage] === "red" ? "#ef4444" : stageToneMap[f.stage] === "green" ? "#10b981" : stageToneMap[f.stage] === "yellow" ? "#f59e0b" : stageToneMap[f.stage] === "cyan" ? "#06b6d4" : stageToneMap[f.stage] === "purple" ? "#7c3aed" : "#94a3b8", borderRadius: "50%", height: 8, width: 8 }} />
                    <span className="muted" style={{ flex: 1 }}>{String(f.stage).replace(/_/g, " ")}</span>
                    <strong>{f.count}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="data-panel" style={{ padding: 18 }}>
            <SectionHeader eyebrow="Quick Actions" title="Shortcuts" />
            <div style={{ display: "grid", gap: 8 }}>
              {canRegister && <button type="button" className="btn primary" style={{ textAlign: "left" }} onClick={openRegister}>📨 Register Tender Invitation</button>}
              <button type="button" className="btn ghost" style={{ textAlign: "left" }} onClick={() => setTab("requirements")}>✨ Run AI Requirement Analysis</button>
              <button type="button" className="btn ghost" style={{ textAlign: "left" }} onClick={() => setTab("decisions")}>⚖️ Open Bid / No-Bid Gate</button>
              <button type="button" className="btn ghost" style={{ textAlign: "left" }} onClick={() => setTab("company-documents")}>🗄️ Review Vault Expiry</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Modals ─── */

function RegisterTenderModal({ open, onClose, onSubmit, error }: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, string>) => void;
  error: string;
}) {
  if (!open) return null;
  return (
    <Modal title="+ Register Tender Invitation · Step 1" onClose={onClose} wide>
      <FormError error={error} />
      <form onSubmit={(e) => {
        e.preventDefault();
        onSubmit(Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>);
      }}>
        <div className="grid-2">
          <Field label="Tender Reference" required>
            <input name="reference" required placeholder="TND-2026-0001" />
          </Field>
          <Field label="Category">
            <input name="category" placeholder="e.g. Civil Engineering" />
          </Field>
        </div>
        <Field label="Tender Title" required>
          <input name="title" required placeholder="e.g. Design & Build of Water Treatment Plant" />
        </Field>
        <Field label="Procuring Entity / Client" required>
          <input name="client" required placeholder="e.g. Water Resources Authority" />
        </Field>
        <Field label="Description">
          <textarea name="description" rows={2} placeholder="Brief scope summary" />
        </Field>
        <div className="grid-2">
          <Field label="Submission Deadline" required>
            <input name="submission_deadline" type="datetime-local" required />
          </Field>
          <Field label="Clarification Deadline">
            <input name="clarification_deadline" type="datetime-local" />
          </Field>
        </div>
        <div className="grid-2">
          <Field label="Estimated Value (KES)">
            <input name="estimated_value" type="number" min="0" defaultValue="0" />
          </Field>
          <Field label="Currency">
            <select name="currency" defaultValue="KES">
              <option value="KES">KES</option>
              <option value="USD">USD</option>
            </select>
          </Field>
        </div>
        <div className="grid-2">
          <Field label="Source">
            <input name="source" placeholder="e.g. Portal, Email, Direct" />
          </Field>
          <Field label="Source Document URL">
            <input name="source_document_url" type="url" placeholder="https://…" />
          </Field>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary">Save Invitation</button>
        </div>
      </form>
    </Modal>
  );
}

function DecisionModal({ row, onClose, onSubmit, error }: {
  row: Row | null;
  onClose: () => void;
  onSubmit: (payload: { decision: string; rationale: string }) => void;
  error: string;
}) {
  if (!row) return null;
  return (
    <Modal title="Bid / No-Bid Decision" onClose={onClose}>
      <FormError error={error} />
      <div className="data-panel" style={{ marginBottom: 12, padding: 14 }}>
        <strong style={{ fontSize: 13 }}>{String(row.tender_title ?? "Tender")}</strong>
        <div className="grid-2" style={{ marginTop: 10 }}>
          <DetailField label="Eligibility">{Number(row.eligibility_score ?? 0)}</DetailField>
          <DetailField label="Profitability">{Number(row.profitability_score ?? 0)}</DetailField>
        </div>
        <div className="grid-2">
          <DetailField label="Capacity">{Number(row.capacity_score ?? 0)}</DetailField>
          <DetailField label="Risk Score">{Number(row.risk_score ?? 0)}</DetailField>
        </div>
        <DetailField label="Recommendation"><StatusPill value={String(row.recommendation ?? "—")} /></DetailField>
      </div>
      <form onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        onSubmit({ decision: String(fd.get("decision") ?? "approved"), rationale: String(fd.get("rationale") ?? "") });
      }}>
        <Field label="Decision" required>
          <select name="decision" defaultValue="approved">
            <option value="approved">Approved to Bid</option>
            <option value="declined">Declined (No Bid)</option>
          </select>
        </Field>
        <Field label="Rationale">
          <textarea name="rationale" rows={3} placeholder="Board rationale for this decision (recorded in the audit trail)…" />
        </Field>
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary">Record Decision</button>
        </div>
      </form>
    </Modal>
  );
}

function TaskTransitionModal({ row, onClose, onSubmit, error }: {
  row: Row | null;
  onClose: () => void;
  onSubmit: (payload: { status: string }) => void;
  error: string;
}) {
  if (!row) return null;
  const options = TASK_TRANSITIONS[String(row.status ?? "pending")] ?? [];
  return (
    <Modal title="Update Task Status" onClose={onClose}>
      <FormError error={error} />
      <div className="data-panel" style={{ marginBottom: 12, padding: 14 }}>
        <strong style={{ fontSize: 13 }}>{String(row.title ?? "Task")}</strong>
        <div className="grid-2" style={{ marginTop: 10 }}>
          <DetailField label="Tender">{String(row.tender_title ?? "—")}</DetailField>
          <DetailField label="Current Status"><StatusPill value={String(row.status ?? "—")} /></DetailField>
        </div>
        <DetailField label="Progress"><ProgressBar pct={Number(row.progress ?? 0)} /></DetailField>
      </div>
      {options.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>This task is complete and cannot be transitioned.</p>
      ) : (
        <form onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ status: String(new FormData(e.currentTarget).get("status") ?? "") });
        }}>
          <Field label="Move To" required>
            <select name="status" required>
              {options.map((o) => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}
            </select>
          </Field>
          <div className="modal-actions">
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn primary">Update Task</button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function ProposalTransitionModal({ row, onClose, onSubmit, error }: {
  row: Row | null;
  onClose: () => void;
  onSubmit: (payload: { status: string }) => void;
  error: string;
}) {
  if (!row) return null;
  const options = PROPOSAL_TRANSITIONS[String(row.status ?? "draft")] ?? [];
  return (
    <Modal title="Proposal Section Review" onClose={onClose}>
      <FormError error={error} />
      <div className="data-panel" style={{ marginBottom: 12, padding: 14 }}>
        <strong style={{ fontSize: 13 }}>{String(row.title ?? "Section")}</strong>
        <div className="grid-2" style={{ marginTop: 10 }}>
          <DetailField label="Tender">{String(row.tender_title ?? "—")}</DetailField>
          <DetailField label="Current Status"><StatusPill value={String(row.status ?? "—")} /></DetailField>
        </div>
        <DetailField label="Owner">{String(row.owner_name ?? "—")} · v{Number(row.version ?? 1)}</DetailField>
      </div>
      {options.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>Approved sections are immutable and cannot be transitioned.</p>
      ) : (
        <form onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ status: String(new FormData(e.currentTarget).get("status") ?? "") });
        }}>
          <Field label="Move To" required>
            <select name="status" required>
              {options.map((o) => <option key={o} value={o}>{o === "approved" ? "Approve Section" : o === "review" ? "Send to Review" : "Return to Draft"}</option>)}
            </select>
          </Field>
          <div className="modal-actions">
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn primary">Apply Transition</button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function ReviewDecisionModal({ row, onClose, onSubmit, error }: {
  row: Row | null;
  onClose: () => void;
  onSubmit: (payload: { status: string; comments: string }) => void;
  error: string;
}) {
  if (!row) return null;
  return (
    <Modal title="Review Gate Decision" onClose={onClose}>
      <FormError error={error} />
      <div className="data-panel" style={{ marginBottom: 12, padding: 14 }}>
        <strong style={{ fontSize: 13 }}>{String(row.tender_title ?? "Tender")} · {String(row.gate ?? "Gate")}</strong>
        <div className="grid-2" style={{ marginTop: 10 }}>
          <DetailField label="Reviewer">{String(row.reviewer_name ?? "—")}</DetailField>
          <DetailField label="Current Status"><StatusPill value={String(row.status ?? "pending")} /></DetailField>
        </div>
      </div>
      <form onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        onSubmit({ status: String(fd.get("status") ?? "approved"), comments: String(fd.get("comments") ?? "") });
      }}>
        <Field label="Decision" required>
          <select name="status" defaultValue="approved">
            <option value="approved">Approve Gate</option>
            <option value="changes">Return for Changes</option>
          </select>
        </Field>
        <Field label="Executive Summary / Comments">
          <textarea name="comments" rows={3} placeholder="Comments or required changes…" />
        </Field>
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary">Record Decision</button>
        </div>
      </form>
    </Modal>
  );
}

function ConfirmRequirementModal({ row, onClose, onSubmit, error }: {
  row: Row | null;
  onClose: () => void;
  onSubmit: (payload: { status: string }) => void;
  error: string;
}) {
  if (!row) return null;
  return (
    <Modal title="Confirm AI Extraction" onClose={onClose}>
      <FormError error={error} />
      <div className="data-panel" style={{ marginBottom: 12, padding: 14 }}>
        <DetailField label="Category"><StatusPill value={String(row.category ?? "—")} /></DetailField>
        <DetailField label="Requirement Text">{String(row.text ?? "—")}</DetailField>
        <div className="grid-2">
          {row.confidence !== null && row.confidence !== undefined && <DetailField label="Confidence">{Number(row.confidence)}%</DetailField>}
          {row.citation ? <DetailField label="Citation">{String(row.citation)}</DetailField> : null}
        </div>
        {row.model_version ? <DetailField label="Model Version"><span className="mono">{String(row.model_version)}</span></DetailField> : null}
      </div>
      <form onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ status: String(new FormData(e.currentTarget).get("status") ?? "confirmed") });
      }}>
        <Field label="Mark As" required>
          <select name="status" defaultValue="confirmed">
            <option value="confirmed">Confirmed</option>
            <option value="met">Met</option>
            <option value="gap">Gap</option>
          </select>
        </Field>
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary">Confirm Finding</button>
        </div>
      </form>
    </Modal>
  );
}

function RecordSubmissionModal({ open, onClose, onSubmit, error, tenders }: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, string>) => void;
  error: string;
  tenders: Row[];
}) {
  if (!open) return null;
  const eligible = tenders.filter((t) => String(t.stage) === "packaging");
  return (
    <Modal title="+ Record Submission · Step 10" onClose={onClose} wide>
      <FormError error={error} />
      {eligible.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>No tenders are at the packaging stage yet. Advance a tender through review & approval to enable submission recording.</p>
      ) : (
        <form onSubmit={(e) => {
          e.preventDefault();
          onSubmit(Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>);
        }}>
          <Field label="Tender" required>
            <select name="tender" required defaultValue="">
              <option value="" disabled>Select tender…</option>
              {eligible.map((t) => <option key={String(t.id)} value={String(t.id)}>{String(t.reference ?? "—")} · {String(t.title ?? "—")}</option>)}
            </select>
          </Field>
          <div className="grid-2">
            <Field label="Submission Channel" required>
              <input name="channel" required placeholder="e.g. Portal, Courier, Email" />
            </Field>
            <Field label="Receipt Reference" required>
              <input name="receipt_reference" required placeholder="e.g. ACK-2026-001" />
            </Field>
          </div>
          <div className="grid-2">
            <Field label="Package Version" required>
              <input name="package_version" required placeholder="v1.0" defaultValue="v1.0" />
            </Field>
            <Field label="Package Checksum" required>
              <input name="package_checksum" required placeholder="SHA-256 of package" />
            </Field>
          </div>
          <div className="grid-2">
            <Field label="Acknowledgement URL">
              <input name="acknowledgement_url" type="url" placeholder="https://…" />
            </Field>
            <Field label="Compliant Package">
              <select name="compliant" defaultValue="true">
                <option value="true">Yes — compliant</option>
                <option value="false">No — non-compliant</option>
              </select>
            </Field>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn primary">Record Submission</button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function RecordOutcomeModal({ open, onClose, onSubmit, error, tenders }: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, string>) => void;
  error: string;
  tenders: Row[];
}) {
  if (!open) return null;
  const eligible = tenders.filter((t) => String(t.stage) === "submitted");
  return (
    <Modal title="+ Record Outcome · Step 11" onClose={onClose} wide>
      <FormError error={error} />
      {eligible.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>No tenders are in the submitted stage yet. Outcomes can only be recorded for submitted tenders.</p>
      ) : (
        <form onSubmit={(e) => {
          e.preventDefault();
          onSubmit(Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>);
        }}>
          <Field label="Tender" required>
            <select name="tender" required defaultValue="">
              <option value="" disabled>Select tender…</option>
              {eligible.map((t) => <option key={String(t.id)} value={String(t.id)}>{String(t.reference ?? "—")} · {String(t.title ?? "—")}</option>)}
            </select>
          </Field>
          <div className="grid-2">
            <Field label="Result" required>
              <select name="result" defaultValue="awarded">
                <option value="awarded">Awarded</option>
                <option value="regretted">Regretted</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </Field>
            <Field label="Notified On" required>
              <input name="notified_on" type="date" required />
            </Field>
          </div>
          <div className="grid-2">
            <Field label="Awarded Value (KES)">
              <input name="awarded_value" type="number" min="0" placeholder="0" />
            </Field>
            <Field label="Winner">
              <input name="winner" placeholder="Awarded company (if won)" />
            </Field>
          </div>
          <Field label="Feedback">
            <textarea name="feedback" rows={2} placeholder="Client feedback received…" />
          </Field>
          <Field label="Lessons Learned">
            <textarea name="lessons_learned" rows={3} placeholder="Feeds the knowledge base for future bids…" />
          </Field>
          <div className="modal-actions">
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn primary">Record Outcome</button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function UploadCompanyDocumentModal({ open, onClose, onSubmit, error }: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, string>) => void;
  error: string;
}) {
  if (!open) return null;
  return (
    <Modal title="+ Upload Company Document" onClose={onClose}>
      <FormError error={error} />
      <form onSubmit={(e) => {
        e.preventDefault();
        onSubmit(Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>);
      }}>
        <Field label="Document Name" required>
          <input name="name" required placeholder="e.g. Tax Compliance Certificate 2026" />
        </Field>
        <div className="grid-2">
          <Field label="Document Type" required>
            <select name="document_type" defaultValue="">
              <option value="" disabled>Select type…</option>
              <option value="Tax Compliance">Tax Compliance</option>
              <option value="Insurance">Insurance</option>
              <option value="Registration">Registration</option>
              <option value="Certificate">Certificate</option>
              <option value="Other">Other</option>
            </select>
          </Field>
          <Field label="Version" required>
            <input name="version" required placeholder="e.g. 1.0" defaultValue="1.0" />
          </Field>
        </div>
        <div className="grid-2">
          <Field label="Issue Date">
            <input name="issued_on" type="date" />
          </Field>
          <Field label="Expiry Date">
            <input name="expires_on" type="date" />
          </Field>
        </div>
        <Field label="File URL">
          <input name="file_url" type="url" placeholder="https://…" />
        </Field>
        <Field label="Checksum" required>
          <input name="checksum" required placeholder="SHA-256 integrity hash" />
        </Field>
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary">Upload Document</button>
        </div>
      </form>
    </Modal>
  );
}

/* ─── Main workspace ─── */

export function TenderWorkspace({ initialTab = "overview" }: { initialTab?: string }) {
  const { session, can } = useAuth();
  const org = session?.activeOrganizationId ?? null;

  const [tab, setTab] = useState<TenderTab>(() => (initialTab in labels ? (initialTab as TenderTab) : "overview"));
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [tenderIndex, setTenderIndex] = useState<Row[]>([]);
  const [recentExports, setRecentExports] = useState<{ key: string; name: string; exportedAt: string }[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  const [showRegister, setShowRegister] = useState(false);
  const [decisionRow, setDecisionRow] = useState<Row | null>(null);
  const [taskRow, setTaskRow] = useState<Row | null>(null);
  const [proposalRow, setProposalRow] = useState<Row | null>(null);
  const [reviewRow, setReviewRow] = useState<Row | null>(null);
  const [requirementRow, setRequirementRow] = useState<Row | null>(null);
  const [showSubmission, setShowSubmission] = useState(false);
  const [showOutcome, setShowOutcome] = useState(false);
  const [showUploadDoc, setShowUploadDoc] = useState(false);

  const canRegister = can("tender.intake");
  const canCompliance = can("tender.compliance");
  const canDecide = can("tender.decision");
  const canPropose = can("tender.proposal") || can("tender.approve");
  const canPrice = can("tender.pricing");

  const loadVersion = useRef(0);

  const loadTenders = useCallback(async () => {
    if (!org) return;
    try {
      const res = await apiFetch("/tender/tenders/", {}, org);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setTenderIndex(data as Row[]);
      }
    } catch {
      /* tenders index is optional enrichment */
    }
  }, [org]);

  const loadData = useCallback(async () => {
    if (!org) return;
    const version = ++loadVersion.current;
    setLoading(true);
    setError("");

    const isReports = tab === "reports";
    let path = "/tender/dashboard/";
    if (isReports) path = "/tender/analytics/";
    else if (tab !== "overview") path = `/tender/${tab}/?search=${encodeURIComponent(search)}`;

    try {
      const res = await apiFetch(path, {}, org);
      if (version !== loadVersion.current) return;
      if (!res.ok) {
        setRows([]);
        setDash(null);
        return;
      }
      const data = await res.json();
      if (version !== loadVersion.current) return;
      if (tab === "overview") {
        setDash(data as Dashboard);
        setRows([]);
      } else if (isReports) {
        setDash(data as unknown as Dashboard);
        setRows((data.reports ?? []) as Row[]);
      } else {
        setRows(Array.isArray(data) ? (data as Row[]) : []);
      }
    } catch {
      if (version === loadVersion.current) setError("Unable to connect to the tender intelligence service.");
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [tab, search, org]);

  useEffect(() => {
    if (!org) return;
    let active = true;
    apiFetch("/tender/tenders/", {}, org)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => {
        if (active && Array.isArray(d)) setTenderIndex(d as Row[]);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [org]);

  useEffect(() => {
    const timer = setTimeout(loadData, search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [loadData, search]);

  const selectTab = (id: string) => {
    setSearch("");
    setFormError("");
    setRows([]);
    setTab((id in labels ? id : "overview") as TenderTab);
  };

  const openRegister = () => { setFormError(""); setShowRegister(true); };
  const openDecide = (r: Row) => { setFormError(""); setDecisionRow(r); };
  const openTask = (r: Row) => { setFormError(""); setTaskRow(r); };
  const openProposal = (r: Row) => { setFormError(""); setProposalRow(r); };
  const openReview = (r: Row) => { setFormError(""); setReviewRow(r); };
  const openConfirmRequirement = (r: Row) => { setFormError(""); setRequirementRow(r); };
  const openRecordSubmission = () => { setFormError(""); setShowSubmission(true); };
  const openRecordOutcome = () => { setFormError(""); setShowOutcome(true); };
  const openUploadDoc = () => { setFormError(""); setShowUploadDoc(true); };

  async function submitRegister(payload: Record<string, string>) {
    await apiFetch("/auth/csrf/");
    const res = await apiFetch("/tender/tenders/", {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify(payload),
    }, org);
    if (res.ok) {
      setShowRegister(false);
      setFormError("");
      loadTenders();
      loadData();
    } else {
      setFormError(await readError(res));
    }
  }

  async function submitDecide(payload: { decision: string; rationale: string }) {
    if (!decisionRow) return;
    await apiFetch("/auth/csrf/");
    const res = await apiFetch(`/tender/decisions/${String(decisionRow.id)}/decide/`, {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify(payload),
    }, org);
    if (res.ok) {
      setDecisionRow(null);
      setFormError("");
      loadData();
    } else {
      setFormError(await readError(res));
    }
  }

  async function submitTask(payload: { status: string }) {
    if (!taskRow) return;
    await apiFetch("/auth/csrf/");
    const res = await apiFetch(`/tender/tasks/${String(taskRow.id)}/transition/`, {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify(payload),
    }, org);
    if (res.ok) {
      setTaskRow(null);
      setFormError("");
      loadData();
    } else {
      setFormError(await readError(res));
    }
  }

  async function submitProposal(payload: { status: string }) {
    if (!proposalRow) return;
    await apiFetch("/auth/csrf/");
    const res = await apiFetch(`/tender/proposals/${String(proposalRow.id)}/transition/`, {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify(payload),
    }, org);
    if (res.ok) {
      setProposalRow(null);
      setFormError("");
      loadData();
    } else {
      setFormError(await readError(res));
    }
  }

  async function submitReview(payload: { status: string; comments: string }) {
    if (!reviewRow) return;
    await apiFetch("/auth/csrf/");
    const res = await apiFetch(`/tender/reviews/${String(reviewRow.id)}/decide/`, {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify(payload),
    }, org);
    if (res.ok) {
      setReviewRow(null);
      setFormError("");
      loadData();
    } else {
      setFormError(await readError(res));
    }
  }

  async function submitRequirement(payload: { status: string }) {
    if (!requirementRow) return;
    await apiFetch("/auth/csrf/");
    const res = await apiFetch(`/tender/requirements/${String(requirementRow.id)}/confirm/`, {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify(payload),
    }, org);
    if (res.ok) {
      setRequirementRow(null);
      setFormError("");
      loadData();
    } else {
      setFormError(await readError(res));
    }
  }

  async function approveFinancialItem(row: Row) {
    if (!window.confirm(`Approve ${String(row.code ?? "this")} BOQ item? Approved pricing is immutable.`)) return;
    await apiFetch("/auth/csrf/");
    const res = await apiFetch(`/tender/financial-items/${String(row.id)}/approve/`, {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: "{}",
    }, org);
    if (res.ok) {
      loadData();
    } else {
      setError(await readError(res));
    }
  }

  async function submitSubmission(payload: Record<string, string>) {
    await apiFetch("/auth/csrf/");
    const res = await apiFetch("/tender/submissions/", {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify({ ...payload, compliant: payload.compliant === "true" }),
    }, org);
    if (res.ok) {
      setShowSubmission(false);
      setFormError("");
      loadTenders();
      loadData();
    } else {
      setFormError(await readError(res));
    }
  }

  async function submitOutcome(payload: Record<string, string>) {
    await apiFetch("/auth/csrf/");
    const res = await apiFetch("/tender/outcomes/", {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify({
        ...payload,
        awarded_value: payload.awarded_value ? payload.awarded_value : null,
      }),
    }, org);
    if (res.ok) {
      setShowOutcome(false);
      setFormError("");
      loadTenders();
      loadData();
    } else {
      setFormError(await readError(res));
    }
  }

  async function submitUploadDoc(payload: Record<string, string>) {
    await apiFetch("/auth/csrf/");
    const res = await apiFetch("/tender/company-documents/", {
      method: "POST",
      headers: { "X-CSRFToken": csrfFromCookie() },
      body: JSON.stringify(payload),
    }, org);
    if (res.ok) {
      setShowUploadDoc(false);
      setFormError("");
      loadData();
    } else {
      setFormError(await readError(res));
    }
  }

  async function exportReport(key: string, name: string) {
    const res = await apiFetch(`/tender/analytics/exports/${key}/`, {}, org);
    if (!res.ok) {
      setError("Report generation failed.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tender-${key}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setRecentExports((prev) => [{ key, name, exportedAt: new Date().toISOString() }, ...prev].slice(0, 8));
  }

  const todayStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  return (
    <ModuleShell
      moduleKey="tender"
      moduleName="Tender Management"
      eyebrow="Tender Intelligence Workspace"
      title="Tender Management"
      subtitle="Controlled 11-step bid production from invitation & AI analysis to packaging and award."
      accent="#7c3aed"
      activeId={tab}
      onSelect={selectTab}
      actions={
        <div className="row" style={{ gap: 10, alignItems: "center" }}>
          <span className="muted" style={{ fontSize: 13, whiteSpace: "nowrap" }}>📅 {todayStr}</span>
          {canRegister && <button type="button" className="btn primary sm" onClick={openRegister}>+ Register Invitation</button>}
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {error && <ErrorBanner message={error} onRetry={loadData} />}

        {loading ? (
          <LoadingState rows={5} />
        ) : tab === "overview" ? (
          dash ? (
            <OverviewView dash={dash} setTab={selectTab} openRegister={openRegister} canRegister={canRegister} />
          ) : (
            <EmptyState icon="📊" title="No dashboard data" description="Live tender intelligence will appear here once tenders exist for this organization." />
          )
        ) : tab === "tenders" ? (
          <TendersView rows={rows} search={search} setSearch={setSearch} openRegister={openRegister} canRegister={canRegister} />
        ) : tab === "requirements" ? (
          <RequirementsView rows={rows} search={search} setSearch={setSearch} tenderIndex={tenderIndex} confirmRow={openConfirmRequirement} canConfirm={canCompliance} />
        ) : tab === "decisions" ? (
          <DecisionsView rows={rows} search={search} setSearch={setSearch} tenderIndex={tenderIndex} openDecide={openDecide} canDecide={canDecide} />
        ) : tab === "tasks" ? (
          <TasksView rows={rows} search={search} setSearch={setSearch} openTask={openTask} canTask={canRegister} />
        ) : tab === "company-documents" ? (
          <CompanyDocumentsView rows={rows} search={search} setSearch={setSearch} setShowUploadDoc={openUploadDoc} />
        ) : tab === "proposals" ? (
          <ProposalsView rows={rows} search={search} setSearch={setSearch} openProposal={openProposal} canPropose={canPropose} />
        ) : tab === "financial-items" ? (
          <FinancialItemsView rows={rows} search={search} setSearch={setSearch} onApprove={approveFinancialItem} canPrice={canPrice} />
        ) : tab === "reviews" ? (
          <ReviewsView rows={rows} search={search} setSearch={setSearch} tenderIndex={tenderIndex} openReview={openReview} canReview={canDecide} />
        ) : tab === "packaging" ? (
          <PackagingView rows={rows} search={search} setSearch={setSearch} tenderIndex={tenderIndex} />
        ) : tab === "submissions" ? (
          <SubmissionsView rows={rows} search={search} setSearch={setSearch} openRecord={openRecordSubmission} canRecord={canDecide} />
        ) : tab === "outcomes" ? (
          <OutcomesView rows={rows} search={search} setSearch={setSearch} tenderIndex={tenderIndex} openRecord={openRecordOutcome} canRecord={canDecide} />
        ) : tab === "reports" ? (
          <ReportsView analytics={dash as unknown as Analytics | null} reports={(rows as { key: string; name: string }[])} recentExports={recentExports} onExport={exportReport} />
        ) : tab === "audit-events" ? (
          <AuditEventsView rows={rows} search={search} setSearch={setSearch} />
        ) : (
          <EmptyState icon="📋" title={labels[tab]} description="No data available for this scope yet." />
        )}
      </div>

      <RegisterTenderModal open={showRegister} onClose={() => setShowRegister(false)} onSubmit={submitRegister} error={formError} />
      <DecisionModal row={decisionRow} onClose={() => setDecisionRow(null)} onSubmit={submitDecide} error={formError} />
      <TaskTransitionModal row={taskRow} onClose={() => setTaskRow(null)} onSubmit={submitTask} error={formError} />
      <ProposalTransitionModal row={proposalRow} onClose={() => setProposalRow(null)} onSubmit={submitProposal} error={formError} />
      <ReviewDecisionModal row={reviewRow} onClose={() => setReviewRow(null)} onSubmit={submitReview} error={formError} />
      <ConfirmRequirementModal row={requirementRow} onClose={() => setRequirementRow(null)} onSubmit={submitRequirement} error={formError} />
      <RecordSubmissionModal open={showSubmission} onClose={() => setShowSubmission(false)} onSubmit={submitSubmission} error={formError} tenders={tenderIndex} />
      <RecordOutcomeModal open={showOutcome} onClose={() => setShowOutcome(false)} onSubmit={submitOutcome} error={formError} tenders={tenderIndex} />
      <UploadCompanyDocumentModal open={showUploadDoc} onClose={() => setShowUploadDoc(false)} onSubmit={submitUploadDoc} error={formError} />
    </ModuleShell>
  );
}
