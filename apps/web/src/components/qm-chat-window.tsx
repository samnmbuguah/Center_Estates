"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Box, Button, Chip, IconButton, Paper, TextField, Typography } from "@mui/material";
import { ArrowUp, ExternalLink, Minimize2, Sparkles, Trash2, X } from "lucide-react";

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
};
type QmMessage = { id: string; role: "user" | "assistant"; text: string; response?: QmResponse };
type StoredConversation = { id: string; messages?: Array<{ id: string; role: "user" | "assistant"; content: string; response_metadata?: QmResponse }> };

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
  const initialSent = useRef("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const send = useCallback(async (question: string) => {
    const clean = question.trim();
    if (!clean || !organizationId || loading) return;
    const userMessage: QmMessage = { id: crypto.randomUUID(), role: "user", text: clean };
    setMessages((current) => [...current, userMessage]);
    setPrompt("");
    setError("");
    setLoading(true);
    try {
      const response = await apiFetch("/companion/dashboard/chat/", {
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
      }, organizationId);
      if (!response.ok) throw new Error(await apiErrorMessage(response, "QM could not answer that question."));
      const answer = await response.json() as QmResponse;
      if (answer.conversationId) setConversationId(answer.conversationId);
      setMessages((current) => [...current, {
        id: crypto.randomUUID(),
        role: "assistant",
        text: String(answer.response || "I could not find an answer in the records available to you."),
        response: answer,
      }]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "QM is temporarily unavailable. Please retry.");
    } finally {
      setLoading(false);
    }
  }, [conversationId, loading, organizationId, pathname, activeProperty]);


  useEffect(() => {
    if (!organizationId) return;
    let active = true;
    setHistoryReady(false);
    apiFetch("/companion/qm-conversations/?is_archived=false", {}, organizationId).then(async (response) => {
      if (!active || !response.ok) return;
      const payload = await response.json() as StoredConversation[] | { results?: StoredConversation[] };
      const conversations = Array.isArray(payload) ? payload : payload.results || [];
      const latest = conversations[0];
      if (!latest) return;
      setConversationId(latest.id);
      setMessages((latest.messages || []).map((message) => ({
        id: message.id, role: message.role, text: message.content,
        response: message.role === "assistant" ? message.response_metadata : undefined,
      })));
    }).catch(() => undefined).finally(() => { if (active) setHistoryReady(true); });
    return () => { active = false; };
  }, [organizationId]);

  useEffect(() => {
    if (!historyReady || !initialPrompt || initialSent.current === initialPrompt) return;
    initialSent.current = initialPrompt;
    void send(initialPrompt);
  }, [historyReady, initialPrompt, send]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  return (
    <Paper
      role="dialog"
      aria-label="Quartermaster AI companion"
      elevation={18}
      sx={{
        position: "fixed",
        right: { xs: 8, sm: 18 },
        bottom: { xs: 8, sm: 18 },
        zIndex: 1400,
        width: { xs: "calc(100vw - 16px)", sm: 410 },
        height: { xs: "min(680px, calc(100dvh - 16px))", sm: 590 },
        borderRadius: { xs: 2.5, sm: 3.5 },
        border: 1,
        borderColor: "divider",
        overflow: "hidden",
        display: visible ? "flex" : "none",
        flexDirection: "column",
      }}
    >
      <Box sx={{ p: 1.5, color: "white", background: "linear-gradient(135deg, #0f766e, #0f172a)", display: "flex", alignItems: "center", gap: 1.25 }}>
        <Box sx={{ width: 38, height: 38, borderRadius: 2, bgcolor: "rgba(255,255,255,.14)", display: "grid", placeItems: "center" }}><Sparkles size={20} /></Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 850, lineHeight: 1.2 }}>Quartermaster</Typography>
          <Typography variant="caption" sx={{ color: "rgba(255,255,255,.78)" }}>Grounded in your role and {activeProperty?.name || "portfolio"}</Typography>
        </Box>
        <IconButton component={Link} href="/companion?tab=qm" size="small" aria-label="Open Quartermaster workspace and chat history" sx={{ color: "white" }}><ExternalLink size={17} /></IconButton>
        <IconButton size="small" aria-label="Minimize Quartermaster" onClick={onMinimize} sx={{ color: "white" }}><Minimize2 size={18} /></IconButton>
        <IconButton size="small" aria-label="Close Quartermaster" onClick={onClose} sx={{ color: "white" }}><X size={18} /></IconButton>
      </Box>

      <Box ref={scrollRef} aria-live="polite" sx={{ flex: 1, overflowY: "auto", p: 1.5, display: "flex", flexDirection: "column", gap: 1.25, bgcolor: "background.default" }}>
        {messages.length === 0 && (
          <Box sx={{ m: "auto", px: 2, textAlign: "center" }}>
            <Sparkles size={34} color="#0d9488" />
            <Typography sx={{ mt: 1, fontWeight: 800 }}>How can I help?</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: .5 }}>Ask about tasks, rent collections, occupancy, work orders or today’s priorities.</Typography>
            <Box sx={{ display: "grid", gap: .75, mt: 2 }}>
              {["Brief me on today’s priorities", "Summarize rent collections", "Show maintenance risks"].map((question) => (
                <Button key={question} size="small" variant="outlined" onClick={() => void send(question)}>{question}</Button>
              ))}
            </Box>
          </Box>
        )}
        {messages.map((message) => (
          <Box key={message.id} sx={{ alignSelf: message.role === "user" ? "flex-end" : "flex-start", maxWidth: "88%" }}>
            <Paper elevation={0} sx={{ p: 1.25, borderRadius: 2.5, bgcolor: message.role === "user" ? "primary.main" : "background.paper", color: message.role === "user" ? "primary.contrastText" : "text.primary", border: message.role === "assistant" ? 1 : 0, borderColor: "divider" }}>
              {message.role === "assistant" ? <QmMarkdown text={message.text} /> : <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{message.text}</Typography>}
            </Paper>
            {message.response?.suggestedActions?.length ? <Box sx={{ display: "flex", flexWrap: "wrap", gap: .5, mt: .6 }}>{message.response.suggestedActions.map((action) => <Chip key={`${message.id}-${action.label}`} component={Link} href={action.href} clickable size="small" label={action.label} />)}</Box> : null}
          </Box>
        ))}
        {loading && <Chip sx={{ alignSelf: "flex-start" }} variant="outlined" color="primary" label="QM is checking your live records…" />}
      </Box>

      {error && <Alert severity="error" action={<Button size="small" color="inherit" onClick={() => setError("")}>Dismiss</Button>} sx={{ borderRadius: 0 }}>{error}</Alert>}
      <Box component="form" onSubmit={(event) => { event.preventDefault(); void send(prompt); }} sx={{ p: 1.25, borderTop: 1, borderColor: "divider", bgcolor: "background.paper" }}>
        <Box sx={{ display: "flex", alignItems: "flex-end", gap: .75 }}>
          <TextField
            autoFocus
            fullWidth
            multiline
            maxRows={4}
            size="small"
            label="Ask QM"
            placeholder="Ask about the work you can access…"
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
          <IconButton type="submit" color="primary" disabled={loading || !prompt.trim()} aria-label="Send question to Quartermaster" sx={{ width: 42, height: 42, bgcolor: "action.hover" }}><ArrowUp size={19} /></IconButton>
        </Box>
        <Box sx={{ mt: .65, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="caption" color="text.secondary">Enter to send · Shift+Enter for a new line</Typography>
          {messages.length > 0 && <Button size="small" color="inherit" startIcon={<Trash2 size={13} />} onClick={async () => { if (conversationId) await apiFetch(`/companion/qm-conversations/${conversationId}/archive/`, { method: "POST" }, organizationId); setConversationId(undefined); setMessages([]); setError(""); }}>Archive</Button>}
        </Box>
      </Box>
    </Paper>
  );
}
