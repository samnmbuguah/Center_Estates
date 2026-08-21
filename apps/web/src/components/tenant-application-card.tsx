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
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";

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
  rent_type: "fixed",
  fixed_monthly_rent: "",
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
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("md"));
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
  const [extraUnits, setExtraUnits] = useState<{
    id: string;
    unit: string;
    rent_type: string;
    fixed_monthly_rent: string;
    rent_rate_per_sqft: string;
    service_charge_rate_per_sqft: string;
    term_months: string;
    starts_on: string;
    vat_rate: string;
    security_deposit: string;
  }[]>([]);
  const draftRestored = formRestored || utilitiesRestored;
  const clearDraft = () => {
    clearForm();
    clearUtilities();
    clearLettingFee();
    clearRenewalFee();
    setExtraUnits([]);
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
  const rentType = form.rent_type || (form.rent_rate_per_sqft ? "rate_per_sqft" : "fixed");

  let rent = 0;
  let computedRentRate = 0;
  if (rentType === "fixed") {
    rent = Number(form.fixed_monthly_rent || 0);
    computedRentRate = area > 0 ? rent / area : 0;
  } else if (rentType === "rate_per_sqft") {
    computedRentRate = Number(form.rent_rate_per_sqft || 0);
    rent = area * computedRentRate;
  } else {
    // prospect / flexible
    rent = Number(form.fixed_monthly_rent || 0) || (area * Number(form.rent_rate_per_sqft || 0));
    computedRentRate = area > 0 ? rent / area : Number(form.rent_rate_per_sqft || 0);
  }

  const serviceCharge = area * Number(form.service_charge_rate_per_sqft || 0);
  const subtotal = rent + serviceCharge;
  const vat = (subtotal * Number(form.vat_rate || 0)) / 100;

  // Compute extra units totals
  const extraTotals = extraUnits.reduce(
    (acc, eu) => {
      const u = units.find((x) => x.id === eu.unit);
      const eArea = Number(u?.area ?? 0);
      let eRent = 0;
      if (eu.rent_type === "fixed") {
        eRent = Number(eu.fixed_monthly_rent || 0);
      } else {
        eRent = eArea * Number(eu.rent_rate_per_sqft || 0);
      }
      const eSc = eArea * Number(eu.service_charge_rate_per_sqft || 0);
      const eSub = eRent + eSc;
      const eVat = (eSub * Number(eu.vat_rate || 0)) / 100;
      const eDep = Number(eu.security_deposit || 0);
      return {
        area: acc.area + eArea,
        rent: acc.rent + eRent,
        serviceCharge: acc.serviceCharge + eSc,
        subtotal: acc.subtotal + eSub,
        vat: acc.vat + eVat,
        deposit: acc.deposit + eDep,
      };
    },
    { area: 0, rent: 0, serviceCharge: 0, subtotal: 0, vat: 0, deposit: 0 }
  );

  const totalOccupiedArea = area + extraTotals.area;
  const totalMonthlyRent = rent + extraTotals.rent;
  const totalMonthlySc = serviceCharge + extraTotals.serviceCharge;
  const totalMonthlySubtotal = subtotal + extraTotals.subtotal;
  const totalVat = vat + extraTotals.vat;
  const totalDeposit = Number(form.security_deposit || 0) + extraTotals.deposit;

  const utilityDeposit = utilities.reduce((sum, item) => sum + (item.applicable ? item.rate_per_unit * totalOccupiedArea : 0), 0);
  const total = totalMonthlySubtotal + totalVat + totalDeposit + utilityDeposit;
  const expiryDate = addMonths(form.starts_on, Number(form.term_months || 12));
  const charges = useMemo(
    () => [
      {
        code: "RENT",
        name: "Rent",
        letting_fee: lettingFee,
        renewal_fee: renewalFee,
        account_type: "G/L Account",
        account_name: "Landlord Dues",
        area: totalOccupiedArea,
        rate: totalOccupiedArea > 0 ? totalMonthlyRent / totalOccupiedArea : 0,
        amount: totalMonthlyRent,
      },
      {
        code: "SERVICE CHARGE",
        name: "Service Charge",
        letting_fee: false,
        renewal_fee: false,
        account_type: "G/L Account",
        account_name: "Landlord Dues",
        area: totalOccupiedArea,
        rate: totalOccupiedArea > 0 ? totalMonthlySc / totalOccupiedArea : 0,
        amount: totalMonthlySc,
      },
      {
        code: "UTILITIES",
        name: "Utility Charge",
        letting_fee: false,
        renewal_fee: false,
        account_type: "G/L Account",
        account_name: "Landlord Dues",
        area: totalOccupiedArea,
        rate: 0,
        amount: utilityDeposit,
      },
    ],
    [totalOccupiedArea, totalMonthlyRent, totalMonthlySc, lettingFee, renewalFee, utilityDeposit]
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
    if (!form.name.trim()) {
      setError("Enter the tenant or applicant name before saving.");
      return;
    }
    if (!form.unit) {
      setError("Select the assigned or prospective unit.");
      return;
    }
    if (rentType !== "prospect" && rent <= 0) {
      setError("Specify either a fixed monthly rent or rate per sq.ft before creating an active lease.");
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
              status: "prospect",
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
              term_months: Number(form.term_months || 12),
              starts_on: form.starts_on || new Date().toISOString().slice(0, 10),
              area,
              rent_type: rentType,
              monthly_rent: rent,
              rent_rate_per_sqft: computedRentRate,
              service_charge_rate_per_sqft: Number(form.service_charge_rate_per_sqft || 0),
              vat_rate: Number(form.vat_rate || 0),
              security_deposit: Number(form.security_deposit || 0),
              billing_day: Number(form.billing_day || 1),
              escalation_percent: Number(form.escalation_percent || 0),
              escalation_interval_months: Number(form.escalation_interval_months || 12),
            },
            additional_leases: extraUnits
              .filter((eu) => eu.unit)
              .map((eu) => {
                const u = units.find((x) => x.id === eu.unit);
                const eArea = Number(u?.area ?? 0);
                let eRent = 0;
                let eRate = 0;
                if (eu.rent_type === "fixed") {
                  eRent = Number(eu.fixed_monthly_rent || 0);
                  eRate = eArea > 0 ? eRent / eArea : 0;
                } else {
                  eRate = Number(eu.rent_rate_per_sqft || 0);
                  eRent = eArea * eRate;
                }
                return {
                  unit: eu.unit,
                  starts_on: eu.starts_on || form.starts_on || new Date().toISOString().slice(0, 10),
                  term_months: Number(eu.term_months || form.term_months || 12),
                  rent_type: eu.rent_type,
                  monthly_rent: eRent,
                  rent_rate_per_sqft: eRate,
                  service_charge_rate_per_sqft: Number(eu.service_charge_rate_per_sqft || form.service_charge_rate_per_sqft || 0),
                  vat_rate: Number(eu.vat_rate || form.vat_rate || 0),
                  security_deposit: Number(eu.security_deposit || 0),
                  billing_day: Number(form.billing_day || 1),
                };
              }),
            utilities: utilities.map((item) => ({ ...item, deposit_amount: item.applicable ? item.rate_per_unit * totalOccupiedArea : 0 })),
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
      fullScreen={fullScreen}
      open={open}
      onClose={onClose}
      slots={fullScreen ? { transition: Transition } : undefined}
      maxWidth="xl"
      fullWidth
      sx={{
        "& .MuiDialog-paper": {
          bgcolor: "var(--bg-app)",
          color: "var(--text)",
          ...(fullScreen ? {} : { borderRadius: 3, maxHeight: "95vh" }),
        },
      }}
    >
      {/* 1. STICKY TOP APP BAR / HEADER */}
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: "var(--surface)",
          borderBottom: "1px solid var(--border)",
          color: "var(--text)",
        }}
      >
        <Toolbar sx={{ gap: 2, minHeight: { xs: 64, sm: 72 }, px: { xs: 2, sm: 3 } }}>
          <IconButton onClick={onClose} aria-label="Close tenant application" sx={{ color: "var(--text)" }}>
            <CloseRounded />
          </IconButton>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <span style={{ fontSize: 18 }}>🏢</span>
              <Typography variant="h6" sx={{ fontWeight: 900, color: "var(--text)", fontSize: { xs: "1rem", sm: "1.25rem" } }}>
                Tenant Application & Onboarding Card
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ color: "var(--text-secondary)", display: "block" }}>
              {activeProperty?.name ?? "Select Property"} · Legal tenant profile, lease contract terms, utility deposits & auto-drafting
            </Typography>
          </Box>
          <Stack direction="row" sx={{ gap: 1.5, alignItems: "center" }}>
            <Button
              variant="outlined"
              onClick={onClose}
              sx={{ color: "var(--text-secondary)", borderColor: "var(--border)", "&:hover": { borderColor: "var(--text)" } }}
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
            bgcolor: "var(--surface-sunken)",
            borderTop: "1px solid var(--border)",
            "& .MuiTab-root": { color: "var(--text-secondary)", fontWeight: 700, fontSize: 13 },
            "& .Mui-selected": { color: "var(--primary) !important" },
            "& .MuiTabs-indicator": { bgcolor: "var(--primary)" },
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
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" }, gap: 2 }}>
                {input("Tenant / Company Legal Name", "name", { required: true })}
                {input("Tenant Classification", "tenant_type", {
                  select: true,
                  children: [
                    <MenuItem key="individual" value="individual">
                      Individual
                    </MenuItem>,
                    <MenuItem key="company" value="company">
                      Registered Company
                    </MenuItem>,
                    <MenuItem key="government" value="government">
                      Government Agency
                    </MenuItem>,
                  ],
                })}
                {input("Postal / Street Address Line 1", "address_1")}
                {input("Suite / Floor / Address Line 2", "address_2")}
                {input("City / Town", "city")}
                {input("Primary Phone Number", "phone", { placeholder: "+254700000000" })}
                {input("Billing Email Address", "email", { type: "email", placeholder: "billing@company.com" })}
                {input("KRA PIN / Tax Identifier", "tax_id", { placeholder: "P051234567X" })}
                {input("Registration / Certificate Number", "registration_number", { placeholder: "CPR/2024/001" })}
                {input("Assigned Unit", "unit", {
                  select: true,
                  required: true,
                  children: units.map((u) => (
                    <MenuItem key={u.id} value={u.id}>
                      Unit {u.code} ({u.unit_type ?? "Commercial"} · {u.area ?? "0"} sqft · Floor {u.floor ?? "1"})
                    </MenuItem>
                  )),
                })}
                {input("Authorized Contact Person", "contact_name")}
                {input("Contact Person Phone", "contact_phone", { placeholder: "+254700000001" })}
                {input("Contact Person Email", "contact_email", {
                  type: "email",
                  placeholder: "contact@company.com",
                  sx: { gridColumn: { md: "span 2" } },
                })}
              </Box>
            </Paper>

            {/* LEASE TERMS & CHARGES */}
            <Paper id="tenant-lease" variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, background: "var(--surface)" }}>
              <Typography variant="overline" sx={{ fontWeight: 900, color: "var(--primary)" }}>
                SECTION 2 · LEASE TERMS & FINANCIAL RATES
              </Typography>
              <Typography variant="body2" sx={{ color: "var(--text-secondary)", mb: 2.5 }}>
                Configure rent structure (Fixed Monthly, Rate by Area, or Prospective Negotiation), service charges, and deposit requirements.
              </Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2 }}>
                {input("Rent Pricing Structure", "rent_type", {
                  select: true,
                  children: [
                    <MenuItem key="fixed" value="fixed">Fixed Monthly Rent (Flat KES / mo)</MenuItem>,
                    <MenuItem key="rate_per_sqft" value="rate_per_sqft">Rate by Area (KES / Sq.Ft / mo)</MenuItem>,
                    <MenuItem key="prospect" value="prospect">Prospective Tenant (TBD / Negotiating)</MenuItem>,
                  ],
                })}
                {form.rent_type === "rate_per_sqft" ? (
                  input("Rent Rate / Sq.Ft (KES)", "rent_rate_per_sqft", {
                    type: "number",
                    required: true,
                    inputProps: { min: 0, step: 0.01 },
                    placeholder: "e.g. 120.00",
                    helperText: area > 0 && Number(form.rent_rate_per_sqft) > 0 ? `Total: ${money(area * Number(form.rent_rate_per_sqft))}/mo` : "Enter rate per sq.ft",
                  })
                ) : (
                  input("Fixed Monthly Rent (KES)", "fixed_monthly_rent", {
                    type: "number",
                    required: form.rent_type === "fixed",
                    inputProps: { min: 0, step: 0.01 },
                    placeholder: "e.g. 65000.00",
                    helperText: area > 0 && Number(form.fixed_monthly_rent) > 0 ? `Equivalent to ${money(Number(form.fixed_monthly_rent) / area)}/sq.ft` : form.rent_type === "prospect" ? "Optional for prospects" : "Direct monthly amount",
                  })
                )}
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
                  required: form.rent_type !== "prospect",
                  slotProps: { inputLabel: { shrink: true } },
                  helperText: form.rent_type === "prospect" ? "Optional for prospective applicants" : "Lease start date",
                })}
                <TextField label="Calculated Expiry Date" value={expiryDate || "Select start date"} disabled />
                {input("Service Charge Rate / Sq.Ft (KES)", "service_charge_rate_per_sqft", {
                  type: "number",
                  inputProps: { min: 0, step: 0.01 },
                  placeholder: "e.g. 35.00",
                  helperText: area > 0 && Number(form.service_charge_rate_per_sqft) > 0 ? `Total: ${money(area * Number(form.service_charge_rate_per_sqft))}/mo` : "Optional service rate",
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

              {/* MULTI-UNIT / MULTI-FLOOR LEASE EXPANSION */}
              <Divider sx={{ my: 3 }} />
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, flexWrap: "wrap", gap: 1 }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "var(--text)" }}>
                    🏢 Additional Units / Multi-Floor Tenancy ({extraUnits.length})
                  </Typography>
                  <Typography variant="caption" sx={{ color: "var(--text-secondary)" }}>
                    Add more units or floors occupied by this tenant with independent lease terms.
                  </Typography>
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    const assignedIds = new Set([form.unit, ...extraUnits.map((e) => e.unit)]);
                    const nextAvailable = units.find((u) => !assignedIds.has(u.id));
                    setExtraUnits((prev) => [
                      ...prev,
                      {
                        id: String(Date.now()),
                        unit: nextAvailable ? nextAvailable.id : "",
                        rent_type: form.rent_type || "fixed",
                        fixed_monthly_rent: "",
                        rent_rate_per_sqft: form.rent_rate_per_sqft || "",
                        service_charge_rate_per_sqft: form.service_charge_rate_per_sqft || "0",
                        term_months: form.term_months || "12",
                        starts_on: form.starts_on || "",
                        vat_rate: form.vat_rate || "16",
                        security_deposit: "0",
                      },
                    ]);
                  }}
                  sx={{ textTransform: "none", fontWeight: 700, borderColor: "var(--border)" }}
                >
                  + Add Additional Unit / Floor
                </Button>
              </Box>

              {extraUnits.length > 0 && (
                <Stack spacing={2} sx={{ mb: 2 }}>
                  {extraUnits.map((eu, idx) => {
                    const u = units.find((x) => x.id === eu.unit);
                    const eArea = Number(u?.area ?? 0);
                    return (
                      <Paper
                        key={eu.id}
                        variant="outlined"
                        sx={{ p: 2, borderRadius: 2, bgcolor: "var(--surface-2)", border: "1px solid var(--border)" }}
                      >
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
                          <Typography variant="body2" sx={{ fontWeight: 800 }}>
                            Additional Unit #{idx + 1} {u ? `— ${u.code} (Floor ${u.floor || "1"} · ${eArea} sqft)` : ""}
                          </Typography>
                          <Button
                            size="small"
                            color="error"
                            onClick={() => setExtraUnits((prev) => prev.filter((item) => item.id !== eu.id))}
                            sx={{ textTransform: "none", fontWeight: 700, fontSize: 11 }}
                          >
                            Remove Unit
                          </Button>
                        </Box>
                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 1.5 }}>
                          <TextField
                            select
                            size="small"
                            label="Select Unit"
                            value={eu.unit}
                            onChange={(e) =>
                              setExtraUnits((prev) =>
                                prev.map((item) => (item.id === eu.id ? { ...item, unit: e.target.value } : item))
                              )
                            }
                          >
                            {units.map((unitOpt) => (
                              <MenuItem key={unitOpt.id} value={unitOpt.id}>
                                Unit {unitOpt.code} (Floor {unitOpt.floor || "1"} · {unitOpt.area || "0"} sqft)
                              </MenuItem>
                            ))}
                          </TextField>
                          <TextField
                            type="number"
                            size="small"
                            label="Monthly Rent (KES)"
                            value={eu.fixed_monthly_rent}
                            placeholder="e.g. 50000"
                            onChange={(e) =>
                              setExtraUnits((prev) =>
                                prev.map((item) => (item.id === eu.id ? { ...item, fixed_monthly_rent: e.target.value } : item))
                              )
                            }
                          />
                          <TextField
                            type="number"
                            size="small"
                            label="Service Charge Rate / sqft"
                            value={eu.service_charge_rate_per_sqft}
                            onChange={(e) =>
                              setExtraUnits((prev) =>
                                prev.map((item) =>
                                  item.id === eu.id ? { ...item, service_charge_rate_per_sqft: e.target.value } : item
                                )
                              )
                            }
                          />
                        </Box>
                      </Paper>
                    );
                  })}
                </Stack>
              )}
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
