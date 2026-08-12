"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Chip, MenuItem, Paper, Tab, Tabs, TextField, Typography } from "@mui/material";
import { useAuth } from "@/components/auth-provider";
import { apiErrorMessage, apiFetch } from "@/lib/api";
import { EmptyState, LoadingState, money } from "@/components/module-ui";
import { PropertyReportLibrary } from "@/components/property-report-library";
import {
  CriticalReportCards, ExportFormat, PeriodFilterBar, ReportDataTable, ReportToolbar,
} from "@/components/property-report-shared";

type ReportData = {
  period: { start: string; end: string };
  kpis: Record<string, string | number>;
  unit_status_distribution: Array<{ status: string; count: number }>;
  tenancy_schedule: Array<Record<string, string | number | null>>;
  vacant_units: Array<Record<string, string | number | null>>;
  movements: Array<Record<string, string | number | null>>;
  lease_expiry: Array<Record<string, string | number | null>>;
  filter_options: { unit_types: string[]; unit_statuses: string[]; lease_statuses: string[] };
};

const sections = ["Overview", "Tenancy schedule", "Vacancy", "Move ins / move outs", "Income analysis", "Lease expiry", "Custom reports"];
const exportKinds = ["occupancy", "tenancy-schedule", "vacancy", "movements", "income-analysis", "lease-expiry"];

