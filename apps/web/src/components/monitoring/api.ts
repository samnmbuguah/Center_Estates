import { CLIENT_KIND, SYNC_TABLES } from "./shared-types";
import type {
  IssueRow,
  OfficeNoteRow,
  PullResponse,
  SCurve,
  VerifyResponse,
  WeeklyReport,
} from "./shared-types";

import type {
  AuditLog, AuditLogResponse,
  AvailableModule,
  BoqDraftItem, BoqItem,
  CashFlowForecast, Certificate,
  ChatTurn,
  ComplianceRow,
  ContingencyDrawdown,
  CostDashboardData,
  DailyLog,
  Disbursement,
  Document,
  Approval,
  ExecDashboard,
  IngestionPreview, IngestionStatus, IngestionCommitResult,
  IpcResult,
  IssueItem,
  Me, TenantInfo,
  Milestone, MilestoneVerification,
  Notification,
  OnboardingChecklistItem, OnboardingStatus, OnboardingStep3Data,
  Plan,
  Project, ProjectApproval, ProjectDocument, ProjectMember,
  PurchaseOrder,
  Requisition,
  RetentionCertificate, RetentionSummary,
  RiskItem,
  Role, Permission,
  SmtpSettings,
  StoreItem,
  Tenant, TenantBranding, TenantMember, TenantSettings,
  Ticket, TicketComment,
  UserProfile,
  Waiver,
  WeeklyReportData,
  WhatsAppConfig,
  WorkPlanDraftTask,
  MaterialDelivery, SafetyIncident,
  AIModel, AIStatus,
  QualityTest, ConsultantPayment, BimModel, DroneDataset,
  IgpSafeguard, IgpProcurement, ProjectModuleConfig,
  Notice,
  Variation, ProvisionalSum, AdvancePayment,
  Subcontractor, WorkOrder, WorkOrderSummary,
} from "./api-types";

// Re-export all API types for consumers
export type {
  AuditLog, AuditLogResponse,
  AvailableModule,
  BoqDraftItem, BoqItem,
  CashFlowForecast, Certificate,
  ChatTurn,
  ComplianceRow,
  ContingencyDrawdown,
  CostDashboardData,
  DailyLog,
  Disbursement,
  Document,
  Approval,
  ExecDashboard,
  IngestionPreview, IngestionStatus, IngestionCommitResult,
  IpcResult,
  IssueItem,
  Me, TenantInfo,
  Milestone, MilestoneVerification,
  Notification,
  OnboardingChecklistItem, OnboardingStatus, OnboardingStep3Data,
  Plan,
  Project, ProjectApproval, ProjectDocument, ProjectMember,
  PurchaseOrder,
  Requisition,
  RetentionCertificate, RetentionSummary,
  RiskItem,
  Role, Permission,
  SmtpSettings,
  StoreItem,
  Tenant, TenantBranding, TenantMember, TenantSettings,
  Ticket, TicketComment,
  UserProfile,
  Waiver,
  WeeklyReportData,
  WhatsAppConfig,
  WorkPlanDraftTask,
  MaterialDelivery, SafetyIncident,
  AIModel, AIStatus,
  Subcontractor, WorkOrder, WorkOrderSummary,
} from "./api-types";

export const CONSTRUCTION_BASE = "/api/v1/construction";
export const CORE_BASE = "/api/v1";
export const API_BASE = CONSTRUCTION_BASE;

const TOKEN_KEY = "erp_access_token";
const TENANT_KEY = "erp_tenant_id";

/** Public download URLs (no auth — browser navigates to them directly). */
export const apkDownloadUrl = "/app/download";
export const usabilityPdfUrl = `${API_BASE}/docs/usability-testing.pdf`;
export const fetchAppInfo = () =>
  fetch(`/api/v1/app/info`).then((r) => r.json() as Promise<{ available: boolean; version: string }>);

// Defensive token store: use localStorage when it actually works (browser),
// otherwise fall back to memory (tests / SSR).
const memory: Record<string, string | undefined> = {};
const ls = (): Storage | null => {
  try {
    return typeof globalThis.localStorage?.setItem === "function" ? globalThis.localStorage : null;
  } catch {
    return null;
  }
};

export function getToken(): string | null {
  return ls()?.getItem(TOKEN_KEY) ?? memory[TOKEN_KEY] ?? null;
}
function setToken(token: string): void {
  ls()?.setItem(TOKEN_KEY, token);
  memory[TOKEN_KEY] = token;
}
export function clearToken(): void {
  ls()?.removeItem(TOKEN_KEY);
  ls()?.removeItem(TENANT_KEY);
  delete memory[TOKEN_KEY];
}

export function getTenantId(): string | null {
  return ls()?.getItem(TENANT_KEY) ?? null;
}
export function setTenantId(id: string): void {
  ls()?.setItem(TENANT_KEY, id);
}

export function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const tenantId = getTenantId();
  if (tenantId) {
    headers["X-Tenant-ID"] = tenantId;
    headers["X-Organization-ID"] = tenantId;
  }
  return headers;
}

/** Thrown for any failed request; `.status` lets callers branch if needed. */
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

