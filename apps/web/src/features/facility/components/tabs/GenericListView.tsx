"use client";

import { useState } from "react";
import { DetailDrawer, Field, money } from "@/components/module-ui";
import { FacilityTab, Row, facilityLabels } from "../../types/facility.types";

function EmptyState({ message = "No data available." }: { message?: string }) {
  return (
    <div className="empty-state" style={{ padding: "40px 20px", textAlign: "center", color: "#8a96a7" }}>
      {message}
    </div>
  );
}

export function GenericListView({ tab, rows }: { tab: FacilityTab; rows: Row[] }) {
  const [selected, setSelected] = useState<Row | null>(null);
  const columns: Record<string, { key: string; label: string }[]> = {
    "work-order-events": [{ key: "created_at", label: "Time" }, { key: "work_order", label: "Work Order" }, { key: "event_type", label: "Event" }, { key: "from_status", label: "From" }, { key: "to_status", label: "To" }, { key: "actor_name", label: "Actor" }, { key: "notes", label: "Notes" }],
    "work-order-cost-items": [{ key: "work_order", label: "Work Order" }, { key: "kind", label: "Type" }, { key: "description", label: "Item" }, { key: "quantity", label: "Quantity" }, { key: "unit_cost", label: "Unit Cost" }, { key: "total", label: "Total" }, { key: "supplier", label: "Supplier" }],
    "work-order-attachments": [{ key: "work_order", label: "Work Order" }, { key: "file_name", label: "File" }, { key: "media_type", label: "Type" }, { key: "caption", label: "Caption" }, { key: "uploaded_by_name", label: "Uploaded By" }, { key: "created_at", label: "Uploaded" }],
  };
  const cols = columns[tab] ?? [];
  const moneyKeys = new Set(["unit_cost", "total", "cost"]);
  const displayValue = (key: string, value: string | number | boolean | null | undefined | unknown) =>
    moneyKeys.has(key) && Number(value)
      ? money.format(Number(value))
      : String(value ?? "—");
  const titleCase = (key: string) => key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <article className="data-panel">
      <div className="fc-table-toolbar">
        <span style={{ color: "#27364a", fontWeight: 700, fontSize: 13 }}>{facilityLabels[tab]}</span>
      </div>
      {rows.length > 0 ? (
        <div className="table-scroll">
          <table className="fc-data-table">
            <thead>
              <tr>{cols.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={String(row.id ?? i)}
                  className={selected?.id === row.id ? "selected" : ""}
                  onClick={() => setSelected(selected?.id === row.id ? null : row)}
                >
                  {cols.map((c) => (
                    <td key={c.key} style={{ fontSize: 12 }}>{displayValue(c.key, row[c.key] ?? null)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <EmptyState message={`No ${facilityLabels[tab]?.toLowerCase() ?? "item"} records found.`} />}
      {selected && (
        <DetailDrawer title={`${facilityLabels[tab]} — Details`} onClose={() => setSelected(null)}>
          <div style={{ display: "grid", gap: 12 }}>
            {Object.entries(selected).map(([key, value]) => (
              <Field key={key} label={titleCase(key)}>
                <span>{displayValue(key, value)}</span>
              </Field>
            ))}
          </div>
        </DetailDrawer>
      )}
    </article>
  );
}
