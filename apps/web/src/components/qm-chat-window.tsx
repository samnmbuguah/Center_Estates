"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  ArrowUp,
  ExternalLink,
  History,
  Minimize2,
  Pin,
  PinOff,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import { apiErrorMessage, apiFetch } from "@/lib/api";
import { usePropertyContext } from "@/lib/property-context";
import { QmMarkdown } from "@/components/qm-markdown";

type QmAction = { label: string; action: string; href: string };
type QmResponse = {
  response?: string;
  agent?: string;
  agentStatus?: string;
  groundedAt?: string;
  suggestedActions?: QmAction[];
  conversationId?: string;
  toolsExecuted?: string[];
};
type QmMessage = { id: string; role: "user" | "assistant"; text: string; response?: QmResponse };

const TOOL_LABELS: Record<string, { label: string; icon: string }> = {
  finance_data:    { label: "Rent & Arrears",    icon: "💰" },
  facility_data:   { label: "Work Orders",       icon: "🔧" },
  leasing_data:    { label: "Tenancy & Leases",  icon: "📋" },
  team_data:       { label: "HR & Team",         icon: "👥" },
  calendar_events: { label: "Calendar",          icon: "📅" },
  sales_pipeline:  { label: "Sales Pipeline",    icon: "📈" },
  tenant_search:   { label: "Tenant Search",     icon: "🔍" },
};
type StoredConversation = {
  id: string;
  title?: string;
  created_at?: string;
  updated_at?: string;
  property_name?: string;
  messages?: Array<{ id: string; role: "user" | "assistant"; content: string; response_metadata?: QmResponse }>;
};

const PINNED_STORAGE_KEY = "ce_qm_pinned_conversations";

