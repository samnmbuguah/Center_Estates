import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "@/components/monitoring/react-router-shim";

import {
  completeOnboardingWizard,
  createProject,
  fetchAvailableModules,
  fetchOnboardingStatus,
  fetchProject,
  fetchProjectMembers,
  fetchRoles,
  fetchUsers,
  fetchWaivers,
  saveBranding,
  saveOnboardingStep1,
} from "../api";
import { useAuth } from "../auth";
import { ErrorBanner } from "../components";
import { StepProjectInfo, StepTeamAssignment, StepDocuments, StepReview } from "../components/onboarding";

const STEPS = [
  { num: 1, label: "Metadata" },
  { num: 2, label: "Team & Stakeholders" },
  { num: 3, label: "Documents & Approvals" },
  { num: 4, label: "Review & Complete" },
];

export function ProjectOnboarding() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { can, tenant } = useAuth();

  // Core state
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<any>(null);
  const [checklist, setChecklist] = useState<any[]>([]);
  const [allOk, setAllOk] = useState(false);
  const [waivers, setWaivers] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [availableModules, setAvailableModules] = useState<any[]>([]);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);

  // Step 1: project metadata
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [location, setLocation] = useState("");
  const [country, setCountry] = useState("");
  const [county, setCounty] = useState("");
  const [town, setTown] = useState("");
  const [projectType, setProjectType] = useState("standard");
  const [contractType, setContractType] = useState("full");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [plannedStartDate, setPlannedStartDate] = useState("");
  const [plannedCompletionDate, setPlannedCompletionDate] = useState("");
  const [dateError, setDateError] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // IGP fields
  const [eiaStatus, setEiaStatus] = useState("");
  const [esmpExists, setEsmpExists] = useState(false);
  const [sepExists, setSepExists] = useState(false);
  const [grmContact, setGrmContact] = useState("");
  const [landAcquisition, setLandAcquisition] = useState(false);
  const [procurementMethod, setProcurementMethod] = useState("");
  const [procurementPlanUrl, setProcurementPlanUrl] = useState("");
  const [tenderDocUrl, setTenderDocUrl] = useState("");
  const [signedContractUrl, setSignedContractUrl] = useState("");
  const [approvedBudget, setApprovedBudget] = useState("");
  const [baselineBoqRef, setBaselineBoqRef] = useState("");
  const [safeguardsParty, setSafeguardsParty] = useState("");
  const [procurementOversight, setProcurementOversight] = useState("");
  const [financialApproval, setFinancialApproval] = useState("");
  const [auditRole, setAuditRole] = useState("");

  // Branding
  const [logoUrl, setLogoUrl] = useState("");
  const [brandColor, setBrandColor] = useState("#d92d2d");
  const [companyName, setCompanyName] = useState("");

  // Waivers
  const [waiverKey, setWaiverKey] = useState("");
  const [waiverReason, setWaiverReason] = useState("");

  // Step 2: team
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<{ slug: string; name: string }[]>([]);
  const [projectMembers, setProjectMembers] = useState<any[]>([]);
  const [customRole, setCustomRole] = useState("");
  const [customUserId, setCustomUserId] = useState("");

  const hasModule = (key: string) =>
    selectedModules.length === 0 || selectedModules.includes("full_package") || selectedModules.includes(key);

  useEffect(() => {
    if (plannedStartDate && plannedCompletionDate) {
      setDateError(new Date(plannedCompletionDate) <= new Date(plannedStartDate)
        ? "Completion date must be after start date" : "");
    }
  }, [plannedStartDate, plannedCompletionDate]);

  const loadProjectMembers = () => {
    if (!project) return;
    fetchProjectMembers(project.id).then(setProjectMembers).catch(() => {});
  };

  useEffect(() => {
    if (step !== 2 || !project) return;
    fetchUsers().then(setAllUsers).catch(() => {});
    fetchRoles().then(setRoles).catch(() => {});
    loadProjectMembers();
  }, [step, project?.id]);

  const loadProject = async (projectId: string) => {
    try {
      const p = await fetchProject(projectId);
      setProject(p);
      if (p.name) setName(p.name);
      if (p.client_name) setClientName(p.client_name);
      if (p.location) setLocation(p.location);
      if (p.country) setCountry(p.country);
      if (p.county) setCounty(p.county);
      if (p.town) setTown(p.town);
      if (p.project_type) setProjectType(p.project_type);
      if (p.contract_type) setContractType(p.contract_type);
      if (p.description) setDescription(p.description);
      if (p.budget) setBudget(p.budget.toString());
      if (p.planned_start_date) setPlannedStartDate(p.planned_start_date);
      if (p.planned_completion_date) setPlannedCompletionDate(p.planned_completion_date);
      setSelectedModules(p.modules && !p.modules.includes("full_package") ? p.modules : []);
      if (p.eia_status) setEiaStatus(p.eia_status);
      if (p.esmp_exists) setEsmpExists(p.esmp_exists);
      if (p.sep_exists) setSepExists(p.sep_exists);
      if (p.grm_contact) setGrmContact(p.grm_contact);
      if (p.land_acquisition) setLandAcquisition(p.land_acquisition);
      if (p.procurement_method) setProcurementMethod(p.procurement_method);
      if (p.procurement_plan_url) setProcurementPlanUrl(p.procurement_plan_url);
      if (p.tender_doc_url) setTenderDocUrl(p.tender_doc_url);
      if (p.signed_contract_url) setSignedContractUrl(p.signed_contract_url);
      if (p.approved_budget) setApprovedBudget(p.approved_budget.toString());
      if (p.baseline_boq_ref) setBaselineBoqRef(p.baseline_boq_ref);
      if (p.safeguards_party) setSafeguardsParty(p.safeguards_party);
      if (p.procurement_oversight) setProcurementOversight(p.procurement_oversight);
      if (p.financial_approval) setFinancialApproval(p.financial_approval);
      if (p.audit_role) setAuditRole(p.audit_role);
    } catch (e) { setError((e as Error).message); }
  };

  const loadStatus = async (projectId?: string) => {
    const pid = projectId || project?.id;
    if (!pid) return;
    try {
      const s = await fetchOnboardingStatus(pid);
      setChecklist(s.checklist ?? []);
      setAllOk(s.all_requirements_met ?? false);
      setStep(s.wizard_step ?? 1);
    } catch { /* not available yet */ }
  };

  const loadWaivers = async (projectId?: string) => {
    const pid = projectId || project?.id;
    if (!pid) return;
    try { setWaivers(await fetchWaivers(pid)); } catch { /* ok */ }
  };

  useEffect(() => {
    fetchAvailableModules().then(m => setAvailableModules(m.filter((x: any) => x.key !== "full_package"))).catch(() => {});
  }, []);

  useEffect(() => {
    if (id) {
      Promise.all([loadProject(id), loadStatus(id), loadWaivers(id)]).catch(e => setError((e as Error).message));
    } else if (!project && !submitting) {
      // Auto-create project draft so /app/onboarding and /app/onboarding/:id have identical 4-step UI & functionality
      setSubmitting(true);
      createProject({
        name: "",
        stage: "planning",
        modules: ["full_package"],
      })
        .then((p) => {
          setProject(p);
          navigate(`/app/onboarding/${p.id}`, { replace: true });
        })
        .catch((e) => setError((e as Error).message))
        .finally(() => setSubmitting(false));
    }
  }, [id]);

  function toggleModule(key: string) {
    setSelectedModules(prev => {
      if (key === "full_package") return prev.includes("full_package") ? [] : ["full_package"];
      const next = prev.includes("full_package") ? [key] : prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
      return next.length === 0 ? ["full_package"] : next;
    });
  }

  function getModulesPayload(): string[] {
    return selectedModules.length === 0 || selectedModules.includes("full_package") ? ["full_package"] : selectedModules;
  }

  async function saveBrandingToTenant() {
    if (!tenant) return;
    const b: Record<string, string> = {};
    if (companyName) b.company_name = companyName;
    if (logoUrl) b.logo_url = logoUrl;
    b.primary_color = brandColor;
    if (Object.keys(b).length > 0) await saveBranding(tenant.id, b).catch(() => {});
  }

  async function handleCreateAndAdvance() {
    if (!name.trim()) { setError("Project name is required"); return; }
    setSubmitting(true); setError(null);
    try {
      const p = await createProject({
        name: name.trim(), stage: "planning",
        client_name: clientName, location, project_type: projectType, contract_type: contractType,
        description, budget: budget ? parseFloat(budget) : undefined,
        modules: getModulesPayload(), country, county, town,
        planned_start_date: plannedStartDate || undefined,
        planned_completion_date: plannedCompletionDate || undefined,
      });
      setProject(p); await saveBrandingToTenant(); await loadStatus(p.id);
      setStep(2); navigate(`/app/onboarding/${p.id}`, { replace: true });
    } catch (e) { setError((e as Error).message); }
    setSubmitting(false);
  }

  async function handleSaveStep1() {
    if (!project) return;
    setSubmitting(true); setError(null);
    try {
      await saveOnboardingStep1(project.id, {
        name, client_name: clientName, location, project_type: projectType,
        description, budget: budget ? parseFloat(budget) : undefined,
        modules: getModulesPayload(), country, county, town,
        planned_start_date: plannedStartDate || undefined,
        planned_completion_date: plannedCompletionDate || undefined,
        eia_status: eiaStatus, esmp_exists: esmpExists, sep_exists: sepExists,
        grm_contact: grmContact, land_acquisition: landAcquisition,
        procurement_method: procurementMethod, procurement_plan_url: procurementPlanUrl,
        tender_doc_url: tenderDocUrl, signed_contract_url: signedContractUrl,
        approved_budget: approvedBudget ? parseFloat(approvedBudget) : undefined,
        baseline_boq_ref: baselineBoqRef, safeguards_party: safeguardsParty,
        procurement_oversight: procurementOversight, financial_approval: financialApproval,
        audit_role: auditRole,
      });
      await saveBrandingToTenant(); setStep(2);
    } catch (e) { setError((e as Error).message); }
    setSubmitting(false);
  }

  async function finish() {
    if (!project) return;
    setSubmitting(true); setError(null);
    try {
      await completeOnboardingWizard(project.id);
      navigate(`/app/projects/${project.id}`);
    } catch (e) { setError((e as Error).message); }
    setSubmitting(false);
  }

  const step1Props = useMemo(() => ({
    name, setName, clientName, setClientName, location, setLocation,
    country, setCountry, county, setCounty, town, setTown,
    projectType, setProjectType, contractType, setContractType,
    description, setDescription, budget, setBudget,
    plannedStartDate, setPlannedStartDate, plannedCompletionDate, setPlannedCompletionDate,
    dateError, showAdvanced, setShowAdvanced,
    eiaStatus, setEiaStatus, esmpExists, setEsmpExists, sepExists, setSepExists,
    grmContact, setGrmContact, procurementMethod, setProcurementMethod,
    approvedBudget, setApprovedBudget, baselineBoqRef, setBaselineBoqRef,
    logoUrl, setLogoUrl, brandColor, setBrandColor, companyName, setCompanyName,
    availableModules, selectedModules, toggleModule,
  }), [/* intentionally exhaustive — these are all the state values used by StepProjectInfo */
    name, clientName, location, country, county, town, projectType, contractType,
    description, budget, plannedStartDate, plannedCompletionDate, dateError, showAdvanced,
    eiaStatus, esmpExists, sepExists, grmContact, procurementMethod, approvedBudget, baselineBoqRef,
    logoUrl, brandColor, companyName, availableModules, selectedModules,
  ]);

  // Still loading project (edit mode)
  if (id && !project) return <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading project…</div>;

  const isCreateMode = !id;
  const projectName = project?.name || "New Project";

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 16px 40px" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "var(--muted)", textTransform: "uppercase", marginBottom: 4 }}>
          {isCreateMode ? "New Project" : "Edit Project"}
        </div>
        <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: "var(--text)" }}>
          {isCreateMode ? "Project Onboarding Wizard" : projectName}
        </h2>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--muted)" }}>
          Complete all 4 steps to set up your project: metadata, team &amp; stakeholders, documents, and final review.
        </p>
      </div>

      {/* Step Indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 32, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 6, overflow: "hidden" }}>
        {STEPS.map((s, idx) => {
          const isDone = step > s.num;
          const isActive = step === s.num;
          return (
            <React.Fragment key={s.num}>
              <div
                onClick={() => (project || isDone) && setStep(s.num)}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                  gap: 6, padding: "10px 8px", borderRadius: 7, fontWeight: 600,
                  fontSize: 13, cursor: project || isDone ? "pointer" : "default",
                  background: isActive ? "var(--primary)" : isDone ? "rgba(16,185,129,0.12)" : "transparent",
                  color: isActive ? "white" : isDone ? "#10b981" : "var(--muted)",
                  transition: "all 0.2s",
                }}
              >
                <span style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 20, height: 20, borderRadius: "50%", fontSize: 11, fontWeight: 700,
                  background: isActive ? "rgba(255,255,255,0.25)" : isDone ? "#10b981" : "var(--surface-2)",
                  color: isActive ? "white" : isDone ? "white" : "var(--muted)",
                  flexShrink: 0,
                }}>
                  {isDone ? <Check size={11} /> : s.num}
                </span>
                <span style={{ whiteSpace: "nowrap" }}>{s.label}</span>
              </div>
              {idx < STEPS.length - 1 && (
                <div style={{ width: 1, height: 20, background: "var(--border)", flexShrink: 0 }} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      <ErrorBanner message={error} />

      {/* Step Content */}
      {step === 1 && (
        <StepProjectInfo
          {...step1Props}
          project={project}
          onSubmit={isCreateMode ? handleCreateAndAdvance : handleSaveStep1}
          submitting={submitting}
        />
      )}
      {step === 2 && project && (
        <StepTeamAssignment
          project={project} projectMembers={projectMembers} setProjectMembers={setProjectMembers}
          allUsers={allUsers} roles={roles}
          inviteEmail={inviteEmail} setInviteEmail={setInviteEmail}
          inviteName={inviteName} setInviteName={setInviteName}
          inviteMsg={inviteMsg} setInviteMsg={setInviteMsg}
          customRole={customRole} setCustomRole={setCustomRole}
          customUserId={customUserId} setCustomUserId={setCustomUserId}
          submitting={submitting} setSubmitting={setSubmitting}
          hasModule={hasModule} loadProjectMembers={loadProjectMembers} onNext={() => setStep(3)}
        />
      )}
      {step === 3 && project && (
        <StepDocuments project={project} hasModule={hasModule} loadStatus={() => loadStatus()} setError={setError} />
      )}
      {step === 4 && project && (
        <StepReview
          project={project} checklist={checklist} waivers={waivers} allOk={allOk}
          waiverKey={waiverKey} setWaiverKey={setWaiverKey} waiverReason={waiverReason} setWaiverReason={setWaiverReason}
          submitting={submitting} setSubmitting={setSubmitting} setError={setError}
          can={can} loadWaivers={() => loadWaivers()} loadStatus={() => loadStatus()}
          setStep={setStep} finish={finish}
        />
      )}

      {/* Nav Buttons */}
      {(step > 1 || step < 4) && (
        <div style={{ marginTop: 24, display: "flex", gap: 8, justifyContent: "space-between", borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          <div>
            {step > 1 && project && (
              <button className="btn ghost" onClick={() => setStep(s => s - 1)}>
                <ChevronLeft size={16} style={{ marginRight: 4 }} /> Back
              </button>
            )}
          </div>
          <div>
            {step < 4 && project && step > 1 && (
              <button className="btn" onClick={() => setStep(s => s + 1)} style={{ color: "var(--muted)" }}>
                Skip to Step {step + 1} <ChevronRight size={16} style={{ marginLeft: 4 }} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
