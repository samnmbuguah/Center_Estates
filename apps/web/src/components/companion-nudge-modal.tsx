"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Button,
  Dialog,
  Typography,
  Paper,
  IconButton,
  Switch,
  FormControlLabel,
  Divider,
  Stack,
} from "@mui/material";
import {
  X,
  Sparkles,
  Heart,
  ArrowRight,
  Settings2,
  Megaphone,
  Smile,
  CheckCircle2,
  ChevronLeft,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";

type AnnouncementData = {
  id?: string;
  title: string;
  message: string;
  category?: string;
  icon?: string;
  action_label?: string;
  action_href?: string;
};

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
  announcement?: AnnouncementData;
};

type NudgePreferences = {
  showOperationalSummary: boolean;
  showQuote: boolean;
  showJokes: boolean;
  showAnnouncements: boolean;
};

const DEFAULT_PREFERENCES: NudgePreferences = {
  showOperationalSummary: true,
  showQuote: true,
  showJokes: true,
  showAnnouncements: true,
};

const STORAGE_KEY = "ce_nudge_ack";
const PREFS_STORAGE_KEY = "ce_nudge_preferences";
const MAX_PER_DAY = 4;
const COOLDOWN_MS = 45 * 60 * 1000; // 45 minutes
const FIRST_DELAY_MS = 55 * 1000; // 55 seconds after login