function normalizePath(rawPath: string): string {
  let p = rawPath.replace(/\/+/g, "/");

  // Handle nested /projects/:id/subresource paths -> /subresource/?project_id=:id
  const nestedMatch = p.match(/^\/projects\/([^/]+)\/(cost-dashboard|lifecycle|milestones|variations|boq-review|boq-material-reconciliation|contingency-drawdowns|quality-tests|consultant-payments|subcontractors|work-orders|provisional-sums|advance-payments|anomalies|waivers|bim-models|bim-discrepancies|drone-datasets|satellite-datasets|ingest\/status)(?:\/|\?(.*))?$/);

  if (nestedMatch) {
    const [, projectId, subresource, rawQuery] = nestedMatch;
    let targetEndpoint = subresource;
    if (subresource === "cost-dashboard" || subresource === "anomalies" || subresource === "ingest/status") {
      targetEndpoint = "dashboard";
    } else if (subresource === "boq-review" || subresource === "boq-material-reconciliation") {
      targetEndpoint = "boq";
    } else if (subresource === "waivers") {
      targetEndpoint = "requirement-waivers";
    }

    const queryParams = new URLSearchParams(rawQuery || "");
    queryParams.set("project_id", projectId);
    return `/${targetEndpoint}/?${queryParams.toString()}`;
  }

  // Rewrite /projects/subresource without ID
  p = p.replace(/^\/projects\/lifecycle/, "/lifecycle");
  p = p.replace(/^\/projects\/milestones/, "/milestones");

  // General alias rewrites
  p = p.replace(/^\/(?:finance\/)?drawdown-requests/, "/drawdowns");
  p = p.replace(/^\/finance\/certificates/, "/certificates");
  p = p.replace(/^\/finance\/requisitions/, "/requisitions");
  p = p.replace(/^\/finance\/disbursements/, "/disbursements");
  p = p.replace(/^\/hs-incidents/, "/safety-incidents");
  p = p.replace(/^\/calendar\/events/, "/calendar");
  p = p.replace(/^\/store\/items/, "/store-items");
  p = p.replace(/^\/issues/, "/tickets");
  p = p.replace(/^\/milestones\/pending-verification/, "/milestone-verifications");
  p = p.replace(/^\/reports\/(weekly|scurve|exec-dashboard|compliance)/, "/dashboard");
  p = p.replace(/^\/audit\/(logs|verify)/, "/dashboard");
  p = p.replace(/^\/ai\/status/, "/dashboard");
  p = p.replace(/^\/plans/, "/dashboard");
  p = p.replace(/^\/tenants/, "/dashboard");
  p = p.replace(/^\/sso-url/, "/dashboard");

  const [base, query] = p.split("?");
  const slashedBase = base.endsWith("/") ? base : `${base}/`;
  return query ? `${slashedBase}?${query}` : slashedBase;
}

async function req<T>(method: string, rawPath: string, body?: unknown): Promise<T> {
  let res: Response;
  const isFormData = body instanceof FormData;
  const h = authHeaders();

  const cleanPath = normalizePath(rawPath);
  const isCoreApi = cleanPath.startsWith("/auth/") || cleanPath === "/me/" || cleanPath.startsWith("/me/");
  const targetUrl = isCoreApi
    ? `${CORE_BASE}${cleanPath}`
    : `${CONSTRUCTION_BASE}${cleanPath}`;

  try {
    res = await fetch(targetUrl, {
      method,
      headers: {
        ...h,
        ...(body !== undefined && !isFormData ? { "Content-Type": "application/json" } : {}),
      },
      credentials: "include",
      body: isFormData ? (body as FormData) : (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch (err: any) {
    throw new ApiError(0, err?.message || "Network error — check your connection and try again.");
  }

  if (res.status === 401) {
    clearToken();
    throw new ApiError(401, "Your session has expired. Please sign in again.");
  }
  if (!res.ok) {
    let serverMessage = "";
    try {
      serverMessage = ((await res.json()) as { error?: string }).error ?? "";
    } catch {
      // non-JSON error body
    }
    const message =
      serverMessage ? serverMessage
      : res.status === 403 ? "You don't have permission to do that."
      : res.status === 404 ? "Not found."
      : res.status >= 500 ? "Server error — please try again shortly."
      : `Request failed (${res.status}).`;
    throw new ApiError(res.status, message);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const get = <T>(p: string) => req<T>("GET", p);
export const post = <T>(p: string, b?: unknown) => req<T>("POST", p, b ?? {});
export const patch = <T>(p: string, b: unknown) => req<T>("PATCH", p, b);
export const put = <T>(p: string, b: unknown) => req<T>("PUT", p, b);
export const del = (p: string) => req<void>("DELETE", p);

/** Upload a file via /media/upload and return the remote URL. */
export async function uploadFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await post<{ remote_url: string }>("/media/upload", fd);
  return res.remote_url;
}

// ---- Auth & identity ----

export async function login(username: string, password: string): Promise<void> {
  const res = await fetch("/api/v1/auth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, client_kind: CLIENT_KIND.DESKTOP }),
  });
  if (!res.ok) {
    let msg = "login failed";
    try { const body = await res.json(); msg = body.detail || body.error || msg; } catch {}
    throw new Error(msg);
  }
  setToken((await res.json()).access);
}
export const fetchMe = () => get<Me>("/me");

/** Change current user's password. Clears must_change_password flag. */
export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  await post<{ ok: boolean }>("/me/change-password", { old_password: oldPassword, new_password: newPassword });
}

// ---- Public registration (no auth required) ----
export const fetchPlans = () => get<unknown[]>("/plans");
export async function register(company: string, email: string, password: string, plan: string) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ company, email, password, plan }),
  });
  if (!res.ok) {
    const msg = ((await res.json()) as { error?: string }).error || "Registration failed";
    throw new Error(msg);
  }
  return res.json() as Promise<{ access: string; user: { username: string; tenant_id: string } }>;
}

