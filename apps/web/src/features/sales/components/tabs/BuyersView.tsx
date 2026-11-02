"use client";

import { useEffect, useState } from "react";
import { Badge, EmptyState, KpiCard, KpiStrip, LoadingState, number, Panel, StatusPill } from "@/components/module-ui";
import { apiFetch } from "@/lib/api";
import { Row, Tone } from "../../types/sales.types";
import { countBy, fmtDate, fmtDateTime, fmtMoney, toneForAudit } from "../../utils/sales.utils";
import { DataTable, DField, FilterChips, RefText, TableChrome } from "../SalesUiComponents";
import { SavedViews } from "../SavedViews";
import { Box, Grid, Typography } from "@mui/material";
import { Users, CheckCircle, Magnet, GraduationCap, DollarSign } from "lucide-react";

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

export function BuyerProfileView({
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
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button
            className="btn sm"
            onClick={() => window.open(`/buyer-portal?buyer=${buyer.id}`, "_blank")}
            style={{
              background: "#3b82f6",
              color: "#fff",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 6,
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              padding: "6px 12px",
            }}
          >
            <span>📱</span> Open Client Portal
          </button>
        </div>
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
                  <td style={{ fontSize: 11, color: "var(--muted)" }}>{fmtDateTime(a.created_at)}</td>
                  <td><strong style={{ fontSize: 12 }}>{String(a.actor_name ?? "—")}</strong></td>
                  <td><Badge tone={toneForAudit(String(a.event_type))}>{String(a.event_type ?? "—").replaceAll("_", " ")}</Badge></td>
                  <td style={{ fontSize: 11, color: "var(--muted)", maxWidth: 320 }}>{String(a.notes || "—")}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </Panel>
      )}
    </>
  );
}

