"use client";

import { ReactNode } from "react";
import { Box, Button, Chip, MenuItem, Paper, TextField, Typography } from "@mui/material";
import { money } from "@/components/module-ui";

export type ExportFormat = "pdf" | "xlsx" | "csv";

export function humanizeColumn(column: string): string {
  return column
    .replaceAll("_", " ")
    .replace(/\b\w/g, char => char.toUpperCase())
    .replace("Vat", "VAT")
    .replace("Id", "ID");
}

export function formatReportCell(column: string, value: string | number | null | undefined): ReactNode {
  if (value === null || value === undefined || value === "") return "—";
  const key = column.toLowerCase();
  if (key === "status" || key === "kind" || key === "type" || key === "ageing_bucket") {
    return <Chip size="small" label={String(value).replaceAll("_", " ")} />;
  }
  const moneyish = /(amount|rent|balance|billed|collected|outstanding|vat|tax|total|cost|fee|income|expense|subtotal|variance|budget|paid|net|charge)/.test(key)
    && !key.includes("rate")
    && !key.includes("percent");
  if (moneyish && !Number.isNaN(Number(value))) {
    return money.format(Number(value));
  }
  if (key.includes("percent") || key.includes("rate") && typeof value === "number") {
    return `${value}%`;
  }
  return String(value);
}

export function periodPresets(today = new Date()) {
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();
  const pad = (value: number) => String(value).padStart(2, "0");
  const iso = (year: number, monthIndex: number, day: number) => `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
  const lastDayOf = (year: number, monthIndex: number) => new Date(year, monthIndex + 1, 0).getDate();
  const trailing = new Date(y, m - 11, 1);
  return [
    { label: "This month", start: iso(y, m, 1), end: iso(y, m, d) },
    { label: "Last month", start: iso(m === 0 ? y - 1 : y, m === 0 ? 11 : m - 1, 1), end: iso(m === 0 ? y - 1 : y, m === 0 ? 11 : m - 1, lastDayOf(m === 0 ? y - 1 : y, m === 0 ? 11 : m - 1)) },
    { label: "Year to date", start: iso(y, 0, 1), end: iso(y, m, d) },
    { label: "Last 12 months", start: iso(trailing.getFullYear(), trailing.getMonth(), 1), end: iso(y, m, d) },
  ];
}

export function ReportToolbar({
  title,
  subtitle,
  exportFormat,
  onFormatChange,
  onExport,
  exporting,
  exportDisabled,
  children,
}: {
  title: string;
  subtitle: string;
  exportFormat: ExportFormat;
  onFormatChange: (value: ExportFormat) => void;
  onExport: () => void;
  exporting?: boolean;
  exportDisabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
      <Box>
        <Typography variant="overline" color="primary" sx={{ fontWeight: 900 }}>Reports & analytics</Typography>
        <Typography variant="h5" sx={{ fontWeight: 900 }}>{title}</Typography>
        <Typography variant="body2" color="text.secondary">{subtitle}</Typography>
      </Box>
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
        {children}
        <TextField
          select size="small" label="Format" value={exportFormat}
          onChange={event => onFormatChange(event.target.value as ExportFormat)}
          sx={{ minWidth: 110 }}
        >
          <MenuItem value="pdf">PDF</MenuItem>
          <MenuItem value="xlsx">Excel</MenuItem>
          <MenuItem value="csv">CSV</MenuItem>
        </TextField>
        <Button variant="contained" onClick={onExport} disabled={exportDisabled || exporting}>
          {exporting ? "Preparing…" : `Export ${exportFormat.toUpperCase()}`}
        </Button>
      </Box>
    </Paper>
  );
}

export function PeriodFilterBar({
  start,
  end,
  onStart,
  onEnd,
  onApply,
  extra,
}: {
  start: string;
  end: string;
  onStart: (value: string) => void;
  onEnd: (value: string) => void;
  onApply: () => void;
  extra?: ReactNode;
}) {
  const presets = periodPresets();
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, display: "flex", gap: 1.25, flexWrap: "wrap", alignItems: "center" }}>
      <TextField type="date" size="small" label="From" value={start} onChange={event => onStart(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
      <TextField type="date" size="small" label="To" value={end} onChange={event => onEnd(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
      {extra}
      {presets.map(preset => (
        <Button
          key={preset.label}
          size="small"
          variant="outlined"
          onClick={() => {
            onStart(preset.start);
            onEnd(preset.end);
          }}
        >
          {preset.label}
        </Button>
      ))}
      <Button variant="contained" color="inherit" onClick={onApply}>Apply</Button>
    </Paper>
  );
}

export function ReportDataTable({ rows, columns }: { rows: Array<Record<string, string | number | null>>; columns: string[] }) {
  if (!rows.length) return null;
  return (
    <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>
      <Box sx={{ px: 2, py: 1.25, borderBottom: 1, borderColor: "divider", display: "flex", justifyContent: "space-between", gap: 1 }}>
        <Typography sx={{ fontWeight: 800 }}>{rows.length.toLocaleString()} record{rows.length === 1 ? "" : "s"}</Typography>
        <Typography variant="caption" color="text.secondary">Scroll horizontally on smaller screens · Export for full formatting</Typography>
      </Box>
      <Box sx={{ overflowX: "auto" }}>
        <table className="fc-data-table">
          <thead>
            <tr>{columns.map(column => <th key={column}>{humanizeColumn(column)}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                {columns.map(column => <td key={column}>{formatReportCell(column, row[column])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </Box>
    </Paper>
  );
}

export function CriticalReportCards({
  items,
  onExport,
}: {
  items: Array<{ key: string; title: string; description: string }>;
  onExport: (key: string, format: ExportFormat) => void;
}) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5 }}>
      {items.map(item => (
        <Paper key={item.key} variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
          <Typography sx={{ fontWeight: 900 }}>{item.title}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: .5, mb: 1.5 }}>{item.description}</Typography>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <Button size="small" variant="contained" onClick={() => onExport(item.key, "pdf")}>PDF</Button>
            <Button size="small" variant="outlined" onClick={() => onExport(item.key, "xlsx")}>Excel</Button>
            <Button size="small" variant="outlined" onClick={() => onExport(item.key, "csv")}>CSV</Button>
          </Box>
        </Paper>
      ))}
    </Box>
  );
}