// ---- Dashboard ----
export const fetchDashboard = (projectId?: string) =>
  get<Record<string, unknown>>(`/dashboard${projectId ? `?project_id=${encodeURIComponent(projectId)}` : ""}`);

// ---- Projects register ----
export const fetchProjects = () => get<Project[]>("/projects");
export const fetchProject = (id: string) => get<Project>(`/projects/${id}`);
export const createProject = (b: unknown) => post<Project>("/projects", b);
export const updateProject = (id: string, b: unknown) => patch<Project>(`/projects/${id}`, b);
export const fetchProjectAuditLog = (projectId: string) =>
  get<AuditLogResponse>(`/audit/logs?resource=project:${encodeURIComponent(projectId)}&limit=20`);
export const archiveProject = (id: string) => del(`/projects/${id}`);
export const completeOnboarding = (id: string) => post<{ ok: boolean }>(`/projects/${id}/onboarding-complete`);

// ---- Module selection ----
export const fetchAvailableModules = () => get<AvailableModule[]>("/projects/modules");

// ---- Onboarding wizard (4-step) ----
export const fetchOnboardingStatus = (id: string) => get<OnboardingStatus>(`/projects/${id}/onboarding/status`);
export const saveOnboardingStep1 = (id: string, b: unknown) => post<{ ok: boolean }>(`/projects/${id}/onboarding/step1`, b);
export const fetchOnboardingStep2 = (id: string) => get<ProjectMember[]>(`/projects/${id}/onboarding/step2`);
export const saveOnboardingStep3 = (id: string, b: unknown) => post<{ ok: boolean }>(`/projects/${id}/onboarding/step3`, b);
export const fetchOnboardingStep3 = (id: string) => get<OnboardingStep3Data>(`/projects/${id}/onboarding/step3`);
export const fetchOnboardingStep4 = (id: string) => get<OnboardingChecklistItem[]>(`/projects/${id}/onboarding/step4`);
export const completeOnboardingWizard = (id: string) => post<{ ok: boolean }>(`/projects/${id}/onboarding/step4`);

// ---- Requirement waivers ----
export const fetchWaivers = (id: string) => get<Waiver[]>(`/projects/${id}/waivers`);
export const createWaiver = (id: string, b: unknown) => post<Waiver>(`/projects/${id}/waivers`, b);
export const deleteWaiver = (id: string, waiverId: number) => del(`/projects/${id}/waivers/${waiverId}`);

// ---- Tenant management ----
export const fetchTenants = () => get<Tenant[]>("/tenants");
export const createTenant = (b: unknown) => post<Tenant>("/tenants", b);
export const fetchTenant = (id: string) => get<Tenant>(`/tenants/${id}`);
export const updateTenant = (id: string, b: unknown) => patch<Tenant>(`/tenants/${id}`, b);
export const setDefaultTenant = (tenantId: string) => post<{ ok: boolean }>("/tenants/default", { tenant_id: tenantId });

export const saveBranding = (tenantId: string, branding: { logo_url?: string; primary_color?: string; company_name?: string }) =>
  patch<Tenant>(`/tenants/${tenantId}`, { settings: { branding } });

// ---- Audit Trail ----
export const fetchAuditLogs = (params?: Record<string, string | number | undefined>) => {
  const qs = params ? "?" + Object.entries(params).filter(([_, v]) => v !== undefined).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&") : "";
  return get<AuditLogResponse>(`/audit/logs${qs}`);
};

export const fetchAuditLogDetail = (id: string) =>
  get<AuditLog>(`/audit/logs/${id}`);

export const addDocument = (id: string, b: unknown) => post<Document>(`/projects/${id}/documents`, b);

// ---- SSO & website sync ----
export const fetchSsoUrl = () => get<{ sso_url: string | null; enabled: boolean }>("/sso-url");
export const syncWebsiteUsers = (users: { username: string; email?: string; password?: string }[]) =>
  post<{ synced: number; total: number }>("/users/sync-website", { users });
export const deleteDocument = (id: string, docId: number) => del(`/projects/${id}/documents/${docId}`);
export const addApproval = (id: string, b: unknown) => post<Approval>(`/projects/${id}/approvals`, b);
export const updateApproval = (id: string, aId: number, b: unknown) => patch<Approval>(`/projects/${id}/approvals/${aId}`, b);
export const deleteApproval = (id: string, aId: number) => del(`/projects/${id}/approvals/${aId}`);

// ---- Site reporting ----
export const fetchIssues = (projectId?: string) =>
  get<IssueRow[]>(projectId ? `/issues?project_id=${encodeURIComponent(projectId)}` : "/issues");
export const fetchPendingVerifications = () => get<MilestoneVerification[]>("/milestones/pending-verification");
export const verifyMilestone = (id: string, decision: string, note = "") =>
  post<{ ok: boolean }>(`/milestones/${id}/verify`, { decision, note });
export const verifySubmission = (id: string) => get<VerifyResponse>(`/audit/verify/${id}`);
export const fetchWeeklyReport = (projectId: string) =>
  get<WeeklyReport>(`/reports/weekly?project_id=${encodeURIComponent(projectId)}`);
