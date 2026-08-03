"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ModuleShell } from "@/components/module-shell";
import { tenderNav } from "@/lib/module-nav";
import { apiFetch } from "@/lib/api";
import { EmptyState, ErrorBanner, LoadingState, SearchInput, StatusPill, money } from "@/components/module-ui";

type Row = Record<string, unknown>;

const EMPTY: Row[] = [];

function fmtDateTime(v: unknown): string {
  if (!v) return "—";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function truncate(v: unknown, max = 46): string {
  const s = String(v ?? "").replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function RefText({ value }: { value: unknown }) {
  return <span className="mono" style={{ color: "var(--primary)", fontSize: 11, fontWeight: 700 }}>{String(value ?? "—")}</span>;
}

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

export default function InvitationsPage() {
  const [rows, setRows] = useState<Row[]>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    apiFetch("/tender/tenders/")
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as Row[];
        setRows(Array.isArray(data) ? data : EMPTY);
      })
      .catch(() => setError("Unable to load tender invitations."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) =>
      [r.reference, r.title, r.client].some((v) => String(v ?? "").toLowerCase().includes(term)),
    );
  }, [rows, search]);

  return (
    <ModuleShell
      moduleKey="tender"
      moduleName="Tender & Bidding"
      eyebrow="Tender Pursuit"
      title="RFP Invitations"
      subtitle="Public and private tender invitations, AI requirements breakdown, bid/no-bid decisioning."
      accent="#7c3aed"
      groups={tenderNav}
      activeId="tenders"
      onSelect={(id) => {
        if (id === "overview") window.location.href = "/tender";
        else window.location.href = `/tender?tab=${id}`;
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {error && <ErrorBanner message={error} onRetry={load} />}

        {loading ? (
          <LoadingState rows={5} />
        ) : (
          <article className="data-panel">
            <header className="panel-title">
              <h2 style={{ fontSize: 14, margin: 0 }}>Invitation Register</h2>
              <SearchInput value={search} onChange={setSearch} placeholder="Search reference, title, client…" />
            </header>

            {filtered.length === 0 ? (
              <EmptyState
                icon="📨"
                title="No tender invitations"
                description={search ? "No invitations match the current search." : "Register the first invitation to seed the pursuit pipeline."}
                action={<Link className="btn primary sm" href="/tender?tab=tenders" style={{ textDecoration: "none" }}>+ Register Invitation</Link>}
              />
            ) : (
              <div className="table-scroll">
                <table className="fc-data-table">
                  <thead>
                    <tr>
                      <th>Tender No</th>
                      <th>Title</th>
                      <th>Client</th>
                      <th>Category</th>
                      <th>Budget</th>
                      <th>Deadline</th>
                      <th>Readiness</th>
                      <th>Stage</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => {
                      const readiness = Math.max(0, Math.min(100, Number(r.readiness_score ?? 0)));
                      return (
                        <tr key={String(r.id ?? r.reference)}>
                          <td>
                            <Link href={`/tender/invitations/${String(r.id)}`} style={{ textDecoration: "none" }}>
                              <RefText value={r.reference} />
                            </Link>
                          </td>
                          <td>
                            <strong style={{ display: "block", fontSize: 12 }}>{String(r.title ?? "—")}</strong>
                            <small className="muted">{truncate(r.description)}</small>
                          </td>
                          <td style={{ fontSize: 12 }}>{String(r.client ?? "—")}</td>
                          <td style={{ fontSize: 12 }}>{String(r.category || "—")}</td>
                          <td className="mono" style={{ fontSize: 12 }}>{money.format(Number(r.estimated_value ?? 0))}</td>
                          <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>{fmtDateTime(r.submission_deadline)}</td>
                          <td>
                            <div style={{ alignItems: "center", display: "flex", gap: 8, minWidth: 120 }}>
                              <div className="progress" style={{ flex: 1 }}>
                                <span style={{ width: `${readiness}%` }} />
                              </div>
                              <span className="mono" style={{ color: "var(--muted)", fontSize: 11 }}>{readiness}%</span>
                            </div>
                          </td>
                          <td><StatusPill value={String(r.stage ?? "—")} tone={stageToneMap[String(r.stage)] ?? "gray"} /></td>
                          <td>
                            <Link className="btn ghost sm" href={`/tender/invitations/${String(r.id)}`} style={{ textDecoration: "none" }}>Open</Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        )}
      </div>
    </ModuleShell>
  );
}
