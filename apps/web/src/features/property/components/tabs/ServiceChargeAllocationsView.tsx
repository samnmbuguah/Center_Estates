"use client";

import { useMemo, useState } from "react";
import {
  Paper,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography,
} from "@mui/material";
import { Badge, KpiCard, KpiStrip, Panel, StatusPill, money } from "@/components/module-ui";
import { ListState, ViewToolbar } from "../PropertyToolbar";
import type { Row, ServiceChargeAllocationRow } from "../../types/property.types";
import { kM, kN, exportCsv, shortId } from "../../utils/property.utils";
import { Layers, DollarSign, PieChart, Calculator, FileSpreadsheet } from "lucide-react";

export function ServiceChargeAllocationsView({
  rows = [],
  loading = false,
  search = "",
  setSearch,
}: {
  rows: Row[];
  loading: boolean;
  search: string;
  setSearch: (v: string) => void;
}) {
  const allocations = rows as ServiceChargeAllocationRow[];
  const [selectedSchemeFilter, setSelectedSchemeFilter] = useState<string>("all");

  const schemes = useMemo(() => {
    const list = new Set<string>();
    allocations.forEach((a) => {
      if (a.service_charge_name) list.add(String(a.service_charge_name));
    });
    return Array.from(list);
  }, [allocations]);

  const filteredAllocations = useMemo(() => {
    return allocations.filter((a) => {
      if (selectedSchemeFilter !== "all" && String(a.service_charge_name) !== selectedSchemeFilter) {
        return false;
      }
      if (!search) return true;
      const term = search.toLowerCase();
      return (
        String(a.service_charge_name ?? "").toLowerCase().includes(term) ||
        String(a.unit_code ?? "").toLowerCase().includes(term) ||
        String(a.id ?? "").toLowerCase().includes(term)
      );
    });
  }, [allocations, selectedSchemeFilter, search]);

  const totalAnnual = filteredAllocations.reduce((sum, a) => sum + Number(a.annual_amount ?? 0), 0);
  const totalMonthly = filteredAllocations.reduce((sum, a) => sum + Number(a.monthly_amount ?? 0), 0);
  const totalRatio = filteredAllocations.reduce((sum, a) => sum + Number(a.ratio ?? 0), 0);
  const avgMonthly = filteredAllocations.length > 0 ? totalMonthly / filteredAllocations.length : 0;

  function handleExport() {
    exportCsv(
      filteredAllocations as unknown as Row[],
      [
        { key: "id", label: "Allocation ID" },
        { key: "service_charge_name", label: "Scheme Name" },
        { key: "unit_code", label: "Unit Code" },
        { key: "ratio", label: "Share Ratio" },
        { key: "monthly_amount", label: "Monthly Amount (KES)" },
        { key: "annual_amount", label: "Annual Amount (KES)" },
      ],
      "service-charge-allocations-schedule.csv"
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <ViewToolbar
        title="Charge Allocations Ledger"
        subtitle="Apportioned unit-level monthly and annual service charge schedules"
        search={search}
        onSearch={setSearch}
        placeholder="Search by scheme name or unit code…"
      >
        <button
          className="btn ghost sm"
          style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700 }}
          onClick={handleExport}
          disabled={filteredAllocations.length === 0}
        >
          <FileSpreadsheet size={15} /> Export CSV Schedule
        </button>
      </ViewToolbar>

      {/* KPI Overview Strip */}
      <KpiStrip cols={4}>
        <KpiCard
          icon={<Layers size={16} />}
          label="Units Apportioned"
          value={`${kN(filteredAllocations.length)} Units`}
          sub={`Total Ratio: ${(totalRatio * 100).toFixed(2)}% ${Math.abs(totalRatio - 1) < 0.001 ? "✓ Balanced" : ""}`}
          iconBg="rgba(37, 99, 235, 0.12)"
          iconColor="var(--color-info)"
          borderColor="var(--color-info)"
        />
        <KpiCard
          icon={<DollarSign size={16} />}
          label="Annual Budget Pool"
          value={money.format(totalAnnual)}
          sub="Sum of active unit charges"
          iconBg="rgba(217, 119, 6, 0.12)"
          iconColor="var(--color-warning)"
          borderColor="var(--color-warning)"
        />
        <KpiCard
          icon={<Calculator size={16} />}
          label="Monthly Billable Pool"
          value={money.format(totalMonthly)}
          sub="Injected onto monthly bills"
          iconBg="rgba(14, 165, 233, 0.12)"
          iconColor="#0ea5e9"
          borderColor="#0ea5e9"
        />
        <KpiCard
          icon={<PieChart size={16} />}
          label="Avg Unit Monthly Charge"
          value={money.format(avgMonthly)}
          sub="Per billable tenancy"
          iconBg="rgba(16, 185, 129, 0.12)"
          iconColor="var(--color-emerald)"
          borderColor="var(--color-emerald)"
        />
      </KpiStrip>

      <Panel
        title="Unit Apportionment Schedules"
        action={
          schemes.length > 1 ? (
            <div className="row" style={{ gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 700 }}>Filter Scheme:</span>
              <select
                className="input sm"
                style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, fontWeight: 600 }}
                value={selectedSchemeFilter}
                onChange={(e) => setSelectedSchemeFilter(e.target.value)}
              >
                <option value="all">All Schemes ({schemes.length})</option>
                {schemes.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          ) : undefined
        }
      >
        <ListState
          loading={loading}
          empty={filteredAllocations.length === 0}
          emptyTitle="No allocations found"
          emptyDesc="Generate allocations from a service charge to apportion its budget across property units."
        >
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: "action.hover" }}>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Allocation Ref</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Cost Centre Scheme</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Unit Code</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Apportionment Ratio</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Monthly Charge</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Annual Allocation</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "text.secondary" }}>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredAllocations.map((a) => (
                  <TableRow key={String(a.id)} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace", color: "primary.main", fontWeight: 700 }}>
                        {shortId(a.id)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{String(a.service_charge_name ?? "—")}</Typography>
                      {a.property_name && <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>{String(a.property_name)}</Typography>}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace", fontWeight: 700 }}>
                        {String(a.unit_code ?? "—")}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace", color: "text.secondary", fontWeight: 700 }}>
                        {(Number(a.ratio ?? 0) * 100).toFixed(4)}%
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace", color: "primary.main", fontWeight: 800 }}>
                        {money.format(Number(a.monthly_amount ?? 0))}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontFamily: "ui-monospace, monospace", fontWeight: 700 }}>
                        {money.format(Number(a.annual_amount ?? 0))}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Badge tone="green">Active In Schedule</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </ListState>
      </Panel>
    </div>
  );
}