export const fetchScurve = (projectId: string) =>
  get<SCurve>(`/reports/scurve?project_id=${encodeURIComponent(projectId)}`);

// ExecDashboard, ComplianceRow, MaterialDelivery, SafetyIncident, ChatTurn, AIModel, AIStatus
// are defined in api-types.ts and re-exported above

export const fetchExecDashboard = (projectId: string) =>
  get<ExecDashboard>(`/reports/exec-dashboard?project_id=${encodeURIComponent(projectId)}`);

export const fetchCompliance = (days = 14) => get<ComplianceRow[]>(`/reports/compliance?days=${days}`);

export const draftWeeklyNarrative = (projectId: string) =>
  post<{ project_id: string; draft: string }>("/reports/weekly-narrative", { project_id: projectId });

// ---- Site records: material deliveries + H&S incidents (with proof photos) ----
export const fetchMaterials = async (projectId?: string) => {
  const data = await get<MaterialDelivery[] | { results: MaterialDelivery[] }>(projectId ? `/materials?project_id=${encodeURIComponent(projectId)}` : "/materials");
  return Array.isArray(data) ? data : (data.results ?? []);
};
export const fetchIncidents = async (projectId?: string) => {
  const data = await get<SafetyIncident[] | { results: SafetyIncident[] }>(projectId ? `/hs-incidents?project_id=${encodeURIComponent(projectId)}` : "/hs-incidents");
  return Array.isArray(data) ? data : (data.results ?? []);
};

// ---- AI assistant (OpenRouter-backed gateway) ----
export const fetchAIStatus = () => get<AIStatus>("/ai/status");
export const fetchAIModels = () => get<{ models: AIModel[] }>("/ai/models").then((r) => r.models);
export const projectChat = (projectId: string, message: string, history: ChatTurn[], model?: string) =>
  post<{ project_id: string; answer: string; sources?: { label: string; count: number }[] }>("/ai/project-chat", {
    project_id: projectId, message, history, ...(model ? { model } : {}),
  });
export const riskDigest = (projectId: string, model?: string) =>
  get<{ project_id: string; digest: string }>(
    `/ai/risk-digest?project_id=${encodeURIComponent(projectId)}${model ? `&model=${encodeURIComponent(model)}` : ""}`,
  );
export const tagPhoto = (evidenceId: string) =>
  post<{ evidence_id: string; tags: string[] }>("/ai/tag-photo", { evidence_id: evidenceId });

export async function fetchWeeklyReportPdf(projectId: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/reports/weekly.pdf?project_id=${encodeURIComponent(projectId)}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new ApiError(res.status, "Couldn't generate the PDF.");
  return res.blob();
}

/**
 * Resolve an evidence photo URL.
 * - Absolute URLs (stock/demo images, object storage) pass through.
 * - Relative `/media/...` paths resolve against the SPA's own origin, where
 *   nginx serves the shared media volume in production (and the vite dev proxy
 *   forwards to the backend locally). The API origin does NOT serve media in
 *   production, so we must NOT prefix API_BASE here.
 */
export const mediaUrl = (path: string) => path;

export const fetchTickets = async (projectId?: string) => {
  const data = await get<Ticket[] | { results: Ticket[] }>(projectId ? `/tickets?project_id=${encodeURIComponent(projectId)}` : "/tickets");
  return Array.isArray(data) ? data : (data.results ?? []);
};
export const createTicket = (b: unknown) => post<Ticket>("/tickets", b);
export const updateTicket = (id: number, b: unknown) => patch<Ticket>(`/tickets/${id}`, b);
export const acknowledgeTicket = (id: number) => post<{ ok: boolean }>(`/tickets/${id}/acknowledge`);
export const deleteTicket = (id: number) => del(`/tickets/${id}`);
export const fetchDailyLogs = async (projectId?: string, limit = 50) => {
  const qs = new URLSearchParams({ limit: String(limit) });
  if (projectId) qs.set("project_id", projectId);
  const data = await get<{ results: DailyLog[]; total: number } | DailyLog[]>(`/daily-logs?${qs}`);
  return Array.isArray(data) ? { results: data, total: data.length } : { results: data.results ?? [], total: data.total ?? 0 };
};
export const createDailyLog = (b: unknown) => post<DailyLog>("/daily-logs", b);
export const updateDailyLog = (id: number, b: unknown) => patch<DailyLog>(`/daily-logs/${id}`, b);
export const deleteDailyLog = (id: number) => del(`/daily-logs/${id}`);

// ---- Calendar / site visits / meetings ----
export type CalendarEvent = {
  id: string;
  project_id: string | null;
  milestone_id: string;
  title: string;
  description: string;
  event_type: string;
  location: string;
  status: string;
  attendees: string[] | { name?: string }[];
  findings: string;
  action_items: { description?: string; assignedTo?: string; dueDate?: string; status?: string; priority?: string }[] | string[];
  minutes_url: string;
  start: number;
  end: number;
  all_day: boolean;
  color: string;
  created_by: string | null;
  created_at: number;
  updated_at: number;
};
export const fetchCalendarEvents = (params?: { project_id?: string; start?: number; end?: number; event_type?: string }) => {
  const qs = new URLSearchParams();
  if (params?.project_id) qs.set("project_id", params.project_id);
  if (params?.start != null) qs.set("start", String(params.start));
  if (params?.end != null) qs.set("end", String(params.end));
  const suffix = qs.toString() ? `?${qs}` : "";
  return get<CalendarEvent[]>(`/calendar/events${suffix}`);
};
export const createCalendarEvent = (b: unknown) => post<{ id: string }>("/calendar/events", b);
export const updateCalendarEvent = (id: string, b: unknown) => put<{ id: string }>(`/calendar/events/${id}`, b);
export const deleteCalendarEvent = (id: string) => del(`/calendar/events/${id}`);

