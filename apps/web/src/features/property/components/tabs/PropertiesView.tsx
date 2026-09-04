"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Box, Button, Typography } from "@mui/material";
import {
  KpiCard, KpiStrip, StatusPill, Badge, Panel, EmptyState, LoadingState,
  Pagination, money, number,
} from "@/components/module-ui";
import { ListState } from "../PropertyToolbar";
import type {
  PropertyTab, Row, PropertyRow,
} from "../../types/property.types";
import {
  kM, kN, pct, occupancyTone,
} from "../../utils/property.utils";
import { Building2, DollarSign, Users, Layers, CheckCircle2, TrendingUp, Plus, FileText } from "lucide-react";
import { PropertyDossierModal } from "../modals/PropertyDossierModal";

export function PropertiesView({
  rows, loading, search, setSearch, setTab, onAdd, onAddSectionalTitle, onSelectRow,
}: {
  rows: Row[]; loading: boolean; search: string; setSearch: (v: string) => void;
  setTab: (t: PropertyTab) => void; onAdd: () => void; onAddSectionalTitle?: () => void; onSelectRow: (r: Row) => void;
}) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [selectedDossier, setSelectedDossier] = useState<PropertyRow | null>(null);

  const PAGE_SIZE = 20;
  const props = rows as PropertyRow[];
  const filtered = props;
  const pagedRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalUnits = props.reduce((s, p) => s + Number(p.units_count ?? 0), 0);
  const totalBuildings = props.reduce((s, p) => s + Number(p.buildings_count ?? 0), 0);
  const active = props.filter((p) => p.status === "active").length;
  const totalOccupied = props.reduce((s, p) => s + Number(p.occupied ?? 0), 0);
  const vacant = Math.max(totalUnits - totalOccupied, 0);
  const occupancyRate = totalUnits > 0 ? Math.round((totalOccupied / totalUnits) * 100) : 0;
  const totalMonthlyRent = props.reduce((sum, p) => sum + Number(p.monthly_rent || p.monthlyRent || 0), 0);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, width: "100%" }}>
      {/* Sleek Design System KPI Strip */}
      <KpiStrip cols={6}>
        <KpiCard
          icon={<Building2 size={16} />}
          label="Properties"
          value={props.length}
          sub="Portfolio assets"
          iconBg="rgba(59, 130, 246, 0.12)"
          iconColor="#3b82f6"
          borderColor="#3b82f6"
        />
        <KpiCard
          icon={<Layers size={16} />}
          label="Total Units"
          value={kN(totalUnits)}
          sub={`${totalOccupied} occupied`}
          iconBg="rgba(99, 102, 241, 0.12)"
          iconColor="#6366f1"
          borderColor="#6366f1"
        />
        <KpiCard
          icon={<Building2 size={16} />}
          label="Buildings"
          value={kN(totalBuildings)}
          sub="Blocks / wings"
          iconBg="rgba(245, 158, 11, 0.12)"
          iconColor="#f59e0b"
          borderColor="#f59e0b"
        />
        <KpiCard
          icon={<Users size={16} />}
          label="Occupancy Rate"
          value={`${occupancyRate}%`}
          sub={`${vacant} vacant unit${vacant === 1 ? "" : "s"}`}
          iconBg="rgba(16, 185, 129, 0.12)"
          iconColor="#10b981"
          borderColor="#10b981"
        />
        <KpiCard
          icon={<DollarSign size={16} />}
          label="Contracted Rent"
          value={money.format(totalMonthlyRent)}
          sub="Monthly target"
          iconBg="rgba(14, 165, 233, 0.12)"
          iconColor="#0ea5e9"
          borderColor="#0ea5e9"
        />
        <KpiCard
          icon={<CheckCircle2 size={16} />}
          label="Operational Status"
          value={active === props.length ? "Active" : `${active} / ${props.length}`}
          sub="All properties live"
          iconBg="rgba(34, 197, 94, 0.12)"
          iconColor="#22c55e"
          borderColor="#22c55e"
        />
      </KpiStrip>

      {/* Portfolio Table Panel */}
      <Panel
        title="Property Portfolio"
        action={
          <div style={{ display: "flex", gap: 8 }}>
            {onAddSectionalTitle && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<Building2 size={14} />}
                onClick={onAddSectionalTitle}
                sx={{
                  fontWeight: 700,
                  fontSize: 12,
                  borderColor: "#6366f1",
                  color: "#818cf8",
                  "&:hover": { borderColor: "#4f46e5", background: "rgba(99, 102, 241, 0.08)" },
                }}
              >
                Onboard Sectional Scheme
              </Button>
            )}
            <Button
              variant="contained"
              size="small"
              startIcon={<Plus size={14} />}
              onClick={onAdd}
              sx={{ fontWeight: 700, fontSize: 12 }}
            >
              Add Property
            </Button>
          </div>
        }
      >
        <ListState
          loading={loading}
          empty={filtered.length === 0}
          emptyTitle="No Accessible Properties"
          emptyDesc="No properties found in your scope. As a Property Manager, you have access to properties you create or those explicitly assigned to you by an organization administrator."
        >
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Type</th>
                  <th>Location</th>
                  <th>Units</th>
                  <th>Occupied</th>
                  <th>Occupancy %</th>
                  <th>Monthly Rent</th>
                  <th>Outstanding</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((p) => (
                  <tr key={String(p.id)} onClick={() => onSelectRow(p)} style={{ cursor: "pointer" }}>
                    <td>
                      <strong style={{ fontSize: 13, color: "var(--text)" }}>{String(p.name ?? "—")}</strong>
                      <div className="mono" style={{ fontSize: 11, color: "var(--primary)", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span>{String(p.code ?? "—")}</span>
                        {p.scheme_registration_number ? <span>• {p.scheme_registration_number}</span> : null}
                        {p.created_by_username ? (
                          <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 4, background: "rgba(37, 99, 235, 0.08)", color: "#1d4ed8", fontWeight: 700 }}>
                            @{p.created_by_username}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <span
                        className={p.is_sectional_title ? "badge badge-purple" : "badge badge-blue"}
                        style={{ textTransform: "capitalize", fontSize: 11 }}
                      >
                        {p.is_sectional_title ? "Sectional Scheme" : String(p.property_type ?? "Commercial").replace(/_/g, " ")}
                      </span>
                    </td>
                    <td style={{ fontSize: 12 }}>{String(p.city ?? p.location ?? "—")}</td>
                    <td className="mono" style={{ fontWeight: 700 }}>{kN(p.units_count)}</td>
                    <td className="mono">{p.occupied === undefined ? "—" : kN(p.occupied)}</td>
                    <td>
                      {p.occupancy === undefined ? (
                        <span className="muted">—</span>
                      ) : (
                        <Badge tone={occupancyTone(Number(p.occupancy))}>{pct(p.occupied, p.units_count)}%</Badge>
                      )}
                    </td>
                    <td className="mono" style={{ fontWeight: 700 }}>
                      {p.monthly_rent || p.monthlyRent ? kM(p.monthly_rent || p.monthlyRent) : "—"}
                    </td>
                    <td className="mono" style={{ color: Number(p.outstanding ?? 0) > 0 ? "var(--danger)" : "var(--muted)" }}>
                      {p.outstanding === undefined ? "—" : kM(p.outstanding)}
                    </td>
                    <td><StatusPill value={String(p.status ?? "active")} /></td>
                    <td style={{ textAlign: "right" }}>
                      <div className="row" style={{ gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <button
                          className="btn outline sm"
                          style={{ fontWeight: 700, fontSize: 11, borderColor: "var(--primary, #2563eb)", color: "var(--primary, #2563eb)", display: "inline-flex", alignItems: "center", gap: 4 }}
                          onClick={(e) => { e.stopPropagation(); setSelectedDossier(p); }}
                        >
                          <FileText size={12} /> Profile & Audit
                        </button>
                        <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); router.push(`/property-onboarding?edit=${p.id}`); }}>Edit</button>
                        <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); setTab("units"); }}>Units</button>
                        <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); setTab("tenants"); }}>Tenants</button>
                        <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); setTab("rent"); }}>Rent</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />
        </ListState>
      </Panel>

      {/* Property Profile & Onboarding Completeness Audit Modal */}
      {selectedDossier && (
        <PropertyDossierModal
          property={selectedDossier}
          onClose={() => setSelectedDossier(null)}
          onEdit={(id) => router.push(`/property-onboarding?edit=${id}`)}
        />
      )}
    </Box>
  );
}

