"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Alert, Box, Button, Chip, Divider, FormControlLabel, IconButton,
  LinearProgress, MenuItem, Paper, Switch, Tab, Tabs, TextField, Typography,
} from "@mui/material";
import { ArrowLeft, Download, Plus, Save, Trash2, Upload, Zap } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api";
import { useFormDraft } from "@/lib/form-drafts";
import { usePropertyContext } from "@/lib/property-context";
import { useToast } from "@/components/monitoring/hooks/useToast";
import { DraftBanner } from "@/components/draft-banner";
import { csvCell as cell, csvColumn as headerIndex, normalizeCsvHeader, normalizeDateString, parseCsv } from "@/lib/csv";
import { UnitFloorPlanCanvas, type Point, type UnitLayout } from "@/features/property/components/floorplan/UnitFloorPlanCanvas";

type Values = Record<string, string>;
type UnitDraft = { unit_no: string; unit_type: string; floor: string; use: string; area: string; rateable_area: string; service_charge_rate: string; description: string; building_index: string; polygon?: Point[] };
type UnitImportRow = UnitDraft & { sourceRow: number; errors: Partial<Record<keyof UnitDraft, string>> };
type UtilityDraft = { type: string; account_no: string; location: string; bill_cycle: string; status: string; meter_code: string; supply_mode: string; tariff: string; unit: string; unit_code: string };
type AssetDraft = { name: string; category: string; location: string; quantity: string; status: string };
type ContactDraft = { name: string; role: string; email: string; phone: string };
type ProviderDraft = { name?: string; category: string; service: string; frequency: string; criticality: string; scope?: string; monthly_cost?: string; contact?: string; email?: string; phone?: string };
type DocumentDraft = { name: string; type: string; reference: string; expires_on: string; file: File | null };
type BuildingDraft = { id?: string; name: string; floors: string; floor_numbers: string; use: string; access_points: string; parking_spaces: string; amenities: string };

const blankUnit: UnitDraft = { unit_no: "", unit_type: "", floor: "", use: "", area: "", rateable_area: "", service_charge_rate: "0", description: "", building_index: "" };
const blankUtility: UtilityDraft = { type: "water", account_no: "", location: "", bill_cycle: "monthly", status: "active", meter_code: "", supply_mode: "postpaid", tariff: "0", unit: "m³", unit_code: "" };

const blankAsset: AssetDraft = { name: "", category: "", location: "", quantity: "1", status: "active" };
const blankContact: ContactDraft = { name: "", role: "", email: "", phone: "" };
const blankProvider: ProviderDraft = { name: "", category: "Security & Guarding", service: "", frequency: "monthly", criticality: "medium", scope: "", monthly_cost: "0", contact: "", email: "", phone: "" };
const blankDocument: DocumentDraft = { name: "", type: "title", reference: "", expires_on: "", file: null };
const blankBuilding: BuildingDraft = { name: "", floors: "1", floor_numbers: "", use: "", access_points: "", parking_spaces: "0", amenities: "" };
const initialValues: Values = { status: "draft", property_type: "commercial", landlord_type: "individual", country: "KE", currency: "KES", building_count: "1", floors: "1", parking_spaces: "0", tax_status: "resident", title_type: "freehold", engagement_type: "management", management_fee_basis: "percent_collections" };


function normalizeNumber(value: string) {
  return value.replace(/[\s,]/g, "").trim();
}

function validateUnitImport(rows: UnitImportRow[], existing: UnitDraft[]) {
  const seen = new Set(existing.map((unit) => unit.unit_no.trim().toLowerCase()));
  return rows.map((row) => {
    const errors: UnitImportRow["errors"] = {};
    const code = row.unit_no.trim().toLowerCase();
    if (!code) errors.unit_no = "Unit number is required.";
    else if (seen.has(code)) errors.unit_no = "Duplicate unit number.";
    else seen.add(code);
    if (!row.unit_type.trim()) errors.unit_type = "Unit type is required.";
    if (!row.floor.trim()) errors.floor = "Floor is required.";
    if (!row.use.trim()) errors.use = "Use is required.";
    const area = Number(normalizeNumber(row.area));
    const rateableArea = Number(normalizeNumber(row.rateable_area));
    if (!normalizeNumber(row.area) || !Number.isFinite(area) || area <= 0) errors.area = "Enter a positive area.";
    if (row.rateable_area && (!Number.isFinite(rateableArea) || rateableArea < 0)) errors.rateable_area = "Enter zero or a positive rateable area.";
    return { ...row, errors };
  });
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
}

