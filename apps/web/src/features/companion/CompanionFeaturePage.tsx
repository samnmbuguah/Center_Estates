"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { ModuleShell } from "@/components/module-shell";
import { companionNav } from "@/lib/module-nav";
import { DetailDrawer, ErrorBanner, Field, Modal, StatusPill } from "@/components/module-ui";
import { ModuleCalendarView, ModuleTicketsView } from "@/components/module-activity";
import { useCompanionLogic } from "./hooks/useCompanionLogic";
import { usePermissions } from "@/hooks/usePermissions";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { OverviewView } from "./components/tabs/OverviewView";
import { QuartermasterView } from "./components/tabs/QuartermasterView";
import { TeamDialogueView } from "./components/tabs/TeamDialogueView";
import { TasksView } from "./components/tabs/TasksView";
import { TemplatesView } from "./components/tabs/TemplatesView";
import { PerformanceView } from "./components/tabs/PerformanceView";
import { MeterReadingsView } from "./components/tabs/MeterReadingsView";
import { TeamRemindersDialog } from "./components/TeamRemindersDialog";
import {
  AssignTaskModal,
  CompleteTaskModal,
  CreateFeedbackModal,
  CreateTemplateModal,
  DelegateTaskModal,
} from "./components/modals/CompanionModals";
import { HrRequestsView } from "./components/tabs/HrRequestsView";
import { ChecklistItem, CompanionTab, Row } from "./types/companion.types";
import { fmtDate, fmtDateTime, STATUS_TONE, toMediaUrl } from "./utils/companion.utils";

