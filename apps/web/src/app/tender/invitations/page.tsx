"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/module-shell";
import { tenderNav } from "@/lib/module-nav";
import { apiFetch } from "@/lib/api";

type TenderRow = Record<string, string | number | boolean | null>;

export default function InvitationsPage() {
  const [tenders, setTenders] = useState<TenderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    apiFetch("/tender/tenders/")
      .then(async (res) => {
        if (active && res.ok) {
          const data = (await res.json()) as TenderRow[];
          setTenders(data || []);
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

  const filtered = tenders.filter((t) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      String(t.title || "").toLowerCase().includes(term) ||
      String(t.reference_number || "").toLowerCase().includes(term) ||
      String(t.issuing_authority || "").toLowerCase().includes(term)
    );
  });

  return (
    <ModuleShell
      moduleKey="tender"
      moduleName="Tender & Bidding"
      eyebrow="Tender Pursuit"
      title="RFP Invitations & Opportunity Register"
      subtitle="Public and private tender invitations, AI requirements breakdown, bid/no-bid decisioning."
      accent="#7c3aed"
      groups={tenderNav}
      activeId="tenders"
      onSelect={(id) => {
        if (id === "overview") window.location.href = "/tender";
        else window.location.href = `/tender?tab=${id}`;
      }}
      contextLabel="Pursuit Scope"
      contextValue={`${tenders.length} Active Tenders`}
    >
      <div className="tender-app">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, alignItems: "center" }}>
          <input
            type="text"
            placeholder="Search tender by title, reference, client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: "8px 14px", width: 320, borderRadius: 6, border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
          />
          <Link
            href="/tender?tab=tenders"
            style={{ background: "#7c3aed", color: "#fff", padding: "8px 16px", borderRadius: 6, textDecoration: "none", fontWeight: 600, fontSize: "0.85rem" }}
          >
            + Register Invitation
          </Link>
        </div>

        {loading ? (
          <div className="data-loading">Loading tender invitations…</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", background: "#fff", borderRadius: 8, overflow: "hidden", border: "1px solid #e2e8f0" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                <th style={{ padding: 10, textAlign: "left" }}>Tender Ref</th>
                <th style={{ padding: 10, textAlign: "left" }}>Title / Scope</th>
                <th style={{ padding: 10, textAlign: "left" }}>Issuing Authority</th>
                <th style={{ padding: 10, textAlign: "center" }}>Decision</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={String(t.id)} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: 10, fontWeight: "bold", fontFamily: "monospace", color: "#7c3aed" }}>
                    {String(t.reference_number || `RFP-${t.id}`)}
                  </td>
                  <td style={{ padding: 10, fontWeight: 600 }}>{String(t.title || "Construction RFP")}</td>
                  <td style={{ padding: 10, color: "#64748b" }}>{String(t.issuing_authority || "Ministry of Transport")}</td>
                  <td style={{ padding: 10, textAlign: "center" }}>
                    <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: "0.75rem", fontWeight: "bold", background: "#dcfce7", color: "#166534" }}>
                      BID APPROVED
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
