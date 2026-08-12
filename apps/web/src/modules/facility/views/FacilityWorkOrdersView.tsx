"use client";

import { DataTable, type DataTableColumn, ViewToolbar, Panel, Badge } from "@/components/module-ui";

export type WorkOrderRow = {
  id: string;
  work_order_number: string;
  title: string;
  facility_name?: string;
  priority?: string;
  assigned_to_name?: string;
  status?: string;
  created_at?: string;
};

export function FacilityWorkOrdersView({
  rows = [],
  loading = false,
  search = "",
  setSearch,
  onCreateWorkOrder,
  onSelectRow,
}: {
  rows?: WorkOrderRow[];
  loading?: boolean;
  search?: string;
  setSearch?: (v: string) => void;
  onCreateWorkOrder?: () => void;
  onSelectRow?: (row: WorkOrderRow) => void;
}) {
  const columns: DataTableColumn<WorkOrderRow>[] = [
    {
      id: "number",
      header: "WO Number",
      accessor: (row) => <span style={{ fontWeight: 800, color: "var(--text-primary)" }}>{row.work_order_number}</span>,
    },
    {
      id: "title",
      header: "Title & Issue",
      accessor: (row) => <span style={{ fontWeight: 700 }}>{row.title}</span>,
    },
    {
      id: "facility",
      header: "Facility / Location",
      accessor: (row) => row.facility_name || "—",
    },
    {
      id: "priority",
      header: "Priority",
      accessor: (row) => (
        <Badge tone={row.priority === "high" || row.priority === "urgent" ? "red" : row.priority === "medium" ? "yellow" : "blue"}>
          {(row.priority || "normal").toUpperCase()}
        </Badge>
      ),
    },
    {
      id: "assigned",
      header: "Assigned Contractor",
      accessor: (row) => row.assigned_to_name || "Unassigned",
    },
    {
      id: "status",
      header: "Status",
      accessor: (row) => (
        <Badge tone={row.status === "completed" ? "green" : row.status === "in_progress" ? "blue" : "yellow"}>
          {(row.status || "open").replace(/_/g, " ").toUpperCase()}
        </Badge>
      ),
    },
  ];

  const filtered = rows.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (r.work_order_number || "").toLowerCase().includes(s) ||
      (r.title || "").toLowerCase().includes(s) ||
      (r.facility_name || "").toLowerCase().includes(s)
    );
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {setSearch && (
        <ViewToolbar
          title="Maintenance Work Orders"
          subtitle="Track reactive repairs, SLA targets, and contractor assignments"
          search={search}
          onSearch={setSearch}
          placeholder="Search work order number, title, or facility…"
        >
          {onCreateWorkOrder && (
            <button className="btn primary sm" onClick={onCreateWorkOrder} style={{ fontWeight: 800 }}>
              + New Work Order
            </button>
          )}
        </ViewToolbar>
      )}

      <Panel title="Work Orders Queue">
        <DataTable
          rows={filtered}
          columns={columns}
          keyExtractor={(row, index) => row.id || index}
          emptyTitle="No work orders found"
          emptyDescription="Create a new work order to dispatch maintenance teams."
          onRowClick={onSelectRow}
        />
      </Panel>
    </div>
  );
}
