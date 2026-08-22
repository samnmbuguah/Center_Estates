"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import {
  Alert, Box, Button, Checkbox, FormControlLabel, MenuItem, Paper, Tab, Tabs,
  TextField, Typography,
} from "@mui/material";
import { Building2, FileUp, Save, ShieldCheck, Wrench } from "lucide-react";
import { Modal } from "@/components/module-ui";
import { Row } from "../../types/facility.types";

type Kind = "asset" | "contractor";
type SubmitHandler = (event: FormEvent<HTMLFormElement>) => Promise<boolean>;

const assetTabs = ["Identity", "Location", "Classification", "Technical", "Acquisition", "Lifecycle & maintenance", "Warranty & documents"];
const providerTabs = ["Organization", "Contacts", "Services", "Compliance & insurance", "Contracts", "Banking & payment", "Documents & performance"];

const grid = { display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))" }, gap: 2 } as const;

function useWizardForm(onSubmit: SubmitHandler) {
  const [tab, setTab] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const savedValues = useRef<Map<string, string[]>>(new Map());

  const capture = () => {
    const form = formRef.current;
    if (!form) return;
    form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("[data-wizard-injected]").forEach(node => node.remove());
    const next = new Map(savedValues.current);
    const currentNames = new Set<string>();
    for (const control of Array.from(form.elements)) {
      if (!(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement) || !control.name || control.type === "file") continue;
      currentNames.add(control.name);
    }
    currentNames.forEach(name => next.delete(name));
    for (const [name, value] of new FormData(form).entries()) {
      if (value instanceof File) continue;
      next.set(name, [...(next.get(name) ?? []), String(value)]);
    }
    savedValues.current = next;
  };

  const changeTab = (nextTab: number) => {
    capture();
    setTab(nextTab);
    window.requestAnimationFrame(() => {
      const form = formRef.current;
      if (!form) return;
      for (const control of Array.from(form.elements)) {
        if (!(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement) || !control.name || control.type === "file") continue;
        const values = savedValues.current.get(control.name) ?? [];
        if (control instanceof HTMLInputElement && (control.type === "checkbox" || control.type === "radio")) control.checked = values.includes(control.value || "on");
        else if (values[0] !== undefined) control.value = values[0];
      }
    });
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    capture();
    const form = event.currentTarget;
    const present = new Set(Array.from(form.elements).filter((node): node is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement => node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement || node instanceof HTMLSelectElement).map(node => node.name));
    for (const [name, values] of savedValues.current) {
      if (present.has(name)) continue;
      for (const value of values) {
        const hidden = document.createElement("input");
        hidden.type = "hidden"; hidden.name = name; hidden.value = value; hidden.dataset.wizardInjected = "true";
        form.appendChild(hidden);
      }
    }
    return onSubmit(event);
  };

  return { tab, changeTab, formRef, submit };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 2.5 }}><Typography variant="subtitle2" sx={{ color: "primary.main", fontWeight: 900, letterSpacing: ".04em", textTransform: "uppercase", mb: 2 }}>{title}</Typography>{children}</Paper>;
}

function FormActions({ onClose, creating }: { onClose: () => void; creating: boolean }) {
  return <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1.5, flexWrap: "wrap", pt: 1 }}>
    <Button variant="text" onClick={onClose}>Cancel</Button>
    <Box sx={{ display: "flex", gap: 1 }}>
      <Button type="submit" variant="outlined" startIcon={<Save size={16} />} disabled={creating} onClick={event => { event.currentTarget.form!.dataset.saveMode = "draft"; }}>Save as draft</Button>
      <Button type="submit" variant="contained" startIcon={<Save size={16} />} disabled={creating} onClick={event => { event.currentTarget.form!.dataset.saveMode = "submit"; }}>{creating ? "Saving…" : "Save record"}</Button>
    </Box>
  </Box>;
}

