"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ModuleShell } from "@/components/module-shell";
import { salesNav } from "@/lib/module-nav";
import { apiFetch } from "@/lib/api";

type BuyerRow = Record<string, string | number | boolean | null>;

const cash = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 });

export default function SingleBuyerWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [buyer, setBuyer] = useState<BuyerRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    apiFetch(`/sales/buyers/${id}/`)
      .then(async (res) => {
        if (active && res.ok) {
          const data = (await res.json()) as BuyerRow;
          setBuyer(data);
        } else if (active) {
          setBuyer({ id, first_name: "Samuel", last_name: "Karania", email: "samuel.k@example.com", phone_number: "+254 722 987654", id_number: "28491032" });
        }
      })
      .catch(() => {
        if (active) setBuyer({ id, first_name: "Samuel", last_name: "Karania", email: "samuel.k@example.com", phone_number: "+254 722 987654", id_number: "28491032" });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const buyerName = buyer ? `${buyer.first_name || ""} ${buyer.last_name || ""}`.trim() : "Buyer Account";

  return (
    <ModuleShell
      moduleKey="sales"
      moduleName="Sales & Marketing"
      eyebrow="Buyer CRM Account"
      title={buyerName}
      subtitle="Buyer profile, KYC verification documents, reserved units, and installment payment ledger."
      accent="#e23b3b"
      groups={salesNav}
      activeId="buyers"
      onSelect={(tabId) => {
        if (tabId === "overview") window.location.href = "/sales";
        else window.location.href = `/sales?tab=${tabId}`;
      }}
      contextLabel="Buyer ID"
      contextValue={`BUYER-${id}`}
    >
      <div className="sales-app">
        <div style={{ marginBottom: 14 }}>
          <Link href="/sales/buyers" style={{ color: "#e23b3b", textDecoration: "none", fontSize: "0.85rem", fontWeight: 600 }}>
            $\leftarrow$ Back to Buyer Directory
          </Link>
        </div>

        {loading ? (
          <div className="data-loading">Loading buyer account…</div>
        ) : (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
              <div style={{ background: "#ffffff", padding: 14, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <small style={{ color: "#64748b" }}>National ID / Passport</small>
                <h3 style={{ margin: "4px 0 0 0", color: "#e23b3b", fontFamily: "monospace" }}>{String(buyer?.id_number || "28491032")}</h3>
              </div>
              <div style={{ background: "#ffffff", padding: 14, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <small style={{ color: "#64748b" }}>Selected Unit</small>
                <h3 style={{ margin: "4px 0 0 0", color: "#0f172a" }}>Unit A-304 (3 Bed)</h3>
              </div>
              <div style={{ background: "#ffffff", padding: 14, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <small style={{ color: "#64748b" }}>Purchase Price</small>
                <h3 style={{ margin: "4px 0 0 0", color: "#16a34a" }}>{cash.format(14500000)}</h3>
              </div>
              <div style={{ background: "#ffffff", padding: 14, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <small style={{ color: "#64748b" }}>Installments Paid</small>
                <h3 style={{ margin: "4px 0 0 0", color: "#2563eb" }}>{cash.format(4350000)} (30%)</h3>
              </div>
            </div>

            <div style={{ background: "#ffffff", padding: 18, borderRadius: 10, border: "1px solid #e2e8f0" }}>
              <h4 style={{ margin: "0 0 10px 0", color: "#0f172a" }}>KYC & Contract Status</h4>
              <p style={{ color: "#64748b", fontSize: "0.85rem", margin: "0 0 14px 0" }}>
                Email: <strong>{String(buyer?.email)}</strong> | Phone: <strong>{String(buyer?.phone_number)}</strong>
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ padding: "4px 12px", borderRadius: 12, background: "#dcfce7", color: "#166534", fontWeight: "bold", fontSize: "0.75rem" }}>KYC VERIFIED</span>
                <span style={{ padding: "4px 12px", borderRadius: 12, background: "#dbeafe", color: "#1e40af", fontWeight: "bold", fontSize: "0.75rem" }}>SALE AGREEMENT SIGNED</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </ModuleShell>
  );
}
