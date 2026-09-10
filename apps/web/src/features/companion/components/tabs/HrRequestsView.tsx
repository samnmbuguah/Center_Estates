"use client";

import { useMemo, useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { Badge, EmptyState, Field, KpiCard, KpiStrip, LoadingState, Modal, Panel, StatusPill } from "@/components/module-ui";
import { StaffHrRequest, StaffLeaveBalance, StaffLeaveRequest, TeamMember } from "../../types/companion.types";
import { fmtDate, fmtDateTime, toMediaUrl } from "../../utils/companion.utils";
import { EvidenceAttachmentUploader, type UploadedAttachment } from "../common/EvidenceAttachmentUploader";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  Palmtree,
  Plus,
  Search,
  ShieldCheck,
  UserCheck,
  Users,
  X,
  XCircle,
} from "lucide-react";

const LEAVE_TYPE_INFO: Record<string, { label: string; tone: "blue" | "green" | "yellow" | "purple" | "cyan" | "gray" | "red"; desc: string }> = {
  annual: { label: "Annual / Vacation Leave", tone: "blue", desc: "Standard paid vacation days accrued per annum" },
  sick: { label: "Sick Leave", tone: "red", desc: "Medical illness or recovery (attach medical slip)" },
  maternity: { label: "Maternity Leave", tone: "purple", desc: "Statutory maternity protection" },
  paternity: { label: "Paternity Leave", tone: "purple", desc: "Statutory paternity support" },
  compassionate: { label: "Compassionate Leave", tone: "yellow", desc: "Bereavement or critical family emergency" },
  study: { label: "Study / Exam Leave", tone: "cyan", desc: "Professional exams or academic requirements" },
  unpaid: { label: "Unpaid Leave", tone: "gray", desc: "Authorized unpaid absence" },
  emergency: { label: "Emergency Leave", tone: "yellow", desc: "Unforeseen urgent situational absence" },
};

const HR_TYPE_INFO: Record<string, { label: string; tone: "blue" | "green" | "yellow" | "purple" | "cyan" | "gray"; icon: string }> = {
  raise_review: { label: "Salary / Raise Review", tone: "purple", icon: "📈" },
  overtime_claim: { label: "Overtime / Shift Claim", tone: "yellow", icon: "⏱️" },
  expense_reimbursement: { label: "Expense Reimbursement", tone: "green", icon: "🧾" },
  salary_advance: { label: "Salary Advance / Loan", tone: "cyan", icon: "💰" },
  general_hr: { label: "General HR Request / Inquiry", tone: "blue", icon: "📋" },
};

