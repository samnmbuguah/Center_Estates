"use client";

import { useState } from "react";
import { Row } from "../../types/facility.types";
import { FcStatus } from "../FacilityToolbar";
import { exportCsv } from "../../utils/facility.utils";
import { EnhancedDataTable } from "@/components/enhanced-data-table";
import { Box, Button, Grid, Typography } from "@mui/material";
import { ClipboardList, Clock, AlertTriangle, TrendingUp, Wrench } from "lucide-react";

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
  const [currentTime] = useState(() => Date.now());

  const displayRows = rows;

  const totalReq = Number(kpis?.openRequests ?? rows.length);
  const openReq = rows.filter((r) => ["new", "approved", "assigned"].includes(String(r.status))).length;
  const inProgressReq = rows.filter((r) => String(r.status) === "in_progress").length;
  const overdueReq = rows.filter((r) => Boolean(r.response_due_at) && new Date(String(r.response_due_at)).getTime() < currentTime && !["resolved", "closed", "rejected"].includes(String(r.status))).length;

  return (
    <>
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, mb: 2 }}>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            Service Requests Management
          </Typography>
          {permissions.canWork && (
            <Button variant="contained" onClick={onAdd} startIcon={<Wrench size={18} />}>
              New Service Request
            </Button>
          )}
        </Box>
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
          { id: "reference", label: "Request ID", sortable: true, filterable: true },
          { id: "subject", label: "Subject", sortable: true, filterable: true },
          { id: "category", label: "Category", sortable: true, filterable: true },
          { id: "priority", label: "Priority", sortable: true, filterable: true },
          { id: "status", label: "Status", sortable: true, filterable: true, render: (value) => <FcStatus value={String(value)} /> },
          { id: "property_name", label: "Property", sortable: true, filterable: true },
          { id: "submitted_at", label: "Created", sortable: true, filterable: true },
          { id: "response_due_at", label: "Due Date", sortable: true, filterable: true },
          {
            id: "workflow_actions",
            label: "Workflow actions",
            render: (_value, row) => (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }} onClick={(event) => event.stopPropagation()}>
                {String(row.status) === "new" && permissions.canApprove && (
                  <>
                    <Button size="small" variant="contained" color="success" onClick={() => onAction(row, "approve")}>Approve</Button>
                    <Button size="small" variant="outlined" color="error" onClick={() => onAction(row, "reject")}>Reject</Button>
                  </>
                )}
                {String(row.status) === "approved" && permissions.canWork && (
                  <Button size="small" variant="contained" onClick={() => onAction(row, "convert")}>Create WO</Button>
                )}
                {["assigned", "in_progress"].includes(String(row.status)) && permissions.canWork && (
                  <Button size="small" variant="outlined" onClick={() => onAction(row, "resolve")}>Mark resolved</Button>
                )}
                {String(row.status) === "resolved" && (
                  <Typography variant="caption" color="warning.main" sx={{ fontWeight: 700 }}>Awaiting requester confirmation</Typography>
                )}
              </Box>
            ),
          },
        ]}
        loading={false}
        emptyTitle="No service requests"
        emptyDescription="Create a new service request to get started"
        onExport={(selectedRows) => exportCsv(selectedRows, "facility-service-requests.csv")}
        selectable
      />
    </>
  );
}
