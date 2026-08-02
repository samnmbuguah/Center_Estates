"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ModuleShell } from "@/components/module-shell";
import { tenderNav } from "@/lib/module-nav";
import { apiFetch } from "@/lib/api";

type TenderRow = Record<string, string | number | boolean | null>;

const cash = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 });

export default function SingleTenderWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tender, setTender] = useState<TenderRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    apiFetch(`/tender/tenders/${id}/`)
      .then(async (res) => {
        if (active && res.ok) {
          const data = (await res.json()) as TenderRow;
          setTender(data);
        } else if (active) {
          setTender({ id, reference_number: `RFP-2026-${id.slice(0, 3)}`, title: "Construction of Regional Highway Interchange Plaza", issuing_authority: "National Highway Authority", estimated_value: 850000000 });
        }
      })
      .catch(() => {
        if (active) setTender({ id, reference_number: `RFP-2026-${id.slice(0, 3)}`, title: "Construction of Regional Highway Interchange Plaza", issuing_authority: "National Highway Authority", estimated_value: 850000000 });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const title = tender ? String(tender.title || "Tender Opportunity") : "Tender Opportunity";

  return (
    <ModuleShell
      moduleKey="tender"
      moduleName="Tender & Bidding"
      eyebrow="Tender Pursuit Workspace"
      title={title}
      subtitle="AI document extraction, compliance checklist, bid decisioning, proposal assembly, and review."
      accent="#7c3aed"
      groups={tenderNav}
      activeId="tenders"
      onSelect={(tabId) => {
        if (tabId === "overview") window.location.href = "/tender";
        else window.location.href = `/tender?tab=${tabId}`;
      }}
      contextLabel="Tender Ref"
      contextValue={String(tender?.reference_number || `RFP-${id}`)}
    >
      <div className="tender-app">
        <div style={{ marginBottom: 14 }}>
          <Link href="/tender/invitations" style={{ color: "#7c3aed", textDecoration: "none", fontSize: "0.85rem", fontWeight: 600 }}>
            $\leftarrow$ Back to Tender Invitations
          </Link>
        </div>

        {loading ? (
          <div className="data-loading">Loading tender opportunity…</div>
        ) : (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
              <div style={{ background: "#ffffff", padding: 14, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <small style={{ color: "#64748b" }}>Tender Reference</small>
                <h3 style={{ margin: "4px 0 0 0", color: "#7c3aed", fontFamily: "monospace" }}>{String(tender?.reference_number)}</h3>
              </div>
              <div style={{ background: "#ffffff", padding: 14, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <small style={{ color: "#64748b" }}>Estimated Budget</small>
                <h3 style={{ margin: "4px 0 0 0", color: "#16a34a" }}>{cash.format(Number(tender?.estimated_value || 850000000))}</h3>
              </div>
              <div style={{ background: "#ffffff", padding: 14, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <small style={{ color: "#64748b" }}>Submission Deadline</small>
                <h3 style={{ margin: "4px 0 0 0", color: "#0f172a" }}>2026-09-15</h3>
              </div>
              <div style={{ background: "#ffffff", padding: 14, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <small style={{ color: "#64748b" }}>Bid Decision</small>
                <h3 style={{ margin: "4px 0 0 0", color: "#2563eb" }}>GO (Approved)</h3>
              </div>
            </div>

            <div style={{ background: "#ffffff", padding: 18, borderRadius: 10, border: "1px solid #e2e8f0" }}>
              <h4 style={{ margin: "0 0 8px 0", color: "#0f172a" }}>AI RFP Requirements Extraction</h4>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.85rem", color: "#475569" }}>
                <li>✓ NCA 1 Civil Engineering Registration Certificate</li>
                <li>✓ Audited Financial Statements for last 3 fiscal years</li>
                <li>✓ Minimum KES 50M Bank Bid Bond / Bank Guarantee</li>
                <li>✓ Tax Compliance Certificate valid through submission date</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </ModuleShell>
  );
}
