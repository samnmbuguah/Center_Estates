"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Badge, Box, IconButton, Typography, Chip,
  Divider, Paper, List, ListItem, ListItemText, ListItemIcon,
  Button, Tooltip, Popover
} from "@mui/material";
import { 
  Bell, Check, Settings, Trash2,
  Clock, AlertTriangle, Info, CheckCircle, XCircle, Volume2
} from "lucide-react";
import { apiErrorMessage, apiFetch } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { toast } from "@/lib/toast";

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  level: "info" | "success" | "warning" | "urgent";
  action_url?: string;
  read_at?: string | null;
  created_at: string;
  metadata?: Record<string, unknown>;
}

export function NotificationCenter() {
  const { session } = useAuth();
  const organizationId = session?.activeOrganizationId ?? null;
  const router = useRouter();

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<"all" | "unread" | "urgent">("all");
  const [loading, setLoading] = useState(false);
  const [toastAlert, setToastAlert] = useState<NotificationItem | null>(null);
  const [showPermissionBanner, setShowPermissionBanner] = useState(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return false;
    return window.Notification.permission === "default" && !localStorage.getItem("ce_notif_prompt_dismissed");
  });

  const seenIdsRef = useRef<Set<string>>(new Set());
  const pollingStoppedRef = useRef(false);

  const requestBrowserPermission = async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      const result = await window.Notification.requestPermission();
      setShowPermissionBanner(false);
      if (result === "granted") {
        new window.Notification("Center Estates Notifications Enabled", {
          body: "You will now receive real-time alerts for M-Pesa payments, task escalations, and critical facility events.",
          icon: "/favicon.ico",
        });
      }
    }
  };

  const dismissPermissionBanner = () => {
    setShowPermissionBanner(false);
    if (typeof window !== "undefined") {
      localStorage.setItem("ce_notif_prompt_dismissed", "true");
    }
  };

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!organizationId || pollingStoppedRef.current) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    try {
      const res = await apiFetch("/notifications/", {}, organizationId);
      if (res.status === 401 || res.status === 403) {
        pollingStoppedRef.current = true;
        return;
      }
      if (res.ok) {
        const data = await res.json();
        const items: NotificationItem[] = data.results || (Array.isArray(data) ? data : []);
        
        // Detect new unread urgent or success items for in-app toast
        if (seenIdsRef.current.size > 0) {
          const newItems = items.filter(i => !seenIdsRef.current.has(i.id) && !i.read_at);
          if (newItems.length > 0) {
            const urgentItem = newItems.find(i => i.level === "urgent" || i.level === "warning") || newItems[0];
            setToastAlert(urgentItem);
            // Trigger browser notification if permitted
            if (typeof window !== "undefined" && "Notification" in window && window.Notification.permission === "granted") {
              new window.Notification(urgentItem.title, {
                body: urgentItem.message,
                icon: "/favicon.ico",
              });
            }
          }
        }

        items.forEach(i => seenIdsRef.current.add(i.id));
        setNotifications(items);
      }
    } catch {
      // Graceful fallback
    }
  }, [organizationId]);

  useEffect(() => {
    pollingStoppedRef.current = false;
    // The workspace should become usable before non-critical notification
    // polling competes for an API worker. The bell stays available and begins
    // loading shortly afterwards.
    const initialFetch = window.setTimeout(() => void fetchNotifications(), 3_000);
    const interval = setInterval(() => void fetchNotifications(), 60_000);
    return () => {
      window.clearTimeout(initialFetch);
      clearInterval(interval);
    };
  }, [fetchNotifications]);

  const unreadCount = notifications.filter(n => !n.read_at).length;
  const filteredNotifications = notifications.filter(n => {
    if (filter === "all") return true;
    if (filter === "unread") return !n.read_at;
    if (filter === "urgent") return n.level === "urgent" || n.level === "warning";
    return true;
  });

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!organizationId) return;
    const previous = notifications.find((notification) => notification.id === id)?.read_at ?? null;
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
    try {
      const response = await apiFetch(`/notifications/${id}/mark-read/`, { method: "POST" }, organizationId);
      if (!response.ok) throw new Error(await apiErrorMessage(response, "This notification could not be marked as read."));
    } catch (error) {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: previous } : n));
      toast.error(error instanceof Error ? error.message : "This notification could not be marked as read.");
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!organizationId) return;
    const previous = new Map(notifications.map((notification) => [notification.id, notification.read_at]));
    setNotifications(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })));
    try {
      const response = await apiFetch("/notifications/mark-all-read/", { method: "POST" }, organizationId);
      if (!response.ok) throw new Error(await apiErrorMessage(response, "Notifications could not be marked as read."));
    } catch (error) {
      setNotifications(prev => prev.map(n => ({ ...n, read_at: previous.get(n.id) ?? null })));
      toast.error(error instanceof Error ? error.message : "Notifications could not be marked as read.");
    }
  };

  const handleNotificationClick = (item: NotificationItem) => {
    if (!item.read_at) {
      handleMarkAsRead(item.id);
    }
    setAnchorEl(null);
    if (item.action_url) {
      router.push(item.action_url);
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case "success": return <CheckCircle size={18} style={{ color: "var(--color-green)" }} />;
      case "urgent":
      case "warning": return <AlertTriangle size={18} style={{ color: "var(--color-danger)" }} />;
      case "info": default: return <Info size={18} style={{ color: "var(--color-blue)" }} />;
    }
  };

  const formatTime = (iso: string) => {
    try {
      const date = new Date(iso);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      if (minutes < 1) return "Just now";
      if (minutes < 60) return `${minutes}m ago`;
      if (hours < 24) return `${hours}h ago`;
      return date.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
    } catch {
      return "Recently";
    }
  };

  return (
    <>
      {/* Bell Trigger Button */}
      <Tooltip title="Notifications & Operational Alerts">
        <IconButton
          onClick={(e) => setAnchorEl(e.currentTarget)}
          aria-haspopup="true"
          sx={{
            width: 40,
            height: 40,
            borderRadius: "10px",
            border: "1px solid var(--border, rgba(255,255,255,0.1))",
            color: unreadCount > 0 ? "var(--primary, var(--color-blue))" : "var(--muted, var(--color-slate-400))",
            background: unreadCount > 0 ? "rgba(59, 130, 246, 0.08)" : "transparent",
            "&:hover": {
              background: "rgba(59, 130, 246, 0.15)",
            },
          }}
        >
          <Badge
            badgeContent={unreadCount}
            color="error"
            max={99}
            sx={{
              "& .MuiBadge-badge": {
                fontWeight: 800,
                fontSize: 10,
                height: 18,
                minWidth: 18,
                boxShadow: "0 0 8px rgba(239, 68, 68, 0.6)",
              },
            }}
          >
            <Bell size={19} />
          </Badge>
        </IconButton>
      </Tooltip>

      {/* Popover Menu */}
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              width: 390,
              maxHeight: 520,
              borderRadius: "14px",
              boxShadow: "0 18px 48px rgba(15, 23, 42, 0.25)",
              border: "1px solid var(--border, var(--color-slate-200))",
              background: "var(--surface, #ffffff)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            },
          },
        }}
      >
        {/* Header */}
        <Box sx={{ p: 2, pb: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border, var(--color-slate-200))" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, fontSize: 15, color: "var(--text, var(--color-slate-900))" }}>
              🔔 Notifications
            </Typography>
            {unreadCount > 0 && (
              <Chip label={`${unreadCount} new`} size="small" color="primary" sx={{ height: 20, fontSize: 10, fontWeight: 700 }} />
            )}
          </Box>
          <Box sx={{ display: "flex", gap: 0.5 }}>
            {unreadCount > 0 && (
              <Button size="small" onClick={handleMarkAllAsRead} sx={{ fontSize: 11, fontWeight: 700, textTransform: "none", py: 0.2 }}>
                Mark all read
              </Button>
            )}
            <IconButton size="small" onClick={() => { setAnchorEl(null); router.push("/settings?tab=notifications"); }} title="Notification Settings">
              <Settings size={15} />
            </IconButton>
          </Box>
        </Box>

        {/* Filter Pills */}
        <Box sx={{ px: 2, py: 1, display: "flex", gap: 1, borderBottom: "1px solid var(--border, var(--color-slate-200))", background: "var(--surface-sunken, var(--color-slate-50))" }}>
          {(["all", "unread", "urgent"] as const).map((f) => (
            <Chip
              key={f}
              label={f === "all" ? "All Alerts" : f === "unread" ? "Unread" : "🚨 Urgent"}
              size="small"
              onClick={() => setFilter(f)}
              sx={{
                fontWeight: 700,
                fontSize: 11,
                cursor: "pointer",
                background: filter === f ? "var(--color-slate-900)" : "transparent",
                color: filter === f ? "#ffffff" : "var(--text-secondary, var(--color-slate-500))",
                border: "1px solid",
                borderColor: filter === f ? "var(--color-slate-900)" : "var(--border, var(--color-slate-200))",
              }}
            />
          ))}
        </Box>

        {/* Notifications List */}
        <Box sx={{ flex: 1, overflowY: "auto", maxHeight: 380 }}>
          {filteredNotifications.length === 0 ? (
            <Box sx={{ p: 4, textAlign: "center", color: "var(--muted, var(--color-slate-400))" }}>
              <CheckCircle size={32} style={{ margin: "0 auto 8px", opacity: 0.4, color: "var(--color-green)" }} />
              <Typography variant="body2" sx={{ fontWeight: 700, color: "var(--text, var(--color-slate-800))" }}>
                You&apos;re all caught up!
              </Typography>
              <Typography variant="caption" sx={{ color: "var(--muted, var(--color-slate-500))" }}>
                No active notifications in this view.
              </Typography>
            </Box>
          ) : (
            <List disablePadding>
              {filteredNotifications.map((n) => (
                <ListItem
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  sx={{
                    p: 1.8,
                    borderBottom: "1px solid var(--border, var(--color-slate-100))",
                    cursor: "pointer",
                    background: n.read_at ? "transparent" : "rgba(59, 130, 246, 0.04)",
                    borderLeft: n.read_at ? "3px solid transparent" : n.level === "urgent" ? "3px solid var(--color-danger)" : "3px solid var(--color-blue)",
                    transition: "background 0.15s ease",
                    "&:hover": {
                      background: "rgba(59, 130, 246, 0.08)",
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    {getLevelIcon(n.level)}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", mb: 0.4 }}>
                        <Typography variant="body2" sx={{ fontWeight: n.read_at ? 600 : 800, fontSize: 13, color: "var(--text, var(--color-slate-900))" }}>
                          {n.title}
                        </Typography>
                        <Typography variant="caption" sx={{ fontSize: 10, color: "var(--muted, var(--color-slate-400))", ml: 1, whiteSpace: "nowrap" }}>
                          {formatTime(n.created_at)}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Typography variant="caption" sx={{ color: "var(--text-secondary, var(--color-slate-600))", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.35 }}>
                        {n.message}
                      </Typography>
                    }
                  />
                  {!n.read_at && (
                    <Tooltip title="Mark as read">
                      <IconButton size="small" onClick={(e) => handleMarkAsRead(n.id, e)} sx={{ ml: 0.5, p: 0.5 }}>
                        <Check size={14} />
                      </IconButton>
                    </Tooltip>
                  )}
                </ListItem>
              ))}
            </List>
          )}
        </Box>

        {/* Footer */}
        <Box sx={{ p: 1.2, borderTop: "1px solid var(--border, var(--color-slate-200))", background: "var(--surface-sunken, var(--color-slate-50))", textAlign: "center" }}>
          <Button
            size="small"
            onClick={() => { setAnchorEl(null); router.push("/settings?tab=notifications"); }}
            sx={{ fontSize: 12, fontWeight: 700, textTransform: "none", color: "var(--primary, var(--color-sky))" }}
          >
            Manage Channels &amp; Preferences →
          </Button>
        </Box>
      </Popover>

      {/* Browser Notification Opt-in Prompt Banner */}
      {showPermissionBanner && (
        <Box
          sx={{
            position: "fixed",
            bottom: 24,
            left: 24,
            zIndex: 9999,
            maxWidth: 380,
            background: "linear-gradient(135deg, var(--color-slate-900) 0%, var(--color-slate-800) 100%)",
            color: "#ffffff",
            p: 2.2,
            borderRadius: "14px",
            boxShadow: "0 16px 40px rgba(15, 23, 42, 0.4)",
            border: "1px solid rgba(59, 130, 246, 0.3)",
            display: "flex",
            flexDirection: "column",
            gap: 1.5,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
            <Box sx={{ fontSize: 24 }}>🔔</Box>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#ffffff", mb: 0.3 }}>
                Enable Desktop Notifications
              </Typography>
              <Typography variant="caption" sx={{ color: "var(--text-ghost)", lineHeight: 1.4, display: "block" }}>
                Get immediate alerts for incoming M-Pesa payments, task SLA escalations, and urgent facility tickets.
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
            <Button size="small" onClick={dismissPermissionBanner} sx={{ color: "var(--text-ghost)", fontSize: 11, textTransform: "none" }}>
              Maybe Later
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={requestBrowserPermission}
              sx={{ background: "var(--color-info)", fontWeight: 700, fontSize: 11, textTransform: "none", "&:hover": { background: "var(--color-info-strong)" } }}
            >
              Allow Notifications
            </Button>
          </Box>
        </Box>
      )}

      {/* Live In-App Toast Alert Popup */}
      {toastAlert && (
        <Box
          sx={{
            position: "fixed",
            top: 24,
            right: 24,
            zIndex: 9999,
            maxWidth: 360,
            background: toastAlert.level === "urgent" ? "var(--color-danger)" : "var(--color-slate-900)",
            color: "#ffffff",
            p: 2,
            borderRadius: "12px",
            boxShadow: "0 14px 36px rgba(0, 0, 0, 0.3)",
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            cursor: "pointer",
            animation: "slideIn 0.3s ease",
          }}
          onClick={() => {
            const url = toastAlert.action_url;
            setToastAlert(null);
            if (url) router.push(url);
          }}
        >
          <Box sx={{ fontSize: 20 }}>{toastAlert.level === "urgent" ? "🚨" : "⚡"}</Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, fontSize: 13, color: "#ffffff" }}>
              {toastAlert.title}
            </Typography>
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.8)", display: "block", fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {toastAlert.message}
            </Typography>
          </Box>
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); setToastAlert(null); }} sx={{ color: "#ffffff" }}>
            <XCircle size={16} />
          </IconButton>
        </Box>
      )}
    </>
  );
}
