"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, X } from "lucide-react";
import { Dashboard, SalesTab } from "../types/sales.types";

type Step = { key: string; title: string; detail: string; tab: SalesTab; done: boolean };

export function SalesOnboardingChecklist({
  dashboard,
  setTab,
  organizationId,
}: {
  dashboard: Dashboard;
  setTab: (t: SalesTab) => void;
  organizationId: string | null;
}) {
  const kpis = dashboard.kpis ?? {};
  const listings = Number(kpis.availableUnits ?? 0) + Number(kpis.reservedUnits ?? 0) + Number(kpis.soldUnits ?? 0);
  const steps: Step[] = [
    { key: "listings", title: "List units for sale", detail: "Create a project and publish units with pricing.", tab: "inventory", done: listings > 0 },
    { key: "buyers", title: "Register buyers", detail: "Capture buyer details, KYC and financing.", tab: "buyers", done: Number(kpis.activeBuyers ?? 0) > 0 },
    { key: "sales", title: "Create a sale agreement", detail: "Attach a buyer to a unit and set the payment plan.", tab: "sales", done: Number(kpis.pipelineDeals ?? 0) > 0 || Number(kpis.salesValue ?? 0) > 0 },
    { key: "payments", title: "Collect & verify a payment", detail: "Record a deposit and verify it in the payments queue.", tab: "payments", done: Number(kpis.verifiedPayments ?? 0) > 0 },
    { key: "visits", title: "Record a site visit", detail: "Log a prospect visit and attribute the introducing agent.", tab: "site-visits", done: Number(kpis.siteVisits ?? 0) > 0 },
  ];

  const storageKey = organizationId ? `ce_sales_onboarding_dismissed:${organizationId}` : "ce_sales_onboarding_dismissed";
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try { setDismissed(localStorage.getItem(storageKey) === "1"); } catch { /* ignore */ }
  }, [storageKey]);

  const completed = steps.filter((s) => s.done).length;
  const allDone = completed === steps.length;
  if (dismissed || allDone) return null;

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(storageKey, "1"); } catch { /* ignore */ }
  };

  return (
    <section className="data-panel" style={{ padding: 18, borderLeft: "3px solid var(--color-orange)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 15 }}>Get your sales pipeline ready</h3>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
            {completed} of {steps.length} steps complete. Work through these to go live.
          </p>
        </div>
        <button type="button" className="btn ghost sm" onClick={dismiss} aria-label="Dismiss checklist" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <X size={14} /> Dismiss
        </button>
      </div>

      <div style={{ background: "var(--surface-sunken, var(--surface-sunken))", borderRadius: 99, height: 6, margin: "12px 0 14px", overflow: "hidden" }}>
        <i style={{ display: "block", height: "100%", width: `${(completed / steps.length) * 100}%`, background: "var(--color-orange)" }} />
      </div>

      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
        {steps.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setTab(s.tab)}
            style={{
              display: "flex", gap: 10, alignItems: "flex-start", textAlign: "left", cursor: "pointer",
              border: "1px solid var(--border)", borderRadius: 10, padding: 12, background: "var(--surface)",
            }}
          >
            {s.done ? <CheckCircle2 size={18} style={{ color: "var(--color-success)", flexShrink: 0, marginTop: 1 }} /> : <Circle size={18} style={{ color: "var(--muted)", flexShrink: 0, marginTop: 1 }} />}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, textDecoration: s.done ? "line-through" : "none", color: s.done ? "var(--muted)" : "var(--text)" }}>{s.title}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{s.detail}</div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