export function PropertyTenancyReports() {
  const { session } = useAuth();
  const organizationId = session?.activeOrganizationId ?? null;
  const now = new Date();
  const [section, setSection] = useState(0);
  const [start, setStart] = useState(`${now.getFullYear()}-01-01`);
  const [end, setEnd] = useState(now.toISOString().slice(0, 10));
  const [unitType, setUnitType] = useState("");
  const [unitStatus, setUnitStatus] = useState("");
  const [leaseStatus, setLeaseStatus] = useState("");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("pdf");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const query = useMemo(() => new URLSearchParams({
    start, end,
    ...(unitType && { unit_type: unitType }),
    ...(unitStatus && { unit_status: unitStatus }),
    ...(leaseStatus && { lease_status: leaseStatus }),
  }).toString(), [end, leaseStatus, start, unitStatus, unitType]);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true); setError("");
    const response = await apiFetch(`/property/analytics/tenancy-occupancy/?${query}`, {}, organizationId);
    if (!response.ok) setError(await apiErrorMessage(response, "Tenancy reporting data could not be loaded."));
    else setData(await response.json() as ReportData);
    setLoading(false);
  }, [organizationId, query]);

  useEffect(() => { void load(); }, [load]);

  async function exportReport(kind?: string, format?: ExportFormat) {
    if (!organizationId) return;
    const reportKind = kind ?? exportKinds[section] ?? "occupancy";
    const output = format ?? exportFormat;
    setExporting(true); setError(""); setNotice("");
    const response = await apiFetch(`/property/analytics/exports/${reportKind}/?${query}&output=${output}`, {}, organizationId);
    if (!response.ok) {
      setError(await apiErrorMessage(response, "The report could not be exported."));
      setExporting(false);
      return;
    }
    const disposition = response.headers.get("content-disposition") ?? "";
    const filename = disposition.match(/filename="?([^";]+)"?/)?.[1] ?? `${reportKind}-${start}-${end}.${output}`;
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url; link.download = filename; link.click();
    URL.revokeObjectURL(url);
    setNotice(`${reportKind.replaceAll("-", " ")} exported as ${output.toUpperCase()}.`);
    setExporting(false);
  }

  if (loading && !data) return <LoadingState rows={8} />;
  const kpi = data?.kpis ?? {};
  const rows = section === 1 ? data?.tenancy_schedule
    : section === 2 ? data?.vacant_units
      : section === 3 ? data?.movements
        : section === 5 ? data?.lease_expiry
          : [];
  const columns = rows?.length ? Object.keys(rows[0]) : [];
  const schedule = data?.tenancy_schedule ?? [];

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <ReportToolbar
        title="Tenancy & occupancy reports"
        subtitle="Live occupancy, vacancy, movements, income and lease-expiry analysis for the selected property."
        exportFormat={exportFormat}
        onFormatChange={setExportFormat}
        onExport={() => void exportReport()}
        exporting={exporting}
        exportDisabled={section === 6}
      />
      <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>
        <Tabs value={section} onChange={(_, value) => setSection(value)} variant="scrollable" scrollButtons="auto">
          {sections.map(label => <Tab key={label} label={label} />)}
        </Tabs>
      </Paper>
      {error && <Alert severity="error" action={<Button color="inherit" onClick={() => void load()}>Retry</Button>}>{error}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice("")}>{notice}</Alert>}
      <PeriodFilterBar
        start={start}
        end={end}
        onStart={setStart}
        onEnd={setEnd}
        onApply={() => void load()}
        extra={<>
          <TextField select size="small" label="Unit type" value={unitType} onChange={event => setUnitType(event.target.value)} sx={{ minWidth: 140 }}>
            <MenuItem value="">All types</MenuItem>
            {data?.filter_options.unit_types.map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Unit status" value={unitStatus} onChange={event => setUnitStatus(event.target.value)} sx={{ minWidth: 140 }}>
            <MenuItem value="">All statuses</MenuItem>
            {data?.filter_options.unit_statuses.map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Tenancy status" value={leaseStatus} onChange={event => setLeaseStatus(event.target.value)} sx={{ minWidth: 150 }}>
            <MenuItem value="">All statuses</MenuItem>
            {data?.filter_options.lease_statuses.map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}
          </TextField>
        </>}
      />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,1fr)", lg: "repeat(6,1fr)" }, gap: 1.25 }}>
        {[
          ["Total units", kpi.total_units],
          ["Occupied units", kpi.occupied_units],
          ["Vacant units", kpi.vacant_units],
          ["Occupancy rate", `${kpi.occupancy_rate ?? 0}%`],
          ["Potential income", money.format(Number(kpi.current_monthly_income ?? 0))],
          ["Overdue tenants", kpi.overdue_tenants],
        ].map(([label, value]) => (
          <Paper key={String(label)} variant="outlined" sx={{ p: 1.75, borderRadius: 3, borderTop: 3, borderTopColor: "primary.main" }}>
            <Typography variant="caption" color="text.primary" sx={{ fontWeight: 800 }}>{label}</Typography>
            <Typography variant="h6" sx={{ fontWeight: 900 }}>{value}</Typography>
          </Paper>
        ))}
      </Box>

      {section === 0 && (
        <Box sx={{ display: "grid", gap: 2 }}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 2 }}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
              <Typography sx={{ fontWeight: 900, mb: 2 }}>Unit status distribution</Typography>
              {(data?.unit_status_distribution ?? []).length ? data?.unit_status_distribution.map(row => (
                <Box key={row.status} sx={{ display: "flex", justifyContent: "space-between", py: 1, borderBottom: 1, borderColor: "divider" }}>
                  <Chip size="small" label={row.status} /><strong>{row.count}</strong>
                </Box>
              )) : <Typography color="text.primary" sx={{ fontWeight: 800 }}>No units in the selected scope.</Typography>}
            </Paper>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
              <Typography sx={{ fontWeight: 900 }}>Income outlook</Typography>
              <Typography variant="h4" color="success.main" sx={{ fontWeight: 900, mt: 2 }}>
                {money.format(Number(kpi.projected_monthly_income_90_days ?? 0))}
              </Typography>
              <Typography color="text.primary" sx={{ fontWeight: 800 }}>
                Projected monthly income within 90 days, including effective rent escalations.
              </Typography>
              <Typography variant="body2" sx={{ mt: 2 }}>
                Current monthly income: <strong>{money.format(Number(kpi.current_monthly_income ?? 0))}</strong>
              </Typography>
              <Typography variant="body2" color="error.main">
                Overdue amount: <strong>{money.format(Number(kpi.overdue_amount ?? 0))}</strong>
              </Typography>
            </Paper>
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 900, mb: 1.25 }}>Critical tenancy packs</Typography>
            <CriticalReportCards
              onExport={(key, format) => void exportReport(key, format)}
              items={[
                { key: "tenancy-schedule", title: "Tenancy schedule", description: "Floor, unit, tenant, rent, service charge, escalation and lease status." },
                { key: "vacancy", title: "Vacancy register", description: "Vacant units with ageing, expected rent and marketing status." },
                { key: "movements", title: "Move-ins / move-outs", description: "Tenant movements in the selected reporting period." },
                { key: "lease-expiry", title: "Lease expiry", description: "Upcoming expiries for renewals and notice planning." },
              ]}
            />
          </Box>
        </Box>
      )}

      {section === 4 && (
        <Box sx={{ display: "grid", gap: 2 }}>
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
            <Typography sx={{ fontWeight: 900 }}>Monthly income analysis</Typography>
            <Typography variant="h3" color="success.main" sx={{ fontWeight: 900, my: 2 }}>
              {money.format(Number(kpi.current_monthly_income ?? 0))}
            </Typography>
            <Typography color="text.primary" sx={{ fontWeight: 800 }}>
              Current effective monthly rent for active tenancies. Projected in 90 days: {money.format(Number(kpi.projected_monthly_income_90_days ?? 0))}.
            </Typography>
          </Paper>
          <ReportDataTable
            rows={schedule.map(row => ({
              property: row.property, unit: row.unit, tenant: row.tenant, use: row.use,
              monthly_rent: row.monthly_rent, service_charge: row.service_charge,
              annualized_income: Number(row.monthly_rent ?? 0) + Number(row.service_charge ?? 0),
              escalation_percent: row.escalation_percent, next_effective_rent: row.next_effective_rent, status: row.status,
            }))}
            columns={["property", "unit", "tenant", "use", "monthly_rent", "service_charge", "annualized_income", "escalation_percent", "next_effective_rent", "status"]}
          />
        </Box>
      )}

      {section > 0 && section !== 4 && section !== 6 && (
        !rows?.length
          ? <EmptyState title={`No ${sections[section].toLowerCase()} records`} description="No records match the selected property, period and filters. Adjust filters or widen the period." />
          : <ReportDataTable rows={rows} columns={columns} />
      )}
      {section === 6 && <PropertyReportLibrary domain="tenancy" />}
    </Box>
  );
}
