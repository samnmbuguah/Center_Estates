import { useCallback, useEffect, useMemo, useState } from "react";
import type { TourStep } from "./tourSteps";
import { API_BASE, authHeaders, getToken } from "../../api";

const STORAGE_KEY = "tour_completed";

function syncTourProgress(role: string, completed: boolean): void {
  if (!role) return;
  try {
    fetch(`${API_BASE}/tour/progress`, {
      method: "PUT",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role, completed }),
    }).catch(() => {});
  } catch {
    // ignore unauthenticated or missing token
  }
}

export interface TourAPI {
  isActive: boolean;
  currentStep: number;
  steps: TourStep[];
  step: TourStep | null;
  totalSteps: number;
  isCompleted: boolean;
  start: () => void;
  startFromStep: (index: number) => void;
  stop: () => void;
  goNext: () => void;
  goPrev: () => void;
  goToStep: (index: number) => void;
  resetCompleted: () => void;
  markCompleted: () => void;
}

export interface TourState {
  active: boolean;
  currentStep: number;
  steps: TourStep[];
}

export function useTour(role?: string) {
  const steps = useMemo(() => getStepsForRole(role), [role]);

  const completedKey = role ? `${STORAGE_KEY}_${role}` : STORAGE_KEY;

  const [completed, setCompleted] = useState(() => {
    try {
      return localStorage.getItem(completedKey) === "true";
    } catch {
      return false;
    }
  });

  const [state, setState] = useState<TourState>({
    active: false,
    currentStep: 0,
    steps,
  });

  const markCompleted = useCallback(() => {
    setCompleted(true);
    try {
      localStorage.setItem(completedKey, "true");
    } catch {}
    if (role) syncTourProgress(role, true);
  }, [completedKey, role]);

  const start = useCallback(() => {
    if (!steps.length) return;
    setState({ active: true, currentStep: 0, steps });
  }, [steps]);

  const startFromStep = useCallback((index: number) => {
    setState({ active: true, currentStep: Math.min(index, steps.length - 1), steps });
  }, [steps]);

  const stop = useCallback(() => {
    setState({ active: false, currentStep: 0, steps });
    markCompleted();
  }, [steps, markCompleted]);

  const goNext = useCallback(() => {
    setState((prev) => {
      if (prev.currentStep >= prev.steps.length - 1) {
        markCompleted();
        return { ...prev, active: false, currentStep: 0 };
      }
      return { ...prev, currentStep: prev.currentStep + 1 };
    });
  }, [markCompleted]);

  const goPrev = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentStep: Math.max(0, prev.currentStep - 1),
    }));
  }, []);

  const goToStep = useCallback((index: number) => {
    setState((prev) => ({
      ...prev,
      currentStep: Math.min(index, prev.steps.length - 1),
    }));
  }, []);

  const resetCompleted = useCallback(() => {
    setCompleted(false);
    try {
      localStorage.removeItem(completedKey);
    } catch {}
    if (role) syncTourProgress(role, false);
  }, [completedKey, role]);

  return {
    isActive: state.active,
    currentStep: state.currentStep,
    steps,
    step: state.steps[state.currentStep] || null,
    totalSteps: state.steps.length,
    isCompleted: completed,
    start,
    startFromStep,
    stop,
    goNext,
    goPrev,
    goToStep,
    resetCompleted,
    markCompleted,
  };
}

function getStepsForRole(role?: string): TourStep[] {
  if (!role) {
    return [];
  }
  // Alias legacy/custom role names to canonical slugs
  const aliases: Record<string, string> = {
    engineer: "structural_engineer",
    civil_engineer: "structural_engineer",
    main_contractor: "contractor",
    legal: "advocate",
  };
  const canonical = aliases[role] || role;
  const steps = ROLE_TOURS[canonical];
  if (!steps) {
    return ROLE_TOURS.default || [];
  }
  return steps;
}

