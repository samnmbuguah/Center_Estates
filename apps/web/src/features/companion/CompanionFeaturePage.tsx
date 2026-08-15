"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { ModuleShell } from "@/components/module-shell";
import { companionNav } from "@/lib/module-nav";
import { DetailDrawer, ErrorBanner, Field, Modal, StatusPill } from "@/components/module-ui";
import { ModuleCalendarView, ModuleTicketsView } from "@/components/module-activity";
import { useCompanionLogic } from "./hooks/useCompanionLogic";
import { OverviewView } from "./components/tabs/OverviewView";
import { QuartermasterView } from "./components/tabs/QuartermasterView";
import { TeamDialogueView } from "./components/tabs/TeamDialogueView";
import { TeamMatrixView } from "./components/tabs/TeamMatrixView";
import { TasksView } from "./components/tabs/TasksView";
import { TemplatesView } from "./components/tabs/TemplatesView";
import { PerformanceView } from "./components/tabs/PerformanceView";
import {
  AddTeamMemberModal,
  AssignTaskModal,
  CreateFeedbackModal,
  CreateTemplateModal,
  DelegateTaskModal,
  EditMemberMatrixModal,
} from "./components/modals/CompanionModals";
import { CompanionTab, Row } from "./types/companion.types";
import { fmtDate, fmtDateTime, STATUS_TONE } from "./utils/companion.utils";

export function CompanionFeaturePage({ initialTab = "overview" }: { initialTab?: CompanionTab }) {
  const { session } = useAuth();
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
    showAddMember,
    setShowAddMember,
    editingMember,
    setEditingMember,
    memberError,
    aiPrompt,
    setAiPrompt,
    aiLoading,
    aiError,
    aiMessages,
    setAiMessages,
    aiResponse,
    setAiResponse,
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
    handleAddMember,
    handleEditMember,
    handleCreateFeedback,
    handleReplyFeedback,
    handleUpdateThreadStatus,
    handleAssignTask,
    handleCreateTemplate,
    handleDelegateTask,
    runTaskAction,
  } = useCompanionLogic(initialTab);

  const filteredNavGroups = useMemo(() => {
    return companionNav.map(group => {
      if (group.label.toLowerCase().includes("performance") && !isSuperAdmin) {
        return {
          ...group,
          items: group.items.filter(item => item.id !== "performance" && item.id !== "staff"),
        };
      }
      return group;
    }).filter(Boolean) as typeof companionNav;
  }, [isSuperAdmin]);

  const userName = session?.user?.firstName
    ? `${session.user.firstName}${session.user.lastName ? ` ${session.user.lastName}` : ""}`
    : session?.user?.username ?? "there";

  return (
    <ModuleShell
      moduleKey="companion"
      moduleName="Companion"
      eyebrow="Personal command center"
      title="Companion & Staff Performance"
      subtitle="Daily work, team dialogue, staff assignment matrix, and operational productivity."
      accent="#0d9488"
      groups={filteredNavGroups}
      activeId={tab}
      onSelect={(id) => setTab(id as CompanionTab)}
    >
      <div className="valuation-workspace" style={{ padding: "16px 24px" }}>
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
          />
        )}

        {/* QM AI */}
        {tab === "qm" && (
          <QuartermasterView
            aiMessages={aiMessages}
            aiPrompt={aiPrompt}
            setAiPrompt={setAiPrompt}
            aiLoading={aiLoading}
            aiError={aiError}
            aiResponse={aiResponse}
            sendAiPrompt={sendAiPrompt}
            clearConversation={() => {
              setAiMessages([]);
              setAiResponse(null);
            }}
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
          />
        )}

        {/* TEAM & PROPERTY MATRIX */}
        {tab === "team-matrix" && (
          <TeamMatrixView
            members={members}
            loading={loading}
            canManage={Boolean(isSuperAdmin)}
            openAddMemberModal={() => setShowAddMember(true)}
            openEditMemberModal={(m) => setEditingMember(m)}
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
            canAssign={Boolean(isSuperAdmin)}
            onOpenAssign={() => setShowAssign(true)}
            onSelectTask={(t) => setSelectedTask(t)}
            onRunAction={runTaskAction}
            onOpenDelegate={(t) => setDelegateTarget(t)}
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
            isSuperAdmin={Boolean(isSuperAdmin)}
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

        {/* TICKETS & CALENDAR */}
        {tab === "tickets" && <ModuleTicketsView moduleName="Companion" />}
        {tab === "calendar" && <ModuleCalendarView moduleName="Companion" />}

        {/* TASK DETAIL DRAWER */}
        {selectedTask && (
          <DetailDrawer title={String(selectedTask.title ?? "Task")} onClose={() => setSelectedTask(null)}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="row" style={{ display: "flex", gap: 8 }}>
                <StatusPill value={String(selectedTask.status)} tone={STATUS_TONE[String(selectedTask.status)]} />
                <StatusPill value={String(selectedTask.priority ?? "normal")} />
              </div>
              <Field label="Reference"><div className="mono" style={{ color: "var(--primary)", fontWeight: 700 }}>{String(selectedTask.reference ?? "—")}</div></Field>
              <Field label="Assignee"><div>{String(selectedTask.assignee_name || selectedTask.assignee_username || "—")}</div></Field>
              <Field label="Assigned by"><div>{String(selectedTask.assigned_by_name || "—")}</div></Field>
              <Field label="Source"><div className="mono">{String(selectedTask.source_module ?? "—")}{selectedTask.source_ref ? ` · ${selectedTask.source_ref}` : ""}</div></Field>
              <Field label="Due"><div>{fmtDateTime(selectedTask.due_at)}</div></Field>
              <Field label="SLA due"><div>{fmtDateTime(selectedTask.sla_due_at)}</div></Field>
              <Field label="Description"><div style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>{String(selectedTask.description ?? "—")}</div></Field>
              <div className="modal-actions" style={{ marginTop: 12 }}>
                <button className="btn ghost sm" onClick={() => setSelectedTask(null)}>Close</button>
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

        <AddTeamMemberModal
          open={showAddMember}
          onClose={() => setShowAddMember(false)}
          onSubmit={handleAddMember}
          properties={properties}
          roles={roles}
          busy={busy}
          error={memberError}
        />

        <EditMemberMatrixModal
          member={editingMember}
          onClose={() => setEditingMember(null)}
          onSubmit={handleEditMember}
          properties={properties}
          roles={roles}
          busy={busy}
        />
      </div>
    </ModuleShell>
  );
}
