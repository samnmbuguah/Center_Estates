"use client";

import { useState } from "react";
import { number, DetailDrawer, EmptyState, KpiCard, KpiStrip, Panel, StatusPill } from "@/components/module-ui";
import { Row, Tone } from "../../types/sales.types";
import { countBy, fmtDateTime, fmtMoney, sumBy } from "../../utils/sales.utils";
import { DataTable, DField, FilterChips, ProgressBar, RefText, TableChrome } from "../SalesUiComponents";

function toneForInventory(s: string): Tone {
  if (s === "available") return "green";
  if (s === "reserved") return "yellow";
  if (s === "sold") return "blue";
  return "gray";
}

export function UnitGridView({ rows, onSelect }: { rows: Row[]; onSelect: (r: Row) => void }) {
  const [floor, setFloor] = useState("all");
  const floors = [...new Set(rows.map((r) => String(r.floor || "Ground")))].sort();
  const filtered = floor === "all" ? rows : rows.filter((r) => String(r.floor || "Ground") === floor);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="row" style={{ gap: 16, fontSize: 12 }}>
        <div className="row" style={{ gap: 6 }}><div style={{ width: 16, height: 16, borderRadius: 4, background: "#dcfce7", border: "1px solid #86efac" }} /><span>Available</span></div>
        <div className="row" style={{ gap: 6 }}><div style={{ width: 16, height: 16, borderRadius: 4, background: "#fef3c7", border: "1px solid #fcd34d" }} /><span>Reserved</span></div>
        <div className="row" style={{ gap: 6 }}><div style={{ width: 16, height: 16, borderRadius: 4, background: "#dbeafe", border: "1px solid #93c5fd" }} /><span>Sold</span></div>
        <div className="row" style={{ gap: 6 }}><div style={{ width: 16, height: 16, borderRadius: 4, background: "#f1f5f9", border: "1px solid #cbd5e1" }} /><span>Blocked</span></div>
      </div>

      <div className="row" style={{ gap: 8 }}>
        <button className={`btn sm ${floor === "all" ? "primary" : "ghost"}`} onClick={() => setFloor("all")}>All Floors</button>
        {floors.map((f) => (
          <button key={f} className={`btn sm ${floor === f ? "primary" : "ghost"}`} onClick={() => setFloor(f)}>{f}</button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 8 }}>
        {filtered.map((r, i) => {
          const status = String(r.status || r.listing_status || "available");
          const colors: Record<string, string> = {
            available: "#dcfce7", reserved: "#fef3c7", sold: "#dbeafe", blocked: "#f1f5f9",
          };
          const borders: Record<string, string> = {
            available: "#86efac", reserved: "#fcd34d", sold: "#93c5fd", blocked: "#cbd5e1",
          };
          return (
            <div
              key={String(r.id || i)}
              onClick={() => onSelect(r)}
              style={{
                width: "100%", aspectRatio: "1", borderRadius: 10, cursor: "pointer",
                background: colors[status] || "#dcfce7", border: `2px solid ${borders[status] || "#86efac"}`,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                padding: 8, transition: "all 0.15s ease", textAlign: "center",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.05)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "none"; }}
            >
              <span className="mono" style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>{String(r.unit_code || r.code || `U${i + 1}`)}</span>
              <span style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{String(r.unit_type || r.type || "Unit")}</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: "var(--primary)", marginTop: 4 }}>KES {Number(r.list_price || r.price || 0).toLocaleString()}</span>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && <EmptyState icon="🏢" title="No units" description="No units match the selected floor." />}
    </div>
  );
}

