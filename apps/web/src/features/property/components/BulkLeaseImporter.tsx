"use client";

import { useRef, useState } from "react";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { apiErrorMessage, apiFetch, csrfFromCookie } from "@/lib/api";
import { describeEmptyGrid, normalizeDateString, parseCsv, parseImportGrid, type ImportGridParse } from "@/lib/csv";
import { useAuth } from "@/components/auth-provider";
import { usePropertyContext } from "@/lib/property-context";

type SourceRow = Record<string, string>;
type PreviewRow = { row: number; data: SourceRow; errors: Record<string, string> };

const headers = ["tenant_code", "unit_code", "starts_on", "ends_on", "monthly_rent", "service_charge", "billing_day", "escalation_percent", "escalation_interval_months"];

function downloadTemplate() {
  const csv = [
    headers,
    ["TNT-0001", "A-101", "2026-09-01", "2027-08-31", "25000", "0", "1", "0", "12"],
    ["TNT-0002", "B-201", "01/09/2026", "31/08/2027", "50000", "0", "1", "0", "12"],
    ["TNT-0003", "G-01", "2026-09-01", "2028-08-31", "85000", "15000", "1", "10", "12"],
  ]
    .map((row) => row.map((value) => `"${value}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = "lease-import-template.csv"; link.click();
  URL.revokeObjectURL(url);
}

/**
 * Headings accepted for each lease field. Mirrors the aliases honoured by the
 * bulk-import API (tenant/tenant_code, unit/unit_code, commencement_date,
 * expiry_date) so a file the server would validate is never rejected by the
 * browser pre-parse. Values are mapped back to the canonical keys before
 * upload, so the request payload is unchanged.
 */
export const headerAliases: Record<string, string[]> = {
  tenant_code: ["tenant_code", "tenant"],
  unit_code: ["unit_code", "unit"],
  starts_on: ["starts_on", "commencement_date", "commencement", "start_date", "start"],
  ends_on: ["ends_on", "expiry_date", "expiry", "end_date", "end"],
  monthly_rent: ["monthly_rent", "rent"],
  service_charge: ["service_charge"],
  billing_day: ["billing_day"],
  escalation_percent: ["escalation_percent", "escalation"],
  escalation_interval_months: ["escalation_interval_months", "escalation_interval"],
};

/** Headings a file must match before any row can be imported. */
const requiredHeaders = ["tenant_code", "unit_code"];

export type LeaseGridParse = ImportGridParse & { rows: SourceRow[] };

export function parseLeaseGrid(parsed: string[][]): LeaseGridParse {
  return parseImportGrid(parsed, {
    fields: headerAliases,
    required: requiredHeaders,
    keep: (row) => Boolean(row.tenant_code || row.unit_code),
    normalize: (row) => {
      const clean: SourceRow = { ...row };
      // Spreadsheet exports quote thousands separators ("11,305.94"); the
      // API parses plain decimals, so strip grouping commas up front.
      for (const key of ["monthly_rent", "service_charge", "escalation_percent"]) {
        if (clean[key]) clean[key] = clean[key].replace(/,/g, "").trim();
      }
      if (clean.starts_on) clean.starts_on = normalizeDateString(clean.starts_on);
      if (clean.ends_on) clean.ends_on = normalizeDateString(clean.ends_on);
      return clean;
    },
  }) as LeaseGridParse;
}

function readRows(text: string): LeaseGridParse {
  return parseLeaseGrid(parseCsv(text));
}

async function readImportFile(file: File): Promise<LeaseGridParse> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "csv") return readRows(await file.text());
  if (extension !== "xlsx") {
    throw new Error("Choose a CSV or Excel workbook (.xlsx).");
  }

  // Load the parser only when an Excel workbook is selected, keeping ordinary
  // lease-page loads small. read-excel-file returns text, numeric and Date
  // cells; converting each populated value to text keeps the existing CSV
  // validation path and date normalisation consistent.
  const { default: readXlsxFile } = await import("read-excel-file");
  const workbookRows = await readXlsxFile(file);
  return parseLeaseGrid(workbookRows.map((row) => row.map((value) => {
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return value === null || value === undefined ? "" : String(value);
  })));
}

/** Explain an empty parse so the user can fix the file instead of guessing. */
export function describeEmptyParse(result: LeaseGridParse): string {
  return describeEmptyGrid(result, "lease rows");
}

export type PreviewErrorSummary = { message: string; count: number };

/** Group preview row errors so the dialog can state what's blocking import at a glance. */
export function summarizePreviewErrors(rows: PreviewRow[]): PreviewErrorSummary[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const message of Object.values(row.errors)) {
      counts.set(message, (counts.get(message) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([message, count]) => ({ message, count }))
    .sort((a, b) => b.count - a.count);
}

export function BulkLeaseImporter({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { session } = useAuth();
  const { activeProperty } = usePropertyContext();
  const fileRef = useRef<HTMLInputElement>(null);
  const [sourceRows, setSourceRows] = useState<SourceRow[]>([]);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [importedFileName, setImportedFileName] = useState("");
  const [autoActivate, setAutoActivate] = useState(true);
  const validCount = preview.filter((row) => Object.keys(row.errors).length === 0).length;
  const errorSummary = summarizePreviewErrors(preview);

  async function submit(mode: "preview" | "commit", rowsOverride?: SourceRow[]) {
    const rows = rowsOverride ?? sourceRows;
    if (!rows.length || !session?.activeOrganizationId) return;
    setBusy(true); setError("");
    try {
      await apiFetch("/auth/csrf/");
      const response = await apiFetch("/property/leases/bulk-import/", {
        method: "POST", headers: { "Content-Type": "application/json", "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify({ mode, rows }),
      }, session.activeOrganizationId);
      if (!response.ok) throw new Error(await apiErrorMessage(response, "Lease import could not be processed."));
      const payload = await response.json();
      setPreview(payload.rows ?? []);
      if (mode === "commit") {
        if (autoActivate && payload.created_ids && payload.created_ids.length > 0) {
          try {
            await apiFetch("/property/leases/bulk-activate/", {
              method: "POST",
              headers: { "Content-Type": "application/json", "X-CSRFToken": csrfFromCookie() },
              body: JSON.stringify({ lease_ids: payload.created_ids }),
            }, session.activeOrganizationId);
          } catch {
            // non-fatal, fallback to draft
          }
        }
        onDone(); onClose(); setSourceRows([]); setPreview([]);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Lease import could not be processed.");
    } finally { setBusy(false); }
  }

  return <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="md">
    <DialogTitle>Import existing leases</DialogTitle>
    {busy && <LinearProgress />}
    <DialogContent>
      <Typography color="text.secondary" sx={{ mb: 1 }}>
        Match existing tenants and units. All imported leases for property onboarding are registered as existing paper leases — digital offer letter signing is bypassed.
      </Typography>
      {activeProperty
        ? <Typography variant="body2" sx={{ mb: 2 }}>Importing into property: <strong>{activeProperty.name}</strong></Typography>
        : <Alert severity="warning" sx={{ mb: 2 }}>No property selected — pick a property in the workspace switcher first, or units cannot match.</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {notice && <Alert severity="warning" sx={{ mb: 2 }}>{notice}</Alert>}
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
        <Button variant="outlined" onClick={downloadTemplate}>Download CSV template</Button>
        <Button variant="contained" onClick={() => fileRef.current?.click()}>Choose CSV or Excel (.xlsx)</Button>
        <input ref={fileRef} hidden type="file" accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={async (event) => {
          const file = event.target.files?.[0]; if (!file) return;
          setError(""); setNotice(""); setImportedFileName(""); setSourceRows([]); setPreview([]);
          try {
            const result = await readImportFile(file);
            setSourceRows(result.rows);
            if (!result.rows.length) {
              setError(describeEmptyParse(result));
            } else {
              setImportedFileName(file.name);
              const warnings: string[] = [];
              if (result.missingRequired.length) {
                warnings.push(`Heading${result.missingRequired.length === 1 ? "" : "s"} not found: ${result.missingRequired.join(", ")} — affected rows will fail validation until the column is added.`);
              }
              if (result.droppedCount > 0) {
                warnings.push(`${result.droppedCount} row${result.droppedCount === 1 ? "" : "s"} skipped (no tenant_code or unit_code).`);
              }
              if (warnings.length) setNotice(warnings.join(" "));
              // Validation runs automatically: the preview call saves nothing.
              await submit("preview", result.rows);
            }
          } catch (reason) {
            setError(reason instanceof Error ? reason.message : "The selected file could not be read. Download the template and try again.");
          }
          event.target.value = "";
        }} />
      </Box>
      {importedFileName && preview.length === 0 && !busy && <Alert severity="success" sx={{ mb: 2 }}>Loaded {sourceRows.length} lease row{sourceRows.length === 1 ? "" : "s"} from {importedFileName}. Validating…</Alert>}
      {preview.length > 0 && <Paper variant="outlined" sx={{ overflowX: "auto" }}>
        <Alert severity={validCount === preview.length ? "success" : "warning"}>
          {validCount} ready; {preview.length - validCount} need correction. Nothing has been saved yet.
          {errorSummary.length > 0 && validCount < preview.length && (
            <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2 }}>
              {errorSummary.map((item) => <li key={item.message}>{item.count}× {item.message}</li>)}
            </Box>
          )}
        </Alert>
        <Table size="small"><TableHead><TableRow><TableCell>Row</TableCell><TableCell>Tenant</TableCell><TableCell>Unit</TableCell><TableCell>Term</TableCell><TableCell>Rent</TableCell><TableCell>Service Charge</TableCell><TableCell>Inherited deposit</TableCell><TableCell>Validation</TableCell></TableRow></TableHead>
          <TableBody>{preview.map((row) => <TableRow key={row.row} sx={Object.keys(row.errors).length ? { bgcolor: "error.lighter" } : undefined}>
            <TableCell>{row.row}</TableCell><TableCell>{row.data.tenant}</TableCell><TableCell>{row.data.unit_code}</TableCell>
            <TableCell sx={{ whiteSpace: "nowrap" }}>{row.data.starts_on} – {row.data.ends_on}</TableCell>
            <TableCell sx={{ whiteSpace: "nowrap" }}>{row.data.monthly_rent ? `KES ${Number(row.data.monthly_rent).toLocaleString()}` : "—"}</TableCell>
            <TableCell>{row.data.service_charge ? `KES ${Number(row.data.service_charge).toLocaleString()}` : "—"}</TableCell>
            <TableCell>{row.data.deposit}</TableCell>
            <TableCell>{Object.values(row.errors).join(" ") || "Ready"}</TableCell>
          </TableRow>)}</TableBody>
        </Table>
      </Paper>}
    </DialogContent>
    <DialogActions sx={{ px: 3, py: 2, justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
      <Box sx={{ display: "flex", alignItems: "center" }}>
        <input
          type="checkbox"
          id="bulk-import-auto-activate"
          checked={autoActivate}
          onChange={(e) => setAutoActivate(e.target.checked)}
          style={{ marginRight: 8, width: 16, height: 16, accentColor: "var(--brand-primary, #1e40af)", cursor: "pointer" }}
        />
        <label htmlFor="bulk-import-auto-activate" style={{ fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          ⚡ Activate leases immediately upon import (populates live Tenancy Schedule & rent ledger)
        </label>
      </Box>
      <Box sx={{ display: "flex", gap: 1 }}>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="contained" onClick={() => submit("commit")} disabled={busy || !preview.length || validCount === 0} sx={{ fontWeight: 800 }}>
          Import {validCount} {autoActivate ? "Active" : "Draft"} Leases
        </Button>
      </Box>
    </DialogActions>
  </Dialog>;
}
