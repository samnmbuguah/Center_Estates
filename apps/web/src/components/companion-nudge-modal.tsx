"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Box, Button, Dialog, Typography, Paper, IconButton } from "@mui/material";
import { X, Sparkles, Heart, ArrowRight } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";

type NudgeData = {
  id: string;
  category: string;
  icon: string;
  title: string;
  message: string;
  thought?: string;
  joke?: string;
  animation?: string;
  action_label?: string;
  action_href?: string;
  urgency?: string;
  requires_acknowledgment?: boolean;
};

const STORAGE_KEY = "ce_nudge_ack";
const MAX_PER_DAY = 4;
const COOLDOWN_MS = 45 * 60 * 1000; // 45 minutes
const FIRST_DELAY_MS = 55 * 1000; // 55 seconds after login

function shouldShowNudge(nudge: NudgeData): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : { count: 0, lastDate: "", lastId: "", lastTime: 0, ackIds: {} as Record<string, number> };
    const today = new Date().toISOString().slice(0, 10);
    // Reset daily count
    if (data.lastDate !== today) {
      data.count = 0;
      data.lastDate = today;
    }
    if (data.count >= MAX_PER_DAY) return false;
    if (Date.now() - (data.lastTime || 0) < COOLDOWN_MS) return false;
    // Don't show same nudge within 4 hours
    const lastAckForId = data.ackIds?.[nudge.id] || 0;
    if (Date.now() - lastAckForId < 4 * 60 * 60 * 1000) return false;
    return true;
  } catch {
    return true;
  }
}

function recordAck(nudgeId: string) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : { count: 0, lastDate: "", lastId: "", lastTime: 0, ackIds: {} };
    const today = new Date().toISOString().slice(0, 10);
    if (data.lastDate !== today) {
      data.count = 0;
      data.lastDate = today;
      data.ackIds = {};
    }
    data.count = (data.count || 0) + 1;
    data.lastId = nudgeId;
    data.lastTime = Date.now();
    data.ackIds = data.ackIds || {};
    data.ackIds[nudgeId] = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

