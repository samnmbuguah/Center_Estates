import { useState } from "react";
import {
  Building2, Briefcase, Calendar, ChevronDown, ChevronRight, Globe, Home,
  Layers, MapPin, Paintbrush, Wrench, Box, ChartLine, ClipboardCheck,
  Database, Handshake, Package, Ruler, ShoppingCart, TrendingUp, Users, Info,
  Sparkles, Check
} from "lucide-react";
import { SubmitButton } from "../../components/FormField";

const MODULE_ICONS: Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>> = {

  full_package: Package,
  progress_tracking: TrendingUp,
  financials: ChartLine,
  procurement: ShoppingCart,
  quality: ClipboardCheck,
  consultant: Handshake,
  bim: Box,
  drone: Ruler,
  cost: Database,
  sales: Users,
};

function sortModules(modules: any[]) {
  return [...modules].sort((a, b) => a.label.localeCompare(b.label));
}

function FieldLabel({ label, required, tip }: { label: string; required?: boolean; tip?: string }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 5, fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
      {label}
      {required && <span style={{ color: "var(--color-danger)", fontWeight: 700 }}> *</span>}
      {tip && (
        <span title={tip} style={{ color: "var(--muted)", cursor: "help", display: "inline-flex" }}>
          <Info size={13} />
        </span>
      )}
    </label>
  );
}

function BudgetInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", background: "var(--surface-2)" }}>
      <span style={{
        padding: "0 12px", background: "var(--surface-3)", borderRight: "1px solid var(--border)",
        fontSize: 13, fontWeight: 700, color: "var(--muted)", height: 40, display: "flex", alignItems: "center",
      }}>KES</span>
      <input
        type="number" value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="0.00"
        style={{ border: "none", background: "transparent", flex: 1, padding: "0 12px", height: 40, fontSize: 14 }}
      />
    </div>
  );
}

export interface StepProjectInfoProps {
  project: any;
  name: string; setName: (v: string) => void;
  clientName: string; setClientName: (v: string) => void;
  location: string; setLocation: (v: string) => void;
  country: string; setCountry: (v: string) => void;
  county: string; setCounty: (v: string) => void;
  town: string; setTown: (v: string) => void;
  projectType: string; setProjectType: (v: string) => void;
  contractType: string; setContractType: (v: string) => void;
  description: string; setDescription: (v: string) => void;
  budget: string; setBudget: (v: string) => void;
  plannedStartDate: string; setPlannedStartDate: (v: string) => void;
  plannedCompletionDate: string; setPlannedCompletionDate: (v: string) => void;
  dateError: string;
  showAdvanced: boolean; setShowAdvanced: (v: boolean) => void;
  eiaStatus: string; setEiaStatus: (v: string) => void;
  esmpExists: boolean; setEsmpExists: (v: boolean) => void;
  sepExists: boolean; setSepExists: (v: boolean) => void;
  grmContact: string; setGrmContact: (v: string) => void;
  procurementMethod: string; setProcurementMethod: (v: string) => void;
  approvedBudget: string; setApprovedBudget: (v: string) => void;
  baselineBoqRef: string; setBaselineBoqRef: (v: string) => void;
  logoUrl: string; setLogoUrl: (v: string) => void;
  brandColor: string; setBrandColor: (v: string) => void;
  companyName: string; setCompanyName: (v: string) => void;
  availableModules: any[];
  selectedModules: string[];
  toggleModule: (key: string) => void;
  onSubmit: () => void;
  submitting: boolean;
}

