"use client";

import { useState } from "react";
import { DataTable, type DataTableColumn, ViewToolbar, Panel, Badge } from "@/components/module-ui";

export type TenantRow = {
  id: string;
  full_name?: string;
  tenant_name?: string;
  email?: string;
  phone_number?: string;
  phone?: string;
  national_id?: string;
  property_name?: string;
  unit_code?: string;
  status?: string;
  created_at?: string;
};

export function PropertyTenantsView({
  rows = [],
  loading = false,
  search = "",
  setSearch,
  onAddTenant,
  onSelectRow,
}: {
  rows?: TenantRow[];
  loading?: boolean;
  search?: string;
  setSearch?: (v: string) => void;
  onAddTenant?: () => void;
  onSelectRow?: (row: TenantRow) => void;
}) {
  const columns: DataTableColumn<TenantRow>[] = [
    {
      id: "name",
      header: "Tenant Name",
      accessor: (row) => (
        <span style={{ fontWeight: 800, color: "var(--text-primary)" }}>
          {row.full_name || row.tenant_name || "—"}
        </span>
      ),
    },
    {
      id: "email",
      header: "Email Address",
      accessor: (row) => row.email || "—",
    },
    {
      id: "phone",
      header: "Phone Number",
      accessor: (row) => row.phone_number || row.phone || "—",
    },
    {
      id: "property",
      header: "Property / Unit",
      accessor: (row) => (
        <span>
          {row.property_name || "—"} {row.unit_code ? `(${row.unit_code})` : ""}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      accessor: (row) => (
        <Badge tone={row.status === "inactive" ? "yellow" : "green"}>
          {row.status || "Active"}
        </Badge>
      ),
    },
  ];

  const filtered = rows.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (r.full_name || "").toLowerCase().includes(s) ||
      (r.email || "").toLowerCase().includes(s) ||
      (r.phone_number || "").toLowerCase().includes(s)
    );
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {setSearch && (
        <ViewToolbar
          title="Tenant Directory"
          subtitle="Manage active tenancies, contacts, and legal documentation"
          search={search}
          onSearch={setSearch}
          placeholder="Search tenant name, email, or phone…"
        >
          {onAddTenant && (
            <button className="btn primary sm" onClick={onAddTenant} style={{ fontWeight: 800 }}>
              + Add Tenant
            </button>
          )}
        </ViewToolbar>
      )}

      <Panel title="Tenants List">
        <DataTable
          rows={filtered}
          columns={columns}
          keyExtractor={(row, index) => row.id || index}
          emptyTitle="No tenants found"
          emptyDescription="Add a tenant to start managing lease agreements and rent collections."
          onRowClick={onSelectRow}
        />
      </Panel>
    </div>
  );
}
