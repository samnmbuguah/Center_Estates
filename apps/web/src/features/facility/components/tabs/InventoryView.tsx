"use client";

import { useState } from "react";
import { DetailDrawer, Field } from "@/components/module-ui";
import { Row } from "../../types/facility.types";
import { exportCsv } from "../../utils/facility.utils";
import { FcStatus } from "../FacilityToolbar";

type InventoryVariant = "spare-parts" | "consumables";

const copy: Record<InventoryVariant, { title: string; singular: string; icon: string; description: string; categories: string[] }> = {
  "spare-parts": {
    title: "Spare Parts",
    singular: "spare part",
    icon: "🔩",
    description: "Replacement components held for repairs and planned maintenance.",
    categories: ["spare", "part"],
  },
  consumables: {
    title: "Consumables",
    singular: "consumable",
    icon: "🧴",
    description: "Frequently used supplies monitored for replenishment and issue control.",
    categories: ["consum"],
  },
};

function quantity(row: Row) {
  const value = Number(row.quantity ?? 1);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

export function InventoryView({
  variant,
  rows,
  onAdd,
}: {
  variant: InventoryVariant;
  rows: Row[];
  onAdd: () => void;
}) {
  const [selected, setSelected] = useState<Row | null>(null);
  const content = copy[variant];
  // The API now returns an explicitly typed inventory register. Do not infer
  // record type from free-text category names in the browser.
  const inventoryRows = rows;
  const activeItems = inventoryRows.filter((row) => row.is_active !== false).length;
  const unitsOnHand = inventoryRows.reduce((total, row) => total + quantity(row), 0);

  return (
    <section className="inventory-workspace" aria-labelledby={`${variant}-title`}>
      <header className="inventory-header">
        <div>
          <p className="inventory-eyebrow">Stock control</p>
          <h2 id={`${variant}-title`}>{content.title}</h2>
          <p>{content.description}</p>
        </div>
        <div className="inventory-actions">
          <button
            className="fc-toolbar-btn"
            disabled={inventoryRows.length === 0}
            onClick={() => exportCsv(inventoryRows, `${variant}.csv`)}
          >
            ↓ Export CSV
          </button>
          <button className="btn primary" onClick={onAdd}>+ Add {content.singular}</button>
        </div>
      </header>

      <div className="inventory-summary" aria-label={`${content.title} summary`}>
        <article><span>📦</span><div><small>Stock records</small><strong>{inventoryRows.length}</strong></div></article>
        <article><span>✓</span><div><small>Active records</small><strong>{activeItems}</strong></div></article>
        <article><span>▦</span><div><small>Quantity on hand</small><strong>{unitsOnHand.toLocaleString()}</strong></div></article>
      </div>

      <article className="data-panel inventory-panel">
        <header className="inventory-panel-header">
          <div>
            <h3>{content.title} register</h3>
            <p>Items remain linked to the selected property and its maintenance records.</p>
          </div>
          <span className="inventory-count">{inventoryRows.length} {inventoryRows.length === 1 ? "record" : "records"}</span>
        </header>

        {inventoryRows.length === 0 ? (
          <div className="inventory-empty">
            <span className="inventory-empty-icon" aria-hidden="true">{content.icon}</span>
            <h3>No {content.title.toLowerCase()} recorded</h3>
            <p>Add an inventory item and classify its category as {content.title} to make it available to maintenance teams.</p>
            <button className="btn primary" onClick={onAdd}>+ Add {content.singular}</button>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Qty on hand</th>
                  <th>Location</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {inventoryRows.map((row) => (
                  <tr
                    key={String(row.id)}
                    className={selected?.id === row.id ? "selected" : ""}
                    onClick={() => setSelected(selected?.id === row.id ? null : row)}
                  >
                    <td className="inventory-code">{String(row.code ?? "—")}</td>
                    <td><strong>{String(row.name ?? "—")}</strong></td>
                    <td>{String(row.category ?? "—")}</td>
                    <td>{quantity(row).toLocaleString()}</td>
                    <td className="inventory-location">{String(row.property_name ?? "—")}</td>
                    <td><FcStatus value={String(row.is_active === false ? "inactive" : (row.condition ?? "active"))} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      {selected && (
        <DetailDrawer title={`${content.title} — Details`} onClose={() => setSelected(null)}>
          <div style={{ display: "grid", gap: 12 }}>
            <Field label="Code"><span>{String(selected.code ?? "—")}</span></Field>
            <Field label="Name"><span>{String(selected.name ?? "—")}</span></Field>
            <Field label="Category"><span>{String(selected.category ?? "—")}</span></Field>
            <Field label="Qty on hand"><span>{quantity(selected).toLocaleString()}</span></Field>
            <Field label="Location"><span>{String(selected.property_name ?? "—")}</span></Field>
            <Field label="Condition"><span>{String(selected.condition ?? "good")}</span></Field>
          </div>
        </DetailDrawer>
      )}
    </section>
  );
}
