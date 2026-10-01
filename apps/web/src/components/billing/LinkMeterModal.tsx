"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Droplets, Flame, Gauge, Zap } from "lucide-react";
import { Modal } from "@/components/module-ui";
import { apiFetch, csrfFromCookie } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";

type UnitOption = {
  id: string;
  code: string;
  unit_type?: string;
  floor?: string;
  electricity_meter?: { id: string; code: string; name: string; tariff: string } | null;
  water_meter?: { id: string; code: string; name: string; tariff: string } | null;
};

export function LinkMeterModal({
  open,
  onClose,
  onSuccess,
  propertyId,
  initialUnitId,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  propertyId?: string;
  initialUnitId?: string;
}) {
  const { session } = useAuth();
  const orgId = session?.activeOrganizationId ?? undefined;

  const [loadingUnits, setLoadingUnits] = useState(false);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState(initialUnitId ?? "");
  const [utilityType, setUtilityType] = useState<"electricity" | "water" | "gas">("electricity");
  const [meterCode, setMeterCode] = useState("");
  const [meterName, setMeterName] = useState("");
  const [location, setLocation] = useState("");
  const [tariff, setTariff] = useState("24.50");
  const [initialReading, setInitialReading] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load units for the active property
  useEffect(() => {
    if (!open || !orgId) return;
    setLoadingUnits(true);
    const params = new URLSearchParams();
    if (propertyId) params.set("property", propertyId);
    apiFetch(`/properties/units/?${params.toString()}`, {}, orgId)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const list: UnitOption[] = Array.isArray(data) ? data : data.results || [];
        setUnits(list);
        if (!selectedUnitId && list.length > 0) {
          setSelectedUnitId(list[0].id);
        }
      })
      .catch(() => setUnits([]))
      .finally(() => setLoadingUnits(false));
  }, [open, orgId, propertyId]);

  // Adjust default tariff when utility type changes
  const handleUtilityTypeChange = (type: "electricity" | "water" | "gas") => {
    setUtilityType(type);
    if (type === "electricity") setTariff("24.50");
    else if (type === "water") setTariff("150.00");
    else setTariff("200.00");
  };

  const selectedUnit = units.find((u) => u.id === selectedUnitId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnitId) {
      setError("Please select a unit to link this meter to.");
      return;
    }
    if (!meterCode.trim()) {
      setError("Please enter the physical meter serial number or code.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await apiFetch("/auth/csrf/");
      const res = await apiFetch(
        `/properties/units/${selectedUnitId}/link-meter/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrfFromCookie(),
          },
          body: JSON.stringify({
            meter_code: meterCode.trim(),
            utility_type: utilityType,
            tariff: tariff ? Number(tariff) : undefined,
            name: meterName.trim() || undefined,
            location: location.trim() || undefined,
            initial_reading: initialReading ? Number(initialReading) : undefined,
          }),
        },
        orgId
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = Object.values(body as Record<string, unknown>).flat().join(" ");
        throw new Error(msg || "Could not link meter. Please verify the meter code.");
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to link meter.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Modal
      title="Link Physical Utility Meter to Unit"
      onClose={onClose}
      footer={
        <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end", width: "100%" }}>
          <Button variant="outlined" onClick={onClose} disabled={saving} sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={saving || !selectedUnitId || !meterCode.trim()}
            sx={{
              background: "var(--brand, #b91c1c)",
              textTransform: "none",
              fontWeight: 700,
              "&:hover": { background: "var(--brand-dark, #991b1b)" },
            }}
          >
            {saving ? "Linking Meter…" : "Link Meter & Save"}
          </Button>
        </Box>
      }
    >
      <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
        {error && <Alert severity="error">{error}</Alert>}

        {/* Utility Type Selector */}
        <Box>
          <Typography variant="caption" sx={{ fontWeight: 800, textTransform: "uppercase", color: "text.secondary" }}>
            1. Select Utility Type
          </Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1.5, mt: 1 }}>
            {[
              { type: "electricity" as const, label: "Electricity", icon: <Zap size={18} />, color: "#d97706", unit: "kWh" },
              { type: "water" as const, label: "Water", icon: <Droplets size={18} />, color: "#2563eb", unit: "m³" },
              { type: "gas" as const, label: "Gas", icon: <Flame size={18} />, color: "#ea580c", unit: "m³" },
            ].map((u) => {
              const active = utilityType === u.type;
              return (
                <button
                  key={u.type}
                  type="button"
                  onClick={() => handleUtilityTypeChange(u.type)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: active ? `2px solid ${u.color}` : "1px solid var(--border)",
                    background: active ? "var(--surface)" : "var(--bg, #f8fafc)",
                    color: active ? u.color : "var(--text-secondary)",
                    fontWeight: active ? 800 : 600,
                    fontSize: 13,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {u.icon} {u.label} ({u.unit})
                </button>
              );
            })}
          </Box>
        </Box>

        <Divider />

        {/* Unit Selector */}
        <Box>
          <Typography variant="caption" sx={{ fontWeight: 800, textTransform: "uppercase", color: "text.secondary" }}>
            2. Metered Unit
          </Typography>
          {loadingUnits ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 1.5 }}>
              <CircularProgress size={18} />
              <Typography variant="body2" color="text.secondary">Loading property units…</Typography>
            </Box>
          ) : (
            <TextField
              select
              fullWidth
              size="small"
              label="Select Unit"
              value={selectedUnitId}
              onChange={(e) => setSelectedUnitId(e.target.value)}
              sx={{ mt: 1 }}
              slotProps={{ select: { native: true } }}
            >
              {units.map((u) => {
                const existing =
                  utilityType === "electricity" ? u.electricity_meter : u.water_meter;
                return (
                  <option key={u.id} value={u.id}>
                    Unit {u.code} {u.unit_type ? `(${u.unit_type})` : ""}
                    {existing ? ` — [Already has meter ${existing.code}]` : " — [No meter linked]"}
                  </option>
                );
              })}
            </TextField>
          )}

          {selectedUnit && (
            <Typography variant="caption" sx={{ color: "text.secondary", mt: 0.5, display: "block" }}>
              Selected: <strong>Unit {selectedUnit.code}</strong>
              {selectedUnit.floor ? ` · Floor ${selectedUnit.floor}` : ""}
            </Typography>
          )}
        </Box>

        <Divider />

        {/* Meter Details */}
        <Box>
          <Typography variant="caption" sx={{ fontWeight: 800, textTransform: "uppercase", color: "text.secondary" }}>
            3. Physical Meter Specifications
          </Typography>

          <Stack spacing={2} sx={{ mt: 1 }}>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1.2fr 1fr" }, gap: 1.5 }}>
              <TextField
                required
                fullWidth
                size="small"
                label="Meter Serial Number / Code"
                placeholder={utilityType === "electricity" ? "e.g. KPLC-4892019" : "e.g. WTR-00412"}
                value={meterCode}
                onChange={(e) => {
                  setMeterCode(e.target.value);
                  if (!meterName && selectedUnit) {
                    setMeterName(`Unit ${selectedUnit.code} ${utilityType === "electricity" ? "Electricity" : "Water"} Meter`);
                  }
                }}
                helperText="Physical serial number on the meter faceplate"
              />

              <TextField
                required
                fullWidth
                size="small"
                type="number"
                label={`Tariff Rate (KES / ${utilityType === "electricity" ? "kWh" : "m³"})`}
                value={tariff}
                onChange={(e) => setTariff(e.target.value)}
                helperText={utilityType === "electricity" ? "Standard KPLC sub-meter rate" : "Nairobi Water tariff rate"}
              />
            </Box>

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label={`Initial Baseline Reading (${utilityType === "electricity" ? "kWh" : "m³"})`}
                placeholder="0.0"
                value={initialReading}
                onChange={(e) => setInitialReading(e.target.value)}
                helperText="Current reading on meter as of today (optional baseline)"
              />

              <TextField
                fullWidth
                size="small"
                label="Physical Location"
                placeholder={selectedUnit ? `Floor ${selectedUnit.floor || "1"} Riser` : "e.g. Service Duct"}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                helperText="Where technician/caretaker finds the meter"
              />
            </Box>
          </Stack>
        </Box>
      </Box>
    </Modal>
  );
}
