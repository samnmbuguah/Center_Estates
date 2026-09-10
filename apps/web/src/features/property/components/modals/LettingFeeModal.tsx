"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  TextField,
  Typography,
} from "@mui/material";
import { Modal } from "@/components/module-ui";
import { apiErrorMessage, apiFetch, csrfFromCookie } from "@/lib/api";
import { toast } from "@/lib/toast";

export interface LettingFeeModalProps {
  open: boolean;
  onClose: () => void;
  units: any[];
  initialUnit?: any;
  propertyId?: string;
  onSuccess?: (createdInvoice: any) => void;
}

export function LettingFeeModal({
  open,
  onClose,
  units,
  initialUnit,
  propertyId,
  onSuccess,
}: LettingFeeModalProps) {
  const [selectedUnit, setSelectedUnit] = useState<any>(initialUnit || null);
  const [ownerName, setOwnerName] = useState<string>(
    initialUnit?.owner_name || initialUnit?.landlord_name || ""
  );
  const [feeBasis, setFeeBasis] = useState<
    "flat" | "one_month" | "half_month" | "percentage"
  >("flat");
  const [feeAmount, setFeeAmount] = useState<string>("25000");
  const [feeDate, setFeeDate] = useState<string>(
    () => new Date().toISOString().split("T")[0]
  );
  const [applyVat, setApplyVat] = useState(true);
  const [saving, setSaving] = useState(false);
  const [createdInvoice, setCreatedInvoice] = useState<any | null>(null);
  const [issueError, setIssueError] = useState("");

  const eligibleUnits = useMemo(
    () => propertyId
      ? units.filter((unit) => String(unit.property_id || unit.property) === String(propertyId))
      : units,
    [propertyId, units]
  );

  useEffect(() => {
    if (!open) return;
    const nextUnit = initialUnit && (!propertyId || String(initialUnit.property_id || initialUnit.property) === String(propertyId))
      ? initialUnit
      : null;
    setSelectedUnit(nextUnit);
    setOwnerName(nextUnit?.owner_name || nextUnit?.landlord_name || "");
    setCreatedInvoice(null);
    setIssueError("");
  }, [open, propertyId, initialUnit]);

  const effectiveRent = useMemo(() => {
    return Number(
      selectedUnit?.effective_rent ||
        selectedUnit?.monthly_rent ||
        selectedUnit?.rent ||
        0
    );
  }, [selectedUnit]);

  const numFee = Number(feeAmount) || 0;
  const vatAmount = applyVat ? Math.round(numFee * 0.16 * 100) / 100 : 0;
  const totalPayable = numFee + vatAmount;

  const handleUnitChange = (newVal: any) => {
    setSelectedUnit(newVal);
    const owner = newVal?.owner_name || newVal?.landlord_name || "";
    setOwnerName(owner);
    const rent = Number(newVal?.effective_rent || newVal?.monthly_rent || 0);
    if (rent > 0 && feeBasis !== "flat") {
      if (feeBasis === "one_month") setFeeAmount(String(rent));
      else if (feeBasis === "half_month") setFeeAmount(String(Math.round(rent * 0.5)));
      else if (feeBasis === "percentage") setFeeAmount(String(Math.round(rent * 0.1)));
    }
  };

  const handleBasisSelect = (
    basis: "flat" | "one_month" | "half_month" | "percentage"
  ) => {
    setFeeBasis(basis);
    const rent = effectiveRent || 40000;
    if (basis === "one_month") setFeeAmount(String(rent));
    else if (basis === "half_month") setFeeAmount(String(Math.round(rent * 0.5)));
    else if (basis === "percentage") setFeeAmount(String(Math.round(rent * 0.1)));
    else setFeeAmount("25000");
  };

  const handleSubmit = async () => {
    if (!selectedUnit) {
      toast.error("Please select a unit to invoice the letting fee.");
      return;
    }
    if (numFee <= 0) {
      toast.error("Enter a valid letting fee amount.");
      return;
    }
    if (!ownerName || !(selectedUnit.owner_id || selectedUnit.owner)) {
      toast.error("Assign a landlord or owner to this unit before issuing a letting-fee invoice.");
      return;
    }

    setSaving(true);
    try {
      await apiFetch("/auth/csrf/");
      const csrf = csrfFromCookie();
      const propId = selectedUnit.property_id || selectedUnit.property || propertyId;
      const ownerId = selectedUnit.owner_id || selectedUnit.owner || null;
      const period = feeDate.substring(0, 7);

      const basisLabels: Record<string, string> = {
        flat: "Negotiated Flat Amount",
        one_month: "1 Month Rent",
        half_month: "50% Month Rent",
        percentage: "10% Agency Sourcing",
      };
      const basisLabel = basisLabels[feeBasis] || "Letting Fee";

      // 1. Post to LandlordInvoice endpoint
      const landlordPayload: Record<string, any> = {
        property: propId,
        owner: ownerId,
        landlord_name: ownerName || selectedUnit.owner_name || "Landlord",
        fee_type: "letting",
        billing_period: period,
        gross_collections: 0,
        fee_amount: numFee.toFixed(2),
        fee_rate: 0,
        vat_rate: applyVat ? 16.0 : 0,
        due_on: feeDate,
        notes: `Tenant Placement & Letting Fee for Unit ${selectedUnit.code}. Basis: ${basisLabel}.`,
        metadata: {
          unit_id: selectedUnit.id,
          unit_codes: [selectedUnit.code],
          units_display: selectedUnit.code,
          fee_basis: feeBasis,
          landlord_name: ownerName,
        },
      };

      const res = await apiFetch("/property/landlord-invoices/", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": csrf },
        body: JSON.stringify(landlordPayload),
      });

      if (!res.ok) {
        const err = await apiErrorMessage(res, "Failed to issue landlord letting invoice.");
        throw new Error(err);
      }

      const draftInvoice = await res.json();

      const issueRes = await apiFetch(`/property/landlord-invoices/${draftInvoice.id}/send/`, {
        method: "POST",
        headers: { "X-CSRFToken": csrf },
      });
      let invData = draftInvoice;
      if (issueRes.ok) {
        invData = await issueRes.json();
      } else {
        setIssueError(await apiErrorMessage(issueRes, "The invoice was saved as a draft but could not be issued."));
      }

      // 2. Also register in general Invoices table
      try {
        await apiFetch("/property/invoices/", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-CSRFToken": csrf },
          body: JSON.stringify({
            unit: selectedUnit.id,
            invoice_type: "Letting Fee",
            charge_type: "letting_fee",
            recipient_type: "owner",
            owner: ownerId,
            amount: totalPayable.toFixed(2),
            subtotal: numFee.toFixed(2),
            tax_rate: applyVat ? "16.00" : "0.00",
            issued_on: feeDate,
            due_on: feeDate,
            metadata: {
              landlord_invoice_id: invData.id,
              landlord_invoice_number: invData.number,
              fee_basis: feeBasis,
              landlord_name: ownerName,
            },
          }),
        });
      } catch {
        // Non-blocking if standard invoice mirror fails
      }

      setCreatedInvoice(invData);
      toast.success(issueRes.ok
        ? `Letting fee invoice ${invData.number || ""} issued.`
        : `Letting fee invoice ${invData.number || ""} saved as draft.`);
      if (onSuccess) {
        onSuccess(invData);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to issue letting fee invoice.");
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPdf = async (invId: string) => {
    try {
      const res = await apiFetch(`/property/landlord-invoices/${invId}/pdf/?view=inline`);
      if (!res.ok) throw new Error("Could not download invoice PDF.");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (err: any) {
      toast.error(err.message || "Failed to download PDF.");
    }
  };

  if (!open) return null;

  return (
    <Modal
      title={
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <span aria-hidden="true">⚡</span> Issue Agency Letting-Fee Invoice
        </Box>
      }
      onClose={onClose}
      wide
      footer={
        <>
          <Button
            variant="outlined"
            onClick={onClose}
            sx={{ textTransform: "none" }}
          >
            {createdInvoice ? "Done" : "Cancel"}
          </Button>
          {!createdInvoice && (
            <Button
              variant="contained"
              disabled={saving || !selectedUnit || numFee <= 0}
              onClick={handleSubmit}
              sx={{
                textTransform: "none",
                background: "var(--color-info)",
                fontWeight: 700,
              }}
            >
              {saving ? "Generating Invoice..." : "⚡ Issue Letting Invoice"}
            </Button>
          )}
        </>
      }
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2.25 }}>
        {/* Banner */}
        <Box
          sx={{
            background:
              "linear-gradient(112deg, #123b78 0%, var(--color-info-strong) 58%, var(--color-info) 100%)",
            color: "#ffffff",
            p: { xs: 2, sm: 2.5 },
            borderRadius: 2.5,
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            boxShadow: "0 2px 8px rgba(37, 99, 235, 0.25)",
          }}
        >
          <span style={{ fontSize: 26 }} aria-hidden="true">
            ⚡
          </span>
          <Box>
            <Typography
              variant="overline"
              sx={{
                fontWeight: 800,
                letterSpacing: "0.08em",
                color: "rgba(255,255,255,.86)",
              }}
            >
              Agency Income · Placement Commission
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.25 }}>
              Bill the unit owner when a tenancy is successfully placed
            </Typography>
            <Typography
              variant="body2"
              sx={{ opacity: 0.92, display: "block", mt: 0.5 }}
            >
              Select the unit, confirm the agreed commission, and generate an official KRA Tax Invoice.
            </Typography>
          </Box>
        </Box>

        {createdInvoice ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, py: 1 }}>
            <Alert severity="success" sx={{ fontWeight: 600 }}>
              Letting Fee Invoice <strong>{createdInvoice.number}</strong> {createdInvoice.status === "sent" ? "was issued" : "was saved as a draft"} for KES {Number(createdInvoice.total_amount || totalPayable).toLocaleString()}.
            </Alert>
            {issueError && <Alert severity="warning">{issueError} Open Commission & Fee Invoices to retry issuing it.</Alert>}
            <Box
              sx={{
                p: 2.5,
                background: "var(--color-slate-50)",
                border: "1px solid var(--color-slate-200)",
                borderRadius: 2,
                display: "flex",
                flexDirection: "column",
                gap: 1.5,
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "var(--color-slate-900)" }}>
                Official Document Ready
              </Typography>
              <Typography variant="body2" sx={{ color: "var(--color-slate-600)" }}>
                The KRA Tax Invoice <strong>{createdInvoice.number}</strong> is ready. You can view or download the branded PDF document immediately.
              </Typography>
              <Box sx={{ display: "flex", gap: 1.5, mt: 1 }}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => handleDownloadPdf(createdInvoice.id)}
                  sx={{ textTransform: "none", fontWeight: 700 }}
                >
                  📄 View & Download Tax Invoice (PDF)
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setCreatedInvoice(null);
                    setSelectedUnit(null);
                    setOwnerName("");
                  }}
                  sx={{ textTransform: "none" }}
                >
                  + Issue Another Letting Invoice
                </Button>
              </Box>
            </Box>
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
                1. Unit and invoice recipient
              </Typography>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "1.35fr 1fr" },
                  gap: 1.5,
                }}
              >
                <Autocomplete
                  size="small"
                  options={eligibleUnits}
                  getOptionLabel={(u) =>
                    `${u.code}${u.owner_name ? ` — ${u.owner_name}` : " — owner not assigned"}`
                  }
                  value={selectedUnit}
                  onChange={(_, newVal) => handleUnitChange(newVal)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Unit"
                      placeholder="Select unit..."
                      helperText={
                        selectedUnit
                          ? selectedUnit.property_name || "Selected Unit"
                          : "Select unit to bill letting fee"
                      }
                    />
                  )}
                />
                <TextField
                  label="Landlord / Owner Name"
                  size="small"
                  value={ownerName}
                  slotProps={{ input: { readOnly: true } }}
                  placeholder="Assigned from unit ownership"
                  helperText="Recipient of the agency letting fee"
                />
              </Box>
            </Box>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.5 }}>
                2. Fee calculation
              </Typography>
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                {[
                  { key: "flat", label: "Negotiated Flat Amount" },
                  { key: "one_month", label: "1 Month Rent" },
                  { key: "half_month", label: "50% of Month Rent" },
                  { key: "percentage", label: "10% Agency Sourcing" },
                ].map((item) => {
                  const isSel = feeBasis === item.key;
                  return (
                    <Chip
                      key={item.key}
                      label={item.label}
                      clickable
                      color={isSel ? "primary" : "default"}
                      onClick={() => handleBasisSelect(item.key as any)}
                      sx={{ fontWeight: isSel ? 700 : 500 }}
                    />
                  );
                })}
              </Box>
            </Box>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                gap: 1.5,
              }}
            >
              <TextField
                label={`Letting Fee Amount (KES${applyVat ? ", excl. VAT" : ", VAT exempt"})`}
                size="small"
                type="number"
                value={feeAmount}
                onChange={(e) => setFeeAmount(e.target.value)}
                helperText={applyVat ? "Base commission payable before 16% VAT" : "Total payable — no VAT charged"}
              />
              <TextField
                label="Invoice Issue Date"
                size="small"
                type="date"
                value={feeDate}
                onChange={(e) => setFeeDate(e.target.value)}
                helperText="Date of placement / fee note"
                {...({ InputLabelProps: { shrink: true } } as any)}
              />
            </Box>

            {/* VAT toggle */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                p: 1.5,
                borderRadius: 2,
                border: "1px solid",
                borderColor: applyVat ? "rgba(37,99,235,0.25)" : "rgba(100,116,139,0.25)",
                background: applyVat ? "rgba(37,99,235,0.04)" : "rgba(0,0,0,0.02)",
                cursor: "pointer",
                userSelect: "none",
              }}
              onClick={() => setApplyVat((v) => !v)}
            >
              <Box
                sx={{
                  width: 36, height: 20, borderRadius: 10,
                  background: applyVat ? "var(--color-info)" : "var(--color-slate-400)",
                  position: "relative", flexShrink: 0, transition: "background 0.2s",
                }}
              >
                <Box sx={{
                  position: "absolute", top: 2, left: applyVat ? 18 : 2,
                  width: 16, height: 16, borderRadius: "50%",
                  background: "var(--surface)", transition: "left 0.2s",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }} />
              </Box>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 12.5, lineHeight: 1.3 }}>
                  {applyVat ? "VAT Applicable (16%)" : "No VAT — Exempt"}
                </Typography>
                <Typography variant="caption" sx={{ color: "var(--text-secondary)", fontSize: 11 }}>
                  {applyVat
                    ? `Adds KES ${vatAmount.toLocaleString()} VAT to the invoice total`
                    : "Invoice will be issued without VAT (e.g. non-VAT-registered landlord)"}
                </Typography>
              </Box>
            </Box>

            {/* Live Invoice Preview Breakdown Card */}
            <Box
              sx={{
                background: "rgba(37, 99, 235, 0.04)",
                border: "1px solid rgba(37, 99, 235, 0.2)",
                borderRadius: "8px",
                p: 2,
                display: "flex",
                flexDirection: "column",
                gap: 1,
              }}
            >
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 800,
                  color: "var(--color-info-deep)",
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                }}
              >
                <span>🧾</span> Invoice Preview Breakdown
              </Typography>

              {selectedUnit ? (
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                    gap: 1,
                    fontSize: 13,
                    pt: 0.5,
                  }}
                >
                  <div>
                    <span style={{ color: "var(--text-secondary)" }}>
                      Target Unit:
                    </span>{" "}
                    <strong>{selectedUnit.code}</strong>{" "}
                    <span
                      style={{
                        fontSize: 11,
                        color: selectedUnit.tenant_name ? "var(--color-success)" : "#ca8a04",
                      }}
                    >
                      ({selectedUnit.tenant_name ? `Leased` : "Vacant"})
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-secondary)" }}>
                      Recipient (Owner):
                    </span>{" "}
                    <strong>{ownerName || selectedUnit.owner_name || "Unassigned"}</strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-secondary)" }}>
                      Base Fee:
                    </span>{" "}
                    <strong>KES {numFee.toLocaleString()}</strong>
                  </div>
                  {applyVat && (
                    <div>
                      <span style={{ color: "var(--text-secondary)" }}>
                        VAT (16%):
                      </span>{" "}
                      <strong>KES {vatAmount.toLocaleString()}</strong>
                    </div>
                  )}
                  {!applyVat && (
                    <div style={{ fontSize: 11, color: "#ca8a04", fontStyle: "italic" }}>
                      VAT not applicable
                    </div>
                  )}
                  <Box
                    sx={{
                      gridColumn: "1 / -1",
                      pt: 1,
                      borderTop: "1px dashed rgba(37, 99, 235, 0.2)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontWeight: 600, color: "var(--color-info-deep)" }}>
                      Total Tax Invoice Payable:
                    </span>
                    <span
                      style={{
                        fontSize: 16,
                        fontWeight: 800,
                        color: "var(--color-info-deep)",
                      }}
                    >
                      KES {totalPayable.toLocaleString()}
                    </span>
                  </Box>
                </Box>
              ) : (
                <Typography
                  variant="body2"
                  sx={{
                    color: "var(--text-secondary)",
                    fontStyle: "italic",
                    fontSize: 12,
                  }}
                >
                  Select a unit above to view the real-time invoice breakdown.
                </Typography>
              )}
            </Box>

            <Box
              sx={{
                background: "var(--surface-2)",
                p: 1.5,
                borderRadius: "6px",
                border: "1px solid var(--border)",
                fontSize: 12,
                color: "var(--text-secondary)",
              }}
            >
              💼 <strong>Collection Route:</strong> Generates an official KRA Tax Invoice (<code>LB-YYYY-XXXXXX</code>). Direct payment can be settled via bank transfer or deducted from subsequent tenant rent remittances.
            </Box>
          </Box>
        )}
      </Box>
    </Modal>
  );
}