const sections = [
  ["general", "General"], ["location", "Location"], ["buildings", "Buildings"], ["units", "Units"], ["assets", "Assets"],
  ["utilities", "Utilities"], ["contacts", "Contacts"], ["providers", "Service Profiles & Lines"],
  ["landlord", "Landlord Engagement & Terms"], ["documents", "Documents"], ["notes", "Notes"],
] as const;

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return <Paper className="onboarding-section" role="tabpanel" id={id} aria-labelledby={`onboarding-tab-${id}`} variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}><Typography variant="overline" color="primary" sx={{ fontWeight: 800 }}>{title}</Typography><Box sx={{ mt: 1.25 }}>{children}</Box></Paper>;
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
  const [unitImportRows, setUnitImportRows] = useState<UnitImportRow[]>([]);
  const [unitImportFile, setUnitImportFile] = useState("");
  const [utilities, setUtilities, clearUtilities, utilitiesRestored] = useFormDraft<UtilityDraft[]>("property-onboarding:utilities", [], draftScope);
  const [utilityDraft, setUtilityDraft] = useState<UtilityDraft>(blankUtility);

  // Bulk Unit Meter Allocator State
  const [bulkUtilityType, setBulkUtilityType] = useState("water");
  const [bulkMeterPrefix, setBulkMeterPrefix] = useState("MTR-WTR-");
  const [bulkMeterLocation, setBulkMeterLocation] = useState("Floor Corridor");
  const [bulkUtilityTariff, setBulkUtilityTariff] = useState("200");
  const [bulkSupplyMode, setBulkSupplyMode] = useState("postpaid");
  const [bulkBillCycle, setBulkBillCycle] = useState("monthly");

  const autoAllocateUnitMeters = () => {
    if (units.length === 0) {
      setError("Please create or generate units in the 'Units' tab first before auto-allocating meters.");
      jump("units");
      return;
    }
    const newUtilities: UtilityDraft[] = units.map(u => ({
      type: bulkUtilityType,
      meter_code: `${bulkMeterPrefix}${u.unit_no}`,
      unit_code: u.unit_no,
      location: bulkMeterLocation ? `${bulkMeterLocation} (Unit ${u.unit_no})` : `Outside Unit ${u.unit_no}`,
      account_no: "",
      tariff: bulkUtilityTariff || "0",
      unit: bulkUtilityType === "water" ? "m³" : bulkUtilityType === "gas" ? "m³" : "kWh",
      bill_cycle: bulkBillCycle,
      supply_mode: bulkUtilityType === "electricity" ? bulkSupplyMode : "postpaid",
      status: "active",
    }));
    setUtilities(prev => {
      const existingMeterCodes = new Set(prev.map(p => p.meter_code.trim().toUpperCase()));
      const toAdd = newUtilities.filter(n => !existingMeterCodes.has(n.meter_code.trim().toUpperCase()));
      return [...prev, ...toAdd];
    });
    setError("");
  };

  const [assets, setAssets, clearAssets, assetsRestored] = useFormDraft<AssetDraft[]>("property-onboarding:assets", [], draftScope);
  const [assetDraft, setAssetDraft] = useState<AssetDraft>(blankAsset);
  const [contacts, setContacts, clearContacts, contactsRestored] = useFormDraft<ContactDraft[]>("property-onboarding:contacts", [], draftScope);
  const [contactDraft, setContactDraft] = useState<ContactDraft>(blankContact);
  const [providers, setProviders, clearProviders, providersRestored] = useFormDraft<ProviderDraft[]>("property-onboarding:providers", [], draftScope);
  const [providerDraft, setProviderDraft] = useState<ProviderDraft>(blankProvider);
  const [documents, setDocuments] = useState<DocumentDraft[]>([]);
  const [documentDraft, setDocumentDraft] = useState<DocumentDraft>(blankDocument);
  const [buildings, setBuildings, clearBuildings, buildingsRestored] = useFormDraft<BuildingDraft[]>("property-onboarding:buildings", [], draftScope);
  const [buildingDraft, setBuildingDraft] = useState<BuildingDraft>(blankBuilding);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(""), 12000);
    return () => clearTimeout(timer);
  }, [error]);


  const restoredDraft = valuesRestored || unitsRestored || utilitiesRestored || assetsRestored || contactsRestored || providersRestored;
  const clearDraft = () => { clearValues(); clearUnits(); clearBuildings(); clearUtilities(); clearAssets(); clearContacts(); clearProviders(); };
  const readiness = useMemo(() => {
    const checks = [
      { section: "general", label: "Property name", complete: Boolean(values.name?.trim()) },
      { section: "general", label: "Landlord", complete: Boolean(values.landlord_name?.trim()) },
      { section: "location", label: "Physical address", complete: Boolean(values.address?.trim() && values.city?.trim() && values.county?.trim()) },
      { section: "buildings", label: "Building details", complete: buildings.length > 0 || Boolean(values.floors) },
      { section: "units", label: "At least one unit", complete: units.length > 0 },
      { section: "utilities", label: "Utility accounts", complete: utilities.length > 0 },
      { section: "contacts", label: "Property contact", complete: contacts.some(contact => Boolean(contact.name && (contact.email || contact.phone))) },
      { section: "providers", label: "Service line", complete: providers.some(provider => Boolean(provider.service || provider.name)) },
      { section: "documents", label: "Property document", complete: documents.length > 0 },
    ];
    const completed = checks.filter(check => check.complete).length;
    return { checks, completed, score: Math.round((completed / checks.length) * 100), missing: checks.filter(check => !check.complete) };
  }, [buildings.length, contacts, documents.length, providers, units.length, utilities.length, values]);

  useEffect(() => {
    if (!editId) return;
    let active = true;
    apiFetch(`/property/properties/${editId}/`, { headers: { "X-Property-Scope": "portfolio" } }, organizationId)
      .then(async (res) => {
        if (active && res.ok) {
          const prop = await res.json();
          const meta = prop.metadata || {};
          setValues((curr) => ({
            ...curr,
            name: prop.name || "",
            code: prop.code || "",
            property_type: prop.property_type || "commercial",
            address: prop.address || "",
            city: prop.city || "",
            country: prop.country || "KE",
            status: prop.status || "active",
            category: meta.category || "",
            lr_number: meta.lr_number || "",
            pin_number: meta.pin_number || "",
            year_built: meta.year_built ? String(meta.year_built) : "",
            title_type: meta.title_type || "freehold",
            land_size: meta.land_size_sqft ? String(meta.land_size_sqft) : "",
            built_up_area: meta.built_up_area_sqft ? String(meta.built_up_area_sqft) : "",
            description: meta.description || "",
            currency: meta.currency || "KES",
            landlord_name: meta.landlord?.name || prop.landlord_name || "Landlord",
            landlord_type: meta.landlord?.type || "individual",
            landlord_pin: meta.landlord?.pin || "",
            landlord_registration: meta.landlord?.registration_number || "",
            tax_status: meta.landlord?.tax_status || "resident",
            vat_number: meta.landlord?.vat_number || "",
            county: meta.location?.county || prop.city || "Nairobi",
            postal_address: meta.location?.postal_address || "",
            postal_code: meta.location?.postal_code || "",
            floor_numbers: meta.building?.floor_numbers || "",
            building_use: meta.building?.use || "",
            access_points: meta.building?.access_points || "",
            parking_spaces: String(meta.building?.parking_spaces ?? "0"),
            amenities: meta.building?.amenities || "",
            engagement_type: meta.landlord_engagement?.engagement_type || "management",
            engagement_start: meta.landlord_engagement?.starts_on || "",
            engagement_end: meta.landlord_engagement?.ends_on || "",
            management_fee_basis: meta.landlord_engagement?.management_fee_basis || (meta.landlord_engagement?.engagement_type === "facility" ? "flat_monthly" : meta.landlord_engagement?.engagement_type === "sectional" ? "per_unit" : "percent_collections"),
            management_fee: meta.landlord_engagement?.management_fee_rate ? String(meta.landlord_engagement.management_fee_rate) : (meta.landlord_engagement?.management_fee_percent ? String(meta.landlord_engagement.management_fee_percent) : ""),
            letting_fee_type: meta.landlord_engagement?.letting_fee_type || "one_month_rent",
            letting_fee_rate: meta.landlord_engagement?.letting_fee_rate ? String(meta.landlord_engagement.letting_fee_rate) : "",
            payment_terms: meta.landlord_engagement?.payment_terms || "",
            notes: prop.notes || meta.notes || "",
          }));
          if (meta.landlord?.vat_registered) setVatRegistered(true);

          // The detail endpoint includes the persisted setup records.  Loading
          // them before an edit keeps a later save additive rather than making
          // an existing property look empty in the onboarding card.
          if (Array.isArray(prop.buildings)) {
            setBuildings(prop.buildings.map((b: any) => ({
              id: b.id,
              name: b.name || "", floors: String(b.floors || "1"),
              floor_numbers: b.metadata?.floor_numbers || "", use: b.metadata?.use || "",
              access_points: b.metadata?.access_points || "", parking_spaces: String(b.metadata?.parking_spaces || "0"),
              amenities: b.metadata?.amenities || "",
            })));
          }

          // Populate Service Providers / Service Lines
          const savedProviders = meta.service_providers || [];
          if (Array.isArray(savedProviders) && savedProviders.length > 0) {
            setProviders(savedProviders.map((p: any) => ({
              category: p.category || "General Maintenance",
              service: p.service || p.service_name || p.name || "",
              frequency: p.frequency || "monthly",
              criticality: p.criticality || "medium",
              scope: p.scope || p.coverage || "",
              name: p.name || p.provider_name || "",
              monthly_cost: String(p.monthly_cost || p.cost || "0"),
              contact: p.contact || p.contact_person || "",
              email: p.email || "",
              phone: p.phone || "",
            })));
          }

          // Populate Utilities
          const savedUtilities = meta.utilities || [];
          if (Array.isArray(savedUtilities) && savedUtilities.length > 0) {
            setUtilities(savedUtilities.map((u: any) => ({
              type: u.type || "water",
              supply_mode: u.supply_mode || "postpaid",
              account_no: u.account_no || "",
              location: u.location || "",
              bill_cycle: u.bill_cycle || "monthly",
              status: u.status || "active",
              meter_code: u.meter_code || "",
              tariff: String(u.tariff || "0"),
              unit: u.unit || (u.type === "electricity" ? "kWh" : "m³"),
              unit_code: u.unit_code || "",
            })));
          }


          // Populate Assets
          const savedAssets = meta.assets || [];
          if (Array.isArray(savedAssets) && savedAssets.length > 0) {
            setAssets(savedAssets.map((a: any) => ({
              name: a.name || "",
              category: a.category || "",
              location: a.location || "",
              quantity: String(a.quantity || "1"),
              status: a.status || "active",
            })));
          }

          // Populate Contacts
          const savedContacts = meta.contacts || [];
          if (Array.isArray(savedContacts) && savedContacts.length > 0) {
            setContacts(savedContacts.map((c: any) => ({
              name: c.name || "",
              role: c.role || "",
              email: c.email || "",
              phone: c.phone || "",
            })));
          }

          // Populate Units
          if (Array.isArray(prop.units) && prop.units.length > 0) {
            setUnits(prop.units.map((u: any) => ({
              unit_no: u.unit_no || u.code || "",
              unit_type: u.unit_type || "commercial",
              floor: String(u.floor || "1"),
              use: u.use || "Office",
              area: String(u.area || "500"),
              rateable_area: String(u.rateable_area || u.area || "500"),
              service_charge_rate: String(u.service_charge_rate || u.metadata?.billing_setup?.service_charge_rate || "0"),
              description: u.description || "",
              building_index: "0",
            })));
          }
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, [editId, organizationId, setValues, setUnits, setBuildings, setProviders, setUtilities, setAssets, setContacts]);

  const set = (name: string) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (error) setError("");
    setValues(current => ({ ...current, [name]: event.target.value }));
  };

  const totalArea = useMemo(() => units.reduce((sum, unit) => sum + Number(unit.area || 0), 0), [units]);


  const jump = (id: string) => {
    setSection(id);
    document.querySelector(".property-onboarding-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  const addBuilding = () => {
    if (!buildingDraft.name.trim()) {
      setError("Building name is required."); return;
    }
    if (!Number(buildingDraft.floors) || Number(buildingDraft.floors) < 1) {
      setError("Number of floors must be at least 1."); return;
    }
    if (buildings.some(b => b.name.trim().toLowerCase() === buildingDraft.name.trim().toLowerCase())) {
      setError("Building names must be unique within the property."); return;
    }
    setBuildings(current => [...current, buildingDraft]); setBuildingDraft(blankBuilding); setError("");
  };

  const removeBuilding = async (index: number) => {
    const building = buildings[index];
    if (!building) return;
    if (!building.id) {
      setBuildings(rows => rows.filter((_, rowIndex) => rowIndex !== index));
      return;
    }
    if (!window.confirm(`Delete ${building.name}? This is only available while it has no units.`)) return;
    const response = await apiFetch(`/property/buildings/${building.id}/`, { method: "DELETE" }, organizationId);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body?.detail || "This building could not be deleted. Buildings with units are protected.");
      return;
    }
    setBuildings(rows => rows.filter((_, rowIndex) => rowIndex !== index));
    toast.success(`${building.name} was removed.`);
  };

  const importUnits = async (file?: File) => {
    if (!file) return;
    const rows = parseCsv(await file.text());
    const headers = (rows.shift() ?? []).map(normalizeCsvHeader);
    const columns = {
      unit_no: headerIndex(headers, ["unit_no", "unit_number", "unit_code", "unit", "code"]),
      unit_type: headerIndex(headers, ["unit_type", "type", "typology"]),
      floor: headerIndex(headers, ["floor", "floor_number", "floor_name", "level"]),
      use: headerIndex(headers, ["use", "unit_use", "purpose"]),
      area: headerIndex(headers, ["area", "area_sq_ft", "area_sqft", "size", "sqft"]),
      rateable_area: headerIndex(headers, ["rateable_area", "rateable_area_sq_ft", "rateable_area_sqft"]),
      building_index: headerIndex(headers, ["building_number", "building_index", "building"]),
      description: headerIndex(headers, ["description", "notes"]),
      service_charge_rate: headerIndex(headers, ["service_charge_rate", "service_charge_per_sqft", "sc_rate"]),
    };

    if (columns.unit_no < 0) {
      setError("Unit CSV must contain a unit column (e.g. unit_no, unit_code, or unit). Download the template for reference.");
      jump("units"); return;
    }

    const deriveFloor = (code: string) => {
      const c = code.toUpperCase();
      if (c.includes("GR") || c.startsWith("G-") || c.startsWith("G/")) return "Ground";
      if (c.includes("MZ") || c.includes("MEZZ")) return "Mezzanine";
      if (c.includes("BS") || c.includes("BASE")) return "Basement";
      const match = code.match(/(?:FL|FLOOR|LEVEL|L|F)?\s*(\d+)/i);
      return match ? match[1] : "1";
    };

    const imported: UnitDraft[] = rows
      .map(row => {
        const uNo = cell(row, columns.unit_no).trim();
        if (!uNo) return null;
        const uType = (columns.unit_type >= 0 ? cell(row, columns.unit_type) : "") || "Commercial";
        const rawFloor = (columns.floor >= 0 ? cell(row, columns.floor) : "") || deriveFloor(uNo);
        const uUse = (columns.use >= 0 ? cell(row, columns.use) : "") || "Commercial";
        const rawArea = (columns.area >= 0 ? cell(row, columns.area) : "") || "1000";
        return {
          unit_no: uNo,
          unit_type: uType,
          floor: rawFloor,
          use: uUse,
          area: normalizeNumber(rawArea),
          rateable_area: columns.rateable_area >= 0 ? normalizeNumber(cell(row, columns.rateable_area)) : "",
          building_index: columns.building_index >= 0 ? cell(row, columns.building_index) : "",
          description: columns.description >= 0 ? cell(row, columns.description) : "",
          service_charge_rate: columns.service_charge_rate >= 0 ? normalizeNumber(cell(row, columns.service_charge_rate)) : "0",
        };
      })
      .filter((u): u is UnitDraft => u !== null);

    if (!imported.length) { setError("The CSV file contains no data rows. Ensure at least one unit row is present."); jump("units"); return; }
    if (imported.length + units.length > 500) { setError(`Importing ${imported.length} units would exceed the 500-unit limit (currently ${units.length} units). Reduce the batch size.`); jump("units"); return; }
    const preview = validateUnitImport(imported.map((unit, index) => ({ ...unit, sourceRow: index + 2, errors: {} })), units);
    setUnitImportRows(preview);
    setUnitImportFile(file.name);
    const errorCount = preview.filter((row) => Object.keys(row.errors).length).length;
    setError(errorCount ? `${errorCount} row(s) need attention. Correct the highlighted cells in the preview before importing.` : "");
    jump("units");
  };

  const editUnitImport = (index: number, field: keyof UnitDraft, value: string) => {
    setUnitImportRows((current) => {
      const next = validateUnitImport(current.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row), units);
      const errorCount = next.filter((row) => Object.keys(row.errors).length).length;
      setError(errorCount ? `${errorCount} row(s) need attention. Correct the highlighted cells in the preview before importing.` : "");
      return next;
    });
  };

  const applyUnitImport = () => {
    const validated = validateUnitImport(unitImportRows, units);
    setUnitImportRows(validated);
    const invalid = validated.filter((row) => Object.keys(row.errors).length);
    if (invalid.length) {
      setError(`${invalid.length} row(s) still contain errors. Correct every highlighted cell before importing.`);
      window.requestAnimationFrame(() => {
        const firstError = document.querySelector<HTMLElement>('[data-unit-import-error="true"] input');
        firstError?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
        firstError?.focus();
      });
      return;
    }
    setUnits((current) => [...current, ...validated.map((row) => ({
      unit_no: row.unit_no,
      unit_type: row.unit_type,
      floor: row.floor,
      use: row.use,
      area: normalizeNumber(row.area),
      rateable_area: normalizeNumber(row.rateable_area),
      building_index: row.building_index,
      description: row.description,
      service_charge_rate: normalizeNumber(row.service_charge_rate),
    }))]);
    setUnitImportRows([]); setUnitImportFile(""); setError("");
    toast.success(`${validated.length} units were validated and added to this property draft.`);
  };

  const importAssets = async (file?: File) => {
    if (!file) return;
    const rows = parseCsv(await file.text());
    const expected = ["asset_name", "category", "location", "quantity", "status"];
    const headers = (rows.shift() ?? []).map(normalizeCsvHeader);
    if (expected.some((header, index) => headers[index] !== header)) {
      setError(`Asset CSV columns must be: ${expected.join(", ")}.`); jump("assets"); return;
    }
    const imported: AssetDraft[] = rows.map(row => ({ name: row[0] ?? "", category: row[1] ?? "", location: row[2] ?? "", quantity: row[3] ?? "1", status: (row[4] || "active").toLowerCase() }));
    const nameless = imported.filter(asset => !asset.name);
    const badQty = imported.filter(asset => !Number(asset.quantity) || Number(asset.quantity) <= 0);
    const badStatus = imported.filter(asset => !["active", "inactive", "maintenance"].includes(asset.status));
    if (!imported.length) { setError("The asset CSV file contains no data rows. Ensure at least one asset row is present."); jump("assets"); return; }
    if (nameless.length) { setError(`${nameless.length} asset row(s) are missing a name. Every asset must have a name.`); jump("assets"); return; }
    if (badQty.length) { setError(`Asset "${badQty[0].name}" has an invalid quantity. Quantity must be a positive number.`); jump("assets"); return; }
    if (badStatus.length) { setError(`Asset "${badStatus[0].name}" has an invalid status. Allowed: active, inactive, maintenance.`); jump("assets"); return; }
    if (imported.length + assets.length > 500) { setError(`Importing ${imported.length} assets would exceed the 500-asset limit (currently ${assets.length}).`); jump("assets"); return; }
    setAssets(current => [...current, ...imported]); setError("");
  };

  const importContacts = async (file?: File) => {
    if (!file) return;
    const rows = parseCsv(await file.text());
    const expected = ["name", "role", "email", "phone"];
    const headers = (rows.shift() ?? []).map(normalizeCsvHeader);
    if (expected.some((header, index) => headers[index] !== header)) { setError(`Contact CSV columns must be: ${expected.join(", ")}.`); jump("contacts"); return; }
    const imported = rows.map(row => ({ name: row[0] ?? "", role: row[1] ?? "", email: row[2] ?? "", phone: row[3] ?? "" }));
    const noName = imported.filter(c => !c.name);
    const noContact = imported.filter(c => !c.email && !c.phone);
    if (!imported.length) { setError("The contacts CSV file contains no data rows."); jump("contacts"); return; }
    if (noName.length) { setError(`${noName.length} contact(s) are missing a name. Every contact must have a name.`); jump("contacts"); return; }
    if (noContact.length) { setError(`Contact "${noContact[0].name}" is missing both email and phone. At least one is required.`); jump("contacts"); return; }
    if (imported.length + contacts.length > 500) { setError(`Importing ${imported.length} contacts would exceed the 500-contact limit (currently ${contacts.length}).`); jump("contacts"); return; }
    setContacts(current => [...current, ...imported]); setError("");
  };

  const importProviders = async (file?: File) => {
    if (!file) return;
    const rows = parseCsv(await file.text());
    if (rows.length < 2) { setError("The service line CSV file contains no data rows."); jump("providers"); return; }
    rows.shift(); // skip header
    const imported: ProviderDraft[] = rows.map(row => ({
      service: row[0] ?? "",
      category: row[1] || "General Maintenance",
      frequency: row[2] || "monthly",
      criticality: row[3] || "medium",
      scope: row[4] || "",
      monthly_cost: row[5] || "0",
      name: row[6] || "",
      contact: row[7] || "",
      email: row[8] || "",
      phone: row[9] || "",
    }));
    const noService = imported.filter(p => !p.service && !p.name);
    if (!imported.length) { setError("The service line CSV file contains no data rows."); jump("providers"); return; }
    if (noService.length) { setError(`${noService.length} service line(s) are missing a name.`); jump("providers"); return; }
    if (imported.length + providers.length > 500) { setError(`Importing ${imported.length} service lines would exceed the 500 limit (currently ${providers.length}).`); jump("providers"); return; }
    setProviders(current => [...current, ...imported]); setError("");
  };


  const importUtilities = async (file?: File) => {
    if (!file) return;
    const rows = parseCsv(await file.text());
    const headers = (rows.shift() ?? []).map(normalizeCsvHeader);
    const isNewSchema = headers.includes("meter_location") || headers.includes("location");

    const imported: UtilityDraft[] = rows.map(row => {
      if (isNewSchema) {
        const typeIdx = headers.indexOf("utility_type") !== -1 ? headers.indexOf("utility_type") : 0;
        const unitIdx = headers.indexOf("unit_code") !== -1 ? headers.indexOf("unit_code") : headers.indexOf("unit") !== -1 ? headers.indexOf("unit") : 1;
        const meterIdx = headers.indexOf("meter_number") !== -1 ? headers.indexOf("meter_number") : headers.indexOf("meter_code") !== -1 ? headers.indexOf("meter_code") : 2;
        const locIdx = headers.indexOf("meter_location") !== -1 ? headers.indexOf("meter_location") : headers.indexOf("location") !== -1 ? headers.indexOf("location") : 3;
        const accIdx = headers.indexOf("account_number") !== -1 ? headers.indexOf("account_number") : headers.indexOf("account_no") !== -1 ? headers.indexOf("account_no") : 4;
        const tariffIdx = headers.indexOf("tariff") !== -1 ? headers.indexOf("tariff") : 5;
        const cycleIdx = headers.indexOf("bill_cycle") !== -1 ? headers.indexOf("bill_cycle") : 6;
        const modeIdx = headers.indexOf("supply_mode") !== -1 ? headers.indexOf("supply_mode") : 7;
        const statusIdx = headers.indexOf("status") !== -1 ? headers.indexOf("status") : 8;

        const uType = (row[typeIdx] || "water").toLowerCase();
        return {
          type: uType,
          unit_code: row[unitIdx] || "",
          meter_code: row[meterIdx] || "",
          location: row[locIdx] || "",
          account_no: row[accIdx] || "",
          tariff: row[tariffIdx] || "0",
          unit: uType === "electricity" ? "kWh" : "m³",
          bill_cycle: row[cycleIdx] || "monthly",
          supply_mode: row[modeIdx] || "postpaid",
          status: (row[statusIdx] || "active").toLowerCase(),
        };
      } else {
        const uType = (row[0] || "water").toLowerCase();
        return {
          type: uType,
          supply_mode: (row[1] || "postpaid").toLowerCase(),
          account_no: row[2] ?? "",
          bill_cycle: row[4] || "monthly",
          meter_code: row[5] ?? "",
          location: "",
          tariff: row[8] || "0",
          unit: row[9] || (uType === "electricity" ? "kWh" : "m³"),
          status: (row[10] || "active").toLowerCase(),
          unit_code: row[11] ?? "",
        };
      }
    });

    const validTypes = ["water", "electricity", "sewerage", "gas", "internet"];
    const invalidType = imported.find(utility => !validTypes.includes(utility.type));
    const missingAccount = imported.find(utility => !utility.account_no && !utility.meter_code);
    const badTariff = imported.find(utility => Number(utility.tariff) < 0);
    if (!imported.length) { setError("The utility CSV file contains no data rows. Ensure at least one utility row is present."); jump("utilities"); return; }
    if (invalidType) { setError(`Utility type "${invalidType.type}" is not valid. Allowed types: ${validTypes.join(", ")}.`); jump("utilities"); return; }
    if (missingAccount) { setError(`Utility "${missingAccount.type}" is missing both account number and meter number. At least one is required.`); jump("utilities"); return; }
    if (badTariff) { setError(`Utility "${badTariff.type}" has a negative tariff value. Tariff must be zero or positive.`); jump("utilities"); return; }
    if (imported.length + utilities.length > 200) { setError(`Importing ${imported.length} utilities would exceed the 200-account limit (currently ${utilities.length}). Reduce the batch size.`); jump("utilities"); return; }
    setUtilities(current => [...current, ...imported]); setError("");
  };


  const save = async () => {
    if (!organizationId) return;
    if (!values.name?.trim() || !values.landlord_name?.trim() || !values.address?.trim() || !values.city?.trim() || !values.county?.trim()) {
      setError("Complete all required property, landlord and address fields before saving."); jump("general"); return;
    }
    setSaving(true); setError("");
    const buildingList = buildings.length > 0
      ? buildings.map(b => ({ name: b.name, floors: Number(b.floors || 1), floor_numbers: b.floor_numbers, use: b.use, access_points: b.access_points, parking_spaces: Number(b.parking_spaces || 0), amenities: b.amenities }))
      : [{ name: "Main Building", floors: Number(values.floors || 1), floor_numbers: values.floor_numbers || "", use: values.building_use || "", access_points: values.access_points || "", parking_spaces: Number(values.parking_spaces || 0), amenities: values.amenities || "" }];
    const badBuilding = units.find(u => {
      const idx = Number(u.building_index);
      if (!idx) return false;
      return idx < 1 || idx > buildingList.length;
    });
    if (badBuilding) {
      setError(`Unit "${badBuilding.unit_no}" references building #${badBuilding.building_index}, but only ${buildingList.length} building(s) exist. Use building number 1–${buildingList.length} or leave blank.`);
      jump("units"); setSaving(false); return;
    }
    const metadata = {
      category: values.category || "", lr_number: values.lr_number, pin_number: values.pin_number || "",
      year_built: values.year_built || null, title_type: values.title_type, land_size_sqft: values.land_size || null,
      built_up_area_sqft: values.built_up_area || null, description: values.description || "", currency: values.currency,
      landlord: { name: values.landlord_name, type: values.landlord_type, pin: values.landlord_pin || "", registration_number: values.landlord_registration || "", tax_status: values.tax_status, vat_registered: vatRegistered, vat_number: vatRegistered ? values.vat_number || "" : "" },
      location: { county: values.county, postal_address: values.postal_address || "", postal_code: values.postal_code || "" },
      building: { floor_numbers: values.floor_numbers || "", use: values.building_use || "", access_points: values.access_points || "", parking_spaces: Number(values.parking_spaces || 0), amenities: values.amenities || "" },
      utilities, assets, contacts, service_providers: providers,
      documents: documents.map(({ file, ...document }) => ({ ...document, filename: file?.name ?? "" })),
      landlord_engagement: {
        engagement_type: values.engagement_type || "management",
        starts_on: values.engagement_start || null,
        ends_on: values.engagement_end || null,
        management_fee_basis: values.management_fee_basis || (values.engagement_type === "facility" ? "flat_monthly" : values.engagement_type === "sectional" ? "per_unit" : "percent_collections"),
        management_fee_rate: values.management_fee || null,
        management_fee_percent: values.management_fee_basis === "percent_collections" ? (values.management_fee || null) : null,
        letting_fee_type: values.letting_fee_type || "one_month_rent",
        letting_fee_rate: values.letting_fee_rate || null,
        payment_terms: values.payment_terms || "",
      },
      notes: values.notes || "",
      onboarding_status: readiness.score === 100 ? "complete" : "in_progress",
      onboarding_readiness: {
        score: readiness.score,
        completed: readiness.completed,
        total: readiness.checks.length,
        missing: readiness.missing.map(item => ({ section: item.section, label: item.label })),
      },
    };
    try {
      const endpoint = editId ? `/property/properties/${editId}/` : "/property/properties/onboard/";
      const method = editId ? "PATCH" : "POST";
      const response = await apiFetch(endpoint, {
        method,
        headers: { "X-Property-Scope": "portfolio" },
        body: JSON.stringify({
          property: { name: values.name.trim(), property_type: values.property_type, status: values.status, address: values.address, city: values.city, country: values.country, metadata },
          building: {
            buildings: buildingList,
          },
          units,
        }),
      }, organizationId);
      if (!response.ok) {
        if (response.status === 401) throw new Error("Your session expired before the property could be saved. Sign in again and retry.");
        if (response.status === 403) throw new Error("You do not have permission to onboard properties for this organization.");
        const body = await response.json().catch(() => ({}));
        const errMessages: string[] = [];
        if (typeof body === "object" && body !== null) {
          for (const [key, val] of Object.entries(body as Record<string, unknown>)) {
            const fieldLabel = key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
            const text = Array.isArray(val) ? val.join(", ") : typeof val === "object" && val !== null ? JSON.stringify(val) : String(val);
            errMessages.push(`${fieldLabel}: ${text}`);
          }
        }
        throw new Error(errMessages.join(" · ") || "Property onboarding failed.");
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
    <Box sx={{ display: "flex", alignItems: { xs: "flex-start", sm: "center" }, justifyContent: "space-between", gap: 2, mb: 2, flexDirection: { xs: "column", sm: "row" } }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}><IconButton aria-label="Back" onClick={() => router.push("/overview")}><ArrowLeft /></IconButton><Box><Typography variant="h4" sx={{ fontWeight: 800, fontSize: { xs: "1.25rem", md: "1.5rem" } }}>{editId ? `Edit Property: ${values.name || "Loading..."}` : "Property Onboarding"}</Typography><Typography color="text.secondary" variant="body2">{editId ? "Update property details." : "Fill in property details, then add buildings and units."}</Typography></Box></Box>
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", justifyContent: { xs: "stretch", sm: "flex-end" }, width: { xs: "100%", sm: "auto" } }}>
        {section === "utilities" && <><Button size="small" variant="outlined" startIcon={<Download size={15} />} onClick={() => downloadCsv("center-estates-utility-meters-template.csv", [["utility_type","unit_code","meter_number","meter_location","account_number","tariff","bill_cycle","supply_mode","status"],["water","A101","MTR-WTR-A101","Outside Door A101","WTR-001","200","monthly","postpaid","active"],["water","A102","MTR-WTR-A102","Outside Door A102","WTR-002","200","monthly","postpaid","active"],["electricity","A101","MTR-ELEC-A101","Basement Meter Board","ELEC-001","25","monthly","prepaid","active"]])}>Template</Button><Button size="small" variant="outlined" component="label" startIcon={<Upload size={15} />}>Upload<input hidden type="file" accept=".csv,text/csv" onChange={event => { void importUtilities(event.target.files?.[0]); event.target.value = ""; }} /></Button></>}

        <Button fullWidth={false} variant="contained" startIcon={<Save size={17} />} disabled={saving} onClick={() => void save()} sx={{ minWidth: { xs: "100%", sm: 120 } }}>{saving ? "Saving…" : "Save & Close"}</Button>
      </Box>
    </Box>
    <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: "background.paper" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, mb: 1 }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Onboarding readiness</Typography>
          <Typography variant="body2" color="text.secondary">{readiness.completed} of {readiness.checks.length} setup areas complete. You can save a draft and continue later.</Typography>
        </Box>
        <Chip label={`${readiness.score}%`} color={readiness.score === 100 ? "success" : readiness.score >= 60 ? "warning" : "default"} sx={{ fontWeight: 800, fontSize: 14 }} />
      </Box>
      <LinearProgress variant="determinate" value={readiness.score} color={readiness.score === 100 ? "success" : "primary"} sx={{ height: 8, borderRadius: 99, mb: readiness.missing.length ? 1.5 : 0 }} />
      {readiness.missing.length > 0 && <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
        {readiness.missing.map(item => <Chip key={`${item.section}:${item.label}`} size="small" variant="outlined" label={`Add ${item.label}`} onClick={() => jump(item.section)} />)}
      </Box>}
    </Paper>
    <Paper variant="outlined" sx={{ position: "sticky", top: 76, zIndex: 5, mb: 2, overflowX: "auto" }}><Tabs value={section} onChange={(_, value) => jump(value)} variant="scrollable" scrollButtons="auto" aria-label="Property onboarding sections" sx={{ minHeight: 40, "& .MuiTab-root": { minHeight: 40, fontSize: { xs: 12, md: 14 } } }}>{sections.map(([id, label]) => <Tab id={`onboarding-tab-${id}`} aria-controls={id} key={id} value={id} label={label} />)}</Tabs></Paper>
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
    {error && (
      <Alert
        severity="error"
        variant="filled"
        onClose={() => setError("")}
        sx={{ mb: 2, position: "sticky", top: 128, zIndex: 4, boxShadow: 3, borderRadius: 2 }}
      >
        <strong>Action needed:</strong> {error} Your entered information has been retained.
      </Alert>
    )}


    <Box sx={{ display: "grid", gap: 2, [`& > .onboarding-section:not(#${section})`]: { display: "none" } }}>
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

      <Section id="location" title="Property address"><Grid><TextField required multiline minRows={3} label="Physical address" value={values.address || ""} onChange={set("address")} /><TextField required label="City / town" value={values.city || ""} onChange={set("city")} /><TextField required label="County" value={values.county || ""} onChange={set("county")} /><TextField multiline minRows={3} label="Postal address" value={values.postal_address || ""} onChange={set("postal_address")} /><TextField label="Postal code" value={values.postal_code || ""} onChange={set("postal_code")} /><TextField select label="Country" value={values.country || "KE"} onChange={set("country")}><MenuItem value="KE">KE — Kenya</MenuItem><MenuItem value="UG">UG — Uganda</MenuItem><MenuItem value="TZ">TZ — Tanzania</MenuItem><MenuItem value="RW">RW — Rwanda</MenuItem><MenuItem value="SS">SS — South Sudan</MenuItem><MenuItem value="US">US — United States</MenuItem><MenuItem value="GB">GB — United Kingdom</MenuItem></TextField></Grid></Section>


      <Section id="buildings" title="Buildings">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {values.title_type === "sectional"
            ? "Register each block or tower once. Sectional units are captured in the Units tab, where they can be bulk-uploaded and mapped to this property."
            : "Add each building or tower individually with its own floor count. If the property has a single building, add it here with its details."}
        </Typography>
        <Grid columns={4}>
          <TextField required label="Building name" placeholder="e.g. Tower A, Main Block" value={buildingDraft.name} onChange={e => setBuildingDraft({ ...buildingDraft, name: e.target.value })} />
          <TextField required type="number" label="Number of floors" value={buildingDraft.floors} onChange={e => setBuildingDraft({ ...buildingDraft, floors: e.target.value })} slotProps={{ htmlInput: { min: 1 } }} />
          {values.title_type === "sectional"
            ? <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}><Typography variant="body2" color="text.secondary">Sectional unit numbers are maintained in the Units register.</Typography><Button size="small" variant="outlined" onClick={() => jump("units")}>Bulk upload units</Button></Box>
            : <TextField label="Floor numbers" placeholder="e.g. G, 1, 2, 3" value={buildingDraft.floor_numbers} onChange={e => setBuildingDraft({ ...buildingDraft, floor_numbers: e.target.value })} />}
          <TextField label="Building use" placeholder="e.g. Residential, Commercial" value={buildingDraft.use} onChange={e => setBuildingDraft({ ...buildingDraft, use: e.target.value })} />
        </Grid>
        <Box sx={{ mt: 1 }}><Grid columns={4}>
          <TextField label="Access / entry points" value={buildingDraft.access_points} onChange={e => setBuildingDraft({ ...buildingDraft, access_points: e.target.value })} />
          <TextField type="number" label="Parking spaces" value={buildingDraft.parking_spaces} onChange={e => setBuildingDraft({ ...buildingDraft, parking_spaces: e.target.value })} slotProps={{ htmlInput: { min: 0 } }} />
          <TextField label="Amenities" placeholder="Lift, generator, borehole…" value={buildingDraft.amenities} onChange={e => setBuildingDraft({ ...buildingDraft, amenities: e.target.value })} />
          <Box sx={{ display: "flex", alignItems: "flex-end" }}>
            <Button fullWidth variant="outlined" startIcon={<Plus size={16} />} onClick={addBuilding}>Add Building</Button>
          </Box>
        </Grid></Box>
        <RowList
          rows={buildings}
          columns={["Name", "Floors", values.title_type === "sectional" ? "Sectional units" : "Floor #s", "Use", "Parking", "Amenities"]}
          render={b => [b.name, `${b.floors} floors`, values.title_type === "sectional" ? `${units.filter(unit => Number(unit.building_index || 1) === buildings.indexOf(b) + 1).length} registered` : b.floor_numbers || "—", b.use || "—", b.parking_spaces || "0", b.amenities || "—"]}
          onRemove={i => { void removeBuilding(i); }}
          empty="No buildings added yet. Add at least one building or tower."
        />
        {buildings.length > 0 && (
          <Box sx={{ display: "flex", gap: 1, mt: 2, flexWrap: "wrap" }}>
            <Chip label={`Buildings: ${buildings.length}`} />
            <Chip label={`Total floors: ${buildings.reduce((sum, b) => sum + Number(b.floors || 0), 0)}`} />
          </Box>
        )}
      </Section>

      <Section id="units" title="Create units">
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: { xs: "stretch", sm: "center" }, flexDirection: { xs: "column", sm: "row" }, gap: 1, mb: 2 }}>
          <Typography variant="body2" color="text.secondary">Add units manually or import from CSV (max 500 rows). Outline unit boundaries on architectural floor plans.</Typography>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <Button size="small" variant="outlined" startIcon={<Download size={15} />} onClick={() => downloadCsv("center-estates-unit-template.csv", [["unit_no","unit_type","floor","use","area","rateable_area","building_number","service_charge_rate","description"],["G-01","Shop","Ground","Commercial","850","820","1","35","Ground floor retail unit"]])}>Download template</Button>
            <Button size="small" variant="contained" component="label" startIcon={<Upload size={15} />}>Upload CSV<input hidden type="file" accept=".csv,text/csv" onChange={event => { void importUnits(event.target.files?.[0]); event.target.value = ""; }} /></Button>
          </Box>
        </Box>
        {unitImportRows.length > 0 && <Paper variant="outlined" sx={{ mb: 2, overflow: "hidden", borderColor: unitImportRows.some((row) => Object.keys(row.errors).length) ? "error.main" : "success.main" }}>
          <Box sx={{ p: 1.5, display: "flex", justifyContent: "space-between", gap: 1, flexWrap: "wrap", bgcolor: "action.hover" }}>
            <Box><Typography sx={{ fontWeight: 800 }}>CSV preview · {unitImportFile}</Typography><Typography variant="body2" color="text.secondary">Review and edit the parsed values before adding them to the property draft.</Typography></Box>
            <Chip color={unitImportRows.some((row) => Object.keys(row.errors).length) ? "error" : "success"} label={unitImportRows.some((row) => Object.keys(row.errors).length) ? `${unitImportRows.filter((row) => Object.keys(row.errors).length).length} rows need attention` : `${unitImportRows.length} rows ready`} />
          </Box>
          <Box sx={{ overflowX: "auto", maxHeight: 430 }}><Box component="table" sx={{ width: "100%", minWidth: 980, borderCollapse: "collapse", "th,td": { p: 1, borderBottom: "1px solid", borderColor: "divider", verticalAlign: "top" }, th: { position: "sticky", top: 0, bgcolor: "background.paper", zIndex: 1, textAlign: "left" } }}>
            <thead><tr><th>CSV row</th>{["Unit no.", "Type", "Floor", "Use", "Area", "Rateable area", "Building #", "Service charge / sq ft", "Description"].map((label) => <th key={label}>{label}</th>)}</tr></thead>
            <tbody>{unitImportRows.map((row, index) => <tr key={`${row.sourceRow}-${index}`} style={{ background: Object.keys(row.errors).length ? "rgba(211, 47, 47, 0.07)" : undefined }}>
              <td><Chip size="small" label={row.sourceRow} color={Object.keys(row.errors).length ? "error" : "default"} /></td>
              {(["unit_no", "unit_type", "floor", "use", "area", "rateable_area", "building_index", "service_charge_rate", "description"] as (keyof UnitDraft)[]).map((field) => <td key={field}><TextField data-unit-import-error={Boolean(row.errors[field])} size="small" value={row[field]} error={Boolean(row.errors[field])} helperText={row.errors[field] || " "} onChange={(event) => editUnitImport(index, field, event.target.value)} slotProps={{ htmlInput: { "aria-label": `${field.replaceAll("_", " ")} row ${row.sourceRow}` } }} sx={{ minWidth: field === "description" ? 180 : 110 }} /></td>)}
            </tr>)}</tbody>
          </Box></Box>
          <Box sx={{ p: 1.5, display: "flex", justifyContent: "flex-end", gap: 1 }}><Button color="inherit" onClick={() => { setUnitImportRows([]); setUnitImportFile(""); setError(""); }}>Discard preview</Button><Button variant="contained" onClick={applyUnitImport}>Add validated units</Button></Box>
        </Paper>}
        <Grid columns={4}><TextField required label={values.title_type === "sectional" ? "Sectional unit number" : "Unit number"} value={unitDraft.unit_no} onChange={e => setUnitDraft({ ...unitDraft, unit_no: e.target.value })} /><TextField required label={values.property_type === "residential" ? "Typology" : "Unit type"} placeholder={values.property_type === "residential" ? "e.g. 1 Bedroom, 2 Bedroom" : "e.g. Shop, Office"} value={unitDraft.unit_type} onChange={e => setUnitDraft({ ...unitDraft, unit_type: e.target.value })} /><TextField required label="Floor" value={unitDraft.floor} onChange={e => setUnitDraft({ ...unitDraft, floor: e.target.value })} /><TextField required label="Use" value={unitDraft.use} onChange={e => setUnitDraft({ ...unitDraft, use: e.target.value })} /><TextField required type="number" label={values.property_type === "residential" ? "Unit area (sq ft)" : "Space area (sq ft)"} value={unitDraft.area} onChange={e => setUnitDraft({ ...unitDraft, area: e.target.value })} /><TextField type="number" label="Rateable area" value={unitDraft.rateable_area} onChange={e => setUnitDraft({ ...unitDraft, rateable_area: e.target.value })} /><TextField type="number" label="Service charge / sq ft" value={unitDraft.service_charge_rate} onChange={e => setUnitDraft({ ...unitDraft, service_charge_rate: e.target.value })} helperText="Inherited by every tenancy" /><TextField type="number" label="Building #" value={unitDraft.building_index} onChange={e => setUnitDraft({ ...unitDraft, building_index: e.target.value })} /><TextField label="Description" value={unitDraft.description} onChange={e => setUnitDraft({ ...unitDraft, description: e.target.value })} /></Grid>
        <Button startIcon={<Plus size={16} />} variant="outlined" sx={{ mt: 1.5 }} onClick={addUnit}>Add unit</Button>
        <Divider sx={{ my: 2 }} />
        <RowList rows={units} columns={["Unit no.", "Floor", "Type", "Use", "Area", "Rateable area", "Layout Outline"]} render={u => [u.unit_no, u.floor, u.unit_type, u.use, u.area, u.rateable_area || "—", u.polygon && u.polygon.length > 0 ? <Chip size="small" color="success" label="✓ Outline Mapped" sx={{ fontSize: 10, fontWeight: 700 }} /> : <span style={{ color: "#94a3b8", fontSize: 11 }}>Not mapped</span>]} onRemove={i => setUnits(rows => rows.filter((_, index) => index !== i))} empty="No units added yet." />
        <Box sx={{ display: "flex", gap: 1, mt: 2, flexWrap: "wrap" }}><Chip label={`Total units: ${units.length}`} /><Chip label={`Lettable area: ${totalArea.toLocaleString()} sq ft`} /><Chip label={`Vacant units: ${units.length}`} color="success" variant="outlined" /></Box>
        {units.length > 0 && (
          <Box sx={{ mt: 3, pt: 2, borderTop: "1px dashed var(--border)" }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>📐 Floor Layout &amp; Unit Outlines</Typography>
            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 1.5 }}>
              Use the interactive canvas below to sketch and outline unit boundaries. Click <strong>"Draw Unit Outline"</strong> and select a unit code.
            </Typography>
            <UnitFloorPlanCanvas
              floorPlan={{
                title: `${values.name || "Property"} Floor Layout`,
                floor: units[0]?.floor || "1",
                units: units.map(u => ({
                  id: u.unit_no,
                  code: u.unit_no,
                  floor: u.floor,
                  area: u.area,
                  status: "available",
                  polygon: u.polygon,
                })),
              }}
              availableUnits={units.map(u => ({
                id: u.unit_no,
                code: u.unit_no,
                status: "available",
                area: u.area,
              }))}
              onSaveUnitPolygon={(unitId, polygon) => {
                setUnits(prev => prev.map(u => (u.unit_no === unitId ? { ...u, polygon } : u)));
              }}
              height={450}
            />
          </Box>
        )}
      </Section>

      <Section id="utilities" title="Utility accounts and unit meters">
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: { xs: "stretch", sm: "center" }, flexDirection: { xs: "column", sm: "row" }, gap: 1, mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Allocate unit meters, specify meter locations, and configure billing tariffs. Opening meter readings will be captured during individual tenant onboarding.
          </Typography>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<Download size={15} />}
              onClick={() => downloadCsv("center-estates-utility-meters-template.csv", [
                ["utility_type", "unit_code", "meter_number", "meter_location", "account_number", "tariff", "bill_cycle", "supply_mode", "status"],
                ["water", "A101", "MTR-WTR-A101", "Outside Door A101", "WTR-001", "200", "monthly", "postpaid", "active"],
                ["water", "A102", "MTR-WTR-A102", "Outside Door A102", "WTR-002", "200", "monthly", "postpaid", "active"],
                ["electricity", "A101", "MTR-ELEC-A101", "Basement Meter Board", "ELEC-001", "25", "monthly", "prepaid", "active"],
              ])}
            >
              Download template
            </Button>
            <Button size="small" variant="contained" component="label" startIcon={<Upload size={15} />}>
              Upload meters CSV
              <input hidden type="file" accept=".csv,text/csv" onChange={event => { void importUtilities(event.target.files?.[0]); event.target.value = ""; }} />
            </Button>
          </Box>
        </Box>

        {/* Quick Bulk Unit Meter Allocator Card */}
        {units.length > 0 && (
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              mb: 2.5,
              borderRadius: 2,
              background: "radial-gradient(ellipse at top, rgba(99, 102, 241, 0.05) 0%, rgba(255, 255, 255, 0.9) 100%)",
              border: "1px solid rgba(99, 102, 241, 0.25)",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
              <Zap size={18} color="#6366f1" />
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "primary.main" }}>
                ⚡ Quick Bulk Meter Allocator ({units.length} registered units available)
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, fontSize: 13 }}>
              Automatically generate and assign individual utility meters across all <strong>{units.length} units</strong> in 1 click.
            </Typography>
            <Grid columns={5}>
              <TextField
                select
                size="small"
                label="Utility Type"
                value={bulkUtilityType}
                onChange={e => {
                  const t = e.target.value;
                  setBulkUtilityType(t);
                  setBulkMeterPrefix(t === "water" ? "MTR-WTR-" : t === "electricity" ? "MTR-ELEC-" : "MTR-GAS-");
                  setBulkUtilityTariff(t === "water" ? "200" : t === "electricity" ? "25" : "150");
                }}
              >
                <MenuItem value="water">Water (m³)</MenuItem>
                <MenuItem value="electricity">Electricity (kWh)</MenuItem>
                <MenuItem value="gas">Gas (m³)</MenuItem>
                <MenuItem value="sewerage">Sewerage</MenuItem>
                <MenuItem value="internet">Internet</MenuItem>
              </TextField>
              <TextField
                size="small"
                label="Meter Prefix"
                placeholder="e.g. MTR-WTR-"
                value={bulkMeterPrefix}
                onChange={e => setBulkMeterPrefix(e.target.value)}
              />
              <TextField
                size="small"
                label="Default Location"
                placeholder="e.g. Floor Corridor, Outside Door"
                value={bulkMeterLocation}
                onChange={e => setBulkMeterLocation(e.target.value)}
              />
              <TextField
                size="small"
                type="number"
                label={`Tariff (KES / ${bulkUtilityType === "water" ? "m³" : bulkUtilityType === "gas" ? "m³" : "kWh"})`}
                value={bulkUtilityTariff}
                onChange={e => setBulkUtilityTariff(e.target.value)}
              />
              <Button
                variant="contained"
                startIcon={<Zap size={16} />}
                onClick={autoAllocateUnitMeters}
                sx={{ background: "#4f46e5", "&:hover": { background: "#4338ca" }, fontWeight: 700 }}
              >
                Allocate All {units.length} Units
              </Button>
            </Grid>
          </Paper>
        )}

        {/* Single Meter / Account Entry */}
        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.5 }}>
          Individual Meter / Utility Account Entry
        </Typography>
        <Grid columns={4}>
          <TextField
            select
            label="Utility type"
            value={utilityDraft.type}
            onChange={e => {
              const type = e.target.value;
              setUtilityDraft({
                ...utilityDraft,
                type,
                unit: type === "water" ? "m³" : type === "gas" ? "m³" : "kWh",
                supply_mode: type === "electricity" ? utilityDraft.supply_mode : "postpaid",
              });
            }}
          >
            {["water", "electricity", "sewerage", "gas", "internet"].map(v => (
              <MenuItem key={v} value={v}>{v[0].toUpperCase() + v.slice(1)}</MenuItem>
            ))}
          </TextField>

          {utilityDraft.type === "electricity" && (
            <TextField
              select
              label="Electricity billing"
              value={utilityDraft.supply_mode}
              onChange={e => setUtilityDraft({ ...utilityDraft, supply_mode: e.target.value })}
            >
              <MenuItem value="prepaid">Prepaid / token</MenuItem>
              <MenuItem value="postpaid">Postpaid / metered</MenuItem>
            </TextField>
          )}

          <TextField
            select
            label="Assigned unit"
            value={utilityDraft.unit_code}
            onChange={e => setUtilityDraft({ ...utilityDraft, unit_code: e.target.value })}
          >
            <MenuItem value="">Property bulk / common meter</MenuItem>
            {units.map(unit => (
              <MenuItem key={unit.unit_no} value={unit.unit_no}>Unit {unit.unit_no}</MenuItem>
            ))}
          </TextField>

          <TextField
            label="Meter number"
            placeholder="e.g. MTR-WTR-101"
            value={utilityDraft.meter_code}
            onChange={e => setUtilityDraft({ ...utilityDraft, meter_code: e.target.value })}
          />

          <TextField
            label="Meter location"
            placeholder="e.g. Corridor Floor 2, Outside Door, Basement Board"
            value={utilityDraft.location}
            onChange={e => setUtilityDraft({ ...utilityDraft, location: e.target.value })}
          />

          <TextField
            label="Account number (Optional)"
            placeholder="e.g. Water / Token Acc No"
            value={utilityDraft.account_no}
            onChange={e => setUtilityDraft({ ...utilityDraft, account_no: e.target.value })}
          />

          <TextField
            type="number"
            label={`Tariff (KES / ${utilityDraft.unit})`}
            value={utilityDraft.tariff}
            onChange={e => setUtilityDraft({ ...utilityDraft, tariff: e.target.value })}
          />

          <TextField
            select
            label="Bill cycle"
            value={utilityDraft.bill_cycle}
            onChange={e => setUtilityDraft({ ...utilityDraft, bill_cycle: e.target.value })}
          >
            <MenuItem value="monthly">Monthly</MenuItem>
            <MenuItem value="bi_monthly">Every two months</MenuItem>
            <MenuItem value="quarterly">Quarterly</MenuItem>
            <MenuItem value="prepaid">Prepaid</MenuItem>
          </TextField>
        </Grid>

        <Box sx={{ mt: 1.5, display: "flex", justifyContent: "flex-end" }}>
          <Button
            variant="outlined"
            startIcon={<Plus size={16} />}
            disabled={!utilityDraft.meter_code.trim() && !utilityDraft.account_no.trim()}
            onClick={() => {
              setUtilities(rows => [...rows, utilityDraft]);
              setUtilityDraft(blankUtility);
            }}
          >
            + Add Utility Meter
          </Button>
        </Box>

        <Box sx={{ mt: 2.5 }}>
          <RowList
            rows={utilities}
            columns={["Type", "Assigned Unit", "Meter Number", "Meter Location", "Tariff", "Billing Mode", "Bill Cycle", "Account No"]}
            render={u => [
              u.type,
              u.unit_code ? `Unit ${u.unit_code}` : "Property Bulk",
              u.meter_code || "—",
              u.location || "—",
              `${u.tariff} KES/${u.unit}`,
              u.type === "electricity" ? (u.supply_mode === "prepaid" ? "Prepaid Token" : "Postpaid Metered") : "Metered",
              u.bill_cycle,
              u.account_no || "—",
            ]}
            onRemove={i => setUtilities(rows => rows.filter((_, index) => index !== i))}
            empty="No utility accounts or meters added."
          />
        </Box>
      </Section>


      <Section id="assets" title="Assets — property fixtures and equipment"><Box sx={{ display: "flex", justifyContent: "space-between", alignItems: { xs: "stretch", sm: "center" }, flexDirection: { xs: "column", sm: "row" }, gap: 1, mb: 2 }}><Typography variant="body2" color="text.secondary">Register assets individually or import an asset register from CSV.</Typography><Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}><Button size="small" variant="outlined" startIcon={<Download size={15} />} onClick={() => downloadCsv("center-estates-asset-template.csv", [["asset_name","category","location","quantity","status"],["Passenger lift","Vertical transport","Block A","1","active"]])}>Download template</Button><Button size="small" variant="contained" component="label" startIcon={<Upload size={15} />}>Upload asset CSV<input hidden type="file" accept=".csv,text/csv" onChange={event => { void importAssets(event.target.files?.[0]); event.target.value = ""; }} /></Button></Box></Box><Grid columns={5}><TextField label="Asset name" value={assetDraft.name} onChange={e => setAssetDraft({ ...assetDraft, name: e.target.value })} /><TextField label="Category" value={assetDraft.category} onChange={e => setAssetDraft({ ...assetDraft, category: e.target.value })} /><TextField label="Location" value={assetDraft.location} onChange={e => setAssetDraft({ ...assetDraft, location: e.target.value })} /><TextField type="number" label="Quantity" value={assetDraft.quantity} onChange={e => setAssetDraft({ ...assetDraft, quantity: e.target.value })} /><Button variant="outlined" startIcon={<Plus size={16} />} disabled={!assetDraft.name.trim()} onClick={() => { setAssets(rows => [...rows, assetDraft]); setAssetDraft(blankAsset); }}>Add asset</Button></Grid><RowList rows={assets} columns={["Asset","Category","Location","Qty","Status"]} render={a => [a.name,a.category,a.location,a.quantity,a.status]} onRemove={i => setAssets(rows => rows.filter((_, index) => index !== i))} empty="No assets added yet." /></Section>

      <Section id="contacts" title="Property contacts"><Box sx={{ display: "flex", justifyContent: "space-between", alignItems: { xs: "stretch", sm: "center" }, flexDirection: { xs: "column", sm: "row" }, gap: 1, mb: 2 }}><Typography variant="body2" color="text.secondary">Add contacts manually or import an existing directory.</Typography><Box sx={{ display: "flex", gap: 1 }}><Button size="small" variant="outlined" startIcon={<Download size={15} />} onClick={() => downloadCsv("center-estates-contact-template.csv", [["name","role","email","phone"],["Jane Wanjiku","Caretaker","jane@example.com","+254700000000"]])}>Download template</Button><Button size="small" variant="contained" component="label" startIcon={<Upload size={15} />}>Upload contacts<input hidden type="file" accept=".csv,text/csv" onChange={event => { void importContacts(event.target.files?.[0]); event.target.value = ""; }} /></Button></Box></Box><Grid columns={5}><TextField label="Name" value={contactDraft.name} onChange={e => setContactDraft({ ...contactDraft, name: e.target.value })} /><TextField label="Role" value={contactDraft.role} onChange={e => setContactDraft({ ...contactDraft, role: e.target.value })} /><TextField type="email" label="Email" value={contactDraft.email} onChange={e => setContactDraft({ ...contactDraft, email: e.target.value })} /><TextField label="Phone" value={contactDraft.phone} onChange={e => setContactDraft({ ...contactDraft, phone: e.target.value })} /><Button variant="outlined" startIcon={<Plus size={16} />} disabled={!contactDraft.name.trim()} onClick={() => { setContacts(rows => [...rows, contactDraft]); setContactDraft(blankContact); }}>Add contact</Button></Grid><RowList rows={contacts} columns={["Name","Role","Email","Phone"]} render={c => [c.name,c.role,c.email,c.phone]} onRemove={i => setContacts(rows => rows.filter((_, index) => index !== i))} empty="No contacts added." /></Section>

      <Section id="providers" title="Service Profiles & Facility Service Lines">
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: { xs: "stretch", sm: "center" }, flexDirection: { xs: "column", sm: "row" }, gap: 1, mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Define recurring facility service lines required for this property (e.g. 24/7 Security, Cleaning, Lift Maintenance, Fire Safety). Approved service contractors and contract rates are assigned dynamically in the Facilities module.
          </Typography>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button size="small" variant="outlined" startIcon={<Download size={15} />} onClick={() => downloadCsv("center-estates-service-line-template.csv", [["service_line_name","category","frequency","criticality","scope"],["24/7 Security Guarding","Security & Guarding","monthly","critical","Main Gate & Compound"],["Lift Preventive Maintenance","Lift / Elevator Maintenance","monthly","critical","Passenger Lifts Block A & B"],["Waste Collection & Disposal","Waste & Refuse Disposal","monthly","medium","Perimeter Bins & Refuse Chute"],["Backup Generator Servicing","Backup Generator & Fuel","quarterly","high","Generator Room - Block A"]])}>Download template</Button>
            <Button size="small" variant="contained" component="label" startIcon={<Upload size={15} />}>Upload CSV<input hidden type="file" accept=".csv,text/csv" onChange={event => { void importProviders(event.target.files?.[0]); event.target.value = ""; }} /></Button>
          </Box>
        </Box>
        <Grid columns={5}>
          <TextField
            select
            label="Service Category"
            value={providerDraft.category}
            onChange={e => setProviderDraft({ ...providerDraft, category: e.target.value, service: providerDraft.service || e.target.value })}
          >
            {[
              "Security & Guarding", "Cleaning & Janitorial", "Lift / Elevator Maintenance",
              "Landscaping & Gardening", "Waste & Refuse Disposal", "Pest Control & Fumigation",
              "Backup Generator & Fuel", "HVAC & Air Conditioning", "Fire Safety & Extinguishers",
              "Plumbing & Water Systems", "CCTV & Access Control", "General Maintenance",
            ].map(cat => <MenuItem key={cat} value={cat}>{cat}</MenuItem>)}
          </TextField>
          <TextField label="Service Line Name / Requirement" placeholder="e.g. 24/7 Gate & Perimeter Security" value={providerDraft.service} onChange={e => setProviderDraft({ ...providerDraft, service: e.target.value })} />
          <TextField select label="Billing / Service Frequency" value={providerDraft.frequency} onChange={e => setProviderDraft({ ...providerDraft, frequency: e.target.value })}>
            <MenuItem value="monthly">Monthly</MenuItem>
            <MenuItem value="quarterly">Quarterly</MenuItem>
            <MenuItem value="bi_annual">Bi-Annual</MenuItem>
            <MenuItem value="annual">Annual</MenuItem>
            <MenuItem value="daily">Daily / As-Needed</MenuItem>
          </TextField>
          <TextField select label="Criticality / SLA Level" value={providerDraft.criticality} onChange={e => setProviderDraft({ ...providerDraft, criticality: e.target.value })}>
            <MenuItem value="critical">Critical (24/7 SLA)</MenuItem>
            <MenuItem value="high">High Priority</MenuItem>
            <MenuItem value="medium">Medium</MenuItem>
            <MenuItem value="low">Low / Routine</MenuItem>
          </TextField>
          <TextField label="Scope / Coverage Area (Optional)" placeholder="e.g. Main Gate, Blocks A & B" value={providerDraft.scope || ""} onChange={e => setProviderDraft({ ...providerDraft, scope: e.target.value })} />
        </Grid>
        <Box sx={{ mt: 1.5, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
          <Typography variant="caption" color="text.secondary">
            💡 Service lines create the facility requirement slots. Contractors & costs are assigned when allocating in <strong>Facilities</strong>.
          </Typography>
          <Button
            variant="contained"
            startIcon={<Plus size={16} />}
            disabled={!providerDraft.service.trim()}
            onClick={() => { setProviders(rows => [...rows, providerDraft]); setProviderDraft(blankProvider); }}
          >
            Add Service Line
          </Button>
        </Box>
        <Box sx={{ mt: 2 }}>
          <RowList
            rows={providers}
            columns={["Service Line", "Category", "Billing Frequency", "Criticality", "Coverage / Scope", "Provider Status"]}
            render={p => [
              p.service || p.name,
              p.category || "General Maintenance",
              p.frequency === "monthly" ? "Monthly" : p.frequency === "quarterly" ? "Quarterly" : p.frequency === "annual" ? "Annual" : p.frequency || "Monthly",
              p.criticality === "critical" ? "Critical (24/7)" : p.criticality === "high" ? "High Priority" : p.criticality || "Medium",
              p.scope || "Whole property",
              p.name ? `Assigned: ${p.name}` : "Unallocated (Assign in Facilities)",
            ]}
            onRemove={i => setProviders(rows => rows.filter((_, index) => index !== i))}
            empty="No service lines or maintenance profiles added."
          />
        </Box>
      </Section>

      <Section id="landlord" title="Landlord engagement and terms">
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Configure management fees and engagement terms. Sectional properties charge per unit for common area management, property management is charged as a % of collections or flat figure, and facility management is billed as a flat monthly figure.
          </Typography>
        </Box>
        <Grid columns={3}>
          <TextField
            select
            label="Engagement type"
            value={values.engagement_type || "management"}
            onChange={(e) => {
              if (error) setError("");
              const newType = e.target.value;
              let newBasis = values.management_fee_basis;
              if (newType === "facility") newBasis = "flat_monthly";
              else if (newType === "sectional") newBasis = "per_unit";
              else if (newType === "management" || newType === "full_service") newBasis = "percent_collections";
              setValues(prev => ({ ...prev, engagement_type: newType, management_fee_basis: newBasis }));
            }}
          >

            <MenuItem value="management">Property management</MenuItem>
            <MenuItem value="sectional">Sectional title / Common area management</MenuItem>
            <MenuItem value="facility">Facility management</MenuItem>
            <MenuItem value="full_service">Full service (Property & Facility)</MenuItem>
            <MenuItem value="letting">Letting only</MenuItem>
          </TextField>
          <TextField type="date" label="Agreement start" value={values.engagement_start || ""} onChange={set("engagement_start")} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField type="date" label="Agreement end" value={values.engagement_end || ""} onChange={set("engagement_end")} slotProps={{ inputLabel: { shrink: true } }} />

          <TextField
            select
            label="Management fee basis"
            value={values.management_fee_basis || (values.engagement_type === "facility" ? "flat_monthly" : values.engagement_type === "sectional" ? "per_unit" : "percent_collections")}
            onChange={set("management_fee_basis")}
          >
            <MenuItem value="percent_collections">% of Rent Collections (Property Management)</MenuItem>
            <MenuItem value="per_unit">Per Unit Fee — KES/unit/month (Sectional / Common Area)</MenuItem>
            <MenuItem value="flat_monthly">Fixed Flat Monthly Fee — KES/month (Facility Management)</MenuItem>
          </TextField>

          <TextField
            type="number"
            label={
              values.management_fee_basis === "per_unit"
                ? "Management fee (KES / unit / month)"
                : values.management_fee_basis === "flat_monthly"
                ? "Fixed monthly management fee (KES)"
                : "Management fee (%)"
            }
            placeholder={
              values.management_fee_basis === "per_unit"
                ? `e.g. 1500 (Total KES ${(Number(units.length || 1) * 1500).toLocaleString()}/mo)`
                : values.management_fee_basis === "flat_monthly"
                ? "e.g. 50000"
                : "e.g. 5.0 or 8.0"
            }
            value={values.management_fee || ""}
            onChange={set("management_fee")}
            helperText={
              values.management_fee_basis === "per_unit" && units.length > 0 && values.management_fee
                ? `Total KES ${(Number(values.management_fee) * units.length).toLocaleString()}/month across ${units.length} unit(s)`
                : undefined
            }
          />

          <TextField select label="Letting / tenant sourcing fee basis" value={values.letting_fee_type || "one_month_rent"} onChange={set("letting_fee_type")}>
            <MenuItem value="one_month_rent">1 Month Rent (100%)</MenuItem>
            <MenuItem value="half_month_rent">Half Month Rent (50%)</MenuItem>
            <MenuItem value="percent_annual">% of Annual Lease Value</MenuItem>
            <MenuItem value="flat">Fixed Flat Amount</MenuItem>
          </TextField>
          <TextField type="number" label="Letting fee rate / amount" placeholder="Rate (%) or Amount (KES)" value={values.letting_fee_rate || ""} onChange={set("letting_fee_rate")} />
          <TextField sx={{ gridColumn: { md: "span 3" } }} label="Payment terms & remittance instructions" value={values.payment_terms || ""} onChange={set("payment_terms")} />
        </Grid>
      </Section>


      <Section id="documents" title="Documents register"><Alert severity="info" sx={{ mb: 2 }}>Files are uploaded to the secure document store after the property is created. A failed file upload is reported and can be retried without recreating the property.</Alert><Grid columns={5}><TextField label="Document name" value={documentDraft.name} onChange={e => setDocumentDraft({ ...documentDraft, name: e.target.value })} /><TextField select label="Type" value={documentDraft.type} onChange={e => setDocumentDraft({ ...documentDraft, type: e.target.value })}><MenuItem value="title">Title</MenuItem><MenuItem value="management_agreement">Management agreement</MenuItem><MenuItem value="tax">Tax document</MenuItem><MenuItem value="insurance">Insurance</MenuItem><MenuItem value="other">Other</MenuItem></TextField><TextField label="Reference" value={documentDraft.reference} onChange={e => setDocumentDraft({ ...documentDraft, reference: e.target.value })} /><TextField type="date" label="Expiry date" value={documentDraft.expires_on} onChange={e => setDocumentDraft({ ...documentDraft, expires_on: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} /><Button variant="outlined" component="label" startIcon={<Upload size={16} />}>{documentDraft.file?.name || "Choose file"}<input hidden type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" onChange={event => setDocumentDraft({ ...documentDraft, file: event.target.files?.[0] ?? null })} /></Button><Button variant="outlined" startIcon={<Plus size={16} />} disabled={!documentDraft.name.trim() || !documentDraft.file} onClick={() => { setDocuments(rows => [...rows, documentDraft]); setDocumentDraft(blankDocument); }}>Add document</Button></Grid><RowList rows={documents} columns={["Name","Type","File","Reference","Expires"]} render={d => [d.name,d.type,d.file?.name || "—",d.reference,d.expires_on || "—"]} onRemove={i => setDocuments(rows => rows.filter((_, index) => index !== i))} empty="No documents selected for upload." /></Section>

      <Section id="notes" title="Notes"><TextField fullWidth multiline minRows={5} label="Onboarding notes" value={values.notes || ""} onChange={set("notes")} /><Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(5, 1fr)" }, gap: 2, mt: 3, color: "text.secondary" }}><Box><Typography variant="caption">Created by</Typography><Typography variant="body2" color="text.primary">{session?.user.firstName || session?.user.username || "—"}</Typography></Box><Box><Typography variant="caption">Created date</Typography><Typography variant="body2" color="text.primary">On save</Typography></Box><Box><Typography variant="caption">Last modified by</Typography><Typography variant="body2" color="text.primary">—</Typography></Box><Box><Typography variant="caption">Last modified date</Typography><Typography variant="body2" color="text.primary">—</Typography></Box><Box><Typography variant="caption">Status</Typography><Box><Chip size="small" label="Draft" /></Box></Box></Box></Section>
    </Box>
    <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1.5, py: 3, flexDirection: { xs: "column-reverse", sm: "row" } }}><Button variant="outlined" fullWidth={false} onClick={() => router.push("/workspaces")} sx={{ order: { xs: 2, sm: 1 } }}>Cancel</Button><Button variant="contained" startIcon={<Save size={17} />} disabled={saving} onClick={() => void save()} sx={{ order: { xs: 1, sm: 2 }, minWidth: { xs: "100%", sm: 140 } }}>{saving ? "Saving…" : "Save & Close"}</Button></Box>
  </Box>;
}
