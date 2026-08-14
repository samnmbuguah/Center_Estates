"use client";

import { ReactNode, useMemo } from "react";
import { alpha } from "@mui/material/styles";
import { Box, Button, Chip, MenuItem, Paper, TextField, Typography } from "@mui/material";
import { CalendarRange, Download, FileSpreadsheet, FileText, Filter, History, type LucideIcon } from "lucide-react";
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
  scope,
}: {
  title: string;
  subtitle: string;
  exportFormat: ExportFormat;
  onFormatChange: (value: ExportFormat) => void;
  onExport: () => void;
  exporting?: boolean;
  exportDisabled?: boolean;
  children?: ReactNode;
  scope?: string;
}) {
  const exportLabel = exportFormat === "xlsx" ? "Excel" : exportFormat.toUpperCase();
  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 2, md: 2.5 }, borderRadius: 3, overflow: "hidden", position: "relative",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2.5, flexWrap: "wrap",
        background: theme => `linear-gradient(120deg, ${alpha(theme.palette.primary.main, .1)}, ${alpha(theme.palette.background.paper, .98)} 48%, ${alpha(theme.palette.info.main, .06)})`,
        "&::after": { content: '""', position: "absolute", width: 180, height: 180, borderRadius: "50%", right: -90, top: -115, background: theme => alpha(theme.palette.primary.main, .08) },
      }}
    >
      <Box sx={{ display: "flex", gap: { xs: 1.25, sm: 1.75 }, alignItems: "flex-start", minWidth: 0, flex: "1 1 520px", position: "relative", zIndex: 1 }}>
        <Box sx={{ width: 44, height: 44, flex: "0 0 auto", borderRadius: 2.5, display: "grid", placeItems: "center", bgcolor: "primary.main", color: "primary.contrastText", boxShadow: theme => `0 8px 22px ${alpha(theme.palette.primary.main, .25)}` }}>
          <FileText size={22} />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="overline" color="primary.main" sx={{ fontWeight: 900, letterSpacing: ".11em", lineHeight: 1 }}>Reporting workspace</Typography>
          <Typography variant="h5" component="h2" sx={{ fontWeight: 900, mt: .35 }}>{title}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: .35, maxWidth: 760, overflowWrap: "anywhere" }}>{subtitle}</Typography>
          {scope && <Chip size="small" variant="outlined" label={scope} sx={{ mt: 1, maxWidth: "100%", bgcolor: "background.paper", fontWeight: 800, "& .MuiChip-label": { overflow: "hidden", textOverflow: "ellipsis" } }} />}
        </Box>
      </Box>
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center", position: "relative", zIndex: 1, ml: { xs: 0, md: "auto" } }}>
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
        <Button variant="contained" startIcon={<Download size={17} />} onClick={onExport} disabled={exportDisabled || exporting} sx={{ minHeight: 40, px: 2 }}>
          {exporting ? "Preparing…" : `Export ${exportLabel}`}
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
  const presets = useMemo(() => periodPresets(), []);
  const selectedPreset = useMemo(() => {
    const match = presets.findIndex(p => p.start === start && p.end === end);
    const keys = ["this_month", "last_month", "ytd", "last_12"];
    return match >= 0 && keys[match] ? keys[match] : "custom";
  }, [start, end, presets]);

  const handlePresetChange = (key: string) => {
    const index = key === "this_month" ? 0 : key === "last_month" ? 1 : key === "ytd" ? 2 : key === "last_12" ? 3 : -1;
    if (index >= 0 && presets[index]) {
      onStart(presets[index].start);
      onEnd(presets[index].end);
      queueMicrotask(() => onApply());
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2 }, borderRadius: 3 }}>
      <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, gap: 1.5, alignItems: { xs: "stretch", md: "center" } }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: { md: 180 } }}>
          <Box sx={{ width: 36, height: 36, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: theme => alpha(theme.palette.primary.main, .1), color: "primary.main" }}><CalendarRange size={18} /></Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Reporting period</Typography>
            <Typography variant="body2" sx={{ fontWeight: 900 }}>{selectedPreset === "custom" ? "Custom date range" : presets.find((_, index) => ["this_month", "last_month", "ytd", "last_12"][index] === selectedPreset)?.label}</Typography>
          </Box>
        </Box>
        <Box sx={{ display: "flex", gap: 1, flex: 1, flexWrap: "wrap", alignItems: "center" }}>
          <TextField type="date" size="small" label="From" value={start} onChange={event => onStart(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ flex: { xs: "1 1 145px", md: "0 1 170px" } }} />
          <TextField type="date" size="small" label="To" value={end} onChange={event => onEnd(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ flex: { xs: "1 1 145px", md: "0 1 170px" } }} />
          {extra}
          <TextField select size="small" label="Period" value={selectedPreset} onChange={event => handlePresetChange(event.target.value)} sx={{ minWidth: 155, flex: { xs: "1 1 150px", md: "0 0 155px" } }}>
            <MenuItem value="custom">Custom range</MenuItem>
            <MenuItem value="this_month">This month</MenuItem>
            <MenuItem value="last_month">Last month</MenuItem>
            <MenuItem value="ytd">Year to date</MenuItem>
            <MenuItem value="last_12">Last 12 months</MenuItem>
          </TextField>
          <Button variant="contained" color="primary" startIcon={<Filter size={16} />} onClick={onApply} sx={{ fontWeight: 800, minHeight: 40, px: 2 }}>Apply filters</Button>
        </Box>
      </Box>
    </Paper>
  );
}

