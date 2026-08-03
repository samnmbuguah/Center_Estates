"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ModuleShell } from "@/components/module-shell";
import { valuationNav } from "@/lib/module-nav";
import { apiFetch } from "@/lib/api";
import { Badge, EmptyState, ErrorBanner, LoadingState, SearchInput, StatusPill, money } from "@/components/module-ui";

type Row = Record<string, unknown>;

const EMPTY: Row[] = [];

function fmtDate(v: unknown): string {
  if (!v) return "—";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function RefText({ value }: { value: unknown }) {
  return <span className="mono" style={{ color: "var(--primary)", fontSize: 11, fontWeight: 700 }}>{String(value ?? "—")}</span>;
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

export default function InstructionsPage() {
  const [rows, setRows] = useState<Row[]>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    apiFetch("/valuation/instructions/")
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as Row[];
        setRows(Array.isArray(data) ? data : EMPTY);
      })
      .catch(() => setError("Unable to load valuation instructions."))
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
      [r.reference, r.client_name, r.property_description, r.valuation_type].some((v) => String(v ?? "").toLowerCase().includes(term)),
    );
  }, [rows, search]);

  return (
    <ModuleShell
      moduleKey="valuation"
      moduleName="Valuation"
      eyebrow="Valuation Work"
      title="Valuation Instructions"
      subtitle="Property valuation instructions, bank mortgage valuations, site inspection logs and comparable sales evidence."
      accent="#0891b2"
      groups={valuationNav}
      activeId="instructions"
      onSelect={(id) => {
        if (id === "overview") window.location.href = "/valuation";
        else window.location.href = `/valuation?tab=${id}`;
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {error && <ErrorBanner message={error} onRetry={load} />}

        {loading ? (
          <LoadingState rows={5} />
        ) : (
          <article className="data-panel">
            <header className="panel-title">
              <h2 style={{ fontSize: 14, margin: 0 }}>Valuation Instructions Register</h2>
              <SearchInput value={search} onChange={setSearch} placeholder="Search reference, client, property…" />
            </header>

            {filtered.length === 0 ? (
              <EmptyState
                icon="📋"
                title="No valuation instructions"
                description={search ? "No instructions match the current search." : "Create the first valuation instruction to seed the register."}
                action={<Link className="btn primary sm" href="/valuation?tab=instructions" style={{ textDecoration: "none" }}>+ New Instruction</Link>}
              />
            ) : (
              <div className="table-scroll">
                <table className="fc-data-table">
                  <thead>
                    <tr>
                      <th>Instruction No</th>
                      <th>Bank / Client</th>
                      <th>Property</th>
                      <th>Type</th>
                      <th>Instructed</th>
                      <th>Due</th>
                      <th>Fee</th>
                      <th>Priority</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr key={String(r.id ?? r.reference)}>
                        <td>
                          <Link href={`/valuation/instructions/${String(r.id)}`} style={{ textDecoration: "none" }}>
                            <RefText value={r.reference} />
                          </Link>
                        </td>
                        <td><strong style={{ fontSize: 12 }}>{String(r.client_name ?? "—")}</strong></td>
                        <td style={{ fontSize: 12, maxWidth: 200 }}>{String(r.property_description ?? "—")}</td>
                        <td style={{ fontSize: 12 }}>{String(r.valuation_type ?? "—")}</td>
                        <td style={{ fontSize: 12 }}>{fmtDate(r.instructed_on)}</td>
                        <td style={{ fontSize: 12 }}>{fmtDate(r.due_on)}</td>
                        <td className="mono" style={{ fontSize: 12 }}>{money.format(Number(r.quoted_fee ?? 0))}</td>
                        <td><PriorityBadge value={r.priority} /></td>
                        <td><StatusPill value={String(r.status ?? "—")} tone={instructionTone(r.status)} /></td>
                        <td>
                          <Link className="btn ghost sm" href={`/valuation/instructions/${String(r.id)}`} style={{ textDecoration: "none" }}>Open</Link>
                        </td>
                      </tr>
                    ))}
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
