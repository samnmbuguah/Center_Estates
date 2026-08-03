"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ModuleShell } from "@/components/module-shell";
import { salesNav } from "@/lib/module-nav";
import { apiFetch } from "@/lib/api";
import { Badge, EmptyState, ErrorBanner, LoadingState, SearchInput, StatusPill } from "@/components/module-ui";

type Row = Record<string, unknown>;

const EMPTY: Row[] = [];

function RefText({ value }: { value: unknown }) {
  return <span className="mono" style={{ color: "var(--primary)", fontSize: 11, fontWeight: 700 }}>{String(value ?? "—")}</span>;
}

function toneForBuyer(s: string): "green" | "red" | "yellow" | "blue" | "cyan" | "purple" | "gray" {
  if (s === "active" || s === "completed") return "green";
  if (s === "qualified") return "blue";
  if (s === "lead") return "yellow";
  if (s === "cancelled") return "red";
  return "gray";
}

export default function BuyersDirectoryPage() {
  const [rows, setRows] = useState<Row[]>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    apiFetch("/sales/buyers/")
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as Row[];
        setRows(Array.isArray(data) ? data : EMPTY);
      })
      .catch(() => setError("Unable to connect to the buyers registry."))
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
      [r.reference, r.full_name, r.id_number, r.tax_number, r.email].some((v) => String(v ?? "").toLowerCase().includes(term)),
    );
  }, [rows, search]);

  const active = rows.filter((b) => ["active", "qualified"].includes(String(b.status ?? ""))).length;

  return (
    <ModuleShell
      moduleKey="sales"
      moduleName="Sales Management"
      eyebrow="Sales & Marketing Workspace"
      title="Buyer & Client Directory"
      subtitle="Registered property buyers, KYC identifiers, financing type and lead status."
      accent="#ea580c"
      groups={salesNav}
      activeId="buyers"
      onSelect={(id) => {
        if (id === "overview") window.location.href = "/sales";
        else window.location.href = `/sales?tab=${id}`;
      }}
      actions={
        <Link className="btn primary sm" href="/sales?tab=buyers&register=1" style={{ textDecoration: "none" }}>
          + Register Buyer
        </Link>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {error && <ErrorBanner message={error} onRetry={load} />}

        {loading ? (
          <LoadingState rows={5} />
        ) : (
          <>
            <div className="summary-strip" style={{ marginTop: 0 }}>
              <span><b>{rows.length}</b> Total buyers</span>
              <span><b>{active}</b> Active / qualified</span>
              <span><b>{rows.filter((b) => String(b.status) === "lead").length}</b> Leads</span>
              <span><b>{rows.filter((b) => String(b.status) === "completed").length}</b> Completed</span>
              <span><b>{rows.filter((b) => String(b.financing_type) === "bank").length}</b> Bank-financed</span>
            </div>

            <article className="data-panel">
              <header className="panel-title">
                <h2 style={{ fontSize: 14, margin: 0 }}>Buyers Registry</h2>
                <SearchInput value={search} onChange={setSearch} placeholder="Search name, ref, ID, email…" />
              </header>

              {filtered.length === 0 ? (
                <EmptyState
                  icon="👥"
                  title="No buyers registered"
                  description={search ? "No buyers match the current search." : "Register your first buyer to attach units, installments and payments."}
                  action={<Link className="btn primary sm" href="/sales?tab=buyers&register=1" style={{ textDecoration: "none" }}>+ Register Buyer</Link>}
                />
              ) : (
                <div className="table-scroll">
                  <table className="fc-data-table">
                    <thead>
                      <tr>
                        <th>Ref</th>
                        <th>Buyer Name</th>
                        <th>ID / KRA</th>
                        <th>Contact</th>
                        <th>Email</th>
                        <th>Financing</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((b) => (
                        <tr key={String(b.id)}>
                          <td>
                            <Link href={`/sales/buyers/${String(b.id)}`} style={{ textDecoration: "none" }}>
                              <RefText value={b.reference} />
                            </Link>
                          </td>
                          <td><strong style={{ fontSize: 12 }}>{String(b.full_name ?? "—")}</strong></td>
                          <td className="mono" style={{ fontSize: 12 }}>
                            {String(b.id_number ?? "—")}
                            {b.tax_number ? <div style={{ color: "var(--muted)", fontSize: 11 }}>{String(b.tax_number)}</div> : null}
                          </td>
                          <td style={{ fontSize: 12 }}>{String(b.phone ?? "—")}</td>
                          <td style={{ fontSize: 12, color: "#6b7890" }}>{String(b.email ?? "—")}</td>
                          <td><Badge tone={b.financing_type === "bank" ? "blue" : "green"}>{b.financing_type === "bank" ? "Bank" : "Self"}</Badge></td>
                          <td><StatusPill value={String(b.status ?? "")} tone={toneForBuyer(String(b.status ?? ""))} /></td>
                          <td>
                            <Link className="btn ghost sm" href={`/sales/buyers/${String(b.id)}`} style={{ textDecoration: "none" }}>Open</Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          </>
        )}
      </div>
    </ModuleShell>
  );
}
