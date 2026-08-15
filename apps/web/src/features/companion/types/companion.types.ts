export type CompanionTab =
  | "overview"
  | "qm"
  | "dialogue"
  | "tasks"
  | "my-tasks"
  | "templates"
  | "delegations"
  | "meter-readings"
  | "team-matrix"
  | "performance"
  | "staff"
  | "audit-events"
  | "tickets"
  | "calendar";

export const companionTabLabels: Record<CompanionTab, string> = {
  overview: "My Companion",
  qm: "Quartermaster AI",
  dialogue: "Team Dialogue & Feedback",
  tasks: "Task Assignment Centre",
  "my-tasks": "My Tasks",
  templates: "Task Templates",
  delegations: "Delegations",
  "meter-readings": "Meter Readings",
  "team-matrix": "Team & Property Matrix",
  performance: "Performance Dashboard",
  staff: "Staff History",
  "audit-events": "Audit Trail",
  tickets: "Tickets & Issues",
  calendar: "Calendar & Schedule",
};

export type Row = Record<string, unknown>;

export type CompanionDash = {
  kpis?: Record<string, unknown>;
  recentTasks?: Row[];
  overdueTasks?: Row[];
  escalatedTasks?: Row[];
  staff?: Row[];
  user?: Record<string, unknown>;
  tasks?: Row[];
  events?: Row[];
};

export type FeedbackThread = {
  id: string;
  reference: string;
  title: string;
  category: "bug" | "feature" | "operational" | "general";
  priority: "low" | "normal" | "high" | "urgent";
  status: "open" | "in_progress" | "resolved" | "closed";
  property?: string;
  property_name?: string;
  module?: string;
  created_by?: string;
  created_by_name?: string;
  assigned_to?: string;
  messages?: FeedbackMessage[];
  created_at: string;
  updated_at: string;
};

export type FeedbackMessage = {
  id: string;
  thread: string;
  sender?: string;
  sender_name?: string;
  message: string;
  attachment_url?: string;
  is_developer_response?: boolean;
  created_at: string;
};

export type TeamMember = {
  id: string;
  user_id: string;
  username: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone_number: string;
  is_organization_admin: boolean;
  status: string;
  roles: { id: string; name: string; slug: string }[];
  assigned_properties: { id: string; code: string; name: string }[];
  created_at: string;
};
