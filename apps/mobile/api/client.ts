import {
  CLIENT_KIND,
  type IssueRow,
  type ProjectRow,
  type SCurve,
  type VerifyResponse,
  type WeeklyReport,
} from "@monitoring/shared-types";
// Legacy FileSystem keeps uploadAsync/createUploadTask (the new SDK 56 File API
// dropped them). Native multipart upload is reliable where fetch+FormData isn't.
import * as FileSystem from "expo-file-system/legacy";

import { apiUrl, authHeaders, setToken } from "../sync/api";

function friendly(status: number): string {
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403) return "You don't have permission to do that.";
  if (status === 404) return "Not found.";
  if (status >= 500) return "Server error — please try again shortly.";
  return `Request failed (${status}).`;
}

/** Error carrying the HTTP status (0 = network/offline) so callers can tell an
 *  auth rejection from a transient connectivity failure. */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function parseJsonResponse<T>(res: Response): Promise<T> {
  const contentType = res.headers?.get?.("content-type") || "";
  if (contentType && !contentType.includes("application/json")) {
    const text = await res.text();
    throw new ApiError(
      res.status,
      `Expected JSON response but received ${contentType} (${res.status}): ${text.slice(0, 100)}`
    );
  }
  return res.json() as Promise<T>;
}

async function getJson<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(apiUrl(path), { headers: { ...(await authHeaders()) } });
  } catch {
    throw new ApiError(0, "Network error — check your connection and try again.");
  }
  if (!res.ok) throw new ApiError(res.status, friendly(res.status));
  return parseJsonResponse<T>(res);
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(apiUrl(path), {
      method: "POST",
      headers: { ...(await authHeaders()), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Network error — check your connection and try again.");
  }
  if (!res.ok) throw new ApiError(res.status, friendly(res.status));
  return parseJsonResponse<T>(res);
}

async function patchJson<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(apiUrl(path), {
      method: "PATCH",
      headers: { ...(await authHeaders()), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Network error — check your connection and try again.");
  }
  if (!res.ok) throw new ApiError(res.status, friendly(res.status));
  return parseJsonResponse<T>(res);
}

export interface Me {
  username: string;
  is_superuser: boolean;
  roles: string[];
  permissions: string[];
  tenant_id: string | null;
}

/** Authenticate as a MOBILE client (token carries client_kind=mobile so the
 *  server permits evidence writes). */
export async function login(username: string, password: string): Promise<void> {
  const res = await fetch(apiUrl("/auth/token/"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, client_kind: CLIENT_KIND.MOBILE }),
  });
  if (!res.ok) throw new Error("Login failed — check your credentials");
  const { access } = (await res.json()) as { access: string };
  await setToken(access);
}

export async function registerDevice(deviceId: string, publicKey: string): Promise<void> {
  const res = await fetch(apiUrl("/devices/register"), {
    method: "POST",
    headers: { ...(await authHeaders()), "Content-Type": "application/json" },
    body: JSON.stringify({ device_id: deviceId, public_key: publicKey }),
  });
  if (!res.ok) throw new Error(`device registration failed: ${res.status}`);
}

export const fetchMe = () => getJson<Me>("/me");

export interface DailyLogInput {
  project_id: string;
  log_date: string;
  weather?: string;
  labour_count?: number;
  notes?: string;
  /** Structured general-site-condition sections (weather/materials/labour/
   *  plant/visitors/information). */
  details?: Record<string, unknown>;
}
export const submitDailyLog = (log: DailyLogInput) => postJson<{ id: number }>("/daily-logs/", log);

/** SRS-MOB-MAT: materials delivered to site (weekly-report section). */
export interface MaterialDeliveryInput {
  project_id: string;
  delivery_date: string;
  material: string;
  quantity: number;
  unit?: string;
  supplier?: string;
  remarks?: string;
  receipt_url?: string;
  boq_item_id?: number | null;
}
export const submitMaterialDelivery = (d: MaterialDeliveryInput) =>
  postJson<{ id: number }>("/materials/", d);