// ---- Drawdown requests ----
export type DrawdownRequest = {
  id: number;
  request_number: string;
  amount: string;
  purpose: string;
  status: string;
  project_id?: string;
};
export const fetchDrawdownRequests = (projectId?: string) =>
  get<DrawdownRequest[]>(`/finance/drawdown-requests${projectId ? `?project_id=${encodeURIComponent(projectId)}` : ""}`);
export const createDrawdownRequest = (b: unknown) => post<DrawdownRequest>("/finance/drawdown-requests", b);
export const actionDrawdownRequest = (id: number, action: string) =>
  post<DrawdownRequest>(`/finance/drawdown-requests/${id}/action`, { action });

// ---- Risks ----
export const fetchRisks = (projectId?: string) =>
  get<any[]>(projectId ? `/risks?project_id=${encodeURIComponent(projectId)}` : "/risks");
export const createRisk = (b: unknown) => post<any>("/risks", b);
export const updateRisk = (id: number | string, b: unknown) => patch<any>(`/risks/${id}`, b);
export const deleteRisk = (id: number | string) => del(`/risks/${id}`);

// ---- Project documents (controlled) ----
export const fetchProjectDocuments = (projectId: string) =>
  get<ProjectDocument[]>(`/projects/${projectId}/documents`);

// ---- Finance ----
export const fetchRequisitions = () => get<Requisition[]>("/finance/requisitions");
export const createRequisition = (b: unknown) => post<Requisition>("/finance/requisitions", b);
export const reviewRequisition = (id: number) => post<Requisition>(`/finance/requisitions/${id}/review`);
export const decideRequisition = (id: number, decision: string) =>
  post<Requisition>(`/finance/requisitions/${id}/decision`, { decision });
export const fetchCertificates = () => get<Certificate[]>("/finance/certificates");
export const issueCertificate = (b: unknown) => post<Certificate>("/finance/certificates", b);
export const voidCertificate = (id: number, reason: string) => post<Certificate>(`/finance/certificates/${id}/void`, { reason });
export const fetchDisbursements = () => get<Disbursement[]>("/finance/disbursements");
export const createDisbursement = (b: unknown) => post<Disbursement>("/finance/disbursements", b);
export const payDisbursement = (id: number) => post<Disbursement>(`/finance/disbursements/${id}/pay`);
export const voidDisbursement = (id: number, reason: string) => post<Disbursement>(`/finance/disbursements/${id}/void`, { reason });

export async function fetchCertificatePdf(id: number): Promise<Blob> {
  const res = await fetch(`${API_BASE}/finance/certificates/${id}/pdf`, { headers: authHeaders() });
  if (!res.ok) throw new ApiError(res.status, "Couldn't generate the certificate PDF.");
  return res.blob();
}

// ---- Store ----
export const fetchItems = () => get<StoreItem[]>("/store/items");
export const createItem = (b: unknown) => post<StoreItem>("/store/items", b);
export const updateItem = (id: number, b: unknown) => patch<StoreItem>(`/store/items/${id}`, b);
export const deleteItem = (id: number) => del(`/store/items/${id}`);
export const fetchPurchaseOrders = () => get<PurchaseOrder[]>("/store/purchase-orders");

// ---- Users & roles ----
export const fetchUsers = async () => {
  const data = await get<UserProfile[] | { results: UserProfile[] }>("/users");
  return Array.isArray(data) ? data : (data.results ?? []);
};
export const createUser = (b: unknown) => post<UserProfile>("/users", b);
export const updateUser = (id: number, b: unknown) => patch<UserProfile>(`/users/${id}`, b);
export const inviteUser = (b: unknown) => post<UserProfile>("/users/invite", b);
export const fetchRoles = () => get<Role[]>("/roles");
export const fetchPermissions = () => get<Permission[]>("/permissions");
export const fetchRole = (slug: string) => get<Role>(`/roles/${slug}`);
export const createRole = (b: unknown) => post<Role>("/roles", b);
export const saveRole = (slug: string, b: unknown) => put<Role>(`/roles/${slug}`, b);
export const deleteRole = (slug: string) => del(`/roles/${slug}`);

