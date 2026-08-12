"use client";

import { DataTable, type DataTableColumn, ViewToolbar, Panel, Badge } from "@/components/module-ui";

export type AssetRow = {
  id: string;
  code: string;
  name: string;
  category?: string;
  location?: string;
  status?: string;
  condition?: string;
};

export function FacilityAssetsView({
  rows = [],
  loading = false,
  search = "",
  setSearch,
  onAddAsset,
  onSelectRow,
}: {
  rows?: AssetRow[];
  loading?: boolean;
  search?: string;
  setSearch?: (v: string) => void;
  onAddAsset?: () => void;
  onSelectRow?: (row: AssetRow) => void;
}) {
  const columns: DataTableColumn<AssetRow>[] = [
    {
      id: "code",
      header: "Asset Tag",
      accessor: (row) => <span style={{ fontWeight: 800, color: "var(--text-primary)" }}>{row.code}</span>,
    },
    {
      id: "name",
      header: "Asset Name",
      accessor: (row) => <span style={{ fontWeight: 700 }}>{row.name}</span>,
    },
    {
      id: "category",
      header: "Category",
      accessor: (row) => row.category || "General",
    },
    {
      id: "location",
      header: "Location",
      accessor: (row) => row.location || "Main Building",
    },
    {
      id: "status",
      header: "Operational Status",
      accessor: (row) => (
        <Badge tone={row.status === "active" || row.status === "operational" ? "green" : row.status === "maintenance" ? "yellow" : "red"}>
          {(row.status || "operational").toUpperCase()}
        </Badge>
      ),
    },
  ];

  const filtered = rows.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (r.code || "").toLowerCase().includes(s) ||
      (r.name || "").toLowerCase().includes(s) ||
      (r.category || "").toLowerCase().includes(s)
    );
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {setSearch && (
        <ViewToolbar
          title="Asset & Equipment Register"
          subtitle="Manage plant equipment, warranties, and maintenance lifecycles"
          search={search}
          onSearch={setSearch}
          placeholder="Search asset tag, name, or category…"
        >
          {onAddAsset && (
            <button className="btn primary sm" onClick={onAddAsset} style={{ fontWeight: 800 }}>
              + Add Asset
            </button>
          )}
        </ViewToolbar>
      )}

      <Panel title="Assets Inventory">
        <DataTable
          rows={filtered}
          columns={columns}
          keyExtractor={(row, index) => row.id || index}
          emptyTitle="No assets found"
          emptyDescription="Register assets to track maintenance histories and warranties."
          onRowClick={onSelectRow}
        />
      </Panel>
    </div>
  );
}
