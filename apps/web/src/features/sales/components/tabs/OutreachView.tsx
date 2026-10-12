"use client";

import { useMemo, useState } from "react";
import { EmptyState, KpiCard, KpiStrip, Panel, StatusPill } from "@/components/module-ui";
import {
  OutreachCampaign,
  OutreachCampaignModule,
  OutreachProspect,
  OutreachSummary,
  Tone,
} from "../../types/sales.types";
import { DataTable, FilterChips, TableChrome } from "../SalesUiComponents";

const MODULE_DISPLAY: Record<OutreachCampaignModule, { name: string; icon: string; tag: string }> = {
  property: { name: "Property Management", icon: "🏢", tag: "Utility Leakage & Reconciliation" },
  facility: { name: "Facility Operations", icon: "🛠️", tag: "SLA Drift & Asset Depreciation" },
  construction: { name: "Construction & Projects", icon: "🏗️", tag: "Milestone Delays & Budget Overrun" },
  valuation: { name: "Real Estate Valuation", icon: "🏷️", tag: "Bank Compliance & Turnaround" },
  tender: { name: "Procurement & Tenders", icon: "⚖️", tag: "Evaluation Fraud & Sealed Bids" },
  sales: { name: "Sales Pipeline", icon: "🤝", tag: "Double-Booking & Commission Disputes" },
};

function toneForProspectStatus(s: string): Tone {
  if (s === "demo_booked" || s === "won") return "green";
  if (s === "replied") return "blue";
  if (s === "contacted") return "cyan";
  if (s === "qualified" || s === "uncontacted") return "yellow";
  if (s === "unresponsive" || s === "lost") return "red";
  return "gray";
}

function toneForFitScore(score: number): Tone {
  if (score >= 90) return "green";
  if (score >= 80) return "blue";
  if (score >= 70) return "yellow";
  return "gray";
}