// ---- Module feature APIs (quality, BIM, drone, consultant) ----
export const fetchQualityTests = (id: string) => get<QualityTest[]>(`/projects/${id}/quality-tests`);
export const createQualityTest = (id: string, b: unknown) => post<QualityTest>(`/projects/${id}/quality-tests`, b);
export const fetchConsultantPayments = (id: string) => get<ConsultantPayment[]>(`/projects/${id}/consultant-payments`);
export const createConsultantPayment = (id: string, b: unknown) => post<ConsultantPayment>(`/projects/${id}/consultant-payments`, b);
export const consultantPaymentAction = (paymentId: number, action: string) => patch<ConsultantPayment>(`/consultant-payments/${paymentId}/action`, { action });
export const fetchBimModels = (id: string) => get<BimModel[]>(`/projects/${id}/bim-models`);
export const createBimModel = (id: string, b: unknown) => post<BimModel>(`/projects/${id}/bim-models`, b);
export const fetchSatelliteDatasets = (id: string) => get<any[]>(`/projects/${id}/satellite-datasets`);
export const createSatelliteDataset = (id: string, b: unknown) => post<any>(`/projects/${id}/satellite-datasets`, b);
export const deleteSatelliteDataset = (id: string, dsId: number) => del(`/projects/${id}/satellite-datasets/${dsId}`);
export const fetchBimDiscrepancies = (id: string) => get<any[]>(`/projects/${id}/bim-discrepancies`);
export const resolveBimDiscrepancy = (id: string, discId: number, resolution_notes: string) =>
  patch<any>(`/projects/${id}/bim-discrepancies/${discId}`, { status: "resolved", resolution_notes });
export const fetchMonthlyReport = (projectId: string, year: number, month: number) =>
  get<any>(`/reports/monthly?project_id=${encodeURIComponent(projectId)}&year=${year}&month=${month}`);
export const fetchDroneDatasets = (id: string) => get<DroneDataset[]>(`/projects/${id}/drone-datasets`);
export const createDroneDataset = (id: string, b: unknown) => post<DroneDataset>(`/projects/${id}/drone-datasets`, b);
export const archiveDroneDataset = (id: string, datasetId: number) => patch<DroneDataset>(`/projects/${id}/drone-datasets/${datasetId}/archive`, {});
export const droneReview = (datasetId: number, annotation: string, annotationType = "general") =>
  post<{ ok: boolean }>(`/drone-datasets/${datasetId}/review`, { annotation, annotation_type: annotationType });
export const droneReviewComplete = (datasetId: number) =>
  post<{ ok: boolean }>(`/drone-datasets/${datasetId}/review/complete`, {});
export const droneLinkSales = (datasetId: number, campaignId: string) =>
  post<{ ok: boolean }>(`/drone-datasets/${datasetId}/link-sales`, { campaign_id: campaignId });
export const droneSignUrl = (datasetId: number, ttl = 3600) =>
  get<{ url: string; expires_at: number }>(`/drone-datasets/${datasetId}/sign-url?ttl=${ttl}`);
export const droneAuditLog = (datasetId: number) =>
  get<AuditLog[]>(`/drone-datasets/${datasetId}/audit-log`);
export const droneColdArchive = (datasetId: number) =>
  post<{ ok: boolean }>(`/drone-datasets/${datasetId}/cold-archive`, {});
export const fetchIgpSafeguards = (id: string) => get<IgpSafeguard>(`/projects/${id}/igp/safeguards`);
export const updateIgpSafeguards = (id: string, b: unknown) => put<IgpSafeguard>(`/projects/${id}/igp/safeguards`, b);
export const fetchIgpProcurement = (id: string) => get<IgpProcurement>(`/projects/${id}/igp/procurement`);
export const updateIgpProcurement = (id: string, b: unknown) => put<IgpProcurement>(`/projects/${id}/igp/procurement`, b);
export const fetchModuleConfig = (id: string, moduleKey: string) => get<ProjectModuleConfig>(`/projects/${id}/module-config/${moduleKey}`);
export const updateModuleConfig = (id: string, moduleKey: string, settings: Record<string, unknown>) =>
  put<ProjectModuleConfig>(`/projects/${id}/module-config/${moduleKey}`, { settings });
export const fetchMilestones = (projectId: string) => get<any[]>(`/projects/${projectId}/milestones`);
export const createMilestone = (projectId: string, data: any) => post<any>(`/projects/${projectId}/milestones`, data);
export const updateMilestone = (projectId: string, milestoneId: string, data: any) => patch<any>(`/projects/${projectId}/milestones/${milestoneId}`, data);
export const deleteMilestone = (projectId: string, milestoneId: string) => del(`/projects/${projectId}/milestones/${milestoneId}`);

export const reportRegression = (id: string, milestoneId: string, percentComplete: number, justification: string) =>
  post<{ ok: boolean }>(`/projects/${id}/milestones/${milestoneId}/regression`, { percent_complete: percentComplete, justification });
export const checkInflation = (id: string, milestoneId: string, percentComplete: number, threshold = 20) =>
  post<{ ok: boolean }>(`/projects/${id}/check-inflation`, { milestone_id: milestoneId, percent_complete: percentComplete, threshold });

// ---- BoQ / Work Plan Ingestion ----
export const ingestExcel = (id: string, file: File) => {
  const fd = new FormData();
  fd.append("file", file);
  return fetch(`${API_BASE}/projects/${id}/ingest`, {
    method: "POST", headers: authHeaders(), body: fd,
  }).then(r => { if (!r.ok) throw new Error("Ingestion failed"); return r.json() as Promise<{ status: string; message: string }>; });
};
export const ingestExcelPreview = (id: string, file: File) => {
  const fd = new FormData();
  fd.append("file", file);
  return fetch(`${API_BASE}/projects/${id}/ingest/preview`, {
    method: "POST", headers: authHeaders(), body: fd,
  }).then(r => { if (!r.ok) throw new Error("Preview failed"); return r.json() as Promise<IngestionPreview>; });
};
export const ingestExcelCommit = (id: string, data: unknown) =>
  post<IngestionCommitResult>(`/projects/${id}/ingest/commit`, data);
