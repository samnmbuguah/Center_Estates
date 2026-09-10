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

type UnitChargeRule = { id: string; billing_item_name: string; billing_item_code: string; calculation: string; amount: string | number; rate: string | number; frequency: string };
type Unit = { id: string; code: string; floor?: string; unit_type?: string; area?: string | number; status?: string; charge_rules?: UnitChargeRule[] };
type PropertyDetails = { address?: string; city?: string; country?: string; metadata?: Record<string, unknown> };
type ParkingSpace = { id: string; code: string; floor_or_zone?: string; space_type?: string; status?: string };

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
  billing_day: "1",
  escalation_percent: "0",
  escalation_interval_months: "12",
  parking_space: "",
  parking_new_code: "",
  parking_monthly_fee: "0",
  opening_balance_amount: "0",
  opening_balance_as_of: "",
  opening_balance_previous_agent: "",
  opening_balance_reference: "",
  opening_balance_notes: "",
};

const applicationSections = ["tenant-general", "tenant-lease", "tenant-review"] as const;

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
  const [parkingSpaces, setParkingSpaces] = useState<ParkingSpace[]>([]);
  const [propertyDetails, setPropertyDetails] = useState<PropertyDetails | null>(null);
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
  }[]>([]);
  const draftRestored = formRestored;
  const clearDraft = () => {
    clearForm();
    clearLettingFee();
    clearRenewalFee();
    setExtraUnits([]);
  };

  useEffect(() => {
    if (!open || !organizationId || !activeProperty?.id) return;
    Promise.all([
      apiFetch("/property/units/?status=available", {}, organizationId).then(async (response) => (response.ok ? response.json() : [])),
      apiFetch(`/property/parking-spaces/?property=${activeProperty.id}&status=available`, {}, organizationId).then(async (response) => (response.ok ? response.json() : [])),
      apiFetch(`/property/properties/${activeProperty.id}/`, {}, organizationId).then(async (response) => (response.ok ? response.json() : null)),
    ]).then(([unitData, parkingData, propertyData]) => {
      setUnits(
        (Array.isArray(unitData) ? unitData : unitData.results ?? []).map((row: Record<string, unknown>) => ({
          id: String(row.id),
          code: String(row.code),
          floor: String(row.floor ?? ""),
          unit_type: String(row.unit_type ?? ""),
          area: row.area as string | number,
          status: String(row.status ?? ""),
          charge_rules: Array.isArray(row.charge_rules) ? row.charge_rules as UnitChargeRule[] : [],
        }))
      );
      setParkingSpaces((Array.isArray(parkingData) ? parkingData : parkingData.results ?? []).map((row: Record<string, unknown>) => ({
        id: String(row.id), code: String(row.code), floor_or_zone: String(row.floor_or_zone ?? ""),
        space_type: String(row.space_type ?? "standard"), status: String(row.status ?? "available"),
      })));
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
        billing_day: current.billing_day !== "1" ? current.billing_day : String(defaults.billing_day ?? 1),
      }));
    });
  }, [open, organizationId, activeProperty?.id, setForm]);

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

  const chargeAmount = (unit: Unit | undefined, code: string) => {
    const rule = unit?.charge_rules?.find((row) => row.billing_item_code.toLowerCase() === code.toLowerCase());
    if (!rule) return 0;
    return rule.calculation === "area_rate" ? Number(unit?.area || 0) * Number(rule.rate || 0) : Number(rule.amount || 0);
  };
  const depositAmount = (unit: Unit | undefined) => (unit?.charge_rules ?? [])
    .filter((rule) => rule.billing_item_code.toUpperCase().includes("DEPOSIT"))
    .reduce((sum, rule) => sum + (rule.calculation === "area_rate" ? Number(unit?.area || 0) * Number(rule.rate || 0) : Number(rule.amount || 0)), 0);
  const serviceCharge = chargeAmount(selectedUnit, "SERVICE_CHARGE") || chargeAmount(selectedUnit, "SC");
  const subtotal = rent + serviceCharge;
  const parkingFee = (form.parking_space || form.parking_new_code.trim()) ? Number(form.parking_monthly_fee || 0) : 0;
  const openingBalance = Number(form.opening_balance_amount || 0);
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
      const eSc = chargeAmount(u, "SERVICE_CHARGE") || chargeAmount(u, "SC");
      const eSub = eRent + eSc;
      const eVat = (eSub * Number(eu.vat_rate || 0)) / 100;
      const eDep = depositAmount(u);
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
  const totalDeposit = depositAmount(selectedUnit) + extraTotals.deposit;

  const total = totalMonthlySubtotal + totalVat + totalDeposit;
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
    ],
    [totalOccupiedArea, totalMonthlyRent, totalMonthlySc, lettingFee, renewalFee]
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
                  billing_day: Number(form.billing_day || 1),
                };
              }),
            parking_assignments: (form.parking_space || form.parking_new_code.trim()) ? [{
              parking_space: form.parking_space,
              new_code: form.parking_new_code,
              monthly_fee: parkingFee,
            }] : [],
            opening_balance: {
              amount: openingBalance,
              as_of: form.opening_balance_as_of || form.starts_on || new Date().toISOString().slice(0, 10),
              previous_agent: form.opening_balance_previous_agent,
              reference: form.opening_balance_reference,
              notes: form.opening_balance_notes,
            },
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
    ["Monthly parking fee", parkingFee],
    ["Total monthly recurring (excl. VAT)", subtotal],
    ["VAT amount (16%)", vat],
    ["Total monthly amount (inc. VAT)", subtotal + vat],
    ["Deposits inherited from unit", depositAmount(selectedUnit)],
    ["Opening arrears brought forward", openingBalance],
    ["Total initial move-in payable", total + parkingFee + openingBalance],
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
              {activeProperty?.name ?? "Select Property"} · Legal tenant profile, lease terms and unit billing inheritance
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
                bgcolor: "var(--color-brand-red)",
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
          <Tab label="3. Review & Confirm" />
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
                Configure the signed rent terms. Deposits and utilities are inherited from the selected unit’s billing schedule.
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

              <Divider sx={{ my: 3 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 0.5, color: "var(--text)" }}>
                Parking allocation and recurring fee
              </Typography>
              <Typography variant="body2" sx={{ color: "var(--text-secondary)", mb: 2 }}>
                Reserve an available bay for this tenancy. Its fee is invoiced separately from rent for clear reconciliation.
              </Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "2fr 1fr 1fr" }, gap: 2 }}>
                {input("Parking bay (optional)", "parking_space", {
                  select: true,
                  children: [
                    <MenuItem key="none" value="">No parking allocation</MenuItem>,
                    ...parkingSpaces.map((space) => <MenuItem key={space.id} value={space.id}>{space.code} · {space.floor_or_zone || "Unzoned"} · {space.space_type}</MenuItem>),
                  ],
                })}
                {input("Or register new bay code", "parking_new_code", {
                  disabled: Boolean(form.parking_space), placeholder: "e.g. B2-014",
                  helperText: parkingSpaces.length ? "Use only when the bay is not listed" : "No bays listed; enter the physical bay code",
                })}
                {input("Monthly parking fee (KES)", "parking_monthly_fee", {
                  type: "number", disabled: !form.parking_space && !form.parking_new_code.trim(),
                  inputProps: { min: 0, step: 0.01 }, helperText: "Billed as a separate parking invoice",
                })}
              </Box>

              <Divider sx={{ my: 3 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 0.5, color: "var(--text)" }}>
                Existing arrears / opening balance
              </Typography>
              <Alert severity="info" sx={{ mb: 2 }}>
                Use this only for verified debt inherited from a previous agent or system. It remains separate from current rent income and preserves its source reference.
              </Alert>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" }, gap: 2 }}>
                {input("Opening arrears amount (KES)", "opening_balance_amount", { type: "number", inputProps: { min: 0, step: 0.01 } })}
                {input("Balance as at", "opening_balance_as_of", { type: "date", slotProps: { inputLabel: { shrink: true } }, disabled: !openingBalance })}
                {input("Previous managing agent", "opening_balance_previous_agent", { disabled: !openingBalance })}
                {input("Source statement / reference", "opening_balance_reference", { disabled: !openingBalance })}
                {input("Opening balance notes", "opening_balance_notes", { disabled: !openingBalance, multiline: true, minRows: 2, sx: { gridColumn: { md: "span 2" } } })}
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
                        </Box>
                      </Paper>
                    );
                  })}
                </Stack>
              )}
            </Paper>

            {/* UNIT CHARGES ARE CONTROLLED ON THE UNIT, NOT RE-ENTERED PER TENANT */}
            <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, background: "var(--surface)" }}>
              <Typography variant="overline" sx={{ fontWeight: 900, color: "var(--primary)" }}>
                INHERITED UNIT BILLING SCHEDULE
              </Typography>
              <Typography variant="body2" sx={{ color: "var(--text-secondary)", mb: 2 }}>
                Water, electricity, service charge and other recurring items are configured once on the unit. They will be copied to this lease and invoiced separately, while the tenant can still pay all outstanding invoices together.
              </Typography>
              {!selectedUnit ? (
                <Alert severity="info">Select a unit to review its recurring billing rules.</Alert>
              ) : selectedUnit.charge_rules?.length ? (
                <Stack spacing={1}>
                  {selectedUnit.charge_rules.map((rule) => (
                    <Box key={rule.id} sx={{ display: "flex", justifyContent: "space-between", gap: 2, py: 1, borderBottom: "1px solid var(--border)" }}>
                      <Box><Typography variant="body2" sx={{ fontWeight: 800 }}>{rule.billing_item_name}</Typography><Typography variant="caption" color="text.secondary">{rule.frequency.replaceAll("_", " ")} · {rule.calculation.replaceAll("_", " ")}</Typography></Box>
                      <Typography variant="body2" sx={{ fontWeight: 800 }}>{rule.calculation === "metered" ? "From approved meter reading" : money(chargeAmount(selectedUnit, rule.billing_item_code))}</Typography>
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Alert severity="warning">This unit has no recurring charge rules. Configure its utilities and service charges before approving the tenancy.</Alert>
              )}
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
                borderTop: "4px solid var(--color-blue)",
                boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
              }}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 900, mb: 0.5, color: "var(--text)" }}>
                💰 Live Financial Computation
              </Typography>
              <Typography variant="caption" sx={{ color: "var(--text-secondary)", display: "block", mb: 2 }}>
                Calculated automatically from unit area, tax rates and the selected unit billing schedule.
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
                          color: isTotal ? "var(--color-info-strong)" : "var(--text-secondary)",
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
                          color: isTotal ? "var(--color-info-strong)" : "var(--text)",
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
                  <span style={{ color: "var(--color-success)", fontWeight: 700 }}>● Auto-Saved</span>
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
                bgcolor: "var(--color-brand-red)",
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
