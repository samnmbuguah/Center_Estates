"use client";

import { useState } from "react";
import { Badge, DetailDrawer, EmptyState, Field, KpiCard, KpiStrip, Modal, Panel, StatusPill } from "@/components/module-ui";
import { FeedbackMessage, FeedbackThread } from "../../types/companion.types";
import { fmtDateTime, PRIORITY_TONE, STATUS_TONE } from "../../utils/companion.utils";
import { EvidenceAttachmentUploader, type UploadedAttachment } from "../common/EvidenceAttachmentUploader";
import { ExternalLink, Eye, Image as ImageIcon, X } from "lucide-react";

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
  onUploadAttachment,
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
  submitReply: (threadId: string, message: string, attachmentUrl?: string) => Promise<void>;
  updateThreadStatus: (threadId: string, status: "open" | "in_progress" | "resolved" | "closed") => Promise<void>;
  onUploadAttachment?: (file: File) => Promise<{ url: string; name: string; size: number } | null>;
}) {
  const [replyText, setReplyText] = useState("");
  const [replyAttachment, setReplyAttachment] = useState<UploadedAttachment | null>(null);
  const [sending, setSending] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

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
      await submitReply(activeThread.id, replyText, replyAttachment?.url);
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

  return (
    <>
      <KpiStrip cols={4}>
        <KpiCard icon="🐛" iconBg="#fee2e2" iconColor="#b91c1c" label="Bug Reports" value={bugsCount} sub="Issues to fix" onClick={() => setCategoryFilter(categoryFilter === "bug" ? "" : "bug")} />
        <KpiCard icon="⏳" iconBg="#fef3c7" iconColor="#92400e" label="Open Threads" value={openCount} sub="Requires attention" onClick={() => setStatusFilter(statusFilter === "open" ? "" : "open")} />
        <KpiCard icon="🔍" iconBg="#e0f2fe" iconColor="#0284c7" label="In Progress" value={inProgressCount} sub="Being investigated" onClick={() => setStatusFilter(statusFilter === "in_progress" ? "" : "in_progress")} />
        <KpiCard icon="✅" iconBg="#dcfce7" iconColor="#16a34a" label="Resolved" value={resolvedCount} sub="Completed" onClick={() => setStatusFilter(statusFilter === "resolved" ? "" : "resolved")} />
      </KpiStrip>

      {/* Main Container */}
      <div style={{ display: "grid", gridTemplateColumns: activeThread ? "380px 1fr" : "1fr", gap: 16, marginTop: 16 }}>
        {/* Left Column: Thread List */}
        <Panel
          title="Team Conversations & Feedback"
          action={
            <button className="btn primary sm" onClick={openNewThreadModal}>
              + New Dialogue / Report Bug
            </button>
          }
        >
          {/* Filters Bar */}
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              type="text"
              placeholder="Search conversations, topics, references…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2)", fontSize: 13 }}
            />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button
                className={`btn sm ${categoryFilter === "" ? "primary" : "ghost"}`}
                onClick={() => setCategoryFilter("")}
                style={{ fontSize: 11, padding: "3px 8px" }}
              >
                All
              </button>
              <button
                className={`btn sm ${categoryFilter === "bug" ? "primary" : "ghost"}`}
                onClick={() => setCategoryFilter("bug")}
                style={{ fontSize: 11, padding: "3px 8px" }}
              >
                🐛 Bugs
              </button>
              <button
                className={`btn sm ${categoryFilter === "operational" ? "primary" : "ghost"}`}
                onClick={() => setCategoryFilter("operational")}
                style={{ fontSize: 11, padding: "3px 8px" }}
              >
                🏢 Operations
              </button>
              <button
                className={`btn sm ${categoryFilter === "feature" ? "primary" : "ghost"}`}
                onClick={() => setCategoryFilter("feature")}
                style={{ fontSize: 11, padding: "3px 8px" }}
              >
                ✨ Features
              </button>
              <button
                className={`btn sm ${categoryFilter === "general" ? "primary" : "ghost"}`}
                onClick={() => setCategoryFilter("general")}
                style={{ fontSize: 11, padding: "3px 8px" }}
              >
                💬 General
              </button>
            </div>
          </div>

          {/* Threads List */}
          <div style={{ maxHeight: 600, overflowY: "auto" }}>
            {loading ? (
              <div style={{ padding: 32, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Loading dialogues…</div>
            ) : filteredThreads.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                No feedback threads matching filters.
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
                      background: isSelected ? "var(--surface-2)" : "transparent",
                      borderLeft: isSelected ? "3px solid var(--primary)" : "3px solid transparent",
                      transition: "background 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>
                        {t.title}
                      </span>
                      <StatusPill value={t.status} tone={STATUS_TONE[t.status] || "gray"} />
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 11, color: "var(--muted)" }}>
                      <span className="mono" style={{ color: "var(--primary)", fontWeight: 600 }}>{t.reference}</span>
                      <span>·</span>
                      <span>{t.created_by_name || "Team Member"}</span>
                      <span>·</span>
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
                  const hasImage = isImageUrl(m.attachment_url);

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

                      {/* Evidence Attachment rendering */}
                      {m.attachment_url && (
                        <div style={{ marginTop: 10 }}>
                          {hasImage ? (
                            <div
                              style={{
                                display: "inline-block",
                                borderRadius: 8,
                                overflow: "hidden",
                                border: "1px solid var(--border)",
                                background: "#000",
                                cursor: "pointer",
                                maxWidth: 280,
                              }}
                              onClick={() => setPreviewImageUrl(m.attachment_url || null)}
                              title="Click to zoom evidence screenshot"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={m.attachment_url}
                                alt="Evidence Attachment"
                                style={{ display: "block", width: "100%", maxHeight: 180, objectFit: "cover" }}
                              />
                              <div style={{ padding: "4px 8px", background: "var(--surface-2)", fontSize: 11, display: "flex", alignItems: "center", gap: 4, color: "var(--text)" }}>
                                <Eye size={12} /> Click to zoom screenshot
                              </div>
                            </div>
                          ) : (
                            <a
                              href={m.attachment_url}
                              target="_blank"
                              rel="noreferrer"
                              className="btn ghost sm"
                              style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}
                            >
                              📎 View Attached File <ExternalLink size={12} />
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Reply Input Box & Attachment Controls */}
            <div style={{ padding: "14px 18px", borderTop: "1px solid var(--border)", background: "var(--surface)", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                <div style={{ flex: 1 }}>
                  <textarea
                    rows={2}
                    placeholder="Type a response (press Ctrl+V anywhere to paste screenshot evidence directly)…"
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

              {/* Direct Evidence Attachment Uploader in Reply bar */}
              {onUploadAttachment && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <EvidenceAttachmentUploader
                    compact
                    attachment={replyAttachment}
                    onChange={setReplyAttachment}
                    onUpload={onUploadAttachment}
                    disabled={sending}
                  />
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>
                    Press <strong>Enter</strong> to send · <strong>Shift+Enter</strong> for newline
                  </span>
                </div>
              )}
            </div>
          </Panel>
        )}
      </div>

      {/* Global Image Zoom Modal */}
      {previewImageUrl && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
          onClick={() => setPreviewImageUrl(null)}
        >
          <div style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh" }} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPreviewImageUrl(null)}
              style={{
                position: "absolute",
                top: -12,
                right: -12,
                background: "#000",
                color: "#fff",
                border: "2px solid #fff",
                borderRadius: "50%",
                width: 32,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <X size={18} />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewImageUrl}
              alt="Evidence Screenshot Preview"
              style={{ maxWidth: "100%", maxHeight: "85vh", borderRadius: 8, boxShadow: "0 20px 40px rgba(0,0,0,0.6)" }}
            />
          </div>
        </div>
      )}
    </>
  );
}
