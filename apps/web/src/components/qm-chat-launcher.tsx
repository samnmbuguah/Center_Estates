"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Badge, Box, CircularProgress, Fab, Tooltip } from "@mui/material";
import { Sparkles } from "lucide-react";

const QmChatWindow = dynamic(() => import("@/components/qm-chat-window"), {
  ssr: false,
  loading: () => <Box sx={{ position: "fixed", right: 18, bottom: 82, zIndex: 1400, p: 2 }}><CircularProgress size={26} aria-label="Opening Quartermaster" /></Box>,
});

const LOGIN_BRIEF_KEY = "ce_qm_brief_after_login";
const DAILY_BRIEF_PROMPT = "Give me a concise briefing for today. Prioritize my overdue and urgent tasks, rent or occupancy issues, and critical facility work I am authorized to see. End with the three most useful actions I should take next.";

export function QmChatLauncher({ enabled, organizationId, offsetForSidebar = false }: { enabled: boolean; organizationId: string | null; offsetForSidebar?: boolean }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [initialPrompt, setInitialPrompt] = useState<string>();
  const lastAutomaticHelp = useRef(0);

  useEffect(() => {
    if (!enabled) {
      sessionStorage.removeItem(LOGIN_BRIEF_KEY);
      return;
    }
    if (sessionStorage.getItem(LOGIN_BRIEF_KEY) !== "1") return;
    sessionStorage.removeItem(LOGIN_BRIEF_KEY);
    const reveal = () => {
      setInitialPrompt(DAILY_BRIEF_PROMPT);
      setLoaded(true);
      setOpen(true);
    };
    const windowWithIdle = window as Window & { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    if (windowWithIdle.requestIdleCallback) {
      const id = windowWithIdle.requestIdleCallback(reveal, { timeout: 1800 });
      return () => windowWithIdle.cancelIdleCallback?.(id);
    }
    const timer = window.setTimeout(reveal, 900);
    return () => window.clearTimeout(timer);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const offerAutomaticHelp = (event: Event) => {
      const now = Date.now();
      if (now - lastAutomaticHelp.current < 30_000) return;
      lastAutomaticHelp.current = now;
      const message = (event as CustomEvent<{ message?: string }>).detail?.message || "The last request could not be completed.";
      setInitialPrompt(`I encountered this application error: "${message}" Explain what it means, confirm whether my entered data is retained, and give me the safest next step.`);
      setLoaded(true);
      setOpen(true);
    };
    window.addEventListener("ce:api-error", offerAutomaticHelp);
    return () => window.removeEventListener("ce:api-error", offerAutomaticHelp);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const offerHelp = (event: Event) => {
      const message = (event as CustomEvent<{ message?: string }>).detail?.message;
      setInitialPrompt(message || "Help me understand and resolve the error I just encountered. Explain the safest next step without losing my entered data.");
      setLoaded(true);
      setOpen(true);
    };
    window.addEventListener("ce:qm-help", offerHelp);
    return () => window.removeEventListener("ce:qm-help", offerHelp);
  }, [enabled]);

  if (!enabled) return null;
  return (
    <>
      {!open && <Tooltip title="Ask Quartermaster" placement="left">
        <Fab
          color="primary"
          aria-label="Open Quartermaster AI companion"
          onClick={() => { setInitialPrompt(undefined); setLoaded(true); setOpen(true); }}
          sx={{ position: "fixed", right: 18, bottom: 18, zIndex: 1250, background: "linear-gradient(135deg, #0d9488, #0f172a)", boxShadow: 8 }}
        >
          <Badge color="success" variant="dot" overlap="circular"><Sparkles size={23} /></Badge>
        </Fab>
      </Tooltip>}
      {loaded && <QmChatWindow visible={open} organizationId={organizationId} initialPrompt={initialPrompt} onMinimize={() => setOpen(false)} onClose={() => { setOpen(false); setLoaded(false); setInitialPrompt(undefined); }} />}
    </>
  );
}

export const QM_LOGIN_BRIEF_STORAGE_KEY = LOGIN_BRIEF_KEY;
