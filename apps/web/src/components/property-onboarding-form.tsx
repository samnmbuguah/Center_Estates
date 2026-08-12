"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Alert, Box, Button, Chip, Divider, FormControlLabel, IconButton,
  MenuItem, Paper, Switch, Tab, Tabs, TextField, Typography,
} from "@mui/material";
import { ArrowLeft, Download, Plus, Save, Trash2, Upload } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api";
import { useFormDraft } from "@/lib/form-drafts";
import { usePropertyContext } from "@/lib/property-context";
import { useToast } from "@/components/monitoring/hooks/useToast";
import { DraftBanner } from "@/components/draft-banner";

type Values = Record<string, string>;
type UnitDraft = { unit_no: string; unit_type: string; floor: string; use: string; area: string; rateable_area: string; description: string; building_index: string };
type UtilityDraft = { type: string; account_no: string; provider: string; bill_cycle: string; status: string; meter_code: string; supply_mode: string; initial_reading: string; reading_date: string; tariff: string; unit: string };
type AssetDraft = { name: string; category: string; location: string; quantity: string; status: string };
type ContactDraft = { name: string; role: string; email: string; phone: string };
type ProviderDraft = { name: string; service: string; contact: string; email: string; phone: string };
type DocumentDraft = { name: string; type: string; reference: string; expires_on: string; file: File | null };

const blankUnit: UnitDraft = { unit_no: "", unit_type: "", floor: "", use: "", area: "", rateable_area: "", description: "", building_index: "" };
const blankUtility: UtilityDraft = { type: "water", account_no: "", provider: "", bill_cycle: "monthly", status: "active", meter_code: "", supply_mode: "postpaid", initial_reading: "", reading_date: "", tariff: "0", unit: "m³" };
const blankAsset: AssetDraft = { name: "", category: "", location: "", quantity: "1", status: "active" };
const blankContact: ContactDraft = { name: "", role: "", email: "", phone: "" };
const blankProvider: ProviderDraft = { name: "", service: "", contact: "", email: "", phone: "" };
const blankDocument: DocumentDraft = { name: "", type: "title", reference: "", expires_on: "", file: null };
const initialValues: Values = { status: "draft", property_type: "commercial", landlord_type: "individual", country: "KE", currency: "KES", building_count: "1", floors: "1", parking_spaces: "0", tax_status: "resident", title_type: "freehold" };

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"' && quoted && text[index + 1] === '"') { cell += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) { row.push(cell.trim()); cell = ""; }
    else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; cell = "";
    } else cell += character;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
}

const sections = [
  ["general", "General"], ["location", "Location"], ["units", "Units"], ["assets", "Assets"],
  ["utilities", "Utilities"], ["contacts", "Contacts"], ["providers", "Service Providers"],
  ["landlord", "Landlord Engagement & Terms"], ["documents", "Documents"], ["notes", "Notes"],
] as const;

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return <Paper id={id} variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, scrollMarginTop: 155 }}><Typography variant="overline" color="primary" sx={{ fontWeight: 800 }}>{title}</Typography><Box sx={{ mt: 1.25 }}>{children}</Box></Paper>;
}

function Grid({ children, columns = 3 }: { children: React.ReactNode; columns?: number }) {
  return <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: `repeat(${columns}, minmax(0, 1fr))` }, gap: 2 }}>{children}</Box>;
}

function RowList<T>({ rows, columns, render, onRemove, empty }: { rows: T[]; columns: string[]; render: (row: T) => React.ReactNode[]; onRemove: (index: number) => void; empty: string }) {
  if (!rows.length) return <Box sx={{ py: 4, textAlign: "center", color: "text.secondary" }}>{empty}</Box>;
  return <Box sx={{ overflowX: "auto" }}><Box component="table" sx={{ width: "100%", borderCollapse: "collapse", "th,td": { textAlign: "left", p: 1, borderBottom: "1px solid", borderColor: "divider", fontSize: 12 } }}><thead><tr>{columns.map(c => <th key={c}>{c}</th>)}<th>Actions</th></tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{render(row).map((cell, i) => <td key={i}>{cell}</td>)}<td><IconButton size="small" aria-label="Remove" onClick={() => onRemove(index)}><Trash2 size={15} /></IconButton></td></tr>)}</tbody></Box></Box>;
}