export function OutreachView({
  campaigns,
  prospects,
  summary,
  loading,
  search,
  setSearch,
  status,
  setStatus,
  selectedModule,
  setSelectedModule,
  selectedCampaignId,
  setSelectedCampaignId,
  onSeedDefaults,
  onGenerateDraft,
  onLogOutreach,
}: {
  campaigns: OutreachCampaign[];
  prospects: OutreachProspect[];
  summary: OutreachSummary | null;
  loading: boolean;
  search: string;
  setSearch: (v: string) => void;
  status: string;
  setStatus: (v: string) => void;
  selectedModule: OutreachCampaignModule | "all";
  setSelectedModule: (mod: OutreachCampaignModule | "all") => void;
  selectedCampaignId: string | null;
  setSelectedCampaignId: (id: string | null) => void;
  onSeedDefaults: () => Promise<void>;
  onGenerateDraft: (prospectId: string, stepNumber?: number) => Promise<any>;
  onLogOutreach: (prospectId: string, payload: { activity_type: string; subject?: string; content?: string; step_number?: number }) => Promise<any>;
}) {
  const [activeStepTab, setActiveStepTab] = useState<number>(1);
  const [draftModal, setDraftModal] = useState<{
    open: boolean;
    prospect: OutreachProspect | null;
    stepNumber: number;
    subject: string;
    body: string;
    bookingUrl: string;
    loading: boolean;
    sending: boolean;
    copied: boolean;
  }>({
    open: false,
    prospect: null,
    stepNumber: 1,
    subject: "",
    body: "",
    bookingUrl: "",
    loading: false,
    sending: false,
    copied: false,
  });

  // Calculate module prospect counts
  const moduleCounts = useMemo(() => {
    const counts: Record<string, number> = { all: prospects.length };
    campaigns.forEach((c) => {
      counts[c.target_module] = (counts[c.target_module] || 0) + (c.prospects_count || 0);
    });
    return counts;
  }, [campaigns, prospects]);

  // Selected campaign details
  const activeCampaign = useMemo(() => {
    if (selectedCampaignId) {
      return campaigns.find((c) => c.id === selectedCampaignId) || null;
    }
    if (selectedModule !== "all") {
      return campaigns.find((c) => c.target_module === selectedModule) || campaigns[0] || null;
    }
    return campaigns[0] || null;
  }, [campaigns, selectedCampaignId, selectedModule]);

  // Open Draft Modal
  async function handleOpenDraft(prospect: OutreachProspect, stepNum = 1) {
    setDraftModal({
      open: true,
      prospect,
      stepNumber: stepNum,
      subject: "",
      body: "",
      bookingUrl: "",
      loading: true,
      sending: false,
      copied: false,
    });

    try {
      const data = await onGenerateDraft(prospect.id, stepNum);
      if (data) {
        setDraftModal((prev) => ({
          ...prev,
          subject: data.subject || "",
          body: data.body || "",
          bookingUrl: data.booking_url || "",
          loading: false,
        }));
      } else {
        setDraftModal((prev) => ({ ...prev, loading: false }));
      }
    } catch {
      setDraftModal((prev) => ({ ...prev, loading: false }));
    }
  }

  async function handleLogActivity(activityType: "sent" | "replied" | "demo_booked") {
    if (!draftModal.prospect) return;
    setDraftModal((prev) => ({ ...prev, sending: true }));
    try {
      await onLogOutreach(draftModal.prospect.id, {
        activity_type: activityType,
        subject: draftModal.subject,
        content: draftModal.body,
        step_number: draftModal.stepNumber,
      });
      setDraftModal((prev) => ({ ...prev, open: false, sending: false }));
    } catch {
      setDraftModal((prev) => ({ ...prev, sending: false }));
    }
  }

  function handleCopyMessage() {
    const text = `Subject: ${draftModal.subject}\n\n${draftModal.body}`;
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      setDraftModal((prev) => ({ ...prev, copied: true }));
      setTimeout(() => setDraftModal((prev) => ({ ...prev, copied: false })), 2000);
    }
  }

  function handleOpenMailto() {
    if (!draftModal.prospect?.email) return;
    const url = `mailto:${encodeURIComponent(draftModal.prospect.email)}?subject=${encodeURIComponent(draftModal.subject)}&body=${encodeURIComponent(draftModal.body)}`;
    window.open(url, "_blank");
  }

  function handleOpenWhatsApp() {
    if (!draftModal.prospect?.phone) return;
    const cleanPhone = draftModal.prospect.phone.replace(/[^0-9]/g, "");
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(draftModal.body)}`;
    window.open(url, "_blank");
  }

  const highFitCount = prospects.filter((p) => p.fit_score >= 85).length;
  const contactedCount = summary?.contacted ?? prospects.filter((p) => ["contacted", "replied", "demo_booked"].includes(p.status)).length;
  const repliedCount = summary?.replies ?? prospects.filter((p) => ["replied", "demo_booked"].includes(p.status)).length;
  const demosCount = summary?.demos_booked ?? prospects.filter((p) => p.status === "demo_booked").length;
  const replyRate = contactedCount > 0 ? Math.round((repliedCount / contactedCount) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Top Banner & Seed Action */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95))",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: 12,
          padding: "20px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
        }}
      >
        <div style={{ maxWidth: 720 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 22 }}>⚡</span>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "#fff" }}>
              Autonomous GTM & OpenOutreach Engine
            </h2>
            <span
              style={{
                fontSize: 11,
                padding: "2px 8px",
                borderRadius: 999,
                background: "rgba(59, 130, 246, 0.2)",
                color: "#60a5fa",
                border: "1px solid rgba(59, 130, 246, 0.4)",
                fontWeight: 600,
              }}
            >
              Wedge Strategy Active
            </span>
          </div>
          <p style={{ fontSize: 13, color: "rgba(255, 255, 255, 0.75)", margin: 0, lineHeight: 1.5 }}>
            Never pitch an overwhelming &quot;all-in-one ERP&quot;. Target property firms with precise, acute pain hooks for each specific module: 
            <strong> Utility Leakage, SLA Drift, Milestone Overrun, Valuation Compliance, or Sealed Tenders</strong>.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            className="btn primary sm"
            onClick={onSeedDefaults}
            disabled={loading}
            style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}
          >
            <span>🚀</span>
            <span>{campaigns.length === 0 ? "Generate 6 Module Campaigns" : "Re-sync Default Campaigns"}</span>
          </button>
          <a
            href="https://centerestates.com/demo"
            target="_blank"
            rel="noopener noreferrer"
            className="btn secondary sm"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <span>📅</span>
            <span>Live Cal.com Link</span>
          </a>
        </div>
      </div>

      {/* KPI Strip */}
      <KpiStrip cols={6}>
        <KpiCard
          icon="🎯"
          iconBg="var(--color-indigo-bg)"
          iconColor="var(--color-indigo)"
          label="Target Accounts"
          value={String(prospects.length)}
          sub={`${campaigns.length} Active Campaigns`}
          onClick={() => setStatus("")}
        />
        <KpiCard
          icon="⭐"
          iconBg="var(--color-green-bg)"
          iconColor="var(--color-success)"
          label="High Fit (85%+)"
          value={String(highFitCount)}
          sub="Ideal Customer Profile"
        />
        <KpiCard
          icon="📤"
          iconBg="var(--color-sky-bg)"
          iconColor="var(--color-cyan)"
          label="Outreach Sent"
          value={String(contactedCount)}
          sub="Sequences in progress"
          onClick={() => setStatus("contacted")}
        />
        <KpiCard
          icon="💬"
          iconBg="var(--color-blue-bg)"
          iconColor="var(--color-info)"
          label="Replies"
          value={String(repliedCount)}
          sub={`${replyRate}% Response Rate`}
          onClick={() => setStatus("replied")}
        />
        <KpiCard
          icon="🗓️"
          iconBg="var(--color-amber-bg)"
          iconColor="var(--color-amber)"
          label="Demos Booked"
          value={String(demosCount)}
          sub="High Intent Opportunities"
          onClick={() => setStatus("demo_booked")}
        />
        <KpiCard
          icon="📊"
          iconBg="var(--color-violet-bg)"
          iconColor="var(--color-violet)"
          label="Modules Covered"
          value="6 / 6"
          sub="Wedges Configured"
        />
      </KpiStrip>

      {/* Module Wedge Selector */}
      <div
        style={{
          display: "flex",
          gap: 8,
          overflowX: "auto",
          paddingBottom: 4,
          alignItems: "center",
        }}
      >
        <button
          onClick={() => {
            setSelectedModule("all");
            setSelectedCampaignId(null);
          }}
          className={`btn sm ${selectedModule === "all" ? "primary" : "secondary"}`}
          style={{ whiteSpace: "nowrap", borderRadius: 20 }}
        >
          🌟 All Campaigns ({prospects.length})
        </button>
        {(["property", "facility", "construction", "valuation", "tender", "sales"] as OutreachCampaignModule[]).map(
          (modKey) => {
            const meta = MODULE_DISPLAY[modKey];
            const isSelected = selectedModule === modKey;
            const count = moduleCounts[modKey] || 0;
            return (
              <button
                key={modKey}
                onClick={() => {
                  setSelectedModule(modKey);
                  const camp = campaigns.find((c) => c.target_module === modKey);
                  if (camp) setSelectedCampaignId(camp.id);
                }}
                className={`btn sm ${isSelected ? "primary" : "secondary"}`}
                style={{
                  whiteSpace: "nowrap",
                  borderRadius: 20,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>{meta.icon}</span>
                <span>{meta.name}</span>
                <span
                  style={{
                    fontSize: 11,
                    background: isSelected ? "rgba(255,255,255,0.25)" : "var(--color-surface-alt)",
                    padding: "1px 6px",
                    borderRadius: 10,
                  }}
                >
                  {count}
                </span>
              </button>
            );
          }
        )}
      </div>

      {/* Active Campaign Blueprint Panel */}
      {activeCampaign && (
        <Panel
          title={
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 18 }}>
                {MODULE_DISPLAY[activeCampaign.target_module]?.icon || "🚀"}
              </span>
              <span>{activeCampaign.name}</span>
              <span
                style={{
                  fontSize: 11,
                  background: "var(--color-surface-alt)",
                  padding: "2px 8px",
                  borderRadius: 6,
                  color: "var(--color-muted)",
                }}
              >
                Targeting: {MODULE_DISPLAY[activeCampaign.target_module]?.tag}
              </span>
            </div>
          }
        >
          <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Grid of ICP and Hooks */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: 16,
              }}
            >
              {/* ICP & Roles */}
              <div
                style={{
                  background: "var(--color-surface-alt)",
                  borderRadius: 8,
                  padding: 14,
                  border: "1px solid var(--color-border)",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-muted)", marginBottom: 6 }}>
                  IDEAL CUSTOMER PROFILE (ICP)
                </div>
                <p style={{ fontSize: 13, margin: "0 0 10px 0", lineHeight: 1.5 }}>
                  {activeCampaign.icp_description}
                </p>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "var(--color-muted)" }}>Target Roles:</span>
                  {activeCampaign.target_roles.map((role) => (
                    <span
                      key={role}
                      style={{
                        fontSize: 11,
                        background: "var(--color-surface)",
                        border: "1px solid var(--color-border)",
                        padding: "2px 8px",
                        borderRadius: 4,
                      }}
                    >
                      {role}
                    </span>
                  ))}
                </div>
              </div>

              {/* Acute Pains & Killer Hook */}
              <div
                style={{
                  background: "var(--color-surface-alt)",
                  borderRadius: 8,
                  padding: 14,
                  border: "1px solid var(--color-border)",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-muted)", marginBottom: 6 }}>
                  ACUTE PAIN POINTS
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
                  {activeCampaign.acute_pain_points.map((pain) => (
                    <div key={pain} style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "flex-start" }}>
                      <span style={{ color: "var(--color-danger)" }}>⚠️</span>
                      <span>{pain}</span>
                    </div>
                  ))}
                </div>
                <div
                  style={{
                    background: "rgba(59, 130, 246, 0.1)",
                    borderLeft: "3px solid #3b82f6",
                    padding: "8px 12px",
                    borderRadius: "0 6px 6px 0",
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#60a5fa", textTransform: "uppercase" }}>
                    Killer Cold Hook
                  </div>
                  <div style={{ fontSize: 12, fontStyle: "italic", marginTop: 2 }}>
                    &ldquo;{activeCampaign.killer_hook}&rdquo;
                  </div>
                </div>
              </div>
            </div>

            {/* Sequence Steps Strip */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-muted)" }}>
                  OUTREACH CADENCE (3-STEP SEQUENCE)
                </span>
                <span style={{ fontSize: 11, color: "var(--color-muted)" }}>
                  Step delay: Day 0 &rarr; Day 3 &rarr; Day 7
                </span>
              </div>
              <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
                {activeCampaign.steps.map((step) => {
                  const isActive = activeStepTab === step.step_number;
                  return (
                    <button
                      key={step.step_number}
                      onClick={() => setActiveStepTab(step.step_number)}
                      style={{
                        flex: 1,
                        minWidth: 200,
                        textAlign: "left",
                        padding: "10px 14px",
                        borderRadius: 8,
                        background: isActive ? "var(--color-surface)" : "var(--color-surface-alt)",
                        border: `1px solid ${isActive ? "var(--color-info)" : "var(--color-border)"}`,
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, color: isActive ? "var(--color-info)" : "inherit" }}>
                          Step {step.step_number}: {step.delay_days === 0 ? "Day 0 (Cold Hook)" : `Day +${step.delay_days}`}
                        </span>
                        <span style={{ textTransform: "uppercase", fontSize: 10, opacity: 0.7 }}>
                          {step.channel}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          fontWeight: 500,
                        }}
                      >
                        {step.subject_template}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Preview of active step template */}
              {activeCampaign.steps.find((s) => s.step_number === activeStepTab) && (
                <div
                  style={{
                    marginTop: 10,
                    background: "var(--color-surface-alt)",
                    borderRadius: 8,
                    padding: 14,
                    border: "1px dashed var(--color-border)",
                    fontSize: 12,
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>
                    Template Preview (Step {activeStepTab}):
                  </div>
                  <pre
                    style={{
                      whiteSpace: "pre-wrap",
                      fontFamily: "inherit",
                      margin: 0,
                      color: "var(--color-muted)",
                      lineHeight: 1.5,
                    }}
                  >
                    {activeCampaign.steps.find((s) => s.step_number === activeStepTab)?.body_template}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </Panel>
      )}

      {/* Prospects Table */}
      <Panel
        title="Target Accounts & Prospect Pipeline"
        badge={prospects.length}
      >
        <TableChrome
          search={search}
          setSearch={setSearch}
          placeholder="Search company, contact name, email, or role..."
          chips={
            <FilterChips
              options={[
                { value: "uncontacted", label: "Uncontacted" },
                { value: "contacted", label: "In Sequence" },
                { value: "replied", label: "Replied" },
                { value: "demo_booked", label: "Demo Booked" },
              ]}
              value={status as "uncontacted" | "contacted" | "replied" | "demo_booked" | ""}
              onChange={(v) => setStatus(v)}
            />
          }
          actions={
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--color-muted)" }}>
                Showing {prospects.length} target accounts
              </span>
            </div>
          }
        >
          {prospects.length === 0 ? (
            <EmptyState
              icon="🎯"
              title="No prospects found"
              description="Click 'Generate 6 Module Campaigns' to seed top East African real estate prospects and campaigns."
              action={
                <button className="btn primary sm" onClick={onSeedDefaults}>
                  🚀 Generate 6 Module Campaigns
                </button>
              }
            />
          ) : (
            <DataTable headers={["Company & Contact", "Module Campaign", "Fit Score", "Sequence Step", "Status", "Actions"]}>
              {prospects.map((p) => {
                const modMeta = p.campaign_module ? MODULE_DISPLAY[p.campaign_module as OutreachCampaignModule] : null;
                return (
                  <tr key={p.id}>
                    <td>
                      <div>
                        <strong style={{ fontSize: 13 }}>{p.company_name}</strong>
                        <div style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 2 }}>
                          {p.first_name} {p.last_name} &bull; {p.title || "Executive"}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 2 }}>
                          {p.email} {p.phone ? `| ${p.phone}` : ""}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: 12,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          background: "var(--color-surface-alt)",
                          padding: "3px 8px",
                          borderRadius: 6,
                        }}
                      >
                        <span>{modMeta?.icon || "📁"}</span>
                        <span>{modMeta?.name || p.campaign_name || "General"}</span>
                      </span>
                    </td>
                    <td>
                      <div>
                        <StatusPill
                          value={`${p.fit_score}% Fit`}
                          tone={toneForFitScore(p.fit_score)}
                        />
                        {p.fit_reasons && p.fit_reasons.length > 0 && (
                          <div
                            style={{
                              fontSize: 10,
                              color: "var(--color-muted)",
                              marginTop: 4,
                              maxWidth: 180,
                              lineHeight: 1.2,
                            }}
                          >
                            {p.fit_reasons[0]}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>
                        Step {p.current_step || 1} / 3
                      </span>
                    </td>
                    <td>
                      <StatusPill
                        value={p.status.replace("_", " ")}
                        tone={toneForProspectStatus(p.status)}
                      />
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <button
                          className="btn primary sm"
                          onClick={() => handleOpenDraft(p, p.current_step || 1)}
                          style={{ fontSize: 11, padding: "4px 10px" }}
                        >
                          ⚡ Generate &amp; Send
                        </button>
                        {p.phone && (
                          <button
                            className="btn secondary sm"
                            onClick={() => {
                              const clean = p.phone.replace(/[^0-9]/g, "");
                              window.open(`https://wa.me/${clean}`, "_blank");
                            }}
                            title="Chat on WhatsApp"
                            style={{ padding: "4px 8px" }}
                          >
                            💬
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </DataTable>
          )}
        </TableChrome>
      </Panel>

      {/* AI Draft & Outreach Execution Modal */}
      {draftModal.open && draftModal.prospect && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            style={{
              backgroundColor: "var(--color-surface)",
              borderRadius: 12,
              border: "1px solid var(--color-border)",
              width: "100%",
              maxWidth: 680,
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--color-border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                  ⚡ AI Outreach Personalization
                </h3>
                <div style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 2 }}>
                  {draftModal.prospect.first_name} {draftModal.prospect.last_name} &bull; {draftModal.prospect.company_name}
                </div>
              </div>
              <button
                className="btn secondary sm"
                onClick={() => setDraftModal((prev) => ({ ...prev, open: false }))}
                style={{ padding: "4px 8px", fontSize: 14 }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "18px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
              {draftModal.loading ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "var(--color-muted)" }}>
                  Generating personalized message with OpenOutreach reasoning...
                </div>
              ) : (
                <>
                  {/* Step Switcher inside Modal */}
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>Sequence Step:</span>
                    {[1, 2, 3].map((s) => (
                      <button
                        key={s}
                        onClick={() => handleOpenDraft(draftModal.prospect!, s)}
                        className={`btn sm ${draftModal.stepNumber === s ? "primary" : "secondary"}`}
                        style={{ padding: "3px 10px", fontSize: 11 }}
                      >
                        Step {s}
                      </button>
                    ))}
                  </div>

                  {/* Subject input */}
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                      SUBJECT LINE
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={draftModal.subject}
                      onChange={(e) => setDraftModal((prev) => ({ ...prev, subject: e.target.value }))}
                      style={{ width: "100%", fontSize: 13 }}
                    />
                  </div>

                  {/* Body Textarea */}
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                      PERSONALIZED BODY (Interpolated with ICP Pain Points)
                    </label>
                    <textarea
                      rows={9}
                      className="input"
                      value={draftModal.body}
                      onChange={(e) => setDraftModal((prev) => ({ ...prev, body: e.target.value }))}
                      style={{ width: "100%", fontSize: 13, lineHeight: 1.5, fontFamily: "inherit" }}
                    />
                  </div>

                  {/* Quick Action Buttons */}
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                      padding: "10px 14px",
                      background: "var(--color-surface-alt)",
                      borderRadius: 8,
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        className="btn secondary sm"
                        onClick={handleCopyMessage}
                        style={{ fontSize: 12 }}
                      >
                        {draftModal.copied ? "✅ Copied!" : "📋 Copy Copy"}
                      </button>
                      <button
                        type="button"
                        className="btn secondary sm"
                        onClick={handleOpenMailto}
                        style={{ fontSize: 12 }}
                      >
                        ✉️ Open in Email Client
                      </button>
                      {draftModal.prospect.phone && (
                        <button
                          type="button"
                          className="btn secondary sm"
                          onClick={handleOpenWhatsApp}
                          style={{ fontSize: 12 }}
                        >
                          💬 Send via WhatsApp
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer / Activity Logging */}
            <div
              style={{
                padding: "14px 20px",
                borderTop: "1px solid var(--color-border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "var(--color-surface-alt)",
              }}
            >
              <div style={{ fontSize: 12, color: "var(--color-muted)" }}>
                Log sequence result to CRM:
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="btn secondary sm"
                  disabled={draftModal.sending}
                  onClick={() => handleLogActivity("replied")}
                >
                  Mark Replied
                </button>
                <button
                  type="button"
                  className="btn success sm"
                  disabled={draftModal.sending}
                  onClick={() => handleLogActivity("demo_booked")}
                  style={{ background: "var(--color-success)", color: "#fff" }}
                >
                  🎉 Demo Booked!
                </button>
                <button
                  type="button"
                  className="btn primary sm"
                  disabled={draftModal.sending}
                  onClick={() => handleLogActivity("sent")}
                >
                  {draftModal.sending ? "Logging..." : "Mark as Sent & Advance"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
