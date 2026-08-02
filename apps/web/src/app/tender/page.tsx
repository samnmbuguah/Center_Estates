"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { ModuleShell } from "@/components/module-shell";
import { apiFetch, csrfFromCookie } from "@/lib/api";
import { tenderNav } from "@/lib/module-nav";
type Tab =
  | "overview"
  | "tenders"
  | "requirements"
  | "decisions"
  | "tasks"
  | "company-documents"
  | "proposals"
  | "financial-items"
  | "reviews"
  | "submissions"
  | "outcomes"
  | "reports"
  | "audit-events";
type Row = Record<string, string | number | boolean | null>;
type Dash = {
  kpis: Record<string, string | number>;
  recentTenders: Row[];
  urgentTasks: Row[];
  stageFunnel: { stage: string; count: number }[];
};
const labels: Record<Tab, string> = {
  overview: "Dashboard",
  tenders: "Invitations",
  requirements: "AI analysis",
  decisions: "Bid / no-bid",
  tasks: "Planning",
  "company-documents": "Company documents",
  proposals: "Proposals",
  "financial-items": "Financial BOQ",
  reviews: "Review & approval",
  submissions: "Submissions",
  outcomes: "Awards & regrets",
  reports: "Reports",
  "audit-events": "Audit trail",
};
const money = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 0,
});
const columns: Record<
  Exclude<Tab, "overview">,
  { key: string; label: string; kind?: "money" | "status" }[]
> = {
  tenders: [
    { key: "reference", label: "Reference" },
    { key: "title", label: "Tender" },
    { key: "client", label: "Client" },
    { key: "submission_deadline", label: "Deadline" },
    { key: "estimated_value", label: "Value", kind: "money" },
    { key: "readiness_score", label: "Readiness" },
    { key: "stage", label: "Stage", kind: "status" },
  ],
  requirements: [
    { key: "category", label: "Category" },
    { key: "text", label: "Extracted requirement" },
    { key: "mandatory", label: "Mandatory" },
    { key: "confidence", label: "AI confidence" },
    { key: "citation", label: "Source citation" },
    { key: "status", label: "Human status", kind: "status" },
  ],
  decisions: [
    { key: "eligibility_score", label: "Eligibility" },
    { key: "profitability_score", label: "Profitability" },
    { key: "capacity_score", label: "Capacity" },
    { key: "risk_score", label: "Risk" },
    { key: "recommendation", label: "Recommendation", kind: "status" },
    { key: "decision", label: "Board decision", kind: "status" },
    { key: "rationale", label: "Rationale" },
  ],
  tasks: [
    { key: "tender_title", label: "Tender" },
    { key: "title", label: "Task" },
    { key: "stage", label: "Stage", kind: "status" },
    { key: "owner_name", label: "Owner" },
    { key: "due_on", label: "Due" },
    { key: "progress", label: "Progress" },
    { key: "status", label: "Status", kind: "status" },
  ],
  "company-documents": [
    { key: "name", label: "Document" },
    { key: "document_type", label: "Type" },
    { key: "version", label: "Version" },
    { key: "issued_on", label: "Issued" },
    { key: "expires_on", label: "Expires" },
    { key: "status", label: "Compliance", kind: "status" },
  ],
  proposals: [
    { key: "tender_title", label: "Tender" },
    { key: "sequence", label: "No." },
    { key: "title", label: "Section" },
    { key: "section_type", label: "Type", kind: "status" },
    { key: "owner_name", label: "Owner" },
    { key: "version", label: "Version" },
    { key: "ai_assisted", label: "AI assisted" },
    { key: "status", label: "Status", kind: "status" },
  ],
  "financial-items": [
    { key: "tender_title", label: "Tender" },
    { key: "code", label: "BOQ code" },
    { key: "description", label: "Item" },
    { key: "quantity", label: "Qty" },
    { key: "unit", label: "Unit" },
    { key: "unit_rate", label: "Rate", kind: "money" },
    { key: "amount", label: "Amount", kind: "money" },
    { key: "approved", label: "Approved" },
  ],
  reviews: [
    { key: "tender_title", label: "Tender" },
    { key: "gate", label: "Approval gate" },
    { key: "reviewer_name", label: "Reviewer" },
    { key: "status", label: "Status", kind: "status" },
    { key: "comments", label: "Comments" },
    { key: "reviewed_at", label: "Reviewed" },
  ],
  submissions: [
    { key: "tender_title", label: "Tender" },
    { key: "channel", label: "Channel" },
    { key: "submitted_at", label: "Submitted" },
    { key: "package_version", label: "Package" },
    { key: "receipt_reference", label: "Receipt" },
    { key: "compliant", label: "Compliant" },
  ],
  outcomes: [
    { key: "tender_title", label: "Tender" },
    { key: "result", label: "Result", kind: "status" },
    { key: "notified_on", label: "Notified" },
    { key: "awarded_value", label: "Award value", kind: "money" },
    { key: "winner", label: "Winner" },
    { key: "feedback", label: "Feedback" },
    { key: "lessons_learned", label: "Lessons" },
  ],
  reports: [{ key: "name", label: "Report" }],
  "audit-events": [
    { key: "created_at", label: "Recorded" },
    { key: "tender_reference", label: "Tender" },
    { key: "event_type", label: "Event", kind: "status" },
    { key: "from_stage", label: "From", kind: "status" },
    { key: "to_stage", label: "To", kind: "status" },
    { key: "actor_name", label: "Recorded by" },
    { key: "notes", label: "Notes" },
  ],
};