export const ROLE_TOURS: Record<string, TourStep[]> = {
  // ─────────────────────────────────────────────────────────
  // CLERK OF WORKS — 35 steps
  // ─────────────────────────────────────────────────────────
  clerk_of_works: [
    { id: "cow-01", target: "[data-tour-target='dashboard-stats']", targetFallback: ".stat-card", title: "Your Site Dashboard", content: "This is your command center. Key stats show your assigned projects, today's tasks, open tickets, photos taken today, and missing daily logs. Use this as your daily starting point.", placement: "bottom", sectionTitle: "Dashboard Overview", route: "/app" },
    { id: "cow-02", target: "a[href*='/app/daily-logs']", title: "1. Open Daily Logs", content: "Daily Logs are your most important tool. Click here to start recording site conditions for the day.", placement: "right", route: "/app/daily-logs", action: "click", sectionTitle: "Daily Logging Workflow" },
    { id: "cow-03", target: ".page-head", title: "2. Daily Log Form", content: "This page captures a complete site diary entry. Fill in weather (AM/PM), rainfall, materials delivered, labour deployment, plant & equipment, visitors, and information received.", placement: "bottom", sectionTitle: "Daily Logging Workflow" },
    { id: "cow-04", target: "select, input", title: "3. Weather & Conditions", content: "Start with morning and afternoon weather dropdowns. Mark rainfall — if yes, enter hours lost. This data feeds compliance streaks.", placement: "bottom", sectionTitle: "Daily Logging Workflow" },
    { id: "cow-05", target: "button", title: "4. Submit Daily Log", content: "After filling all sections, click submit. Your log is timestamped, geo-tagged, and stored. Consistent daily logging is critical for compliance streaks.", placement: "top", sectionTitle: "Daily Logging Workflow" },
    { id: "cow-06", target: "a[href*='/app/site-records']", title: "5. Site Records", content: "Navigate to Site Records to log material deliveries and H&S incidents separately from the daily diary.", placement: "right", route: "/app/site-records", action: "click", sectionTitle: "Site Records" },
    { id: "cow-07", target: ".page-head", title: "6. Material Deliveries", content: "Here you record materials arriving on site: type, quantity, conformance (pass/fail), and damaged items. Attach photos as evidence.", placement: "bottom", sectionTitle: "Site Records" },
    { id: "cow-08", target: "table, .card", title: "7. H&S Incidents", content: "Record any health & safety incidents: date, severity (near miss / first aid / serious / lost time), description, and action taken. Serious incidents trigger automatic office alerts.", placement: "bottom", sectionTitle: "Site Records" },
    { id: "cow-09", target: "a[href*='/app/timeline']", title: "8. Photo Timeline", content: "Every GPS-tagged progress photo appears here grouped by visit date. This creates a visual history of site progress over time.", placement: "right", route: "/app/timeline", action: "click", sectionTitle: "Photo Evidence" },
    { id: "cow-10", target: "img, .card", title: "9. Evidence Review", content: "Photos are automatically tagged with timestamp, GPS coordinates, and device ID. Tap any photo to view full-screen with metadata.", placement: "bottom", sectionTitle: "Photo Evidence" },
    { id: "cow-11", target: "a[href*='/app/projects/']", title: "10. Your Projects", content: "Now let's look at your assigned projects. Click to see the project list with filtering and search.", placement: "right", route: "/app/projects", action: "click", sectionTitle: "Project & Milestone Work" },
    { id: "cow-12", target: ".card, table", title: "11. Project List", content: "Each project shows its name, status, location, and progress summary. Click a project to open its detail page with module links.", placement: "bottom", sectionTitle: "Project & Milestone Work" },
    { id: "cow-13", target: ".sidebar .nav-group:last-child", title: "12. Project-Specific Modules", content: "Once you select a project, the sidebar shows module links specific to that project's configuration — like Quality Tests, BIM Models, or Cost features.", placement: "right", sectionTitle: "Project & Milestone Work" },
    { id: "cow-14", target: "a[href*='/app/tickets']", title: "13. Tickets / Issue Reporting", content: "Navigate to Tickets to raise and track site issues.", placement: "right", route: "/app/tickets", action: "click", sectionTitle: "Issue Management" },
    { id: "cow-15", target: ".page-head", title: "14. Ticket Dashboard", content: "View all open tickets, filter by status, and track resolutions. Each ticket shows priority, assignee, and target resolution date.", placement: "bottom", sectionTitle: "Issue Management" },
    { id: "cow-16", target: "button:not([class*='ghost'])", title: "15. Creating a Ticket", content: "Click 'New Ticket' or the create button. Fill in: topic (dropdown), description, assign to (role), risk level (Low/Medium/High), sensitivity (Normal/Urgent), and target resolution date.", placement: "top", sectionTitle: "Issue Management" },
    { id: "cow-17", target: "select", title: "16. Risk × Sensitivity Matrix", content: "Risk Level × Sensitivity determines escalation: Low/Normal = notify owner only; Medium/Urgent = notify PM; High/Any = notify PM + Client + flag CRITICAL.", placement: "bottom", sectionTitle: "Issue Management" },
    { id: "cow-18", target: "a[href*='/app/reports']", title: "17. Reports", content: "Navigate to Reports to view auto-generated weekly reports.", placement: "right", route: "/app/reports", action: "click", sectionTitle: "Reporting & Analysis" },
    { id: "cow-19", target: ".card, .page-head", title: "18. Weekly Report View", content: "Reports are auto-generated from daily logs and milestone submissions. They include: milestones completed, % progress, observations, flagged issues, and compliance streaks.", placement: "bottom", sectionTitle: "Reporting & Analysis" },
    { id: "cow-20", target: "button", title: "19. Export Report", content: "You can export reports as PDF or Excel. These reports are traceable to original evidence for financiers and auditors.", placement: "top", sectionTitle: "Reporting & Analysis" },
    { id: "cow-21", target: "a[href*='/app/assistant']", title: "20. AI Assistant", content: "Navigate to the AI Assistant — your conversational helper.", placement: "right", route: "/app/assistant", action: "click", sectionTitle: "AI Assistant" },
    { id: "cow-22", target: "input, textarea", title: "21. Ask Questions", content: "Type questions like: 'How many photos did I take this week?' or 'Show my pending tickets' or 'Summarize today's logs.' The AI knows your data and gives instant answers.", placement: "bottom", sectionTitle: "AI Assistant" },
    { id: "cow-23", target: "a[href*='/app/notices']", title: "22. Notices", content: "Check Notices for site instructions, safety alerts, and announcements from the project office.", placement: "right", route: "/app/notices", action: "click", sectionTitle: "Notices & Help" },
    { id: "cow-24", target: ".page-head", title: "23. System Announcements", content: "Important communications are posted here. Read new notices daily — they may contain updated procedures or safety alerts.", placement: "bottom", sectionTitle: "Notices & Help" },
    { id: "cow-25", target: "[data-tour-target='layout-help-button']", targetFallback: "button[class*='ghost']", title: "24. Help & Tour", content: "Press the Help button anytime to revisit this guide or restart the tour. In the Help modal, click 'Guided Tour' to go again.", placement: "top", sectionTitle: "Notices & Help" },
    { id: "cow-26", target: "a[href*='/app/calendar']", title: "25. Calendar View", content: "Navigate to the calendar to see your schedule, upcoming milestones, and logging deadlines at a glance.", placement: "right", route: "/app/calendar", action: "click", sectionTitle: "Daily Logging Workflow" },
    { id: "cow-27", target: ".card, .grid", title: "26. Compliance Streaks", content: "Track your daily log submission streak. A green streak means consistent logging. Missing a day resets your streak — stay on top of daily entries.", placement: "bottom", sectionTitle: "Daily Logging Workflow" },
    { id: "cow-28", target: "a[href*='/app/timeline']", title: "27. Photo AI Tagging", content: "When you upload photos, the AI automatically tags them with descriptive labels like 'concrete', 'formwork', 'rebar', making them searchable.", placement: "right", sectionTitle: "Photo Evidence" },
    { id: "cow-29", target: "input, textarea", title: "28. Observations Entry", content: "In each daily log, add observations about site conditions, quality concerns, or notable events. Observations can be flagged as Issue or Urgent.", placement: "bottom", sectionTitle: "Daily Logging Workflow" },
    { id: "cow-30", target: "a[href*='/geofence']", title: "29. Geofence Awareness", content: "Your photos and daily logs are automatically geo-tagged. Geofence validation ensures site evidence is captured within the project boundary.", placement: "right", sectionTitle: "Photo Evidence" },
    { id: "cow-31", target: "a[href*='/app/milestones']", title: "30. Milestone Submissions", content: "Navigate to submit milestone progress. Each milestone tracks % complete, evidence photos, observations, and verification status.", placement: "right", route: "/app/projects", action: "click", sectionTitle: "Project & Milestone Work" },
    { id: "cow-32", target: "select", title: "31. Multi-Project Switching", content: "Use the project selector to switch between assigned projects. Your dashboard and data update dynamically for the selected project.", placement: "bottom", sectionTitle: "Project & Milestone Work" },
    { id: "cow-33", target: "a[href*='/app/finance']", title: "32. Certificate Visibility", content: "View issued certificates and payment status for your projects — stay informed about the financial flow of work you've certified.", placement: "right", route: "/app/finance", action: "click", sectionTitle: "Reporting & Analysis" },
    { id: "cow-34", target: "a[href*='/app/site-records']", title: "33. Offline Mode", content: "The mobile app supports offline data collection. Log daily entries and capture photos even without internet — they sync when you're back online.", placement: "right", sectionTitle: "Site Records" },
    { id: "cow-35", target: "[data-tour-target='dashboard-stats']", targetFallback: ".stat-card", title: "34. Tour Complete!", content: "You've completed the Clerk of Works tour. Use the Help button anytime to restart. Consistent logging is your key to project success!", placement: "bottom", sectionTitle: "Notices & Help" },
  ],

  // ─────────────────────────────────────────────────────────
  // PROJECT MANAGER — 35 steps
  // ─────────────────────────────────────────────────────────
  project_manager: [
    { id: "pm-01", target: "[data-tour-target='dashboard-stats']", targetFallback: ".stat-card", title: "Your PM Dashboard", content: "Your dashboard shows active projects, on-track vs at-risk counts, pending verifications, open tickets, and pending requisitions. Use this as your daily triage point.", placement: "bottom", sectionTitle: "Dashboard Overview", route: "/app" },
    { id: "pm-02", target: "a[href*='/app/projects']", title: "1. Projects Register", content: "Click here to see every project across your portfolio. Create new projects, filter by status, or archive completed ones.", placement: "right", route: "/app/projects", action: "click", sectionTitle: "Project Management" },
    { id: "pm-03", target: ".card, table", title: "2. Project List View", content: "Each row shows project name, location, type, status, and progress %. Click any project to drill into its detail page.", placement: "bottom", sectionTitle: "Project Management" },
    { id: "pm-04", target: "a[href*='/app/onboarding']", title: "3. Project Onboarding Wizard", content: "Use the Onboarding wizard to set up new projects. It's a 4-step guided process.", placement: "right", route: "/app/onboarding", action: "click", sectionTitle: "Project Onboarding" },
    { id: "pm-05", target: "form, .card", title: "4. Step 1: Project Metadata", content: "Fill in: project name, location (country, county, town), type (residential/commercial/mixed-use/infrastructure), estimated value, start/completion dates, and description.", placement: "bottom", sectionTitle: "Project Onboarding" },
    { id: "pm-06", target: "button", title: "5. Step 2: Stakeholder Assignment", content: "Assign mandatory stakeholders: Developer, Financier, Architect, QS, MEP Engineer, Civil Engineer, Clerk of Works, Main Contractor. Link existing users or invite via email.", placement: "top", sectionTitle: "Project Onboarding" },
    { id: "pm-07", target: "button", title: "6. Step 3: Document Uploads", content: "Upload baseline documents: Architectural plans (PDF), Bills of Quantities (Excel/PDF), Workplans (Excel/MS Project), Contracts, Drawings, and Permits.", placement: "top", sectionTitle: "Project Onboarding" },
    { id: "pm-08", target: "button", title: "7. Step 4: Review & Complete", content: "Review all entered data before finalizing. Once complete, the project status changes to 'On-Boarding Complete' and it's ready for site operations.", placement: "top", sectionTitle: "Project Onboarding" },
    { id: "pm-09", target: "a[href*='/app/verifications']", title: "8. Verifications", content: "Navigate to the Verification dashboard to review Clerk of Works milestone submissions.", placement: "right", route: "/app/verifications", action: "click", sectionTitle: "Verification & Certification" },
    { id: "pm-10", target: ".card, table", title: "9. Pending Verifications", content: "Each row shows a milestone submission awaiting review. See the Clerk's progress %, photos, and observations. Only verified milestones qualify for payment.", placement: "bottom", sectionTitle: "Verification & Certification" },
    { id: "pm-11", target: "button:not([class*='ghost'])", title: "10. Approve or Reject", content: "Click to review a submission. You can Approve (locks milestone), Reject (suspends payment), or Request Clarification. All decisions are timestamped and signed.", placement: "top", sectionTitle: "Verification & Certification" },
    { id: "pm-12", target: "textarea, input", title: "11. Add Office Notes", content: "Add comments or office notes during review. These notes are visible alongside the submission without altering original evidence.", placement: "bottom", sectionTitle: "Verification & Certification" },
    { id: "pm-13", target: "a[href*='/app/reports']", title: "12. Reports", content: "Navigate to Reports for weekly analysis and stakeholder communication.", placement: "right", route: "/app/reports", action: "click", sectionTitle: "Reporting" },
    { id: "pm-14", target: ".page-head, .card", title: "13. S-Curve Progress Chart", content: "The S-curve shows planned vs actual progress over time. Variance is color-coded: green (on track), amber (at risk), red (behind).", placement: "bottom", sectionTitle: "Reporting" },
    { id: "pm-15", target: ".tabs, .grid", title: "14. Compliance Streaks", content: "The Compliance view shows daily log submission streaks per project. Missing logs are flagged red — contact your Clerk to maintain compliance.", placement: "bottom", sectionTitle: "Reporting" },
    { id: "pm-16", target: "button", title: "15. AI Narrative & Export", content: "Reports include AI-drafted narrative summaries. Click Export to generate PDF or Excel for stakeholders, financiers, and auditors.", placement: "top", sectionTitle: "Reporting" },
    { id: "pm-17", target: "a[href*='/app/finance']", title: "16. Finance Hub", content: "Navigate to Finance to review requisitions, certificates, and disbursements.", placement: "right", route: "/app/finance", action: "click", sectionTitle: "Financial Oversight" },
    { id: "pm-18", target: ".tabs, .page-head", title: "17. Requisitions & Certificates", content: "Track the full financial flow: requisitions (submitted → reviewed → approved → paid), certificates (interim/final), and disbursements. Filter by project.", placement: "bottom", sectionTitle: "Financial Oversight" },
    { id: "pm-19", target: "a[href*='/cost-dashboard']", title: "18. Cost Dashboard", content: "Navigate to the Cost Dashboard for a full financial picture per project.", placement: "right", route: "/app/projects", action: "click", sectionTitle: "Cost Control" },
    { id: "pm-20", target: ".stat-card, .grid", title: "19. CPI & SPI Indicators", content: "Cost Performance Index (CPI) and Schedule Performance Index (SPI) show efficiency. Above 1.0 is good — color-coded green/amber/red.", placement: "bottom", sectionTitle: "Cost Control" },
    { id: "pm-21", target: ".card", title: "20. Budget vs Forecast", content: "See total budget, certified amount, paid amount, forecast final cost, and cost variance at a glance for any selected project.", placement: "bottom", sectionTitle: "Cost Control" },
    { id: "pm-22", target: "a[href*='/tickets']", title: "21. Tickets", content: "Navigate to Tickets to manage site issues.", placement: "right", route: "/app/tickets", action: "click", sectionTitle: "Issue Management" },
    { id: "pm-23", target: ".page-head, .card", title: "22. Issue Dashboard", content: "View all tickets across projects. Filter by risk level, sensitivity, status, or assignee. High-risk tickets are visible on the client dashboard.", placement: "bottom", sectionTitle: "Issue Management" },
    { id: "pm-24", target: "button", title: "23. Escalation Workflow", content: "Tickets follow an escalation matrix: Low/Medium + Normal → notify owner; Medium + Urgent → notify PM; High + Any → notify PM + Client + flag CRITICAL.", placement: "top", sectionTitle: "Issue Management" },
    { id: "pm-25", target: "a[href*='/app/assistant']", title: "24. AI Assistant", content: "Navigate to the AI Assistant for instant project intelligence.", placement: "right", route: "/app/assistant", action: "click", sectionTitle: "AI Assistant" },
    { id: "pm-26", target: "input, textarea", title: "25. Query Your Projects", content: "Ask: 'What is the status of Project X?' or 'Show overdue milestones' or 'Summarize pending verifications.' The AI gives instant answers from your project data.", placement: "bottom", sectionTitle: "AI Assistant" },
    { id: "pm-27", target: "a[href*='/app/calendar']", title: "26. Calendar View", content: "Navigate to the project calendar to see milestones, deadlines, and key dates across your portfolio.", placement: "right", route: "/app/calendar", action: "click", sectionTitle: "Project Management" },
    { id: "pm-28", target: ".card", title: "27. Budget vs Actual", content: "Track original budget against certified amount and forecast final cost. Variance analysis helps you identify cost overruns early.", placement: "bottom", sectionTitle: "Cost Control" },
    { id: "pm-29", target: ".card", title: "28. Compliance Streaks", content: "Monitor daily log compliance streaks per project. Red flags indicate missing logs — contact your Clerk to maintain compliance.", placement: "bottom", sectionTitle: "Reporting" },
    { id: "pm-30", target: "a[href*='/app/users']", title: "29. Project Team", content: "Manage project stakeholders: view assigned roles, add team members, and ensure all positions are filled for smooth project execution.", placement: "right", route: "/app/users", action: "click", sectionTitle: "Project Management" },
    { id: "pm-31", target: "a[href*='/docs']", title: "30. Document Management", content: "Access project documents: contracts, drawings, permits, and reports. All project documentation is centralised and version-controlled.", placement: "right", route: "/app/projects", action: "click", sectionTitle: "Project Management" },
    { id: "pm-32", target: "a[href*='/milestones']", title: "31. Milestone Dashboard", content: "View all milestones across your projects with status indicators: pending, in progress, submitted, verified, or rejected.", placement: "right", sectionTitle: "Verification & Certification" },
    { id: "pm-33", target: "a[href*='/audit']", title: "32. Audit Trail", content: "Review the complete audit trail for verifications, approvals, and financial transactions. Every action is timestamped and signed.", placement: "right", sectionTitle: "Verification & Certification" },
    { id: "pm-34", target: "a[href*='/app/site-records']", title: "33. Offline Access", content: "The mobile app works offline — review project data, capture photos, and log observations even without connectivity.", placement: "right", sectionTitle: "Reporting" },
    { id: "pm-35", target: "[data-tour-target='layout-help-button']", targetFallback: "button[class*='ghost']", title: "34. Help & Tour", content: "Press Help anytime to revisit this guide or restart the tour. The Help modal also contains documentation for every module.", placement: "top", sectionTitle: "AI Assistant" },
  ],

  // ─────────────────────────────────────────────────────────
  // QUANTITY SURVEYOR — 40 steps
  // ─────────────────────────────────────────────────────────
  qs: [
    { id: "qs-01", target: "[data-tour-target='dashboard-stats']", targetFallback: ".stat-card", title: "Your QS Dashboard", content: "Your dashboard shows: requisitions pending review, certificates issued, variations pending, and total certified amount across all projects.", placement: "bottom", sectionTitle: "Dashboard Overview", route: "/app" },
    { id: "qs-02", target: "a[href*='/app/finance']", title: "1. Finance Hub", content: "The central finance page. Click to access requisitions, certificates, disbursements, and retention summary. Filter by project.", placement: "right", route: "/app/finance", action: "click", sectionTitle: "Finance Hub" },
    { id: "qs-03", target: ".tabs, .page-head", title: "2. Requisitions Tab", content: "Requisitions flow through states: submitted → reviewed → approved → paid. Review each requisition against the BoQ — validate quantities and rates before approval.", placement: "bottom", sectionTitle: "Finance Hub" },
    { id: "qs-04", target: "table, .card", title: "3. Certificate Register", content: "Certificates track interim and final payments. Each certificate includes: work done, variations, advance recovery, retention, and net payable.", placement: "bottom", sectionTitle: "Finance Hub" },
    { id: "qs-05", target: "button", title: "4. Retention Summary", content: "Click 'Retention' to see per-certificate retention breakdown: deducted, released, held, and due for release. Configurable percentages and caps per project.", placement: "bottom", sectionTitle: "Finance Hub" },
    { id: "qs-06", target: "a[href*='/cost-dashboard']", title: "5. Cost Dashboard", content: "Navigate to the Cost Dashboard for a comprehensive cost picture.", placement: "right", route: "/app/projects", action: "click", sectionTitle: "Cost Analysis" },
    { id: "qs-07", target: ".stat-card, .grid", title: "6. CPI & SPI", content: "Cost Performance Index and Schedule Performance Index show how efficiently the project is running. Above 1.0 = good. Below 1.0 = investigate.", placement: "bottom", sectionTitle: "Cost Analysis" },
    { id: "qs-08", target: "select", title: "7. Project Selector", content: "Use the dropdown to switch between projects. The dashboard updates to show BoQ state breakdown, retention totals, and advance payments for the selected project.", placement: "bottom", sectionTitle: "Cost Analysis" },
    { id: "qs-09", target: ".card", title: "8. BoQ State Breakdown", content: "See item counts and KES amounts per cost state: budgeted, ascertained, committed, certified, paid. Also shows — % PS ascertained, % contingency consumed, forecast final cost.", placement: "bottom", sectionTitle: "Cost Analysis" },
    { id: "qs-10", target: "a[href*='/generate-ipc']", title: "9. IPC Generation", content: "Navigate to generate Interim Payment Certificates. This is the core QS workflow.", placement: "right", route: "/app/projects", action: "click", sectionTitle: "IPC Generation" },
    { id: "qs-11", target: "form, .card", title: "10. IPC Form — Previous Certified", content: "Start by entering the previous certified amount (from last certificate). The system calculates cumulative totals.", placement: "bottom", sectionTitle: "IPC Generation" },
    { id: "qs-12", target: "input", title: "11. Work Done This Period", content: "Enter the value of work executed in this period. The system shows a live preview of the IPC breakdown as you type.", placement: "bottom", sectionTitle: "IPC Generation" },
    { id: "qs-13", target: "input", title: "12. Variations & Adjustments", content: "Add approved variations (both additions and omissions), provisional sum adjustments, and contingency drawdowns. Each type is tracked separately.", placement: "bottom", sectionTitle: "IPC Generation" },
    { id: "qs-14", target: "input", title: "13. Advance Recovery", content: "If there are mobilisation advances, enter the recovery amount for this period. The system tracks outstanding balance.", placement: "bottom", sectionTitle: "IPC Generation" },
    { id: "qs-15", target: "input", title: "14. Retention Calculation", content: "Retention is automatically calculated at the configured percentage. You can adjust if partial release is due (e.g., at practical completion).", placement: "bottom", sectionTitle: "IPC Generation" },
    { id: "qs-16", target: "button:not([class*='ghost'])", title: "15. Preview & Generate", content: "Click 'Generate IPC' to see the full breakdown: previous certified + current gross − variations − advance recovery − retention = net payable. Also shows BoQ snapshot.", placement: "top", sectionTitle: "IPC Generation" },
    { id: "qs-17", target: ".card, table", title: "16. IPC Preview Panel", content: "The live preview shows all calculated values. Review carefully before issuing. Once issued, the certificate is locked and added to the audit trail.", placement: "bottom", sectionTitle: "IPC Generation" },
    { id: "qs-18", target: "a[href*='/boq-cost-states']", title: "17. BoQ Cost States", content: "Navigate to manage the BoQ cost state machine.", placement: "right", route: "/app/projects", action: "click", sectionTitle: "BoQ Cost States" },
    { id: "qs-19", target: ".page-head, .grid", title: "18. State Summary Cards", content: "See counts per state at a glance: Budgeted → Ascertained → Committed → Certified → Paid. Each card shows the item count and total KES amount.", placement: "bottom", sectionTitle: "BoQ Cost States" },
    { id: "qs-20", target: "table", title: "19. Section-Grouped Table", content: "BoQ items are grouped by construction element (Builder's Works, Mechanical, Electrical, etc.). Each row shows item code, description, unit, quantity, rate, amount, and current cost state.", placement: "bottom", sectionTitle: "BoQ Cost States" },
    { id: "qs-21", target: "select, button", title: "20. State Transitions", content: "Change a single item's state using the dropdown. For bulk operations, select multiple items and use the bulk transition button. Each transition is audited.", placement: "bottom", sectionTitle: "BoQ Cost States" },
    { id: "qs-22", target: "input[type='number']", title: "21. Certified Amount (Inline Edit)", content: "When an item reaches 'Certified' state, you can inline-edit the certified quantity and amount. This feeds directly into IPC calculations.", placement: "bottom", sectionTitle: "BoQ Cost States" },
    { id: "qs-23", target: "a[href*='/variations']", title: "22. Variations", content: "Navigate to manage variation orders.", placement: "right", route: "/app/projects", action: "click", sectionTitle: "Variations" },
    { id: "qs-24", target: ".page-head, .card", title: "23. Variation Register", content: "Create and approve variation orders: construction variations, PS crystallisation, contingency-funded, and administrative items (fees, charges, overheads).", placement: "bottom", sectionTitle: "Variations" },
    { id: "qs-25", target: "button", title: "24. Approve Variation", content: "Each variation needs approval before it updates the revised budget. Approved variations feed into IPC generation automatically.", placement: "top", sectionTitle: "Variations" },
    { id: "qs-26", target: "a[href*='/provisional-sums']", title: "25. Provisional Sums", content: "Navigate to track provisional sum allowances.", placement: "right", route: "/app/projects", action: "click", sectionTitle: "Provisional Sums" },
    { id: "qs-27", target: ".page-head, table", title: "26. PS Allowances", content: "See all provisional sums: allowance value, scope assumptions, ascertained amount, and variance. Ascertainment converts allowance into committed cost.", placement: "bottom", sectionTitle: "Provisional Sums" },
    { id: "qs-28", target: "a[href*='/contingency']", title: "27. Contingency", content: "Navigate to manage contingency drawdowns.", placement: "right", route: "/app/projects", action: "click", sectionTitle: "Contingency" },
    { id: "qs-29", target: ".page-head, .card", title: "28. Contingency Tracking", content: "Contingency is held separately from the BoQ. Drawdowns require justification and approval. Track total, consumed, and remaining amounts.", placement: "bottom", sectionTitle: "Contingency" },
    { id: "qs-30", target: "a[href*='/advance-payments']", title: "29. Advance Payments", content: "Navigate to track mobilisation advances.", placement: "right", route: "/app/projects", action: "click", sectionTitle: "Advance Payments" },
    { id: "qs-31", target: ".page-head, table", title: "30. Advance Recovery Register", content: "Record advance amounts, purpose, date issued, and recovery conditions. Track recovery rate: % of IPC, fixed amount, milestone-based, time-based, or threshold-triggered.", placement: "bottom", sectionTitle: "Advance Payments" },
    { id: "qs-32", target: ".card", title: "31. Budget vs Forecast", content: "Compare original budget against the forecast final cost. Track cost variance across all projects to identify potential overruns.", placement: "bottom", sectionTitle: "Cost Analysis" },
    { id: "qs-33", target: "a[href*='/app/calendar']", title: "32. Calendar View", content: "Navigate to see certification deadlines, payment dates, and variation submission cut-offs.", placement: "right", route: "/app/calendar", action: "click", sectionTitle: "Finance Hub" },
    { id: "qs-34", target: ".card", title: "33. Compliance Overview", content: "Review daily log compliance across projects. Consistent logging ensures accurate payment certification.", placement: "bottom", sectionTitle: "IPC Generation" },
    { id: "qs-35", target: "select", title: "34. Multi-Project Comparison", content: "Switch between projects to compare BoQ states, retention totals, and advance payments across your portfolio.", placement: "bottom", sectionTitle: "Dashboard Overview" },
    { id: "qs-36", target: "button", title: "35. Export Reports", content: "Export cost reports as PDF or Excel for stakeholder meetings and audit purposes.", placement: "top", sectionTitle: "Cost Analysis" },
    { id: "qs-37", target: "a[href*='/app/settings']", title: "36. Notification Preferences", content: "Configure alerts for variation approvals, IPC issuance, and payment confirmations to stay updated.", placement: "right", route: "/app/settings", action: "click", sectionTitle: "Finance Hub" },
    { id: "qs-38", target: "input[type='search'], input[type='text']", title: "37. Search & Filters", content: "Use search and filters to quickly find specific BoQ items, variations, or certificates across projects.", placement: "bottom", sectionTitle: "BoQ Cost States" },
    { id: "qs-39", target: "[data-tour-target='layout-help-button']", targetFallback: "button[class*='ghost']", title: "38. Help & Support", content: "Press Help to access the full documentation for cost management, IPC generation, and all QS workflows.", placement: "top", sectionTitle: "Dashboard Overview" },
    { id: "qs-40", target: "[data-tour-target='dashboard-stats']", targetFallback: ".stat-card", title: "39. Tour Complete!", content: "You've completed the Quantity Surveyor tour. Use Help anytime to restart. Accurate cost tracking drives project success!", placement: "bottom", sectionTitle: "Dashboard Overview" },
  ],

  // ─────────────────────────────────────────────────────────
  // FINANCIER — 28 steps
  // ─────────────────────────────────────────────────────────
  financier: [
    { id: "fin-01", target: "[data-tour-target='dashboard-stats']", targetFallback: ".stat-card", title: "Your Financier Dashboard", content: "Key stats: total facility, amount drawn, exposure, and certificates pending. Your portfolio's financial health at a glance.", placement: "bottom", sectionTitle: "Dashboard Overview", route: "/app" },
    { id: "fin-02", target: "a[href*='/client-dashboard']", title: "1. Executive Dashboard", content: "Navigate to the Executive Dashboard for a high-level project view across all funded projects.", placement: "right", route: "/app/client-dashboard", action: "click", sectionTitle: "Executive Dashboard" },
    { id: "fin-03", target: ".card, .grid", title: "2. S-Curve Overview", content: "The S-curve shows planned % vs actual % progress with variance. Color-coded: green (on track), amber (at risk), red (behind). Critical for portfolio risk assessment.", placement: "bottom", sectionTitle: "Executive Dashboard" },
    { id: "fin-04", target: ".card", title: "3. Cost Charts", content: "See budget vs forecast vs certified vs paid — all on one chart. Monitor cost variance and approved variations per project.", placement: "bottom", sectionTitle: "Executive Dashboard" },
    { id: "fin-05", target: ".card", title: "4. Risk Summary", content: "High-risk tickets (count), overdue tickets, and critical issues. Client dashboard only shows high-risk items — no operational noise.", placement: "bottom", sectionTitle: "Executive Dashboard" },
    { id: "fin-06", target: "a[href*='/app/finance']", title: "5. Finance Hub", content: "Navigate to manage disbursements and review certificates.", placement: "right", route: "/app/finance", action: "click", sectionTitle: "Finance Hub" },
    { id: "fin-07", target: ".tabs, .page-head", title: "6. Disbursements", content: "Disbursements are your key action — record payments against certificates, track what's been paid vs certified. Full audit trail for every disbursement.", placement: "bottom", sectionTitle: "Finance Hub" },
    { id: "fin-08", target: "button", title: "7. Retention Summary", content: "Click 'Retention' to see total retention held across all certificates for any project. Track deducted, released, held, and outstanding retention liability.", placement: "bottom", sectionTitle: "Finance Hub" },
    { id: "fin-09", target: "a[href*='/cost-dashboard']", title: "8. Cost Dashboard", content: "Navigate to the Cost Dashboard for detailed cost analysis per project.", placement: "right", route: "/app/projects", action: "click", sectionTitle: "Cost & Risk Analysis" },
    { id: "fin-10", target: ".stat-card", title: "9. Forecast Final Cost", content: "See the forecast final cost vs original budget. Cost variance shows whether you're over or under budget. Critical for portfolio exposure management.", placement: "bottom", sectionTitle: "Cost & Risk Analysis" },
    { id: "fin-11", target: ".stat-card", title: "10. CPI & SPI", content: "Cost Performance Index and Schedule Performance Index. Above 1.0 means efficient. Track these trends over time for each funded project.", placement: "bottom", sectionTitle: "Cost & Risk Analysis" },
    { id: "fin-12", target: ".card", title: "11. Advance Payments Outstanding", content: "See total mobilisation advances issued, recovered, and outstanding. Outstanding advances affect your exposure calculation.", placement: "bottom", sectionTitle: "Cost & Risk Analysis" },
    { id: "fin-13", target: "a[href*='/app/reports']", title: "12. Reports", content: "Navigate to Reports for exportable board-level reporting.", placement: "right", route: "/app/reports", action: "click", sectionTitle: "Reporting" },
    { id: "fin-14", target: ".page-head, .card", title: "13. Export Reports", content: "Generate and export weekly reports with compliance and cost analysis. PDF/Excel formats suitable for board reporting.", placement: "bottom", sectionTitle: "Reporting" },
    { id: "fin-15", target: "a[href*='/advance-payments']", title: "14. Advance Payments", content: "Navigate to monitor all mobilisation advances.", placement: "right", route: "/app/projects", action: "click", sectionTitle: "Advance Monitoring" },
    { id: "fin-16", target: ".page-head, table", title: "15. Advance Register", content: "Review each advance: amount, purpose, recovery method, recovered to date, and outstanding balance. Advances affect overall portfolio exposure.", placement: "bottom", sectionTitle: "Advance Monitoring" },
    { id: "fin-17", target: ".card", title: "16. Project Drill-Down", content: "Click any project card to drill into its full financial detail: budget, certified, paid, retention, and variance at a glance.", placement: "bottom", sectionTitle: "Executive Dashboard" },
    { id: "fin-18", target: "a[href*='/app/calendar']", title: "17. Calendar View", content: "Navigate to see disbursement schedules, certificate dates, and portfolio review deadlines.", placement: "right", route: "/app/calendar", action: "click", sectionTitle: "Finance Hub" },
    { id: "fin-19", target: ".card", title: "18. Compliance Overview", content: "Review compliance metrics across your funded projects. Consistent reporting reduces financial risk.", placement: "bottom", sectionTitle: "Reporting" },
    { id: "fin-20", target: "a[href*='/audit']", title: "19. Audit Trail", content: "Access the full audit trail for all disbursements, certificates, and financial transactions across your portfolio.", placement: "right", sectionTitle: "Finance Hub" },
    { id: "fin-21", target: "a[href*='/app/settings']", title: "20. Notification Preferences", content: "Configure alerts for new certificates, disbursement requests, and portfolio risk triggers.", placement: "right", route: "/app/settings", action: "click", sectionTitle: "Executive Dashboard" },
    { id: "fin-22", target: "select", title: "21. Portfolio Comparison", content: "Switch between funded projects to compare cost performance, risk profiles, and advance exposure side by side.", placement: "bottom", sectionTitle: "Dashboard Overview" },
    { id: "fin-23", target: ".card", title: "22. Portfolio Risk Matrix", content: "View all high-risk items across your portfolio: overdue tickets, critical milestones, and projects flagged for attention.", placement: "bottom", sectionTitle: "Cost & Risk Analysis" },
    { id: "fin-24", target: "[data-tour-target='layout-help-button']", targetFallback: "button[class*='ghost']", title: "23. Help & Documentation", content: "Access the full help documentation for financier workflows, reporting, and portfolio management.", placement: "top", sectionTitle: "Reporting" },
    { id: "fin-25", target: "button", title: "24. Export Portfolio Report", content: "Generate board-ready portfolio reports with S-curves, cost analysis, and risk summaries in PDF or Excel format.", placement: "top", sectionTitle: "Reporting" },
    { id: "fin-26", target: ".card", title: "25. Dashboard Customization", content: "Configure your dashboard to show preferred metrics: exposure, certificates pending, or compliance at the top.", placement: "bottom", sectionTitle: "Dashboard Overview" },
    { id: "fin-27", target: "a[href*='/app/projects']", title: "26. Project Portfolio", content: "Browse all funded projects with key metrics: facility, drawn amount, exposure %, and last certificate date.", placement: "right", route: "/app/projects", action: "click", sectionTitle: "Executive Dashboard" },
    { id: "fin-28", target: ".stat-card", title: "27. Tour Complete!", content: "You've completed the Financier tour. Use Help anytime to restart. Your oversight drives project accountability!", placement: "bottom", sectionTitle: "Dashboard Overview" },
  ],

  // ─────────────────────────────────────────────────────────
  // ADMIN — 35 steps
  // ─────────────────────────────────────────────────────────
  admin: [
    { id: "adm-01", target: "[data-tour-target='dashboard-stats']", targetFallback: ".stat-card", title: "Your Admin Dashboard", content: "System-wide stats: total users, active projects, tenants, and system alerts. Your starting point for daily administration.", placement: "bottom", sectionTitle: "Dashboard Overview", route: "/app" },
    { id: "adm-02", target: "a[href*='/app/users']", title: "1. User Management", content: "Navigate to manage all system users.", placement: "right", route: "/app/users", action: "click", sectionTitle: "User Management" },
    { id: "adm-03", target: ".page-head, table", title: "2. User Directory", content: "View all users across tenants. See username, email, roles, tenant, and active status. Search and filter to find specific users.", placement: "bottom", sectionTitle: "User Management" },
    { id: "adm-04", target: "button:not([class*='ghost'])", title: "3. Create a New User", content: "Click 'Add User'. Enter: username, email, password, assign one or more roles (e.g., Clerk of Works, PM, QS), and select their tenant. Users can have multiple roles.", placement: "top", sectionTitle: "User Management" },
    { id: "adm-05", target: "a[href*='/app/roles']", title: "4. Role Management", content: "Navigate to manage roles and permissions.", placement: "right", route: "/app/roles", action: "click", sectionTitle: "Roles & Permissions" },
    { id: "adm-06", target: ".page-head, table", title: "5. Role Directory", content: "View all roles (Clerk of Works, Engineer, QS, PM, Developer, Financier, Auditor, Admin). Each role has a set of granular permissions.", placement: "bottom", sectionTitle: "Roles & Permissions" },
    { id: "adm-07", target: "button:not([class*='ghost'])", title: "6. Create Custom Role", content: "Create custom roles by selecting individual permissions from 44+ available permissions. Use presets for quick setup. Permission names follow the format: 'module.action' (e.g., 'site.reporting.milestone.verify').", placement: "top", sectionTitle: "Roles & Permissions" },
    { id: "adm-08", target: "a[href*='/app/tenants']", title: "7. Tenant Management", content: "Navigate to manage tenant organizations.", placement: "right", route: "/app/tenants", action: "click", sectionTitle: "Tenant Management" },
    { id: "adm-09", target: ".page-head, table", title: "8. Tenant Directory", content: "View all tenants, their status, and settings. Create new organizations with their own branding and configuration.", placement: "bottom", sectionTitle: "Tenant Management" },
    { id: "adm-10", target: "button:not([class*='ghost'])", title: "9. Configure Branding", content: "For each tenant, set branding: logo URL, primary color (affects the entire UI), and company name. Branding applies to all users in that tenant.", placement: "top", sectionTitle: "Tenant Management" },
    { id: "adm-11", target: "a[href*='/app/settings']", title: "10. System Settings", content: "Navigate to configure system-wide settings.", placement: "right", route: "/app/settings", action: "click", sectionTitle: "System Configuration" },
    { id: "adm-12", target: "form, .card", title: "11. SMTP Configuration", content: "Configure SMTP email settings: host, port, username, password, and from address. Required for all email notifications (invites, ticket escalations, reports).", placement: "bottom", sectionTitle: "System Configuration" },
    { id: "adm-13", target: "button", title: "12. Test Email", content: "After configuring SMTP, click 'Test' to send a test email. Verify delivery before going live to ensure notifications work.", placement: "top", sectionTitle: "System Configuration" },
    { id: "adm-14", target: "a[href*='/app/projects']", title: "13. Project Oversight", content: "Navigate to view all projects across all tenants.", placement: "right", route: "/app/projects", action: "click", sectionTitle: "Project Oversight" },
    { id: "adm-15", target: ".page-head, table", title: "14. All Projects View", content: "See every project across all tenants. Full access to cost dashboards, ingestion, and all module features for troubleshooting.", placement: "bottom", sectionTitle: "Project Oversight" },
    { id: "adm-16", target: "a[href*='/app/finance']", title: "15. Finance", content: "Full finance access for oversight and audit.", placement: "right", route: "/app/finance", action: "click", sectionTitle: "Finance Oversight" },
    { id: "adm-17", target: ".page-head, .card", title: "16. Finance Administration", content: "View all requisitions, certificates, and disbursements. Approve requisitions, void certificates if needed, manage disbursements across all tenants.", placement: "bottom", sectionTitle: "Finance Oversight" },
    { id: "adm-18", target: "a[href*='/app/store']", title: "17. Store & Procurement", content: "Navigate to manage the procurement module.", placement: "right", route: "/app/store", action: "click", sectionTitle: "Store & Procurement" },
    { id: "adm-19", target: ".page-head, table", title: "18. Procurement Catalog", content: "Manage items, pricing, and purchase orders. The procurement module supports the full supply chain workflow.", placement: "bottom", sectionTitle: "Store & Procurement" },
    { id: "adm-20", target: "a[href*='/app/notices']", title: "19. Notices", content: "Navigate to post system-wide announcements.", placement: "right", route: "/app/notices", action: "click", sectionTitle: "Communication" },
    { id: "adm-21", target: ".page-head, form", title: "20. Post Announcements", content: "Create notices that appear on every user's dashboard. Use for: system maintenance, policy updates, safety alerts, and important announcements.", placement: "bottom", sectionTitle: "Communication" },
    { id: "adm-22", target: "a[href*='/audit']", title: "21. Audit Trail Viewer", content: "Access the complete system audit trail. Every action across all tenants is logged with user, timestamp, and details.", placement: "right", route: "/app/projects", action: "click", sectionTitle: "System Configuration" },
    { id: "adm-23", target: ".card, .page-head", title: "22. System Health", content: "Monitor system health: API status, database connections, storage usage, and service uptime. Investigate any warnings.", placement: "bottom", sectionTitle: "System Configuration" },
    { id: "adm-24", target: "a[href*='/integrations']", title: "23. API Keys & Integrations", content: "Manage API keys for third-party integrations. Each key has scoped permissions and usage tracking.", placement: "right", sectionTitle: "System Configuration" },
    { id: "adm-25", target: "form, .card", title: "24. Notification Templates", content: "Configure email notification templates for: user invites, ticket escalations, certificate issuance, and system alerts.", placement: "bottom", sectionTitle: "System Configuration" },
    { id: "adm-26", target: "a[href*='/docs']", title: "25. Documentation", content: "Access the built-in help documentation. Each module has detailed guides and best practices.", placement: "right", sectionTitle: "System Configuration" },
    { id: "adm-27", target: "a[href*='/app/reports']", title: "26. Reports & Analytics", content: "View system-wide analytics: active users per tenant, project counts, storage usage, and monthly activity trends.", placement: "right", route: "/app/reports", action: "click", sectionTitle: "Project Oversight" },
    { id: "adm-28", target: ".card, .grid", title: "27. Usage Statistics", content: "See adoption metrics: daily active users, log submission rates, milestone completions, and ticket resolution times.", placement: "bottom", sectionTitle: "Project Oversight" },
    { id: "adm-29", target: "a[href*='/app/calendar']", title: "28. Calendar View", content: "Navigate to see system-wide events: certificate dates, project deadlines, and maintenance windows.", placement: "right", route: "/app/calendar", action: "click", sectionTitle: "Dashboard Overview" },
    { id: "adm-30", target: ".stat-card", title: "29. Dashboard Customization", content: "Configure your admin dashboard to prioritize the metrics most relevant to your daily oversight.", placement: "bottom", sectionTitle: "Dashboard Overview" },
    { id: "adm-31", target: "select", title: "30. Multi-Tenant View", content: "Switch between tenants to manage users, projects, and settings independently per organization.", placement: "bottom", sectionTitle: "Tenant Management" },
    { id: "adm-32", target: ".card", title: "31. Backup Status", content: "Review database backup status and schedule. Regular backups ensure data integrity and disaster recovery.", placement: "bottom", sectionTitle: "System Configuration" },
    { id: "adm-33", target: "a[href*='/logs']", title: "32. System Logs", content: "Access server and application logs for troubleshooting. Logs include API requests, errors, and authentication events.", placement: "right", sectionTitle: "System Configuration" },
    { id: "adm-34", target: "[data-tour-target='layout-help-button']", targetFallback: "button[class*='ghost']", title: "33. Help & Tour", content: "Press Help to revisit this guide or restart the tour. Full admin documentation is available in the Help modal.", placement: "top", sectionTitle: "Communication" },
    { id: "adm-35", target: "[data-tour-target='dashboard-stats']", targetFallback: ".stat-card", title: "34. Tour Complete!", content: "You've completed the Admin tour. Use Help anytime to restart. Your configuration keeps the platform running smoothly!", placement: "bottom", sectionTitle: "Dashboard Overview" },
  ],

  // ─────────────────────────────────────────────────────────
  // ENGINEER — 28 steps (NEW)
  // ─────────────────────────────────────────────────────────
  structural_engineer: [
    { id: "eng-01", target: "[data-tour-target='dashboard-stats']", targetFallback: ".stat-card", title: "Your Engineer Dashboard", content: "Your dashboard shows pending verifications, active projects, open tickets requiring technical input, and upcoming milestones for review.", placement: "bottom", sectionTitle: "Dashboard Overview", route: "/app" },
    { id: "eng-02", target: "a[href*='/app/verifications']", title: "1. Milestone Verifications", content: "Navigate to the Verification dashboard to review Clerk of Works submissions.", placement: "right", route: "/app/verifications", action: "click", sectionTitle: "Verification Workflow" },
    { id: "eng-03", target: ".card, table", title: "2. Pending Review Queue", content: "Each pending submission shows: project, milestone name, Clerk's progress %, photos submitted, and observations. Priority is given to urgent milestones.", placement: "bottom", sectionTitle: "Verification Workflow" },
    { id: "eng-04", target: "a[href*='/submit']", title: "3. Review Submission Detail", content: "Click any submission to see full detail: evidence photos (with GPS/geofence badge), observations (flagged Issue/Urgent), and the Clerk's notes.", placement: "right", sectionTitle: "Verification Workflow" },
    { id: "eng-05", target: "button:not([class*='ghost'])", title: "4. Certification Decision", content: "Make your decision: Approve (locks milestone, enables payment readiness), Reject (suspends payment, requires reason), or Request Clarification (back to Clerk). Your decision is digitally signed and timestamped.", placement: "top", sectionTitle: "Verification Workflow" },
    { id: "eng-06", target: "textarea, input", title: "5. Technical Notes", content: "Add technical observations or certification notes. These are visible in reports and audit trails but do not alter the original Clerk submission evidence.", placement: "bottom", sectionTitle: "Verification Workflow" },
    { id: "eng-07", target: "a[href*='/bim-models']", title: "6. BIM Models", content: "Navigate to the BIM integration module.", placement: "right", route: "/app/projects", action: "click", sectionTitle: "BIM Integration" },
    { id: "eng-08", target: ".page-head, .card", title: "7. BIM Model Viewer", content: "View BIM models linked to the project. Models validate reported work against approved design scope. Progress is visualized against BIM elements.", placement: "bottom", sectionTitle: "BIM Integration" },
    { id: "eng-09", target: "table, .card", title: "8. Milestone-BIM Mapping", content: "Each milestone can be linked to BIM elements. Discrepancies between Clerk submissions and BIM data generate alerts (not auto-rejection) for your review.", placement: "bottom", sectionTitle: "BIM Integration" },
    { id: "eng-10", target: "a[href*='/quality-tests']", title: "9. Quality Tests", content: "Navigate to review quality test results.", placement: "right", route: "/app/projects", action: "click", sectionTitle: "Quality Assurance" },
    { id: "eng-11", target: ".page-head, table", title: "10. Test Results Dashboard", content: "Review quality test results for materials and workmanship. Tests are linked to specific milestones or work packages.", placement: "bottom", sectionTitle: "Quality Assurance" },
    { id: "eng-12", target: "a[href*='/cost-dashboard']", title: "11. Cost Dashboard", content: "Navigate to review cost performance from an engineering perspective.", placement: "right", route: "/app/projects", action: "click", sectionTitle: "Cost & Progress" },
    { id: "eng-13", target: ".stat-card", title: "12. Cost Performance", content: "See CPI/SPI, budget vs forecast, and BoQ state breakdown. Engineering decisions directly impact cost performance.", placement: "bottom", sectionTitle: "Cost & Progress" },
    { id: "eng-14", target: "a[href*='/app/reports']", title: "13. Technical Reports", content: "Navigate to view and generate technical reports.", placement: "right", route: "/app/reports", action: "click", sectionTitle: "Reporting" },
    { id: "eng-15", target: ".page-head, .card", title: "14. Report Analysis", content: "Review weekly reports with S-curves and compliance data. Technical observations from your verifications feed into report narratives.", placement: "bottom", sectionTitle: "Reporting" },
    { id: "eng-16", target: "a[href*='/app/assistant']", title: "15. AI Assistant", content: "Navigate to query project data using AI.", placement: "right", route: "/app/assistant", action: "click", sectionTitle: "AI Assistant" },
    { id: "eng-17", target: "input, textarea", title: "16. Technical Queries", content: "Ask: 'Show me BIM discrepancies for Project X' or 'What milestones are pending my verification?' The AI surfaces answers from project data.", placement: "bottom", sectionTitle: "AI Assistant" },
    { id: "eng-18", target: "a[href*='/app/calendar']", title: "17. Calendar View", content: "Navigate to see verification deadlines, quality test schedules, and milestone review dates.", placement: "right", route: "/app/calendar", action: "click", sectionTitle: "Verification Workflow" },
    { id: "eng-19", target: ".card", title: "18. Compliance Overview", content: "Review daily log compliance per project. Consistent logging ensures no milestone goes unverified.", placement: "bottom", sectionTitle: "Reporting" },
    { id: "eng-20", target: "select", title: "19. Multi-Project View", content: "Switch between assigned projects to review verifications, BIM models, and quality tests across your portfolio.", placement: "bottom", sectionTitle: "Dashboard Overview" },
    { id: "eng-21", target: "button", title: "20. Export Technical Report", content: "Export verification reports and quality test results as PDF for record-keeping and stakeholder communication.", placement: "top", sectionTitle: "Reporting" },
    { id: "eng-22", target: "a[href*='/evidence']", title: "21. Evidence Review", content: "Review Clerk of Works evidence photos with GPS and geofence validation. Full-screen metadata viewer for detailed inspection.", placement: "right", sectionTitle: "Verification Workflow" },
    { id: "eng-23", target: "a[href*='/app/site-records']", title: "22. Offline Access", content: "The mobile app works offline — review milestone submissions and capture field observations without connectivity.", placement: "right", sectionTitle: "Quality Assurance" },
    { id: "eng-24", target: "a[href*='/audit']", title: "23. Audit Trail", content: "Access the verification audit trail: every approval, rejection, and clarification request is timestamped and signed.", placement: "right", sectionTitle: "Verification Workflow" },
    { id: "eng-25", target: "a[href*='/observations']", title: "24. Observations Log", content: "Review technical observations logged by Clerks during site inspections. Flag items needing immediate attention.", placement: "right", sectionTitle: "Quality Assurance" },
    { id: "eng-26", target: "a[href*='/design']", title: "25. Design Review", content: "Compare as-built progress against design drawings and BIM models. Flag discrepancies for contractor resolution.", placement: "right", sectionTitle: "BIM Integration" },
    { id: "eng-27", target: "[data-tour-target='layout-help-button']", targetFallback: "button[class*='ghost']", title: "26. Help & Tour", content: "Press Help to revisit this guide or restart the tour. Full engineering documentation is available in the Help modal.", placement: "top", sectionTitle: "AI Assistant" },
    { id: "eng-28", target: "[data-tour-target='dashboard-stats']", targetFallback: ".stat-card", title: "27. Tour Complete!", content: "You've completed the Engineer tour. Use Help anytime to restart. Your technical oversight ensures quality delivery!", placement: "bottom", sectionTitle: "Dashboard Overview" },
  ],

  // ─────────────────────────────────────────────────────────
  // CONTRACTOR — 24 steps (NEW)
  // ─────────────────────────────────────────────────────────
  contractor: [
    { id: "con-01", target: "[data-tour-target='dashboard-stats']", targetFallback: ".stat-card", title: "Your Contractor Dashboard", content: "Your dashboard shows assigned projects, pending submissions, open tickets, and upcoming milestones. Start here to see what needs attention.", placement: "bottom", sectionTitle: "Dashboard Overview", route: "/app" },
    { id: "con-02", target: "a[href*='/app/projects']", title: "1. Projects Register", content: "Navigate to see projects you're assigned to as main contractor or sub-contractor.", placement: "right", route: "/app/projects", action: "click", sectionTitle: "Project Access" },
    { id: "con-03", target: ".card, table", title: "2. Project List", content: "Each project shows its name, location, type, and progress summary. Click any project to access project-specific modules.", placement: "bottom", sectionTitle: "Project Access" },
    { id: "con-04", target: ".sidebar .nav-group:last-child", title: "3. Project Modules", content: "Once you select a project, the sidebar shows modules available to you: BoQ / Work Plan ingestion, Cost Dashboard, Variations, and more.", placement: "right", sectionTitle: "Project Access" },
    { id: "con-05", target: "a[href*='/ingestion']", title: "4. BoQ & Work Plan Upload", content: "Navigate to upload your BoQ and work plan documents.", placement: "right", route: "/app/projects", action: "click", sectionTitle: "Document Upload" },
    { id: "con-06", target: ".page-head, form", title: "5. Ingestion Page", content: "Upload baseline project documents: Bills of Quantities (Excel/PDF), Workplans (Excel/MS Project), Drawings, and Contracts. Multiple formats supported.", placement: "bottom", sectionTitle: "Document Upload" },
    { id: "con-07", target: "button", title: "6. AI-Powered Parsing", content: "Click 'AI Parse' to intelligently extract BoQ items, milestones, and work plan data from your uploaded documents. Review extracted data before committing.", placement: "top", sectionTitle: "Document Upload" },
    { id: "con-08", target: "a[href*='/store']", title: "7. Store & Procurement", content: "Navigate to the procurement module.", placement: "right", route: "/app/store", action: "click", sectionTitle: "Procurement" },
    { id: "con-09", target: ".page-head, table", title: "8. Procurement Catalog", content: "Browse items in the procurement catalog. View pricing, availability, and place purchase orders for materials.", placement: "bottom", sectionTitle: "Procurement" },
    { id: "con-10", target: "a[href*='/cost-dashboard']", title: "9. Cost View", content: "Navigate to see cost performance for your projects.", placement: "right", route: "/app/projects", action: "click", sectionTitle: "Cost Awareness" },
    { id: "con-11", target: ".stat-card, .card", title: "10. Cost Summary", content: "See certified amounts, paid amounts, and retention held for your work. Monitor BoQ state breakdown to track where items are in the payment cycle.", placement: "bottom", sectionTitle: "Cost Awareness" },
    { id: "con-12", target: "a[href*='/app/reports']", title: "11. Progress Reports", content: "Navigate to view project progress reports.", placement: "right", route: "/app/reports", action: "click", sectionTitle: "Reporting" },
    { id: "con-13", target: ".page-head, .card", title: "12. Weekly Reports", content: "View weekly progress reports that show milestones completed, % progress, and compliance streak for your projects.", placement: "bottom", sectionTitle: "Reporting" },
    { id: "con-14", target: "a[href*='/app/notices']", title: "13. Notices & Instructions", content: "Navigate to check for site instructions and announcements.", placement: "right", route: "/app/notices", action: "click", sectionTitle: "Communication" },
    { id: "con-15", target: ".page-head", title: "14. Site Instructions", content: "Review site instructions, safety alerts, variation directives, and other official communications from the project office.", placement: "bottom", sectionTitle: "Communication" },
    { id: "con-16", target: "a[href*='/app/assistant']", title: "15. AI Assistant", content: "Navigate to get quick answers about your projects.", placement: "right", route: "/app/assistant", action: "click", sectionTitle: "AI Assistant" },
    { id: "con-17", target: "input, textarea", title: "16. Ask Questions", content: "Ask: 'What is the status of my BoQ items?' or 'Show my upcoming milestones.' The AI knows your project data.", placement: "bottom", sectionTitle: "AI Assistant" },
    { id: "con-18", target: "a[href*='/app/calendar']", title: "17. Calendar View", content: "Navigate to see submission deadlines, milestone dates, and payment schedules for your projects.", placement: "right", route: "/app/calendar", action: "click", sectionTitle: "Project Access" },
    { id: "con-19", target: "[data-tour-target='layout-help-button']", targetFallback: "button[class*='ghost']", title: "18. Help & Support", content: "Press Help to revisit this guide or restart the tour. Full contractor documentation is available in the Help modal.", placement: "top", sectionTitle: "Communication" },
    { id: "con-20", target: "a[href*='/app/tickets']", title: "19. Ticket Tracking", content: "Raise and track site issues. Monitor response times and resolution status for your raised tickets.", placement: "right", route: "/app/tickets", action: "click", sectionTitle: "Communication" },
    { id: "con-21", target: "a[href*='/app/milestones']", title: "20. Milestone Tracking", content: "Track milestone progress and verification status. Know when your work has been certified for payment.", placement: "right", sectionTitle: "Cost Awareness" },
    { id: "con-22", target: ".card", title: "21. Compliance Streaks", content: "Monitor your compliance streak for daily log submissions. Consistent logging builds trust with the project team.", placement: "bottom", sectionTitle: "Reporting" },
    { id: "con-23", target: "a[href*='/app/site-records']", title: "22. Offline Mode", content: "The mobile app supports offline work — upload documents, capture progress photos, and log activities without internet.", placement: "right", sectionTitle: "Document Upload" },
    { id: "con-24", target: ".stat-card", title: "23. Tour Complete!", content: "You've completed the Contractor tour. Use Help anytime to restart. Your participation drives project success!", placement: "bottom", sectionTitle: "Dashboard Overview" },
  ],

  // ─────────────────────────────────────────────────────────
  // DEFAULT — 10 steps
  // ─────────────────────────────────────────────────────────
  default: [
    { id: "def-01", target: "[data-tour-target='dashboard-stats']", targetFallback: ".stat-card", title: "Your Dashboard", content: "Your role-based dashboard shows relevant stats and quick actions tailored to your permissions.", placement: "bottom", sectionTitle: "Getting Started", route: "/app" },
    { id: "def-02", target: "a[href*='/app/projects']", title: "1. Projects", content: "Browse assigned projects, view details, and access module-specific features.", placement: "right", route: "/app/projects", action: "click", sectionTitle: "Core Modules" },
    { id: "def-03", target: "a[href*='/app/daily-logs']", title: "2. Daily Logs", content: "Record and view daily site activities. Keep compliance streaks alive.", placement: "right", route: "/app/daily-logs", action: "click", sectionTitle: "Core Modules" },
    { id: "def-04", target: "a[href*='/app/tickets']", title: "3. Tickets", content: "Raise and track site issues. Comment and attach annotations.", placement: "right", route: "/app/tickets", action: "click", sectionTitle: "Core Modules" },
    { id: "def-05", target: "a[href*='/app/reports']", title: "4. Reports", content: "Access weekly reports, S-curves, and compliance data.", placement: "right", route: "/app/reports", action: "click", sectionTitle: "Core Modules" },
    { id: "def-06", target: "a[href*='/app/site-records']", title: "5. Site Records", content: "Log material deliveries, H&S incidents with photo evidence.", placement: "right", route: "/app/site-records", action: "click", sectionTitle: "Core Modules" },
    { id: "def-07", target: "a[href*='/app/finance']", title: "6. Finance", content: "View finance hub if you have finance permissions.", placement: "right", route: "/app/finance", action: "click", sectionTitle: "Core Modules" },
    { id: "def-08", target: "a[href*='/app/assistant']", title: "7. AI Assistant", content: "Ask questions and get answers about your projects and data.", placement: "right", route: "/app/assistant", action: "click", sectionTitle: "Core Modules" },
    { id: "def-09", target: "a[href*='/app/notices']", title: "8. Notices", content: "Check for site instructions, safety alerts, and announcements.", placement: "right", route: "/app/notices", action: "click", sectionTitle: "Core Modules" },
    { id: "def-10", target: "[data-tour-target='layout-help-button']", targetFallback: "button[class*='ghost']", title: "Help & Support", content: "Press the Help button anytime to revisit this guide or restart the tour.", placement: "top", sectionTitle: "Help" },
  ],
};