export const fetchIngestionStatus = (id: string) => get<IngestionStatus>(`/projects/${id}/ingest/status`);
export const updateWorkplanTask = (
  projectId: string,
  taskId: string,
  body: { percent_complete?: number; status?: string; remarks?: string },
) => patch<{
  task_id: string;
  task_name: string;
  percent_complete: number;
  status: string;
  start_date: string;
  end_date: string;
  remarks: string;
}>(`/projects/${projectId}/workplan/tasks/${encodeURIComponent(taskId)}`, body);
export const generateMilestones = (id: string) => post<{ ok: boolean; milestones_created: number }>(`/projects/${id}/ingest/generate`);
// AI-powered ingestion
export const aiIngestDraft = (projectId: string, workplan: File, boq: File) => {
  const fd = new FormData();
  fd.append("workplan", workplan);
  fd.append("boq", boq);
  return fetch(`${API_BASE}/ai/ingest/${projectId}?draft=true`, {
    method: "POST", headers: authHeaders(), body: fd,
  }).then(r => { if (!r.ok) throw new Error("AI ingestion failed"); return r.json() as Promise<IngestionPreview>; });
};
export const aiIngestCommit = (projectId: string, data: unknown) =>
  post<{ ok: boolean }>(`/ai/ingest/${projectId}/commit`, data);

// ---- Chunked Drone Upload (SRS-DRN-PERF-01) ----
export function droneUploadChunk(
  projectId: string,
  uploadId: string,
  chunk: Blob,
  chunkIndex: number,
  totalChunks: number,
  filename: string,
  extra: Record<string, string> = {},
) {
  const fd = new FormData();
  fd.append("upload_id", uploadId);
  fd.append("chunk_index", String(chunkIndex));
  fd.append("total_chunks", String(totalChunks));
  fd.append("filename", filename);
  fd.append("chunk", chunk);
  for (const [k, v] of Object.entries(extra)) fd.append(k, v);
  return fetch(`${API_BASE}/projects/${projectId}/drone-upload`, {
    method: "POST", headers: { ...authHeaders(), /* no Content-Type — browser sets multipart */ },
    body: fd,
  }).then(r => { if (!r.ok) throw new Error("Chunk upload failed"); return r.json() as Promise<{ upload_id: string; complete: boolean; chunks_received: number }>; });
}

// ---- Communication ----
export const fetchNotices = () => get<Notice[]>("/notices");
export const postNotice = (b: unknown) => post<Notice>("/notices", b);

// ---- Settings (SMTP) ----
export const fetchSmtp = () => get<SmtpSettings>("/settings/smtp");
export const saveSmtp = (b: Partial<SmtpSettings> & { password?: string }) =>
  put<SmtpSettings>("/settings/smtp", b);
export const testSmtp = (to: string) => post<{ sent: number; to: string }>("/settings/smtp/test", { to });

// ---- Audit / office notes (existing) ----
export async function fetchCertificate(milestoneEntryId: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/audit/certificate/${encodeURIComponent(milestoneEntryId)}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`certificate failed: ${res.status}`);
  return res.blob();
}

export async function fetchReviewData(): Promise<PullResponse> {
  return get<PullResponse>("/sync/pull?last_pulled_at=0");
}

export async function addOfficeNote(
  note: Pick<OfficeNoteRow, "id" | "milestone_entry_id" | "body" | "author">,
): Promise<void> {
  await post("/sync/push", {
    changes: {
      [SYNC_TABLES.OFFICE_NOTES]: { created: [note], updated: [], deleted: [] },
      [SYNC_TABLES.MILESTONE_ENTRIES]: { created: [], updated: [], deleted: [] },
      [SYNC_TABLES.EVIDENCE_FILES]: { created: [], updated: [], deleted: [] },
      [SYNC_TABLES.OBSERVATIONS]: { created: [], updated: [], deleted: [] },
    },
  });
}

// ---- Construction Cost Management (variations, PS, contingency, advance) ----
export const fetchVariations = (id: string) => get<Variation[]>(`/projects/${id}/variations`);
export const createVariation = (id: string, b: unknown) => post<Variation>(`/projects/${id}/variations`, b);
export const variationAction = (variationId: number, action: string) => patch<Variation>(`/variations/${variationId}/action`, { action });
export const fetchProvisionalSums = (id: string) => get<ProvisionalSum[]>(`/projects/${id}/provisional-sums`);
export const createProvisionalSum = (id: string, b: unknown) => post<ProvisionalSum>(`/projects/${id}/provisional-sums`, b);
export const updateProvisionalSum = (psId: number, b: unknown) => patch<ProvisionalSum>(`/provisional-sums/${psId}`, b);
export const fetchContingencyDrawdowns = (id: string) => get<ContingencyDrawdown[]>(`/projects/${id}/contingency-drawdowns`);
export const createContingencyDrawdown = (id: string, b: unknown) => post<ContingencyDrawdown>(`/projects/${id}/contingency-drawdowns`, b);
export const contingencyAction = (cdId: number, action: string) => patch<ContingencyDrawdown>(`/contingency-drawdowns/${cdId}/action`, { action });
export const fetchAdvancePayments = (id: string) => get<AdvancePayment[]>(`/projects/${id}/advance-payments`);
export const createAdvancePayment = (id: string, b: unknown) => post<AdvancePayment>(`/projects/${id}/advance-payments`, b);
export const recordAdvanceRecovery = (advanceId: number, b: unknown) => post<AdvancePayment>(`/advance-payments/${advanceId}/recovery`, b);
export const fetchCostDashboard = (id: string) => get<CostDashboardData>(`/projects/${id}/cost-dashboard`);
export const fetchCashFlowForecast = (projectId: string) =>
  get<CashFlowForecast>(`/projects/${projectId}/cash-flow-forecast`);
