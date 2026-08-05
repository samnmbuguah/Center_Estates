"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { ModuleShell } from "@/components/module-shell";
import { tenderNav } from "@/lib/module-nav";
import { apiFetch } from "@/lib/api";
import { ErrorBanner, Field, KpiCard, KpiStrip, LoadingState, Panel, StatusPill, money } from "@/components/module-ui";

type Row = Record<string, unknown>;

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

export default function SingleTenderWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [row, setRow] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    apiFetch(`/tender/tenders/${id}/`)
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as Row;
        setRow(data);
      })
      .catch(() => setError("Unable to load this tender invitation."))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load, reloadKey]);

  const title = row ? String(row.title || row.reference || "Tender Opportunity") : "Tender Opportunity";
  const readiness = row ? Math.max(0, Math.min(100, Number(row.readiness_score ?? 0))) : 0;

  return (
    <ModuleShell
      moduleKey="tender"
      moduleName="Tender & Bidding"
      eyebrow="Tender Invitation"
      title={title}
      subtitle="AI document extraction, compliance checklist, bid decisioning, proposal assembly, and review."
      accent="#7c3aed"
      groups={tenderNav}
      activeId="tenders"
      onSelect={(tabId) => {
        if (tabId === "overview") window.location.href = "/tender";
        else window.location.href = `/tender?tab=${tabId}`;
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <Link href="/tender/invitations" className="btn ghost sm" style={{ textDecoration: "none" }}>← Back to Invitations</Link>
        </div>

        {error && <ErrorBanner message={error} onRetry={() => setReloadKey((k) => k + 1)} />}

        {loading ? (
          <LoadingState rows={4} />
        ) : row ? (
          <>
            <KpiStrip cols={4}>
              <KpiCard icon="📋" iconBg="rgba(124,58,237,0.12)" iconColor="#7c3aed" label="Reference" value={<span className="mono">{String(row.reference ?? "—")}</span>} />
              <KpiCard icon="💼" iconBg="#dcfce7" iconColor="#16a34a" label="Estimated Value" value={money.format(Number(row.estimated_value ?? 0))} />
              <KpiCard icon="📅" iconBg="#fef3c7" iconColor="#92400e" label="Submission Deadline" value={fmtDate(row.submission_deadline)} />
              <KpiCard icon="📊" iconBg="#e0e7ff" iconColor="#4f46e5" label="Readiness" value={`${readiness}%`} />
            </KpiStrip>

            <div className="row" style={{ gap: 8 }}>
              <StatusPill value={String(row.stage ?? "—")} tone={stageToneMap[String(row.stage)] ?? "gray"} />
            </div>

            <Panel title="Invitation Details">
              <div className="grid-2" style={{ gap: 14 }}>
                <Field label="Client"><strong style={{ fontSize: 13 }}>{String(row.client ?? "—")}</strong></Field>
                <Field label="Category"><span style={{ fontSize: 13 }}>{String(row.category || "—")}</span></Field>
                <Field label="Source"><span style={{ fontSize: 13 }}>{String(row.source || "—")}</span></Field>
                <Field label="Owner"><span style={{ fontSize: 13 }}>{String(row.owner_name || "—")}</span></Field>
                <Field label="Currency"><span className="mono" style={{ fontSize: 13 }}>{String(row.currency ?? "KES")}</span></Field>
                <Field label="Published On"><span style={{ fontSize: 13 }}>{fmtDate(row.published_on)}</span></Field>
                <Field label="Clarification Deadline"><span style={{ fontSize: 13 }}>{fmtDateTime(row.clarification_deadline)}</span></Field>
                <Field label="Submission Deadline"><span style={{ fontSize: 13 }}>{fmtDateTime(row.submission_deadline)}</span></Field>
              </div>
              {row.description ? (
                <div style={{ marginTop: 16 }}>
                  <Field label="Scope / Description"><p style={{ margin: 0, fontSize: 13, whiteSpace: "pre-wrap" }}>{String(row.description)}</p></Field>
                </div>
              ) : null}
              {row.source_document_url ? (
                <div style={{ marginTop: 16 }}>
                  <a className="btn primary sm" href={String(row.source_document_url)} target="_blank" rel="noreferrer">Open Source Document</a>
                </div>
              ) : null}
            </Panel>
          </>
        ) : null}
      </div>
    </ModuleShell>
  );
}
