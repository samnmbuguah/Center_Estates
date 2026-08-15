"use client";

import { useMemo, useState } from "react";
import { Badge, DetailDrawer, EmptyState, Modal } from "@/components/module-ui";
import { FeedbackThread } from "../../types/companion.types";
import { fmtDateTime, PRIORITY_TONE, toMediaUrl } from "../../utils/companion.utils";
import { EvidenceAttachmentUploader, type UploadedAttachment } from "../common/EvidenceAttachmentUploader";
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Plus,
  Search,
  Send,
} from "lucide-react";

export function TeamDialogueView({
  threads,
  loading,
  activeThread,
  setActiveThread,
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  openNewThreadModal,
  submitReply,
  updateThreadStatus,
  onUploadAttachment,
}: {
  threads: FeedbackThread[];
  loading: boolean;
  activeThread: FeedbackThread | null;
  setActiveThread: (t: FeedbackThread | null) => void;
  search: string;
  setSearch: (s: string) => void;
  categoryFilter?: string;
  setCategoryFilter?: (c: string) => void;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  openNewThreadModal: () => void;
  submitReply: (threadId: string, message: string, attachmentUrl?: string) => Promise<void>;
  updateThreadStatus: (threadId: string, status: "open" | "in_progress" | "resolved" | "closed") => Promise<void>;
  onUploadAttachment?: (file: File) => Promise<{ url: string; name: string; size: number } | null>;
}) {
  const [createdDateFilter, setCreatedDateFilter] = useState("all");
  const [sortField, setSortField] = useState<"created_at" | "created_by_name" | "title" | "status">("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Drawer / reply state
  const [replyText, setReplyText] = useState("");
  const [replyAttachment, setReplyAttachment] = useState<UploadedAttachment | null>(null);
  const [sending, setSending] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // Date filtering helper
  function matchDateFilter(dateStr: string, filter: string) {
    if (filter === "all") return true;
    const d = new Date(dateStr);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (filter === "today") {
      return d >= startOfToday;
    }
    if (filter === "week") {
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return d >= oneWeekAgo;
    }
    if (filter === "month") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return d >= startOfMonth;
    }
    if (filter === "year") {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      return d >= startOfYear;
    }
    return true;
  }

  // Filter threads
  const filteredThreads = useMemo(() => {
    return threads.filter((t) => {
      // Status filter
      if (statusFilter && statusFilter !== "all") {
        if (statusFilter === "in_progress" && t.status !== "in_progress") return false;
        if (statusFilter === "open" && t.status !== "open") return false;
        if (statusFilter === "closed" && t.status !== "closed" && t.status !== "resolved") return false;
      }

      // Date filter
      if (!matchDateFilter(t.created_at, createdDateFilter)) {
        return false;
      }

      // Search query across ID, requestor, topic, initial message
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchTitle = (t.title || "").toLowerCase().includes(q);
        const matchRef = (t.reference || "").toLowerCase().includes(q);
        const matchAuthor = (t.created_by_name || "").toLowerCase().includes(q);
        const matchRole = (t.created_by_role || "").toLowerCase().includes(q);
        const matchMessage = (t.messages?.[0]?.message || "").toLowerCase().includes(q);
        return matchTitle || matchRef || matchAuthor || matchRole || matchMessage;
      }
      return true;
    });
  }, [threads, statusFilter, createdDateFilter, search]);

  // Sort threads
  const sortedThreads = useMemo(() => {
    return [...filteredThreads].sort((a, b) => {
      let valA: string | number = a[sortField] || "";
      let valB: string | number = b[sortField] || "";
      if (sortField === "created_at") {
        valA = new Date(a.created_at).getTime();
        valB = new Date(b.created_at).getTime();
      }
      if (valA < valB) return sortDir === "asc" ? -1 : 1;
      if (valA > valB) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredThreads, sortField, sortDir]);

  // Paginated records
  const totalRecords = sortedThreads.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedThreads = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedThreads.slice(start, start + pageSize);
  }, [sortedThreads, currentPage, pageSize]);

  function handleSort(field: "created_at" | "created_by_name" | "title" | "status") {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  // Export to CSV
  function handleExportCsv() {
    const headers = ["ID", "Date", "Requestor", "Role", "Topic", "Module", "Priority", "Status", "Description"];
    const rows = sortedThreads.map((t) => [
      `"${t.reference || t.id}"`,
      `"${fmtDateTime(t.created_at)}"`,
      `"${(t.created_by_name || "Team Member").replace(/"/g, '""')}"`,
      `"${(t.created_by_role || "Staff").replace(/"/g, '""')}"`,
      `"${(t.title || "").replace(/"/g, '""')}"`,
      `"${(t.module || "General").replace(/"/g, '""')}"`,
      `"${(t.priority || "normal").replace(/"/g, '""')}"`,
      `"${(t.status || "open").replace(/"/g, '""')}"`,
      `"${(t.messages?.[0]?.message || t.title || "").replace(/"/g, '""')}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `team_conversations_feedback_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Submit new reply
  async function handleSendReply() {
    if (!activeThread || !replyText.trim() || sending) return;
    setSending(true);
    try {
      await submitReply(activeThread.id, replyText.trim(), replyAttachment?.url);
      setReplyText("");
      setReplyAttachment(null);
    } finally {
      setSending(false);
    }
  }

  function isImageUrl(url?: string) {
    if (!url) return false;
    return /\.(png|jpg|jpeg|webp|gif|svg)(\?.*)?$/i.test(url) || url.includes("/media/companion/");
  }

  function getStatusLabel(status: string) {
    if (status === "open") return "Open";
    if (status === "in_progress") return "In-Progress";
    if (status === "resolved" || status === "closed") return "Closed";
    return status;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ═══ TOP HEADER & NEW DIALOGUE BUTTON ════════════════════════════ */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, textTransform: "uppercase", letterSpacing: "0.03em" }}>
            TEAM CONVERSATIONS & FEEDBACK
          </h2>
          <p className="muted" style={{ margin: "3px 0 0", fontSize: 13 }}>
            All team dialogue / report bugs in one list
          </p>
        </div>

        <button
          type="button"
          className="btn"
          style={{
            background: "#dc2626",
            color: "#ffffff",
            borderColor: "#dc2626",
            fontWeight: 700,
            fontSize: 13,
            padding: "8px 18px",
            borderRadius: 6,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            boxShadow: "0 2px 4px rgba(220, 38, 38, 0.2)",
          }}
          onClick={openNewThreadModal}
        >
          <Plus size={16} /> New Dialogue / Report Bug
        </button>
      </div>

      {/* ═══ FILTER BAR (SEARCH, STATUS, CREATED DATE, EXPORT) ════════════ */}
      <div
        className="card"
        style={{
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          background: "#ffffff",
          border: "1px solid var(--border)",
          borderRadius: 8,
        }}
      >
        {/* Left: Search Input */}
        <div style={{ flex: "1 1 300px", minWidth: 260, position: "relative" }}>
          <Search
            size={16}
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--muted)",
            }}
          />
          <input
            type="text"
            placeholder="Search by ID, requestor, topic or issue..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            style={{
              width: "100%",
              padding: "8px 12px 8px 34px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "#ffffff",
              fontSize: 13,
              color: "var(--text)",
            }}
          />
        </div>

        {/* Right: Dropdowns & Export */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {/* Status Dropdown */}
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
              Status
            </span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "#ffffff",
                fontSize: 13,
                fontWeight: 500,
                color: "var(--text)",
                minWidth: 130,
              }}
            >
              <option value="all">All Statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In-Progress</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          {/* Created Date Dropdown */}
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
              Created Date
            </span>
            <select
              value={createdDateFilter}
              onChange={(e) => {
                setCreatedDateFilter(e.target.value);
                setPage(1);
              }}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "#ffffff",
                fontSize: 13,
                fontWeight: 500,
                color: "var(--text)",
                minWidth: 130,
              }}
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="year">This Year</option>
            </select>
          </div>

          {/* Export Button */}
          <button
            type="button"
            className="btn ghost sm"
            style={{
              marginTop: 14,
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: "7px 14px",
              fontWeight: 600,
              fontSize: 13,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
            onClick={handleExportCsv}
          >
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      {/* ═══ MAIN DATA TABLE ═════════════════════════════════════════════ */}
      <div
        className="card"
        style={{
          background: "#ffffff",
          border: "1px solid var(--border)",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table className="table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid var(--border)",
                  textAlign: "left",
                  background: "var(--surface-2, #f9fafb)",
                  color: "#4b5563",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                <th style={{ padding: "12px 14px", width: "10%" }}>ID</th>
                <th
                  style={{ padding: "12px 14px", width: "16%", cursor: "pointer", userSelect: "none" }}
                  onClick={() => handleSort("created_at")}
                >
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    Date <ArrowUpDown size={12} color="var(--muted)" />
                  </div>
                </th>
                <th
                  style={{ padding: "12px 14px", width: "18%", cursor: "pointer", userSelect: "none" }}
                  onClick={() => handleSort("created_by_name")}
                >
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    Requestor <ArrowUpDown size={12} color="var(--muted)" />
                  </div>
                </th>
                <th
                  style={{ padding: "12px 14px", width: "20%", cursor: "pointer", userSelect: "none" }}
                  onClick={() => handleSort("title")}
                >
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    Topic <ArrowUpDown size={12} color="var(--muted)" />
                  </div>
                </th>
                <th style={{ padding: "12px 14px", width: "24%" }}>Issue / Description</th>
                <th
                  style={{ padding: "12px 14px", width: "12%", cursor: "pointer", userSelect: "none" }}
                  onClick={() => handleSort("status")}
                >
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    Status <ArrowUpDown size={12} color="var(--muted)" />
                  </div>
                </th>
                <th style={{ padding: "12px 14px", width: "4%", textAlign: "right" }}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
                    Loading dialogues & conversations…
                  </td>
                </tr>
              ) : pagedThreads.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 48 }}>
                    <EmptyState
                      icon="💬"
                      title="No Dialogues Found"
                      description="No conversations or bug reports match your filter criteria. Click 'New Dialogue / Report Bug' to post one."
                      action={
                        <button
                          type="button"
                          className="btn"
                          style={{ background: "#dc2626", color: "#fff", borderColor: "#dc2626" }}
                          onClick={openNewThreadModal}
                        >
                          <Plus size={14} /> New Dialogue / Report Bug
                        </button>
                      }
                    />
                  </td>
                </tr>
              ) : (
                pagedThreads.map((t) => {
                  const initialDesc = t.messages?.[0]?.message || t.title;
                  const isSelected = activeThread?.id === t.id;

                  return (
                    <tr
                      key={t.id}
                      onClick={() => setActiveThread(t)}
                      style={{
                        borderBottom: "1px solid var(--border)",
                        cursor: "pointer",
                        background: isSelected ? "rgba(37, 99, 235, 0.05)" : "transparent",
                        transition: "background 0.15s ease",
                      }}
                      className="hover-row"
                    >
                      {/* ID Column */}
                      <td style={{ padding: "12px 14px", fontWeight: 700, color: "#2563eb" }}>
                        {t.reference || `FB-${t.id}`}
                      </td>

                      {/* Date Column */}
                      <td style={{ padding: "12px 14px", color: "var(--text-secondary, #374151)" }}>
                        {fmtDateTime(t.created_at)}
                      </td>

                      {/* Requestor Column */}
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ fontWeight: 700, color: "var(--text, #111827)" }}>
                          {t.created_by_name || "Team Member"}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--muted, #6b7280)", marginTop: 1 }}>
                          {t.created_by_role || "Administrator"}
                        </div>
                      </td>

                      {/* Topic Column */}
                      <td style={{ padding: "12px 14px", fontWeight: 700, color: "var(--text, #111827)" }}>
                        {t.title}
                      </td>

                      {/* Issue / Description Column */}
                      <td
                        style={{
                          padding: "12px 14px",
                          color: "var(--text-secondary, #4b5563)",
                          maxWidth: 320,
                          lineHeight: 1.4,
                        }}
                      >
                        <div
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                          }}
                        >
                          {initialDesc}
                        </div>
                        {t.messages?.[0]?.attachment_url && (
                          <div style={{ marginTop: 4 }}>
                            <span style={{ fontSize: 11, color: "#2563eb", display: "inline-flex", alignItems: "center", gap: 3 }}>
                              📎 Screenshot Attached
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Status Column */}
                      <td style={{ padding: "12px 14px" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "3px 12px",
                            borderRadius: 12,
                            fontSize: 12,
                            fontWeight: 600,
                            background:
                              t.status === "open"
                                ? "#dbeafe"
                                : t.status === "in_progress"
                                ? "#fef3c7"
                                : "#d1fae5",
                            color:
                              t.status === "open"
                                ? "#1e40af"
                                : t.status === "in_progress"
                                ? "#92400e"
                                : "#065f46",
                          }}
                        >
                          {getStatusLabel(t.status)}
                        </span>
                      </td>

                      {/* Action Chevron */}
                      <td style={{ padding: "12px 14px", textAlign: "right", color: "var(--muted)" }}>
                        <ChevronRight size={16} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ═══ FOOTER & PAGINATION ═════════════════════════════════════════ */}
        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            background: "#ffffff",
          }}
        >
          <div style={{ fontSize: 12, color: "var(--muted)" }}>
            Showing {totalRecords === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{" "}
            {Math.min(currentPage * pageSize, totalRecords)} of {totalRecords} requests
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Page Navigation */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <button
                type="button"
                className="btn ghost sm"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{ padding: "4px 8px" }}
              >
                <ChevronLeft size={14} />
              </button>

              <span
                style={{
                  minWidth: 28,
                  height: 28,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#dc2626",
                  color: "#ffffff",
                  borderRadius: 4,
                  fontWeight: 700,
                  fontSize: 12,
                }}
              >
                {currentPage}
              </span>

              <button
                type="button"
                className="btn ghost sm"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                style={{ padding: "4px 8px" }}
              >
                <ChevronRight size={14} />
              </button>
            </div>

            {/* Rows Per Page */}
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              style={{
                padding: "4px 8px",
                borderRadius: 4,
                border: "1px solid var(--border)",
                fontSize: 12,
                background: "#ffffff",
                color: "var(--text)",
              }}
            >
              <option value={10}>10 / page</option>
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
            </select>
          </div>
        </div>
      </div>

      {/* ═══ SLIDE-OVER CONVERSATION DIALOGUE DRAWER ═════════════════════ */}
      {activeThread && (
        <DetailDrawer
          title={activeThread.title}
          onClose={() => setActiveThread(null)}
          width={520}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "8px 0" }}>
            {/* Header Action & Status Switcher */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <span style={{ fontSize: 12, color: "#2563eb", fontWeight: 700 }}>
                {activeThread.reference || `FB-${activeThread.id}`}
              </span>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {activeThread.status !== "resolved" && activeThread.status !== "closed" ? (
                  <button
                    type="button"
                    className="btn sm"
                    style={{ background: "#059669", color: "#fff", borderColor: "#059669", fontSize: 11 }}
                    onClick={() => updateThreadStatus(activeThread.id, "resolved")}
                  >
                    ✓ Mark Closed
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn ghost sm"
                    style={{ fontSize: 11 }}
                    onClick={() => updateThreadStatus(activeThread.id, "open")}
                  >
                    ↺ Reopen
                  </button>
                )}
              </div>
            </div>

            {/* Thread Details Overview Card */}
            <div
              className="card"
              style={{
                padding: 14,
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                gap: 10,
                fontSize: 12,
              }}
            >
              <div>
                <span className="muted" style={{ display: "block", fontSize: 10, textTransform: "uppercase" }}>
                  Status
                </span>
                <span
                  style={{
                    display: "inline-block",
                    padding: "2px 8px",
                    borderRadius: 10,
                    fontSize: 11,
                    fontWeight: 700,
                    marginTop: 2,
                    background:
                      activeThread.status === "open"
                        ? "#dbeafe"
                        : activeThread.status === "in_progress"
                        ? "#fef3c7"
                        : "#d1fae5",
                    color:
                      activeThread.status === "open"
                        ? "#1e40af"
                        : activeThread.status === "in_progress"
                        ? "#92400e"
                        : "#065f46",
                  }}
                >
                  {getStatusLabel(activeThread.status)}
                </span>
              </div>
              <div>
                <span className="muted" style={{ display: "block", fontSize: 10, textTransform: "uppercase" }}>
                  Priority
                </span>
                <Badge tone={PRIORITY_TONE[activeThread.priority] || "gray"}>{activeThread.priority}</Badge>
              </div>
              <div>
                <span className="muted" style={{ display: "block", fontSize: 10, textTransform: "uppercase" }}>
                  Module
                </span>
                <strong>{activeThread.module || "General"}</strong>
              </div>
              <div>
                <span className="muted" style={{ display: "block", fontSize: 10, textTransform: "uppercase" }}>
                  Logged By
                </span>
                <span>{activeThread.created_by_name || "Team Member"}</span>
              </div>
            </div>

            {/* Status Quick Switcher Buttons */}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Update Status:</span>
              <button
                type="button"
                className={`btn sm ${activeThread.status === "open" ? "primary" : "ghost"}`}
                style={{ fontSize: 11, padding: "3px 8px" }}
                onClick={() => updateThreadStatus(activeThread.id, "open")}
              >
                Open
              </button>
              <button
                type="button"
                className={`btn sm ${activeThread.status === "in_progress" ? "primary" : "ghost"}`}
                style={{ fontSize: 11, padding: "3px 8px" }}
                onClick={() => updateThreadStatus(activeThread.id, "in_progress")}
              >
                In-Progress
              </button>
              <button
                type="button"
                className={`btn sm ${activeThread.status === "resolved" || activeThread.status === "closed" ? "primary" : "ghost"}`}
                style={{ fontSize: 11, padding: "3px 8px" }}
                onClick={() => updateThreadStatus(activeThread.id, "resolved")}
              >
                Closed
              </button>
            </div>

            {/* Conversation Messages Stream */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
              <h4 style={{ margin: "8px 0 0", fontSize: 13, textTransform: "uppercase", color: "var(--muted)" }}>
                Dialogue & Developer Notes ({activeThread.messages?.length || 0})
              </h4>

              {(!activeThread.messages || activeThread.messages.length === 0) ? (
                <div style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                  No messages logged yet. Post an update below.
                </div>
              ) : (
                activeThread.messages.map((m) => {
                  const isDev = Boolean(m.is_developer_response);
                  const hasImage = isImageUrl(m.attachment_url);

                  return (
                    <div
                      key={m.id}
                      style={{
                        background: isDev ? "rgba(99, 102, 241, 0.06)" : "#ffffff",
                        border: isDev ? "1px solid rgba(99, 102, 241, 0.25)" : "1px solid var(--border)",
                        borderRadius: 8,
                        padding: 14,
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span
                            style={{
                              fontWeight: 700,
                              fontSize: 12,
                              color: isDev ? "#4f46e5" : "var(--text)",
                            }}
                          >
                            {isDev ? "🛠️ System / Developer Response" : `👤 ${m.sender_name || "Team Member"}`}
                          </span>
                        </div>
                        <span style={{ fontSize: 11, color: "var(--muted)" }}>{fmtDateTime(m.created_at)}</span>
                      </div>

                      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--text)", whiteSpace: "pre-wrap" }}>
                        {m.message}
                      </p>

                      {m.attachment_url && (
                        <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px dashed var(--border)" }}>
                          {hasImage ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <img
                                src={toMediaUrl(m.attachment_url)}
                                alt="Attachment"
                                style={{
                                  width: 90,
                                  height: 60,
                                  objectFit: "cover",
                                  borderRadius: 4,
                                  border: "1px solid var(--border)",
                                  cursor: "pointer",
                                }}
                                onClick={() => setPreviewImageUrl(toMediaUrl(m.attachment_url))}
                              />
                              <div>
                                <a
                                  href={toMediaUrl(m.attachment_url)}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{
                                    fontSize: 11,
                                    color: "#2563eb",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 3,
                                    textDecoration: "none",
                                    fontWeight: 600,
                                  }}
                                >
                                  Open full image <ExternalLink size={11} />
                                </a>
                              </div>
                            </div>
                          ) : (
                            <a
                              href={toMediaUrl(m.attachment_url)}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                fontSize: 12,
                                color: "#2563eb",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                textDecoration: "none",
                              }}
                            >
                              📎 View / Download Document <ExternalLink size={12} />
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Reply Input Box with Attachment Uploader */}
            <div
              className="card"
              style={{
                marginTop: 8,
                padding: 14,
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: 8,
              }}
            >
              <h5 style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700 }}>Write a Reply / Technical Update</h5>
              <textarea
                rows={3}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type response, developer notes, or further questions here…"
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  fontSize: 13,
                  background: "#ffffff",
                }}
              />

              {onUploadAttachment && (
                <div style={{ marginTop: 8 }}>
                  <EvidenceAttachmentUploader
                    attachment={replyAttachment}
                    onChange={setReplyAttachment}
                    onUpload={onUploadAttachment}
                    disabled={sending}
                    compact
                  />
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                <button
                  type="button"
                  className="btn primary sm"
                  disabled={sending || !replyText.trim()}
                  onClick={handleSendReply}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <Send size={13} /> {sending ? "Sending…" : "Send Reply"}
                </button>
              </div>
            </div>
          </div>
        </DetailDrawer>
      )}

      {/* ═══ IMAGE PREVIEW MODAL ═════════════════════════════════════════ */}
      {previewImageUrl && (
        <Modal title="Image / Screenshot Preview" onClose={() => setPreviewImageUrl(null)} wide>
          <div style={{ textAlign: "center", padding: 10 }}>
            <img
              src={previewImageUrl}
              alt="Screenshot Preview"
              style={{
                maxWidth: "100%",
                maxHeight: "75vh",
                borderRadius: 8,
                border: "1px solid var(--border)",
              }}
            />
            <div style={{ marginTop: 12 }}>
              <a
                href={previewImageUrl}
                target="_blank"
                rel="noreferrer"
                className="btn ghost sm"
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <ExternalLink size={14} /> Open in New Tab
              </a>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
