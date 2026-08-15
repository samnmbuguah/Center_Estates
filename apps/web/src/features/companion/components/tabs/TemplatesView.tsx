"use client";

import { EmptyState, LoadingState, SearchInput, StatusPill } from "@/components/module-ui";
import { Row } from "../../types/companion.types";

export function TemplatesView({
  templates,
  loading,
  search,
  setSearch,
  onOpenCreate,
}: {
  templates: Row[];
  loading: boolean;
  search: string;
  setSearch: (s: string) => void;
  onOpenCreate: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>Task Templates</h3>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search templates…" />
          <button className="btn primary sm" onClick={onOpenCreate}>Create Template</button>
        </div>
      </div>

      {loading ? (
        <LoadingState rows={4} />
      ) : templates.length === 0 ? (
        <EmptyState
          icon="📋"
          title="No templates yet"
          description="Create reusable task templates to quickly assign common work like inspections, approvals, or recurring duties."
          action={<button className="btn primary sm" onClick={onOpenCreate}>Create Template</button>}
        />
      ) : (
        <div className="card" style={{ padding: 18 }}>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Title template</th>
                  <th>Priority</th>
                  <th>Due in</th>
                  <th>SLA (hrs)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={String(t.id)}>
                    <td><strong style={{ fontSize: 13 }}>{String(t.name)}</strong></td>
                    <td style={{ fontSize: 13 }}>{String(t.title_template ?? "")}</td>
                    <td><StatusPill value={String(t.default_priority ?? "normal")} /></td>
                    <td className="mono">{String(t.default_days_to_due ?? "—")} days</td>
                    <td className="mono">{String(t.sla_hours ?? "—")}</td>
                    <td><StatusPill value={t.is_active ? "Active" : "Inactive"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
