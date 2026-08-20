"use client";

import { useState } from "react";
import { Row } from "../../types/facility.types";
import { FcStatus } from "../FacilityToolbar";
import { EnhancedDataTable } from "@/components/enhanced-data-table";
import { Box, Grid, Typography } from "@mui/material";
import { ClipboardList, Clock, CheckCircle, AlertTriangle, Users, TrendingUp, Download, Wrench } from "lucide-react";

export function ServiceRequestsView({
  rows,
  kpis,
  onAction,
  permissions,
  onAdd,
}: {
  rows: Row[];
  kpis: Record<string, string | number>;
  onAction: (row: Row, action: string) => void;
  permissions: { canWork: boolean; canApprove: boolean };
  onAdd: () => void;
}) {
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);

  const displayRows = rows;

  const priorityColors: Record<string, string> = { high: "#b91c1c", medium: "#a16207", low: "#15803d" };
  const catIcons: Record<string, string> = { "Plumbing": "💧", "Electrical": "⚡", "HVAC": "❄️", "Fire Safety": "🔥", "Carpentry": "🪚", "General": "🔧" };

  const hasData = rows.length > 0;
  const totalReq = Number(kpis?.openRequests ?? rows.length);
  const openReq = rows.filter((r) => ["new", "approved", "assigned"].includes(String(r.status))).length;
  const inProgressReq = rows.filter((r) => String(r.status) === "in_progress").length;
  const completedReq = rows.filter((r) => ["resolved", "closed"].includes(String(r.status))).length;
  const overdueReq = rows.filter((r) => Boolean(r.response_due_at) && new Date(String(r.response_due_at)).getTime() < Date.now() && !["resolved", "closed", "rejected"].includes(String(r.status))).length;

  return (
    <>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 2 }}>
          Service Requests Management
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Box sx={{ 
              p: 2, borderRadius: 2, bgcolor: "#4f46e5", color: "white",
              textAlign: "center"
            }}>
              <ClipboardList size={24} style={{ marginBottom: 8 }} />
              <Typography variant="h3" sx={{ fontWeight: 800 }}>{totalReq}</Typography>
              <Typography variant="caption">Open Requests</Typography>
            </Box>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Box sx={{ 
              p: 2, borderRadius: 2, bgcolor: "#f59e0b", color: "white",
              textAlign: "center"
            }}>
              <Clock size={24} style={{ marginBottom: 8 }} />
              <Typography variant="h3" sx={{ fontWeight: 800 }}>{openReq}</Typography>
              <Typography variant="caption">New & Assigned</Typography>
            </Box>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Box sx={{ 
              p: 2, borderRadius: 2, bgcolor: "#3b82f6", color: "white",
              textAlign: "center"
            }}>
              <TrendingUp size={24} style={{ marginBottom: 8 }} />
              <Typography variant="h3" sx={{ fontWeight: 800 }}>{inProgressReq}</Typography>
              <Typography variant="caption">In Progress</Typography>
            </Box>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Box sx={{ 
              p: 2, borderRadius: 2, bgcolor: overdueReq > 0 ? "#ef4444" : "#22c55e", color: "white",
              textAlign: "center"
            }}>
              <AlertTriangle size={24} style={{ marginBottom: 8 }} />
              <Typography variant="h3" sx={{ fontWeight: 800 }}>{overdueReq}</Typography>
              <Typography variant="caption">Overdue</Typography>
            </Box>
          </Grid>
        </Grid>
      </Box>

      <EnhancedDataTable
        data={displayRows}
        columns={[
          { id: "request_id", label: "Request ID", sortable: true, filterable: true },
          { id: "category", label: "Category", sortable: true, filterable: true },
          { id: "priority", label: "Priority", sortable: true, filterable: true },
          { id: "status", label: "Status", sortable: true, filterable: true },
          { id: "location", label: "Location", sortable: true, filterable: true },
          { id: "created_at", label: "Created", sortable: true, filterable: true },
          { id: "response_due_at", label: "Due Date", sortable: true, filterable: true },
        ]}
        loading={false}
        emptyTitle="No service requests"
        emptyDescription="Create a new service request to get started"
        onRowClick={(row) => setSelectedRow(row)}
        onEdit={(row) => {/* Handle edit */}}
        onDelete={(row) => {/* Handle delete */}}
        onExport={(selectedRows) => {/* Handle export */}}
        selectable
        bulkActions={[
          {
            label: "Export Selected",
            icon: <Download size={16} />,
            action: (rows) => {/* Handle export */},
            color: "primary"
          },
          {
            label: "Mark as Completed",
            icon: <CheckCircle size={16} />,
            action: (rows) => {/* Handle bulk completion */},
            color: "success"
          },
          {
            label: "Assign to Staff",
            icon: <Users size={16} />,
            action: (rows) => {/* Handle bulk assignment */},
            color: "secondary"
          }
        ]}
      />
    </>
  );
}