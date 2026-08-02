"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/module-shell";
import { facilityNav } from "@/lib/module-nav";
import { apiFetch } from "@/lib/api";

type WorkOrderRow = Record<string, string | number | boolean | null>;

export default function WorkOrdersPage() {
  const [workOrders, setWorkOrders] = useState<WorkOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    apiFetch("/facilities/work-orders/")
      .then(async (res) => {
        if (active && res.ok) {
          const data = (await res.json()) as WorkOrderRow[];
          setWorkOrders(data || []);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = workOrders.filter((w) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      String(w.title || "").toLowerCase().includes(term) ||
      String(w.number || "").toLowerCase().includes(term) ||
      String(w.priority || "").toLowerCase().includes(term)
    );
  });

  return (
    <ModuleShell
      moduleKey="facility"
      moduleName="Facility Management"
      eyebrow="Maintenance Dispatch"
      title="Work Orders & Service Requests"
      subtitle="Corrective and preventive maintenance work orders, technician assignment, labor/parts cost tracking."
      accent="#16a34a"
      groups={facilityNav}
      activeId="work-orders"
      onSelect={(id) => {
        if (id === "overview") window.location.href = "/facility";
        else window.location.href = `/facility?tab=${id}`;
      }}
      contextLabel="Dispatch Scope"
      contextValue={`${workOrders.length} Work Orders`}
    >
      <div className="facility-app">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, alignItems: "center" }}>
          <input
            type="text"
            placeholder="Search work order by title, number, priority..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: "8px 14px", width: 320, borderRadius: 6, border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
          />
          <Link
            href="/facility?tab=work-orders"
            style={{ background: "#16a34a", color: "#fff", padding: "8px 16px", borderRadius: 6, textDecoration: "none", fontWeight: 600, fontSize: "0.85rem" }}
          >
            + Create Work Order
          </Link>
        </div>

        {loading ? (
          <div className="data-loading">Loading work order board…</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", background: "#fff", borderRadius: 8, overflow: "hidden", border: "1px solid #e2e8f0" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                <th style={{ padding: 10, textAlign: "left" }}>WO Number</th>
                <th style={{ padding: 10, textAlign: "left" }}>Title / Issue</th>
                <th style={{ padding: 10, textAlign: "center" }}>Priority</th>
                <th style={{ padding: 10, textAlign: "center" }}>Status</th>
                <th style={{ padding: 10, textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((wo) => (
                <tr key={String(wo.id)} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: 10, fontWeight: "bold", fontFamily: "monospace", color: "#16a34a" }}>
                    {String(wo.number || `WO-${wo.id}`)}
                  </td>
                  <td style={{ padding: 10, fontWeight: 600 }}>{String(wo.title || "Facility Maintenance")}</td>
                  <td style={{ padding: 10, textAlign: "center" }}>
                    <span style={{
                      padding: "2px 8px", borderRadius: 4, fontSize: "0.75rem", fontWeight: "bold",
                      background: String(wo.priority) === "urgent" ? "#fee2e2" : "#fef3c7",
                      color: String(wo.priority) === "urgent" ? "#991b1b" : "#92400e"
                    }}>
                      {String(wo.priority || "normal").toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: 10, textAlign: "center" }}>
                    <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: "0.75rem", fontWeight: "bold", background: "#dbeafe", color: "#1e40af" }}>
                      {String(wo.status || "open").replace("_", " ").toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: 10, textAlign: "right" }}>
                    <Link href={`/facility/work-orders/${wo.id}`} style={{ color: "#16a34a", fontWeight: 600, textDecoration: "none" }}>
                      View Order $\rightarrow$
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </ModuleShell>
  );
}
