"use client";

import { useState } from "react";
import {
  Box,
  Button,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { Download, Plus } from "lucide-react";
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
  const inventoryRows = rows;
  const activeItems = inventoryRows.filter((row) => row.is_active !== false).length;
  const unitsOnHand = inventoryRows.reduce((total, row) => total + quantity(row), 0);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 700 }}>
            Stock control
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>{content.title}</Typography>
          <Typography variant="body2" color="text.secondary">{content.description}</Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<Download size={14} />}
            disabled={inventoryRows.length === 0}
            onClick={() => exportCsv(inventoryRows, `${variant}.csv`)}
          >
            Export CSV
          </Button>
          <Button
            size="small"
            variant="contained"
            startIcon={<Plus size={14} />}
            onClick={onAdd}
          >
            Add {content.singular}
          </Button>
        </Box>
      </Box>

      {/* Summary KPIs */}
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        {[
          { icon: "📦", label: "Stock records", value: inventoryRows.length },
          { icon: "✓", label: "Active records", value: activeItems },
          { icon: "▦", label: "Quantity on hand", value: unitsOnHand.toLocaleString() },
        ].map((kpi) => (
          <Paper key={kpi.label} variant="outlined" sx={{ p: 1.5, display: "flex", alignItems: "center", gap: 1.5, borderRadius: 2, flex: 1, minWidth: 140 }}>
            <Typography sx={{ fontSize: 20 }}>{kpi.icon}</Typography>
            <Box>
              <Typography variant="caption" color="text.secondary">{kpi.label}</Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{kpi.value}</Typography>
            </Box>
          </Paper>
        ))}
      </Box>

      {/* Table */}
      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
        <Box sx={{ px: 2.5, py: 2, borderBottom: "1px solid", borderColor: "divider", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{content.title} register</Typography>
            <Typography variant="caption" color="text.secondary">
              Items remain linked to the selected property and its maintenance records.
            </Typography>
          </Box>
          <Chip label={`${inventoryRows.length} ${inventoryRows.length === 1 ? "record" : "records"}`} size="small" variant="outlined" />
        </Box>

        {inventoryRows.length === 0 ? (
          <Box sx={{ py: 6, textAlign: "center" }}>
            <Typography sx={{ fontSize: 40, mb: 1 }}>{content.icon}</Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }} gutterBottom>
              No {content.title.toLowerCase()} recorded
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Add an inventory item and classify its category as {content.title} to make it available to maintenance teams.
            </Typography>
            <Button variant="contained" size="small" startIcon={<Plus size={14} />} onClick={onAdd}>
              Add {content.singular}
            </Button>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: "action.hover" }}>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Code</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Category</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Qty on hand</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Location</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {inventoryRows.map((row) => (
                  <TableRow
                    key={String(row.id)}
                    hover
                    selected={selected?.id === row.id}
                    onClick={() => setSelected(selected?.id === row.id ? null : row)}
                    sx={{ cursor: "pointer" }}
                  >
                    <TableCell>
                      <Typography variant="caption" sx={{ fontWeight: 700, fontFamily: "ui-monospace, monospace" }}>
                        {String(row.code ?? "—")}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{String(row.name ?? "—")}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{String(row.category ?? "—")}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{quantity(row).toLocaleString()}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{String(row.property_name ?? "—")}</Typography>
                    </TableCell>
                    <TableCell>
                      <FcStatus value={String(row.is_active === false ? "inactive" : (row.condition ?? "active"))} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

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
    </Box>
  );
}