export interface WorkPlanTaskRow {
  id: number;
  task_id: string;
  task_name: string;
  wbs_level?: number;
  start_date: string;
  end_date: string;
  duration_days?: number;
  percent_complete?: string | number;
  status?: string;
  predecessors?: string;
}

export const fetchWorkPlanTasks = (projectId: string) =>
  getJson<WorkPlanTaskRow[]>(`/work-plan/?project_id=${encodeURIComponent(projectId)}`);

/** Upload a proof photo (delivery note, incident scene, …) and return its
 *  stored URL. Reuses the evidence media channel (/media/upload); the URL is
 *  then saved on the record. Online-only — these forms already require a
 *  connection to submit.
 *
 *  Uses expo-file-system's native multipart upload rather than fetch+FormData:
 *  RN's FormData file upload fails with an opaque "Network request failed"
 *  before the request leaves the device (and can stream chunked, which the
 *  server can't parse). uploadAsync streams the file natively with a proper
 *  Content-Length. */
export async function uploadProofPhoto(localUri: string, mimeType = "image/jpeg"): Promise<string> {
  let res: FileSystem.FileSystemUploadResult;
  try {
    res = await FileSystem.uploadAsync(apiUrl("/media/upload"), localUri, {
      httpMethod: "POST",
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: "file",
      mimeType,
      headers: await authHeaders(),
    });
  } catch {
    throw new ApiError(0, "Network error — check your connection and try again.");
  }
  if (res.status < 200 || res.status >= 300) throw new ApiError(res.status, friendly(res.status));
  const { remote_url } = JSON.parse(res.body) as { remote_url: string };
  return remote_url;
}

/** SRS-MOB-HS: health & safety incident (weekly-report section). */
export interface SafetyIncidentInput {
  project_id: string;
  incident_date: string;
  severity: "near_miss" | "first_aid" | "lost_time" | "serious";
  description: string;
  action_taken?: string;
  photo_urls?: string[];
}
export const submitSafetyIncident = (i: SafetyIncidentInput) =>
  postJson<{ id: number }>("/hs-incidents/", i);

export const fetchProjects = () => getJson<ProjectRow[]>("/projects/");
export const fetchProject = (id: string) => getJson<any>(`/projects/${encodeURIComponent(id)}/`);
export const fetchProjectMembers = (id: string) => getJson<any[]>(`/projects/${encodeURIComponent(id)}/members/`);
export const fetchWeeklyReport = (projectId: string) =>
  getJson<WeeklyReport>(`/reports/weekly/?project_id=${encodeURIComponent(projectId)}`);
export const fetchScurve = (projectId: string) =>
  getJson<SCurve>(`/reports/scurve/?project_id=${encodeURIComponent(projectId)}`);
export const fetchIssues = (projectId?: string) =>
  getJson<IssueRow[]>(projectId ? `/issues/?project_id=${encodeURIComponent(projectId)}` : "/issues/");
export const verifySubmission = (milestoneEntryId: string) =>
  getJson<VerifyResponse>(`/audit/verify/${encodeURIComponent(milestoneEntryId)}`);

// ── BoQ Field Progress ───────────────────────────────────────────────────────

export interface BoqItemRow {
  id: number;
  section: string;
  item_number: string;
  description: string;
  unit: string;
  quantity: string;
  rate: string;
  amount: string;
  cost_state: string;
  approval_status: string;
  certified_quantity: string;
  certified_amount: string;
  executed_quantity: string | null;
  progress_updated_at: number | null;
}

export const fetchBoqItems = (projectId: string) =>
  getJson<BoqItemRow[]>(`/projects/${encodeURIComponent(projectId)}/boq-items/`);

export const updateBoqProgress = (projectId: string, boqItemId: number, executedQuantity: number) =>
  patchJson<{ id: number; executed_quantity: string; progress_updated_at: number }>(
    `/projects/${encodeURIComponent(projectId)}/boq-items/${boqItemId}/progress/`,
    { executed_quantity: executedQuantity },
  );

export interface MilestoneMiniBoQItem {
  id: number;
  boq_item_id: number;
  boq_item_number: string;
  boq_description: string;
  boq_unit: string;
  boq_rate: string | number;
  allocated_quantity: string | number;
  notes: string;
}

