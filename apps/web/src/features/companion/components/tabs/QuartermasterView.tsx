"use client";

import Link from "next/link";
import { Alert, Box, Button, Chip, Paper, TextField, Typography } from "@mui/material";
import { QmMarkdown } from "@/components/qm-markdown";

export function QuartermasterView({
  aiMessages,
  aiPrompt,
  setAiPrompt,
  aiLoading,
  aiError,
  aiResponse,
  sendAiPrompt,
  clearConversation,
}: {
  aiMessages: { role: "user" | "assistant"; text: string; response?: any }[];
  aiPrompt: string;
  setAiPrompt: (p: string) => void;
  aiLoading: boolean;
  aiError: string;
  aiResponse: any;
  sendAiPrompt: (promptOverride?: string) => Promise<void>;
  clearConversation: () => void;
}) {
  return (
    <Box sx={{ maxWidth: 1180, mx: "auto", display: "grid", gap: 2 }}>
      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, background: "linear-gradient(120deg, rgba(13,148,136,.14), rgba(15,23,42,.02))" }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 2, flexWrap: "wrap" }}>
          <Box>
            <Typography variant="overline" color="primary" sx={{ fontWeight: 800 }}>COMPANION INTELLIGENCE</Typography>
            <Typography variant="h4" sx={{ fontWeight: 850 }}>Quartermaster</Typography>
            <Typography color="text.secondary" sx={{ mt: .5, maxWidth: 720 }}>Ask questions about your authorized properties, rent collections, tasks and facility operations. Answers are grounded in the selected property and current ERP records.</Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Chip label="Read-only" variant="outlined" />
            <Chip label={aiResponse?.agentStatus === "success" ? "AI provider connected" : "Live ERP grounding"} color={aiResponse?.agentStatus === "success" ? "success" : "primary"} />
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
                <Typography variant="body2" color="text.secondary">Quartermaster combines live ERP figures with operational guidance. It will tell you when information is unavailable instead of inventing an answer.</Typography>
              </Box>
            ) : (
              aiMessages.map((message, index) => (
                <Box key={`${message.role}-${index}`} sx={{ alignSelf: message.role === "user" ? "flex-end" : "flex-start", maxWidth: "86%" }}>
                  <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2.5, bgcolor: message.role === "user" ? "primary.main" : "action.hover", color: message.role === "user" ? "primary.contrastText" : "text.primary", lineHeight: 1.6 }}>
                    {message.role === "user" ? (
                      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{message.text}</Typography>
                    ) : (
                      <QmMarkdown text={message.text} />
                    )}
                  </Paper>
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
              <Box sx={{ alignSelf: "flex-start" }}>
                <Chip label="Quartermaster is analysing live records…" color="primary" variant="outlined" />
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
          <Alert severity="info">QM can analyse and navigate, but it does not create, approve or delete records without an explicit workflow and confirmation.</Alert>
          {aiMessages.length > 0 && <Button variant="outlined" color="inherit" onClick={clearConversation}>Clear conversation</Button>}
        </Box>
      </Box>
    </Box>
  );
}
