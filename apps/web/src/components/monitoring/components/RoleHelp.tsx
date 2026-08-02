import { BookOpen, CheckCircle, HelpCircle, Play, Target, Zap, MapPin } from "lucide-react";
import { useState } from "react";

interface RoleGuide {
  title: string;
  description: string;
  keyTasks: Array<{ title: string; description: string; icon: any }>;
  gettingStarted: string[];
  tips: string[];
}

const ROLE_GUIDES: Record<string, RoleGuide> = {
  clerk_of_works: {
    title: "Clerk of Works Guide",
    description: "Your role is to capture site progress evidence and ensure work meets quality standards.",
    keyTasks: [
      { title: "Daily Logs", description: "Record daily site activities, labor, and materials", icon: BookOpen },
      { title: "Progress Photos", description: "Capture GPS-tagged photos for milestone evidence", icon: CheckCircle },
      { title: "Report Issues", description: "Flag urgent issues, defects, or safety concerns", icon: Zap },
    ],
    gettingStarted: [
      "Select your assigned project from the Projects list",
      "Open Daily Logs to record today's site activities",
      "For each milestone due, capture progress photos with evidence",
      "Submit your daily log before leaving site",
      "Review and respond to any tickets raised by the office",
    ],
    tips: [
      "Always capture photos with GPS enabled for geofence verification",
      "Submit daily logs consistently to maintain compliance streaks",
      "Flag urgent issues immediately for rapid response",
      "Use the AI Assistant to quickly find project information",
    ],
  },
  project_manager: {
    title: "Project Manager Guide",
    description: "Oversee project progress, verify milestones, and coordinate with stakeholders.",
    keyTasks: [
      { title: "Verify Progress", description: "Review and approve Clerk submissions for payment", icon: CheckCircle },
      { title: "Manage Projects", description: "Create projects, onboard teams, and manage schedules", icon: Target },
      { title: "Review Reports", description: "Monitor progress through weekly and executive reports", icon: BookOpen },
    ],
    gettingStarted: [
      "Create new projects through the Onboarding workflow",
      "Assign team members with appropriate roles",
      "Set up milestones and work plans for each project",
      "Review daily logs and verify milestone submissions",
      "Generate weekly reports for stakeholder updates",
    ],
    tips: [
      "Use the Compliance view to identify projects with missing daily logs",
      "Prioritize verification of urgent milestones for payment readiness",
      "Monitor the Issues dashboard for project risks",
      "Use AI Assistant to quickly analyze project status",
    ],
  },
  qs: {
    title: "Quantity Surveyor Guide",
    description: "Manage project costs, review requisitions, and issue payment certificates.",
    keyTasks: [
      { title: "Review Requisitions", description: "Validate finance requisitions against BoQ", icon: CheckCircle },
      { title: "Issue Certificates", description: "Generate interim and final payment certificates", icon: BookOpen },
      { title: "Cost Dashboard", description: "Monitor project costs, variations, and exposure", icon: Target },
    ],
    gettingStarted: [
      "Review pending finance requisitions in the Finance module",
      "Validate quantities and rates against the BoQ",
      "Issue payment certificates for verified work",
      "Monitor cost dashboard for budget tracking",
      "Review and approve variations when scope changes occur",
    ],
    tips: [
      "Cross-reference requisitions with milestone verifications",
      "Use the Cost Dashboard to track advance payments and exposure",
      "Ensure all certificates have proper supporting documentation",
      "Monitor provisional sums and contingency drawdowns carefully",
    ],
  },
  financier: {
    title: "Financier Guide",
    description: "Monitor funded projects, track drawdowns, and ensure compliance.",
    keyTasks: [
      { title: "Monitor Projects", description: "View all funded projects and their status", icon: Target },
      { title: "Track Drawdowns", description: "Monitor facility usage and exposure", icon: BookOpen },
      { title: "Review Reports", description: "Access executive and financial reports", icon: CheckCircle },
    ],
    gettingStarted: [
      "View your funded projects on the Dashboard",
      "Monitor total facility utilization and exposure",
      "Review executive reports for high-level project status",
      "Track certificate issuance and payment progress",
    ],
    tips: [
      "Use the Finance layout to track drawdown eligibility",
      "Monitor projects at risk for potential payment delays",
      "Review compliance reports for audit readiness",
      "Contact project managers for clarification on large variations",
    ],
  },
  admin: {
    title: "Administrator Guide",
    description: "Manage users, roles, tenants, and system configuration.",
    keyTasks: [
      { title: "Manage Users", description: "Create and manage user accounts and roles", icon: CheckCircle },
      { title: "Configure System", description: "Set up SMTP, branding, and system settings", icon: Target },
      { title: "Manage Tenants", description: "Create and configure tenant organizations", icon: BookOpen },
    ],
    gettingStarted: [
      "Create user accounts and assign appropriate roles",
      "Configure SMTP settings for email notifications",
      "Set up tenant branding (logo, colors, company name)",
      "Manage role permissions as organizational needs change",
      "Monitor system health and user activity",
    ],
    tips: [
      "Use role presets for quick user setup",
      "Test SMTP configuration before going live",
      "Regularly review user access and revoke unused accounts",
      "Keep tenant branding consistent across the organization",
    ],
  },
};