export function CompanionFeaturePage({ initialTab = "overview", caretakerMode = false }: { initialTab?: CompanionTab; caretakerMode?: boolean }) {
  const { session } = useAuth();
  const permissions = usePermissions();
  const {
    tab,
    setTab,
    loading,
    error,
    msg,
    setMsg,
    busy,
    isSuperAdmin,
    activeProperty,
    dash,
    rows,
    templates,
    staff,
    members,
    properties,
    roles,
    staffOptions,
    threads,
    activeThread,
    setActiveThread,
    leaveRequests,
    hrRequests,
    leaveBalance,
    handleCreateLeaveRequest,
    handleDecideLeaveRequest,
    handleCreateHrRequest,
    handleDecideHrRequest,
    search,
    setSearch,
    categoryFilter,
    setCategoryFilter,
    statusFilter,
    setStatusFilter,
    selectedTask,
    setSelectedTask,
    delegateTarget,
    setDelegateTarget,
    readingMeter,
    setReadingMeter,
    staffDetail,
    setStaffDetail,
    showAssign,
    setShowAssign,
    showTemplate,
    setShowTemplate,
    showNewThread,
    setShowNewThread,
    aiPrompt,
    setAiPrompt,
    aiLoading,
    aiError,
    aiMessages,
    setAiMessages,
    aiResponse,
    setAiResponse,
    aiConversations,
    aiConversationId,
    selectAiConversation,
    archiveAiConversation,
    sendAiPrompt,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    dateFilter,
    setDateFilter,
    load,
    loadMembers,
    uploadAttachment,
    handleCreateFeedback,
    handleReplyFeedback,
    handleUpdateThreadStatus,
    handleAssignTask,
    handleCreateTemplate,
    handleDelegateTask,
    handleUpdateChecklist,
    handleCompleteTaskWithEvidence,
    runTaskAction,
  } = useCompanionLogic(initialTab);

  const [completingTask, setCompletingTask] = useState<Row | null>(null);
  const [previewEvidenceUrl, setPreviewEvidenceUrl] = useState<string | null>(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [showReminderManager, setShowReminderManager] = useState(false);
  const isFieldStaff = permissions.isFieldStaff || initialTab === "meter-readings";

  const filteredNavGroups = useMemo(() => {
    if (caretakerMode) {
      return companionNav
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => ["meter-readings", "my-tasks", "tickets", "calendar"].includes(item.id)),
        }))
        .filter((group) => group.items.length > 0);
    }
    return companionNav
      .map((group) => {
        if (group.label.toLowerCase().includes("performance") && !permissions.isSuperAdmin) {
          return {
            ...group,
            items: group.items.filter((item) => item.id !== "performance" && item.id !== "staff" && item.id !== "audit-events"),
          };
        }
        if (group.label.toLowerCase().includes("field") && !isFieldStaff) {
          return null;
        }
        return group;
      })
      .filter(Boolean) as typeof companionNav;
  }, [caretakerMode, permissions.isSuperAdmin, isFieldStaff]);

  const userName = session?.user?.firstName
    ? `${session.user.firstName}${session.user.lastName ? ` ${session.user.lastName}` : ""}`
    : session?.user?.username ?? "there";

  // Subtask checklist helper functions on selected task
  const taskChecklist: ChecklistItem[] = useMemo(() => {
    if (!selectedTask || !Array.isArray(selectedTask.checklist)) return [];
    return selectedTask.checklist as ChecklistItem[];
  }, [selectedTask]);

  function handleToggleSubtask(id: string) {
    if (!selectedTask) return;
    const updated = taskChecklist.map((it) => (it.id === id ? { ...it, completed: !it.completed } : it));
    handleUpdateChecklist(String(selectedTask.id), updated);
  }

  function handleAddSubtask() {
    if (!selectedTask || !newSubtaskTitle.trim()) return;
    const newItem: ChecklistItem = {
      id: `chk-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      title: newSubtaskTitle.trim(),
      completed: false,
    };
    const updated = [...taskChecklist, newItem];
    handleUpdateChecklist(String(selectedTask.id), updated);
    setNewSubtaskTitle("");
  }

  function handleDeleteSubtask(id: string) {
    if (!selectedTask) return;
    const updated = taskChecklist.filter((it) => it.id !== id);
    handleUpdateChecklist(String(selectedTask.id), updated);
  }

  return (
    <ErrorBoundary>
      <div className={caretakerMode ? "page-wrap tenant-portal-page caretaker-portal-page" : undefined}>
      {caretakerMode && (
        <section className="caretaker-portal-banner" aria-label="Caretaker field portal">
          <div className="caretaker-portal-identity">
            <span className="caretaker-avatar" aria-hidden="true">{userName.slice(0, 2).toUpperCase()}</span>
            <div>
              <p className="eyebrow">Caretaker self-service</p>
              <h1>Good day, {userName.split(" ")[0]}.</h1>
              <p>Record utilities, complete assigned work and follow property operations from one field workspace.</p>
              <div className="caretaker-context"><span>🏢</span><strong>{activeProperty?.name || "Select a property"}</strong><span className="caretaker-live-pill">Field operations</span></div>
            </div>
          </div>
          <div className="caretaker-quick-guide">
            <strong>Today&apos;s workspace</strong>
            <span>Readings · Tasks · Tickets · Calendar</span>
          </div>
        </section>
      )}
      <ModuleShell
      moduleKey="companion"
      moduleName={caretakerMode ? "Caretaker portal" : "Companion"}
      eyebrow={caretakerMode ? "Field operations" : "Personal command center"}
      title={caretakerMode ? "Caretaker field portal" : "Companion & Staff Performance"}
      subtitle={caretakerMode ? "Capture readings, complete assigned field work and report property issues for review." : "Daily work, team dialogue, staff assignment matrix, and operational productivity."}
      accent="var(--color-teal)"
      groups={filteredNavGroups}
      activeId={tab}
      onSelect={(id) => setTab(id as CompanionTab)}
    >
      <div className="companion-workspace" style={{ padding: "16px 24px" }}>
        {msg && <ErrorBanner message={msg} onRetry={() => setMsg("")} />}
        {error && tab !== "performance" && tab !== "staff" && <ErrorBanner message={error} onRetry={load} />}

        {/* OVERVIEW */}
        {tab === "overview" && (
          <OverviewView
            dash={dash}
            loading={loading}
            userName={userName}
            onSelectTab={(t) => setTab(t as CompanionTab)}
            onRunAction={runTaskAction}
            onManageReminders={() => setShowReminderManager(true)}
            canManageReminders={permissions.canManageCompanion}
          />
        )}

        <TeamRemindersDialog
          open={showReminderManager}
          onClose={() => setShowReminderManager(false)}
          organizationId={session?.activeOrganizationId}
        />

        {/* QM AI */}
        {tab === "qm" && (
          <QuartermasterView
            aiMessages={aiMessages}
            aiPrompt={aiPrompt}
            setAiPrompt={setAiPrompt}
            aiLoading={aiLoading}
            aiError={aiError}
            aiResponse={aiResponse}
            aiConversations={aiConversations}
            aiConversationId={aiConversationId}
            selectConversation={selectAiConversation}
            sendAiPrompt={sendAiPrompt}
            clearConversation={() => void archiveAiConversation()}
          />
        )}

        {/* TEAM DIALOGUE & FEEDBACK HUB */}
        {tab === "dialogue" && (
          <TeamDialogueView
            threads={threads}
            loading={loading}
            activeThread={activeThread}
            setActiveThread={setActiveThread}
            search={search}
            setSearch={setSearch}
            categoryFilter={categoryFilter}
            setCategoryFilter={setCategoryFilter}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            openNewThreadModal={() => setShowNewThread(true)}
            submitReply={handleReplyFeedback}
            updateThreadStatus={handleUpdateThreadStatus}
            onUploadAttachment={uploadAttachment}
            currentUserId={session?.user?.id}
          />
        )}

        {/* LEAVE & HR REQUESTS PORTAL */}
        {tab === "hr-requests" && (
          <HrRequestsView
            leaveRequests={leaveRequests}
            hrRequests={hrRequests}
            leaveBalance={leaveBalance}
            members={members}
            currentUserId={session?.user?.id}
            isSuperAdmin={permissions.isSuperAdmin}
            loading={loading}
            busy={busy}
            onCreateLeaveRequest={handleCreateLeaveRequest}
            onDecideLeaveRequest={handleDecideLeaveRequest}
            onCreateHrRequest={handleCreateHrRequest}
            onDecideHrRequest={handleDecideHrRequest}
            onUploadAttachment={uploadAttachment}
          />
        )}

        {/* TASKS / MY TASKS / DELEGATIONS */}
        {(tab === "tasks" || tab === "my-tasks" || tab === "delegations") && (
          <TasksView
            tab={tab}
            rows={rows}
            loading={loading}
            search={search}
            setSearch={setSearch}
            canAssign={permissions.canAssignTasks}
            onOpenAssign={() => setShowAssign(true)}
            onSelectTask={(t) => setSelectedTask(t)}
            onRunAction={runTaskAction}
            onOpenDelegate={(t) => setDelegateTarget(t)}
            onOpenCompleteModal={(t) => setCompletingTask(t)}
            onUpdateChecklist={handleUpdateChecklist}
          />
        )}

        {/* TEMPLATES */}
        {tab === "templates" && (
          <TemplatesView
            templates={templates}
            loading={loading}
            search={search}
            setSearch={setSearch}
            onOpenCreate={() => setShowTemplate(true)}
          />
        )}

        {/* PERFORMANCE & STAFF */}
        {(tab === "performance" || tab === "staff") && (
          <PerformanceView
            tab={tab}
            isSuperAdmin={permissions.isSuperAdmin}
            dash={dash}
            staff={staff}
            loading={loading}
            error={error}
            dateFrom={dateFrom}
            setDateFrom={setDateFrom}
            dateTo={dateTo}
            setDateTo={setDateTo}
            onApplyDateFilter={() => setDateFilter({ from: dateFrom, to: dateTo })}
            onOpenStaffDetail={(s) => setStaffDetail(s)}
          />
        )}

        {/* METER READINGS (FIELD WORK) */}
        {tab === "meter-readings" && (
          <MeterReadingsView
            rows={rows as any}
            loading={loading}
            onRefresh={load}
            fieldMode={caretakerMode}
          />
        )}

        {/* TICKETS & CALENDAR */}
        {tab === "tickets" && <ModuleTicketsView moduleName="Companion" />}
        {tab === "calendar" && <ModuleCalendarView moduleName="Companion" />}

        {/* TASK DETAIL DRAWER */}
        {selectedTask && (
          <DetailDrawer title={String(selectedTask.title ?? "Task")} onClose={() => setSelectedTask(null)}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* TOP STATUS & PRIORITY */}
              <div className="row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <StatusPill value={String(selectedTask.status)} tone={STATUS_TONE[String(selectedTask.status)]} />
                  <StatusPill value={String(selectedTask.priority ?? "normal")} />
                </div>
                <div className="mono" style={{ color: "var(--primary)", fontWeight: 700, fontSize: 13 }}>
                  {String(selectedTask.reference ?? "—")}
                </div>
              </div>

              {/* TIMING & ASSIGNMENT FIELDS */}
              <div className="grid-2" style={{ background: "var(--surface-sunken)", padding: 12, borderRadius: 8, border: "1px solid var(--border)", gap: 10 }}>
                <Field label="Assignee">
                  <div style={{ fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 18, height: 18, borderRadius: "50%", background: "var(--primary)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9 }}>
                      {String(selectedTask.assignee_name || selectedTask.assignee_username || "?").charAt(0).toUpperCase()}
                    </span>
                    <span>{String(selectedTask.assignee_name || selectedTask.assignee_username || "—")}</span>
                  </div>
                </Field>
                <Field label="Assigned by">
                  <div style={{ fontSize: 13 }}>{String(selectedTask.assigned_by_name || "System Admin")}</div>
                </Field>
                <Field label="Source Module">
                  <div className="mono" style={{ fontSize: 12 }}>{String(selectedTask.source_module ?? "companion")}{selectedTask.source_ref ? ` · ${selectedTask.source_ref}` : ""}</div>
                </Field>
                <Field label="Property / Site">
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{String(selectedTask.property_name || "Portfolio-wide")}</div>
                </Field>
                <Field label="Due Date">
                  <div className="mono" style={{ fontSize: 12, color: Boolean(selectedTask.overdue) ? "var(--color-danger)" : "var(--text)", fontWeight: Boolean(selectedTask.overdue) ? 700 : 500 }}>
                    {Boolean(selectedTask.overdue) ? "⚠️ " : ""}
                    {fmtDateTime(selectedTask.due_at as string | undefined)}
                  </div>
                </Field>
                <Field label="SLA Target">
                  <div className="mono" style={{ fontSize: 12 }}>{fmtDateTime(selectedTask.sla_due_at as string | undefined)}</div>
                </Field>
              </div>

              <Field label="Task Description">
                <div style={{ whiteSpace: "pre-wrap", fontSize: 13, background: "var(--surface-sunken)", padding: 10, borderRadius: 8, border: "1px solid var(--border)", lineHeight: 1.5 }}>
                  {String(selectedTask.description || "No description provided.")}
                </div>
              </Field>

              {/* INTERACTIVE SUB-TASKS & CHECKLIST */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, background: "var(--surface-sunken)", padding: 12, borderRadius: 8, border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary)" }}>
                    Sub-tasks & Action Checklist ({taskChecklist.filter((c) => c.completed).length}/{taskChecklist.length})
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {taskChecklist.length === 0 ? (
                    <div style={{ fontSize: 12, color: "var(--muted)", fontStyle: "italic", padding: "6px 0" }}>
                      No sub-tasks added yet. Add action items below to track progress.
                    </div>
                  ) : (
                    taskChecklist.map((item) => (
                      <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "4px 6px", borderRadius: 4, background: "var(--surface)" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", flex: 1, fontSize: 13, textDecoration: item.completed ? "line-through" : "none", color: item.completed ? "var(--muted)" : "var(--text)" }}>
                          <input
                            type="checkbox"
                            checked={Boolean(item.completed)}
                            onChange={() => handleToggleSubtask(item.id)}
                            style={{ cursor: "pointer", width: 16, height: 16 }}
                          />
                          <span>{item.title}</span>
                        </label>
                        <button
                          onClick={() => handleDeleteSubtask(item.id)}
                          style={{ border: "none", background: "none", color: "var(--muted)", cursor: "pointer", fontSize: 12, padding: "2px 4px" }}
                          title="Delete subtask"
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Inline add sub-task */}
                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                  <input
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddSubtask();
                      }
                    }}
                    placeholder="+ Add action checklist item…"
                    style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", fontSize: 12, color: "var(--text)" }}
                  />
                  <button
                    className="btn ghost sm"
                    onClick={handleAddSubtask}
                    disabled={!newSubtaskTitle.trim()}
                    style={{ padding: "4px 10px", fontSize: 11, fontWeight: 600 }}
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* PROOF OF WORK / EVIDENCE ATTACHMENT */}
              {Boolean(selectedTask.attachment_url) && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, background: "var(--surface-sunken)", padding: 12, borderRadius: 8, border: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6 }}>
                    <span>📸 Proof of Work / Completion Evidence</span>
                  </span>
                  <div
                    onClick={() => setPreviewEvidenceUrl(toMediaUrl(String(selectedTask.attachment_url)))}
                    style={{
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 10,
                      padding: 8,
                      background: "var(--surface)",
                      borderRadius: 6,
                      border: "1px solid var(--border)",
                    }}
                  >
                    <img
                      src={toMediaUrl(String(selectedTask.attachment_url))}
                      alt="Proof of Work"
                      style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 4, border: "1px solid var(--border)" }}
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--primary)" }}>View Full Screenshot / Photo 🔍</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>Click to zoom and verify resolution</div>
                    </div>
                  </div>
                </div>
              )}

              {/* ACTION TOOLBAR */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)", flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {selectedTask.status === "pending" && (
                    <button className="btn ghost sm" onClick={() => runTaskAction(selectedTask, "acknowledge")}>
                      👁️ Acknowledge
                    </button>
                  )}
                  {(selectedTask.status === "pending" || selectedTask.status === "acknowledged") && (
                    <button className="btn ghost sm" style={{ color: "var(--color-indigo-strong)" }} onClick={() => runTaskAction(selectedTask, "start")}>
                      ⚡ Start Work
                    </button>
                  )}
                  {selectedTask.status === "in_progress" && (
                    <button
                      className="btn primary sm"
                      style={{ background: "var(--color-success)", borderColor: "var(--color-success)", fontWeight: 700 }}
                      onClick={() => setCompletingTask(selectedTask)}
                    >
                      ✓ Complete with Proof
                    </button>
                  )}
                  {selectedTask.status !== "completed" && selectedTask.status !== "cancelled" && (
                    <button className="btn ghost sm" onClick={() => setDelegateTarget(selectedTask)}>
                      🔄 Delegate
                    </button>
                  )}
                </div>

                <button className="btn ghost sm" onClick={() => setSelectedTask(null)}>
                  Close
                </button>
              </div>
            </div>
          </DetailDrawer>
        )}

        {/* MODALS */}
        <AssignTaskModal
          open={showAssign}
          onClose={() => setShowAssign(false)}
          onSubmit={handleAssignTask}
          staffOptions={staffOptions}
          busy={busy}
          activePropertyName={activeProperty?.name}
        />

        <CompleteTaskModal
          task={completingTask}
          open={Boolean(completingTask)}
          onClose={() => setCompletingTask(null)}
          onSubmit={handleCompleteTaskWithEvidence}
          onUploadAttachment={uploadAttachment}
          busy={busy}
        />

        <CreateTemplateModal
          open={showTemplate}
          onClose={() => setShowTemplate(false)}
          onSubmit={handleCreateTemplate}
          busy={busy}
        />

        <DelegateTaskModal
          task={delegateTarget}
          onClose={() => setDelegateTarget(null)}
          onSubmit={handleDelegateTask}
          staffOptions={staffOptions}
          busy={busy}
        />

        <CreateFeedbackModal
          open={showNewThread}
          onClose={() => setShowNewThread(false)}
          onSubmit={handleCreateFeedback}
          onUploadAttachment={uploadAttachment}
          busy={busy}
          activePropertyName={activeProperty?.name}
        />

        {/* EVIDENCE IMAGE ZOOM MODAL */}
        {previewEvidenceUrl && (
          <Modal title="🔎 Evidence & Proof-of-Work Attachment" onClose={() => setPreviewEvidenceUrl(null)} wide>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
              <img
                src={toMediaUrl(previewEvidenceUrl)}
                alt="Proof Zoom"
                style={{ maxWidth: "100%", maxHeight: "75vh", borderRadius: 8, border: "1px solid var(--border)", objectFit: "contain" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                <a
                  href={toMediaUrl(previewEvidenceUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn ghost sm"
                  style={{ textDecoration: "none" }}
                >
                  Open Original File ↗
                </a>
                <button className="btn primary sm" onClick={() => setPreviewEvidenceUrl(null)}>
                  Close Preview
                </button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </ModuleShell>
    </div>
    </ErrorBoundary>
  );
}
