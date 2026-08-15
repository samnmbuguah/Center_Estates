"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  AppBar,
  Box,
  Button,
  Checkbox,
  Dialog,
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Slide,
  Stack,
  Tab,
  Tabs,
  TextField,
  Toolbar,
  Typography,
} from "@mui/material";
import { type TransitionProps } from "@mui/material/transitions";
import { forwardRef, type ReactElement, type Ref } from "react";
import CloseRounded from "@mui/icons-material/CloseRounded";
import SaveRounded from "@mui/icons-material/SaveRounded";
import { useAuth } from "@/components/auth-provider";
import { apiFetch, csrfFromCookie } from "@/lib/api";
import { useFormDraft } from "@/lib/form-drafts";
import { usePropertyContext } from "@/lib/property-context";
import { useToast } from "@/components/monitoring/hooks/useToast";
import { DraftBanner } from "@/components/draft-banner";

const Transition = forwardRef(function Transition(
  props: TransitionProps & {
    children: ReactElement<unknown>;
  },
  ref: Ref<unknown>
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

type Unit = { id: string; code: string; floor?: string; unit_type?: string; area?: string | number; status?: string };
type Utility = { utility: string; applicable: boolean; rate_per_unit: number };
type PropertyDetails = { address?: string; city?: string; country?: string; metadata?: Record<string, unknown> };

const initialForm = {
  name: "",
  tenant_type: "company",
  address_1: "",
  address_2: "",
  city: "",
  phone: "",
  email: "",
  tax_id: "",
  registration_number: "",
  contact_name: "",
  contact_phone: "",
  contact_email: "",
  unit: "",
  term_months: "12",
  starts_on: "",
  rent_rate_per_sqft: "",
  service_charge_rate_per_sqft: "0",
  vat_rate: "16",
  security_deposit: "0",
  billing_day: "1",
  escalation_percent: "0",
  escalation_interval_months: "12",
};

const applicationSections = ["tenant-general", "tenant-lease", "tenant-utilities", "tenant-review"] as const;

function money(value: number) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 2 }).format(value || 0);
}

