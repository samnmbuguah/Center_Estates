export interface TourStep {
  id: string;
  screen: string;
  title: string;
  content: string;
  /** Y-offset from top for the tooltip position (0 = top, 1 = bottom) */
  verticalPosition: number;
  /** params to pass when navigating to this step's screen */
  params?: Record<string, any>;
}

/**
 * Generic mobile tour — walks through the core site-capture workflow.
 * Works for any role since screens are shared across all authenticated users.
 */
export const MOBILE_TOUR: TourStep[] = [
  {
    id: "mob-01",
    screen: "Projects",
    title: "Your Projects",
    content: "These are your assigned construction sites. Each card shows progress. Tap any project to see its details and start working.",
    verticalPosition: 0.3,
  },
  {
    id: "mob-02",
    screen: "ProjectHub",
    title: "Project Hub",
    content: "This is the project command center. Available modules depend on your permissions — Milestones, Site Diary, and Reports.",
    verticalPosition: 0.4,
    params: {},
  },
  {
    id: "mob-03",
    screen: "Milestones",
    title: "Milestone Checklist",
    content: "Each milestone for this week is shown here. Tap any milestone to enter progress, capture photos, and add observations.",
    verticalPosition: 0.3,
    params: {},
  },
  {
    id: "mob-04",
    screen: "MilestoneDetail",
    title: "Progress Entry",
    content: "Use the slider to set completion % (0–100). The status auto-updates: 100% = Completed. Regression or jumps >40% trigger quality checks.",
    verticalPosition: 0.25,
    params: {},
  },
  {
    id: "mob-05",
    screen: "MilestoneDetail",
    title: "Verification Questions",
    content: "Answer 'Work as per drawings?' and 'Visible defects?' before submitting. Defects require a photo.",
    verticalPosition: 0.5,
    params: {},
  },
  {
    id: "mob-06",
    screen: "MilestoneDetail",
    title: "Capture Evidence",
    content: "Tap the camera button to take GPS-tagged photos. Uploads happen in the background even when you navigate away.",
    verticalPosition: 0.65,
    params: {},
  },
  {
    id: "mob-07",
    screen: "Capture",
    title: "Photo Capture",
    content: "Photos are automatically timestamped, GPS-tagged, and device-stamped. Upload via multipart upload with progress tracking.",
    verticalPosition: 0.5,
    params: {},
  },
  {
    id: "mob-08",
    screen: "MilestoneDetail",
    title: "Add Observations",
    content: "Tap to add text notes. Flag observations as Note, Issue, or Urgent Issue. Urgent issues alert the project team immediately.",
    verticalPosition: 0.75,
    params: {},
  },
  {
    id: "mob-09",
    screen: "MilestoneDetail",
    title: "Sign & Submit",
    content: "When ready, tap 'Submit'. Your device signs the submission with your unique Ed25519 key — a cryptographic seal proving evidence integrity.",
    verticalPosition: 0.85,
    params: {},
  },
  {
    id: "mob-10",
    screen: "DailyLog",
    title: "Daily Log (Site Diary)",
    content: "Record general site conditions daily. Three tabs: 'Daily log' (weather, labour, plant, visitors), 'Delivery' (materials), and 'H&S' (incidents).",
    verticalPosition: 0.3,
    params: {},
  },
  {
    id: "mob-11",
    screen: "DailyLog",
    title: "Weather & Conditions",
    content: "Select weather for morning and afternoon. Mark rainfall and hours lost. This data feeds into weekly reports and compliance streaks.",
    verticalPosition: 0.4,
    params: {},
  },
  {
    id: "mob-12",
    screen: "DailyLog",
    title: "Materials & H&S",
    content: "Log material deliveries with conformance (pass/fail) and record H&S incidents. Serious incidents trigger immediate office alerts.",
    verticalPosition: 0.55,
    params: {},
  },
  {
    id: "mob-13",
    screen: "Reports",
    title: "Progress Reports",
    content: "View S-curve charts (planned vs actual progress), submission counts, and open issues. Reports are auto-generated from your daily logs and submissions.",
    verticalPosition: 0.3,
    params: {},
  },
  {
    id: "mob-14",
    screen: "Reports",
    title: "Report Export",
    content: "Reports are exportable with full traceability — every number links back to original evidence and submissions.",
    verticalPosition: 0.6,
    params: {},
  },
  {
    id: "mob-15",
    screen: "Account",
    title: "Your Account",
    content: "View your profile, roles, and sync status. You can restart this tour anytime from here.",
    verticalPosition: 0.3,
  },
];

/**
 * Clerk of Works mobile tour — extended version with CoW-specific detail.
 */
