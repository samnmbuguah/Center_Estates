"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Chip, Paper, Tab, Tabs, Typography } from "@mui/material";
import { ArrowLeft, ClipboardCheck, Wrench } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { ModuleShell } from "@/components/module-shell";
import { ErrorBanner, LoadingState, money } from "@/components/module-ui";
import { apiFetch } from "@/lib/api";

type Row = Record<string, unknown>;

const tabs = ["Overview", "Technical", "Maintenance", "Work orders", "Inspections", "Compliance & warranty", "Costs & replacement", "Documents & history"];

function InfoGrid({ entries }: { entries: [string, unknown][] }) {
  return <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))" }, gap: 1.25 }}>
    {entries.map(([label, value]) => <Box key={label} sx={{ p: 1.5, borderRadius: 2, bgcolor: "action.hover", minHeight: 64 }}><Typography variant="caption" color="text.secondary">{label}</Typography><Typography variant="body2" sx={{ mt: .35, fontWeight: 750, overflowWrap: "anywhere" }}>{value === null || value === undefined || value === "" ? "—" : String(value)}</Typography></Box>)}
  </Box>;
}

function ListPanel({ title, rows, empty }: { title: string; rows: Row[]; empty: string }) {
  return <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 2.5 }}><Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 900 }}>{title}</Typography>{rows.length ? <Box sx={{ display: "grid", gap: 1 }}>{rows.map((row, index) => <Box key={String(row.id ?? index)} sx={{ p: 1.4, border: "1px solid", borderColor: "divider", borderRadius: 2 }}><Typography variant="body2" sx={{ fontWeight: 800 }}>{String(row.name ?? row.title ?? row.number ?? row.reference ?? "Record")}</Typography><Typography variant="caption" color="text.secondary">{String(row.status ?? row.next_due_on ?? row.scheduled_on ?? row.created_at ?? "")}</Typography></Box>)}</Box> : <Typography variant="body2" color="text.secondary">{empty}</Typography>}</Paper>;
}