function DocumentsInput({ helper }: { helper: string }) {
  return <Box sx={{ border: "1px dashed", borderColor: "divider", borderRadius: 2, p: 2, bgcolor: "action.hover" }}>
    <Button component="label" variant="outlined" startIcon={<FileUp size={16} />}>Choose documents<input hidden type="file" name="document_files" multiple accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx" /></Button>
    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>{helper}</Typography>
  </Box>;
}

export function AssetOnboardingModal({ properties, onClose, onSubmit, error, creating }: { properties: Row[]; onClose: () => void; onSubmit: SubmitHandler; error: string; creating: boolean }) {
  const { tab, changeTab, formRef, submit } = useWizardForm(onSubmit);
  return <Modal extraWide title={<Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}><Wrench size={22} color="#dc2626" /><Box><Typography sx={{ fontWeight: 900 }}>Add New Asset</Typography><Typography variant="caption" color="text.secondary">Create the asset’s digital passport. Asset ID and QR reference are generated automatically.</Typography></Box></Box>} onClose={onClose}>
    <form ref={formRef} onSubmit={submit} data-save-mode="submit">
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error} Your entered information has been retained.</Alert>}
      <Tabs value={tab} onChange={(_, value) => changeTab(value)} variant="scrollable" scrollButtons="auto" sx={{ mb: 2, borderBottom: 1, borderColor: "divider", "& .MuiTab-root": { minHeight: 44, textTransform: "none", fontWeight: 800 } }}>{assetTabs.map((label, index) => <Tab key={label} label={`${index + 1}. ${label}`} />)}</Tabs>

      {tab === 0 && <Box sx={{ display: "grid", gap: 2 }}><Section title="Asset identity"><Box sx={grid}>
        <TextField required name="name" label="Asset name" placeholder="e.g. OTIS passenger lift 2" />
        <TextField disabled label="Asset ID" value="Generated on save" />
        <TextField name="meta__asset_tag" label="Asset tag number" />
        <TextField disabled label="QR / barcode" value="Generated from asset ID" />
        <TextField required name="category" label="Asset category" placeholder="e.g. Vertical transportation" />
        <TextField required name="meta__asset_type" label="Asset type" placeholder="e.g. Passenger lift" />
        <TextField name="asset_class" label="Asset class" placeholder="Mechanical & Electrical" />
        <TextField name="manufacturer" label="Manufacturer" />
        <TextField name="model_number" label="Model number" />
        <TextField name="serial_number" label="Serial number" />
        <TextField select name="is_active" label="Operational status" defaultValue="true"><MenuItem value="true">Active</MenuItem><MenuItem value="false">Inactive / decommissioned</MenuItem></TextField>
        <TextField required select name="criticality" label="Criticality" defaultValue="medium"><MenuItem value="low">Low</MenuItem><MenuItem value="medium">Medium</MenuItem><MenuItem value="high">High</MenuItem><MenuItem value="critical">Critical</MenuItem></TextField>
        <TextField name="meta__primary_use" label="Primary use" />
        <TextField select name="condition" label="Initial condition" defaultValue="good"><MenuItem value="excellent">Excellent</MenuItem><MenuItem value="good">Good</MenuItem><MenuItem value="fair">Fair</MenuItem><MenuItem value="poor">Poor</MenuItem><MenuItem value="out_of_service">Out of service</MenuItem></TextField>
      </Box><TextField fullWidth multiline minRows={3} name="meta__description" label="Asset description" sx={{ mt: 2 }} /></Section></Box>}

      {tab === 1 && <Section title="Location and responsibility"><Box sx={grid}>
        <TextField required select name="property" label="Property" defaultValue="">{properties.map(row => <MenuItem key={String(row.id)} value={String(row.id)}>{String(row.name)}</MenuItem>)}</TextField>
        <TextField name="meta__building_name" label="Building / tower" />
        <TextField name="meta__block_wing" label="Block / wing" />
        <TextField name="meta__floor" label="Floor" />
        <TextField name="meta__zone" label="Zone / area" />
        <TextField name="meta__room" label="Room / exact location" />
        <TextField name="meta__gps_coordinates" label="GPS coordinates" placeholder="-1.2864, 36.8172" />
        <TextField name="meta__responsible_manager" label="Responsible property / FM manager" />
      </Box></Section>}

      {tab === 2 && <Section title="Classification hierarchy"><Box sx={grid}>
        <TextField name="meta__hierarchy_level_1" label="Hierarchy level 1" placeholder="Building systems" />
        <TextField name="meta__hierarchy_level_2" label="Hierarchy level 2" placeholder="Mechanical systems" />
        <TextField name="meta__hierarchy_level_3" label="Hierarchy level 3" placeholder="Vertical transportation" />
        <TextField name="meta__asset_group" label="Asset group" />
        <TextField name="meta__asset_subgroup" label="Asset subgroup" />
        <TextField name="meta__system_discipline" label="System / discipline" />
        <TextField name="meta__parent_asset" label="Parent asset / system" />
        <TextField name="meta__asset_use" label="Asset use" />
      </Box></Section>}

      {tab === 3 && <Section title="Technical specifications"><Box sx={grid}>
        <TextField name="meta__capacity_rating" label="Capacity / rating" />
        <TextField name="meta__voltage" label="Voltage" />
        <TextField name="meta__power_rating" label="Power rating" />
        <TextField name="meta__dimensions" label="Dimensions" />
        <TextField name="meta__meter_device_id" label="Meter / device ID" />
        <TextField name="meta__sensor_api_reference" label="Sensor / API reference" />
      </Box><TextField fullWidth multiline minRows={4} name="meta__technical_specifications" label="Asset-type-specific specifications" helperText="Capture lift capacity and stops, generator kVA and fuel, HVAC tonnage/refrigerant, or other category-specific information." sx={{ mt: 2 }} /></Section>}

      {tab === 4 && <Section title="Acquisition and commissioning"><Box sx={grid}>
        <TextField name="meta__acquisition_date" type="date" label="Purchase / acquisition date" slotProps={{ inputLabel: { shrink: true } }} />
        <TextField name="installed_on" type="date" label="Installation date" slotProps={{ inputLabel: { shrink: true } }} />
        <TextField name="commissioned_on" type="date" label="Commissioning date" slotProps={{ inputLabel: { shrink: true } }} />
        <TextField name="meta__supplier_installer" label="Supplier / installer" />
        <TextField name="meta__purchase_order_reference" label="PO / contract reference" />
        <TextField name="purchase_value" type="number" slotProps={{ htmlInput: { min: 0, step: ".01" } }} label="Acquisition cost" defaultValue="0" />
        <TextField name="meta__installation_cost" type="number" slotProps={{ htmlInput: { min: 0, step: ".01" } }} label="Installation cost" />
        <TextField name="funding_source" label="Funding source" defaultValue="Landlord CAPEX" />
      </Box></Section>}

      {tab === 5 && <Box sx={{ display: "grid", gap: 2 }}><Section title="Lifecycle and replacement"><Box sx={grid}>
        <TextField name="expected_useful_life_years" type="number" slotProps={{ htmlInput: { min: 1 } }} label="Expected useful life (years)" defaultValue="10" />
        <TextField name="estimated_replacement_date" type="date" label="Estimated replacement date" slotProps={{ inputLabel: { shrink: true } }} />
        <TextField name="replacement_cost" type="number" slotProps={{ htmlInput: { min: 0, step: ".01" } }} label="Estimated replacement cost" defaultValue="0" />
        <TextField select name="meta__replacement_priority" label="Replacement priority" defaultValue="medium"><MenuItem value="low">Low</MenuItem><MenuItem value="medium">Medium</MenuItem><MenuItem value="high">High</MenuItem><MenuItem value="critical">Critical</MenuItem></TextField>
        <TextField name="meta__budget_status" label="Replacement budget status" />
        <TextField name="meta__book_value" type="number" label="Current book value" />
      </Box></Section><Section title="Maintenance strategy"><Box sx={grid}>
        <TextField select name="meta__maintenance_strategy" label="Strategy" defaultValue="preventive"><MenuItem value="preventive">Preventive</MenuItem><MenuItem value="predictive">Predictive</MenuItem><MenuItem value="condition_based">Condition based</MenuItem><MenuItem value="reactive">Reactive</MenuItem></TextField>
        <TextField select name="meta__maintenance_frequency" label="Frequency" defaultValue="monthly"><MenuItem value="weekly">Weekly</MenuItem><MenuItem value="monthly">Monthly</MenuItem><MenuItem value="quarterly">Quarterly</MenuItem><MenuItem value="biannual">Biannual</MenuItem><MenuItem value="annual">Annual</MenuItem></TextField>
        <TextField name="meta__last_service_date" type="date" label="Last service date" slotProps={{ inputLabel: { shrink: true } }} />
        <TextField name="meta__next_service_date" type="date" label="Next service date" slotProps={{ inputLabel: { shrink: true } }} />
        <TextField name="meta__service_provider" label="Assigned service provider" />
        <TextField name="meta__sla_reference" label="SLA reference" />
      </Box><TextField fullWidth multiline minRows={3} name="maintenance_procedure" label="Maintenance procedure / checklist" sx={{ mt: 2 }} /></Section></Box>}

      {tab === 6 && <Box sx={{ display: "grid", gap: 2 }}><Section title="Warranty, contracts and compliance"><Box sx={grid}>
        <TextField name="meta__warranty_provider" label="Warranty provider" />
        <TextField name="warranty_expires_on" type="date" label="Warranty expiry" slotProps={{ inputLabel: { shrink: true } }} />
        <TextField name="contractor_contract" label="Service contract reference" />
        <TextField name="meta__contract_start_date" type="date" label="Contract start" slotProps={{ inputLabel: { shrink: true } }} />
        <TextField name="meta__contract_end_date" type="date" label="Contract end" slotProps={{ inputLabel: { shrink: true } }} />
        <TextField name="meta__compliance_certificate" label="Certificate / permit reference" />
        <TextField name="meta__compliance_authority" label="Issuing authority" />
        <TextField name="meta__certificate_expiry" type="date" label="Certificate expiry" slotProps={{ inputLabel: { shrink: true } }} />
      </Box></Section><Section title="Documents and photos"><DocumentsInput helper="Attach manuals, warranties, certificates, drawings, invoices, inspection reports, asset photos and defect evidence. Files are stored against this asset after save." /></Section></Box>}
      <FormActions onClose={onClose} creating={creating} />
    </form>
  </Modal>;
}

