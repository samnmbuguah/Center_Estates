export type CompanionTab =
  | "overview"
  | "qm"
  | "dialogue"
  | "tasks"
  | "my-tasks"
  | "templates"
  | "delegations"
  | "meter-readings"
  | "hr-requests"
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
  "hr-requests": "Leave & HR Portal",
  performance: "Performance Dashboard",
  staff: "Staff History",
  "audit-events": "Audit Trail",
  tickets: "Tickets & Issues",
  calendar: "Calendar & Schedule",
};

export type Row = Record<string, unknown>;

export type ChecklistItem = {
  id: string;
  title: string;
  completed: boolean;
};

export type TaskItem = {
  id: string;
  reference?: string;
  title: string;
  description?: string;
  source_module?: string;
  source_ref?: string;
  property?: string;
  property_name?: string;
  assignee?: string;
  assignee_name?: string;
  assignee_username?: string;
  assigned_by?: string;
  assigned_by_name?: string;
  priority: "low" | "normal" | "high" | "urgent";
  status: "pending" | "acknowledged" | "in_progress" | "completed" | "delegated" | "cancelled";
  due_at?: string;
  sla_due_at?: string;
  completed_at?: string;
  acknowledged_at?: string;
  delegated_to?: string;
  delegated_to_name?: string;
  attachment_url?: string;
  checklist?: ChecklistItem[];
  overdue?: boolean;
  escalated?: boolean;
  created_at?: string;
};

export type CompanionDash = {
  kpis?: Record<string, unknown>;
  activeNudge?: {
    id: string;
    category: "wellness" | "workload" | "productivity" | "planning";
    icon: string;
    title: string;
    message: string;
    action_label?: string;
    action_href?: string;
    urgency?: "low" | "medium" | "high";
  };
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
  created_by_role?: string;
  assigned_to?: string;
  assigned_to_name?: string;
  resolved_by?: string;
  resolved_by_name?: string;
  resolved_at?: string;
  confirmed_by?: string;
  confirmed_by_name?: string;
  confirmed_at?: string;
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

export type StaffLeaveRequest = {
  id: string;
  reference: string;
  requester: number;
  requester_name: string;
  requester_username: string;
  leave_type: "annual" | "sick" | "maternity" | "paternity" | "compassionate" | "study" | "unpaid" | "emergency";
  leave_type_display: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string;
  attachment_url?: string;
  relief_staff?: number;
  relief_staff_name?: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  status_display: string;
  decided_by?: number;
  decided_by_name?: string;
  decision_notes?: string;
  decided_at?: string;
  created_at: string;
  updated_at: string;
};

export type StaffHrRequest = {
  id: string;
  reference: string;
  requester: number;
  requester_name: string;
  requester_username: string;
  request_type: "raise_review" | "overtime_claim" | "expense_reimbursement" | "salary_advance" | "general_hr";
  request_type_display: string;
  title: string;
  description: string;
  proposed_amount?: number | null;
  currency: string;
  attachment_url?: string;
  status: "pending" | "under_review" | "approved" | "rejected";
  status_display: string;
  decided_by?: number;
  decided_by_name?: string;
  decision_notes?: string;
  decided_at?: string;
  created_at: string;
  updated_at: string;
};

export type StaffLeaveBalance = {
  user_id: number;
  user_name: string;
  user_username: string;
  year: number;
  annual_entitlement: number;
  carried_forward: number;
  total_entitlement: number;
  taken_days: number;
  pending_days: number;
  remaining_days: number;
};