export function PropertyOnboardingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams?.get("edit");
  const { session } = useAuth();
  const { selectProperty } = usePropertyContext();
  const { toast } = useToast();
  const organizationId = session?.activeOrganizationId ?? null;
  const [section, setSection] = useState("general");
  const draftScope = `${organizationId || "unknown"}:${session?.user.id || "unknown"}`;
  const [values, setValues, clearValues, valuesRestored, valuesSavedAt] = useFormDraft<Values>("property-onboarding:values", initialValues, draftScope);
  const [vatRegistered, setVatRegistered] = useState(false);
  const [units, setUnits, clearUnits, unitsRestored] = useFormDraft<UnitDraft[]>("property-onboarding:units", [], draftScope);
  const [unitDraft, setUnitDraft] = useState<UnitDraft>(blankUnit);
  const [utilities, setUtilities, clearUtilities, utilitiesRestored] = useFormDraft<UtilityDraft[]>("property-onboarding:utilities", [], draftScope);
  const [utilityDraft, setUtilityDraft] = useState<UtilityDraft>(blankUtility);
  const [assets, setAssets, clearAssets, assetsRestored] = useFormDraft<AssetDraft[]>("property-onboarding:assets", [], draftScope);
  const [assetDraft, setAssetDraft] = useState<AssetDraft>(blankAsset);
  const [contacts, setContacts, clearContacts, contactsRestored] = useFormDraft<ContactDraft[]>("property-onboarding:contacts", [], draftScope);
  const [contactDraft, setContactDraft] = useState<ContactDraft>(blankContact);
  const [providers, setProviders, clearProviders, providersRestored] = useFormDraft<ProviderDraft[]>("property-onboarding:providers", [], draftScope);
  const [providerDraft, setProviderDraft] = useState<ProviderDraft>(blankProvider);
  const [documents, setDocuments] = useState<DocumentDraft[]>([]);
  const [documentDraft, setDocumentDraft] = useState<DocumentDraft>(blankDocument);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const restoredDraft = valuesRestored || unitsRestored || utilitiesRestored || assetsRestored || contactsRestored || providersRestored;
  const clearDraft = () => { clearValues(); clearUnits(); clearUtilities(); clearAssets(); clearContacts(); clearProviders(); };

  useEffect(() => {
    if (!editId) return;
    let active = true;
    apiFetch(`/property/properties/${editId}/`, {}, organizationId)
      .then(async (res) => {
        if (active && res.ok) {
          const prop = await res.json();
          setValues((curr) => ({
            ...curr,
            name: prop.name || "",
            code: prop.code || "",
            property_type: prop.property_type || "commercial",
            address: prop.address || "",
            city: prop.city || "",
            country: prop.country || "KE",
            status: prop.status || "active",
            landlord_name: prop.metadata?.landlord?.name || prop.landlord_name || "Landlord",
            landlord_type: prop.metadata?.landlord?.type || "individual",
            county: prop.metadata?.location?.county || prop.city || "Nairobi",
            notes: prop.notes || prop.metadata?.notes || "",
          }));
          if (Array.isArray(prop.units) && prop.units.length > 0) {
            setUnits(prop.units.map((u: any) => ({
              unit_no: u.unit_no || u.code || "",
              unit_type: u.unit_type || "commercial",
              floor: String(u.floor || "1"),
              use: u.use || "Office",
              area: String(u.area || "500"),
              rateable_area: String(u.rateable_area || u.area || "500"),
              description: u.description || "",
              building_index: "0",
            })));
          }
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, [editId, organizationId, setValues, setUnits]);

  const set = (name: string) => (event: React.ChangeEvent<HTMLInputElement>) => setValues(current => ({ ...current, [name]: event.target.value }));
  const totalArea = useMemo(() => units.reduce((sum, unit) => sum + Number(unit.area || 0), 0), [units]);

  const jump = (id: string) => {
    setSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const addUnit = () => {
    if (!unitDraft.unit_no.trim() || !unitDraft.unit_type.trim() || !unitDraft.floor.trim() || !unitDraft.use.trim() || !Number(unitDraft.area)) {
      setError("Complete the required unit number, type, floor, use and area fields."); return;
    }
    if (units.some(unit => unit.unit_no.trim().toLowerCase() === unitDraft.unit_no.trim().toLowerCase())) {
      setError("Unit numbers must be unique within the property."); return;
    }
    setUnits(current => [...current, unitDraft]); setUnitDraft(blankUnit); setError("");
  };

  const importUnits = async (file?: File) => {
    if (!file) return;
    const rows = parseCsv(await file.text());
    const expected = ["unit_no", "unit_type", "floor", "use", "area", "rateable_area", "building_number", "description"];
    const headers = (rows.shift() ?? []).map(value => value.toLowerCase().replaceAll(" ", "_"));
    if (expected.some((header, index) => headers[index] !== header)) {
      setError(`Unit CSV columns must be: ${expected.join(", ")}.`); jump("units"); return;
    }
    const imported: UnitDraft[] = rows.map(row => ({ unit_no: row[0] ?? "", unit_type: row[1] ?? "", floor: row[2] ?? "", use: row[3] ?? "", area: row[4] ?? "", rateable_area: row[5] ?? "", building_index: row[6] ?? "", description: row[7] ?? "" }));
    const allCodes = [...units.map(unit => unit.unit_no.toLowerCase()), ...imported.map(unit => unit.unit_no.toLowerCase())];
    if (!imported.length || imported.length + units.length > 500 || imported.some(unit => !unit.unit_no || !unit.unit_type || !unit.floor || !unit.use || Number(unit.area) <= 0) || new Set(allCodes).size !== allCodes.length) {
      setError("Unit import contains missing required values, invalid areas, duplicate unit numbers, or exceeds 500 units."); jump("units"); return;
    }
    setUnits(current => [...current, ...imported]); setError("");
  };

  const importAssets = async (file?: File) => {
    if (!file) return;
    const rows = parseCsv(await file.text());
    const expected = ["asset_name", "category", "location", "quantity", "status"];
    const headers = (rows.shift() ?? []).map(value => value.toLowerCase().replaceAll(" ", "_"));
    if (expected.some((header, index) => headers[index] !== header)) {
      setError(`Asset CSV columns must be: ${expected.join(", ")}.`); jump("assets"); return;
    }
    const imported: AssetDraft[] = rows.map(row => ({ name: row[0] ?? "", category: row[1] ?? "", location: row[2] ?? "", quantity: row[3] ?? "1", status: (row[4] || "active").toLowerCase() }));
    if (!imported.length || imported.length + assets.length > 500 || imported.some(asset => !asset.name || Number(asset.quantity) <= 0 || !["active", "inactive", "maintenance"].includes(asset.status))) {
      setError("Asset import contains missing names, invalid quantities/statuses, or exceeds 500 assets."); jump("assets"); return;
    }
    setAssets(current => [...current, ...imported]); setError("");
  };

  const importContacts = async (file?: File) => {
    if (!file) return;
    const rows = parseCsv(await file.text());
    const expected = ["name", "role", "email", "phone"];
    const headers = (rows.shift() ?? []).map(value => value.replace(/^\uFEFF/, "").toLowerCase().replaceAll(" ", "_"));
    if (expected.some((header, index) => headers[index] !== header)) { setError(`Contact CSV columns must be: ${expected.join(", ")}.`); jump("contacts"); return; }
    const imported = rows.map(row => ({ name: row[0] ?? "", role: row[1] ?? "", email: row[2] ?? "", phone: row[3] ?? "" }));
    if (!imported.length || imported.length + contacts.length > 500 || imported.some(contact => !contact.name || (!contact.email && !contact.phone))) { setError("Each imported contact needs a name and either an email address or phone number. Maximum 500 contacts."); jump("contacts"); return; }
    setContacts(current => [...current, ...imported]); setError("");
  };

  const importProviders = async (file?: File) => {
    if (!file) return;
    const rows = parseCsv(await file.text());
    const expected = ["provider_name", "service", "contact_person", "email", "phone"];
    const headers = (rows.shift() ?? []).map(value => value.replace(/^\uFEFF/, "").toLowerCase().replaceAll(" ", "_"));
    if (expected.some((header, index) => headers[index] !== header)) { setError(`Service-provider CSV columns must be: ${expected.join(", ")}.`); jump("providers"); return; }
    const imported = rows.map(row => ({ name: row[0] ?? "", service: row[1] ?? "", contact: row[2] ?? "", email: row[3] ?? "", phone: row[4] ?? "" }));
    if (!imported.length || imported.length + providers.length > 500 || imported.some(provider => !provider.name || !provider.service)) { setError("Each imported service provider needs a provider name and service. Maximum 500 providers."); jump("providers"); return; }
    setProviders(current => [...current, ...imported]); setError("");
  };

  const importUtilities = async (file?: File) => {
    if (!file) return;
    const rows = parseCsv(await file.text());
    const expected = ["utility_type", "supply_mode", "account_number", "provider", "bill_cycle", "meter_number", "opening_reading", "reading_date", "tariff", "unit", "status"];
    const headers = (rows.shift() ?? []).map(value => value.replace(/^\uFEFF/, "").toLowerCase().replaceAll(" ", "_"));
    if (expected.some((header, index) => headers[index] !== header)) { setError(`Utility CSV columns must be: ${expected.join(", ")}.`); jump("utilities"); return; }
    const imported: UtilityDraft[] = rows.map(row => ({ type: (row[0] || "").toLowerCase(), supply_mode: (row[1] || "postpaid").toLowerCase(), account_no: row[2] ?? "", provider: row[3] ?? "", bill_cycle: row[4] || "monthly", meter_code: row[5] ?? "", initial_reading: row[6] ?? "", reading_date: row[7] ?? "", tariff: row[8] || "0", unit: row[9] || (row[0] === "electricity" ? "kWh" : "m³"), status: (row[10] || "active").toLowerCase() }));
    const validTypes = ["water", "electricity", "sewerage", "gas", "internet"];
    if (!imported.length || imported.length + utilities.length > 100 || imported.some(utility => !validTypes.includes(utility.type) || (!utility.account_no && !utility.meter_code) || Number(utility.tariff) < 0 || Number(utility.initial_reading || 0) < 0 || (utility.type === "electricity" && !["prepaid", "postpaid"].includes(utility.supply_mode)))) { setError("Utility import has an invalid type, billing mode, account/meter number, tariff or opening reading. Maximum 100 accounts."); jump("utilities"); return; }
    setUtilities(current => [...current, ...imported]); setError("");
  };

  const save = async () => {
    if (!organizationId) return;
    if (!values.name?.trim() || !values.landlord_name?.trim() || !values.address?.trim() || !values.city?.trim() || !values.county?.trim()) {
      setError("Complete all required property, landlord and address fields before saving."); jump("general"); return;
    }
    setSaving(true); setError("");
    const metadata = {
      category: values.category || "", lr_number: values.lr_number, pin_number: values.pin_number || "",
      year_built: values.year_built || null, title_type: values.title_type, land_size_sqft: values.land_size || null,
      built_up_area_sqft: values.built_up_area || null, description: values.description || "", currency: values.currency,
      landlord: { name: values.landlord_name, type: values.landlord_type, pin: values.landlord_pin || "", registration_number: values.landlord_registration || "", tax_status: values.tax_status, vat_registered: vatRegistered, vat_number: vatRegistered ? values.vat_number || "" : "" },
      location: { county: values.county, postal_address: values.postal_address || "", postal_code: values.postal_code || "" },
      building: { floor_numbers: values.floor_numbers || "", use: values.building_use || "", access_points: values.access_points || "", parking_spaces: Number(values.parking_spaces || 0), amenities: values.amenities || "" },
      utilities, assets, contacts, service_providers: providers,
      documents: documents.map(({ file, ...document }) => ({ ...document, filename: file?.name ?? "" })),
      landlord_engagement: { engagement_type: values.engagement_type || "management", starts_on: values.engagement_start || null, ends_on: values.engagement_end || null, management_fee_percent: values.management_fee || null, payment_terms: values.payment_terms || "" },
      notes: values.notes || "", onboarding_status: "draft",
    };
    try {
      const endpoint = editId ? `/property/properties/${editId}/` : "/property/properties/onboard/";
      const method = editId ? "PATCH" : "POST";
      const response = await apiFetch(endpoint, {
        method,
        body: JSON.stringify({
          property: { name: values.name.trim(), property_type: values.property_type, status: values.status, address: values.address, city: values.city, country: values.country, metadata },
          building: { count: Number(values.building_count || 0), floors: Number(values.floors || 1), floor_numbers: values.floor_numbers || "", use: values.building_use || "", access_points: values.access_points || "", parking_spaces: Number(values.parking_spaces || 0), amenities: values.amenities || "" },
          units,
        }),
      }, organizationId);
      if (!response.ok) {
        if (response.status === 401) throw new Error("Your session expired before the property could be saved. Sign in again and retry.");
        if (response.status === 403) throw new Error("You do not have permission to onboard properties for this organization.");
        const body = await response.json().catch(() => ({}));
        throw new Error(Object.values(body as Record<string, unknown>).flat().join(" ") || "Property onboarding failed.");
      }
      const result = await response.json() as { property?: { id: string; name: string; code?: string; status?: string; city?: string }; id?: string; name?: string; code?: string; status?: string; city?: string };
      const savedProp = result.property ?? (result.id ? (result as { id: string; name: string; code?: string; status?: string; city?: string }) : null);
      clearDraft();
      const failedDocuments: string[] = [];
      if (savedProp) {
        for (const document of documents.filter(item => item.file)) {
          const body = new FormData();
          body.append("title", document.name);
          body.append("category", `property_${document.type}`);
          body.append("file", document.file as File);
          body.append("original_filename", (document.file as File).name);
          if (document.expires_on) body.append("expires_on", document.expires_on);
          body.append("metadata", JSON.stringify({ property_id: savedProp.id, reference: document.reference }));
          const upload = await apiFetch("/documents/documents/", { method: "POST", body }, organizationId);
          if (!upload.ok) failedDocuments.push(document.name);
        }
        selectProperty({ id: savedProp.id, name: savedProp.name, code: savedProp.code, status: savedProp.status, location: savedProp.city });
      }
      if (failedDocuments.length) {
        setError(`Property was saved, but these files could not be uploaded: ${failedDocuments.join(", ")}. You can retry from Documents.`);
        return;
      }
      toast.success(`${savedProp?.name || values.name} was ${editId ? "updated" : "created"} successfully.`);
      router.push("/overview");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Property onboarding failed."); }
    finally { setSaving(false); }
  };

  return <Box className="property-onboarding-card" sx={{ width: "100%", maxWidth: 1320, mx: "auto", px: { xs: 1.5, md: 3 }, py: 2.5 }}>
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, mb: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}><IconButton aria-label="Back" onClick={() => router.push("/overview")}><ArrowLeft /></IconButton><Box><Typography variant="h4" sx={{ fontWeight: 800 }}>{editId ? `Edit Property: ${values.name || "Loading..."}` : "Property Onboarding Card"}</Typography><Typography color="text.secondary" variant="body2">{editId ? "Update property attributes, structure, and associated details." : "Codes and internal IDs are generated automatically."}</Typography></Box></Box>
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", justifyContent: "flex-end" }}>
        {section === "utilities" && <><Button size="small" variant="outlined" startIcon={<Download size={15} />} onClick={() => downloadCsv("center-estates-utility-template.csv", [["utility_type","supply_mode","account_number","provider","bill_cycle","meter_number","opening_reading","reading_date","tariff","unit","status"],["water","postpaid","WTR-100","County Water","monthly","MTR-WTR-100","250","2026-08-01","120","m³","active"],["electricity","prepaid","KPLC-200","KPLC","prepaid","MTR-KPLC-200","","","0","kWh","active"]])}>Utility template</Button><Button size="small" variant="outlined" component="label" startIcon={<Upload size={15} />}>Upload utilities<input hidden type="file" accept=".csv,text/csv" onChange={event => { void importUtilities(event.target.files?.[0]); event.target.value = ""; }} /></Button></>}
        <Button variant="contained" startIcon={<Save size={17} />} disabled={saving} onClick={() => void save()}>{saving ? "Saving…" : "Save & Close"}</Button>
      </Box>
    </Box>
    <Paper variant="outlined" sx={{ position: "sticky", top: 76, zIndex: 5, mb: 2, overflowX: "auto" }}><Tabs value={section} onChange={(_, value) => jump(value)} variant="scrollable" scrollButtons="auto">{sections.map(([id, label]) => <Tab key={id} value={id} label={label} />)}</Tabs></Paper>
    <DraftBanner
      restored={restoredDraft}
      savedAt={valuesSavedAt}
      hasFiles={documents.some((item) => Boolean(item.file))}
      fileCount={documents.length}
      onDiscard={() => {
        clearDraft();
        window.location.reload();
      }}
      message="Your unsaved property onboarding draft was restored."
    />
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error} Your entered information has been retained.</Alert>}
    <Box sx={{ display: "grid", gap: 2 }}>
      <Section id="general" title="General information">
        <Grid><TextField label="Property code" value="Auto generated" disabled /><TextField required label="Property name" value={values.name || ""} onChange={set("name")} /><TextField select required label="Property status" value={values.status} onChange={set("status")}><MenuItem value="draft">Draft</MenuItem><MenuItem value="active">Active</MenuItem><MenuItem value="inactive">Inactive</MenuItem></TextField>
        <TextField select required label="Property type" value={values.property_type} onChange={set("property_type")}><MenuItem value="commercial">Commercial</MenuItem><MenuItem value="residential">Residential</MenuItem><MenuItem value="mixed_use">Mixed use</MenuItem><MenuItem value="industrial">Industrial</MenuItem></TextField><TextField label="Property category" value={values.category || ""} onChange={set("category")} /><TextField label="LR number (optional)" value={values.lr_number || ""} onChange={set("lr_number")} />
        <TextField label="Property PIN" value={values.pin_number || ""} onChange={set("pin_number")} /><TextField type="number" label="Year built" value={values.year_built || ""} onChange={set("year_built")} /><TextField select label="Title type" value={values.title_type} onChange={set("title_type")}><MenuItem value="freehold">Freehold</MenuItem><MenuItem value="leasehold">Leasehold</MenuItem><MenuItem value="sectional">Sectional title</MenuItem></TextField>
        <TextField type="number" label="Land size (sq ft)" value={values.land_size || ""} onChange={set("land_size")} /><TextField type="number" label="Built-up area (sq ft)" value={values.built_up_area || ""} onChange={set("built_up_area")} /><TextField select label="Currency" value={values.currency} onChange={set("currency")}><MenuItem value="KES">KES — Kenyan Shilling</MenuItem><MenuItem value="USD">USD — US Dollar</MenuItem></TextField></Grid>
        <TextField fullWidth multiline minRows={3} label="Description" value={values.description || ""} onChange={set("description")} sx={{ mt: 2 }} />
        <Divider sx={{ my: 2.5 }} /><Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 800 }}>Landlord and tax information</Typography>
        <Grid><TextField required label="Name of landlord" value={values.landlord_name || ""} onChange={set("landlord_name")} /><TextField select label="Landlord type" value={values.landlord_type} onChange={set("landlord_type")}><MenuItem value="individual">Individual</MenuItem><MenuItem value="company">Company</MenuItem><MenuItem value="trust">Trust</MenuItem><MenuItem value="government">Government</MenuItem></TextField><TextField label="Landlord PIN" value={values.landlord_pin || ""} onChange={set("landlord_pin")} />
        <TextField label="Landlord registration no." value={values.landlord_registration || ""} onChange={set("landlord_registration")} /><TextField select label="Tax status" value={values.tax_status} onChange={set("tax_status")}><MenuItem value="resident">Resident</MenuItem><MenuItem value="non_resident">Non-resident</MenuItem><MenuItem value="exempt">Tax exempt</MenuItem></TextField><Box><FormControlLabel control={<Switch checked={vatRegistered} onChange={(_, checked) => setVatRegistered(checked)} />} label="VAT registered" /><TextField fullWidth disabled={!vatRegistered} label="VAT number" value={values.vat_number || ""} onChange={set("vat_number")} /></Box></Grid>
      </Section>

      <Section id="location" title="Property address"><Grid><TextField required multiline minRows={3} label="Physical address" value={values.address || ""} onChange={set("address")} /><TextField required label="City / town" value={values.city || ""} onChange={set("city")} /><TextField required label="County" value={values.county || ""} onChange={set("county")} /><TextField multiline minRows={3} label="Postal address" value={values.postal_address || ""} onChange={set("postal_address")} /><TextField label="Postal code" value={values.postal_code || ""} onChange={set("postal_code")} /><TextField label="Country code" value={values.country} onChange={set("country")} /></Grid></Section>

      <Section id="building" title="Building details"><Grid><TextField type="number" label="Number of buildings" value={values.building_count} onChange={set("building_count")} /><TextField type="number" label="Number of floors" value={values.floors} onChange={set("floors")} /><TextField label="Floor numbers" placeholder="e.g. G, 1, 2, 3" value={values.floor_numbers || ""} onChange={set("floor_numbers")} /><TextField label="Building use" value={values.building_use || ""} onChange={set("building_use")} /><TextField label="Access / entry points" value={values.access_points || ""} onChange={set("access_points")} /><TextField type="number" label="Parking spaces" value={values.parking_spaces} onChange={set("parking_spaces")} /></Grid><TextField fullWidth multiline minRows={2} label="Amenities" placeholder="Lift, generator, borehole, gym, CCTV…" value={values.amenities || ""} onChange={set("amenities")} sx={{ mt: 2 }} /></Section>

      <Section id="units" title="Create units">
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: { xs: "stretch", sm: "center" }, flexDirection: { xs: "column", sm: "row" }, gap: 1, mb: 2 }}>
          <Typography variant="body2" color="text.secondary">Add units manually or import up to 500 rows from the Excel-compatible CSV template.</Typography>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <Button size="small" variant="outlined" startIcon={<Download size={15} />} onClick={() => downloadCsv("center-estates-unit-template.csv", [["unit_no","unit_type","floor","use","area","rateable_area","building_number","description"],["G-01","Shop","Ground","Commercial","850","820","1","Ground floor retail unit"]])}>Download template</Button>
            <Button size="small" variant="contained" component="label" startIcon={<Upload size={15} />}>Upload unit CSV<input hidden type="file" accept=".csv,text/csv" onChange={event => { void importUnits(event.target.files?.[0]); event.target.value = ""; }} /></Button>
          </Box>
        </Box>
        <Grid columns={4}><TextField required label="Unit number" value={unitDraft.unit_no} onChange={e => setUnitDraft({ ...unitDraft, unit_no: e.target.value })} /><TextField required label="Unit type" value={unitDraft.unit_type} onChange={e => setUnitDraft({ ...unitDraft, unit_type: e.target.value })} /><TextField required label="Floor" value={unitDraft.floor} onChange={e => setUnitDraft({ ...unitDraft, floor: e.target.value })} /><TextField required label="Use" value={unitDraft.use} onChange={e => setUnitDraft({ ...unitDraft, use: e.target.value })} /><TextField required type="number" label="Area (sq ft)" value={unitDraft.area} onChange={e => setUnitDraft({ ...unitDraft, area: e.target.value })} /><TextField type="number" label="Rateable area (sq ft)" value={unitDraft.rateable_area} onChange={e => setUnitDraft({ ...unitDraft, rateable_area: e.target.value })} /><TextField type="number" label="Building number" value={unitDraft.building_index} onChange={e => setUnitDraft({ ...unitDraft, building_index: e.target.value })} /><TextField label="Description" value={unitDraft.description} onChange={e => setUnitDraft({ ...unitDraft, description: e.target.value })} /></Grid>
        <Button startIcon={<Plus size={16} />} variant="outlined" sx={{ mt: 1.5 }} onClick={addUnit}>Add unit</Button><Divider sx={{ my: 2 }} /><RowList rows={units} columns={["Unit no.", "Floor", "Type", "Use", "Area", "Rateable area"]} render={u => [u.unit_no, u.floor, u.unit_type, u.use, u.area, u.rateable_area || "—"]} onRemove={i => setUnits(rows => rows.filter((_, index) => index !== i))} empty="No units added yet." />
        <Box sx={{ display: "flex", gap: 1, mt: 2, flexWrap: "wrap" }}><Chip label={`Total units: ${units.length}`} /><Chip label={`Lettable area: ${totalArea.toLocaleString()} sq ft`} /><Chip label={`Vacant units: ${units.length}`} color="success" variant="outlined" /></Box>
      </Section>

      <Section id="utilities" title="Utility accounts and meters"><Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Register the provider account and, for metered supplies, capture the opening reading. Future readings continue in Facility Management.</Typography><Grid columns={4}><TextField select label="Utility type" value={utilityDraft.type} onChange={e => { const type = e.target.value; setUtilityDraft({ ...utilityDraft, type, unit: type === "water" ? "m³" : type === "gas" ? "m³" : "kWh", supply_mode: type === "electricity" ? utilityDraft.supply_mode : "postpaid" }); }}>{["water","electricity","sewerage","gas","internet"].map(v => <MenuItem key={v} value={v}>{v[0].toUpperCase() + v.slice(1)}</MenuItem>)}</TextField>{utilityDraft.type === "electricity" && <TextField select label="Electricity billing" value={utilityDraft.supply_mode} onChange={e => setUtilityDraft({ ...utilityDraft, supply_mode: e.target.value })}><MenuItem value="prepaid">Prepaid / token</MenuItem><MenuItem value="postpaid">Postpaid / metered</MenuItem></TextField>}<TextField label="Account number" value={utilityDraft.account_no} onChange={e => setUtilityDraft({ ...utilityDraft, account_no: e.target.value })} /><TextField label="Provider" value={utilityDraft.provider} onChange={e => setUtilityDraft({ ...utilityDraft, provider: e.target.value })} /><TextField select label="Bill cycle" value={utilityDraft.bill_cycle} onChange={e => setUtilityDraft({ ...utilityDraft, bill_cycle: e.target.value })}><MenuItem value="monthly">Monthly</MenuItem><MenuItem value="bi_monthly">Every two months</MenuItem><MenuItem value="quarterly">Quarterly</MenuItem><MenuItem value="prepaid">Prepaid</MenuItem></TextField><TextField label="Meter number" value={utilityDraft.meter_code} onChange={e => setUtilityDraft({ ...utilityDraft, meter_code: e.target.value })} /><TextField type="number" label="Opening reading" value={utilityDraft.initial_reading} onChange={e => setUtilityDraft({ ...utilityDraft, initial_reading: e.target.value })} /><TextField type="date" label="Reading date" value={utilityDraft.reading_date} onChange={e => setUtilityDraft({ ...utilityDraft, reading_date: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} /><TextField type="number" label={`Tariff (KES / ${utilityDraft.unit})`} value={utilityDraft.tariff} onChange={e => setUtilityDraft({ ...utilityDraft, tariff: e.target.value })} /><Button variant="outlined" startIcon={<Plus size={16} />} disabled={!utilityDraft.account_no.trim() && !utilityDraft.meter_code.trim()} onClick={() => { setUtilities(rows => [...rows, utilityDraft]); setUtilityDraft(blankUtility); }}>Add utility account</Button></Grid><Box sx={{ mt: 2 }}><RowList rows={utilities} columns={["Type","Billing","Account","Provider","Meter","Opening reading","Bill cycle"]} render={u => [u.type,u.type === "electricity" ? u.supply_mode : "Metered",u.account_no || "—",u.provider || "—",u.meter_code || "—",u.initial_reading ? `${u.initial_reading} ${u.unit}` : "—",u.bill_cycle]} onRemove={i => setUtilities(rows => rows.filter((_, index) => index !== i))} empty="No utility accounts or meters added." /></Box></Section>

      <Section id="assets" title="Assets — property fixtures and equipment"><Box sx={{ display: "flex", justifyContent: "space-between", alignItems: { xs: "stretch", sm: "center" }, flexDirection: { xs: "column", sm: "row" }, gap: 1, mb: 2 }}><Typography variant="body2" color="text.secondary">Register assets individually or import an asset register from CSV.</Typography><Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}><Button size="small" variant="outlined" startIcon={<Download size={15} />} onClick={() => downloadCsv("center-estates-asset-template.csv", [["asset_name","category","location","quantity","status"],["Passenger lift","Vertical transport","Block A","1","active"]])}>Download template</Button><Button size="small" variant="contained" component="label" startIcon={<Upload size={15} />}>Upload asset CSV<input hidden type="file" accept=".csv,text/csv" onChange={event => { void importAssets(event.target.files?.[0]); event.target.value = ""; }} /></Button></Box></Box><Grid columns={5}><TextField label="Asset name" value={assetDraft.name} onChange={e => setAssetDraft({ ...assetDraft, name: e.target.value })} /><TextField label="Category" value={assetDraft.category} onChange={e => setAssetDraft({ ...assetDraft, category: e.target.value })} /><TextField label="Location" value={assetDraft.location} onChange={e => setAssetDraft({ ...assetDraft, location: e.target.value })} /><TextField type="number" label="Quantity" value={assetDraft.quantity} onChange={e => setAssetDraft({ ...assetDraft, quantity: e.target.value })} /><Button variant="outlined" startIcon={<Plus size={16} />} disabled={!assetDraft.name.trim()} onClick={() => { setAssets(rows => [...rows, assetDraft]); setAssetDraft(blankAsset); }}>Add asset</Button></Grid><RowList rows={assets} columns={["Asset","Category","Location","Qty","Status"]} render={a => [a.name,a.category,a.location,a.quantity,a.status]} onRemove={i => setAssets(rows => rows.filter((_, index) => index !== i))} empty="No assets added yet." /></Section>

      <Section id="contacts" title="Property contacts"><Box sx={{ display: "flex", justifyContent: "space-between", alignItems: { xs: "stretch", sm: "center" }, flexDirection: { xs: "column", sm: "row" }, gap: 1, mb: 2 }}><Typography variant="body2" color="text.secondary">Add contacts manually or import an existing directory.</Typography><Box sx={{ display: "flex", gap: 1 }}><Button size="small" variant="outlined" startIcon={<Download size={15} />} onClick={() => downloadCsv("center-estates-contact-template.csv", [["name","role","email","phone"],["Jane Wanjiku","Caretaker","jane@example.com","+254700000000"]])}>Download template</Button><Button size="small" variant="contained" component="label" startIcon={<Upload size={15} />}>Upload contacts<input hidden type="file" accept=".csv,text/csv" onChange={event => { void importContacts(event.target.files?.[0]); event.target.value = ""; }} /></Button></Box></Box><Grid columns={5}><TextField label="Name" value={contactDraft.name} onChange={e => setContactDraft({ ...contactDraft, name: e.target.value })} /><TextField label="Role" value={contactDraft.role} onChange={e => setContactDraft({ ...contactDraft, role: e.target.value })} /><TextField type="email" label="Email" value={contactDraft.email} onChange={e => setContactDraft({ ...contactDraft, email: e.target.value })} /><TextField label="Phone" value={contactDraft.phone} onChange={e => setContactDraft({ ...contactDraft, phone: e.target.value })} /><Button variant="outlined" startIcon={<Plus size={16} />} disabled={!contactDraft.name.trim()} onClick={() => { setContacts(rows => [...rows, contactDraft]); setContactDraft(blankContact); }}>Add contact</Button></Grid><RowList rows={contacts} columns={["Name","Role","Email","Phone"]} render={c => [c.name,c.role,c.email,c.phone]} onRemove={i => setContacts(rows => rows.filter((_, index) => index !== i))} empty="No contacts added." /></Section>

      <Section id="providers" title="Service providers"><Box sx={{ display: "flex", justifyContent: "space-between", alignItems: { xs: "stretch", sm: "center" }, flexDirection: { xs: "column", sm: "row" }, gap: 1, mb: 2 }}><Typography variant="body2" color="text.secondary">Import contractors and service companies or add them individually.</Typography><Box sx={{ display: "flex", gap: 1 }}><Button size="small" variant="outlined" startIcon={<Download size={15} />} onClick={() => downloadCsv("center-estates-service-provider-template.csv", [["provider_name","service","contact_person","email","phone"],["Coast Lifts Ltd","Lift maintenance","John Doe","service@example.com","+254700000000"]])}>Download template</Button><Button size="small" variant="contained" component="label" startIcon={<Upload size={15} />}>Upload providers<input hidden type="file" accept=".csv,text/csv" onChange={event => { void importProviders(event.target.files?.[0]); event.target.value = ""; }} /></Button></Box></Box><Grid columns={5}><TextField label="Provider name" value={providerDraft.name} onChange={e => setProviderDraft({ ...providerDraft, name: e.target.value })} /><TextField label="Service" value={providerDraft.service} onChange={e => setProviderDraft({ ...providerDraft, service: e.target.value })} /><TextField label="Contact person" value={providerDraft.contact} onChange={e => setProviderDraft({ ...providerDraft, contact: e.target.value })} /><TextField type="email" label="Email" value={providerDraft.email} onChange={e => setProviderDraft({ ...providerDraft, email: e.target.value })} /><TextField label="Phone" value={providerDraft.phone} onChange={e => setProviderDraft({ ...providerDraft, phone: e.target.value })} /><Button variant="outlined" startIcon={<Plus size={16} />} disabled={!providerDraft.name.trim() || !providerDraft.service.trim()} onClick={() => { setProviders(rows => [...rows, providerDraft]); setProviderDraft(blankProvider); }}>Add provider</Button></Grid><RowList rows={providers} columns={["Provider","Service","Contact","Email","Phone"]} render={p => [p.name,p.service,p.contact,p.email,p.phone]} onRemove={i => setProviders(rows => rows.filter((_, index) => index !== i))} empty="No service providers added." /></Section>

      <Section id="landlord" title="Landlord engagement and terms"><Grid><TextField select label="Engagement type" value={values.engagement_type || "management"} onChange={set("engagement_type")}><MenuItem value="management">Property management</MenuItem><MenuItem value="letting">Letting only</MenuItem><MenuItem value="facility">Facility management</MenuItem><MenuItem value="full_service">Full service</MenuItem></TextField><TextField type="date" label="Agreement start" value={values.engagement_start || ""} onChange={set("engagement_start")} slotProps={{ inputLabel: { shrink: true } }} /><TextField type="date" label="Agreement end" value={values.engagement_end || ""} onChange={set("engagement_end")} slotProps={{ inputLabel: { shrink: true } }} /><TextField type="number" label="Management fee (%)" value={values.management_fee || ""} onChange={set("management_fee")} /><TextField sx={{ gridColumn: { md: "span 2" } }} label="Payment terms" value={values.payment_terms || ""} onChange={set("payment_terms")} /></Grid></Section>

      <Section id="documents" title="Documents register"><Alert severity="info" sx={{ mb: 2 }}>Files are uploaded to the secure document store after the property is created. A failed file upload is reported and can be retried without recreating the property.</Alert><Grid columns={5}><TextField label="Document name" value={documentDraft.name} onChange={e => setDocumentDraft({ ...documentDraft, name: e.target.value })} /><TextField select label="Type" value={documentDraft.type} onChange={e => setDocumentDraft({ ...documentDraft, type: e.target.value })}><MenuItem value="title">Title</MenuItem><MenuItem value="management_agreement">Management agreement</MenuItem><MenuItem value="tax">Tax document</MenuItem><MenuItem value="insurance">Insurance</MenuItem><MenuItem value="other">Other</MenuItem></TextField><TextField label="Reference" value={documentDraft.reference} onChange={e => setDocumentDraft({ ...documentDraft, reference: e.target.value })} /><TextField type="date" label="Expiry date" value={documentDraft.expires_on} onChange={e => setDocumentDraft({ ...documentDraft, expires_on: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} /><Button variant="outlined" component="label" startIcon={<Upload size={16} />}>{documentDraft.file?.name || "Choose file"}<input hidden type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" onChange={event => setDocumentDraft({ ...documentDraft, file: event.target.files?.[0] ?? null })} /></Button><Button variant="outlined" startIcon={<Plus size={16} />} disabled={!documentDraft.name.trim() || !documentDraft.file} onClick={() => { setDocuments(rows => [...rows, documentDraft]); setDocumentDraft(blankDocument); }}>Add document</Button></Grid><RowList rows={documents} columns={["Name","Type","File","Reference","Expires"]} render={d => [d.name,d.type,d.file?.name || "—",d.reference,d.expires_on || "—"]} onRemove={i => setDocuments(rows => rows.filter((_, index) => index !== i))} empty="No documents selected for upload." /></Section>

      <Section id="notes" title="Notes"><TextField fullWidth multiline minRows={5} label="Onboarding notes" value={values.notes || ""} onChange={set("notes")} /><Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(5, 1fr)" }, gap: 2, mt: 3, color: "text.secondary" }}><Box><Typography variant="caption">Created by</Typography><Typography variant="body2" color="text.primary">{session?.user.firstName || session?.user.username || "—"}</Typography></Box><Box><Typography variant="caption">Created date</Typography><Typography variant="body2" color="text.primary">On save</Typography></Box><Box><Typography variant="caption">Last modified by</Typography><Typography variant="body2" color="text.primary">—</Typography></Box><Box><Typography variant="caption">Last modified date</Typography><Typography variant="body2" color="text.primary">—</Typography></Box><Box><Typography variant="caption">Status</Typography><Box><Chip size="small" label="Draft" /></Box></Box></Box></Section>
    </Box>
    <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1.5, py: 3 }}><Button variant="outlined" onClick={() => router.push("/workspaces")}>Cancel</Button><Button variant="contained" startIcon={<Save size={17} />} disabled={saving} onClick={() => void save()}>{saving ? "Saving…" : "Save & Close"}</Button></Box>
  </Box>;
}