export function InventoryView({
  rows,
  search,
  setSearch,
  status,
  setStatus,
  canSell,
  openNewListing,
}: {
  rows: Row[];
  search: string;
  setSearch: (v: string) => void;
  status: string;
  setStatus: (v: string) => void;
  canSell: boolean;
  openNewListing: () => void;
}) {
  const [selected, setSelected] = useState<Row | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const totalValue = sumBy(rows, "list_price");

  return (
    <>
      <KpiStrip cols={5}>
        <KpiCard icon="🏢" iconBg="#e0e7ff" iconColor="#4f46e5" label="Total Listings" value={number.format(rows.length)} sub="Across all projects" />
        <KpiCard icon="🏠" iconBg="#dcfce7" iconColor="#16a34a" label="Available" value={number.format(countBy(rows, ["available"]))} sub="Open for sale" onClick={() => setStatus(status === "available" ? "" : "available")} />
        <KpiCard icon="🔒" iconBg="#fef3c7" iconColor="#92400e" label="Reserved" value={number.format(countBy(rows, ["reserved"]))} sub="Held on reservations" onClick={() => setStatus(status === "reserved" ? "" : "reserved")} />
        <KpiCard icon="✅" iconBg="#e0f2fe" iconColor="#0284c7" label="Sold" value={number.format(countBy(rows, ["sold"]))} sub="Completed sales" onClick={() => setStatus(status === "sold" ? "" : "sold")} />
        <KpiCard icon="💰" iconBg="#fff7ed" iconColor="#ea580c" label="Portfolio Value" value={fmtMoney(totalValue)} sub="Sum of list prices" />
      </KpiStrip>

      <Panel title="Projects & Units" badge={rows.length}>
        {viewMode === "grid" ? (
          <div>
            <div className="fc-table-toolbar">
              <div style={{ flex: 1 }} />
              <div className="fc-table-toolbar-right">
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn sm primary" onClick={() => setViewMode("grid")}>Grid View</button>
                  <button className="btn sm ghost" onClick={() => setViewMode("list")}>List View</button>
                  {canSell ? <button className="btn primary sm" onClick={openNewListing}>+ New Listing</button> : null}
                </div>
              </div>
            </div>
            <UnitGridView rows={rows} onSelect={(r) => setSelected(r)} />
          </div>
        ) : (
          <TableChrome
            search={search}
            setSearch={setSearch}
            placeholder="Search unit code, type or project…"
            chips={<FilterChips options={[{ value: "available", label: "Available" }, { value: "reserved", label: "Reserved" }, { value: "sold", label: "Sold" }, { value: "blocked", label: "Blocked" }]} value={status as "available" | "reserved" | "sold" | "blocked" | ""} onChange={(v) => setStatus(v)} />}
            actions={
              <div className="row" style={{ gap: 8 }}>
                <button className="btn sm ghost" onClick={() => setViewMode("grid")}>Grid View</button>
                <button className="btn sm primary" onClick={() => setViewMode("list")}>List View</button>
                {canSell ? <button className="btn primary sm" onClick={openNewListing}>+ New Listing</button> : null}
              </div>
            }
          >
            {rows.length === 0 ? (
              <EmptyState icon="🏢" title="No listings found" description={search ? "No units match the current search or status filter." : "Create a new listing to start selling units."} action={canSell ? <button className="btn primary sm" onClick={openNewListing}>+ New Listing</button> : undefined} />
            ) : (
              <DataTable headers={["Unit Code", "Project", "Floor", "Unit Type", "Price", "Progress", "Status", "Sold to", "Actions"]}>
                {rows.map((r) => (
                  <tr key={String(r.id)} onClick={() => setSelected(r)}>
                    <td><RefText value={r.unit_code} /></td>
                    <td><strong style={{ fontSize: 12 }}>{String(r.project_name ?? "—")}</strong></td>
                    <td style={{ fontSize: 12 }}>{String(r.floor ?? "—")}</td>
                    <td style={{ fontSize: 12 }}>{String(r.unit_type ?? "—")}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{fmtMoney(r.list_price)}</td>
                    <td><ProgressBar pct={Number(r.construction_progress ?? 0)} /></td>
                    <td><StatusPill value={String(r.status ?? "")} tone={toneForInventory(String(r.status ?? ""))} /></td>
                    <td style={{ fontSize: 12, color: "#8a96a7" }}>—</td>
                    <td><button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); setSelected(r); }}>Details</button></td>
                  </tr>
                ))}
              </DataTable>
            )}
          </TableChrome>
        )}
      </Panel>

      {selected && (
        <DetailDrawer title={`Unit ${String(selected.unit_code ?? "—")}`} onClose={() => setSelected(null)} width={400}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span className="fc-detail-thumb-placeholder" style={{ height: 44, width: 44, fontSize: 20 }}>🏠</span>
            <div className="fc-detail-meta">
              <strong style={{ fontSize: 14 }}>{String(selected.project_name ?? "—")}</strong>
              <small className="mono">{String(selected.unit_code ?? "—")}</small>
            </div>
            <StatusPill value={String(selected.status ?? "")} tone={toneForInventory(String(selected.status ?? ""))} />
          </div>
          <div className="fc-detail-grid">
            <DField label="Floor" value={String(selected.floor ?? "—")} />
            <DField label="Unit Type" value={String(selected.unit_type ?? "—")} />
            <DField label="List Price" value={<span className="mono">{fmtMoney(selected.list_price)}</span>} />
            <DField label="Min. Deposit" value={`${String(selected.minimum_deposit_percent ?? 0)}%`} />
            <DField label="Construction Progress" value={<ProgressBar pct={Number(selected.construction_progress ?? 0)} />} />
            <DField label="Reservation Expiry" value={selected.reservation_expires_at ? fmtDateTime(selected.reservation_expires_at) : "—"} />
          </div>
        </DetailDrawer>
      )}
    </>
  );
}