function loadPreferences(): NudgePreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    return raw ? { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) } : DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function savePreferences(prefs: NudgePreferences) {
  try {
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {}
}

function shouldShowNudge(nudge: NudgeData): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : { count: 0, lastDate: "", lastId: "", lastTime: 0, ackIds: {} as Record<string, number> };
    const today = new Date().toISOString().slice(0, 10);
    if (data.lastDate !== today) {
      data.count = 0;
      data.lastDate = today;
    }
    if (data.count >= MAX_PER_DAY) return false;
    if (Date.now() - (data.lastTime || 0) < COOLDOWN_MS) return false;
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
  const [showSettings, setShowSettings] = useState(false);
  const [prefs, setPrefs] = useState<NudgePreferences>(DEFAULT_PREFERENCES);
  const pollRef = useRef<number | null>(null);
  const isUnauthorizedRef = useRef(false);
  const org = session?.activeOrganizationId;
  const isAuthed = !!session?.user;

  useEffect(() => {
    isUnauthorizedRef.current = false;
  }, [isAuthed, org]);

  useEffect(() => {
    setPrefs(loadPreferences());
  }, []);

  const updatePref = (key: keyof NudgePreferences, value: boolean) => {
    setPrefs((prev) => {
      const updated = { ...prev, [key]: value };
      savePreferences(updated);
      return updated;
    });
  };

  const fetchNudge = useCallback(async () => {
    if (!isAuthed || !org || isUnauthorizedRef.current) return;
    const hourEAT = (new Date().getUTCHours() + 3) % 24;
    if (hourEAT < 7 || hourEAT >= 20) return;
    if (document.visibilityState !== "visible") return;
    if (document.querySelector("input:focus, textarea:focus, [contenteditable]:focus")) return;

    try {
      const res = await apiFetch("/companion/dashboard/nudge/", {}, org);
      if (res.status === 401 || res.status === 403) {
        isUnauthorizedRef.current = true;
        return;
      }
      if (!res.ok) return;
      const data = (await res.json()) as NudgeData;
      if (!data?.id || !data?.title) return;
      if (!shouldShowNudge(data)) return;
      setNudge(data);
      setShowSettings(false);
      setOpen(true);
      requestAnimationFrame(() => setTimeout(() => setAnimateIn(true), 30));
    } catch {}
  }, [isAuthed, org]);

  useEffect(() => {
    (window as unknown as Record<string, unknown>).triggerCompanionNudge = () => {
      localStorage.removeItem(STORAGE_KEY);
      fetchNudge();
      setTimeout(fetchNudge, 400);
    };
    (window as unknown as Record<string, unknown>).clearCompanionNudgeCooldown = () => localStorage.removeItem(STORAGE_KEY);
    return () => {
      delete (window as unknown as Record<string, unknown>).triggerCompanionNudge;
      delete (window as unknown as Record<string, unknown>).clearCompanionNudgeCooldown;
    };
  }, [fetchNudge]);

  useEffect(() => {
    if (!isAuthed) return;
    const firstTimer = window.setTimeout(fetchNudge, FIRST_DELAY_MS);
    const interval = window.setInterval(fetchNudge, COOLDOWN_MS + 5 * 60 * 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
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
    if (nudge && org) {
      apiFetch(
        "/companion/telemetry/",
        {
          method: "POST",
          body: JSON.stringify({
            events: [{ event: "nudge_acknowledged", properties: { nudge_id: nudge.id, category: nudge.category } }],
          }),
        },
        org
      ).catch(() => {});
    }
    setAnimateIn(false);
    setTimeout(() => {
      setOpen(false);
      setNudge(null);
      setShowSettings(false);
    }, 280);
  }, [nudge, org]);

  const handleDismiss = useCallback(() => {
    if (nudge) recordAck(nudge.id);
    setAnimateIn(false);
    setTimeout(() => {
      setOpen(false);
      setNudge(null);
      setShowSettings(false);
    }, 180);
  }, [nudge]);

  const handleAction = useCallback(() => {
    handleAcknowledge();
    if (nudge?.action_href) {
      setTimeout(() => router.push(nudge.action_href as string), 350);
    }
  }, [handleAcknowledge, nudge, router]);

  const handleAnnouncementAction = useCallback((href?: string) => {
    handleAcknowledge();
    if (href) {
      setTimeout(() => router.push(href), 350);
    }
  }, [handleAcknowledge, router]);

  if (!nudge || !open) return null;

  const isWellness = nudge.category === "wellness";
  const isProductivity = nudge.category === "productivity";
  const accent = isWellness ? "var(--color-emerald-strong)" : isProductivity ? "var(--color-indigo)" : "var(--color-warning)";
  const lightAccent = isWellness ? "rgba(16,185,129,0.08)" : isProductivity ? "rgba(79,70,229,0.08)" : "rgba(217,119,6,0.08)";

  return (
    <Dialog
      open={open}
      onClose={handleDismiss}
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: {
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
        },
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
      <Box
        sx={{
          height: 5,
          background: `linear-gradient(90deg, ${accent}, color-mix(in srgb, ${accent} 53%, transparent))`,
          backgroundSize: "200% 100%",
          animation: animateIn ? "shimmer 2.2s linear infinite" : "none",
        }}
      />

      <Box sx={{ p: 3.5, pt: 3, position: "relative" }}>
        {/* Header Controls */}
        <Box sx={{ position: "absolute", top: 12, right: 12, display: "flex", gap: 0.75, zIndex: 2 }}>
          <IconButton
            aria-label="Card display settings"
            onClick={() => setShowSettings((v) => !v)}
            size="small"
            sx={{
              color: showSettings ? accent : "text.secondary",
              bgcolor: showSettings ? lightAccent : "transparent",
              "&:hover": { bgcolor: lightAccent },
            }}
          >
            <Settings2 size={17} />
          </IconButton>
          <IconButton
            aria-label="Close companion nudge"
            onClick={handleDismiss}
            size="medium"
            title="Close"
            sx={{
              width: 36,
              height: 36,
              color: "text.primary",
              bgcolor: "background.paper",
              border: "1px solid",
              borderColor: "divider",
              boxShadow: "0 2px 8px rgba(15,23,42,0.14)",
              "&:hover": { bgcolor: "action.hover", color: "error.main" },
            }}
          >
            <X size={20} strokeWidth={2.5} />
          </IconButton>
        </Box>

        {showSettings ? (
          /* Card Feature Toggles Screen */
          <Box sx={{ py: 1 }}>
            <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 1.5 }}>
              <IconButton size="small" onClick={() => setShowSettings(false)}>
                <ChevronLeft size={18} />
              </IconButton>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, fontSize: "0.95rem" }}>
                Customize Card Features
              </Typography>
            </Stack>
            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 2 }}>
              Toggle which sections you would like to display on your daily Companion card.
            </Typography>

            <Divider sx={{ mb: 1.5 }} />

            <Stack spacing={1.2}>
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={prefs.showOperationalSummary}
                    onChange={(e) => updatePref("showOperationalSummary", e.target.checked)}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, fontSize: "0.85rem" }}>
                      Operational Task Summary
                    </Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.74rem" }}>
                      Active tasks count & workload status
                    </Typography>
                  </Box>
                }
              />

              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={prefs.showAnnouncements}
                    onChange={(e) => updatePref("showAnnouncements", e.target.checked)}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, fontSize: "0.85rem" }}>
                      Company Announcements & Ads
                    </Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.74rem" }}>
                      Company-wide campaigns & updates
                    </Typography>
                  </Box>
                }
              />

              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={prefs.showJokes}
                    onChange={(e) => updatePref("showJokes", e.target.checked)}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, fontSize: "0.85rem" }}>
                      “Just for Smiles” Humor Box
                    </Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.74rem" }}>
                      Lighthearted estate & property jokes
                    </Typography>
                  </Box>
                }
              />

              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={prefs.showQuote}
                    onChange={(e) => updatePref("showQuote", e.target.checked)}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, fontSize: "0.85rem" }}>
                      Thoughtful Quote / Inspiration
                    </Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.74rem" }}>
                      Encouraging wellness thoughts
                    </Typography>
                  </Box>
                }
              />
            </Stack>

            <Box sx={{ mt: 2.5 }}>
              <Button
                fullWidth
                variant="contained"
                onClick={() => setShowSettings(false)}
                sx={{
                  borderRadius: 2.5,
                  py: 1,
                  textTransform: "none",
                  fontWeight: 700,
                  bgcolor: accent,
                  "&:hover": { bgcolor: accent, filter: "brightness(0.92)" },
                }}
              >
                Done Customizing
              </Button>
            </Box>
          </Box>
        ) : (
          /* Standard Rich Card View */
          <>
            {/* Companion avatar */}
            <Box sx={{ display: "flex", justifyContent: "center", mb: 1.5 }}>
              <Box
                sx={{
                  width: 58,
                  height: 58,
                  borderRadius: "50%",
                  background: lightAccent,
                  border: `2px solid color-mix(in srgb, ${accent} 16%, transparent)`,
                  display: "grid",
                  placeItems: "center",
                  fontSize: 28,
                  boxShadow: `0 4px 14px color-mix(in srgb, ${accent} 15%, transparent)`,
                  animation:
                    nudge.animation === "breathe"
                      ? "breathe 3s ease-in-out infinite"
                      : nudge.animation === "float"
                      ? "float 3.2s ease-in-out infinite"
                      : nudge.animation === "pulse"
                      ? "pulse-glow 2.4s ease-in-out infinite"
                      : isProductivity
                      ? "breathe 2.6s ease-in-out infinite"
                      : "breathe 3s ease-in-out infinite",
                }}
              >
                {nudge.icon}
              </Box>
            </Box>

            {/* Operational Task Summary Card (with integrated action button) */}
            {prefs.showOperationalSummary && (
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  mb: 1.5,
                  borderRadius: 2.75,
                  bgcolor: "rgba(248, 250, 252, 0.88)",
                  border: "1px solid rgba(226, 232, 240, 0.95)",
                  textAlign: "center",
                }}
              >
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 800,
                    lineHeight: 1.3,
                    mb: 0.75,
                    color: "text.primary",
                    fontSize: "1.08rem",
                  }}
                >
                  {nudge.title}
                </Typography>

                <Typography
                  variant="body2"
                  sx={{
                    color: "text.secondary",
                    lineHeight: 1.55,
                    mb: 1.75,
                    fontSize: "0.86rem",
                    px: 0.5,
                  }}
                >
                  {nudge.message}
                </Typography>

                <Button
                  fullWidth
                  variant="contained"
                  size="medium"
                  onClick={handleAction}
                  endIcon={<ArrowRight size={15} />}
                  sx={{
                    borderRadius: 2.25,
                    py: 1,
                    textTransform: "none",
                    fontWeight: 700,
                    fontSize: "0.88rem",
                    boxShadow: `0 4px 14px color-mix(in srgb, ${accent} 20%, transparent)`,
                    bgcolor: accent,
                    "&:hover": {
                      bgcolor: accent,
                      filter: "brightness(0.93)",
                      boxShadow: `0 6px 18px color-mix(in srgb, ${accent} 25%, transparent)`,
                    },
                  }}
                >
                  {nudge.action_label || "Explore Workspace"}
                </Button>
              </Paper>
            )}

            {/* Thoughtful quote */}
            {prefs.showQuote && nudge.thought && (
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.75, mb: 1.5, px: 1 }}>
                <Heart size={13} style={{ color: accent, opacity: 0.9 }} />
                <Typography
                  variant="caption"
                  sx={{ fontStyle: "italic", color: "text.secondary", fontWeight: 600, textAlign: "center", fontSize: "0.78rem" }}
                >
                  {nudge.thought}
                </Typography>
              </Box>
            )}

            {/* Company Announcement Sub-section (no redundant title) */}
            {prefs.showAnnouncements && nudge.announcement && (
              <Paper
                elevation={0}
                sx={{
                  p: 1.5,
                  mb: 1.5,
                  borderRadius: 2.5,
                  bgcolor: "rgba(245, 158, 11, 0.08)",
                  border: "1px solid rgba(245, 158, 11, 0.22)",
                }}
              >
                <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
                  <Stack direction="row" sx={{ alignItems: "center", gap: 0.75 }}>
                    <span style={{ fontSize: 15 }}>{nudge.announcement.icon || "📢"}</span>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, fontSize: "0.88rem", color: "text.primary" }}>
                      {nudge.announcement.title}
                    </Typography>
                  </Stack>
                  {nudge.announcement.action_href && (
                    <button
                      onClick={() => handleAnnouncementAction(nudge.announcement?.action_href)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--color-warning)",
                        fontSize: "0.74rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 2,
                        padding: 0,
                      }}
                    >
                      {nudge.announcement.action_label || "View"} →
                    </button>
                  )}
                </Stack>
                <Typography
                  variant="caption"
                  sx={{ color: "text.secondary", lineHeight: 1.45, display: "block", pl: 3.1 }}
                >
                  {nudge.announcement.message}
                </Typography>
              </Paper>
            )}

            {/* Just for Smiles Humor Box */}
            {prefs.showJokes && nudge.joke && (
              <Paper
                elevation={0}
                sx={{
                  p: 1.25,
                  mb: 1,
                  borderRadius: 2.25,
                  bgcolor: "rgba(248,250,252,0.85)",
                  border: "1px dashed",
                  borderColor: "divider",
                  textAlign: "center",
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 800,
                    color: accent,
                    letterSpacing: ".04em",
                    textTransform: "uppercase",
                    fontSize: "0.64rem",
                    display: "block",
                    mb: 0.35,
                  }}
                >
                  Just for smiles
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ fontStyle: "italic", color: "text.secondary", lineHeight: 1.45, fontSize: "0.82rem" }}
                >
                  “{nudge.joke}”
                </Typography>
              </Paper>
            )}
          </>
        )}
      </Box>
    </Dialog>
  );
}
