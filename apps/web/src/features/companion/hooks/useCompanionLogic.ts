"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { apiFetch, csrfFromCookie } from "@/lib/api";
import { companionNav } from "@/lib/module-nav";
import { usePropertyContext } from "@/lib/property-context";
import { CompanionDash, CompanionTab, FeedbackMessage, FeedbackThread, Row, TeamMember } from "../types/companion.types";

export function useCompanionLogic(initialTab: CompanionTab = "overview") {
  const { session } = useAuth();
  const org = session?.activeOrganizationId;
  const isSuperAdmin = Boolean(
    session?.user?.isSuperuser ||
    session?.roles?.includes("platform-admin") ||
    session?.roles?.includes("super-admin")
  );
  const { activeProperty } = usePropertyContext();

  const [tab, setTab] = useState<CompanionTab>(initialTab);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const [dash, setDash] = useState<CompanionDash | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [templates, setTemplates] = useState<Row[]>([]);
  const [staff, setStaff] = useState<Row[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [properties, setProperties] = useState<{ id: string; name: string; code: string }[]>([]);
  const [roles, setRoles] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [threads, setThreads] = useState<FeedbackThread[]>([]);
  const [activeThread, setActiveThread] = useState<FeedbackThread | null>(null);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [selectedTask, setSelectedTask] = useState<Row | null>(null);
  const [delegateTarget, setDelegateTarget] = useState<Row | null>(null);
  const [readingMeter, setReadingMeter] = useState<Row | null>(null);
  const [staffDetail, setStaffDetail] = useState<Row | null>(null);

  // Modals
  const [showAssign, setShowAssign] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const [showNewThread, setShowNewThread] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [memberError, setMemberError] = useState("");

  // AI Prompt / Quartermaster
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiMessages, setAiMessages] = useState<{ role: "user" | "assistant"; text: string; response?: any }[]>([]);
  const [aiResponse, setAiResponse] = useState<any>(null);

  // Performance filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateFilter, setDateFilter] = useState({ from: "", to: "" });

  const loadPropertiesAndRoles = useCallback(async () => {
    if (!org) return;
    try {
      const [pRes, rRes] = await Promise.all([
        apiFetch("/properties/", {}, org),
        apiFetch("/organizations/roles/", {}, org),
      ]);
      if (pRes.ok) {
        const pData = await pRes.json();
        const rawProps = Array.isArray(pData) ? pData : pData.results || [];
        setProperties(rawProps.map((p: any) => ({ id: p.id, name: p.name, code: p.code })));
      }
      if (rRes.ok) {
        const rData = await rRes.json();
        const rawRoles = Array.isArray(rData) ? rData : rData.results || [];
        setRoles(rawRoles.map((r: any) => ({ id: r.id, name: r.name, slug: r.slug })));
      }
    } catch {
      /* ignore */
    }
  }, [org]);

  const loadMembers = useCallback(async () => {
    if (!org) return;
    try {
      const res = await apiFetch(`/organizations/members/${activeProperty?.id ? `?property=${activeProperty.id}` : ""}`, {}, org);
      if (res.ok) {
        const data = await res.json();
        setMembers(Array.isArray(data) ? data : data.results || []);
      }
    } catch {
      /* ignore */
    }
  }, [org, activeProperty?.id]);

  const loadThreads = useCallback(async () => {
    if (!org) return;
    try {
      const res = await apiFetch(`/companion/feedback/${activeProperty?.id ? `?property=${activeProperty.id}` : ""}`, {}, org);
      if (res.ok) {
        const data = await res.json();
        const raw = Array.isArray(data) ? data : data.results || [];
        setThreads(raw);
        if (activeThread) {
          const fresh = raw.find((t: FeedbackThread) => t.id === activeThread.id);
          if (fresh) setActiveThread(fresh);
        }
      }
    } catch {
      /* ignore */
    }
  }, [org, activeProperty?.id, activeThread?.id]);

  const load = useCallback(async () => {
    if (!org) return;
    setLoading(true);
    setError("");
    try {
      const propQuery = activeProperty?.id ? `property=${activeProperty.id}` : "";
      if (tab === "overview") {
        const res = await apiFetch(`/companion/dashboard/${propQuery ? `?${propQuery}` : ""}`, {}, org);
        if (res.ok) setDash(await res.json());
        else setError("Failed to load companion dashboard.");
      } else if (tab === "tasks" || tab === "my-tasks" || tab === "delegations") {
        let q = propQuery ? `?${propQuery}` : "";
        if (tab === "my-tasks") q += `${q ? "&" : "?"}assignee=${session?.user?.id ?? ""}`;
        if (tab === "delegations") q += `${q ? "&" : "?"}delegated=true`;
        const res = await apiFetch(`/companion/tasks/${q}`, {}, org);
        if (res.ok) {
          const data = await res.json();
          setRows(Array.isArray(data) ? data : data.results || []);
        } else {
          setError("Failed to load tasks.");
        }
      } else if (tab === "templates") {
        const res = await apiFetch(`/companion/templates/`, {}, org);
        if (res.ok) {
          const data = await res.json();
          setTemplates(Array.isArray(data) ? data : data.results || []);
        }
      } else if (tab === "meter-readings") {
        const res = await apiFetch(`/facilities/meters/${propQuery ? `?${propQuery}` : ""}`, {}, org);
        if (res.ok) {
          const data = await res.json();
          setRows(Array.isArray(data) ? data : data.results || []);
        } else {
          setError("Failed to load meters.");
        }
      } else if (tab === "dialogue") {
        await loadThreads();
      } else if (tab === "team-matrix") {
        await loadMembers();
        await loadPropertiesAndRoles();
      } else if (tab === "performance" || tab === "staff") {
        if (isSuperAdmin) {
          const res = await apiFetch(`/companion/performance/?from=${dateFilter.from}&to=${dateFilter.to}`, {}, org);
          if (res.ok) {
            const data = await res.json();
            setStaff(Array.isArray(data.staff) ? data.staff : []);
            setDash(data);
          }
        }
      }
    } catch {
      setError("An unexpected network error occurred.");
    } finally {
      setLoading(false);
    }
  }, [org, tab, activeProperty?.id, session?.user?.id, isSuperAdmin, dateFilter, loadThreads, loadMembers, loadPropertiesAndRoles]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadMembers();
    loadPropertiesAndRoles();
  }, [loadMembers, loadPropertiesAndRoles]);

  const staffOptions = useMemo(() => {
    if (members.length > 0) {
      return members.map((m) => ({
        user_id: String(m.user_id),
        name: m.full_name,
        username: m.username,
        role_name: m.roles?.map((r) => r.name).join(", ") || (m.is_organization_admin ? "Super Admin" : "Staff"),
      }));
    }
    return staff.map((s) => ({
      user_id: String(s.user_id),
      name: String(s.name),
      username: String(s.username || ""),
      role_name: "Staff",
    }));
  }, [members, staff]);

  async function handleAddMember(payload: Record<string, unknown>) {
    if (!org) return;
    setBusy(true);
    setMemberError("");
    try {
      await apiFetch("/auth/csrf/");
      const res = await apiFetch("/organizations/members/", {
        method: "POST",
        headers: { "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify(payload),
      }, org);
      if (res.ok) {
        setShowAddMember(false);
        setMsg("Team member added successfully.");
        await loadMembers();
      } else {
        const body = await res.json().catch(() => ({}));
        setMemberError(String(body.detail || body.username || "Failed to create team member."));
      }
    } catch {
      setMemberError("Network error while creating team member.");
    } finally {
      setBusy(false);
    }
  }

  async function handleEditMember(memberId: string, payload: Record<string, unknown>) {
    if (!org) return;
    setBusy(true);
    try {
      await apiFetch("/auth/csrf/");
      const res = await apiFetch(`/organizations/members/${memberId}/`, {
        method: "PATCH",
        headers: { "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify(payload),
      }, org);
      if (res.ok) {
        setEditingMember(null);
        setMsg("Team member matrix updated successfully.");
        await loadMembers();
      }
    } catch {
      setMsg("Failed to update team member matrix.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateFeedback(payload: Record<string, unknown>) {
    if (!org) return;
    setBusy(true);
    try {
      await apiFetch("/auth/csrf/");
      const res = await apiFetch("/companion/feedback/", {
        method: "POST",
        headers: { "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify(payload),
      }, org);
      if (res.ok) {
        setShowNewThread(false);
        setMsg("Feedback / bug report logged to team dialogue.");
        await loadThreads();
      }
    } catch {
      setMsg("Failed to log feedback thread.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadAttachment(file: File): Promise<{ url: string; name: string; size: number } | null> {
    if (!org) return null;
    try {
      await apiFetch("/auth/csrf/");
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiFetch("/companion/feedback/upload/", {
        method: "POST",
        headers: { "X-CSRFToken": csrfFromCookie() },
        body: formData,
      }, org);
      if (res.ok) {
        return await res.json();
      }
      return null;
    } catch {
      return null;
    }
  }

  async function handleReplyFeedback(threadId: string, message: string, attachmentUrl?: string) {
    if (!org) return;
    try {
      await apiFetch("/auth/csrf/");
      const res = await apiFetch(`/companion/feedback/${threadId}/messages/`, {
        method: "POST",
        headers: { "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify({ message, attachment_url: attachmentUrl || "" }),
      }, org);
      if (res.ok) {
        await loadThreads();
      }
    } catch {
      /* ignore */
    }
  }

  async function handleUpdateThreadStatus(threadId: string, status: "open" | "in_progress" | "resolved" | "closed") {
    if (!org) return;
    try {
      await apiFetch("/auth/csrf/");
      const res = await apiFetch(`/companion/feedback/${threadId}/update-status/`, {
        method: "POST",
        headers: { "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify({ status }),
      }, org);
      if (res.ok) {
        await loadThreads();
      }
    } catch {
      /* ignore */
    }
  }

  async function handleAssignTask(payload: Record<string, unknown>) {
    if (!org) return;
    setBusy(true);
    setMsg("");
    try {
      await apiFetch("/auth/csrf/");
      const assignees = payload.assignees as string[];
      let created = 0;
      for (const assigneeId of assignees) {
        const taskPayload = {
          ...payload,
          assignee: assigneeId,
          assigned_by: session?.user?.id,
        };
        const res = await apiFetch("/companion/tasks/", {
          method: "POST",
          headers: { "X-CSRFToken": csrfFromCookie() },
          body: JSON.stringify(taskPayload),
        }, org);
        if (res.ok) created++;
      }
      if (created > 0) {
        setShowAssign(false);
        setMsg(`Task assigned to ${created} team member${created > 1 ? "s" : ""}.`);
        load();
      } else {
        setMsg("Task assignment failed.");
      }
    } catch {
      setMsg("Task assignment failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateTemplate(payload: Record<string, unknown>) {
    if (!org) return;
    setBusy(true);
    try {
      await apiFetch("/auth/csrf/");
      const res = await apiFetch("/companion/templates/", {
        method: "POST",
        headers: { "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify(payload),
      }, org);
      if (res.ok) {
        setShowTemplate(false);
        setMsg("Template created successfully.");
        load();
      }
    } catch {
      setMsg("Failed to create template.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelegateTask(taskId: string, delegateeId: string, note: string) {
    if (!org) return;
    setBusy(true);
    try {
      await apiFetch("/auth/csrf/");
      const res = await apiFetch(`/companion/tasks/${taskId}/delegate/`, {
        method: "POST",
        headers: { "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify({ delegate_to: delegateeId, note }),
      }, org);
      if (res.ok) {
        setDelegateTarget(null);
        setMsg("Task successfully delegated.");
        load();
      } else {
        const body = await res.json().catch(() => ({}));
        setMsg(String(body.detail || body.delegate_to || "Delegation failed."));
      }
    } catch {
      setMsg("Delegation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function runTaskAction(task: Row, action: string) {
    if (!org) return;
    setBusy(true);
    setMsg("");
    try {
      await apiFetch("/auth/csrf/");
      const res = await apiFetch(`/companion/tasks/${task.id}/${action}/`, {
        method: "POST",
        headers: { "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify({}),
      }, org);
      if (res.ok) {
        load();
      } else {
        const body = await res.json().catch(() => ({}));
        setMsg(String(body?.detail ?? "Task action failed."));
      }
    } catch {
      setMsg("Task action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function sendAiPrompt(promptOverride?: string) {
    const text = (promptOverride || aiPrompt).trim();
    if (!text || !org || aiLoading) return;
    setAiLoading(true);
    setAiError("");
    setAiMessages((prev) => [...prev, { role: "user", text }]);
    setAiPrompt("");
    try {
      await apiFetch("/auth/csrf/");
      const res = await apiFetch("/companion/qm/chat/", {
        method: "POST",
        headers: { "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify({ prompt: text, property: activeProperty?.id }),
      }, org);
      if (res.ok) {
        const data = await res.json();
        setAiResponse(data);
        setAiMessages((prev) => [...prev, { role: "assistant", text: data.reply || data.text || "I have analyzed the records for this property.", response: data }]);
      } else {
        setAiError("Quartermaster AI service returned an error. Please try again.");
      }
    } catch {
      setAiError("Failed to reach Quartermaster AI.");
    } finally {
      setAiLoading(false);
    }
  }

  return {
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
    loadThreads,
    uploadAttachment,
    createTask: handleAssignTask,
    createTemplate: handleCreateTemplate,
    createThread: handleCreateFeedback,
    replyFeedback: handleReplyFeedback,
    updateThreadStatus: handleUpdateThreadStatus,
    addMember: handleAddMember,
    updateMember: handleEditMember,
    delegateTask: handleDelegateTask,
    runTaskAction,
    handleAddMember,
    handleEditMember,
    handleCreateFeedback,
    handleReplyFeedback,
    handleUpdateThreadStatus,
    handleAssignTask,
    handleCreateTemplate,
    handleDelegateTask,
  };
}