export const fetchProjectMembers = (id: string) => get<ProjectMember[]>(`/projects/${id}/members`);
export const addProjectMember = (id: string, b: unknown) => post<ProjectMember>(`/projects/${id}/members`, b);
export const removeProjectMember = (id: string, memberId: number) => del(`/projects/${id}/members/${memberId}`);

// ---- Finance Cost Engine (IPC, retention, cost state) ----
export const generateIpc = (b: unknown) => post<IpcResult>("/finance/ipc/generate", b);
export const fetchRetentionSummary = (projectId?: string) =>
  get<RetentionSummary>(`/finance/retention/summary${projectId ? `?project_id=${encodeURIComponent(projectId)}` : ""}`);
export const transitionCostState = (boqItemId: number, targetState: string, extra?: Record<string, unknown>) =>
  post<BoqItem>(`/finance/boq/${boqItemId}/transition`, { target_state: targetState, ...extra });
export const bulkTransitionCostState = (itemIds: number[], targetState: string) =>
  post<{ ok: boolean }>("/finance/boq/bulk-transition", { target_state: targetState, item_ids: itemIds });
export const fetchBoqItems = (projectId: string) => get<BoqItem[]>(`/projects/${projectId}/boq-items`);

// Financial Report PDF downloads (browser navigates to these)
export const costDashboardPdfUrl = (projectId: string) => `${API_BASE}/finance/reports/cost-dashboard?project_id=${encodeURIComponent(projectId)}`;
export const retentionStatementPdfUrl = (projectId: string) => `${API_BASE}/finance/reports/retention-statement?project_id=${encodeURIComponent(projectId)}`;
export const advanceSchedulePdfUrl = (projectId: string) => `${API_BASE}/finance/reports/advance-schedule?project_id=${encodeURIComponent(projectId)}`;
export const ipcDetailPdfUrl = (certificateId: number) => `${API_BASE}/finance/reports/ipc-detail/${certificateId}`;

// Template downloads (browser navigates to these URLs for download)
export const workplanTemplateUrl = `${API_BASE}/templates/workplan`;
export const boqTemplateUrl = `${API_BASE}/templates/boq`;
export const sampleIfcUrl = `${API_BASE}/templates/sample-ifc`;

export const convertProjectPdf = async (projectId: string, file: File) => {
  const form = new FormData();
  form.append("project_id", projectId);
  form.append("file", file);
  const res = await fetch(`${API_BASE}/ai/convert-project-pdf`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `PDF conversion failed (${res.status})`);
  }
  return res.json() as Promise<{ boq_items: any[]; work_plan_tasks: any[]; requires_review: boolean }>;
};

// Drawdown eligibility
export const checkDrawdownEligibility = (milestoneEntryId: string) =>
  get<{ eligible: boolean; reason: string }>(`/milestones/${milestoneEntryId}/drawdown-eligibility`);

// BIM: IFC file upload
export async function uploadIfcFile(projectId: string, file: File): Promise<{ model_id: number; name: string; elements: number }> {
  const formData = new FormData();
  formData.append("file", file);
  const headers = { ...authHeaders() };
  delete (headers as any)["Content-Type"];
  const res = await fetch(`${API_BASE}/projects/${projectId}/bim-models/upload-ifc`, {
    method: "POST", headers, body: formData,
  });
  if (!res.ok) {
    let msg = `IFC upload failed (${res.status})`;
    try { const body = await res.json(); msg = body.error || body.detail || msg; } catch {}
    throw new ApiError(res.status, msg);
  }
  return res.json();
}

export const fetchBimBoqLinks = (projectId: string, modelId: string) =>
  get<any>(`/projects/${projectId}/bim-models/${modelId}/boq-links`);

// ---- Subcontractors & Work Orders (Feature #5) ----
export const fetchSubcontractors = (projectId: string) =>
  get<Subcontractor[]>(`/projects/${projectId}/subcontractors`);
export const createSubcontractor = (projectId: string, b: unknown) =>
  post<Subcontractor>(`/projects/${projectId}/subcontractors`, b);
export const updateSubcontractor = (subId: number, b: unknown) =>
  patch<Subcontractor>(`/subcontractors/${subId}`, b);
export const deleteSubcontractor = (subId: number) =>
  del(`/subcontractors/${subId}`);
export const fetchWorkOrders = (projectId: string) =>
  get<WorkOrder[]>(`/projects/${projectId}/work-orders`);
export const createWorkOrder = (projectId: string, b: unknown) =>
  post<WorkOrder>(`/projects/${projectId}/work-orders`, b);
export const updateWorkOrder = (woId: number, b: unknown) =>
  patch<WorkOrder>(`/work-orders/${woId}`, b);
export const fetchWorkOrderSummary = (projectId: string) =>
  get<WorkOrderSummary>(`/projects/${projectId}/work-order-summary`);