export function HrRequestsView({
  leaveRequests,
  hrRequests,
  leaveBalance,
  members,
  currentUserId,
  isSuperAdmin,
  loading,
  busy,
  onCreateLeaveRequest,
  onDecideLeaveRequest,
  onCreateHrRequest,
  onDecideHrRequest,
  onUploadAttachment,
}: {
  leaveRequests: StaffLeaveRequest[];
  hrRequests: StaffHrRequest[];
  leaveBalance: StaffLeaveBalance | null;
  members: TeamMember[];
  currentUserId?: number;
  isSuperAdmin: boolean;
  loading: boolean;
  busy: boolean;
  onCreateLeaveRequest: (payload: {
    leave_type: string;
    start_date: string;
    end_date: string;
    total_days: number;
    reason: string;
    attachment_url?: string;
    relief_staff?: string;
  }) => Promise<boolean>;
  onDecideLeaveRequest: (id: string, decision: "approved" | "rejected" | "cancelled", notes?: string) => Promise<boolean>;
  onCreateHrRequest: (payload: {
    request_type: string;
    title: string;
    description: string;
    proposed_amount?: number;
    currency?: string;
    attachment_url?: string;
  }) => Promise<boolean>;
  onDecideHrRequest: (id: string, decision: "approved" | "rejected" | "under_review", notes?: string) => Promise<boolean>;
  onUploadAttachment?: (file: File) => Promise<{ url: string; name: string; size: number } | null>;
}) {
  const [activeSubTab, setActiveSubTab] = useState<"leave" | "hr" | "approvals" | "timeline">("leave");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  // Modals state
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showHrModal, setShowHrModal] = useState(false);
  const [reviewingLeave, setReviewingLeave] = useState<StaffLeaveRequest | null>(null);
  const [reviewingHr, setReviewingHr] = useState<StaffHrRequest | null>(null);
  const [previewAttachmentUrl, setPreviewAttachmentUrl] = useState<string | null>(null);

  // Form states - Leave
  const [leaveType, setLeaveType] = useState("annual");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [reliefStaff, setReliefStaff] = useState("");
  const [leaveAttachment, setLeaveAttachment] = useState<UploadedAttachment | null>(null);

  // Form states - HR
  const [hrType, setHrType] = useState("raise_review");
  const [hrTitle, setHrTitle] = useState("");
  const [hrDescription, setHrDescription] = useState("");
  const [hrAmount, setHrAmount] = useState("");
  const [hrCurrency, setHrCurrency] = useState("KES");
  const [hrAttachment, setHrAttachment] = useState<UploadedAttachment | null>(null);

  // Decision Modal state
  const [decisionAction, setDecisionAction] = useState<"approved" | "rejected" | "under_review">("approved");
  const [decisionNotes, setDecisionNotes] = useState("");

  // Calculate calculated working days
  const calculatedDays = useMemo(() => {
    if (!startDate || !endDate) return 1;
    const s = new Date(startDate);
    const e = new Date(endDate);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return 1;
    let count = 0;
    const cur = new Date(s);
    while (cur <= e) {
      const day = cur.getDay();
      // Count weekdays Monday to Friday (or full count)
      if (day !== 0 && day !== 6) {
        count += 1;
      }
      cur.setDate(cur.getDate() + 1);
    }
    return count > 0 ? count : 1;
  }, [startDate, endDate]);

  // Filtered leave list
  const filteredLeave = useMemo(() => {
    return leaveRequests.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (typeFilter !== "all" && r.leave_type !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          r.reference?.toLowerCase().includes(q) ||
          r.requester_name?.toLowerCase().includes(q) ||
          r.reason?.toLowerCase().includes(q) ||
          r.relief_staff_name?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [leaveRequests, statusFilter, typeFilter, search]);

  // Filtered HR list
  const filteredHr = useMemo(() => {
    return hrRequests.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (typeFilter !== "all" && r.request_type !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          r.reference?.toLowerCase().includes(q) ||
          r.requester_name?.toLowerCase().includes(q) ||
          r.title?.toLowerCase().includes(q) ||
          r.description?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [hrRequests, statusFilter, typeFilter, search]);

  // Pending counts
  const pendingLeaveCount = useMemo(() => leaveRequests.filter((r) => r.status === "pending").length, [leaveRequests]);
  const pendingHrCount = useMemo(() => hrRequests.filter((r) => r.status === "pending" || r.status === "under_review").length, [hrRequests]);
  const totalPendingApprovals = pendingLeaveCount + pendingHrCount;

  // Active on-leave team members
  const onLeaveStaff = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return leaveRequests.filter(
      (r) => r.status === "approved" && r.start_date <= today && r.end_date >= today
    );
  }, [leaveRequests]);

  async function handleSubmitLeave(e: React.FormEvent) {
    e.preventDefault();
    if (!startDate || !endDate || !leaveReason.trim()) return;
    const ok = await onCreateLeaveRequest({
      leave_type: leaveType,
      start_date: startDate,
      end_date: endDate,
      total_days: calculatedDays,
      reason: leaveReason.trim(),
      attachment_url: leaveAttachment?.url || "",
      relief_staff: reliefStaff || undefined,
    });
    if (ok) {
      setShowLeaveModal(false);
      setLeaveReason("");
      setStartDate("");
      setEndDate("");
      setReliefStaff("");
      setLeaveAttachment(null);
    }
  }

  async function handleSubmitHr(e: React.FormEvent) {
    e.preventDefault();
    if (!hrTitle.trim() || !hrDescription.trim()) return;
    const ok = await onCreateHrRequest({
      request_type: hrType,
      title: hrTitle.trim(),
      description: hrDescription.trim(),
      proposed_amount: hrAmount ? parseFloat(hrAmount) : undefined,
      currency: hrCurrency,
      attachment_url: hrAttachment?.url || "",
    });
    if (ok) {
      setShowHrModal(false);
      setHrTitle("");
      setHrDescription("");
      setHrAmount("");
      setHrAttachment(null);
    }
  }

  async function handleConfirmLeaveDecision() {
    if (!reviewingLeave) return;
    const ok = await onDecideLeaveRequest(
      reviewingLeave.id,
      decisionAction === "under_review" ? "approved" : decisionAction,
      decisionNotes
    );
    if (ok) {
      setReviewingLeave(null);
      setDecisionNotes("");
    }
  }

  async function handleConfirmHrDecision() {
    if (!reviewingHr) return;
    const ok = await onDecideHrRequest(reviewingHr.id, decisionAction, decisionNotes);
    if (ok) {
      setReviewingHr(null);
      setDecisionNotes("");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ═══ KPI SUMMARY STRIP ═══════════════════════════════════════════ */}
      <KpiStrip>
        <KpiCard
          icon="🌴"
          label="My Available Leave Balance"
          value={
            leaveBalance
              ? `${leaveBalance.remaining_days.toFixed(1)} / ${leaveBalance.total_entitlement.toFixed(0)} Days`
              : "21.0 / 21.0 Days"
          }
          sub={
            leaveBalance
              ? `${leaveBalance.taken_days.toFixed(1)} days taken this year`
              : "21 days standard entitlement"
          }
          iconBg="rgba(16, 185, 129, 0.12)"
          iconColor="var(--color-emerald)"
        />
        <KpiCard
          icon="⏳"
          label="Pending Approvals"
          value={String(totalPendingApprovals)}
          sub={`${pendingLeaveCount} leave, ${pendingHrCount} HR requests`}
          iconBg="rgba(245, 158, 11, 0.12)"
          iconColor="var(--color-amber)"
          borderColor={totalPendingApprovals > 0 ? "var(--warning)" : undefined}
        />
        <KpiCard
          icon="📅"
          label="Approved Leave Days Taken"
          value={leaveBalance ? `${leaveBalance.taken_days.toFixed(1)} Days` : "0.0 Days"}
          sub={leaveBalance?.pending_days ? `${leaveBalance.pending_days.toFixed(1)} days pending review` : "No pending days"}
          iconBg="rgba(59, 130, 246, 0.12)"
          iconColor="var(--color-blue)"
        />
        <KpiCard
          icon="👥"
          label="Active Staff On Leave Today"
          value={String(onLeaveStaff.length)}
          sub={onLeaveStaff.length > 0 ? onLeaveStaff.map((s) => s.requester_name).join(", ") : "All staff on duty"}
          iconBg="rgba(139, 92, 246, 0.12)"
          iconColor="var(--color-violet-strong)"
        />
      </KpiStrip>

      {/* ═══ ACTIONS BAR & SUB-NAVIGATION ════════════════════════════════ */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          padding: "10px 14px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 10,
        }}
      >
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button
            type="button"
            className={`btn sm ${activeSubTab === "leave" ? "primary" : "ghost"}`}
            onClick={() => {
              setActiveSubTab("leave");
              setStatusFilter("all");
              setTypeFilter("all");
            }}
          >
            <Palmtree size={14} /> Leave Applications ({leaveRequests.length})
          </button>
          <button
            type="button"
            className={`btn sm ${activeSubTab === "hr" ? "primary" : "ghost"}`}
            onClick={() => {
              setActiveSubTab("hr");
              setStatusFilter("all");
              setTypeFilter("all");
            }}
          >
            <FileText size={14} /> Salary & HR Requests ({hrRequests.length})
          </button>
          {isSuperAdmin && (
            <button
              type="button"
              className={`btn sm ${activeSubTab === "approvals" ? "primary" : "ghost"}`}
              onClick={() => {
                setActiveSubTab("approvals");
                setStatusFilter("pending");
                setTypeFilter("all");
              }}
              style={{ position: "relative" }}
            >
              <ShieldCheck size={14} /> Management Approval Console
              {totalPendingApprovals > 0 && (
                <span
                  style={{
                    marginLeft: 6,
                    background: "var(--color-danger)",
                    color: "#fff",
                    borderRadius: 10,
                    padding: "1px 6px",
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                >
                  {totalPendingApprovals}
                </span>
              )}
            </button>
          )}
          <button
            type="button"
            className={`btn sm ${activeSubTab === "timeline" ? "primary" : "ghost"}`}
            onClick={() => setActiveSubTab("timeline")}
          >
            <Calendar size={14} /> Team Absence Timeline
          </button>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="btn primary sm"
            style={{ background: "var(--color-info)", borderColor: "var(--color-info)" }}
            onClick={() => setShowLeaveModal(true)}
          >
            <Plus size={14} /> Request Leave
          </button>
          <button
            type="button"
            className="btn primary sm"
            style={{ background: "var(--color-violet)", borderColor: "var(--color-violet)" }}
            onClick={() => setShowHrModal(true)}
          >
            <Plus size={14} /> Submit HR / Raise Request
          </button>
        </div>
      </div>

      {/* ═══ FILTER CONTROLS ════════════════════════════════════════════ */}
      {activeSubTab !== "timeline" && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative", minWidth: 240, flex: 1 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
            <input
              type="text"
              placeholder="Search by staff name, reference (LV-1234), reason..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input"
              style={{ paddingLeft: 30, width: "100%", height: 36, fontSize: 13 }}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input"
            style={{ height: 36, fontSize: 13, minWidth: 140 }}
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending Approval</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="under_review">Under Review</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {activeSubTab === "leave" && (
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="input"
              style={{ height: 36, fontSize: 13, minWidth: 160 }}
            >
              <option value="all">All Leave Types</option>
              {Object.entries(LEAVE_TYPE_INFO).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          )}

          {activeSubTab === "hr" && (
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="input"
              style={{ height: 36, fontSize: 13, minWidth: 160 }}
            >
              <option value="all">All HR Types</option>
              {Object.entries(HR_TYPE_INFO).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.icon} {v.label}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* ═══ TAB 1: LEAVE APPLICATIONS ══════════════════════════════════ */}
      {activeSubTab === "leave" && (
        <Panel title={`Staff Leave Register (${filteredLeave.length})`}>
          {loading ? (
            <LoadingState rows={4} />
          ) : filteredLeave.length === 0 ? (
            <EmptyState
              icon="🌴"
              title="No Leave Applications Found"
              description="No leave requests match the selected filters. Click 'Request Leave' to apply for time off."
              action={
                <button type="button" className="btn primary sm" onClick={() => setShowLeaveModal(true)}>
                  <Plus size={14} /> Request Leave
                </button>
              }
            />
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left", background: "var(--surface-2)" }}>
                    <th style={{ padding: "10px 12px", width: "12%" }}>Ref & Requester</th>
                    <th style={{ padding: "10px 12px", width: "20%" }}>Leave Type</th>
                    <th style={{ padding: "10px 12px", width: "18%" }}>Dates & Duration</th>
                    <th style={{ padding: "10px 12px", width: "22%" }}>Reason & Handover</th>
                    <th style={{ padding: "10px 12px", width: "14%" }}>Status & Decision</th>
                    <th style={{ padding: "10px 12px", width: "14%", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeave.map((r) => {
                    const info = LEAVE_TYPE_INFO[r.leave_type] || { label: r.leave_type_display, tone: "blue" };
                    return (
                      <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "10px 12px" }}>
                          <div style={{ fontWeight: 700, color: "var(--primary)" }}>{r.reference}</div>
                          <div style={{ fontWeight: 600, color: "var(--text)", marginTop: 2 }}>{r.requester_name}</div>
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>@{r.requester_username}</div>
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <Badge tone={info.tone}>{info.label}</Badge>
                          {r.attachment_url && (
                            <div style={{ marginTop: 4 }}>
                              <a
                                href={toMediaUrl(r.attachment_url)}
                                target="_blank"
                                rel="noreferrer"
                                style={{ fontSize: 11, color: "var(--primary)", display: "inline-flex", alignItems: "center", gap: 3, textDecoration: "none" }}
                              >
                                📎 Medical/Slip Attachment <ExternalLink size={10} />
                              </a>
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <div style={{ fontWeight: 600 }}>
                            {fmtDate(r.start_date)} &rarr; {fmtDate(r.end_date)}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2, fontWeight: 700 }}>
                            🌴 {r.total_days} Working {Number(r.total_days) === 1 ? "Day" : "Days"}
                          </div>
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <div style={{ color: "var(--text)", lineHeight: 1.4 }}>{r.reason}</div>
                          {r.relief_staff_name && (
                            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                              <UserCheck size={11} /> Handover to: <strong>{r.relief_staff_name}</strong>
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <StatusPill
                            tone={
                              r.status === "approved"
                                ? "green"
                                : r.status === "pending"
                                ? "yellow"
                                : r.status === "rejected"
                                ? "red"
                                : "gray"
                            }
                          >
                            {r.status_display}
                          </StatusPill>
                          {r.decided_at && (
                            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
                              By {r.decided_by_name} ({fmtDate(r.decided_at)})
                            </div>
                          )}
                          {r.decision_notes && (
                            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2, fontStyle: "italic" }}>
                              &ldquo;{r.decision_notes}&rdquo;
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right" }}>
                          {isSuperAdmin && r.status === "pending" ? (
                            <button
                              type="button"
                              className="btn primary sm"
                              style={{ background: "var(--color-emerald-strong)", borderColor: "var(--color-emerald-strong)" }}
                              onClick={() => {
                                setReviewingLeave(r);
                                setDecisionAction("approved");
                                setDecisionNotes("");
                              }}
                            >
                              <ShieldCheck size={12} /> Review
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn ghost sm"
                              onClick={() => {
                                setReviewingLeave(r);
                                setDecisionAction(r.status === "pending" ? "approved" : (r.status as any));
                                setDecisionNotes(r.decision_notes || "");
                              }}
                            >
                              <Eye size={12} /> View
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {/* ═══ TAB 2: HR, SALARY & MISCELLANEOUS REQUESTS ═══════════════════ */}
      {activeSubTab === "hr" && (
        <Panel title={`Salary & HR Requests Register (${filteredHr.length})`}>
          {loading ? (
            <LoadingState rows={4} />
          ) : filteredHr.length === 0 ? (
            <EmptyState
              icon="💼"
              title="No HR Requests Found"
              description="No salary review or miscellaneous HR requests found. Click 'Submit HR / Raise Request' to create one."
              action={
                <button type="button" className="btn primary sm" onClick={() => setShowHrModal(true)}>
                  <Plus size={14} /> Submit HR Request
                </button>
              }
            />
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left", background: "var(--surface-2)" }}>
                    <th style={{ padding: "10px 12px", width: "14%" }}>Ref & Requester</th>
                    <th style={{ padding: "10px 12px", width: "20%" }}>Request Type</th>
                    <th style={{ padding: "10px 12px", width: "26%" }}>Title & Justification</th>
                    <th style={{ padding: "10px 12px", width: "14%" }}>Proposed Amount</th>
                    <th style={{ padding: "10px 12px", width: "14%" }}>Status & Review</th>
                    <th style={{ padding: "10px 12px", width: "12%", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHr.map((r) => {
                    const info = HR_TYPE_INFO[r.request_type] || { label: r.request_type_display, tone: "blue", icon: "📋" };
                    return (
                      <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "10px 12px" }}>
                          <div style={{ fontWeight: 700, color: "var(--primary)" }}>{r.reference}</div>
                          <div style={{ fontWeight: 600, color: "var(--text)", marginTop: 2 }}>{r.requester_name}</div>
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>@{r.requester_username}</div>
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <Badge tone={info.tone as any}>
                            {info.icon} {info.label}
                          </Badge>
                          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>Submitted {fmtDate(r.created_at)}</div>
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <div style={{ fontWeight: 700, color: "var(--text)" }}>{r.title}</div>
                          <div style={{ color: "var(--text-secondary)", marginTop: 2, fontSize: 12, lineHeight: 1.4 }}>
                            {r.description}
                          </div>
                          {r.attachment_url && (
                            <div style={{ marginTop: 4 }}>
                              <a
                                href={toMediaUrl(r.attachment_url)}
                                target="_blank"
                                rel="noreferrer"
                                style={{ fontSize: 11, color: "var(--primary)", display: "inline-flex", alignItems: "center", gap: 3, textDecoration: "none" }}
                              >
                                📎 Supporting Document <ExternalLink size={10} />
                              </a>
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          {r.proposed_amount ? (
                            <div style={{ fontWeight: 700, color: "var(--primary)", fontSize: 14 }}>
                              {r.currency} {Number(r.proposed_amount).toLocaleString()}
                            </div>
                          ) : (
                            <span style={{ color: "var(--muted)", fontSize: 12 }}>N/A (Non-monetary)</span>
                          )}
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <StatusPill
                            tone={
                              r.status === "approved"
                                ? "green"
                                : r.status === "pending"
                                ? "yellow"
                                : r.status === "under_review"
                                ? "blue"
                                : "red"
                            }
                          >
                            {r.status_display}
                          </StatusPill>
                          {r.decision_notes && (
                            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4, fontStyle: "italic" }}>
                              &ldquo;{r.decision_notes}&rdquo;
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right" }}>
                          {isSuperAdmin && (r.status === "pending" || r.status === "under_review") ? (
                            <button
                              type="button"
                              className="btn primary sm"
                              style={{ background: "var(--color-violet)", borderColor: "var(--color-violet)" }}
                              onClick={() => {
                                setReviewingHr(r);
                                setDecisionAction("approved");
                                setDecisionNotes("");
                              }}
                            >
                              <ShieldCheck size={12} /> Decide
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn ghost sm"
                              onClick={() => {
                                setReviewingHr(r);
                                setDecisionAction(r.status as any);
                                setDecisionNotes(r.decision_notes || "");
                              }}
                            >
                              <Eye size={12} /> View
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {/* ═══ TAB 3: MANAGEMENT APPROVAL CONSOLE (ADMIN ONLY) ══════════════ */}
      {activeSubTab === "approvals" && isSuperAdmin && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Panel title={`Pending Leave Approvals Queue (${pendingLeaveCount})`}>
            {pendingLeaveCount === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>
                <CheckCircle2 size={32} style={{ color: "var(--color-emerald)", margin: "0 auto 8px" }} />
                <div style={{ fontWeight: 600 }}>All Leave Applications are Reviewed!</div>
                <div style={{ fontSize: 12 }}>No pending leave requests requiring decision.</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {leaveRequests
                  .filter((r) => r.status === "pending")
                  .map((r) => (
                    <div
                      key={r.id}
                      style={{
                        padding: 14,
                        borderRadius: 8,
                        background: "var(--surface-2)",
                        border: "1px solid var(--border)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 12,
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontWeight: 700, color: "var(--primary)" }}>{r.reference}</span>
                          <span style={{ fontWeight: 600 }}>{r.requester_name}</span>
                          <Badge tone="yellow">Pending Decision</Badge>
                          <Badge tone="blue">{r.leave_type_display}</Badge>
                        </div>
                        <div style={{ fontSize: 13, marginTop: 4, color: "var(--text)" }}>
                          <strong>Duration:</strong> {fmtDate(r.start_date)} &rarr; {fmtDate(r.end_date)} (
                          <strong>{r.total_days} days</strong>)
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                          <strong>Reason:</strong> {r.reason}
                        </div>
                        {r.relief_staff_name && (
                          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                            Covered by colleague: {r.relief_staff_name}
                          </div>
                        )}
                        {r.attachment_url && (
                          <div style={{ marginTop: 4 }}>
                            <a
                              href={toMediaUrl(r.attachment_url)}
                              target="_blank"
                              rel="noreferrer"
                              style={{ fontSize: 11, color: "var(--primary)", textDecoration: "none" }}
                            >
                              📎 View Attached Medical / Doctor Note ↗
                            </a>
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          className="btn primary sm"
                          style={{ background: "var(--color-emerald-strong)", borderColor: "var(--color-emerald-strong)" }}
                          onClick={() => {
                            setReviewingLeave(r);
                            setDecisionAction("approved");
                            setDecisionNotes("");
                          }}
                        >
                          ✓ Approve Leave
                        </button>
                        <button
                          type="button"
                          className="btn ghost sm"
                          style={{ color: "var(--color-danger)" }}
                          onClick={() => {
                            setReviewingLeave(r);
                            setDecisionAction("rejected");
                            setDecisionNotes("");
                          }}
                        >
                          ✕ Reject
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </Panel>

          <Panel title={`Pending Salary & HR Requests Queue (${pendingHrCount})`}>
            {pendingHrCount === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>
                <CheckCircle2 size={32} style={{ color: "var(--color-emerald)", margin: "0 auto 8px" }} />
                <div style={{ fontWeight: 600 }}>All HR & Salary Requests are Reviewed!</div>
                <div style={{ fontSize: 12 }}>No pending items requiring attention.</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {hrRequests
                  .filter((r) => r.status === "pending" || r.status === "under_review")
                  .map((r) => (
                    <div
                      key={r.id}
                      style={{
                        padding: 14,
                        borderRadius: 8,
                        background: "var(--surface-2)",
                        border: "1px solid var(--border)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 12,
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontWeight: 700, color: "var(--primary)" }}>{r.reference}</span>
                          <span style={{ fontWeight: 600 }}>{r.requester_name}</span>
                          <Badge tone="purple">{r.request_type_display}</Badge>
                          {r.proposed_amount && (
                            <Badge tone="green">
                              {r.currency} {Number(r.proposed_amount).toLocaleString()}
                            </Badge>
                          )}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4, color: "var(--text)" }}>{r.title}</div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{r.description}</div>
                        {r.attachment_url && (
                          <div style={{ marginTop: 4 }}>
                            <a
                              href={toMediaUrl(r.attachment_url)}
                              target="_blank"
                              rel="noreferrer"
                              style={{ fontSize: 11, color: "var(--primary)", textDecoration: "none" }}
                            >
                              📎 View Attached Documents ↗
                            </a>
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          className="btn primary sm"
                          style={{ background: "var(--color-violet)", borderColor: "var(--color-violet)" }}
                          onClick={() => {
                            setReviewingHr(r);
                            setDecisionAction("approved");
                            setDecisionNotes("");
                          }}
                        >
                          ✓ Review & Decide
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </Panel>
        </div>
      )}

      {/* ═══ TAB 4: TEAM ABSENCE TIMELINE ═════════════════════════════════ */}
      {activeSubTab === "timeline" && (
        <Panel title="Team Absence & Scheduled Leave Timeline">
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ padding: "12px 16px", background: "var(--surface-2)", borderRadius: 8, fontSize: 13 }}>
              <strong>🗓️ Live Out-of-Office Board:</strong> View scheduled team absences to plan field coverage and handovers.
            </div>

            {leaveRequests.filter((r) => r.status === "approved").length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>
                <Users size={32} style={{ margin: "0 auto 8px", opacity: 0.5 }} />
                <div>No upcoming scheduled leaves recorded. All staff members are active on duty.</div>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                {leaveRequests
                  .filter((r) => r.status === "approved")
                  .map((r) => {
                    const today = new Date().toISOString().slice(0, 10);
                    const isCurrentlyActive = r.start_date <= today && r.end_date >= today;
                    return (
                      <div
                        key={r.id}
                        style={{
                          padding: 14,
                          borderRadius: 8,
                          background: isCurrentlyActive ? "rgba(124, 58, 237, 0.06)" : "var(--surface)",
                          border: isCurrentlyActive ? "1px solid var(--color-violet)" : "1px solid var(--border)",
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontWeight: 700, fontSize: 14 }}>{r.requester_name}</span>
                          {isCurrentlyActive ? (
                            <Badge tone="purple">🌴 On Leave Today</Badge>
                          ) : (
                            <Badge tone="blue">Scheduled</Badge>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                          <strong>{r.leave_type_display}</strong> &bull; {r.total_days} days
                        </div>
                        <div style={{ fontSize: 12, color: "var(--muted)" }}>
                          📅 {fmtDate(r.start_date)} &rarr; {fmtDate(r.end_date)}
                        </div>
                        {r.relief_staff_name && (
                          <div style={{ fontSize: 11, color: "var(--primary)", marginTop: 4 }}>
                            👤 Coverage by: <strong>{r.relief_staff_name}</strong>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </Panel>
      )}

      {/* ═══ MODAL: REQUEST LEAVE ═════════════════════════════════════════ */}
      {showLeaveModal && (
        <Modal title="🌴 Request Staff Leave / Time Off" onClose={() => setShowLeaveModal(false)} wide>
          <form onSubmit={handleSubmitLeave} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Leave Type">
              <select
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value)}
                className="input"
                style={{ width: "100%" }}
                required
              >
                {Object.entries(LEAVE_TYPE_INFO).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label} — {v.desc}
                  </option>
                ))}
              </select>
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Start Date">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="input"
                  style={{ width: "100%" }}
                  required
                />
              </Field>
              <Field label="End Date">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="input"
                  style={{ width: "100%" }}
                  required
                />
              </Field>
            </div>

            <div
              style={{
                padding: "8px 12px",
                background: "var(--surface-2)",
                borderRadius: 6,
                fontSize: 12,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>Calculated Working Days:</span>
              <strong style={{ fontSize: 14, color: "var(--primary)" }}>{calculatedDays} Working Days</strong>
            </div>

            <Field label="Handover / Relief Colleague (Optional)">
              <select
                value={reliefStaff}
                onChange={(e) => setReliefStaff(e.target.value)}
                className="input"
                style={{ width: "100%" }}
              >
                <option value="">-- No designated relief --</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.full_name} (@{m.username})
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Reason / Notes for Absence">
              <textarea
                value={leaveReason}
                onChange={(e) => setLeaveReason(e.target.value)}
                placeholder="Detail the reason for leave, emergency handover instructions, or medical situation..."
                className="input"
                style={{ width: "100%", minHeight: 80 }}
                required
              />
            </Field>

            {onUploadAttachment && (
              <Field label="Medical Certificate / Supporting Document (Optional)">
                <EvidenceAttachmentUploader
                  attachment={leaveAttachment}
                  onUpload={onUploadAttachment}
                  onChange={setLeaveAttachment}
                />
              </Field>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
              <button type="button" className="btn ghost" onClick={() => setShowLeaveModal(false)}>
                Cancel
              </button>
              <button type="submit" className="btn primary" disabled={busy}>
                {busy ? "Submitting..." : "Submit Leave Application"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ═══ MODAL: SUBMIT HR / SALARY REQUEST ═════════════════════════════ */}
      {showHrModal && (
        <Modal title="💼 Submit Salary / Raise or HR Request" onClose={() => setShowHrModal(false)} wide>
          <form onSubmit={handleSubmitHr} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Request Category">
              <select
                value={hrType}
                onChange={(e) => setHrType(e.target.value)}
                className="input"
                style={{ width: "100%" }}
                required
              >
                {Object.entries(HR_TYPE_INFO).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.icon} {v.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Request Subject / Title">
              <input
                type="text"
                value={hrTitle}
                onChange={(e) => setHrTitle(e.target.value)}
                placeholder="e.g. Annual Salary Review Request, Overtime Weekend Shift Claim..."
                className="input"
                style={{ width: "100%" }}
                required
              />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
              <Field label="Currency">
                <input
                  type="text"
                  value={hrCurrency}
                  onChange={(e) => setHrCurrency(e.target.value)}
                  className="input"
                  style={{ width: "100%" }}
                />
              </Field>
              <Field label="Proposed Amount (If applicable)">
                <input
                  type="number"
                  step="0.01"
                  value={hrAmount}
                  onChange={(e) => setHrAmount(e.target.value)}
                  placeholder="e.g. 75000.00"
                  className="input"
                  style={{ width: "100%" }}
                />
              </Field>
            </div>

            <Field label="Detailed Justification & Narrative">
              <textarea
                value={hrDescription}
                onChange={(e) => setHrDescription(e.target.value)}
                placeholder="Provide complete business justification, performance achievements, date breakdown, or HR inquiry details..."
                className="input"
                style={{ width: "100%", minHeight: 110 }}
                required
              />
            </Field>

            {onUploadAttachment && (
              <Field label="Supporting Invoices / Documents (Optional)">
                <EvidenceAttachmentUploader
                  attachment={hrAttachment}
                  onUpload={onUploadAttachment}
                  onChange={setHrAttachment}
                />
              </Field>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
              <button type="button" className="btn ghost" onClick={() => setShowHrModal(false)}>
                Cancel
              </button>
              <button type="submit" className="btn primary" disabled={busy}>
                {busy ? "Submitting..." : "Submit HR Request"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ═══ MODAL: REVIEW LEAVE REQUEST (ADMIN) ═════════════════════════ */}
      {reviewingLeave && (
        <Modal
          title={`🔎 Review Leave Request — ${reviewingLeave.reference}`}
          onClose={() => setReviewingLeave(null)}
          wide
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, background: "var(--surface-2)", padding: 12, borderRadius: 8 }}>
              <div>
                <span style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Requester</span>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{reviewingLeave.requester_name}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>@{reviewingLeave.requester_username}</div>
              </div>
              <div>
                <span style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Leave Type</span>
                <div>
                  <Badge tone="blue">{reviewingLeave.leave_type_display}</Badge>
                </div>
              </div>
              <div>
                <span style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Requested Dates</span>
                <div style={{ fontWeight: 600 }}>
                  {fmtDate(reviewingLeave.start_date)} &rarr; {fmtDate(reviewingLeave.end_date)}
                </div>
                <div style={{ fontSize: 12, color: "var(--primary)", fontWeight: 700 }}>
                  {reviewingLeave.total_days} Working Days
                </div>
              </div>
              <div>
                <span style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Handover / Relief</span>
                <div style={{ fontWeight: 600 }}>{reviewingLeave.relief_staff_name || "None designated"}</div>
              </div>
            </div>

            <div>
              <span style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Absence Reason</span>
              <div style={{ padding: 10, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, marginTop: 4, fontSize: 13, lineHeight: 1.4 }}>
                {reviewingLeave.reason}
              </div>
            </div>

            {reviewingLeave.attachment_url && (
              <div>
                <span style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Attachment</span>
                <div style={{ marginTop: 4 }}>
                  <a
                    href={toMediaUrl(reviewingLeave.attachment_url)}
                    target="_blank"
                    rel="noreferrer"
                    className="btn ghost sm"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    📎 View Attached Medical / Doctor Certificate <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            )}

            {isSuperAdmin && reviewingLeave.status === "pending" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                <Field label="Management Decision">
                  <div style={{ display: "flex", gap: 10 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="leaveDecision"
                        value="approved"
                        checked={decisionAction === "approved"}
                        onChange={() => setDecisionAction("approved")}
                      />
                      <span style={{ color: "var(--color-emerald)", fontWeight: 700 }}>✓ Approve Leave</span>
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="leaveDecision"
                        value="rejected"
                        checked={decisionAction === "rejected"}
                        onChange={() => setDecisionAction("rejected")}
                      />
                      <span style={{ color: "var(--color-danger)", fontWeight: 700 }}>✕ Reject Leave</span>
                    </label>
                  </div>
                </Field>

                <Field label="Decision Notes & Remarks (Shared with staff)">
                  <textarea
                    value={decisionNotes}
                    onChange={(e) => setDecisionNotes(e.target.value)}
                    placeholder="Enter approval comments, handover instructions, or reason for rejection..."
                    className="input"
                    style={{ width: "100%", minHeight: 60 }}
                  />
                </Field>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                  <button type="button" className="btn ghost" onClick={() => setReviewingLeave(null)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn primary"
                    style={{
                      background: decisionAction === "approved" ? "var(--color-emerald-strong)" : "var(--color-danger)",
                      borderColor: decisionAction === "approved" ? "var(--color-emerald-strong)" : "var(--color-danger)",
                    }}
                    onClick={handleConfirmLeaveDecision}
                    disabled={busy}
                  >
                    {busy ? "Saving..." : `Confirm Decision: ${decisionAction.toUpperCase()}`}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                <button type="button" className="btn ghost" onClick={() => setReviewingLeave(null)}>
                  Close
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ═══ MODAL: REVIEW HR REQUEST (ADMIN) ═════════════════════════════ */}
      {reviewingHr && (
        <Modal
          title={`🔎 Review HR Request — ${reviewingHr.reference}`}
          onClose={() => setReviewingHr(null)}
          wide
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, background: "var(--surface-2)", padding: 12, borderRadius: 8 }}>
              <div>
                <span style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Requester</span>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{reviewingHr.requester_name}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>@{reviewingHr.requester_username}</div>
              </div>
              <div>
                <span style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Request Type</span>
                <div>
                  <Badge tone="purple">{reviewingHr.request_type_display}</Badge>
                </div>
              </div>
              <div>
                <span style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Proposed Amount</span>
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--primary)" }}>
                  {reviewingHr.proposed_amount ? `${reviewingHr.currency} ${Number(reviewingHr.proposed_amount).toLocaleString()}` : "N/A"}
                </div>
              </div>
              <div>
                <span style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Current Status</span>
                <div>
                  <StatusPill tone={reviewingHr.status === "approved" ? "green" : reviewingHr.status === "under_review" ? "blue" : reviewingHr.status === "pending" ? "yellow" : "red"}>
                    {reviewingHr.status_display}
                  </StatusPill>
                </div>
              </div>
            </div>

            <div>
              <span style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Subject / Title</span>
              <div style={{ fontWeight: 700, fontSize: 14, marginTop: 2 }}>{reviewingHr.title}</div>
            </div>

            <div>
              <span style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Narrative & Details</span>
              <div style={{ padding: 10, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, marginTop: 4, fontSize: 13, lineHeight: 1.4 }}>
                {reviewingHr.description}
              </div>
            </div>

            {reviewingHr.attachment_url && (
              <div>
                <span style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Supporting Document</span>
                <div style={{ marginTop: 4 }}>
                  <a
                    href={toMediaUrl(reviewingHr.attachment_url)}
                    target="_blank"
                    rel="noreferrer"
                    className="btn ghost sm"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    📎 View Attached Proposal / Invoice <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            )}

            {isSuperAdmin && (reviewingHr.status === "pending" || reviewingHr.status === "under_review") ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                <Field label="Management Decision">
                  <div style={{ display: "flex", gap: 12 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="hrDecision"
                        value="approved"
                        checked={decisionAction === "approved"}
                        onChange={() => setDecisionAction("approved")}
                      />
                      <span style={{ color: "var(--color-emerald)", fontWeight: 700 }}>✓ Approve Request</span>
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="hrDecision"
                        value="under_review"
                        checked={decisionAction === "under_review"}
                        onChange={() => setDecisionAction("under_review")}
                      />
                      <span style={{ color: "var(--color-blue)", fontWeight: 700 }}>⏳ Under Consideration</span>
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="hrDecision"
                        value="rejected"
                        checked={decisionAction === "rejected"}
                        onChange={() => setDecisionAction("rejected")}
                      />
                      <span style={{ color: "var(--color-danger)", fontWeight: 700 }}>✕ Reject Request</span>
                    </label>
                  </div>
                </Field>

                <Field label="Decision Notes & Feedback">
                  <textarea
                    value={decisionNotes}
                    onChange={(e) => setDecisionNotes(e.target.value)}
                    placeholder="Enter management notes, agreed salary adjustments, disbursement instructions, or rationale..."
                    className="input"
                    style={{ width: "100%", minHeight: 60 }}
                  />
                </Field>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                  <button type="button" className="btn ghost" onClick={() => setReviewingHr(null)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn primary"
                    style={{
                      background: decisionAction === "approved" ? "var(--color-emerald-strong)" : decisionAction === "under_review" ? "var(--color-info)" : "var(--color-danger)",
                      borderColor: decisionAction === "approved" ? "var(--color-emerald-strong)" : decisionAction === "under_review" ? "var(--color-info)" : "var(--color-danger)",
                    }}
                    onClick={handleConfirmHrDecision}
                    disabled={busy}
                  >
                    {busy ? "Saving..." : `Confirm Decision: ${decisionAction.toUpperCase().replace('_', ' ')}`}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                <button type="button" className="btn ghost" onClick={() => setReviewingHr(null)}>
                  Close
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
