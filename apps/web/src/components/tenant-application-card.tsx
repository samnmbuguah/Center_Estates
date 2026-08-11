"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert, AppBar, Box, Button, Checkbox, Divider, FormControlLabel,
  IconButton, MenuItem, Paper, Stack, Tab, Tabs, TextField, Toolbar, Typography,
} from "@mui/material";
import CloseRounded from "@mui/icons-material/CloseRounded";
import SaveRounded from "@mui/icons-material/SaveRounded";
import { useAuth } from "@/components/auth-provider";
import { apiFetch, csrfFromCookie } from "@/lib/api";
import { useFormDraft } from "@/lib/form-drafts";
import { usePropertyContext } from "@/lib/property-context";
import { useToast } from "@/components/monitoring/hooks/useToast";

type Unit = { id: string; code: string; floor?: string; unit_type?: string; area?: string | number; status?: string };
type Utility = { utility: string; applicable: boolean; rate_per_unit: number };
type PropertyDetails = { address?: string; city?: string; country?: string; metadata?: Record<string, unknown> };

const initialForm = {
  name: "", tenant_type: "company", address_1: "", address_2: "", city: "",
  phone: "", email: "", tax_id: "", registration_number: "", contact_name: "",
  contact_phone: "", contact_email: "", unit: "", term_months: "12", starts_on: "",
  rent_rate_per_sqft: "", service_charge_rate_per_sqft: "0", vat_rate: "16",
  security_deposit: "0", billing_day: "1", escalation_percent: "0", escalation_interval_months: "12",
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

export function TenantApplicationCard({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { session } = useAuth();
  const { activeProperty } = usePropertyContext();
  const { toast } = useToast();
  const organizationId = session?.activeOrganizationId ?? null;
  const draftScope = `${organizationId || "unknown"}:${session?.user.id || "unknown"}:${activeProperty?.id || "no-property"}`;
  const [form, setForm, clearForm, formRestored] = useFormDraft("tenant-application:form", initialForm, draftScope);
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
  const clearDraft = () => { clearForm(); clearUtilities(); clearLettingFee(); clearRenewalFee(); };

  useEffect(() => {
    if (!open || !organizationId || !activeProperty?.id) return;
    Promise.all([
      apiFetch("/property/units/?status=available", {}, organizationId).then(async (response) => response.ok ? response.json() : []),
      apiFetch(`/property/properties/${activeProperty.id}/`, {}, organizationId).then(async (response) => response.ok ? response.json() : null),
    ]).then(([unitData, propertyData]) => {
      setUnits((Array.isArray(unitData) ? unitData : unitData.results ?? []).map((row: Record<string, unknown>) => ({
        id: String(row.id), code: String(row.code), floor: String(row.floor ?? ""),
        unit_type: String(row.unit_type ?? ""), area: row.area as string | number, status: String(row.status ?? ""),
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
        service_charge_rate_per_sqft: current.service_charge_rate_per_sqft !== "0" ? current.service_charge_rate_per_sqft : String(defaults.service_charge_rate_per_sqft ?? 0),
        security_deposit: current.security_deposit !== "0" ? current.security_deposit : String(defaults.security_deposit ?? 0),
        billing_day: current.billing_day !== "1" ? current.billing_day : String(defaults.billing_day ?? 1),
      }));
      const configuredUtilities = Array.isArray(metadata.utilities) ? metadata.utilities as Array<Record<string, unknown>> : [];
      setUtilities(["Electricity", "Water", "Other"].map((utility) => {
        const configured = configuredUtilities.find((row) => String(row.type ?? "").toLowerCase() === utility.toLowerCase());
        return { utility, applicable: Boolean(configured), rate_per_unit: Number(configured?.security_deposit_rate ?? defaults[`${utility.toLowerCase()}_deposit_rate`] ?? 0) };
      }));
    });
  }, [open, organizationId, activeProperty?.id, setForm, setUtilities]);

  const selectedUnit = units.find((unit) => unit.id === form.unit);
  const area = Number(selectedUnit?.area ?? 0);
  const rent = area * Number(form.rent_rate_per_sqft || 0);
  const serviceCharge = area * Number(form.service_charge_rate_per_sqft || 0);
  const subtotal = rent + serviceCharge;
  const vat = subtotal * Number(form.vat_rate || 0) / 100;
  const utilityDeposit = utilities.reduce((sum, item) => sum + (item.applicable ? item.rate_per_unit * area : 0), 0);
  const total = subtotal + vat + Number(form.security_deposit || 0) + utilityDeposit;
  const expiryDate = addMonths(form.starts_on, Number(form.term_months));
  const charges = useMemo(() => [
    { code: "RENT", name: "Rent", letting_fee: lettingFee, renewal_fee: renewalFee, account_type: "G/L Account", account_name: "Landlord Dues", area, rate: Number(form.rent_rate_per_sqft || 0), amount: rent },
    { code: "SERVICE CHARGE", name: "Service Charge", letting_fee: false, renewal_fee: false, account_type: "G/L Account", account_name: "Landlord Dues", area, rate: Number(form.service_charge_rate_per_sqft || 0), amount: serviceCharge },
    { code: "UTILITIES", name: "Utility Charge", letting_fee: false, renewal_fee: false, account_type: "G/L Account", account_name: "Landlord Dues", area, rate: 0, amount: utilityDeposit },
  ], [area, form.rent_rate_per_sqft, form.service_charge_rate_per_sqft, lettingFee, renewalFee, rent, serviceCharge, utilityDeposit]);

  function update(name: keyof typeof initialForm, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function navigateToSection(value: number) {
    setTab(value);
    requestAnimationFrame(() => document.getElementById(applicationSections[value])?.scrollIntoView({ behavior: "smooth", block: "start" }));
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
      const response = await apiFetch("/property/tenants/onboard/", {
        method: "POST", headers: { "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify({
          tenant: {
            name: form.name, tenant_type: form.tenant_type, address_1: form.address_1,
            address_2: form.address_2, city: form.city, phone: form.phone, email: form.email,
            tax_id: form.tax_id, registration_number: form.registration_number,
            contact_name: form.contact_name, contact_phone: form.contact_phone, contact_email: form.contact_email,
          },
          lease: {
            unit: form.unit, term_months: Number(form.term_months), starts_on: form.starts_on,
            area, rent_rate_per_sqft: Number(form.rent_rate_per_sqft),
            service_charge_rate_per_sqft: Number(form.service_charge_rate_per_sqft),
            vat_rate: Number(form.vat_rate), security_deposit: Number(form.security_deposit),
            billing_day: Number(form.billing_day), escalation_percent: Number(form.escalation_percent),
            escalation_interval_months: Number(form.escalation_interval_months),
          },
          utilities: utilities.map((item) => ({ ...item, deposit_amount: item.applicable ? item.rate_per_unit * area : 0 })),
          charges,
        }),
      }, organizationId);
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(typeof detail.detail === "string" ? detail.detail : Object.values(detail).flat().join(" ") || "Tenant application could not be saved.");
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
    ["Monthly rent (excl. VAT)", rent], ["Monthly service charge (excl. VAT)", serviceCharge],
    ["Total monthly amount (excl. VAT)", subtotal], ["VAT amount", vat],
    ["Total monthly amount (inc. VAT)", subtotal + vat], ["Security deposit", Number(form.security_deposit || 0)],
    ["Utilities security deposit", utilityDeposit], ["Total amount payable", total],
  ] as const;

  if (!open) return null;

  return (
    <Box className="tenant-application-card" sx={{ width: "100%", maxWidth: 1440, mx: "auto", pb: 3 }}>
      <AppBar className="tenant-application-header" position="static" color="inherit" elevation={0} sx={{ border: 1, borderColor: "divider", borderRadius: 2, mb: 2, overflow: "hidden" }}>
        <Toolbar sx={{ gap: { xs: 1, sm: 2 }, minHeight: { xs: 72, sm: 82 }, px: { xs: 1.5, sm: 2.5 } }}>
          <IconButton onClick={onClose} aria-label="Close tenant application"><CloseRounded /></IconButton>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h5" sx={{ fontWeight: 800, fontSize: { xs: "1.15rem", sm: "1.5rem" } }}>Tenant Application Card</Typography>
            <Typography variant="body2" color="text.secondary">{activeProperty?.name ?? "Select a property"} · application, tenant account and lease references are generated automatically</Typography>
          </Box>
          <Button className="tenant-header-save" variant="contained" startIcon={<SaveRounded />} disabled={saving} onClick={submit}>{saving ? "Saving…" : "Save application"}</Button>
        </Toolbar>
        <Tabs className="tenant-section-tabs" value={tab} onChange={(_, value) => navigateToSection(value)} variant="scrollable" scrollButtons="auto" aria-label="Tenant application sections">
          <Tab label="General" /><Tab label="Lease & charges" /><Tab label="Utilities" /><Tab label="Review" />
        </Tabs>
      </AppBar>

      <Box sx={{ bgcolor: "background.default", minHeight: "100%", py: { xs: 1, md: 2 } }}>
        {draftRestored && <Alert severity="info" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={() => { clearDraft(); setForm(initialForm); setUtilities(initialUtilities); }}>Discard draft</Button>}>Your unsaved tenant application was restored.</Alert>}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error} Your entered information has been retained.</Alert>}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 2fr) minmax(320px, 1fr)" }, gap: 2 }}>
          <Stack spacing={2}>
            <Paper id="tenant-general" className="tenant-form-section" variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
              <Typography variant="overline" sx={{ fontWeight: 800 }} color="primary">General information</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Capture the tenant’s legal and contact details. Internal references are generated when you save.</Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
                <TextField label="Application no." value="Auto-generated on save" disabled />
                {input("Tenant / company name", "name", { required: true })}
                {input("Tenant type", "tenant_type", { select: true, children: [<MenuItem key="company" value="company">Company</MenuItem>, <MenuItem key="individual" value="individual">Individual</MenuItem>] })}
                {input("KRA PIN no.", "tax_id")}
                {input("Registration no.", "registration_number")}
                {input("Phone no.", "phone", { type: "tel" })}
                {input("Email", "email", { type: "email" })}
                {input("Address", "address_1")}
                {input("Address 2", "address_2")}
                {input("City", "city")}
              </Box>
            </Paper>
            <Paper className="tenant-form-section" variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
              <Typography sx={{ fontWeight: 800 }} color="primary" gutterBottom>Primary contact</Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" }, gap: 2 }}>
                {input("Contact name", "contact_name")}{input("Contact phone no.", "contact_phone", { type: "tel" })}{input("Contact email", "contact_email", { type: "email" })}
              </Box>
            </Paper>
            <Paper className="tenant-form-section" variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
              <Typography sx={{ fontWeight: 800 }} color="primary" gutterBottom>Property and unit</Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" }, gap: 2 }}>
                <TextField label="Property" value={activeProperty?.name ?? ""} disabled />
                <TextField select required label="Unit no." value={form.unit} onChange={(event) => update("unit", event.target.value)}>
                  {units.map((unit) => <MenuItem key={unit.id} value={unit.id}>{unit.code} · {unit.unit_type || "Unit"}</MenuItem>)}
                </TextField>
                <TextField label="Floor no." value={selectedUnit?.floor ?? ""} disabled />
                <TextField label="Area (sq ft)" value={area || ""} disabled />
                <TextField label="Property address" value={[propertyDetails?.address, propertyDetails?.city, propertyDetails?.country].filter(Boolean).join(", ")} disabled sx={{ gridColumn: { md: "span 2" } }} />
              </Box>
              <Alert severity="info" sx={{ mt: 2 }}>Property, address, available units, floor, area, configured utilities and leasing defaults are filled from the property record. Tenant contact and postal details remain blank because they belong to the tenant.</Alert>
            </Paper>
            <Paper id="tenant-lease" className="tenant-form-section" variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
              <Typography variant="overline" sx={{ fontWeight: 800 }} color="primary">Lease terms and charges</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Rates calculate against the selected unit’s area. Escalations compound automatically at the selected interval and future invoices use the effective rent.</Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2 }}>
                {input("Lease term", "term_months", { select: true, required: true, children: [12, 24, 36, 60, 72, 120].map((months) => <MenuItem key={months} value={String(months)}>{months} months</MenuItem>) })}
                {input("Commencement date", "starts_on", { type: "date", required: true, slotProps: { inputLabel: { shrink: true } } })}
                <TextField label="Expiry date" value={expiryDate} disabled />
                {input("Applicable rent rate / sq ft", "rent_rate_per_sqft", { type: "number", required: true, inputProps: { min: 0, step: 0.01 } })}
                {input("Service charge rate / Sq.Ft", "service_charge_rate_per_sqft", { type: "number", inputProps: { min: 0, step: 0.01 } })}
                {input("VAT rate", "vat_rate", { select: true, children: [<MenuItem key="16" value="16">16%</MenuItem>, <MenuItem key="0" value="0">Exempt (0%)</MenuItem>] })}
                {input("Security deposit", "security_deposit", { type: "number", required: true, inputProps: { min: 0, step: 0.01 } })}
                {input("Billing day", "billing_day", { type: "number", inputProps: { min: 1, max: 28 } })}
                <TextField label="Lease no." value="Auto-generated on save" disabled />
                {input("Rent escalation", "escalation_percent", { type: "number", inputProps: { min: 0, max: 100, step: 0.01 }, helperText: "% increase at each escalation" })}
                {input("Escalation frequency", "escalation_interval_months", { select: true, disabled: !Number(form.escalation_percent), children: [<MenuItem key="12" value="12">Annually</MenuItem>, <MenuItem key="24" value="24">Biennially (every 2 years)</MenuItem>, <MenuItem key="36" value="36">Triennially (every 3 years)</MenuItem>] })}
                <Alert severity="info" sx={{ gridColumn: { md: "span 3" } }}>Invoices are blocked before commencement and on or after expiry. Billing resumes only from an active renewed lease term.</Alert>
              </Box>
            </Paper>
            <Paper id="tenant-utilities" className="tenant-form-section" variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, overflowX: "auto" }}>
              <Typography sx={{ fontWeight: 800 }} color="primary" gutterBottom>Utilities security deposit</Typography>
              {utilities.map((item, index) => (
                <Box key={item.utility} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "minmax(140px, 1fr) 160px 190px" }, gap: 2, alignItems: "center", py: 1 }}>
                  <FormControlLabel control={<Checkbox checked={item.applicable} onChange={(event) => setUtilities((rows) => rows.map((row, i) => i === index ? { ...row, applicable: event.target.checked } : row))} />} label={item.utility} />
                  <TextField type="number" label="Rate / unit" value={item.rate_per_unit} disabled={!item.applicable} onChange={(event) => setUtilities((rows) => rows.map((row, i) => i === index ? { ...row, rate_per_unit: Number(event.target.value) } : row))} />
                  <TextField label="Deposit amount" value={money(item.applicable ? item.rate_per_unit * area : 0)} disabled />
                </Box>
              ))}
            </Paper>
            <Paper className="tenant-form-section" variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, overflowX: "auto" }}>
              <Typography sx={{ fontWeight: 800 }} color="primary" gutterBottom>Tenant application lines</Typography>
              <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", "th, td": { p: 1, borderBottom: 1, borderColor: "divider", textAlign: "left", whiteSpace: "nowrap" } }}>
                <thead><tr><th>Charge code</th><th>Charge name</th><th>Letting fee</th><th>Renewal fee</th><th>Account</th><th>Area</th><th>Rate / Sq.Ft</th><th>Amount</th></tr></thead>
                <tbody>{charges.map((charge, index) => <tr key={charge.code}><td>{charge.code}</td><td>{charge.name}</td><td>{index === 0 ? <Checkbox size="small" checked={lettingFee} onChange={(event) => setLettingFee(event.target.checked)} /> : "—"}</td><td>{index === 0 ? <Checkbox size="small" checked={renewalFee} onChange={(event) => setRenewalFee(event.target.checked)} /> : "—"}</td><td>{charge.account_name}</td><td>{area.toLocaleString()}</td><td>{charge.rate.toFixed(2)}</td><td>{money(charge.amount)}</td></tr>)}</tbody>
              </Box>
            </Paper>
          </Stack>

          <Stack id="tenant-review" spacing={2} sx={{ alignSelf: "start", position: { lg: "sticky" }, top: { lg: 156 }, scrollMarginTop: 160 }}>
            <Paper className="tenant-summary-card" variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
              <Typography sx={{ fontWeight: 800 }} color="primary" gutterBottom>Application summary</Typography>
              {summary.map(([label, value], index) => <Box key={label} sx={{ display: "flex", justifyContent: "space-between", gap: 2, py: 1, borderBottom: index === summary.length - 1 ? 0 : 1, borderColor: "divider" }}><Typography variant="body2" color="text.secondary">{label}</Typography><Typography variant="body2" sx={{ fontWeight: index === summary.length - 1 ? 800 : 600 }}>{money(value)}</Typography></Box>)}
            </Paper>
            <Paper className="tenant-summary-card" variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
              <Typography sx={{ fontWeight: 800 }} color="primary" gutterBottom>Record details</Typography>
              <Stack spacing={1}><Typography variant="body2">Status: <strong>Open</strong></Typography><Typography variant="body2">Tenant account no.: <strong>Auto-generated</strong></Typography><Typography variant="body2">Document date: <strong>{new Date().toLocaleDateString("en-KE")}</strong></Typography><Typography variant="body2">Created by: <strong>{session?.user.firstName || session?.user.username}</strong></Typography></Stack>
            </Paper>
            <Alert severity="info">Saving creates the tenant application and a draft lease together. Activate the lease only after approval.</Alert>
            <Button size="large" variant="contained" startIcon={<SaveRounded />} disabled={saving} onClick={submit}>{saving ? "Saving…" : "Save tenant application"}</Button>
            <Button onClick={onClose}>Cancel</Button>
          </Stack>
        </Box>
        <Divider sx={{ my: 3 }} />
      </Box>
    </Box>
  );
}