const DEFAULT_GUIDE: RoleGuide = {
  title: "Getting Started",
  description: "Welcome to the Construction Management System. Here's how to get started.",
  keyTasks: [
    { title: "View Projects", description: "Browse your assigned projects", icon: Target },
    { title: "Read Reports", description: "Access project reports and documentation", icon: BookOpen },
    { title: "Get Help", description: "Use the AI Assistant for guidance", icon: HelpCircle },
  ],
  gettingStarted: [
    "Explore the available modules in the navigation",
    "View your assigned projects and their status",
    "Read reports to understand project progress",
    "Use the AI Assistant if you need help",
    "Contact your administrator for role-specific training",
  ],
  tips: [
    "The navigation is filtered based on your permissions",
    "Use the search feature to quickly find information",
    "Contact support if you encounter any issues",
  ],
};

export function RoleHelp({ userRole = "default", permissions = [], onClose, onStartTour }: { userRole?: string; permissions?: string[]; onClose?: () => void; onStartTour?: () => void }) {
  const guide = ROLE_GUIDES[userRole] || DEFAULT_GUIDE;
  const [activeTab, setActiveTab] = useState<"tasks" | "getting-started" | "tips">("tasks");

  return (
    <div className="card" style={{ padding: 20 }}>
      <div className="page-head" style={{ marginBottom: 16 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="eyebrow">My Access &amp; Responsibilities</div>
            <h2>{guide.title}</h2>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {onStartTour && (
              <button className="btn sm primary" onClick={onStartTour} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <MapPin size={14} /> Guided Tour
              </button>
            )}
            {onClose && (
              <button className="btn ghost sm" onClick={onClose}>Close</button>
            )}
          </div>
        </div>
        <p className="muted" style={{ marginTop: 4 }}>{guide.description}</p>
      </div>

      <div className="tabs" style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        <button
          className={`btn sm ${activeTab === "tasks" ? "primary" : "ghost"}`}
          onClick={() => setActiveTab("tasks")}
        >
          <Target size={14} style={{ marginRight: 6 }} /> Key Tasks
        </button>
        <button
          className={`btn sm ${activeTab === "getting-started" ? "primary" : "ghost"}`}
          onClick={() => setActiveTab("getting-started")}
        >
          <Play size={14} style={{ marginRight: 6 }} /> Getting Started
        </button>
        <button
          className={`btn sm ${activeTab === "tips" ? "primary" : "ghost"}`}
          onClick={() => setActiveTab("tips")}
        >
          <Zap size={14} style={{ marginRight: 6 }} /> Tips
        </button>
      </div>

      {activeTab === "tasks" && (
        <div>
          <h3>Your Key Tasks</h3>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))" }}>
            {guide.keyTasks.map((task, i) => (
              <div key={i} className="card" style={{ padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                  <task.icon size={18} style={{ marginRight: 8, color: "var(--accent)" }} />
                  <strong>{task.title}</strong>
                </div>
                <p className="muted" style={{ margin: 0, fontSize: 13 }}>{task.description}</p>
              </div>
            ))}
          </div>
          <div className="card" style={{ marginTop: 14, padding: 12 }}><strong>Access summary</strong><div className="muted fs-sm" style={{ marginTop: 4 }}>{permissions.length ? `${permissions.length} permissions granted to this role.` : "Access is controlled by your assigned role."} Full explanations are available in Documentation.</div></div>
        </div>
      )}

      {activeTab === "getting-started" && (
        <div>
          <h3>Getting Started</h3>
          <div className="card" style={{ padding: 16 }}>
            <ol style={{ paddingLeft: 20, margin: 0 }}>
              {guide.gettingStarted.map((step, i) => (
                <li key={i} style={{ marginBottom: 8, lineHeight: 1.5 }}>{step}</li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {activeTab === "tips" && (
        <div>
          <h3>Pro Tips</h3>
          <div className="card" style={{ padding: 16 }}>
            <ul style={{ paddingLeft: 20, margin: 0 }}>
              {guide.tips.map((tip, i) => (
                <li key={i} style={{ marginBottom: 8, lineHeight: 1.5 }}>{tip}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