function isTodayDate(dateStr?: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function formatConvDate(dateStr?: string): string {
  if (!dateStr) return "Recent";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Recent";
  if (isTodayDate(dateStr)) {
    return `Today at ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.getFullYear() === yesterday.getFullYear() && d.getMonth() === yesterday.getMonth() && d.getDate() === yesterday.getDate()) {
    return `Yesterday at ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function QmChatWindow({
  organizationId,
  initialPrompt,
  visible,
  onClose,
  onMinimize,
}: {
  organizationId: string | null;
  initialPrompt?: string;
  visible: boolean;
  onClose: () => void;
  onMinimize: () => void;
}) {
  const pathname = usePathname();
  const { activeProperty } = usePropertyContext();
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<QmMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [conversationId, setConversationId] = useState<string>();
  const [historyReady, setHistoryReady] = useState(false);
  const [conversationsList, setConversationsList] = useState<StoredConversation[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem(PINNED_STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  });

  const initialSent = useRef("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const togglePin = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setPinnedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [id, ...prev];
      try {
        localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const startNewChat = () => {
    setConversationId(undefined);
    setMessages([]);
    setError("");
    setShowHistory(false);
  };

  const loadConversation = (conv: StoredConversation) => {
    setConversationId(conv.id);
    setMessages(
      (conv.messages || []).map((message) => ({
        id: message.id,
        role: message.role,
        text: message.content,
        response: message.role === "assistant" ? message.response_metadata : undefined,
      }))
    );
    setError("");
    setShowHistory(false);
  };

  const send = useCallback(
    async (question: string) => {
      const clean = question.trim();
      if (!clean || !organizationId || loading) return;
      const userMessage: QmMessage = { id: crypto.randomUUID(), role: "user", text: clean };
      setMessages((current) => [...current, userMessage]);
      setPrompt("");
      setError("");
      setLoading(true);
      try {
        const response = await apiFetch(
          "/companion/dashboard/chat/",
          {
            method: "POST",
            body: JSON.stringify({
              prompt: clean,
              conversation_id: conversationId,
              page_context: {
                pathname,
                property_id: activeProperty?.id,
                property_name: activeProperty?.name,
              },
            }),
          },
          organizationId
        );
        if (!response.ok) throw new Error(await apiErrorMessage(response, "QM could not answer that question."));
        const answer = (await response.json()) as QmResponse;
        if (answer.conversationId) setConversationId(answer.conversationId);
        setMessages((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text: String(answer.response || "I could not find an answer in the records available to you."),
            response: answer,
          },
        ]);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "QM is temporarily unavailable. Please retry.");
      } finally {
        setLoading(false);
      }
    },
    [conversationId, loading, organizationId, pathname, activeProperty]
  );

  const fetchConversations = useCallback(async () => {
    if (!organizationId) return;
    try {
      const response = await apiFetch("/companion/qm-conversations/?is_archived=false", {}, organizationId);
      if (!response.ok) return;
      const payload = (await response.json()) as StoredConversation[] | { results?: StoredConversation[] };
      const conversations = Array.isArray(payload) ? payload : payload.results || [];
      setConversationsList(conversations);

      // Start fresh every day: only resume automatically if the latest conversation was created today
      const latest = conversations[0];
      if (latest && isTodayDate(latest.created_at)) {
        setConversationId(latest.id);
        setMessages(
          (latest.messages || []).map((message) => ({
            id: message.id,
            role: message.role,
            text: message.content,
            response: message.role === "assistant" ? message.response_metadata : undefined,
          }))
        );
      } else {
        // Daily fresh session
        setConversationId(undefined);
        setMessages([]);
      }
    } catch {
      // ignore
    } finally {
      setHistoryReady(true);
    }
  }, [organizationId]);

  useEffect(() => {
    void fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (!historyReady || !initialPrompt || initialSent.current === initialPrompt) return;
    initialSent.current = initialPrompt;
    void send(initialPrompt);
  }, [historyReady, initialPrompt, send]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!visible) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, visible]);

  const { pinnedConversations, otherConversations } = useMemo(() => {
    const pinned: StoredConversation[] = [];
    const others: StoredConversation[] = [];
    for (const c of conversationsList) {
      if (pinnedIds.includes(c.id)) {
        pinned.push(c);
      } else {
        others.push(c);
      }
    }
    return { pinnedConversations: pinned, otherConversations: others };
  }, [conversationsList, pinnedIds]);

  return (
    <Paper
      role="dialog"
      aria-label="Quartermaster AI companion"
      aria-modal="false"
      elevation={18}
      sx={{
        position: "fixed",
        right: { xs: 8, sm: 18 },
        bottom: { xs: 8, sm: 18 },
        zIndex: 1400,
        width: { xs: "calc(100vw - 16px)", sm: 420 },
        maxWidth: "calc(100vw - 16px)",
        height: "min(610px, calc(100dvh - 16px))",
        maxHeight: "calc(100dvh - 16px)",
        borderRadius: { xs: 2.5, sm: 3.5 },
        border: 1,
        borderColor: "divider",
        overflow: "hidden",
        display: visible ? "flex" : "none",
        flexDirection: "column",
        overscrollBehavior: "contain",
        boxShadow: "0 20px 45px rgba(0,0,0,0.22)",
        "@media (max-width: 600px), (max-height: 700px)": {
          inset: 0,
          width: "100vw",
          maxWidth: "100vw",
          height: "100dvh",
          maxHeight: "100dvh",
          borderRadius: 0,
          border: 0,
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 1.5,
          color: "white",
          background: "linear-gradient(135deg, #0f766e, var(--color-slate-900))",
          display: "flex",
          alignItems: "center",
          gap: 1,
          flexShrink: 0,
        }}
      >
        <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: "rgba(255,255,255,.14)", display: "grid", placeItems: "center" }}>
          <Sparkles size={19} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <Typography sx={{ fontWeight: 850, lineHeight: 1.2, fontSize: 15 }}>Quartermaster</Typography>
            {conversationId && (
              <Tooltip title={pinnedIds.includes(conversationId) ? "Pinned conversation" : "Pin conversation"}>
                <IconButton size="small" onClick={(e) => togglePin(conversationId, e)} sx={{ color: pinnedIds.includes(conversationId) ? "#facc15" : "rgba(255,255,255,0.6)", p: 0.25 }}>
                  <Pin size={14} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
          <Typography variant="caption" sx={{ color: "rgba(255,255,255,.78)", display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {activeProperty?.name || "Daily Briefing & Live Insights"}
          </Typography>
        </Box>

        <Tooltip title="New Chat">
          <IconButton className="qm-secondary-action" size="small" aria-label="Start new chat" onClick={startNewChat} sx={{ color: "white", "@media (max-width: 360px), (max-height: 540px)": { display: "none" } }}>
            <Plus size={18} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Chat History">
          <IconButton className="qm-secondary-action" size="small" aria-label="View past conversations" onClick={() => setShowHistory((h) => !h)} sx={{ color: showHistory ? "#2dd4bf" : "white", "@media (max-width: 360px), (max-height: 540px)": { display: "none" } }}>
            <History size={17} />
          </IconButton>
        </Tooltip>
        <IconButton className="qm-secondary-action" component={Link} href="/companion?tab=qm" size="small" aria-label="Open Quartermaster workspace" sx={{ color: "white", "@media (max-width: 430px), (max-height: 600px)": { display: "none" } }}>
          <ExternalLink size={16} />
        </IconButton>
        <IconButton size="small" aria-label="Minimize" onClick={onMinimize} sx={{ color: "white" }}>
          <Minimize2 size={17} />
        </IconButton>
        <IconButton size="small" aria-label="Close" onClick={onClose} sx={{ color: "white" }}>
          <X size={17} />
        </IconButton>
      </Box>

      {/* History Drawer View */}
      {showHistory ? (
        <Box sx={{ flex: 1, overflowY: "auto", p: 1.5, bgcolor: "background.default", display: "flex", flexDirection: "column" }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Conversation History</Typography>
            <Button size="small" variant="contained" startIcon={<Plus size={14} />} onClick={startNewChat}>
              New Chat
            </Button>
          </Box>

          {pinnedConversations.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.5, px: 1 }}>
                📌 Pinned Chats
              </Typography>
              <List dense sx={{ pt: 0.5 }}>
                {pinnedConversations.map((c) => (
                  <ListItemButton
                    key={c.id}
                    selected={c.id === conversationId}
                    onClick={() => loadConversation(c)}
                    sx={{ borderRadius: 2, mb: 0.5, border: 1, borderColor: c.id === conversationId ? "primary.main" : "divider" }}
                  >
                    <ListItemText
                      primary={<Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>{c.title || c.messages?.[0]?.content?.slice(0, 40) || "Conversation"}</Typography>}
                      secondary={<Typography variant="caption" color="text.secondary">{formatConvDate(c.created_at)}</Typography>}
                    />
                    <IconButton size="small" onClick={(e) => togglePin(c.id, e)} sx={{ color: "var(--color-amber)" }}>
                      <PinOff size={14} />
                    </IconButton>
                  </ListItemButton>
                ))}
              </List>
            </Box>
          )}

          <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.5, px: 1 }}>
            💬 Past Sessions
          </Typography>
          {otherConversations.length === 0 && pinnedConversations.length === 0 ? (
            <Box sx={{ py: 4, textAlign: "center", color: "text.secondary" }}>
              <Typography variant="body2">No past conversations found.</Typography>
            </Box>
          ) : (
            <List dense sx={{ pt: 0.5 }}>
              {otherConversations.map((c) => (
                <ListItemButton
                  key={c.id}
                  selected={c.id === conversationId}
                  onClick={() => loadConversation(c)}
                  sx={{ borderRadius: 2, mb: 0.5, border: 1, borderColor: c.id === conversationId ? "primary.main" : "transparent" }}
                >
                  <ListItemText
                    primary={<Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{c.title || c.messages?.[0]?.content?.slice(0, 40) || "Conversation"}</Typography>}
                    secondary={<Typography variant="caption" color="text.secondary">{formatConvDate(c.created_at)}</Typography>}
                  />
                  <IconButton size="small" onClick={(e) => togglePin(c.id, e)} sx={{ color: "text.secondary" }}>
                    <Pin size={14} />
                  </IconButton>
                </ListItemButton>
              ))}
            </List>
          )}

        </Box>
      ) : (
        /* Chat Messages View */
        <Box
          ref={scrollRef}
          aria-live="polite"
          sx={{
            flex: 1,
            overflowY: "auto",
            p: 1.5,
            display: "flex",
            flexDirection: "column",
            gap: 1.25,
            bgcolor: "background.default",
          }}
        >
          {messages.length === 0 && (
            <Box sx={{ m: "auto", px: 2, textAlign: "center", py: 3 }}>
              <Sparkles size={34} color="var(--color-teal)" />
              <Typography sx={{ mt: 1, fontWeight: 800, fontSize: 16 }}>Good day! How can I assist you?</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Ask about rent collections, outstanding tasks, tenancy notices, or facility work orders.
              </Typography>
              <Box sx={{ display: "grid", gap: 0.75, mt: 2.5 }}>
                {["Brief me on today's priorities", "Summarize rent collections", "Show maintenance risks", "Check occupancy status"].map(
                  (question) => (
                    <Button key={question} size="small" variant="outlined" sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600 }} onClick={() => void send(question)}>
                      {question}
                    </Button>
                  )
                )}
              </Box>
            </Box>
          )}

          {messages.map((message) => (
            <Box key={message.id} sx={{ alignSelf: message.role === "user" ? "flex-end" : "flex-start", maxWidth: { xs: "96%", sm: "88%" }, minWidth: 0 }}>
              <Paper
                elevation={0}
                sx={{
                  p: 1.25,
                  borderRadius: 2.5,
                  bgcolor: message.role === "user" ? "primary.main" : "background.paper",
                  color: message.role === "user" ? "primary.contrastText" : "text.primary",
                  border: message.role === "assistant" ? 1 : 0,
                  borderColor: "divider",
                }}
              >
                {message.role === "assistant" ? (
                  <QmMarkdown text={message.text} />
                ) : (
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                    {message.text}
                  </Typography>
                )}
              </Paper>
              {/* Read-only provenance badges — these describe the sources QM queried. */}
              {message.role === "assistant" && message.response?.toolsExecuted?.length ? (
                <Box aria-label="Data sources checked by Quartermaster" sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.75, alignItems: "center" }}>
                  <Typography variant="caption" sx={{ color: "text.disabled", fontSize: 10, mr: 0.25 }}>
                    Sources checked (reference only):
                  </Typography>
                  {message.response.toolsExecuted.map((tool) => {
                    const meta = TOOL_LABELS[tool] ?? { label: tool, icon: "📦" };
                    return (
                      <Chip
                        key={tool}
                        size="small"
                        variant="outlined"
                        label={`${meta.icon} ${meta.label}`}
                        sx={{
                          height: 22,
                          fontSize: 10,
                          fontWeight: 600,
                          bgcolor: "rgba(13,148,136,0.04)",
                          color: "text.secondary",
                          borderColor: "divider",
                          "& .MuiChip-label": { px: 0.75 },
                        }}
                      />
                    );
                  })}
                </Box>
              ) : null}
              {message.response?.suggestedActions?.length ? (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.6 }}>
                  {message.response.suggestedActions.map((action) => (
                    <Chip key={`${message.id}-${action.label}`} component={Link} href={action.href} clickable size="small" label={action.label} />
                  ))}
                </Box>
              ) : null}
            </Box>
          ))}
          {loading && <Chip sx={{ alignSelf: "flex-start" }} variant="outlined" color="primary" label="QM is checking live records…" />}
        </Box>
      )}

      {error && (
        <Alert severity="error" action={<Button size="small" color="inherit" onClick={() => setError("")}>Dismiss</Button>} sx={{ borderRadius: 0 }}>
          {error}
        </Alert>
      )}

      {/* Input Area */}
      {!showHistory && (
        <Box component="form" onSubmit={(event) => { event.preventDefault(); void send(prompt); }} sx={{ p: 1.25, borderTop: 1, borderColor: "divider", bgcolor: "background.paper" }}>
          <Box sx={{ display: "flex", alignItems: "flex-end", gap: 0.75 }}>
            <TextField
              autoFocus
              fullWidth
              multiline
              maxRows={4}
              size="small"
              label="Ask QM"
              placeholder="Ask about properties, leases, maintenance…"
              value={prompt}
              disabled={loading}
              slotProps={{ htmlInput: { maxLength: 2000 } }}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send(prompt);
                }
              }}
            />
            <IconButton type="submit" color="primary" disabled={loading || !prompt.trim()} aria-label="Send question" sx={{ width: 42, height: 42, bgcolor: "action.hover" }}>
              <ArrowUp size={19} />
            </IconButton>
          </Box>
          <Box sx={{ mt: 0.65, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Typography variant="caption" color="text.secondary" sx={{ "@media (max-width: 430px), (max-height: 540px)": { display: "none" } }}>
              Enter to send · Shift+Enter for new line
            </Typography>
            {messages.length > 0 && (
              <Button
                size="small"
                color="inherit"
                startIcon={<Trash2 size={13} />}
                onClick={async () => {
                  if (conversationId) {
                    await apiFetch(`/companion/qm-conversations/${conversationId}/archive/`, { method: "POST" }, organizationId);
                  }
                  startNewChat();
                  void fetchConversations();
                }}
              >
                Archive
              </Button>
            )}
          </Box>
        </Box>
      )}
    </Paper>
  );
}
