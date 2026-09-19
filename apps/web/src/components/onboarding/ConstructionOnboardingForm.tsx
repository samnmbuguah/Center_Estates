"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { ArrowLeft, ArrowRight, CheckCircle2, Download, FileSpreadsheet, Plus, RefreshCw, Save, Trash2, Upload } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/monitoring/hooks/useToast";
import { boqTemplateUrl, workplanTemplateUrl } from "@/components/monitoring/api";

interface ConstructionOnboardingFormProps {
  onBack?: () => void;
}

interface TeamMemberDraft {
  role: string;
  name: string;
  firm: string;
  email: string;
  phone: string;
}

const blankMember: TeamMemberDraft = {
  role: "Main Contractor",
  name: "",
  firm: "",
  email: "",
  phone: "",
};

const sections = [
  ["general", "General Details"],
  ["location", "Site & Geofencing"],
  ["timeline", "Timeline & Programme"],
  ["budget", "Budget & BOQ Baseline"],
  ["team", "Contractors & Team"],
  ["approvals", "Approvals & Safeguards"],
  ["notes", "Notes & Remarks"],
] as const;

function generateProjectCode(): string {
  const yr = new Date().getFullYear();
  const rand = Math.floor(100 + Math.random() * 900);
  return `CP-${yr}-${rand}`;
}

function generateBoqRef(projectCode?: string): string {
  const yr = new Date().getFullYear();
  const c = projectCode?.trim() || `CP-${yr}`;
  return `BOQ-${c}-01`;
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <Paper
      className="onboarding-section"
      role="tabpanel"
      id={id}
      aria-labelledby={`construction-tab-${id}`}
      variant="outlined"
      sx={{ p: { xs: 2, md: 2.5 } }}
    >
      <Typography variant="overline" color="primary" sx={{ fontWeight: 800, letterSpacing: 0.5 }}>
        {title}
      </Typography>
      <Box sx={{ mt: 1.25 }}>{children}</Box>
    </Paper>
  );
}

function Grid({ children, columns = 3 }: { children: React.ReactNode; columns?: number }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: `repeat(${columns}, minmax(0, 1fr))` },
        gap: 2,
      }}
    >
      {children}
    </Box>
  );
}

