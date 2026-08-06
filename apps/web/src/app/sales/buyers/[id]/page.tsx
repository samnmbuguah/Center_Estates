"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { ModuleShell } from "@/components/module-shell";
import { salesNav } from "@/lib/module-nav";
import { apiFetch } from "@/lib/api";
import { Badge, ErrorBanner, Field, KpiCard, KpiStrip, LoadingState, Panel, StatusPill } from "@/components/module-ui";

type Row = Record<string, unknown>;

function fmtDateTime(v: unknown): string {
  if (!v) return "—";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function toneForBuyer(s: string): "green" | "red" | "yellow" | "blue" | "cyan" | "purple" | "gray" {
  if (s === "active" || s === "completed") return "green";
  if (s === "qualified") return "blue";
  if (s === "lead") return "yellow";
  if (s === "cancelled") return "red";
  return "gray";
}

export default function SingleBuyerWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [row, setRow] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    apiFetch(`/sales/buyers/${id}/`)
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as Row;
        setRow(data);
      })
      .catch(() => setError("Unable to load this buyer account."))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load, reloadKey]);

  const buyerName = row ? String(row.full_name || row.reference || "Buyer Account") : "Buyer Account";

  return (
    <ModuleShell
      moduleKey="sales"
      moduleName="Sales Management"
      eyebrow="Buyer CRM Account"
      title={buyerName}
      subtitle="Buyer profile, KYC verification documents, reserved units, and installment payment ledger."
      accent="#ea580c"
      groups={salesNav}
      activeId="buyers"
      onSelect={(tabId) => {
        if (tabId === "overview") window.location.href = "/sales";
        else window.location.href = `/sales?tab=${tabId}`;
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <Link href="/sales/buyers" className="btn ghost sm" style={{ textDecoration: "none" }}>← Back to Buyer Directory</Link>
        </div>

        {error && <ErrorBanner message={error} onRetry={() => setReloadKey((k) => k + 1)} />}

        {loading ? (
          <LoadingState rows={4} />
        ) : row ? (
          <>
            <KpiStrip cols={4}>
              <KpiCard icon="🪪" iconBg="#e0e7ff" iconColor="#4f46e5" label="National / Company ID" value={<span className="mono">{String(row.id_number ?? "—")}</span>} />
              <KpiCard icon="💰" iconBg="#fff7ed" iconColor="#ea580c" label="Financing" value={row.financing_type === "bank" ? "Bank" : "Self"} sub={String(row.financier || "")} />
              <KpiCard icon="🤝" iconBg="#dcfce7" iconColor="#16a34a" label="Assigned Agent" value={String(row.agent_name || "—")} />
              <KpiCard icon="📅" iconBg="#fef3c7" iconColor="#92400e" label="Confirmed" value={row.confirmed_at ? fmtDateTime(row.confirmed_at) : "Not confirmed"} />
            </KpiStrip>

            <div className="row" style={{ gap: 8 }}>
              <StatusPill value={String(row.status ?? "—")} tone={toneForBuyer(String(row.status ?? ""))} />
              <Badge tone={row.financing_type === "bank" ? "blue" : "green"}>{row.financing_type === "bank" ? "Bank-financed" : "Self-financed"}</Badge>
            </div>

            <Panel title="Buyer Details">
              <div className="grid-2" style={{ gap: 14 }}>
                <Field label="Full Name"><strong style={{ fontSize: 13 }}>{String(row.full_name ?? "—")}</strong></Field>
                <Field label="Reference"><span className="mono" style={{ fontSize: 13 }}>{String(row.reference ?? "—")}</span></Field>
                <Field label="Email"><span style={{ fontSize: 13 }}>{String(row.email ?? "—")}</span></Field>
                <Field label="Phone"><span style={{ fontSize: 13 }}>{String(row.phone ?? "—")}</span></Field>
                <Field label="National / Company ID"><span className="mono" style={{ fontSize: 13 }}>{String(row.id_number ?? "—")}</span></Field>
                <Field label="KRA PIN"><span className="mono" style={{ fontSize: 13 }}>{String(row.tax_number || "—")}</span></Field>
                <Field label="Financier"><span style={{ fontSize: 13 }}>{String(row.financier || "—")}</span></Field>
                <Field label="Assigned Agent"><span style={{ fontSize: 13 }}>{String(row.agent_name || "—")}</span></Field>
                <Field label="Confirmed On"><span style={{ fontSize: 13 }}>{row.confirmed_at ? fmtDateTime(row.confirmed_at) : "Not confirmed"}</span></Field>
              </div>
              {row.address ? (
                <div style={{ marginTop: 16 }}>
                  <Field label="Address"><p style={{ margin: 0, fontSize: 13, whiteSpace: "pre-wrap" }}>{String(row.address)}</p></Field>
                </div>
              ) : null}
            </Panel>
          </>
        ) : null}
      </div>
    </ModuleShell>
  );
}