export default function SingleAssetWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [asset, setAsset] = useState<Row | null>(null);
  const [related, setRelated] = useState<Record<string, Row[]>>({ schedules: [], workOrders: [], inspections: [], documents: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState(0);

  const load = async () => {
    setLoading(true); setError("");
    try {
      const assetResponse = await apiFetch(`/facility/assets/${id}/`);
      if (!assetResponse.ok) throw new Error(assetResponse.status === 404 ? "This asset was not found or is outside your property access." : "The asset passport could not be loaded.");
      const record = await assetResponse.json() as Row;
      setAsset(record);
      const term = encodeURIComponent(String(record.code ?? record.name ?? ""));
      const responses = await Promise.all([
        apiFetch(`/facility/planned-maintenance/?search=${term}`),
        apiFetch(`/facility/work-orders/?search=${term}`),
        apiFetch(`/facility/inspections/?search=${term}`),
        apiFetch(`/documents/documents/?asset_id=${id}`),
      ]);
      const parsed = await Promise.all(responses.map(response => response.ok ? response.json() : []));
      setRelated({ schedules: parsed[0] as Row[], workOrders: parsed[1] as Row[], inspections: parsed[2] as Row[], documents: parsed[3] as Row[] });
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The asset passport could not be loaded."); }
    finally { setLoading(false); }
  };

  // The initial fetch intentionally owns this page's loading state.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [id]);
  const metadata = useMemo(() => (asset?.metadata && typeof asset.metadata === "object" ? asset.metadata as Row : {}), [asset]);

  return <ModuleShell moduleKey="facility" moduleName="Facility Management" eyebrow="Digital asset passport" title={String(asset?.name ?? "Asset passport")} subtitle="One verified record for identity, maintenance, compliance, costs, documents and lifecycle history." accent="var(--color-danger)" activeId="assets" onSelect={(next) => { window.location.assign(`/facility?tab=${next}`); }}>
    <Box className="facility-app" sx={{ display: "grid", gap: 2 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}><Button component={Link} href="/facility?tab=assets" startIcon={<ArrowLeft size={16} />}>Back to asset register</Button>{asset && <Box sx={{ display: "flex", gap: 1 }}><Button component={Link} href="/facility?tab=service-requests" variant="outlined">Report fault</Button><Button component={Link} href="/facility?tab=work-orders" variant="contained" startIcon={<Wrench size={16} />}>Create work order</Button></Box>}</Box>
      {error && <ErrorBanner message={error} onRetry={() => void load()} />}
      {loading ? <LoadingState rows={7} /> : asset && <>
        <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 3, display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr auto" }, gap: 2.5, alignItems: "center" }}>
          <Box><Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 1 }}><Chip label={String(asset.code)} color="primary" /><Chip label={String(asset.condition ?? "Not assessed")} variant="outlined" /><Chip label={String(asset.criticality ?? "medium") + " criticality"} variant="outlined" color={asset.criticality === "critical" ? "error" : "default"} /></Box><Typography variant="h5" sx={{ fontWeight: 900 }}>{String(asset.name)}</Typography><Typography color="text.secondary">{String(asset.property_name ?? "")} {asset.building_name ? `· ${asset.building_name}` : ""} {metadata.room ? `· ${metadata.room}` : ""}</Typography></Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}><QRCodeSVG value={`https://centerestates.com/facility/assets/${id}`} size={86} level="M" /><Typography variant="caption" color="text.secondary" sx={{ maxWidth: 120 }}>Scan to open this verified asset passport.</Typography></Box>
        </Paper>
        <Paper variant="outlined" sx={{ borderRadius: 2.5, overflow: "hidden" }}><Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" scrollButtons="auto" sx={{ "& .MuiTab-root": { textTransform: "none", fontWeight: 800 } }}>{tabs.map(label => <Tab key={label} label={label} />)}</Tabs></Paper>
        {tab === 0 && <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 2.5 }}><Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 900 }}>Asset overview</Typography><InfoGrid entries={[["Asset ID", asset.code], ["Asset tag", metadata.asset_tag], ["Category", asset.category], ["Type", metadata.asset_type], ["Class", asset.asset_class], ["Status", asset.is_active ? "Active" : "Inactive / draft"], ["Criticality", asset.criticality], ["Condition", asset.condition], ["Primary use", metadata.primary_use], ["Manufacturer", asset.manufacturer], ["Model", asset.model_number], ["Serial number", asset.serial_number]]} /></Paper>}
        {tab === 1 && <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 2.5 }}><Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 900 }}>Technical and location details</Typography><InfoGrid entries={[["Capacity / rating", metadata.capacity_rating], ["Voltage", metadata.voltage], ["Power rating", metadata.power_rating], ["Dimensions", metadata.dimensions], ["Technical specifications", metadata.technical_specifications], ["Building", asset.building_name ?? metadata.building_name], ["Block / wing", metadata.block_wing], ["Floor", metadata.floor], ["Zone", metadata.zone], ["Room / exact location", metadata.room], ["GPS coordinates", metadata.gps_coordinates], ["Responsible manager", metadata.responsible_manager]]} /></Paper>}
        {tab === 2 && <ListPanel title="Preventive maintenance schedules" rows={related.schedules} empty="No preventive schedule has been linked to this asset yet." />}
        {tab === 3 && <ListPanel title="Work-order history" rows={related.workOrders} empty="No work orders have been recorded for this asset." />}
        {tab === 4 && <ListPanel title="Inspection and condition history" rows={related.inspections} empty="No inspections have been recorded for this asset." />}
        {tab === 5 && <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 2.5 }}><Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 900 }}>Compliance, warranty and service contracts</Typography><InfoGrid entries={[["Warranty provider", metadata.warranty_provider], ["Warranty expiry", asset.warranty_expires_on], ["Service contract", asset.contractor_contract], ["Contract start", metadata.contract_start_date], ["Contract end", metadata.contract_end_date], ["Certificate / permit", metadata.compliance_certificate], ["Issuing authority", metadata.compliance_authority], ["Certificate expiry", metadata.certificate_expiry]]} /></Paper>}
        {tab === 6 && <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 2.5 }}><Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 900 }}>Costs and replacement planning</Typography><InfoGrid entries={[["Acquisition cost", money.format(Number(asset.purchase_value ?? 0))], ["Installation cost", money.format(Number(metadata.installation_cost ?? 0))], ["Current book value", money.format(Number(metadata.book_value ?? 0))], ["Replacement cost", money.format(Number(asset.replacement_cost ?? 0))], ["Useful life", `${asset.expected_useful_life_years ?? "—"} years`], ["Replacement date", asset.estimated_replacement_date], ["Replacement priority", metadata.replacement_priority], ["Budget status", metadata.budget_status], ["Funding source", asset.funding_source]]} /></Paper>}
        {tab === 7 && <Box sx={{ display: "grid", gap: 2 }}><ListPanel title="Asset documents and photos" rows={related.documents} empty="No manuals, warranties, certificates or photos have been uploaded yet." /><Alert icon={<ClipboardCheck size={18} />} severity="info">Changes, inspections, readings, maintenance and work orders remain in their audited source registers and are surfaced in this passport.</Alert></Box>}
      </>}
    </Box>
  </ModuleShell>;
}