export function ProviderOnboardingModal({ properties, onClose, onSubmit, error, creating }: { properties: Row[]; onClose: () => void; onSubmit: SubmitHandler; error: string; creating: boolean }) {
  const { tab, changeTab, formRef, submit } = useWizardForm(onSubmit);
  const propertyOptions = useMemo(() => properties.map(row => ({ id: String(row.id), name: String(row.name) })), [properties]);
  return <Modal extraWide title={<Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}><Building2 size={22} color="#dc2626" /><Box><Typography sx={{ fontWeight: 900 }}>Add New Service Provider</Typography><Typography variant="caption" color="text.secondary">Create a contractor or supplier record for contracts, work orders, compliance, payments and performance.</Typography></Box></Box>} onClose={onClose}>
    <form ref={formRef} onSubmit={submit} data-save-mode="submit">
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error} Your entered information has been retained.</Alert>}
      <Tabs value={tab} onChange={(_, value) => changeTab(value)} variant="scrollable" scrollButtons="auto" sx={{ mb: 2, borderBottom: 1, borderColor: "divider", "& .MuiTab-root": { minHeight: 44, textTransform: "none", fontWeight: 800 } }}>{providerTabs.map((label, index) => <Tab key={label} label={`${index + 1}. ${label}`} />)}</Tabs>
      {tab === 0 && <Box sx={{ display: "grid", gap: 2 }}><Section title="Organization details"><Box sx={grid}>
        <TextField required name="name" label="Company / organization name" />
        <TextField disabled label="Provider ID" value="Generated on save" />
        <TextField required name="registration_number" label="Registration number" />
        <TextField required name="meta__business_type" label="Business / entity type" />
        <TextField name="meta__year_established" type="number" label="Year established" />
        <TextField required name="meta__company_category" label="Company category" />
        <TextField required name="pin_number" label="Tax PIN" />
        <TextField name="meta__vat_number" label="VAT number" />
        <TextField required name="meta__country" label="Country" defaultValue="Kenya" />
        <TextField name="meta__website" label="Website" />
        <TextField name="meta__employee_count" type="number" label="Number of employees" />
        <TextField select name="status" label="Operational status" defaultValue="review"><MenuItem value="review">Under review</MenuItem><MenuItem value="active">Active</MenuItem><MenuItem value="suspended">Suspended</MenuItem><MenuItem value="expired">Compliance expired</MenuItem></TextField>
      </Box><TextField fullWidth multiline minRows={3} name="meta__company_profile" label="Company profile / description" sx={{ mt: 2 }} /><Box sx={{ ...grid, mt: 2 }}>
        <TextField required name="meta__head_office_address" label="Head office address" />
        <TextField required name="meta__city" label="City" />
        <TextField required name="meta__county_state" label="County / state" />
        <TextField name="meta__postal_code" label="Postal code" />
      </Box></Section><Section title="Classification"><Box sx={grid}>
        <TextField required name="meta__service_category" label="Service category" />
        <TextField required name="specialty" label="Trade / specialization" />
        <TextField select name="meta__criticality" label="Criticality" defaultValue="medium"><MenuItem value="low">Low</MenuItem><MenuItem value="medium">Medium</MenuItem><MenuItem value="high">High</MenuItem><MenuItem value="critical">Critical</MenuItem></TextField>
        <FormControlLabel control={<Checkbox name="is_preferred" />} label="Preferred supplier" />
        <FormControlLabel control={<Checkbox name="is_blacklisted" />} label="Blacklisted" />
      </Box></Section></Box>}
      {tab === 1 && <Section title="Contacts"><Box sx={grid}>
        <TextField required name="contact_name" label="Primary contact name" />
        <TextField required name="phone" label="Primary phone" />
        <TextField required name="email" type="email" label="Primary email" />
        <TextField name="meta__alternative_phone" label="Alternative phone" />
        <TextField name="meta__accounts_contact" label="Accounts contact" />
        <TextField name="meta__accounts_email" type="email" label="Accounts email" />
        <TextField name="meta__operations_contact" label="Operations contact" />
        <TextField name="meta__operations_phone" label="Operations phone" />
        <TextField name="meta__emergency_contact" label="Emergency contact name" />
        <TextField name="emergency_phone" label="24/7 emergency phone" />
      </Box></Section>}
      {tab === 2 && <Box sx={{ display: "grid", gap: 2 }}><Section title="Services and coverage"><Box sx={grid}>
        <TextField name="coverage_areas" label="Geographic coverage areas" />
        <TextField name="meta__branches" label="Branches" />
        <TextField name="meta__assets_equipment" label="Assets / equipment available" />
      </Box><TextField fullWidth multiline minRows={3} name="meta__service_description" label="Description of services" sx={{ mt: 2 }} /></Section><Section title="Approved properties"><Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" }, gap: 1 }}>{propertyOptions.map(prop => <FormControlLabel key={prop.id} control={<Checkbox name="assigned_properties" value={prop.id} />} label={prop.name} />)}</Box><Typography variant="caption" color="text.secondary">The provider will only appear in the workspaces of assigned properties.</Typography></Section></Box>}
      {tab === 3 && <Box sx={{ display: "grid", gap: 2 }}><Section title="Legal and tax compliance"><Box sx={grid}>
        <TextField name="meta__business_license_number" label="Business license number" />
        <TextField name="license_expires_on" type="date" label="License expiry" slotProps={{ inputLabel: { shrink: true } }} />
        <TextField name="meta__kra_compliance_reference" label="KRA compliance reference" />
        <TextField name="tax_compliance_expires_on" type="date" label="Tax compliance expiry" slotProps={{ inputLabel: { shrink: true } }} />
        <TextField select name="meta__compliance_status" label="Compliance status" defaultValue="pending"><MenuItem value="pending">Pending verification</MenuItem><MenuItem value="compliant">Compliant</MenuItem><MenuItem value="non_compliant">Non-compliant</MenuItem></TextField>
        <TextField select name="approval_status" label="Approval status" defaultValue="pending"><MenuItem value="draft">Draft</MenuItem><MenuItem value="pending">Pending approval</MenuItem><MenuItem value="approved">Approved</MenuItem></TextField>
      </Box></Section><Section title="Insurance"><Box sx={grid}>
        <TextField name="meta__insurance_provider" label="Insurance provider" />
        <TextField name="meta__insurance_policy_number" label="Policy number" />
        <TextField name="meta__insurance_cover_type" label="Cover type" />
        <TextField name="meta__insurance_start_date" type="date" label="Cover start date" slotProps={{ inputLabel: { shrink: true } }} />
        <TextField name="insurance_expires_on" type="date" label="Cover expiry" slotProps={{ inputLabel: { shrink: true } }} />
        <TextField name="meta__insurance_sum_insured" type="number" label="Sum insured" />
      </Box></Section></Box>}
      {tab === 4 && <Section title="Contract information"><Box sx={grid}>
        <TextField name="meta__contract_reference" label="Contract reference" />
        <TextField name="meta__contract_start_date" type="date" label="Start date" slotProps={{ inputLabel: { shrink: true } }} />
        <TextField name="meta__contract_end_date" type="date" label="End date" slotProps={{ inputLabel: { shrink: true } }} />
        <TextField name="meta__contract_value" type="number" label="Contract value" />
        <TextField name="meta__response_sla_hours" type="number" label="Response SLA (hours)" />
        <TextField name="meta__resolution_sla_hours" type="number" label="Resolution SLA (hours)" />
      </Box><TextField fullWidth multiline minRows={3} name="meta__contract_scope" label="Contract scope / payment milestones" sx={{ mt: 2 }} /></Section>}
      {tab === 5 && <Section title="Banking and payment"><Box sx={grid}>
        <TextField name="meta__bank_name" label="Bank name" />
        <TextField name="meta__bank_account_name" label="Account name" />
        <TextField name="meta__bank_account_number" label="Account number" />
        <TextField name="meta__bank_branch" label="Branch" />
        <TextField name="meta__bank_currency" label="Currency" defaultValue="KES" />
        <TextField name="meta__payment_terms" label="Payment terms" placeholder="e.g. 30 days after invoice" />
      </Box></Section>}
      {tab === 6 && <Box sx={{ display: "grid", gap: 2 }}><Section title="Documents"><DocumentsInput helper="Attach company profile, licenses, KRA PIN/VAT certificates, insurance, contracts and other compliance evidence. Files are stored against this provider after save." /></Section><Section title="Performance baseline"><Box sx={grid}>
        <TextField name="rating" type="number" slotProps={{ htmlInput: { min: 0, max: 5, step: ".1" } }} label="Initial rating (0–5)" defaultValue="0" />
        <TextField name="meta__review_date" type="date" label="Review date" slotProps={{ inputLabel: { shrink: true } }} />
        <TextField name="meta__kpi_metrics" label="KPI metrics" placeholder="SLA, quality, cost, CSAT" />
      </Box><TextField fullWidth multiline minRows={3} name="meta__performance_notes" label="Performance / due-diligence notes" sx={{ mt: 2 }} /></Section><Alert icon={<ShieldCheck size={18} />} severity="info">Save as draft while evidence is incomplete. Only approved providers should be assigned to live contracts or work orders.</Alert></Box>}
      <FormActions onClose={onClose} creating={creating} />
    </form>
  </Modal>;
}