export function StepProjectInfo({
  project,
  name, setName,
  clientName, setClientName,
  location, setLocation,
  country, setCountry,
  county, setCounty,
  town, setTown,
  projectType, setProjectType,
  contractType, setContractType,
  description, setDescription,
  budget, setBudget,
  plannedStartDate, setPlannedStartDate,
  plannedCompletionDate, setPlannedCompletionDate,
  dateError,
  showAdvanced, setShowAdvanced,
  eiaStatus, setEiaStatus,
  esmpExists, setEsmpExists,
  sepExists, setSepExists,
  grmContact, setGrmContact,
  procurementMethod, setProcurementMethod,
  approvedBudget, setApprovedBudget,
  baselineBoqRef, setBaselineBoqRef,
  logoUrl, setLogoUrl,
  brandColor, setBrandColor,
  companyName, setCompanyName,
  availableModules,
  selectedModules, toggleModule,
  onSubmit, submitting,
}: StepProjectInfoProps) {
  const isCreate = !project;
  const currentProjectType = projectType || project?.project_type || "standard";
  const currentContractType = contractType || project?.contract_type || "full";

  const projectTypes = [
    { value: "standard", label: "Commercial", icon: Briefcase, desc: "Office & Retail" },
    { value: "residential", label: "Residential", icon: Home, desc: "Housing & Estates" },
    { value: "infrastructure", label: "Infrastructure", icon: Wrench, desc: "Civil Works & Roads" },
    { value: "igp", label: "IGP Governance", icon: Globe, desc: "World Bank / AfDB" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Quick Start Card: 4 Essential Fields */}
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
        padding: "24px 26px", borderTop: "4px solid var(--primary)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(0,163,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Building2 size={18} style={{ color: "var(--primary)" }} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Project Quick-Start</h3>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--muted)" }}>Fill in these 4 essentials to get your project running instantly</p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {/* Project Name */}
          <div style={{ gridColumn: "1 / -1" }}>
            <FieldLabel label="Project Name" required tip="Official project title" />
            <input
              value={name || (project?.name ?? "")}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. KASNEB Towers II"
              style={{ width: "100%", fontSize: 15, padding: "10px 12px" }}
              autoFocus
            />
          </div>

          {/* Client Name */}
          <div>
            <FieldLabel label="Client / Developer" tip="Entity commissioning the project" />
            <input
              value={clientName || (project?.client_name ?? "")}
              onChange={e => setClientName(e.target.value)}
              placeholder="e.g. KASNEB Board"
            />
          </div>

          {/* Location */}
          <div>
            <FieldLabel label="Location" tip="Site city or town" />
            <input
              value={location || (project?.location ?? "")}
              onChange={e => setLocation(e.target.value)}
              placeholder="e.g. Upper Hill, Nairobi"
            />
          </div>

          {/* Contract Budget */}
          <div style={{ gridColumn: "1 / -1" }}>
            <FieldLabel label="Estimated Contract Budget (KES)" tip="Total contract sum" />
            <BudgetInput value={budget || (project?.budget ?? "")} onChange={setBudget} />
          </div>

          {/* Visual Project Type Cards */}
          <div style={{ gridColumn: "1 / -1", marginTop: 4 }}>
            <FieldLabel label="Project Category" required />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 4 }}>
              {projectTypes.map(type => {
                const isActive = currentProjectType === type.value;
                return (
                  <label key={type.value} style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                    padding: "12px 8px", borderRadius: 10, cursor: "pointer",
                    border: `2px solid ${isActive ? "var(--primary)" : "var(--border)"}`,
                    background: isActive ? "rgba(0,163,255,0.08)" : "var(--surface-2)",
                    transition: "all 0.15s", textAlign: "center",
                  }}>
                    <input type="radio" name="projectType" value={type.value}
                      checked={isActive} onChange={e => setProjectType(e.target.value)}
                      style={{ display: "none" }} />
                    <type.icon size={20} style={{ color: isActive ? "var(--primary)" : "var(--muted)" }} />
                    <strong style={{ fontSize: 12, color: isActive ? "var(--primary)" : "var(--text)" }}>{type.label}</strong>
                    <span style={{ fontSize: 10, color: "var(--muted)" }}>{type.desc}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Details Collapsible Accordion Toggle */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 20px", background: "var(--surface-2)", border: "none", cursor: "pointer",
            color: "var(--text)", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Sparkles size={16} style={{ color: "var(--primary)" }} />
            <span>Optional Advanced Details (Dates, Modules, Branding, Permits)</span>
          </div>
          <ChevronDown size={18} style={{ transform: showAdvanced ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
        </button>

        {showAdvanced && (
          <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Timeline Dates */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: "var(--text)" }}>Schedule Dates</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <FieldLabel label="Planned Start Date" />
                  <input type="date"
                    value={plannedStartDate || (project?.planned_start_date ? project.planned_start_date.split("T")[0] : "")}
                    onChange={e => setPlannedStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <FieldLabel label="Planned Completion Date" />
                  <input type="date"
                    value={plannedCompletionDate || (project?.planned_completion_date ? project.planned_completion_date.split("T")[0] : "")}
                    onChange={e => setPlannedCompletionDate(e.target.value)}
                  />
                  {dateError && <div style={{ color: "var(--color-danger)", fontSize: 12, marginTop: 4 }}>{dateError}</div>}
                </div>
              </div>
            </div>

            {/* Location Detail */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: "var(--text)" }}>Detailed Location</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <FieldLabel label="Country" />
                  <input value={country || (project?.country ?? "")} onChange={e => setCountry(e.target.value)} placeholder="Kenya" />
                </div>
                <div>
                  <FieldLabel label="County / State" />
                  <input value={county || (project?.county ?? "")} onChange={e => setCounty(e.target.value)} placeholder="Nairobi" />
                </div>
                <div>
                  <FieldLabel label="Town / District" />
                  <input value={town || (project?.town ?? "")} onChange={e => setTown(e.target.value)} placeholder="Upper Hill" />
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <FieldLabel label="Project Scope / Description" />
              <textarea
                value={description || (project?.description ?? "")}
                onChange={e => setDescription(e.target.value)}
                placeholder="Brief summary of project scope, deliverables, and specifications…"
                rows={3}
                style={{ width: "100%", boxSizing: "border-box", resize: "vertical" }}
              />
            </div>

            {/* Module Activation */}
            {availableModules.length > 0 && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: "var(--text)" }}>Active Modules</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {sortModules(availableModules).map(m => {
                    const Icon = MODULE_ICONS[m.key] || Package;
                    const active = selectedModules.length === 0 || selectedModules.includes("full_package") || selectedModules.includes(m.key);
                    return (
                      <label key={m.key} style={{
                        display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
                        borderRadius: 8, cursor: "pointer",
                        border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
                        background: active ? "rgba(0,163,255,0.06)" : "transparent",
                      }}>
                        <Icon size={16} style={{ color: active ? "var(--primary)" : "var(--muted)" }} />
                        <input type="checkbox" checked={active} onChange={() => toggleModule(m.key)} style={{ display: "none" }} />
                        <span style={{ fontSize: 12, fontWeight: 600, flex: 1, color: active ? "var(--text)" : "var(--muted)" }}>{m.label.replace(" Only", "")}</span>
                        {active && <Check size={14} style={{ color: "var(--primary)" }} />}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
        <SubmitButton onClick={onSubmit} loading={submitting} disabled={submitting} style={{ padding: "12px 28px", fontSize: 14 }}>
          Save &amp; Continue to Team <ChevronRight size={16} style={{ marginLeft: 4 }} />
        </SubmitButton>
      </div>
    </div>
  );
}
