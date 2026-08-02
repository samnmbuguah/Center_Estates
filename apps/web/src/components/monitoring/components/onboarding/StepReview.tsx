import { AlertCircle, ArrowLeft, Check, CheckCircle2, Lock, Package, Rocket, ShieldAlert, Sparkles, X } from "lucide-react";
import React, { useState } from "react";
import { deleteWaiver, createWaiver } from "../../api";
import { SubmitButton } from "../../components/FormField";

export interface StepReviewProps {
  project: any;
  checklist: any[];
  waivers: any[];
  allOk: boolean;
  waiverKey: string; setWaiverKey: (v: string) => void;
  waiverReason: string; setWaiverReason: (v: string) => void;
  submitting: boolean;
  setSubmitting: (v: boolean) => void;
  setError: (v: string | null) => void;
  can: (perm: string) => boolean;
  loadWaivers: () => void;
  loadStatus: () => void;
  setStep: (v: number) => void;
  finish: () => void;
}

const STEP_LABELS: Record<number, string> = {
  1: "Project Metadata",
  2: "Team & Stakeholders",
  3: "Documents & Approvals",
};

// Requirement Tier Classification Logic
export function getRequirementTier(key: string, label: string) {
  const k = key.toLowerCase();
  const l = label.toLowerCase();

  // Tier 1: Non-waivable core items
  if (k.includes("name") || k.includes("client") || k.includes("contract_type") || k.includes("location") || k.includes("pm") || k.includes("manager") || k.includes("budget")) {
    return {
      tier: "CORE",
      tierName: "Non-Waivable Core Requirement",
      color: "#ef4444",
      bg: "rgba(239,68,68,0.1)",
      border: "rgba(239,68,68,0.3)",
      icon: Lock,
      waivable: false,
      description: "Essential project metadata required for system operation. Cannot be waived.",
    };
  }

  // Tier 2: Module-Driven requirements
  if (k.includes("eia") || k.includes("nema") || k.includes("esmp") || l.includes("environmental")) {
    return {
      tier: "MODULE",
      tierName: "Required by Safeguards Module",
      moduleName: "Environmental & Social Safeguards",
      color: "#3b82f6",
      bg: "rgba(59,130,246,0.1)",
      border: "rgba(59,130,246,0.3)",
      icon: Package,
      waivable: true,
      description: "Required when Environmental & Social Safeguards module is enabled.",
    };
  }

  if (k.includes("boq") || k.includes("finance") || l.includes("boq")) {
    return {
      tier: "MODULE",
      tierName: "Required by Financial Module",
      moduleName: "Financial Monitoring & BOQs",
      color: "#3b82f6",
      bg: "rgba(59,130,246,0.1)",
      border: "rgba(59,130,246,0.3)",
      icon: Package,
      waivable: true,
      description: "Required when Financial Monitoring & BOQ module is enabled.",
    };
  }

  if (k.includes("bim") || l.includes("bim") || l.includes("model")) {
    return {
      tier: "MODULE",
      tierName: "Required by BIM Module",
      moduleName: "3D BIM Integration",
      color: "#3b82f6",
      bg: "rgba(59,130,246,0.1)",
      border: "rgba(59,130,246,0.3)",
      icon: Package,
      waivable: true,
      description: "Required when 3D BIM Integration module is enabled.",
    };
  }

  // Tier 4: Optional Enhancements
  if (k.includes("logo") || k.includes("brand") || k.includes("color") || k.includes("optional")) {
    return {
      tier: "OPTIONAL",
      tierName: "Optional Enhancement",
      color: "#10b981",
      bg: "rgba(16,185,129,0.1)",
      border: "rgba(16,185,129,0.3)",
      icon: Sparkles,
      waivable: true,
      description: "Optional visual customisation or secondary documentation.",
    };
  }

  // Tier 3: Waivable Governance Requirements (Default)
  return {
    tier: "GOVERNANCE",
    tierName: "Waivable Governance Item",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.1)",
    border: "rgba(245,158,11,0.3)",
    icon: ShieldAlert,
    waivable: true,
    description: "Standard policy requirement. Can be waived by authorized admin with justification.",
  };
}

