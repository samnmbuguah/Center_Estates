"use client";

import { DataTable, type DataTableColumn, ViewToolbar, Panel, Badge } from "@/components/module-ui";

export type UnitRow = {
  id: string;
  code: string;
  property_name?: string;
  floor?: string | number;
  size_sqft?: number;
  monthly_rent?: number;
  status?: string;
};

export function PropertyUnitsView({
  rows = [],
  loading = false,
  search = "",
  setSearch,
  onSelectRow,
}: {
  rows?: UnitRow[];
  loading?: boolean;
  search?: string;
  setSearch?: (v: string) => void;
  onSelectRow?: (row: UnitRow) => void;
}) {
  const money = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 });

  const columns: DataTableColumn<UnitRow>[] = [
    {
      id: "code",
      header: "Unit Code",
      accessor: (row) => <span style={{ fontWeight: 800, color: "var(--text-primary)" }}>{row.code}</span>,
    },
    {
      id: "property",
      header: "Property",
      accessor: (row) => row.property_name || "—",
    },
    {
      id: "floor",
      header: "Floor",
      accessor: (row) => row.floor ?? "—",
    },
    {
      id: "size",
      header: "Size (sqft)",
      accessor: (row) => (row.size_sqft ? `${row.size_sqft.toLocaleString()} sqft` : "—"),
    },
    {
      id: "rent",
      header: "Target Rent",
      accessor: (row) => (row.monthly_rent ? money.format(row.monthly_rent) : "—"),
    },
    {
      id: "status",
      header: "Occupancy Status",
      accessor: (row) => (
        <Badge tone={row.status === "occupied" ? "green" : row.status === "maintenance" ? "yellow" : "blue"}>
          {row.status ? row.status.toUpperCase() : "VACANT"}
        </Badge>
      ),
    },
  ];

  const filtered = rows.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (r.code || "").toLowerCase().includes(s) || (r.property_name || "").toLowerCase().includes(s);
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {setSearch && (
        <ViewToolbar
          title="Units & Space Inventory"
          subtitle="View unit occupancy, floor space, and market rent tariffs"
          search={search}
          onSearch={setSearch}
          placeholder="Search unit code or property name…"
        />
      )}

      <Panel title="Unit Inventory">
        <DataTable
          rows={filtered}
          columns={columns}
          keyExtractor={(row, index) => row.id || index}
          emptyTitle="No units found"
          emptyDescription="Onboard properties to populate unit inventory."
          onRowClick={onSelectRow}
        />
      </Panel>
    </div>
  );
}