export interface MilestoneValuation {
  current_gross: number;
  retention_percent: number;
  retention_amount: number;
  advance_recovery_percent: number;
  advance_recovery: number;
  net_payable: number;
  allocated_items_count: number;
}

export const fetchMilestoneMiniBoQ = (milestoneDbId: string | number) =>
  getJson<{
    milestone_id: string;
    percent_complete: number;
    items: MilestoneMiniBoQItem[];
    valuation: MilestoneValuation;
  }>(`/milestones/${encodeURIComponent(String(milestoneDbId))}/mini-boq/`);


// ── Quality Tests ────────────────────────────────────────────────────────────

export interface QualityTestRow {
  id: string;
  project_id: string;
  test_type: string;
  sample_id: string;
  location: string;
  grade: string;
  test_date: string;
  result_date: string;
  result_value: string;
  passed: boolean | null;
  notes: string;
  photo_urls: string[];
  tested_by: string | null;
  created_at: number;
}

export const fetchQualityTests = (projectId: string) =>
  getJson<QualityTestRow[]>(`/projects/${encodeURIComponent(projectId)}/quality-tests/`);

export const createQualityTest = (projectId: string, data: Record<string, unknown>) =>
  postJson<QualityTestRow>(`/projects/${encodeURIComponent(projectId)}/quality-tests/`, data);

export const updateQualityTest = (projectId: string, testId: string, data: Record<string, unknown>) =>
  patchJson<QualityTestRow>(
    `/projects/${encodeURIComponent(projectId)}/quality-tests/${encodeURIComponent(testId)}/`,
    data,
  );

export const fetchBimModels = (projectId: string) =>
  getJson<any[]>(`/projects/${encodeURIComponent(projectId)}/bim-models/`);

export const fetchDroneDatasets = (projectId: string) =>
  getJson<any[]>(`/projects/${encodeURIComponent(projectId)}/drone-datasets/`);

export const deleteQualityTest = async (projectId: string, testId: string): Promise<void> => {
  const path = `/projects/${encodeURIComponent(projectId)}/quality-tests/${encodeURIComponent(testId)}/`;
  const res = await fetch(apiUrl(path), {
    method: "DELETE",
    headers: { ...(await authHeaders()) },
  });
  if (!res.ok) throw new ApiError(res.status, friendly(res.status));
};

// ── Tickets & Defect Management ───────────────────────────────────────────────

export interface TicketRow {
  id: string;
  project_id: string;
  milestone_id?: string;
  observation_id?: string;
  title: string;
  body: string;
  priority: "low" | "normal" | "high" | "urgent";
  status: "open" | "in_progress" | "resolved" | "closed" | "acknowledged";
  risk_level?: "low" | "medium" | "high";
  sensitivity?: "normal" | "urgent";
  due_date?: string;
  escalation_level?: number;
  created_at?: number;
}

export interface TicketCommentRow {
  id: number;
  ticket: string;
  ticket_title?: string;
  author_name?: string;
  body: string;
  attachment_url?: string;
  attachment_name?: string;
  created_at: number;
}

export const fetchTickets = (projectId: string) =>
  getJson<TicketRow[]>(`/tickets/?project_id=${encodeURIComponent(projectId)}`);

export const createTicket = (payload: {
  project_id: string;
  title: string;
  body?: string;
  priority?: string;
  risk_level?: string;
  due_date?: string;
}) => postJson<TicketRow>("/tickets/", payload);

export const updateTicketStatus = (ticketId: string, action: "acknowledge" | "resolve" | "close") =>
  postJson<TicketRow>(`/tickets/${encodeURIComponent(ticketId)}/${action}/`, {});

export const fetchTicketComments = (ticketId: string) =>
  getJson<TicketCommentRow[]>(`/ticket-comments/?ticket=${encodeURIComponent(ticketId)}`);

export const addTicketComment = (ticketId: string, body: string) =>
  postJson<TicketCommentRow>("/ticket-comments/", { ticket: ticketId, body });