export default function TenderPage() {
  const { session, can } = useAuth();
  const org = session?.activeOrganizationId ?? null;
  const canIntake = can("tender.intake") || can("tender.manage"),
    canCompliance = can("tender.compliance") || can("tender.manage"),
    canProposal = can("tender.proposal") || can("tender.manage"),
    canPricing = can("tender.pricing") || can("tender.manage"),
    canApprove = can("tender.approve"),
    canReport = can("tender.report");
  const [tab, setTab] = useState<Tab>("overview"),
    [dash, setDash] = useState<Dash | null>(null),
    [rows, setRows] = useState<Row[]>([]),
    [search, setSearch] = useState(""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [modal, setModal] = useState(false);
  const load = useCallback(async () => {
    if (!org) return;
    setLoading(true);
    setError("");
    const path =
      tab === "overview"
        ? "/tender/dashboard/"
        : tab === "reports"
          ? "/tender/analytics/"
          : `/tender/${tab}/?search=${encodeURIComponent(search)}`;
    const r = await apiFetch(path, {}, org);
    if (!r.ok) {
      setError("Tender workspace could not be loaded.");
      setLoading(false);
      return;
    }
    const d = await r.json();
    if (tab === "overview") setDash(d);
    else if (tab === "reports") setRows(d.reports);
    else setRows(d);
    setLoading(false);
  }, [org, search, tab]);
  useEffect(() => {
    const t = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, search]);
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await apiFetch("/auth/csrf/");
    const values = Object.fromEntries(new FormData(e.currentTarget).entries());
    const r = await apiFetch(
      "/tender/tenders/",
      {
        method: "POST",
        headers: { "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify(values),
      },
      org,
    );
    if (!r.ok) {
      setError(
        "Invitation could not be registered. Check the reference and deadline.",
      );
      return;
    }
    setModal(false);
    setTab("tenders");
  }
  async function run(path: string, payload: Record<string, string> = {}) {
    await apiFetch("/auth/csrf/");
    const r = await apiFetch(
      `/tender/${path}`,
      {
        method: "POST",
        headers: { "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify(payload),
      },
      org,
    );
    if (!r.ok) {
      const p = await r.json().catch(() => ({}));
      setError(
        Object.values(p).flat().join(" ") || "Tender workflow action failed.",
      );
      return;
    }
    await load();
  }
  async function download(row: Row) {
    if (!canReport) return;
    const r = await apiFetch(
      `/tender/analytics/exports/${String(row.key)}/`,
      {},
      org,
    );
    if (!r.ok) {
      setError("Tender report could not be generated.");
      return;
    }
    const url = URL.createObjectURL(await r.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = `tender-${String(row.key)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function actions(row: Row): [string, string, Record<string, string>?][] {
    if (tab === "requirements" && canCompliance && row.status === "pending")
      return [
        ["Confirm met", `requirements/${row.id}/confirm/`, { status: "met" }],
        ["Record gap", `requirements/${row.id}/confirm/`, { status: "gap" }],
      ];
    if (tab === "decisions" && canApprove && row.decision === "pending")
      return [
        [
          "Approve bid",
          `decisions/${row.id}/decide/`,
          { decision: "approved" },
        ],
        ["Decline", `decisions/${row.id}/decide/`, { decision: "declined" }],
      ];
    if (tab === "tasks" && canIntake)
      return row.status === "pending"
        ? [["Start", `tasks/${row.id}/transition/`, { status: "in_progress" }]]
        : row.status === "in_progress"
          ? [
              [
                "Complete",
                `tasks/${row.id}/transition/`,
                { status: "completed" },
              ],
              ["Block", `tasks/${row.id}/transition/`, { status: "blocked" }],
            ]
          : row.status === "blocked"
            ? [
                [
                  "Resume",
                  `tasks/${row.id}/transition/`,
                  { status: "in_progress" },
                ],
              ]
            : [];
    if (tab === "proposals")
      return row.status === "draft" && canProposal
        ? [
            [
              "Submit review",
              `proposals/${row.id}/transition/`,
              { status: "review" },
            ],
          ]
        : row.status === "review" && canApprove
          ? [
              [
                "Approve",
                `proposals/${row.id}/transition/`,
                { status: "approved" },
              ],
            ]
          : [];
    if (tab === "financial-items" && canPricing && canApprove && !row.approved)
      return [["Approve", `financial-items/${row.id}/approve/`]];
    if (tab === "reviews" && canApprove && row.status === "pending")
      return [
        ["Approve gate", `reviews/${row.id}/decide/`, { status: "approved" }],
      ];
    return [];
  }
  const cols = useMemo(() => (tab === "overview" ? [] : columns[tab]), [tab]);
  const k = dash?.kpis;
  const selectSection = (id: string) => {
    setRows([]);
    setSearch("");
    setTab(id as Tab);
  };
  return (
    <ModuleShell
      moduleKey="tender"
      moduleName="Tender Management"
      eyebrow="Bid command center"
      title="Tender Management"
      subtitle="Controlled bid production from invitation and AI analysis through award."
      accent="#7c3aed"
      groups={tenderNav}
      activeId={tab}
      onSelect={selectSection}
      contextLabel="Section"
      contextValue={labels[tab]}
      actions={canIntake ? <button className="primary-action" onClick={() => setModal(true)}>+ Register invitation</button> : null}
    >
      <div className="property-app">
      {error && (
        <div className="form-error">
          {error}
          <button onClick={load}>Retry</button>
        </div>
      )}
      {loading ? (
        <div className="data-loading">Loading tender intelligence…</div>
      ) : tab === "overview" && k && dash ? (
        <>
          <section className="kpi-grid">
            <button className="icon-kpi" onClick={() => setTab("tenders")}><span style={{background:"#ede9fe",color:"#7c3aed"}}>📋</span><div><small>Active tenders</small><strong>{String(k.activeTenders)}</strong><b>{k.dueThisWeek} due within 7 days</b></div></button>
            <button className="icon-kpi" onClick={() => setTab("tenders")}><span style={{background:"#dbeafe",color:"#2563eb"}}>💼</span><div><small>Pipeline value</small><strong>{money.format(Number(k.pipelineValue))}</strong><b>{k.submitted} submitted bids</b></div></button>
            <button className="icon-kpi" onClick={() => setTab("tasks")}><span style={{background:"#ffedd5",color:"#ea580c"}}>☑</span><div><small>Pending tasks</small><strong>{String(k.pendingTasks)}</strong><b>Across active bid plans</b></div></button>
            <button className="icon-kpi" onClick={() => setTab("company-documents")}><span style={{background:"#fee2e2",color:"#dc2626"}}>📄</span><div><small>Expiring documents</small><strong>{String(k.expiringDocuments)}</strong><b>Within the next 30 days</b></div></button>
          </section>
          <section className="dashboard-columns">
            <article className="data-panel">
              <Title t="Recent tenders" go={() => setTab("tenders")} />
              <Table cols={columns.tenders} rows={dash.recentTenders} />
            </article>
            <div className="facility-side-stack">
              <article className="data-panel">
                <Title t="Urgent bid tasks" go={() => setTab("tasks")} />
                {dash.urgentTasks.map((r) => (
                  <button
                    className="invoice-alert"
                    key={String(r.id)}
                    onClick={() => setTab("tasks")}
                  >
                    <span>
                      <strong>{r.title}</strong>
                      <small>
                        {r.tender_title} · due {r.due_on}
                      </small>
                    </span>
                    <Status v={String(r.status)} />
                  </button>
                ))}
              </article>
              <article className="data-panel">
                <Title t="Bid funnel" go={() => setTab("tenders")} />
                <div className="metric-list">
                  {dash.stageFunnel.map((x) => (
                    <button key={x.stage} onClick={() => setTab("tenders")}>
                      <Status v={x.stage} />
                      <b>{x.count}</b>
                    </button>
                  ))}
                </div>
              </article>
              <article className="quick-actions-card">
                <header><h3>Quick Actions</h3></header>
                <button onClick={() => setTab("tenders")}><span style={{background:"#ede9fe"}}>📋</span>Tender invitations</button>
                <button onClick={() => setTab("requirements")}><span style={{background:"#dbeafe"}}>✨</span>AI analysis</button>
                <button onClick={() => setTab("decisions")}><span style={{background:"#ffedd5"}}>⚖</span>Bid / no-bid</button>
                <button onClick={() => setTab("submissions")}><span style={{background:"#dcfce7"}}>⬆</span>Submissions</button>
                <button onClick={() => setTab("reports")}><span style={{background:"#e0f2fe"}}>📄</span>Reports</button>
              </article>
            </div>
          </section>
        </>
      ) : (
        <article className="data-panel">
          <header className="collection-title">
            <div>
              <p className="eyebrow">Workflow register</p>
              <h2>{labels[tab]}</h2>
            </div>
            {tab !== "reports" && (
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search records…"
              />
            )}
          </header>
          <Table
            cols={cols}
            rows={rows}
            actions={actions}
            run={run}
            download={tab === "reports" && canReport ? download : undefined}
          />
        </article>
      )}
      {modal && (
        <div className="modal-backdrop" onMouseDown={() => setModal(false)}>
          <div className="form-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-title">
              <div>
                <p className="eyebrow">Invitation intake</p>
                <h2>Register tender</h2>
              </div>
              <button onClick={() => setModal(false)}>×</button>
            </div>
            <form onSubmit={create}>
              <div className="form-row">
                <label>
                  Reference
                  <input
                    name="reference"
                    required
                    placeholder="TND-2026-0048"
                  />
                </label>
                <label>
                  Category
                  <input name="category" />
                </label>
              </div>
              <label>
                Tender title
                <input name="title" required />
              </label>
              <label>
                Procuring client
                <input name="client" required />
              </label>
              <div className="form-row">
                <label>
                  Submission deadline
                  <input
                    name="submission_deadline"
                    type="datetime-local"
                    required
                  />
                </label>
                <label>
                  Estimated value
                  <input
                    name="estimated_value"
                    type="number"
                    min="0"
                    defaultValue="0"
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Currency
                  <select name="currency" defaultValue="KES">
                    <option>KES</option>
                    <option>USD</option>
                    <option>EUR</option>
                  </select>
                </label>
                <label>
                  Source
                  <input name="source" placeholder="Procurement portal" />
                </label>
              </div>
              <input type="hidden" name="stage" value="invitation" />
              <input type="hidden" name="readiness_score" value="0" />
              <label>
                Description
                <textarea name="description" rows={3} />
              </label>
              <div className="form-actions">
                <button type="button" onClick={() => setModal(false)}>
                  Cancel
                </button>
                <button className="primary-action">Save invitation</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </ModuleShell>
  );
}
function Title({ t, go }: { t: string; go: () => void }) {
  return (
    <header className="panel-title">
      <h2>{t}</h2>
      <button onClick={go}>View all →</button>
    </header>
  );
}
function Status({ v }: { v: string }) {
  return (
    <span className={`data-status status-${v}`}>{v.replaceAll("_", " ")}</span>
  );
}
function Table({
  cols,
  rows,
  actions,
  run,
  download,
}: {
  cols: { key: string; label: string; kind?: "money" | "status" }[];
  rows: Row[];
  actions?: (row: Row) => [string, string, Record<string, string>?][];
  run?: (path: string, payload?: Record<string, string>) => Promise<void>;
  download?: (row: Row) => void;
}) {
  const actionable = Boolean(actions || download);
  return rows.length ? (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
            {actionable && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const acts = actions?.(r) ?? [];
            return (
              <tr key={String(r.id ?? r.key ?? i)}>
                {cols.map((c) => (
                  <td key={c.key}>
                    {c.kind === "money" ? (
                      money.format(Number(r[c.key]))
                    ) : c.kind === "status" ? (
                      <Status v={String(r[c.key])} />
                    ) : typeof r[c.key] === "boolean" ? (
                      r[c.key] ? (
                        "Yes"
                      ) : (
                        "No"
                      )
                    ) : (
                      String(r[c.key] ?? "—")
                    )}
                    {["readiness_score", "confidence", "progress"].includes(
                      c.key,
                    )
                      ? "%"
                      : ""}
                  </td>
                ))}
                {actionable && (
                  <td>
                    <div className="table-actions">
                      {download && (
                        <button onClick={() => download(r)}>
                          Download CSV
                        </button>
                      )}
                      {acts.map(([label, path, payload]) => (
                        <button
                          key={`${label}-${path}`}
                          onClick={() => void run?.(path, payload)}
                        >
                          {label}
                        </button>
                      ))}
                      {!download && !acts.length && <span>—</span>}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  ) : (
    <div className="empty-state">No matching records.</div>
  );
}