export const COW_MOBILE_TOUR: TourStep[] = [
  {
    id: "cow-mob-01",
    screen: "Projects",
    title: "Your Projects",
    content: "These are your assigned construction sites. Each card shows progress. Tap any project to see its details and start working.",
    verticalPosition: 0.3,
  },
  {
    id: "cow-mob-02",
    screen: "ProjectHub",
    title: "Project Hub",
    content: "This is the project command center. Tap 'Milestones' to record progress, 'Site Diary' for daily logs, or 'Reports' to view summaries.",
    verticalPosition: 0.4,
    params: {},
  },
  {
    id: "cow-mob-03",
    screen: "Milestones",
    title: "Milestone Checklist",
    content: "Each milestone for this week is shown here. Tap any milestone to enter progress, capture photos, and add observations. Complete milestones show a green badge.",
    verticalPosition: 0.3,
    params: {},
  },
  {
    id: "cow-mob-04",
    screen: "MilestoneDetail",
    title: "Progress Entry",
    content: "Use the slider to set completion % (0–100). Nudge buttons (+/- 5%) help with precise adjustments on-site. The status auto-updates: 100% = Completed.",
    verticalPosition: 0.25,
    params: {},
  },
  {
    id: "cow-mob-05",
    screen: "MilestoneDetail",
    title: "Progress Rules",
    content: "If you enter a lower % than before (regression), a mandatory justification modal appears. If you jump >40%, a confirmation alert warns about artificial inflation.",
    verticalPosition: 0.5,
    params: {},
  },
  {
    id: "cow-mob-06",
    screen: "MilestoneDetail",
    title: "Verification Questions",
    content: "Answer 'Work as per drawings?' (Yes/No) and 'Visible defects?' (Yes/No). Both must be answered before submitting. Defects require a photo.",
    verticalPosition: 0.6,
    params: {},
  },
  {
    id: "cow-mob-07",
    screen: "MilestoneDetail",
    title: "Capture Evidence",
    content: "Tap the camera button to take photos. Photos are GPS-tagged and geofence-classified (on-site/off-site/unknown). Upload happens in the background.",
    verticalPosition: 0.7,
    params: {},
  },
  {
    id: "cow-mob-08",
    screen: "Capture",
    title: "Photo Capture",
    content: "Use the camera to capture evidence. Photos are automatically timestamped, GPS-tagged, and device-stamped. Upload happens via multipart upload with progress tracking.",
    verticalPosition: 0.5,
    params: {},
  },
  {
    id: "cow-mob-09",
    screen: "MilestoneDetail",
    title: "Add Observations",
    content: "Tap to add text notes. Observations can be flagged as: Note, Issue, or Urgent Issue. Flagged issues appear in dashboards — Urgent issues alert the PM immediately.",
    verticalPosition: 0.8,
    params: {},
  },
  {
    id: "cow-mob-10",
    screen: "MilestoneDetail",
    title: "Sign & Submit",
    content: "When ready, tap 'Submit'. Your device signs the submission with your unique Ed25519 key — a cryptographic seal. The seal proves evidence integrity and who submitted it.",
    verticalPosition: 0.85,
    params: {},
  },
  {
    id: "cow-mob-11",
    screen: "DailyLog",
    title: "Daily Log (Site Diary)",
    content: "Record general site conditions daily. Three tabs: 'Daily log' (weather, labour, plant, visitors), 'Delivery' (materials), and 'H&S' (incidents). Consistent daily logging builds compliance streaks.",
    verticalPosition: 0.3,
    params: {},
  },
  {
    id: "cow-mob-12",
    screen: "DailyLog",
    title: "Weather & Conditions",
    content: "Select weather for morning and afternoon. Mark rainfall — if yes, enter hours lost. This data feeds into weekly reports and compliance calculations.",
    verticalPosition: 0.4,
    params: {},
  },
  {
    id: "cow-mob-13",
    screen: "DailyLog",
    title: "Materials Delivery",
    content: "Log materials arriving on site: type, quantity, supplier. Attach receipt photos. Conformance (pass/fail) and damaged items are recorded here.",
    verticalPosition: 0.5,
    params: {},
  },
  {
    id: "cow-mob-14",
    screen: "DailyLog",
    title: "H&S Incidents",
    content: "Record any health & safety incidents: severity (near miss / first aid / serious / lost time), description, and action taken. Serious incidents trigger immediate office alerts.",
    verticalPosition: 0.6,
    params: {},
  },
  {
    id: "cow-mob-15",
    screen: "Reports",
    title: "Progress Reports",
    content: "View S-curve charts (planned vs actual progress), weekly submission counts, and open issues. Reports are auto-generated from your daily logs and milestone submissions.",
    verticalPosition: 0.3,
    params: {},
  },
  {
    id: "cow-mob-16",
    screen: "Reports",
    title: "Report Export",
    content: "Reports are exportable for PMs, financiers, and auditors. They maintain full traceability — every number links back to original evidence and submissions.",
    verticalPosition: 0.6,
    params: {},
  },
  {
    id: "cow-mob-17",
    screen: "Account",
    title: "Your Account",
    content: "View your profile, app info, and sync status. You can restart this tour anytime from here. The tour only shows once — but you can always re-run it.",
    verticalPosition: 0.3,
  },
];