export function BuyersView({
  rows,
  search,
  setSearch,
  status,
  setStatus,
  openRegisterBuyer,
  transitionBuyer,
  org,
  canSell,
}: {
  rows: Row[];
  search: string;
  setSearch: (v: string) => void;
  status: string;
  setStatus: (v: string) => void;
  openRegisterBuyer: () => void;
  transitionBuyer: (row: Row) => void;
  org: string | null;
  canSell: boolean;
}) {
  const [selected, setSelected] = useState<Row | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "board">("table");
  const active = countBy(rows, ["active", "qualified"]);

  const buyerStages: { key: string; label: string; color: string }[] = [
    { key: "lead", label: "Inbound Leads", color: "var(--color-amber-strong)" },
    { key: "qualified", label: "Qualified Buyers", color: "var(--color-sky)" },
    { key: "active", label: "Active Deals", color: "var(--color-success)" },
    { key: "completed", label: "Closed / Completed", color: "var(--color-indigo)" },
  ];

  return (
    <>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 2 }}>
          Buyers Registry
        </Typography>
        <Typography variant="body1" sx={{ color: "text.secondary", mb: 3 }}>
          Manage buyer registration, qualifications, and sales pipeline.
        </Typography>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Box sx={{ 
            p: 2, borderRadius: 2, bgcolor: "var(--color-indigo-bg)", color: "var(--color-indigo)",
            textAlign: "center"
          }}>
            <Users size={24} style={{ marginBottom: 8 }} />
            <Typography variant="h3" sx={{ fontWeight: 800 }}>{number.format(rows.length)}</Typography>
            <Typography variant="caption">Total Buyers</Typography>
          </Box>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Box sx={{ 
            p: 2, borderRadius: 2, bgcolor: "var(--color-green-bg)", color: "var(--color-success)",
            textAlign: "center"
          }}>
            <CheckCircle size={24} style={{ marginBottom: 8 }} />
            <Typography variant="h3" sx={{ fontWeight: 800 }}>{number.format(active)}</Typography>
            <Typography variant="caption">Active Buyers</Typography>
          </Box>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Box sx={{ 
            p: 2, borderRadius: 2, bgcolor: "var(--color-amber-bg)", color: "var(--color-amber-strong)",
            textAlign: "center"
          }}>
            <Magnet size={24} style={{ marginBottom: 8 }} />
            <Typography variant="h3" sx={{ fontWeight: 800 }}>{number.format(countBy(rows, ["lead"]))}</Typography>
            <Typography variant="caption">Leads</Typography>
          </Box>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Box sx={{ 
            p: 2, borderRadius: 2, bgcolor: "var(--color-sky-bg)", color: "var(--color-sky)",
            textAlign: "center"
          }}>
            <GraduationCap size={24} style={{ marginBottom: 8 }} />
            <Typography variant="h3" sx={{ fontWeight: 800 }}>{number.format(countBy(rows, ["completed"]))}</Typography>
            <Typography variant="caption">Completed</Typography>
          </Box>
        </Grid>
      </Grid>

      <Panel title="Buyers Registry" badge={rows.length}>
        <TableChrome
          search={search}
          setSearch={setSearch}
          placeholder="Search name, reference, ID, email…"
          chips={<FilterChips options={[{ value: "lead", label: "Leads" }, { value: "qualified", label: "Qualified" }, { value: "active", label: "Active" }, { value: "completed", label: "Completed" }, { value: "cancelled", label: "Cancelled" }]} value={status as "lead" | "qualified" | "active" | "completed" | "cancelled" | ""} onChange={(v) => setStatus(v)} />}
          actions={
            <div className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <SavedViews scope="buyers" current={{ status, search }} onApply={(f) => { setStatus(f.status); setSearch(f.search); }} />
              <button className={`btn sm ${viewMode === "table" ? "primary" : "ghost"}`} onClick={() => setViewMode("table")}>Table</button>
              <button className={`btn sm ${viewMode === "board" ? "primary" : "ghost"}`} onClick={() => setViewMode("board")}>Kanban</button>
              {canSell ? <button className="btn primary sm" onClick={openRegisterBuyer}>+ Register Buyer</button> : null}
            </div>
          }
        >
          {rows.length === 0 ? (
            <EmptyState icon="👥" title="No buyers registered" description="Register your first buyer to attach units, installments and payments." action={canSell ? <button className="btn primary sm" onClick={openRegisterBuyer}>+ Register Buyer</button> : undefined} />
          ) : viewMode === "board" ? (
            <div className="kanban-scroll" style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 8, alignItems: "flex-start" }}>
              {buyerStages.map((stage) => {
                const items = rows.filter((r) => String(r.status ?? "") === stage.key);
                return (
                  <div key={stage.key} style={{ minWidth: 264, flex: "0 0 264px", background: "var(--surface-2, var(--color-slate-50))", border: "1px solid var(--border)", borderRadius: 12, padding: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 800, fontSize: 12 }}>
                        <i style={{ width: 8, height: 8, borderRadius: "50%", background: stage.color, display: "inline-block" }} />
                        {stage.label}
                        <span style={{ color: "var(--muted)", fontWeight: 600 }}>{items.length}</span>
                      </span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {items.length === 0 ? (
                        <div style={{ fontSize: 11, color: "var(--muted)", padding: "12px 4px", textAlign: "center", border: "1px dashed var(--border)", borderRadius: 8 }}>No buyers</div>
                      ) : items.map((r) => {
                        const initials = String(r.full_name ?? "B").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
                        return (
                          <article
                            key={String(r.id)}
                            onClick={() => setSelected(r)}
                            style={{ background: "var(--surface, #fff)", border: "1px solid var(--border)", borderLeft: `3px solid ${stage.color}`, borderRadius: 10, padding: 10, cursor: "pointer" }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 6, alignItems: "center" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--surface-sunken)", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700, color: "var(--text-primary)" }}>
                                  {initials}
                                </span>
                                <strong style={{ fontSize: 12 }}>{String(r.full_name ?? "—")}</strong>
                              </div>
                              <RefText value={r.reference} />
                            </div>
                            <div style={{ fontSize: 11, color: "var(--muted)", margin: "6px 0 6px" }}>
                              📞 {String(r.phone ?? "No phone")} {r.email ? `· ✉️ ${String(r.email)}` : ""}
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10 }}>
                              <Badge tone={r.financing_type === "bank" ? "blue" : "green"}>{r.financing_type === "bank" ? "Bank Mortgaged" : "Self-Financed"}</Badge>
                              {r.phone ? (
                                <a
                                  href={`https://wa.me/${String(r.phone).replace(/[^0-9]/g, "")}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  style={{ color: "var(--color-success)", fontWeight: 700, textDecoration: "none" }}
                                >
                                  💬 WhatsApp
                                </a>
                              ) : null}
                            </div>
                            {canSell && String(r.status) in BUYER_TRANSITIONS && BUYER_TRANSITIONS[String(r.status)].length > 0 && (
                              <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                                <button className="btn ghost sm" style={{ fontSize: 10, padding: "2px 8px" }} onClick={(e) => { e.stopPropagation(); setSelected(r); }}>Profile</button>
                                <button className="btn ghost sm" style={{ fontSize: 10, padding: "2px 8px" }} onClick={(e) => { e.stopPropagation(); transitionBuyer(r); }}>Advance Stage →</button>
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <DataTable headers={["Ref", "Name", "ID Number", "KRA PIN", "Contact", "Email", "Financing", "Status", "Actions"]}>
              {rows.map((r) => (
                <tr key={String(r.id)} onClick={() => setSelected(r)}>
                  <td><RefText value={r.reference} /></td>
                  <td><strong style={{ fontSize: 12 }}>{String(r.full_name ?? "—")}</strong></td>
                  <td className="mono" style={{ fontSize: 12 }}>{String(r.id_number ?? "—")}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{String(r.tax_number || "—")}</td>
                  <td style={{ fontSize: 12 }}>{String(r.phone ?? "—")}</td>
                  <td style={{ fontSize: 12, color: "var(--muted)" }}>{String(r.email ?? "—")}</td>
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
