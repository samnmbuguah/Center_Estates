"use client";

import { useState } from "react";
import { DetailDrawer, Field } from "@/components/module-ui";
import { Row } from "../../types/facility.types";
import { exportCsv } from "../../utils/facility.utils";
import { FcStatus } from "../FacilityToolbar";

function EmptyState({ message = "No data available." }: { message?: string }) {
  return (
    <div className="empty-state" style={{ padding: "40px 20px", textAlign: "center", color: "#8a96a7" }}>
      {message}
    </div>
  );
}

export function InventoryView({ variant, rows }: { variant: "spare-parts" | "consumables"; rows: Row[] }) {
  const [selected, setSelected] = useState<Row | null>(null);
  const isSpare = variant === "spare-parts";
  const title = isSpare ? "Spare Parts" : "Consumables";
  const matchCategories = isSpare ? ["spare", "part"] : ["consum", "general"];

  const filtered = rows.filter((r) => {
    const cat = String(r.category ?? "").toLowerCase();
    return matchCategories.some((c) => cat.includes(c));
  });
  const displayRows = filtered.length > 0 ? filtered : rows;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20, margin: 0, letterSpacing: "-.02em" }}>{title}</h2>
          <p style={{ color: "#8a96a7", fontSize: 13, margin: "4px 0 0" }}>
            Derived from the asset register — the backend has no dedicated inventory model.
          </p>
        </div>
        <button className="fc-toolbar-btn" onClick={() => exportCsv(displayRows, `${variant}.csv`)}>↓ Export</button>
      </div>

      <div className="data-panel">
        <div className="fc-table-toolbar">
          <div className="fc-table-toolbar-left">
            <span style={{ color: "#27364a", fontWeight: 700, fontSize: 13 }}>{title} ({displayRows.length})</span>
          </div>
          {filtered.length === 0 && (
            <span style={{ color: "#92400e", fontSize: 11, fontWeight: 600 }}>
              No assets matched the {isSpare ? "“spare” / “part”" : "“consumable” / “general”"} category — showing all assets. Categorize assets to enable the split.
            </span>
          )}
        </div>
        <div className="table-scroll">
          <table className="fc-data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Category</th>
                <th>Qty on Hand</th>
                <th>Location</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.length > 0 ? displayRows.map((row) => {
                const qty = Number(row.quantity ?? (row.is_active === false ? 0 : 1));
                return (
                  <tr
                    key={String(row.id)}
                    className={selected?.id === row.id ? "selected" : ""}
                    onClick={() => setSelected(selected?.id === row.id ? null : row)}
                  >
                    <td style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "#6b7890" }}>{String(row.code ?? "—")}</td>
                    <td><strong style={{ fontSize: 12 }}>{String(row.name ?? "—")}</strong></td>
                    <td style={{ fontSize: 12 }}>{String(row.category ?? "—")}</td>
                    <td style={{ fontSize: 12 }}>{qty}</td>
                    <td style={{ fontSize: 12, color: "#6b7890" }}>{String(row.property_name ?? "—")}</td>
                    <td><FcStatus value={String(row.is_active === false ? "inactive" : (row.condition ?? "active"))} /></td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={6}><EmptyState message={`No ${title.toLowerCase()} available.`} /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <DetailDrawer title={`${title} — Details`} onClose={() => setSelected(null)}>
          <div style={{ display: "grid", gap: 12 }}>
            <Field label="Code"><span>{String(selected.code ?? "—")}</span></Field>
            <Field label="Name"><span>{String(selected.name ?? "—")}</span></Field>
            <Field label="Category"><span>{String(selected.category ?? "—")}</span></Field>
            <Field label="Qty on Hand"><span>{String(selected.quantity ?? "1")}</span></Field>
            <Field label="Location"><span>{String(selected.property_name ?? "—")}</span></Field>
            <Field label="Condition"><span>{String(selected.condition ?? "good")}</span></Field>
          </div>
        </DetailDrawer>
      )}
    </>
  );
}
