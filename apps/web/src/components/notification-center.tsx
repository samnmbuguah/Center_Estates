"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { Badge, Box, Button, Divider, IconButton, List, ListItemButton, ListItemText, Menu, Typography } from "@mui/material";

import { apiFetch, csrfFromCookie } from "@/lib/api";

type Notice = {
  id: string; title: string; message: string; level: string; action_url: string;
  read_at: string | null; created_at: string; category: string;
};

export function NotificationCenter() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [unread, setUnread] = useState(0);
  const [inboxLoaded, setInboxLoaded] = useState(false);

  const loadSummary = useCallback(async () => {
    try {
      const summaryResponse = await apiFetch("/notifications/summary/");
      if (summaryResponse.ok) setUnread(Number((await summaryResponse.json() as { unread: number }).unread || 0));
    } catch {
      // Notifications must never break the primary workflow when connectivity is intermittent.
    }
  }, []);

  const loadInbox = useCallback(async () => {
    try {
      const response = await apiFetch("/notifications/?ordering=-created_at");
      if (!response.ok) return;
      const payload = await response.json() as { results?: Notice[] } | Notice[];
      setNotices(Array.isArray(payload) ? payload.slice(0, 12) : (payload.results ?? []).slice(0, 12));
      setInboxLoaded(true);
    } catch { /* the primary workflow remains available */ }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void loadSummary(), 0);
    const refreshWhenVisible = () => { if (document.visibilityState === "visible") void loadSummary(); };
    const id = window.setInterval(refreshWhenVisible, 120_000);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => { window.clearTimeout(initial); window.clearInterval(id); document.removeEventListener("visibilitychange", refreshWhenVisible); };
  }, [loadSummary]);

  async function markRead(notice: Notice) {
    if (!notice.read_at) {
      await apiFetch(`/notifications/${notice.id}/mark-read/`, {
        method: "POST", headers: { "X-CSRFToken": csrfFromCookie() },
      });
      setUnread((value) => Math.max(0, value - 1));
      setNotices((rows) => rows.map((row) => row.id === notice.id ? { ...row, read_at: new Date().toISOString() } : row));
    }
    setAnchor(null);
  }

  async function markAll() {
    await apiFetch("/notifications/mark-all-read/", { method: "POST", headers: { "X-CSRFToken": csrfFromCookie() } });
    setUnread(0); setNotices((rows) => rows.map((row) => ({ ...row, read_at: row.read_at || new Date().toISOString() })));
  }

  return <>
    <IconButton aria-label={`${unread} unread notifications`} onClick={(event) => { setAnchor(event.currentTarget); if (!inboxLoaded) void loadInbox(); }}>
      <Badge badgeContent={unread} color="error" max={99}><Bell size={19} /></Badge>
    </IconButton>
    <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)} slotProps={{ paper: { sx: { width: { xs: 330, sm: 390 }, maxHeight: 520, borderRadius: 3 } } }}>
      <Box sx={{ px: 2, py: 1.25, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box><Typography sx={{ fontWeight: 800 }}>Notifications</Typography><Typography variant="caption" color="text.secondary">Approvals, deadlines and operational alerts</Typography></Box>
        {unread > 0 && <Button size="small" startIcon={<CheckCheck size={15} />} onClick={markAll}>Read all</Button>}
      </Box>
      <Divider />
      <List disablePadding>
        {notices.length === 0 && <Typography color="text.secondary" sx={{ p: 3, textAlign: "center" }}>You are all caught up.</Typography>}
        {notices.map((notice) => <ListItemButton key={notice.id} component={notice.action_url ? Link : "div"} href={notice.action_url || undefined} onClick={() => void markRead(notice)} sx={{ alignItems: "flex-start", bgcolor: notice.read_at ? "transparent" : "action.hover", borderLeft: 3, borderLeftColor: notice.level === "urgent" ? "error.main" : notice.level === "warning" ? "warning.main" : "primary.main" }}>
          <ListItemText primary={notice.title} secondary={<>{notice.message}<br /><Typography component="span" variant="caption" color="text.secondary">{new Date(notice.created_at).toLocaleString()} · {notice.category}</Typography></>} slotProps={{ primary: { sx: { fontWeight: notice.read_at ? 600 : 800, fontSize: 13 } }, secondary: { component: "div", sx: { fontSize: 12 } } }} />
        </ListItemButton>)}
      </List>
    </Menu>
  </>;
}
