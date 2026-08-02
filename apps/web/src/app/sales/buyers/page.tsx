"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/module-shell";
import { salesNav } from "@/lib/module-nav";
import { apiFetch } from "@/lib/api";

type BuyerRow = Record<string, string | number | boolean | null>;

export default function BuyersDirectoryPage() {
  const [buyers, setBuyers] = useState<BuyerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    apiFetch("/sales/buyers/")
      .then(async (res) => {
        if (active && res.ok) {
          const data = (await res.json()) as BuyerRow[];
          setBuyers(data || []);
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

  const filtered = buyers.filter((b) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      String(b.first_name || "").toLowerCase().includes(term) ||
      String(b.last_name || "").toLowerCase().includes(term) ||
      String(b.email || "").toLowerCase().includes(term) ||
      String(b.id_number || "").toLowerCase().includes(term)
    );
  });

  return (
    <ModuleShell
      moduleKey="sales"
      moduleName="Sales & Marketing"
      eyebrow="Buyer CRM"
      title="Buyer & Client Directory"
      subtitle="Registered property buyers, KYC documents, selected units, and sales lead status."
      accent="#e23b3b"
      groups={salesNav}
      activeId="buyers"
      onSelect={(id) => {
        if (id === "overview") window.location.href = "/sales";
        else window.location.href = `/sales?tab=${id}`;
      }}
      contextLabel="Buyers Scope"
      contextValue={`${buyers.length} Registered Buyers`}
    >
      <div className="sales-app">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, alignItems: "center" }}>
          <input
            type="text"
            placeholder="Search buyer by name, email, ID number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: "8px 14px", width: 320, borderRadius: 6, border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
          />
          <Link
            href="/sales?tab=buyers"
            style={{ background: "#e23b3b", color: "#fff", padding: "8px 16px", borderRadius: 6, textDecoration: "none", fontWeight: 600, fontSize: "0.85rem" }}
          >
            + Register Buyer
          </Link>
        </div>

        {loading ? (
          <div className="data-loading">Loading buyer directory…</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", background: "#fff", borderRadius: 8, overflow: "hidden", border: "1px solid #e2e8f0" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                <th style={{ padding: 10, textAlign: "left" }}>Buyer Name</th>
                <th style={{ padding: 10, textAlign: "left" }}>National ID / Passport</th>
                <th style={{ padding: 10, textAlign: "left" }}>Contact Details</th>
                <th style={{ padding: 10, textAlign: "center" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((buyer) => (
                <tr key={String(buyer.id)} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: 10, fontWeight: "bold" }}>
                    {`${buyer.first_name || ""} ${buyer.last_name || ""}`.trim() || "Registered Buyer"}
                  </td>
                  <td style={{ padding: 10, fontFamily: "monospace" }}>{String(buyer.id_number || "KYC Verified")}</td>
                  <td style={{ padding: 10, color: "#64748b" }}>
                    {String(buyer.email || "No email")} | {String(buyer.phone_number || "No phone")}
                  </td>
                  <td style={{ padding: 10, textAlign: "center" }}>
                    <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: "0.75rem", fontWeight: "bold", background: "#dcfce7", color: "#166534" }}>
                      ACTIVE BUYER
                    </span>
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
