"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { Modal } from "@/components/module-ui";
import { apiFetch, csrfFromCookie } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";

type ParsedMeterRow = {
  unit_code: string;
  meter_number: string;
  utility_type: string;
  tariff?: string;
  initial_reading?: string;
};

export function BulkMeterUploadModal({
  open,
  onClose,
  onSuccess,
  propertyId,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  propertyId?: string;
}) {
  const { session } = useAuth();
  const orgId = session?.activeOrganizationId ?? undefined;

  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ParsedMeterRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const handleFileUpload = (file?: File) => {
    if (!file) return;
    setError(null);
    setResultMessage(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = String(e.target?.result || "");
        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        if (lines.length < 2) {
          throw new Error("CSV file must contain a header row and at least one data row.");
        }

        // Header parsing
        const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/[\s_-]+/g, "_"));
        const unitIdx = headers.findIndex((h) => h.includes("unit"));
        const meterIdx = headers.findIndex((h) => h.includes("meter"));
        const typeIdx = headers.findIndex((h) => h.includes("type") || h.includes("utility"));
        const tariffIdx = headers.findIndex((h) => h.includes("tariff") || h.includes("rate"));
        const readingIdx = headers.findIndex((h) => h.includes("reading") || h.includes("baseline") || h.includes("initial"));

        if (unitIdx === -1 || meterIdx === -1) {
          throw new Error("CSV must include columns for 'unit_code' and 'meter_number'.");
        }

        const parsed: ParsedMeterRow[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));
          const unit_code = cols[unitIdx]?.toUpperCase();
          const meter_number = cols[meterIdx];
          if (!unit_code || !meter_number) continue;

          parsed.push({
            unit_code,
            meter_number,
            utility_type: (typeIdx !== -1 && cols[typeIdx]) ? cols[typeIdx].toLowerCase() : "electricity",
            tariff: tariffIdx !== -1 ? cols[tariffIdx] : undefined,
            initial_reading: readingIdx !== -1 ? cols[readingIdx] : undefined,
          });
        }

        if (parsed.length === 0) {
          throw new Error("No valid meter rows found in CSV.");
        }
        setRows(parsed);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to parse CSV file.");
        setRows([]);
      }
    };
    reader.readAsText(file);
  };

  const handleApply = async () => {
    if (rows.length === 0 || !orgId) return;
    setUploading(true);
    setError(null);
    try {
      await apiFetch("/auth/csrf/");
      const res = await apiFetch(
        "/properties/units/bulk-meters/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrfFromCookie(),
          },
          body: JSON.stringify({ rows }),
        },
        orgId
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = Object.values(body as Record<string, unknown>).flat().join(" ");
        throw new Error(msg || "Failed to bulk link meters.");
      }

      const data = await res.json();
      setResultMessage(
        `Successfully linked ${data.total ?? rows.length} meters (${data.created_count ?? 0} new, ${data.updated_count ?? 0} updated).`
      );
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk meter linking failed.");
    } finally {
      setUploading(false);
    }
  };

  if (!open) return null;

  return (
    <Modal
      title="Bulk Upload Utility Meters (CSV)"
      onClose={onClose}
      footer={
        <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end", width: "100%" }}>
          <Button variant="outlined" onClick={onClose} disabled={uploading} sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleApply}
            disabled={uploading || rows.length === 0}
            sx={{
              background: "var(--brand, #b91c1c)",
              textTransform: "none",
              fontWeight: 700,
              "&:hover": { background: "var(--brand-dark, #991b1b)" },
            }}
          >
            {uploading ? "Applying Meters…" : `Save & Link ${rows.length} Meters`}
          </Button>
        </Box>
      }
    >
      <Stack spacing={2}>
        <Alert severity="info">
          Link electricity or water meters across all units in this property in one go. Expected CSV columns:{" "}
          <strong>unit_code, meter_number, utility_type, tariff, initial_reading</strong>
        </Alert>

        {error && <Alert severity="error">{error}</Alert>}
        {resultMessage && <Alert severity="success">{resultMessage}</Alert>}

        {/* Upload Button */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Button variant="outlined" component="label" sx={{ textTransform: "none", fontWeight: 700 }}>
            Choose Meter CSV File
            <input
              type="file"
              hidden
              accept=".csv,text/csv"
              onChange={(e) => {
                handleFileUpload(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </Button>
          {fileName && (
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {fileName} ({rows.length} rows parsed)
            </Typography>
          )}
        </Box>

        {/* Preview Table */}
        {rows.length > 0 && (
          <TableContainer sx={{ maxHeight: 300, border: "1px solid var(--border)", borderRadius: 2 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow sx={{ bgcolor: "action.hover" }}>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Unit Code</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Meter Number</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Utility Type</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Tariff (KES)</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Baseline Reading</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row, idx) => (
                  <TableRow key={`${row.unit_code}-${idx}`}>
                    <TableCell sx={{ fontSize: 12, fontWeight: 700 }}>Unit {row.unit_code}</TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{row.meter_number}</TableCell>
                    <TableCell sx={{ fontSize: 12, textTransform: "capitalize" }}>
                      {row.utility_type === "water" ? "💧 Water" : "⚡ Electricity"}
                    </TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{row.tariff || "24.50"}</TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{row.initial_reading || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Stack>
    </Modal>
  );
}
