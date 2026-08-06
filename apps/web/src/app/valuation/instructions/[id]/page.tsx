"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { ModuleShell } from "@/components/module-shell";
import { valuationNav } from "@/lib/module-nav";
import { apiFetch } from "@/lib/api";
import { Badge, ErrorBanner, Field, KpiCard, KpiStrip, LoadingState, Panel, StatusPill, money } from "@/components/module-ui";

type Row = Record<string, unknown>;

function fmtDate(v: unknown): string {
  if (!v) return "—";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function instructionTone(value: unknown): "green" | "red" | "yellow" | "blue" | "cyan" | "purple" | "gray" {
  const s = String(value ?? "").toLowerCase();
  if (s === "cancelled") return "red";
  if (s === "new") return "blue";
  if (s === "assigned") return "purple";
  if (s === "inspection") return "cyan";
  if (s === "drafting" || s === "review") return "yellow";
  if (["final", "delivered"].includes(s)) return "green";
  return "gray";
}

function PriorityBadge({ value }: { value: unknown }) {
  const p = String(value ?? "normal");
  const tone = p === "urgent" ? "red" : p === "high" ? "orange" : "gray";
  return <Badge value={p} tone={tone} />;
}

export default function SingleValuationWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [row, setRow] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    apiFetch(`/valuation/instructions/${id}/`)
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as Row;
        setRow(data);
      })
      .catch(() => setError("Unable to load this valuation instruction."))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load, reloadKey]);

  const title = row ? String(row.property_description || row.reference || "Valuation Instruction") : "Valuation Instruction";

  return (
    <ModuleShell
      moduleKey="valuation"
      moduleName="Valuation"
      eyebrow="Valuation Instruction"
      title={title}
      subtitle="Site inspection evidence, comparable market sales, draft valuation report, and signed certification."
      accent="#0891b2"
      groups={valuationNav}
      activeId="instructions"
      onSelect={(tabId) => {
        if (tabId === "overview") window.location.href = "/valuation";
        else window.location.href = `/valuation?tab=${tabId}`;
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <Link href="/valuation/instructions" className="btn ghost sm" style={{ textDecoration: "none" }}>← Back to Instructions</Link>
        </div>

        {error && <ErrorBanner message={error} onRetry={() => setReloadKey((k) => k + 1)} />}

        {loading ? (
          <LoadingState rows={4} />
        ) : row ? (
          <>
            <KpiStrip cols={4}>
              <KpiCard icon="📋" iconBg="#e0f2fe" iconColor="#0891b2" label="Reference" value={<span className="mono">{String(row.reference ?? "—")}</span>} />
              <KpiCard icon="💰" iconBg="#dcfce7" iconColor="#16a34a" label="Quoted Fee" value={money.format(Number(row.quoted_fee ?? 0))} />
              <KpiCard icon="📅" iconBg="#fef3c7" iconColor="#92400e" label="Instructed On" value={fmtDate(row.instructed_on)} />
              <KpiCard icon="⏳" iconBg="#fee2e2" iconColor="#b91c1c" label="Due On" value={fmtDate(row.due_on)} />
            </KpiStrip>

            <div className="row" style={{ gap: 8 }}>
              <StatusPill value={String(row.status ?? "—")} tone={instructionTone(row.status)} />
              <PriorityBadge value={row.priority} />
            </div>

            <Panel title="Instruction Details">
              <div className="grid-2" style={{ gap: 14 }}>
                <Field label="Bank / Client"><strong style={{ fontSize: 13 }}>{String(row.client_name ?? "—")}</strong></Field>
                <Field label="Valuer"><span style={{ fontSize: 13 }}>{String(row.valuer_name || "—")}</span></Field>
                <Field label="Property"><span style={{ fontSize: 13 }}>{String(row.property_description ?? "—")}</span></Field>
                <Field label="Address"><span style={{ fontSize: 13 }}>{String(row.address || "—")}</span></Field>
                <Field label="Valuation Type"><span style={{ fontSize: 13 }}>{String(row.valuation_type ?? "—")}</span></Field>
                <Field label="Purpose"><span style={{ fontSize: 13 }}>{String(row.purpose ?? "—")}</span></Field>
              </div>
              {row.instructions ? (
                <div style={{ marginTop: 16 }}>
                  <Field label="Valuer Instructions"><p style={{ margin: 0, fontSize: 13, whiteSpace: "pre-wrap" }}>{String(row.instructions)}</p></Field>
                </div>
              ) : null}
            </Panel>
          </>
        ) : null}
      </div>
    </ModuleShell>
  );
}