export function ConstructionOnboardingForm({ onBack }: ConstructionOnboardingFormProps) {
  const router = useRouter();
  const { session } = useAuth();
  const { toast } = useToast();
  const organizationId = session?.activeOrganizationId ?? null;

  const [section, setSection] = useState("general");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Step 1: General metadata
  const [name, setName] = useState("");
  const [code, setCode] = useState(() => generateProjectCode());
  const [clientName, setClientName] = useState("");
  const [stage, setStage] = useState("active");
  const [projectType, setProjectType] = useState("residential");
  const [contractType, setContractType] = useState("full");
  const [description, setDescription] = useState("");
  const [hasManuallyEditedBoqRef, setHasManuallyEditedBoqRef] = useState(false);

  // Step 2: Site & Location
  const [location, setLocation] = useState("");
  const [country, setCountry] = useState("KE");
  const [county, setCounty] = useState("Nairobi");
  const [town, setTown] = useState("");
  const [siteLat, setSiteLat] = useState("");
  const [siteLng, setSiteLng] = useState("");
  const [geofenceRadius, setGeofenceRadius] = useState("250");

  // Step 3: Timeline
  const [plannedStartDate, setPlannedStartDate] = useState("");
  const [plannedCompletionDate, setPlannedCompletionDate] = useState("");
  const [milestoneStructure, setMilestoneStructure] = useState("standard_civil");
  const [workplanFile, setWorkplanFile] = useState<File | null>(null);

  // Step 4: Budget & BOQ
  const [budget, setBudget] = useState("");
  const [tenderAmount, setTenderAmount] = useState("");
  const [baselineBoqRef, setBaselineBoqRef] = useState(() => generateBoqRef(generateProjectCode()));
  const [procurementMethod, setProcurementMethod] = useState("open_national");
  const [financialApproval, setFinancialApproval] = useState("");
  const [boqFile, setBoqFile] = useState<File | null>(null);

  // Post-Creation Guidance
  const [createdProject, setCreatedProject] = useState<{ id: string; name?: string } | null>(null);
  const [showNextStepsDialog, setShowNextStepsDialog] = useState(false);

  // Step 5: Team Members & Stakeholders
  const [members, setMembers] = useState<TeamMemberDraft[]>([]);
  const [memberDraft, setMemberDraft] = useState<TeamMemberDraft>(blankMember);

  // Step 6: Approvals & Safeguards (EIA/NEMA)
  const [eiaStatus, setEiaStatus] = useState("approved");
  const [permitNumber, setPermitNumber] = useState("");
  const [esmpExists, setEsmpExists] = useState(false);
  const [sepExists, setSepExists] = useState(false);
  const [grmContact, setGrmContact] = useState("");

  // Step 7: Notes
  const [notes, setNotes] = useState("");

  const jump = (id: string) => {
    setSection(id);
    document.querySelector(".construction-onboarding-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const addMember = () => {
    if (!memberDraft.name.trim()) {
      setError("Please specify the contact person or company name for the team member.");
      return;
    }
    setMembers((prev) => [...prev, memberDraft]);
    setMemberDraft(blankMember);
    setError("");
  };

  const removeMember = (idx: number) => {
    setMembers((prev) => prev.filter((_, i) => i !== idx));
  };

  // Readiness evaluation matching PropertyOnboardingForm
  const readiness = useMemo(() => {
    const checks = [
      { section: "general", label: "Project name", complete: Boolean(name.trim()) },
      { section: "general", label: "Client / Employer", complete: Boolean(clientName.trim()) },
      { section: "location", label: "Site address & town", complete: Boolean(location.trim() && town.trim()) },
      {
        section: "timeline",
        label: "Start & completion dates",
        complete: Boolean(plannedStartDate && plannedCompletionDate),
      },
      {
        section: "budget",
        label: "Approved project budget",
        complete: Boolean(budget && Number(budget) > 0),
      },
      {
        section: "team",
        label: "Contractor or consultant",
        complete: members.length > 0 || Boolean(memberDraft.name.trim()),
      },
      {
        section: "approvals",
        label: "Approvals or EIA status",
        complete: Boolean(eiaStatus || permitNumber.trim()),
      },
    ];
    const completed = checks.filter((c) => c.complete).length;
    return {
      checks,
      completed,
      score: Math.round((completed / checks.length) * 100),
      missing: checks.filter((c) => !c.complete),
    };
  }, [name, clientName, location, town, plannedStartDate, plannedCompletionDate, budget, members.length, memberDraft.name, eiaStatus, permitNumber]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Project name is required before saving.");
      jump("general");
      return;
    }
    if (plannedStartDate && plannedCompletionDate && new Date(plannedCompletionDate) <= new Date(plannedStartDate)) {
      setError("Planned completion date must be strictly after the start date.");
      jump("timeline");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload: Record<string, any> = {
        name: name.trim(),
        code: code.trim() || undefined,
        client_name: clientName.trim() || undefined,
        stage,
        project_type: projectType,
        contract_type: contractType,
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        country: country.trim() || "KE",
        county: county.trim() || undefined,
        town: town.trim() || undefined,
        budget: budget ? parseFloat(budget) : 0,
        tender_amount: tenderAmount ? parseFloat(tenderAmount) : 0,
        planned_start_date: plannedStartDate || undefined,
        planned_completion_date: plannedCompletionDate || undefined,
        site_latitude: siteLat ? parseFloat(siteLat) : undefined,
        site_longitude: siteLng ? parseFloat(siteLng) : undefined,
        geofence_radius_m: geofenceRadius ? parseInt(geofenceRadius, 10) : 250,
        eia_status: eiaStatus || undefined,
        esmp_exists: esmpExists,
        sep_exists: sepExists,
        grm_contact: grmContact.trim() || undefined,
        baseline_boq_ref: baselineBoqRef.trim() || undefined,
        procurement_method: procurementMethod || undefined,
        financial_approval: financialApproval.trim() || undefined,
        modules: ["full_package"],
        metadata: {
          milestone_structure: milestoneStructure,
          baseline_boq_filename: boqFile?.name,
          workplan_filename: workplanFile?.name,
          permit_number: permitNumber.trim() || undefined,
          team_directory: members,
          notes: notes.trim() || undefined,
          onboarding_readiness: {
            score: readiness.score,
            completed: readiness.completed,
            total: readiness.checks.length,
          },
        },
      };

      const res = await apiFetch(
        "/construction/projects/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
        organizationId
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.detail || err?.name?.[0] || "Failed to save construction project.");
      }

      const saved = await res.json();
      toast.success(`${saved.name || name} construction project registered successfully!`);

      setCreatedProject(saved);
      setShowNextStepsDialog(true);
    } catch (e: any) {
      setError(e?.message || "An unexpected error occurred while saving.");
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (onBack) onBack();
    else router.push("/monitoring/dashboard");
  };

  return (
    <Box className="construction-onboarding-card" sx={{ width: "100%", maxWidth: 1320, mx: "auto", px: { xs: 1.5, md: 3 }, py: 2.5 }}>
      {/* Top Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: { xs: "flex-start", sm: "center" },
          justifyContent: "space-between",
          gap: 2,
          mb: 2,
          flexDirection: { xs: "column", sm: "row" },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <IconButton aria-label="Back" onClick={handleBack}>
            <ArrowLeft />
          </IconButton>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, fontSize: { xs: "1.25rem", md: "1.5rem" } }}>
              Construction Project Onboarding
            </Typography>
            <Typography color="text.secondary" variant="body2">
              Register capital project details, site coordinates, contractor directory, and approvals.
            </Typography>
          </Box>
        </Box>
        <Box
          sx={{
            display: "flex",
            gap: 1,
            flexWrap: "wrap",
            justifyContent: { xs: "stretch", sm: "flex-end" },
            width: { xs: "100%", sm: "auto" },
          }}
        >
          <Button
            variant="contained"
            startIcon={<Save size={17} />}
            disabled={saving}
            onClick={handleSave}
            sx={{ minWidth: { xs: "100%", sm: 120 } }}
          >
            {saving ? "Saving…" : "Save & Close"}
          </Button>
        </Box>
      </Box>

      {/* Onboarding Readiness Card */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: "background.paper" }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, mb: 1 }}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
              Onboarding readiness
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {readiness.completed} of {readiness.checks.length} setup areas complete. You can save a draft and continue later.
            </Typography>
          </Box>
          <Chip
            label={`${readiness.score}%`}
            color={readiness.score === 100 ? "success" : readiness.score >= 60 ? "warning" : "default"}
            sx={{ fontWeight: 800, fontSize: 14 }}
          />
        </Box>
        <LinearProgress
          variant="determinate"
          value={readiness.score}
          color={readiness.score === 100 ? "success" : "primary"}
          sx={{ height: 8, borderRadius: 99, mb: readiness.missing.length ? 1.5 : 0 }}
        />
        {readiness.missing.length > 0 && (
          <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
            {readiness.missing.map((item) => (
              <Chip
                key={`${item.section}:${item.label}`}
                size="small"
                variant="outlined"
                label={`Add ${item.label}`}
                onClick={() => jump(item.section)}
              />
            ))}
          </Box>
        )}
      </Paper>

      {/* Sticky Horizontal Tabs Navigation */}
      <Paper variant="outlined" sx={{ position: "sticky", top: 76, zIndex: 5, mb: 2, overflowX: "auto" }}>
        <Tabs
          value={section}
          onChange={(_, value) => jump(value)}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="Construction onboarding sections"
          sx={{
            minHeight: 40,
            "& .MuiTab-root": { minHeight: 40, fontSize: { xs: 12, md: 14 }, fontWeight: 600, textTransform: "none" },
          }}
        >
          {sections.map(([id, label]) => (
            <Tab id={`construction-tab-${id}`} aria-controls={id} key={id} value={id} label={label} />
          ))}
        </Tabs>
      </Paper>

      {/* Error Alert */}
      {error && (
        <Alert
          severity="error"
          variant="filled"
          onClose={() => setError("")}
          sx={{ mb: 2, position: "sticky", top: 128, zIndex: 4, boxShadow: 3, borderRadius: 2 }}
        >
          <strong>Action needed:</strong> {error} Your entered information has been retained.
        </Alert>
      )}

      {/* Form Sections */}
      <Box sx={{ display: "grid", gap: 2, [`& > .onboarding-section:not(#${section})`]: { display: "none" } }}>
        {/* Section 1: General Details */}
        <Section id="general" title="General Information">
          <Grid>
            <TextField
              label="Project code"
              placeholder="e.g. CP-2026-001"
              value={code}
              onChange={(e) => {
                const val = e.target.value;
                setCode(val);
                if (!hasManuallyEditedBoqRef) {
                  setBaselineBoqRef(generateBoqRef(val));
                }
              }}
              helperText="Auto-generated project reference (editable)"
              slotProps={{
                input: {
                  endAdornment: (
                    <Tooltip title="Regenerate project code">
                      <IconButton
                        size="small"
                        onClick={() => {
                          const next = generateProjectCode();
                          setCode(next);
                          if (!hasManuallyEditedBoqRef) {
                            setBaselineBoqRef(generateBoqRef(next));
                          }
                        }}
                        edge="end"
                      >
                        <RefreshCw size={15} />
                      </IconButton>
                    </Tooltip>
                  ),
                },
              }}
            />
            <TextField
              required
              label="Project name"
              placeholder="e.g. Riverside Commercial Plaza - Main Works"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <TextField
              required
              label="Client / Employer name"
              placeholder="e.g. Riverside Holdings Ltd / Ministry of Housing"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
            />
            <TextField select required label="Project stage" value={stage} onChange={(e) => setStage(e.target.value)}>
              <MenuItem value="planning">Planning & Procurement</MenuItem>
              <MenuItem value="active">Active Construction</MenuItem>
              <MenuItem value="on_hold">On Hold / Suspended</MenuItem>
              <MenuItem value="complete">Substantially Complete</MenuItem>
              <MenuItem value="closed">Defects Liability / Closed</MenuItem>
            </TextField>
            <TextField
              select
              required
              label="Project type"
              value={projectType}
              onChange={(e) => setProjectType(e.target.value)}
            >
              <MenuItem value="residential">Residential Development</MenuItem>
              <MenuItem value="commercial">Commercial / Office Block</MenuItem>
              <MenuItem value="mixed_use">Mixed-Use Complex</MenuItem>
              <MenuItem value="infrastructure">Civil Infrastructure & Roads</MenuItem>
              <MenuItem value="standard">Standard Works</MenuItem>
              <MenuItem value="igp">Internationally Governed Project (IGP)</MenuItem>
            </TextField>
            <TextField
              select
              required
              label="Contract type"
              value={contractType}
              onChange={(e) => setContractType(e.target.value)}
            >
              <MenuItem value="full">Full Turnkey / EPC Contract</MenuItem>
              <MenuItem value="labor_only">Labor Only & Supervision</MenuItem>
              <MenuItem value="materials_supply">Materials Supply & Direct Labor</MenuItem>
            </TextField>
          </Grid>
          <TextField
            fullWidth
            multiline
            minRows={3}
            label="Project scope & technical description"
            placeholder="Construction of a 12-storey commercial tower comprising two basement parking levels, ground retail, and ten office floors..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            sx={{ mt: 2 }}
          />
        </Section>

        {/* Section 2: Site & Geofencing */}
        <Section id="location" title="Site Address & Coordinates Geofencing">
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Provide physical location and site coordinates. Mobile attendance, drone flights, and evidence captures will be verified against this perimeter.
          </Typography>
          <Grid>
            <TextField
              required
              label="Physical site address / plot road"
              placeholder="e.g. Plot 42, Riverside Drive"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
            <TextField
              required
              label="Town / Sub-county"
              placeholder="e.g. Westlands"
              value={town}
              onChange={(e) => setTown(e.target.value)}
            />
            <TextField
              required
              label="County / State"
              placeholder="e.g. Nairobi"
              value={county}
              onChange={(e) => setCounty(e.target.value)}
            />
            <TextField select label="Country" value={country} onChange={(e) => setCountry(e.target.value)}>
              <MenuItem value="KE">KE — Kenya</MenuItem>
              <MenuItem value="UG">UG — Uganda</MenuItem>
              <MenuItem value="TZ">TZ — Tanzania</MenuItem>
              <MenuItem value="RW">RW — Rwanda</MenuItem>
              <MenuItem value="SS">SS — South Sudan</MenuItem>
            </TextField>
            <TextField
              type="number"
              label="Site latitude (decimal degrees)"
              placeholder="-1.2654"
              value={siteLat}
              onChange={(e) => setSiteLat(e.target.value)}
            />
            <TextField
              type="number"
              label="Site longitude (decimal degrees)"
              placeholder="36.8045"
              value={siteLng}
              onChange={(e) => setSiteLng(e.target.value)}
            />
          </Grid>
          <Box sx={{ mt: 2, maxWidth: 400 }}>
            <TextField
              fullWidth
              type="number"
              label="Evidence geofence radius (meters)"
              value={geofenceRadius}
              onChange={(e) => setGeofenceRadius(e.target.value)}
              helperText="Evidence uploaded outside this radius is automatically flagged for review."
            />
          </Box>
        </Section>

        {/* Section 3: Timeline & Programme */}
        <Section id="timeline" title="Timeline & Milestone Programme">
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Define schedule dates and milestone breakdown framework.
          </Typography>
          <Grid>
            <TextField
              required
              type="date"
              label="Planned start date"
              slotProps={{ inputLabel: { shrink: true } }}
              value={plannedStartDate}
              onChange={(e) => setPlannedStartDate(e.target.value)}
            />
            <TextField
              required
              type="date"
              label="Planned completion date"
              slotProps={{ inputLabel: { shrink: true } }}
              value={plannedCompletionDate}
              onChange={(e) => setPlannedCompletionDate(e.target.value)}
            />
            <TextField
              select
              label="Milestone programme structure"
              value={milestoneStructure}
              onChange={(e) => setMilestoneStructure(e.target.value)}
            >
              <MenuItem value="standard_civil">Standard Civil (Substructure, Superstructure, Finishes)</MenuItem>
              <MenuItem value="high_rise">Multi-Storey Frame & Envelope</MenuItem>
              <MenuItem value="fitout">Internal Fit-Out & MEP Commissioning</MenuItem>
              <MenuItem value="custom_wbs">Custom Work Breakdown Schedule (WBS)</MenuItem>
            </TextField>
          </Grid>

          {/* Master Work Programme File Dropzone */}
          <Box
            sx={{
              mt: 2.5,
              p: 2,
              borderRadius: 2,
              border: "1px dashed",
              borderColor: workplanFile ? "primary.main" : "divider",
              bgcolor: workplanFile ? "action.hover" : "background.paper",
              display: "flex",
              flexDirection: { xs: "column", sm: "row" },
              alignItems: { xs: "flex-start", sm: "center" },
              justifyContent: "space-between",
              gap: 2,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 2,
                  bgcolor: "primary.light",
                  color: "primary.main",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                }}
              >
                ⏱️
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  Master Work Programme Schedule (Optional)
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                  Attach your project work plan (.xlsx, .mpp, .csv). You can review and commit milestones during onboarding or in the Ingestion hub.
                </Typography>
                {workplanFile && (
                  <Box sx={{ mt: 0.75, display: "flex", alignItems: "center", gap: 1 }}>
                    <Chip
                      size="small"
                      color="primary"
                      variant="outlined"
                      label={workplanFile.name}
                      onDelete={() => setWorkplanFile(null)}
                    />
                    <Typography variant="caption" color="text.secondary">
                      ({(workplanFile.size / 1024).toFixed(1)} KB)
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignSelf: { xs: "flex-start", sm: "center" } }}>
              <Button
                component="a"
                href={workplanTemplateUrl}
                download="workplan_template.xlsx"
                variant="outlined"
                size="small"
                startIcon={<Download size={15} />}
                sx={{ whiteSpace: "nowrap" }}
              >
                Download Workplan Template (.xlsx)
              </Button>
              <Button
                component="label"
                variant={workplanFile ? "outlined" : "contained"}
                size="small"
                startIcon={<Upload size={16} />}
                sx={{ whiteSpace: "nowrap" }}
              >
                {workplanFile ? "Change File" : "Select Schedule (.xlsx)"}
                <input
                  type="file"
                  hidden
                  accept=".xlsx,.xls,.csv,.mpp"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setWorkplanFile(f);
                  }}
                />
              </Button>
            </Box>
          </Box>
        </Section>

        {/* Section 4: Budget & BOQ Baseline */}
        <Section id="budget" title="Financial Budget & Baseline BOQ">
          <Grid>
            <TextField
              required
              type="number"
              label="Approved project budget (KES)"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="450000000"
            />
            <TextField
              type="number"
              label="Contract awarded / tender sum (KES)"
              value={tenderAmount}
              onChange={(e) => setTenderAmount(e.target.value)}
              placeholder="445000000"
            />
            <TextField
              label="Baseline BOQ reference"
              placeholder="e.g. BOQ-CP-2026-001-01"
              value={baselineBoqRef}
              onChange={(e) => {
                setHasManuallyEditedBoqRef(true);
                setBaselineBoqRef(e.target.value);
              }}
              helperText="Auto-generated reference (editable)"
              slotProps={{
                input: {
                  endAdornment: (
                    <Tooltip title="Regenerate BOQ reference">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setBaselineBoqRef(generateBoqRef(code));
                          setHasManuallyEditedBoqRef(false);
                        }}
                        edge="end"
                      >
                        <RefreshCw size={15} />
                      </IconButton>
                    </Tooltip>
                  ),
                },
              }}
            />
            <TextField
              select
              label="Procurement method"
              value={procurementMethod}
              onChange={(e) => setProcurementMethod(e.target.value)}
            >
              <MenuItem value="open_national">Open National Competitive Tender</MenuItem>
              <MenuItem value="restricted">Restricted / Prequalified Tender</MenuItem>
              <MenuItem value="direct_award">Direct Award / Negotiated</MenuItem>
              <MenuItem value="framework">Framework Agreement</MenuItem>
            </TextField>
            <TextField
              label="Financial approval authority"
              placeholder="e.g. Board Tender Committee / Project Sponsor"
              value={financialApproval}
              onChange={(e) => setFinancialApproval(e.target.value)}
            />
          </Grid>

          {/* BoQ File Attachment Dropzone */}
          <Box
            sx={{
              mt: 2.5,
              p: 2,
              borderRadius: 2,
              border: "1px dashed",
              borderColor: boqFile ? "secondary.main" : "divider",
              bgcolor: boqFile ? "action.hover" : "background.paper",
              display: "flex",
              flexDirection: { xs: "column", sm: "row" },
              alignItems: { xs: "flex-start", sm: "center" },
              justifyContent: "space-between",
              gap: 2,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 2,
                  bgcolor: "secondary.light",
                  color: "secondary.main",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                }}
              >
                📐
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  Priced Bill of Quantities (BoQ) (Optional)
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                  Attach your tender BoQ spreadsheet (.xlsx) or tender PDF. Line items, rates, and totals will be processed into cost baseline states.
                </Typography>
                {boqFile && (
                  <Box sx={{ mt: 0.75, display: "flex", alignItems: "center", gap: 1 }}>
                    <Chip
                      size="small"
                      color="secondary"
                      variant="outlined"
                      label={boqFile.name}
                      onDelete={() => setBoqFile(null)}
                    />
                    <Typography variant="caption" color="text.secondary">
                      ({(boqFile.size / 1024).toFixed(1)} KB)
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignSelf: { xs: "flex-start", sm: "center" } }}>
              <Button
                component="a"
                href={boqTemplateUrl}
                download="boq_template.xlsx"
                variant="outlined"
                size="small"
                color="secondary"
                startIcon={<Download size={15} />}
                sx={{ whiteSpace: "nowrap" }}
              >
                Download BoQ Template (.xlsx)
              </Button>
              <Button
                component="label"
                variant={boqFile ? "outlined" : "contained"}
                size="small"
                color="secondary"
                startIcon={<Upload size={16} />}
                sx={{ whiteSpace: "nowrap" }}
              >
                {boqFile ? "Change File" : "Select BoQ (.xlsx / .pdf)"}
                <input
                  type="file"
                  hidden
                  accept=".xlsx,.xls,.csv,.pdf,application/pdf"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setBoqFile(f);
                  }}
                />
              </Button>
            </Box>
          </Box>
        </Section>

        {/* Section 5: Team Members & Contractors */}
        <Section id="team" title="Contractors & Project Stakeholders">
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Maintain the primary directory of contractors, consulting engineers, architects, and project managers.
          </Typography>
          <Grid columns={5}>
            <TextField
              select
              label="Stakeholder role"
              value={memberDraft.role}
              onChange={(e) => setMemberDraft({ ...memberDraft, role: e.target.value })}
            >
              <MenuItem value="Main Contractor">Main Contractor</MenuItem>
              <MenuItem value="Sub-Contractor">Sub-Contractor</MenuItem>
              <MenuItem value="Structural Engineer">Structural Engineer</MenuItem>
              <MenuItem value="Architect">Architect</MenuItem>
              <MenuItem value="Project Manager">Project Manager</MenuItem>
              <MenuItem value="Quantity Surveyor">Quantity Surveyor</MenuItem>
              <MenuItem value="Clerk of Works">Clerk of Works</MenuItem>
              <MenuItem value="MEP Engineer">MEP Engineer</MenuItem>
            </TextField>
            <TextField
              label="Contact person name"
              placeholder="e.g. Eng. David Mwangi"
              value={memberDraft.name}
              onChange={(e) => setMemberDraft({ ...memberDraft, name: e.target.value })}
            />
            <TextField
              label="Company / Firm name"
              placeholder="e.g. Apex Builders Ltd"
              value={memberDraft.firm}
              onChange={(e) => setMemberDraft({ ...memberDraft, firm: e.target.value })}
            />
            <TextField
              label="Email address"
              placeholder="david@apexbuilders.co.ke"
              value={memberDraft.email}
              onChange={(e) => setMemberDraft({ ...memberDraft, email: e.target.value })}
            />
            <TextField
              label="Phone number"
              placeholder="+254 712 345678"
              value={memberDraft.phone}
              onChange={(e) => setMemberDraft({ ...memberDraft, phone: e.target.value })}
            />
          </Grid>
          <Box sx={{ mt: 1.5, mb: 3 }}>
            <Button variant="outlined" size="small" startIcon={<Plus size={16} />} onClick={addMember}>
              Add Stakeholder
            </Button>
          </Box>

          {/* Members Table */}
          {members.length > 0 ? (
            <Box sx={{ overflowX: "auto" }}>
              <Box
                component="table"
                sx={{
                  width: "100%",
                  borderCollapse: "collapse",
                  "th, td": { textAlign: "left", p: 1.25, borderBottom: "1px solid", borderColor: "divider", fontSize: 13 },
                }}
              >
                <thead>
                  <tr>
                    <th>Role</th>
                    <th>Contact Person</th>
                    <th>Company / Firm</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th style={{ width: 60 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m, idx) => (
                    <tr key={idx}>
                      <td>
                        <Chip size="small" label={m.role} sx={{ fontWeight: 600, fontSize: 11 }} />
                      </td>
                      <td><strong>{m.name}</strong></td>
                      <td>{m.firm || "—"}</td>
                      <td>{m.email || "—"}</td>
                      <td>{m.phone || "—"}</td>
                      <td>
                        <IconButton size="small" aria-label="Remove" onClick={() => removeMember(idx)}>
                          <Trash2 size={15} />
                        </IconButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Box>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
              No project stakeholders added yet. Use the fields above to add contractors and consultants.
            </Typography>
          )}
        </Section>

        {/* Section 6: Approvals & Safeguards */}
        <Section id="approvals" title="Statutory Approvals & Environmental Safeguards">
          <Grid>
            <TextField
              select
              label="NEMA / EIA license status"
              value={eiaStatus}
              onChange={(e) => setEiaStatus(e.target.value)}
            >
              <MenuItem value="approved">Approved & License Issued</MenuItem>
              <MenuItem value="pending">Application Submitted / Pending Review</MenuItem>
              <MenuItem value="not_required">Exempt / Not Required for this Scope</MenuItem>
            </TextField>
            <TextField
              label="County building approval / permit reference"
              placeholder="e.g. NCC/PL/2026/089"
              value={permitNumber}
              onChange={(e) => setPermitNumber(e.target.value)}
            />
            <TextField
              label="Grievance Redress (GRM) contact"
              placeholder="Community Liaison Officer (+254 700 000000)"
              value={grmContact}
              onChange={(e) => setGrmContact(e.target.value)}
            />
          </Grid>
          <Box sx={{ display: "flex", gap: 4, mt: 2, flexWrap: "wrap" }}>
            <FormControlLabel
              control={<Switch checked={esmpExists} onChange={(e) => setEsmpExists(e.target.checked)} />}
              label="Environmental & Social Management Plan (ESMP) active on site"
            />
            <FormControlLabel
              control={<Switch checked={sepExists} onChange={(e) => setSepExists(e.target.checked)} />}
              label="Stakeholder Engagement Plan (SEP) active on site"
            />
          </Box>
        </Section>

        {/* Section 7: Notes & Remarks */}
        <Section id="notes" title="Notes & Site Conditions">
          <TextField
            fullWidth
            multiline
            minRows={3}
            label="General remarks & constraints"
            placeholder="Special site safety measures, access limitations, borehole depth records, or subcontractor pre-qualification guidelines..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Section>
      </Box>

      {/* Post-Registration Next Steps Dialog */}
      <Dialog
        open={showNextStepsDialog}
        maxWidth="sm"
        fullWidth
        onClose={() => {
          setShowNextStepsDialog(false);
          if (onBack) onBack();
          else router.push(`/monitoring?tab=overview&id=${createdProject?.id}`);
        }}
      >
        <DialogTitle sx={{ pb: 1, display: "flex", alignItems: "center", gap: 1.5 }}>
          <CheckCircle2 color="var(--color-emerald, #10b981)" size={26} />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Project Successfully Registered!
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
            <strong>{createdProject?.name || name}</strong> has been initialized. Complete your project baseline by importing your technical documentation into the ingestion engine:
          </Typography>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {/* BoQ Ingestion Card */}
            <Card
              variant="outlined"
              sx={{
                p: 2,
                cursor: "pointer",
                transition: "all 0.15s ease",
                "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" },
              }}
              onClick={() => {
                setShowNextStepsDialog(false);
                router.push(`/monitoring?tab=ingestion&type=boq&id=${createdProject?.id}`);
              }}
            >
              <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <Box sx={{ display: "flex", gap: 1.5 }}>
                  <Box sx={{ fontSize: 24 }}>📐</Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      Import Bill of Quantities (BoQ)
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {boqFile ? `Parse line items from attached "${boqFile.name}" or upload new tender sheet.` : "Upload Excel BoQ or extract from PDF tender bill."}
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                  <Button
                    component="a"
                    href={boqTemplateUrl}
                    download="boq_template.xlsx"
                    size="small"
                    variant="outlined"
                    color="secondary"
                    startIcon={<Download size={13} />}
                    onClick={(e) => e.stopPropagation()}
                    sx={{ whiteSpace: "nowrap" }}
                  >
                    Download Template
                  </Button>
                  <Button size="small" variant="contained" color="secondary" endIcon={<ArrowRight size={14} />}>
                    Ingest BoQ
                  </Button>
                </Box>
              </Box>
            </Card>

            {/* Workplan Ingestion Card */}
            <Card
              variant="outlined"
              sx={{
                p: 2,
                cursor: "pointer",
                transition: "all 0.15s ease",
                "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" },
              }}
              onClick={() => {
                setShowNextStepsDialog(false);
                router.push(`/monitoring?tab=ingestion&type=workplan&id=${createdProject?.id}`);
              }}
            >
              <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <Box sx={{ display: "flex", gap: 1.5 }}>
                  <Box sx={{ fontSize: 24 }}>⏱️</Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      Import Master Work Programme
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {workplanFile ? `Establish milestones from attached "${workplanFile.name}".` : "Upload Excel schedule to generate WBS milestones & Gantt."}
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                  <Button
                    component="a"
                    href={workplanTemplateUrl}
                    download="workplan_template.xlsx"
                    size="small"
                    variant="outlined"
                    startIcon={<Download size={13} />}
                    onClick={(e) => e.stopPropagation()}
                    sx={{ whiteSpace: "nowrap" }}
                  >
                    Download Template
                  </Button>
                  <Button size="small" variant="contained" endIcon={<ArrowRight size={14} />}>
                    Ingest Plan
                  </Button>
                </Box>
              </Box>
            </Card>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, justifyContent: "space-between" }}>
          <Typography variant="caption" color="text.secondary">
            You can always import or update baseline data later from the navigation menu.
          </Typography>
          <Button
            variant="text"
            onClick={() => {
              setShowNextStepsDialog(false);
              if (onBack) onBack();
              else router.push(`/monitoring?tab=overview&id=${createdProject?.id}`);
            }}
          >
            Go to Project Overview
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