function addMonths(value: string, months: number) {
  if (!value || !months) return "";
  const date = new Date(`${value}T12:00:00`);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  date.setDate(Math.min(day, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
  return date.toISOString().slice(0, 10);
}

export function TenantApplicationCard({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { session } = useAuth();
  const { activeProperty } = usePropertyContext();
  const { toast } = useToast();
  const organizationId = session?.activeOrganizationId ?? null;
  const draftScope = `${organizationId || "unknown"}:${session?.user.id || "unknown"}:${activeProperty?.id || "no-property"}`;
  const [form, setForm, clearForm, formRestored, formSavedAt] = useFormDraft("tenant-application:form", initialForm, draftScope);
  const [units, setUnits] = useState<Unit[]>([]);
  const [propertyDetails, setPropertyDetails] = useState<PropertyDetails | null>(null);
  const initialUtilities: Utility[] = [
    { utility: "Electricity", applicable: false, rate_per_unit: 0 },
    { utility: "Water", applicable: false, rate_per_unit: 0 },
    { utility: "Other", applicable: false, rate_per_unit: 0 },
  ];
  const [utilities, setUtilities, clearUtilities, utilitiesRestored] = useFormDraft<Utility[]>("tenant-application:utilities", initialUtilities, draftScope);
  const [lettingFee, setLettingFee, clearLettingFee] = useFormDraft("tenant-application:letting-fee", false, draftScope);
  const [renewalFee, setRenewalFee, clearRenewalFee] = useFormDraft("tenant-application:renewal-fee", false, draftScope);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState(0);
  const draftRestored = formRestored || utilitiesRestored;
  const clearDraft = () => {
    clearForm();
    clearUtilities();
    clearLettingFee();
    clearRenewalFee();
  };

  useEffect(() => {
    if (!open || !organizationId || !activeProperty?.id) return;
    Promise.all([
      apiFetch("/property/units/?status=available", {}, organizationId).then(async (response) => (response.ok ? response.json() : [])),
      apiFetch(`/property/properties/${activeProperty.id}/`, {}, organizationId).then(async (response) => (response.ok ? response.json() : null)),
    ]).then(([unitData, propertyData]) => {
      setUnits(
        (Array.isArray(unitData) ? unitData : unitData.results ?? []).map((row: Record<string, unknown>) => ({
          id: String(row.id),
          code: String(row.code),
          floor: String(row.floor ?? ""),
          unit_type: String(row.unit_type ?? ""),
          area: row.area as string | number,
          status: String(row.status ?? ""),
        }))
      );
      if (!propertyData) return;
      const details = propertyData as PropertyDetails;
      setPropertyDetails(details);
      const metadata = details.metadata ?? {};
      const defaults = (metadata.leasing_defaults ?? {}) as Record<string, unknown>;
      const landlord = (metadata.landlord ?? {}) as Record<string, unknown>;
      setForm((current) => ({
        ...current,
        vat_rate: String(defaults.vat_rate ?? (landlord.vat_registered ? 16 : 0)),
        rent_rate_per_sqft: current.rent_rate_per_sqft || String(defaults.rent_rate_per_sqft ?? ""),
        service_charge_rate_per_sqft:
          current.service_charge_rate_per_sqft !== "0"
            ? current.service_charge_rate_per_sqft
            : String(defaults.service_charge_rate_per_sqft ?? 0),
        security_deposit:
          current.security_deposit !== "0" ? current.security_deposit : String(defaults.security_deposit ?? 0),
        billing_day: current.billing_day !== "1" ? current.billing_day : String(defaults.billing_day ?? 1),
      }));
      const configuredUtilities = Array.isArray(metadata.utilities) ? (metadata.utilities as Array<Record<string, unknown>>) : [];
      setUtilities(
        ["Electricity", "Water", "Other"].map((utility) => {
          const configured = configuredUtilities.find((row) => String(row.type ?? "").toLowerCase() === utility.toLowerCase());
          return {
            utility,
            applicable: Boolean(configured),
            rate_per_unit: Number(configured?.security_deposit_rate ?? defaults[`${utility.toLowerCase()}_deposit_rate`] ?? 0),
          };
        })
      );
    });
  }, [open, organizationId, activeProperty?.id, setForm, setUtilities]);

  const selectedUnit = units.find((unit) => unit.id === form.unit);
  const area = Number(selectedUnit?.area ?? 0);
  const rent = area * Number(form.rent_rate_per_sqft || 0);
  const serviceCharge = area * Number(form.service_charge_rate_per_sqft || 0);
  const subtotal = rent + serviceCharge;
  const vat = (subtotal * Number(form.vat_rate || 0)) / 100;
  const utilityDeposit = utilities.reduce((sum, item) => sum + (item.applicable ? item.rate_per_unit * area : 0), 0);
  const total = subtotal + vat + Number(form.security_deposit || 0) + utilityDeposit;
  const expiryDate = addMonths(form.starts_on, Number(form.term_months));
  const charges = useMemo(
    () => [
      {
        code: "RENT",
        name: "Rent",
        letting_fee: lettingFee,
        renewal_fee: renewalFee,
        account_type: "G/L Account",
        account_name: "Landlord Dues",
        area,
        rate: Number(form.rent_rate_per_sqft || 0),
        amount: rent,
      },
      {
        code: "SERVICE CHARGE",
        name: "Service Charge",
        letting_fee: false,
        renewal_fee: false,
        account_type: "G/L Account",
        account_name: "Landlord Dues",
        area,
        rate: Number(form.service_charge_rate_per_sqft || 0),
        amount: serviceCharge,
      },
      {
        code: "UTILITIES",
        name: "Utility Charge",
        letting_fee: false,
        renewal_fee: false,
        account_type: "G/L Account",
        account_name: "Landlord Dues",
        area,
        rate: 0,
        amount: utilityDeposit,
      },
    ],
    [area, form.rent_rate_per_sqft, form.service_charge_rate_per_sqft, lettingFee, renewalFee, rent, serviceCharge, utilityDeposit]
  );

  function update(name: keyof typeof initialForm, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function navigateToSection(value: number) {
    setTab(value);
    requestAnimationFrame(() =>
      document.getElementById(applicationSections[value])?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  }

  async function submit() {
    setError("");
    if (!form.name.trim() || !form.unit || !form.starts_on || !Number(form.rent_rate_per_sqft)) {
      setError("Complete the tenant name, unit, commencement date and rent rate before saving.");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/auth/csrf/");
      const response = await apiFetch(
        "/property/tenants/onboard/",
        {
          method: "POST",
          headers: { "X-CSRFToken": csrfFromCookie() },
          body: JSON.stringify({
            tenant: {
              name: form.name,
              tenant_type: form.tenant_type,
              address_1: form.address_1,
              address_2: form.address_2,
              city: form.city,
              phone: form.phone,
              email: form.email,
              tax_id: form.tax_id,
              registration_number: form.registration_number,
              contact_name: form.contact_name,
              contact_phone: form.contact_phone,
              contact_email: form.contact_email,
            },
            lease: {
              unit: form.unit,
              term_months: Number(form.term_months),
              starts_on: form.starts_on,
              area,
              rent_rate_per_sqft: Number(form.rent_rate_per_sqft),
              service_charge_rate_per_sqft: Number(form.service_charge_rate_per_sqft),
              vat_rate: Number(form.vat_rate),
              security_deposit: Number(form.security_deposit),
              billing_day: Number(form.billing_day),
              escalation_percent: Number(form.escalation_percent),
              escalation_interval_months: Number(form.escalation_interval_months),
            },
            utilities: utilities.map((item) => ({ ...item, deposit_amount: item.applicable ? item.rate_per_unit * area : 0 })),
            charges,
          }),
        },
        organizationId
      );
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(
          typeof detail.detail === "string"
            ? detail.detail
            : Object.values(detail).flat().join(" ") || "Tenant application could not be saved."
        );
      }
      clearDraft();
      setForm(initialForm);
      toast.success("Tenant application was saved successfully.");
      onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Tenant application could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  const input = (label: string, name: keyof typeof initialForm, options: Record<string, unknown> = {}) => (
    <TextField fullWidth label={label} value={form[name]} onChange={(event) => update(name, event.target.value)} {...options} />
  );
  const summary = [
    ["Monthly rent (excl. VAT)", rent],
    ["Monthly service charge (excl. VAT)", serviceCharge],
    ["Total monthly recurring (excl. VAT)", subtotal],
    ["VAT amount (16%)", vat],
    ["Total monthly amount (inc. VAT)", subtotal + vat],
    ["Security deposit (refundable)", Number(form.security_deposit || 0)],
    ["Utilities security deposit", utilityDeposit],
    ["Total initial move-in payable", total],
  ] as const;

  return (
    <Dialog
      fullScreen
      open={open}
      onClose={onClose}
      slots={{ transition: Transition }}
      sx={{
        "& .MuiDialog-paper": {
          bgcolor: "var(--bg-app)",
          color: "var(--text)",
        },
      }}
    >
      {/* 1. STICKY TOP APP BAR / HEADER */}
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: "#0f172a",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          color: "#ffffff",
        }}
      >
        <Toolbar sx={{ gap: 2, minHeight: { xs: 64, sm: 72 }, px: { xs: 2, sm: 3 } }}>
          <IconButton onClick={onClose} aria-label="Close tenant application" sx={{ color: "#ffffff" }}>
            <CloseRounded />
          </IconButton>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <span style={{ fontSize: 18 }}>🏢</span>
              <Typography variant="h6" sx={{ fontWeight: 900, color: "#ffffff", fontSize: { xs: "1rem", sm: "1.25rem" } }}>
                Tenant Application & Onboarding Card
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.7)", display: "block" }}>
              {activeProperty?.name ?? "Select Property"} · Legal tenant profile, lease contract terms, utility deposits & auto-drafting
            </Typography>
          </Box>
          <Stack direction="row" sx={{ gap: 1.5, alignItems: "center" }}>
            <Button
              variant="outlined"
              onClick={onClose}
              sx={{ color: "#cbd5e1", borderColor: "rgba(255,255,255,0.2)", "&:hover": { borderColor: "#ffffff" } }}
            >
              Discard / Close
            </Button>
            <Button
              variant="contained"
              startIcon={<SaveRounded />}
              disabled={saving}
              onClick={submit}
              sx={{
                bgcolor: "#e23b3b",
                "&:hover": { bgcolor: "#cc2b2b" },
                fontWeight: 800,
                px: 3,
              }}
            >
              {saving ? "Saving…" : "Save Tenant Application"}
            </Button>
          </Stack>
        </Toolbar>
        <Tabs
          value={tab}
          onChange={(_, value) => navigateToSection(value)}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="Tenant application sections"
          sx={{
            px: { xs: 2, sm: 3 },
            bgcolor: "rgba(255,255,255,0.03)",
            "& .MuiTab-root": { color: "rgba(255,255,255,0.7)", fontWeight: 700, fontSize: 13 },
            "& .Mui-selected": { color: "#38bdf8 !important" },
            "& .MuiTabs-indicator": { bgcolor: "#38bdf8" },
          }}
        >
          <Tab label="1. General Details" />
          <Tab label="2. Lease & Charges" />
          <Tab label="3. Utilities & Deposits" />
          <Tab label="4. Review & Move-In Breakdown" />
        </Tabs>
      </AppBar>

      {/* 2. BODY CONTENT (2-COLUMN WORKSPACE) */}
      <Box sx={{ maxWidth: 1440, mx: "auto", width: "100%", p: { xs: 2, md: 3 } }}>
        <DraftBanner
          restored={draftRestored}
          savedAt={formSavedAt}
          onDiscard={() => {
            clearDraft();
            setForm(initialForm);
            setUtilities(initialUtilities);
          }}
          message="Your unsaved tenant application draft was automatically restored from local storage."
        />
        {error && (
          <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }}>
            {error} Your entered information has been preserved.
          </Alert>
        )}

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.9fr) minmax(340px, 1fr)" }, gap: 3 }}>
          {/* LEFT COLUMN: FORM SECTIONS */}
          <Stack spacing={3}>
            {/* GENERAL SECTION */}
            <Paper id="tenant-general" variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, background: "var(--surface)" }}>
              <Typography variant="overline" sx={{ fontWeight: 900, color: "var(--primary)" }}>
                SECTION 1 · GENERAL & LEGAL PROFILE
              </Typography>
              <Typography variant="body2" sx={{ color: "var(--text-secondary)", mb: 2.5 }}>
                Capture legal entity identity, tax compliance credentials, and principal contacts.
              </Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
                <TextField label="Application Ref No." value="Auto-generated on save" disabled />
                {input("Tenant / Company Legal Name", "name", { required: true, placeholder: "e.g. Acme East Africa Ltd" })}
                {input("Entity Type", "tenant_type", {
                  select: true,
                  children: [
                    <MenuItem key="company" value="company">
                      🏢 Registered Company
                    </MenuItem>,
                    <MenuItem key="individual" value="individual">
                      👤 Individual Tenant
                    </MenuItem>,
                  ],
                })}
                {input("KRA PIN Number", "tax_id", { placeholder: "e.g. P051234567X" })}
                {input("Registration / ID Number", "registration_number", { placeholder: "e.g. CPR/2024/12345" })}
                {input("Primary Phone Number", "phone", { type: "tel", placeholder: "e.g. +254 700 000 000" })}
                {input("Official Email Address", "email", { type: "email", placeholder: "e.g. accounts@acme.co.ke" })}
                {input("Postal / Physical Address", "address_1", { placeholder: "P.O. Box 12345" })}
                {input("City / Town", "city", { placeholder: "Nairobi" })}
              </Box>
            </Paper>

            {/* PRIMARY CONTACT */}
            <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, background: "var(--surface)" }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
                Primary Contact Person / Representative
              </Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2 }}>
                {input("Contact Name", "contact_name", { placeholder: "e.g. John Doe" })}
                {input("Contact Phone", "contact_phone", { type: "tel", placeholder: "+254 712 345 678" })}
                {input("Contact Email", "contact_email", { type: "email", placeholder: "johndoe@acme.co.ke" })}
              </Box>
            </Paper>

            {/* PROPERTY & UNIT SELECTION */}
            <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, background: "var(--surface)" }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
                Property & Unit Allocation
              </Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2 }}>
                <TextField label="Property" value={activeProperty?.name ?? ""} disabled />
                <TextField select required label="Select Unit" value={form.unit} onChange={(e) => update("unit", e.target.value)}>
                  <MenuItem value="" disabled>
                    -- Choose available unit --
                  </MenuItem>
                  {units.map((unit) => (
                    <MenuItem key={unit.id} value={unit.id}>
                      Unit {unit.code} ({unit.unit_type || "Commercial"} · {Number(unit.area || 0).toLocaleString()} sqft)
                    </MenuItem>
                  ))}
                </TextField>
                <TextField label="Floor Level" value={selectedUnit?.floor ? `Floor ${selectedUnit.floor}` : "Ground Floor"} disabled />
                <TextField label="Unit Area (sq ft)" value={area ? `${area.toLocaleString()} sqft` : "0 sqft"} disabled />
                <TextField
                  label="Physical Location"
                  value={[propertyDetails?.address, propertyDetails?.city, propertyDetails?.country].filter(Boolean).join(", ")}
                  disabled
                  sx={{ gridColumn: { md: "span 2" } }}
                />
              </Box>
            </Paper>

            {/* LEASE TERMS & CHARGES */}
            <Paper id="tenant-lease" variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, background: "var(--surface)" }}>
              <Typography variant="overline" sx={{ fontWeight: 900, color: "var(--primary)" }}>
                SECTION 2 · LEASE TERMS & FINANCIAL RATES
              </Typography>
              <Typography variant="body2" sx={{ color: "var(--text-secondary)", mb: 2.5 }}>
                Rates are computed against unit sqft area. Future escalations compound automatically on the specified interval.
              </Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2 }}>
                {input("Lease Term", "term_months", {
                  select: true,
                  required: true,
                  children: [12, 24, 36, 60, 72, 120].map((m) => (
                    <MenuItem key={m} value={String(m)}>
                      {m} months ({m / 12} yr{m > 12 ? "s" : ""})
                    </MenuItem>
                  )),
                })}
                {input("Commencement Date", "starts_on", {
                  type: "date",
                  required: true,
                  slotProps: { inputLabel: { shrink: true } },
                })}
                <TextField label="Calculated Expiry Date" value={expiryDate || "Select start date"} disabled />
                {input("Rent Rate / Sq.Ft (KES)", "rent_rate_per_sqft", {
                  type: "number",
                  required: true,
                  inputProps: { min: 0, step: 0.01 },
                  placeholder: "e.g. 120.00",
                })}
                {input("Service Charge Rate / Sq.Ft (KES)", "service_charge_rate_per_sqft", {
                  type: "number",
                  inputProps: { min: 0, step: 0.01 },
                  placeholder: "e.g. 35.00",
                })}
                {input("VAT Rate", "vat_rate", {
                  select: true,
                  children: [
                    <MenuItem key="16" value="16">
                      Standard VAT (16%)
                    </MenuItem>,
                    <MenuItem key="0" value="0">
                      VAT Exempt (0%)
                    </MenuItem>,
                  ],
                })}
                {input("Security Deposit (KES)", "security_deposit", {
                  type: "number",
                  required: true,
                  inputProps: { min: 0, step: 0.01 },
                  helperText: "Refundable deposit upon vacating",
                })}
                {input("Invoice Due Day", "billing_day", {
                  type: "number",
                  inputProps: { min: 1, max: 28 },
                  helperText: "Day of month invoice is generated",
                })}
                {input("Annual Rent Escalation (%)", "escalation_percent", {
                  type: "number",
                  inputProps: { min: 0, max: 100, step: 0.01 },
                  helperText: "e.g. 5% annual increase",
                })}
                {input("Escalation Interval", "escalation_interval_months", {
                  select: true,
                  disabled: !Number(form.escalation_percent),
                  children: [
                    <MenuItem key="12" value="12">
                      Annually (Every 12 Months)
                    </MenuItem>,
                    <MenuItem key="24" value="24">
                      Biennially (Every 24 Months)
                    </MenuItem>,
                    <MenuItem key="36" value="36">
                      Triennially (Every 36 Months)
                    </MenuItem>,
                  ],
                })}
              </Box>
            </Paper>

            {/* UTILITIES SECURITY DEPOSIT */}
            <Paper id="tenant-utilities" variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, background: "var(--surface)" }}>
              <Typography variant="overline" sx={{ fontWeight: 900, color: "var(--primary)" }}>
                SECTION 3 · UTILITIES & SUB-METER DEPOSITS
              </Typography>
              <Typography variant="body2" sx={{ color: "var(--text-secondary)", mb: 2 }}>
                Configure electricity and water sub-meter security deposits applicable to this unit.
              </Typography>
              {utilities.map((item, index) => (
                <Box
                  key={item.utility}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "minmax(140px, 1fr) 160px 190px" },
                    gap: 2,
                    alignItems: "center",
                    py: 1.25,
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={item.applicable}
                        onChange={(e) =>
                          setUtilities((rows) =>
                            rows.map((row, i) => (i === index ? { ...row, applicable: e.target.checked } : row))
                          )
                        }
                      />
                    }
                    label={<strong style={{ fontSize: 13 }}>{item.utility} Deposit</strong>}
                  />
                  <TextField
                    type="number"
                    size="small"
                    label="Rate / sqft (KES)"
                    value={item.rate_per_unit}
                    disabled={!item.applicable}
                    onChange={(e) =>
                      setUtilities((rows) =>
                        rows.map((row, i) => (i === index ? { ...row, rate_per_unit: Number(e.target.value) } : row))
                      )
                    }
                  />
                  <TextField
                    size="small"
                    label="Deposit Amount"
                    value={money(item.applicable ? item.rate_per_unit * area : 0)}
                    disabled
                  />
                </Box>
              ))}
            </Paper>

            {/* CHARGES BREAKDOWN TABLE */}
            <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, background: "var(--surface)", overflowX: "auto" }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.5 }}>
                Application Line Items Summary
              </Typography>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "var(--surface-sunken)", borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                    <th style={{ padding: "8px 12px" }}>Code</th>
                    <th style={{ padding: "8px 12px" }}>Charge Item</th>
                    <th style={{ padding: "8px 12px" }}>Letting Fee</th>
                    <th style={{ padding: "8px 12px" }}>Renewal Fee</th>
                    <th style={{ padding: "8px 12px" }}>Area (SqFt)</th>
                    <th style={{ padding: "8px 12px" }}>Rate / SqFt</th>
                    <th style={{ padding: "8px 12px", textAlign: "right" }}>Monthly Base</th>
                  </tr>
                </thead>
                <tbody>
                  {charges.map((charge, idx) => (
                    <tr key={charge.code} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "10px 12px", fontWeight: 700 }}>{charge.code}</td>
                      <td style={{ padding: "10px 12px" }}>{charge.name}</td>
                      <td style={{ padding: "10px 12px" }}>
                        {idx === 0 ? (
                          <Checkbox size="small" checked={lettingFee} onChange={(e) => setLettingFee(e.target.checked)} />
                        ) : (
                          "—"
                        )}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        {idx === 0 ? (
                          <Checkbox size="small" checked={renewalFee} onChange={(e) => setRenewalFee(e.target.checked)} />
                        ) : (
                          "—"
                        )}
                      </td>
                      <td style={{ padding: "10px 12px" }}>{area.toLocaleString()}</td>
                      <td style={{ padding: "10px 12px" }}>{charge.rate.toFixed(2)}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 800 }}>{money(charge.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Paper>
          </Stack>

          {/* RIGHT COLUMN: STICKY MOVE-IN FINANCIAL SUMMARY */}
          <Stack id="tenant-review" spacing={2.5} sx={{ alignSelf: "start", position: { lg: "sticky" }, top: { lg: 120 } }}>
            {/* LIVE FINANCIAL BREAKDOWN CARD */}
            <Paper
              variant="outlined"
              sx={{
                p: 3,
                borderRadius: 3,
                background: "var(--surface)",
                borderTop: "4px solid #3b82f6",
                boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
              }}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 900, mb: 0.5, color: "var(--text)" }}>
                💰 Live Financial Computation
              </Typography>
              <Typography variant="caption" sx={{ color: "var(--text-secondary)", display: "block", mb: 2 }}>
                Calculated automatically from unit sqft area, tax rates, and security deposit terms.
              </Typography>

              <Stack sx={{ gap: 1.25 }}>
                {summary.map(([lbl, val], index) => {
                  const isTotal = index === summary.length - 1;
                  const isSubtotal = index === 2 || index === 4;
                  return (
                    <Box
                      key={lbl}
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        py: isTotal ? 1.5 : 0.75,
                        px: isTotal ? 1.5 : 0,
                        borderRadius: isTotal ? 2 : 0,
                        background: isTotal ? "rgba(59, 130, 246, 0.1)" : "transparent",
                        borderTop: isTotal ? "1.5px solid rgba(59, 130, 246, 0.3)" : "none",
                        borderBottom: isSubtotal ? "1px solid var(--border)" : "none",
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{
                          color: isTotal ? "#1d4ed8" : "var(--text-secondary)",
                          fontWeight: isTotal ? 800 : isSubtotal ? 700 : 500,
                          fontSize: isTotal ? 14 : 12,
                        }}
                      >
                        {lbl}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: isTotal ? 900 : isSubtotal ? 800 : 600,
                          fontSize: isTotal ? 16 : 13,
                          color: isTotal ? "#1d4ed8" : "var(--text)",
                        }}
                      >
                        {money(val)}
                      </Typography>
                    </Box>
                  );
                })}
              </Stack>
            </Paper>

            {/* RECORD METADATA */}
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, background: "var(--surface)" }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
                Application Metadata
              </Typography>
              <Stack spacing={0.75} sx={{ fontSize: 12 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Property:</span>
                  <strong>{activeProperty?.name ?? "—"}</strong>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Document Date:</span>
                  <strong>{new Date().toLocaleDateString("en-KE")}</strong>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Created By:</span>
                  <strong>{session?.user.firstName || session?.user.username}</strong>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Draft Status:</span>
                  <span style={{ color: "#16a34a", fontWeight: 700 }}>● Auto-Saved</span>
                </Box>
              </Stack>
            </Paper>

            {/* ACTION BUTTONS */}
            <Button
              size="large"
              variant="contained"
              startIcon={<SaveRounded />}
              disabled={saving}
              onClick={submit}
              sx={{
                bgcolor: "#e23b3b",
                "&:hover": { bgcolor: "#cc2b2b" },
                fontWeight: 800,
                py: 1.5,
                borderRadius: 2,
                boxShadow: "0 4px 14px rgba(226, 59, 59, 0.35)",
              }}
            >
              {saving ? "Saving Application…" : "Save Tenant Application"}
            </Button>
            <Button variant="outlined" onClick={onClose} sx={{ py: 1, borderRadius: 2 }}>
              Cancel & Return
            </Button>
          </Stack>
        </Box>
      </Box>
    </Dialog>
  );
}
