"use client";

import { useState } from "react";
import { Badge, DetailDrawer, EmptyState, Field, KpiCard, KpiStrip, Modal, number, Panel, StatusPill } from "@/components/module-ui";
import { FeedbackMessage, FeedbackThread } from "../../types/companion.types";
import { fmtDateTime, PRIORITY_TONE, STATUS_TONE } from "../../utils/companion.utils";

export function TeamDialogueView({
  threads,
  loading,
  activeThread,
  setActiveThread,
  search,
  setSearch,
  categoryFilter,
  setCategoryFilter,
  statusFilter,
  setStatusFilter,
  openNewThreadModal,
  submitReply,
  updateThreadStatus,
}: {
  threads: FeedbackThread[];
  loading: boolean;
  activeThread: FeedbackThread | null;
  setActiveThread: (t: FeedbackThread | null) => void;
  search: string;
  setSearch: (s: string) => void;
  categoryFilter: string;
  setCategoryFilter: (c: string) => void;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  openNewThreadModal: () => void;
  submitReply: (threadId: string, message: string, isDev?: boolean) => Promise<void>;
  updateThreadStatus: (threadId: string, status: "open" | "in_progress" | "resolved" | "closed") => Promise<void>;
}) {
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  const openCount = threads.filter((t) => t.status === "open").length;
  const inProgressCount = threads.filter((t) => t.status === "in_progress").length;
  const resolvedCount = threads.filter((t) => t.status === "resolved").length;
  const bugsCount = threads.filter((t) => t.category === "bug").length;

  const filteredThreads = threads.filter((t) => {
    if (categoryFilter && t.category !== categoryFilter) return false;
    if (statusFilter && t.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchTitle = (t.title || "").toLowerCase().includes(q);
      const matchRef = (t.reference || "").toLowerCase().includes(q);
      const matchAuthor = (t.created_by_name || "").toLowerCase().includes(q);
      return matchTitle || matchRef || matchAuthor;
    }
    return true;
  });

  async function handleSend() {
    if (!activeThread || !replyText.trim() || sending) return;
    setSending(true);
    try {
      await submitReply(activeThread.id, replyText);
      setReplyText("");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <KpiStrip cols={4}>
        <KpiCard icon="💬" iconBg="#e0e7ff" iconColor="#4f46e5" label="All Threads" value={number.format(threads.length)} sub="In-system team dialogue" />
        <KpiCard icon="🐛" iconBg="#fee2e2" iconColor="#b91c1c" label="Bug Reports" value={number.format(bugsCount)} sub="Issues flagged by team" onClick={() => setCategoryFilter(categoryFilter === "bug" ? "" : "bug")} />
        <KpiCard icon="⏳" iconBg="#fef3c7" iconColor="#92400e" label="In Progress" value={number.format(inProgressCount + openCount)} sub="Open feedback items" onClick={() => setStatusFilter(statusFilter === "open" ? "" : "open")} />
        <KpiCard icon="✅" iconBg="#dcfce7" iconColor="#16a34a" label="Resolved" value={number.format(resolvedCount)} sub="Implemented / verified" onClick={() => setStatusFilter(statusFilter === "resolved" ? "" : "resolved")} />
      </KpiStrip>

      <div style={{ display: "grid", gridTemplateColumns: activeThread ? "420px 1fr" : "1fr", gap: 16, alignItems: "start" }}>
        {/* Left Column: Thread List */}
        <Panel
          title="Team Dialogue & Bug Reports"
          badge={filteredThreads.length}
          action={
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn primary sm" onClick={openNewThreadModal}>+ New Dialogue / Report Bug</button>
            </div>
          }
        >
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              type="search"
              placeholder="Search feedback, bug ref, or teammate…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 13 }}
            />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[
                { id: "", label: "All Categories" },
                { id: "bug", label: "🐛 Bugs" },
                { id: "operational", label: "🏢 Operations" },
                { id: "feature", label: "✨ Features" },
                { id: "general", label: "💬 General" },
              ].map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCategoryFilter(c.id)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 20,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                    border: "1px solid",
                    borderColor: categoryFilter === c.id ? "#ea580c" : "var(--border)",
                    background: categoryFilter === c.id ? "rgba(234, 88, 12, 0.1)" : "var(--surface)",
                    color: categoryFilter === c.id ? "#ea580c" : "var(--muted)",
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ maxHeight: "calc(100vh - 380px)", overflowY: "auto", display: "flex", flexDirection: "column" }}>
            {filteredThreads.length === 0 ? (
              <div style={{ padding: 36, textAlign: "center" }}>
                <EmptyState
                  icon="💬"
                  title="No dialogue threads"
                  description="Submit a bug report, operational inquiry, or system feedback directly to the team and developers."
                  action={<button className="btn primary sm" onClick={openNewThreadModal}>+ Start Dialogue</button>}
                />
              </div>
            ) : (
              filteredThreads.map((t) => {
                const isSelected = activeThread?.id === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => setActiveThread(t)}
                    style={{
                      padding: "12px 16px",
                      borderBottom: "1px solid var(--border)",
                      cursor: "pointer",
                      background: isSelected ? "rgba(234, 88, 12, 0.06)" : "transparent",
                      borderLeft: isSelected ? "3px solid #ea580c" : "3px solid transparent",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <span className="mono" style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>{t.reference || "FB-THREAD"}</span>
                      <div style={{ display: "flex", gap: 4 }}>
                        <Badge tone={PRIORITY_TONE[t.priority] || "gray"}>{t.priority}</Badge>
                        <StatusPill value={t.status} tone={STATUS_TONE[t.status] || "gray"} />
                      </div>
                    </div>
                    <strong style={{ fontSize: 13, color: "var(--text)", display: "block", marginBottom: 4 }}>{t.title}</strong>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11, color: "var(--muted)" }}>
                      <span>By <strong>{t.created_by_name || "Team Member"}</strong></span>
                      <span>{fmtDateTime(t.created_at)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Panel>

        {/* Right Column: Active Conversation Feed */}
        {activeThread && (
          <Panel
            title={`${activeThread.reference ? `[${activeThread.reference}] ` : ""}${activeThread.title}`}
            action={
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {activeThread.status !== "resolved" ? (
                  <button className="btn ghost sm" style={{ color: "#16a34a" }} onClick={() => updateThreadStatus(activeThread.id, "resolved")}>
                    ✓ Mark Resolved
                  </button>
                ) : (
                  <button className="btn ghost sm" onClick={() => updateThreadStatus(activeThread.id, "open")}>
                    ↺ Reopen Thread
                  </button>
                )}
                <button className="btn ghost sm" onClick={() => setActiveThread(null)}>✕ Close</button>
              </div>
            }
          >
            {/* Thread Details Header */}
            <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)", background: "var(--surface-2)", display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12 }}>
              <div><span className="muted">Category:</span> <strong>{activeThread.category}</strong></div>
              <div><span className="muted">Priority:</span> <Badge tone={PRIORITY_TONE[activeThread.priority] || "gray"}>{activeThread.priority}</Badge></div>
              <div><span className="muted">Status:</span> <StatusPill value={activeThread.status} tone={STATUS_TONE[activeThread.status] || "gray"} /></div>
              {activeThread.property_name && <div><span className="muted">Property:</span> <strong>{activeThread.property_name}</strong></div>}
            </div>

            {/* Conversation Messages */}
            <div style={{ minHeight: 320, maxHeight: 460, overflowY: "auto", padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
              {(!activeThread.messages || activeThread.messages.length === 0) ? (
                <div style={{ textAlign: "center", color: "var(--muted)", padding: 40 }}>
                  <p style={{ margin: 0, fontSize: 13 }}>No messages in this dialogue yet. Post a comment below.</p>
                </div>
              ) : (
                activeThread.messages.map((m) => {
                  const isDev = Boolean(m.is_developer_response);
                  return (
                    <div
                      key={m.id}
                      style={{
                        alignSelf: isDev ? "flex-start" : "flex-end",
                        maxWidth: "80%",
                        background: isDev ? "var(--surface-2)" : "rgba(234, 88, 12, 0.08)",
                        border: isDev ? "1px solid var(--border)" : "1px solid rgba(234, 88, 12, 0.3)",
                        borderRadius: 10,
                        padding: "10px 14px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: isDev ? "#4f46e5" : "#ea580c" }}>
                          {isDev ? "🛠️ Developer / System Response" : `👤 ${m.sender_name || "Team Member"}`}
                        </span>
                        <span style={{ fontSize: 10, color: "var(--muted)" }}>{fmtDateTime(m.created_at)}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--text)", whiteSpace: "pre-wrap" }}>
                        {m.message}
                      </p>
                      {m.attachment_url && (
                        <div style={{ marginTop: 8 }}>
                          <a href={m.attachment_url} target="_blank" rel="noreferrer" className="btn ghost sm" style={{ fontSize: 11, padding: "2px 8px" }}>
                            📎 View Attachment
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Reply Input Box */}
            <div style={{ padding: "14px 18px", borderTop: "1px solid var(--border)", background: "var(--surface)", display: "flex", gap: 10, alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <textarea
                  rows={2}
                  placeholder="Type a response or update (e.g. error reproduction, resolution notes, questions)…"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13, resize: "none" }}
                />
              </div>
              <button
                className="btn primary"
                onClick={handleSend}
                disabled={!replyText.trim() || sending}
                style={{ padding: "10px 18px", height: "fit-content" }}
              >
                {sending ? "Sending…" : "Send Reply"}
              </button>
            </div>
          </Panel>
        )}
      </div>
    </>
  );
}