export function StepReview({
  project, checklist, waivers, allOk,
  waiverKey, setWaiverKey, waiverReason, setWaiverReason,
  submitting, setSubmitting, setError,
  can, loadWaivers, loadStatus, setStep, finish,
}: StepReviewProps) {
  const [filterTier, setFilterTier] = useState<string>("ALL");

  async function addWaiver() {
    if (!project || !waiverKey) return;
    setSubmitting(true); setError(null);
    try {
      await createWaiver(project.id, {
        requirement_key: waiverKey,
        requirement_type: checklist.find(c => c.key === waiverKey)?.type ?? "FIELD",
        reason: waiverReason,
      });
      setWaiverKey(""); setWaiverReason("");
      await Promise.all([loadWaivers(), loadStatus()]);
    } catch (e) { setError((e as Error).message); }
    setSubmitting(false);
  }

  async function removeWaiver(waiverId: number) {
    if (!project) return;
    setSubmitting(true);
    try {
      await deleteWaiver(project.id, waiverId);
      await Promise.all([loadWaivers(), loadStatus()]);
    } catch (e) { setError((e as Error).message); }
    setSubmitting(false);
  }

  const okCount = checklist.filter(c => c.status === "OK" || c.status === "WAIVED").length;
  const totalCount = checklist.length;
  const progress = totalCount > 0 ? Math.round((okCount / totalCount) * 100) : 0;

  const missingItems = checklist.filter(c => c.status === "MISSING");
  const okItems = checklist.filter(c => c.status === "OK");
  const waivedItems = checklist.filter(c => c.status === "WAIVED");

  const filteredMissing = missingItems.filter(c => {
    if (filterTier === "ALL") return true;
    const info = getRequirementTier(c.key, c.label);
    return info.tier === filterTier;
  });

  return (
    <div>
      {/* Project Summary Card */}
      {project && (
        <div style={{
          background: "linear-gradient(135deg, rgba(0,163,255,0.08) 0%, rgba(139,92,246,0.08) 100%)",
          border: "1px solid var(--border)", borderRadius: 12, padding: "20px 24px", marginBottom: 20,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "var(--muted)", textTransform: "uppercase", marginBottom: 6 }}>Project Summary</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>{project.name}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {[
              { label: "Client", value: project.client_name || "Not set" },
              { label: "Location", value: project.location || "Not set" },
              { label: "Type", value: (project.project_type || "standard").replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) },
              { label: "Contract", value: (project.contract_type || "full").replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) },
              { label: "Start", value: project.planned_start_date ? new Date(project.planned_start_date).toLocaleDateString() : "Not set" },
              { label: "End", value: project.planned_completion_date ? new Date(project.planned_completion_date).toLocaleDateString() : "Not set" },
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Onboarding Readiness Meter & Policy Guidance */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 24px", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Onboarding Governance & Readiness</div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>{okCount} of {totalCount} requirements met</div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: allOk ? "#10b981" : progress > 60 ? "#f59e0b" : "#ef4444" }}>
            {progress}%
          </div>
        </div>
        <div style={{ height: 10, borderRadius: 5, background: "var(--surface-3)", overflow: "hidden", marginBottom: 12 }}>
          <div style={{
            height: "100%", borderRadius: 5, transition: "width 0.5s ease",
            width: `${progress}%`,
            background: allOk ? "linear-gradient(90deg, #10b981, #34d399)" : progress > 60 ? "linear-gradient(90deg, #f59e0b, #fbbf24)" : "linear-gradient(90deg, #ef4444, #f87171)",
          }} />
        </div>

        {/* 4-Tier Legend Pills */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 11, paddingTop: 8, borderTop: "1px solid var(--border)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 12, background: "rgba(239,68,68,0.1)", color: "#ef4444", fontWeight: 700 }}>
            🔒 Core Non-Waivable
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 12, background: "rgba(59,130,246,0.1)", color: "#3b82f6", fontWeight: 700 }}>
            📦 Module-Driven
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 12, background: "rgba(245,158,11,0.1)", color: "#f59e0b", fontWeight: 700 }}>
            ⚠️ Waivable Governance
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 12, background: "rgba(16,185,129,0.1)", color: "#10b981", fontWeight: 700 }}>
            💡 Optional Enhancement
          </span>
        </div>
      </div>

      {/* Celebration State */}
      {allOk && (
        <div style={{
          textAlign: "center", padding: "24px 20px", marginBottom: 20,
          background: "linear-gradient(135deg, rgba(16,185,129,0.08), rgba(52,211,153,0.08))",
          border: "1px solid rgba(16,185,129,0.3)", borderRadius: 12,
        }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🎉</div>
          <div style={{ fontWeight: 800, fontSize: 17, color: "#10b981", marginBottom: 4 }}>Your project is ready to launch!</div>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>All mandatory core and module requirements are satisfied. Click "Complete Onboarding" to activate the project.</div>
        </div>
      )}

      {/* Missing Requirements List with Filter Tabs */}
      {missingItems.length > 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", marginBottom: 20 }}>
          <div style={{ padding: "14px 20px", background: "rgba(239,68,68,0.05)", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <AlertCircle size={16} style={{ color: "#ef4444" }} />
              <span style={{ fontWeight: 700, fontSize: 14, color: "#ef4444" }}>Missing Requirements ({missingItems.length})</span>
            </div>

            {/* Filter Buttons */}
            <div style={{ display: "flex", gap: 6, fontSize: 11 }}>
              {[
                { id: "ALL", label: "All Missing" },
                { id: "CORE", label: "Core Non-Waivable" },
                { id: "MODULE", label: "Module-Driven" },
                { id: "GOVERNANCE", label: "Waivable" },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setFilterTier(t.id)}
                  className={`btn sm ${filterTier === t.id ? "primary" : "ghost"}`}
                  style={{ fontSize: 11, padding: "2px 8px" }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ padding: "8px 12px" }}>
            {filteredMissing.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                No missing items under the selected filter category.
              </div>
            ) : (
              filteredMissing.map(c => {
                const info = getRequirementTier(c.key, c.label);
                const IconComponent = info.icon;

                return (
                  <div key={c.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 10px", borderBottom: "1px solid var(--border)" }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%", background: info.bg, border: `1px solid ${info.border}`,
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: info.color
                    }}>
                      <IconComponent size={14} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 2 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>{c.label}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 10,
                          background: info.bg, color: info.color, border: `1px solid ${info.border}`
                        }}>
                          {info.tierName}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>
                        {info.description} {c.step && `(Step ${c.step}: ${STEP_LABELS[c.step] || ""})`}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      {c.step && (
                        <button className="btn ghost sm" onClick={() => setStep(c.step)} style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                          <ArrowLeft size={12} /> Step {c.step}
                        </button>
                      )}

                      {info.waivable ? (
                        can("projects.requirements.waive") ? (
                          <button className="btn ghost sm" onClick={() => setWaiverKey(c.key)} style={{ fontSize: 12, color: "#f59e0b", borderColor: "#f59e0b" }}>
                            Waive
                          </button>
                        ) : null
                      ) : (
                        <span style={{ fontSize: 11, color: "#ef4444", fontWeight: 700, padding: "4px 8px", background: "rgba(239,68,68,0.08)", borderRadius: 6 }}>
                          Cannot be waived
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Completed items */}
      {okItems.length > 0 && (
        <details style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", marginBottom: 20 }}>
          <summary style={{
            padding: "12px 20px", cursor: "pointer", listStyle: "none",
            background: "rgba(16,185,129,0.05)", borderBottom: "1px solid var(--border)",
            display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 14,
          }}>
            <CheckCircle2 size={16} style={{ color: "#10b981" }} />
            <span style={{ color: "#10b981" }}>Completed Requirements ({okItems.length})</span>
          </summary>
          <div style={{ padding: "8px 12px" }}>
            {okItems.map(c => (
              <div key={c.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 8px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(16,185,129,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Check size={13} style={{ color: "#10b981" }} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{c.label}</div>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Waiver Request Modal / Box */}
      {waiverKey && (
        <div style={{
          background: "var(--surface)", border: "1px solid #f59e0b", borderRadius: 12,
          padding: "20px 24px", marginBottom: 20,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#f59e0b" }}>
              ⚠ Request Governance Waiver: {checklist.find(c => c.key === waiverKey)?.label}
            </div>
            <button type="button" className="btn ghost sm" onClick={() => { setWaiverKey(""); setWaiverReason(""); }}><X size={14} /></button>
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
            Provide formal justification for waiving this non-core requirement during onboarding.
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>Waiver Reason *</label>
            <textarea value={waiverReason} onChange={e => setWaiverReason(e.target.value)}
              placeholder="Explain why this governance requirement can be safely bypassed at this time…"
              rows={3} style={{ width: "100%", boxSizing: "border-box", resize: "vertical" }} />
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <SubmitButton className="btn primary sm" onClick={addWaiver} loading={submitting} disabled={submitting || !waiverReason.trim()}>
              Submit Waiver Request
            </SubmitButton>
          </div>
        </div>
      )}

      {/* Active Waivers */}
      {waivers.length > 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", marginBottom: 20 }}>
          <div style={{ padding: "12px 20px", background: "rgba(245,158,11,0.05)", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: 14 }}>
            ⚠ Active Waivers ({waivers.length})
          </div>
          {waivers.map(w => (
            <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 20px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{w.requirement_key}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 1 }}>{w.reason}</div>
              </div>
              {can("projects.requirements.waive") && (
                <button className="btn ghost sm" onClick={() => removeWaiver(w.id)}><X size={14} /></button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Completion CTA */}
      <div style={{ paddingTop: 16, borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 16 }}>
        <SubmitButton
          className="btn primary"
          onClick={finish}
          loading={submitting}
          disabled={submitting || (!allOk && !can("projects.requirements.waive"))}
          style={{ display: "flex", alignItems: "center", gap: 8 }}
        >
          <Rocket size={16} />
          {allOk ? (project?.onboarding_complete ? "Update Onboarding" : "Complete Onboarding") : "Complete with Waivers"}
        </SubmitButton>
        {!allOk && !can("projects.requirements.waive") && (
          <span style={{ color: "#ef4444", fontSize: 13 }}>
            Missing non-core requirements must be fulfilled or waived by an administrator. Core requirements cannot be waived.
          </span>
        )}
      </div>
    </div>
  );
}