export function CompanionNudgeModal() {
  const { session } = useAuth();
  const router = useRouter();
  const [nudge, setNudge] = useState<NudgeData | null>(null);
  const [open, setOpen] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  const pollRef = useRef<number | null>(null);
  const org = session?.activeOrganizationId;
  const isAuthed = !!session?.user;

  const fetchNudge = useCallback(async () => {
    if (!isAuthed || !org) return;
    // Respect working hours 7am-8pm EAT (4am-5pm UTC)
    const hourEAT = (new Date().getUTCHours() + 3) % 24;
    if (hourEAT < 7 || hourEAT >= 20) return;
    // Don't disturb if modal already open or user is typing
    if (document.visibilityState !== "visible") return;
    if (document.querySelector("input:focus, textarea:focus, [contenteditable]:focus")) return;

    try {
      const res = await apiFetch("/companion/dashboard/nudge/", {}, org);
      if (!res.ok) return;
      const data = (await res.json()) as NudgeData;
      if (!data?.id || !data?.title) return;
      if (!shouldShowNudge(data)) return;
      setNudge(data);
      setOpen(true);
      requestAnimationFrame(() => setTimeout(() => setAnimateIn(true), 30));
    } catch {}
  }, [isAuthed, org]);

  // Initial delay + periodic poll
  useEffect(() => {
    if (!isAuthed) return;
    const firstTimer = window.setTimeout(fetchNudge, FIRST_DELAY_MS);
    const interval = window.setInterval(fetchNudge, COOLDOWN_MS + 5 * 60 * 1000);
    // Also fetch when tab becomes visible after being hidden
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        // gentle check, not immediate to avoid spam
        setTimeout(fetchNudge, 4000);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(firstTimer);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [fetchNudge, isAuthed]);

  const handleAcknowledge = useCallback(() => {
    if (nudge) recordAck(nudge.id);
    // Also tell backend for analytics (fire-and-forget)
    if (nudge && org) {
      apiFetch("/companion/telemetry/", { method: "POST", body: JSON.stringify({ events: [{ event: "nudge_acknowledged", properties: { nudge_id: nudge.id, category: nudge.category } }] }) }, org).catch(() => {});
    }
    setAnimateIn(false);
    setTimeout(() => {
      setOpen(false);
      setNudge(null);
    }, 280);
  }, [nudge, org]);

  const handleAction = useCallback(() => {
    handleAcknowledge();
    if (nudge?.action_href) {
      setTimeout(() => router.push(nudge.action_href as string), 350);
    }
  }, [handleAcknowledge, nudge, router]);

  if (!nudge || !open) return null;

  const isWellness = nudge.category === "wellness";
  const isProductivity = nudge.category === "productivity";
  const accent = isWellness ? "#059669" : isProductivity ? "#4f46e5" : "#d97706";
  const lightAccent = isWellness ? "rgba(16,185,129,0.08)" : isProductivity ? "rgba(79,70,229,0.08)" : "rgba(217,119,6,0.08)";

  return (
    <Dialog
      open={open}
      onClose={() => {}} // Block backdrop/escape — must acknowledge
      disableEscapeKeyDown
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 4,
          overflow: "hidden",
          p: 0,
          m: 2,
          maxWidth: 460,
          boxShadow: "0 24px 64px rgba(0,0,0,0.22), 0 8px 24px rgba(0,0,0,0.12)",
          transform: animateIn ? "scale(1) translateY(0)" : "scale(0.94) translateY(12px)",
          opacity: animateIn ? 1 : 0,
          transition: "transform 420ms cubic-bezier(0.34,1.56,0.64,1), opacity 280ms ease",
        },
      }}
      slotProps={{
        backdrop: {
          sx: {
            backdropFilter: "blur(10px)",
            backgroundColor: "rgba(15,23,42,0.42)",
            transition: "backdrop-filter 300ms ease",
          },
        },
      }}
    >
      <style>{`
        @keyframes breathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.08); } }
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes pulse-glow { 0%,100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.2); } 50% { box-shadow: 0 0 0 12px rgba(16,185,129,0); } }
        @keyframes confetti-fall { 0% { transform: translateY(-20px) rotate(0deg); opacity: 1; } 100% { transform: translateY(80px) rotate(720deg); opacity: 0; } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
      `}</style>

      {/* Top accent bar */}
      <Box sx={{ height: 5, background: `linear-gradient(90deg, ${accent}, ${accent}88)`, backgroundSize: "200% 100%", animation: animateIn ? "shimmer 2.2s linear infinite" : "none" }} />

      {/* Confetti for productivity nudges */}
      {isProductivity && animateIn && (
        <Box sx={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
          {["🎉","✨","🎈","⭐","🌟"].map((e, i) => (
            <Box key={i} sx={{
              position: "absolute",
              left: `${18 + i * 16}%`,
              top: 12,
              fontSize: 18,
              animation: `confetti-fall ${1.2 + i * 0.25}s ease-out ${i * 0.12}s both`,
            }}>{e}</Box>
          ))}
        </Box>
      )}

      <Box sx={{ p: 3.5, pt: 3, position: "relative" }}>
        {/* Companion avatar with animation */}
        <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
          <Box sx={{
            width: 72, height: 72, borderRadius: "50%",
            background: lightAccent,
            border: `2px solid ${accent}22`,
            display: "grid", placeItems: "center",
            fontSize: 34,
            animation: nudge.animation === "breathe" ? "breathe 3s ease-in-out infinite" : nudge.animation === "float" ? "float 3.2s ease-in-out infinite" : nudge.animation === "pulse" ? "pulse-glow 2.4s ease-in-out infinite" : isProductivity ? "breathe 2.6s ease-in-out infinite" : "breathe 3s ease-in-out infinite",
          }}>
            {nudge.icon}
          </Box>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1, mb: 1.2 }}>
          <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.6, px: 1.25, py: 0.4, borderRadius: 99, bgcolor: lightAccent, border: `1px solid ${accent}18` }}>
            <Sparkles size={12} style={{ color: accent }} />
            <Typography variant="caption" sx={{ fontWeight: 800, fontSize: "0.68rem", letterSpacing: ".06em", textTransform: "uppercase", color: accent }}>
              Companion Nudge · {nudge.category}
            </Typography>
          </Box>
        </Box>

        <Typography variant="h6" sx={{ fontWeight: 900, textAlign: "center", lineHeight: 1.25, mb: 1, color: "text.primary", fontSize: "1.15rem" }}>
          {nudge.title}
        </Typography>

        <Typography variant="body2" sx={{ color: "text.secondary", textAlign: "center", lineHeight: 1.6, mb: 1.5, px: 1 }}>
          {nudge.message}
        </Typography>

        {nudge.thought && (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.75, mb: 1.75, px: 1 }}>
            <Heart size={13} style={{ color: accent, opacity: 0.9 }} />
            <Typography variant="caption" sx={{ fontStyle: "italic", color: "text.secondary", fontWeight: 600, textAlign: "center" }}>
              {nudge.thought}
            </Typography>
          </Box>
        )}

        {nudge.joke && (
          <Paper elevation={0} sx={{ p: 1.5, mb: 2.25, borderRadius: 2.5, bgcolor: "rgba(248,250,252,0.9)", border: "1px dashed", borderColor: "divider", textAlign: "center" }}>
            <Typography variant="caption" sx={{ fontWeight: 800, color: accent, letterSpacing: ".04em", textTransform: "uppercase", fontSize: "0.66rem", display: "block", mb: 0.5 }}>
              Just for smiles
            </Typography>
            <Typography variant="body2" sx={{ fontStyle: "italic", color: "text.secondary", lineHeight: 1.5, fontSize: "0.86rem" }}>
              “{nudge.joke}”
            </Typography>
          </Paper>
        )}

        <Button
          fullWidth
          variant="contained"
          size="large"
          onClick={handleAction}
          endIcon={<ArrowRight size={16} />}
          sx={{
            borderRadius: 2.5,
            py: 1.35,
            textTransform: "none",
            fontWeight: 800,
            fontSize: "0.92rem",
            boxShadow: `0 8px 20px ${accent}30`,
            bgcolor: accent,
            "&:hover": { bgcolor: accent, filter: "brightness(0.92)", boxShadow: `0 10px 24px ${accent}38` },
          }}
        >
          {nudge.action_label || "Got it, thanks"}
        </Button>

        <Box sx={{ display: "flex", justifyContent: "center", mt: 1.25 }}>
          <Typography variant="caption" sx={{ color: "text.disabled", fontSize: "0.7rem" }}>
            You’ll see a new thoughtful nudge again in a little while
          </Typography>
        </Box>
      </Box>
    </Dialog>
  );
}
