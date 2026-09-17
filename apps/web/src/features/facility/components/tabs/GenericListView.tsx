"use client";

import { useState } from "react";
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { DetailDrawer, Field, money } from "@/components/module-ui";
import { FacilityTab, Row, facilityLabels } from "../../types/facility.types";

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
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
      <Box sx={{ px: 2.5, py: 2, borderBottom: "1px solid", borderColor: "divider" }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }} color="text.primary">
          {facilityLabels[tab]}
        </Typography>
      </Box>
      {rows.length > 0 ? (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: "action.hover" }}>
                {cols.map((c) => (
                  <TableCell key={c.key} sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>
                    {c.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow
                  key={String(row.id ?? i)}
                  hover
                  selected={selected?.id === row.id}
                  onClick={() => setSelected(selected?.id === row.id ? null : row)}
                  sx={{ cursor: "pointer" }}
                >
                  {cols.map((c) => (
                    <TableCell key={c.key}>
                      <Typography variant="body2">{displayValue(c.key, row[c.key] ?? null)}</Typography>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
          {`No ${facilityLabels[tab]?.toLowerCase() ?? "item"} records found.`}
        </Typography>
      )}
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
    </Paper>
  );
}
