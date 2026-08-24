"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert, Box, Button, Chip, Dialog, DialogContent, DialogTitle, IconButton, Paper, TextField, Typography } from "@mui/material";
import { QmMarkdown } from "@/components/qm-markdown";
import { apiFetch, csrfFromCookie } from "@/lib/api";
import { toast } from "@/lib/toast";

export function QuartermasterView({
  aiMessages,
  aiPrompt,
  setAiPrompt,
  aiLoading,
  aiError,
  aiResponse,
  aiConversations,
  aiConversationId,
  selectConversation,
  sendAiPrompt,
  clearConversation,
}: {
  aiMessages: { role: "user" | "assistant"; text: string; response?: any }[];
  aiPrompt: string;
  setAiPrompt: (p: string) => void;
  aiLoading: boolean;
  aiError: string;
  aiResponse: any;
  aiConversations: any[];
  aiConversationId: string | null;
  selectConversation: (conversation: any) => void;
  sendAiPrompt: (promptOverride?: string) => Promise<void>;
  clearConversation: () => void;
}) {
  const [showExtractor, setShowExtractor] = useState(false);
  const [extractText, setExtractText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [executingAction, setExecutingAction] = useState<string | null>(null);

  async function handleExtractLease(e: React.FormEvent) {
    e.preventDefault();
    if (!extractText.trim()) return;
    setExtracting(true);
    setExtractedData(null);
    try {
      await apiFetch("/auth/csrf/");
      const res = await apiFetch("/companion/extract-document/", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify({ text: extractText.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setExtractedData(data.extracted);
        toast.success("Document analyzed successfully!");
      } else {
        toast.error(data.error || "Failed to extract document metadata.");
      }
    } catch {
      toast.error("Network error during document extraction.");
    } finally {
      setExtracting(false);
    }
  }

  async function handleExecuteAction(actionType: string, params: Record<string, any>) {
    setExecutingAction(actionType);
    try {
      await apiFetch("/auth/csrf/");
      const res = await apiFetch("/companion/actions/execute/", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": csrfFromCookie() },
        body: JSON.stringify({ action_type: actionType, params }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        toast.success(data.message || "Action executed successfully!");
      } else {
        toast.error(data.error || "Failed to execute action.");
      }
    } catch {
      toast.error("Network error executing action.");
    } finally {
      setExecutingAction(null);
    }
  }

  return (
    <Box sx={{ maxWidth: 1180, mx: "auto", display: "grid", gap: 2 }}>
      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, background: "linear-gradient(120deg, rgba(13,148,136,.14), rgba(15,23,42,.02))" }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 2, flexWrap: "wrap" }}>
          <Box>
            <Typography variant="overline" color="primary" sx={{ fontWeight: 800 }}>COMPANION INTELLIGENCE</Typography>
            <Typography variant="h4" sx={{ fontWeight: 850 }}>Quartermaster</Typography>
            <Typography color="text.secondary" sx={{ mt: .5, maxWidth: 720 }}>Ask questions about your authorized properties, rent collections, tasks and facility operations. Answers are grounded in the selected property and current ERP records.</Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setShowExtractor(true)}
              sx={{ fontWeight: 700, borderColor: "primary.main" }}
            >
              📄 Smart Lease / OCR Extractor
            </Button>
            <Chip label={aiResponse?.agentStatus === "success" ? "AI connected" : "Live ERP grounding"} color={aiResponse?.agentStatus === "success" ? "success" : "primary"} />
          </Box>
        </Box>
      </Paper>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) 280px" }, gap: 2 }}>
        <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden", minHeight: 540, display: "flex", flexDirection: "column" }}>
          <Box aria-live="polite" sx={{ flex: 1, p: { xs: 2, md: 3 }, display: "flex", flexDirection: "column", gap: 1.5, maxHeight: 620, overflowY: "auto" }}>
            {aiMessages.length === 0 ? (
              <Box sx={{ m: "auto", textAlign: "center", maxWidth: 520 }}>
                <Typography sx={{ fontSize: 42 }}>✦</Typography>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>What would you like to know?</Typography>
                <Typography variant="body2" color="text.secondary">Quartermaster combines live ERP figures with operational guidance and human-in-the-loop actions.</Typography>
              </Box>
            ) : (
              aiMessages.map((message, index) => (
                <Box key={`${message.role}-${index}`} sx={{ alignSelf: message.role === "user" ? "flex-end" : "flex-start", maxWidth: "88%" }}>
                  <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2.5, bgcolor: message.role === "user" ? "primary.main" : "action.hover", color: message.role === "user" ? "primary.contrastText" : "text.primary", lineHeight: 1.6 }}>
                    {message.role === "user" ? (
                      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{message.text}</Typography>
                    ) : (
                      <QmMarkdown text={message.text} />
                    )}
                  </Paper>

                  {/* Human-in-the-Loop 1-Click Action Cards */}
                  {message.response?.actionIntent && (
                    <Paper variant="outlined" sx={{ p: 1.5, mt: 1, borderRadius: 2, bgcolor: "background.paper", border: "1.5px solid", borderColor: "primary.main" }}>
                      <Typography variant="caption" sx={{ fontWeight: 800, color: "primary.main", textTransform: "uppercase" }}>
                        ⚡ Suggested Action (Human-in-the-loop)
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, mt: 0.5 }}>
                        {message.response.actionIntent.title || "Execute Proposed Operation"}
                      </Typography>
                      <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
                        <Button
                          size="small"
                          variant="contained"
                          disabled={executingAction === message.response.actionIntent.type}
                          onClick={() => handleExecuteAction(message.response.actionIntent.type, message.response.actionIntent.params || {})}
                          sx={{ fontWeight: 700 }}
                        >
                          {executingAction === message.response.actionIntent.type ? "Executing…" : "✓ Confirm & Execute"}
                        </Button>
                      </Box>
                    </Paper>
                  )}

                  {message.response?.suggestedActions?.length ? (
                    <Box sx={{ display: "flex", gap: .75, flexWrap: "wrap", mt: .75 }}>
                      {message.response.suggestedActions.map((action: any) => (
                        <Button key={action.label} component={Link} href={action.href} size="small" variant="outlined">{action.label}</Button>
                      ))}
                    </Box>
                  ) : null}
                </Box>
              ))
            )}
            {aiLoading && (
              <Box sx={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 1 }}>
                <Chip label="Quartermaster is synthesizing real-time insights…" color="primary" variant="outlined" />
              </Box>
            )}
          </Box>
          <Box component="form" onSubmit={(event) => { event.preventDefault(); void sendAiPrompt(); }} sx={{ p: 2, borderTop: 1, borderColor: "divider", display: "flex", gap: 1, alignItems: "flex-end" }}>
            <TextField multiline maxRows={4} fullWidth label="Ask Quartermaster" placeholder="e.g. Summarize rent collections and overdue work orders" value={aiPrompt} onChange={(event) => setAiPrompt(event.target.value)} disabled={aiLoading} />
            <Button type="submit" variant="contained" size="large" disabled={aiLoading || !aiPrompt.trim()} sx={{ minWidth: 92, minHeight: 52 }}>{aiLoading ? "Working…" : "Send"}</Button>
          </Box>
          {aiError && <Alert severity="error" sx={{ borderRadius: 0 }}>{aiError}</Alert>}
        </Paper>

        <Box sx={{ display: "grid", alignContent: "start", gap: 1.5 }}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
            <Typography sx={{ fontWeight: 800, mb: 1 }}>Past conversations</Typography>
            {aiConversations.length === 0 ? (
              <Typography variant="body2" color="text.secondary">Your Quartermaster conversations will appear here.</Typography>
            ) : (
              <Box sx={{ display: "grid", gap: .75, maxHeight: 220, overflowY: "auto" }}>
                {aiConversations.map((conversation) => (
                  <Button
                    key={conversation.id}
                    variant={conversation.id === aiConversationId ? "contained" : "text"}
                    color={conversation.id === aiConversationId ? "primary" : "inherit"}
                    onClick={() => selectConversation(conversation)}
                    sx={{ justifyContent: "flex-start", textAlign: "left", textTransform: "none" }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>{conversation.title}</Typography>
                      <Typography variant="caption" sx={{ opacity: .75 }}>{conversation.property_name || "Portfolio"}</Typography>
                    </Box>
                  </Button>
                ))}
              </Box>
            )}
          </Paper>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
            <Typography sx={{ fontWeight: 800, mb: 1 }}>Suggested questions</Typography>
            <Box sx={{ display: "grid", gap: 1 }}>
              {[
                ["Rent collections", "Summarize rent collections and outstanding balances for this property"],
                ["Maintenance risks", "Check open work orders, overdue maintenance and critical alerts"],
                ["My priorities", "What should I prioritize from my tasks today?"],
                ["Property snapshot", "Give me a concise operational summary for the selected property"],
              ].map(([label, prompt]) => (
                <Button key={label} variant="text" onClick={() => void sendAiPrompt(prompt)} disabled={aiLoading} sx={{ justifyContent: "flex-start", textAlign: "left" }}>
                  {label}
                </Button>
              ))}
            </Box>
          </Paper>
          <Alert severity="info">QM can analyse records and execute human-confirmed operational actions safely with audit trails.</Alert>
          {aiMessages.length > 0 && <Button variant="outlined" color="inherit" onClick={clearConversation}>Archive conversation</Button>}
        </Box>
      </Box>

      {/* SMART DOCUMENT & LEASE EXTRACTOR DIALOG */}
      <Dialog open={showExtractor} onClose={() => setShowExtractor(false)} fullWidth maxWidth="md">
        <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 800 }}>
          <span>📄 AI Smart Lease &amp; Document Extractor</span>
          <IconButton size="small" onClick={() => setShowExtractor(false)}>×</IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 3, display: "flex", flexDirection: "column", gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Paste lease agreement text or contract clauses below. Quartermaster will extract tenant names, national ID, monthly rent, deposits, and start/end dates.
          </Typography>

          <form onSubmit={handleExtractLease} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <TextField
              required
              multiline
              rows={6}
              value={extractText}
              onChange={(e) => setExtractText(e.target.value)}
              placeholder="Paste contract text, e.g.: 'This Tenancy Agreement is made between Legend Management and Jane Doe (ID: 28475920), Phone: 0722123456. Unit: Office 302, Monthly Rent: KES 45,000, Security Deposit: KES 90,000 commencing on 1st Sept 2026...'"
              fullWidth
            />

            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
              <Button onClick={() => setShowExtractor(false)}>Cancel</Button>
              <Button type="submit" variant="contained" disabled={extracting || !extractText.trim()}>
                {extracting ? "Analyzing Document…" : "✨ Extract Metadata"}
              </Button>
            </Box>
          </form>

          {extractedData && (
            <Paper variant="outlined" sx={{ p: 2, mt: 1, borderRadius: 2, bgcolor: "background.default" }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1, color: "primary.main" }}>
                ✓ Extracted Tenancy Metadata
              </Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5, fontSize: 13 }}>
                <div><strong>Tenant Name:</strong> {extractedData.tenant_name || "—"}</div>
                <div><strong>ID / Passport:</strong> {extractedData.id_number || "—"}</div>
                <div><strong>Phone Number:</strong> {extractedData.phone_number || "—"}</div>
                <div><strong>Email:</strong> {extractedData.email || "—"}</div>
                <div><strong>Monthly Rent:</strong> {extractedData.rent_amount ? `KES ${Number(extractedData.rent_amount).toLocaleString()}` : "—"}</div>
                <div><strong>Deposit:</strong> {extractedData.deposit_amount ? `KES ${Number(extractedData.deposit_amount).toLocaleString()}` : "—"}</div>
                <div><strong>Unit:</strong> {extractedData.unit_name || "—"}</div>
                <div><strong>Commencement:</strong> {extractedData.start_date || "—"}</div>
              </Box>
            </Paper>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
