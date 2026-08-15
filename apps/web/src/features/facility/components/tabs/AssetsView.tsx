"use client";

import { useState } from "react";
import { money } from "@/components/module-ui";
import { Row } from "../../types/facility.types";
import { exportCsv } from "../../utils/facility.utils";
import { FcStatus, HealthBar } from "../FacilityToolbar";
import { EnhancedDataTable } from "@/components/enhanced-data-table";
import { BreadcrumbNavigation } from "@/components/breadcrumb-navigation";
import { Box, Grid, Typography } from "@mui/material";
import { Building2, Wrench, AlertTriangle, CheckCircle, TrendingUp, Download } from "lucide-react";

function FcKpiCard({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  sub,
}: {
  icon: string;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="fc-kpi-card" style={{ textAlign: "left" }}>
      <div className="fc-kpi-top">
        <span className="fc-kpi-icon" style={{ background: iconBg, color: iconColor }}>
          {icon}
        </span>
        <span className="fc-kpi-label">{label}</span>
      </div>
      <strong className="fc-kpi-value">{value}</strong>
      {sub && <span className="fc-kpi-sub">{sub}</span>}
    </div>
  );
}

export function AssetsView({
  rows,
  kpis,
  onAdd,
}: {
  rows: Row[];
  kpis: Record<string, string | number>;
  onAdd: () => void;
}) {
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);

  const assetIcons: Record<string, string> = {
    "Lift Systems": "🛗",
    "HVAC": "❄️",
    "Electrical": "⚡",
    "Plumbing": "🚿",
    "Security": "🔒",
    "Fire Safety": "🔥",
    "Other": "📦",
  };

  const displayRows = rows || [];
  const totalAssets = displayRows.length;
  const operationalAssets = displayRows.filter(r => r.status === "operational").length;
  const maintenanceRequired = displayRows.filter(r => r.status === "maintenance").length;
  const avgHealthScore = displayRows.length > 0 
    ? Math.round(displayRows.reduce((sum, r) => sum + Number(r.health_score || 0), 0) / displayRows.length)
    : 0;

  return (
    <>
      <BreadcrumbNavigation />
      
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 2 }}>
          Facility Assets Management
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ 
              p: 2, borderRadius: 2, bgcolor: "#22c55e", color: "white",
              textAlign: "center"
            }}>
              <Building2 size={24} style={{ marginBottom: 8 }} />
              <Typography variant="h3" sx={{ fontWeight: 800 }}>{totalAssets}</Typography>
              <Typography variant="caption">Total Assets</Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ 
              p: 2, borderRadius: 2, bgcolor: "#16a34a", color: "white",
              textAlign: "center"
            }}>
              <CheckCircle size={24} style={{ marginBottom: 8 }} />
              <Typography variant="h3" sx={{ fontWeight: 800 }}>{operationalAssets}</Typography>
              <Typography variant="caption">Operational</Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ 
              p: 2, borderRadius: 2, bgcolor: "#f59e0b", color: "white",
              textAlign: "center"
            }}>
              <Wrench size={24} style={{ marginBottom: 8 }} />
              <Typography variant="h3" sx={{ fontWeight:800 }}>{maintenanceRequired}</Typography>
              <Typography variant="caption">Maintenance Required</Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ 
              p: 2, borderRadius: 2, bgcolor: avgHealthScore > 70 ? "#22c55e" : "#ef4444", color: "white",
              textAlign: "center"
            }}>
              <TrendingUp size={24} style={{ marginBottom: 8 }} />
              <Typography variant="h3" sx={{ fontWeight: 800 }}>{avgHealthScore}%</Typography>
              <Typography variant="caption">Avg Health Score</Typography>
            </Box>
          </Grid>
        </Grid>
      </Box>

      <EnhancedDataTable
        data={displayRows}
        columns={[
          { id: "asset_id", label: "Asset ID", sortable: true, filterable: true },
          { id: "name", label: "Asset Name", sortable: true, filterable: true },
          { id: "category", label: "Category", sortable: true, filterable: true },
          { id: "location", label: "Location", sortable: true, filterable: true },
          { id: "status", label: "Status", sortable: true, filterable: true },
          { id: "condition", label: "Condition", sortable: true, filterable: true },
          { id: "health_score", label: "Health Score", sortable: true, align: "center" },
        ]}
        loading={false}
        emptyTitle="No assets registered yet"
        emptyDescription="Click 'Add New Asset' to register equipment or fixtures"
        onRowClick={(row) => setSelectedRow(row)}
        onEdit={(row) => {/* Handle edit */}}
        onDelete={(row) => {/* Handle delete */}}
        onExport={(selectedRows) => exportCsv(selectedRows, "assets.csv")}
        selectable
        bulkActions={[
          {
            label: "Export Selected",
            icon: <Download size={16} />,
            action: (rows) => exportCsv(rows, "assets.csv"),
            color: "primary"
          },
          {
            label: "Mark as Operational",
            icon: <CheckCircle size={16} />,
            action: (rows) => {/* Handle bulk status update */},
            color: "success"
          },
          {
            label: "Schedule Maintenance",
            icon: <Wrench size={16} />,
            action: (rows) => {/* Handle bulk maintenance scheduling */},
            color: "warning"
          }
        ]}
      />
    </>
  );
}