export function ReportKpiCard({ icon: Icon, label, value, helper, tone = "primary" }: { icon: LucideIcon; label: string; value: ReactNode; helper: string; tone?: "primary" | "success" | "warning" | "error" | "info" }) {
  return <Paper variant="outlined" sx={{ p: 1.75, borderRadius: 3, minWidth: 0, transition: "transform .18s ease, box-shadow .18s ease", "&:hover": { transform: "translateY(-2px)", boxShadow: 2 } }}>
    <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>{label}</Typography>
        <Typography variant="h6" sx={{ fontWeight: 900, mt: .25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</Typography>
      </Box>
      <Box sx={{ width: 36, height: 36, flex: "0 0 auto", borderRadius: 2, display: "grid", placeItems: "center", bgcolor: theme => alpha(theme.palette[tone].main, .11), color: `${tone}.main` }}><Icon size={18} /></Box>
    </Box>
    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: .75 }}>{helper}</Typography>
  </Paper>;
}

export function ReportDataTable({ rows, columns }: { rows: Array<Record<string, string | number | null>>; columns: string[] }) {
  if (!rows.length) return null;
  return (
    <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>
      <Box sx={{ px: 2, py: 1.25, borderBottom: 1, borderColor: "divider", display: "flex", justifyContent: "space-between", gap: 1 }}>
        <Typography sx={{ fontWeight: 800 }}>{rows.length.toLocaleString()} record{rows.length === 1 ? "" : "s"}</Typography>
        <Typography variant="caption" color="text.primary" sx={{ fontWeight: 800 }}>Scroll horizontally on smaller screens · Export for full formatting</Typography>
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
        <Paper component="article" aria-label={item.title} key={item.key} variant="outlined" sx={{ p: 2, borderRadius: 3, display: "flex", flexDirection: "column", minHeight: 168, transition: "border-color .18s ease, box-shadow .18s ease", "&:hover": { borderColor: "primary.main", boxShadow: 2 } }}>
          <Box sx={{ display: "flex", gap: 1.25, alignItems: "flex-start" }}>
            <Box sx={{ width: 38, height: 38, borderRadius: 2, flex: "0 0 auto", display: "grid", placeItems: "center", bgcolor: theme => alpha(theme.palette.primary.main, .1), color: "primary.main" }}><FileSpreadsheet size={19} /></Box>
            <Box>
              <Typography sx={{ fontWeight: 900 }}>{item.title}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: .35 }}>{item.description}</Typography>
            </Box>
          </Box>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: "auto", pt: 1.75, borderTop: 1, borderColor: "divider" }}>
            <Button aria-label={`Export ${item.title} as PDF`} size="small" variant="contained" startIcon={<Download size={14} />} onClick={() => onExport(item.key, "pdf")}>PDF</Button>
            <Button aria-label={`Export ${item.title} as Excel`} size="small" variant="text" onClick={() => onExport(item.key, "xlsx")}>Excel</Button>
            <Button aria-label={`Export ${item.title} as CSV`} size="small" variant="text" onClick={() => onExport(item.key, "csv")}>CSV</Button>
            <Chip size="small" icon={<History size={13} />} label="Audited export" variant="outlined" sx={{ ml: { sm: "auto" } }} />
          </Box>
        </Paper>
      ))}
    </Box>
  );
}
