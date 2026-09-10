import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck, ChevronRight, ExternalLink } from "lucide-react";
import { useNavigate } from "@/components/monitoring/react-router-shim";
import { API_BASE, authHeaders } from "../api";

interface Notif {
  id: string;
  title: string;
  body: string;
  type: string;
  link: string;
  read_at: number | null;
  created_at: number;
}

const TYPE_LABELS: Record<string, string> = {
  incident: "H&S Incident",
  ticket: "Ticket",
  regression: "Milestone Regression",
  escalation: "Escalation",
  system: "System",
};

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const fetchNotifs = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/notifications`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setNotifs(Array.isArray(data) ? data : (data.results ?? []));
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchNotifs(); }, [fetchNotifs]);

  const markRead = async (id: string) => {
    try {
      await fetch(`${API_BASE}/notifications/${id}/read`, { method: "PUT", headers: authHeaders() });
      setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: Date.now() } : n)));
    } catch { /* ignore */ }
  };

  const markAllRead = async () => {
    try {
      await fetch(`${API_BASE}/notifications/read-all`, { method: "PUT", headers: authHeaders() });
      setNotifs((prev) => prev.map((n) => ({ ...n, read_at: Date.now() })));
    } catch { /* ignore */ }
  };

  const handleClick = (n: Notif) => {
    if (!n.read_at) markRead(n.id);
    if (n.link) navigate(n.link);
  };

  const [activeTab, setActiveTab] = useState<"all" | "alerts" | "messages">("all");

  const chatMessages = [
    { id: "m1", title: "Project Manager Update", body: "KASNEB Towers II structural floor 12 pour signed off by Lead Engineer.", link: "/app/chat", type: "message", created_at: Date.now() - 3600000, read_at: null },
    { id: "m2", title: "Clerk of Works Note", body: "Concrete slump test certificate attached for Floor 12 core wall.", link: "/app/chat", type: "message", created_at: Date.now() - 7200000, read_at: null },
    { id: "m3", title: "QS Finance Inquiry", body: "IPC #04 retention deduction calculated at 5% (KSh 1,250,000).", link: "/app/chat", type: "message", created_at: Date.now() - 14400000, read_at: Date.now() - 1000000 },
  ];

  const filteredNotifs = activeTab === "all"
    ? [...notifs, ...chatMessages]
    : activeTab === "alerts"
    ? notifs
    : chatMessages;

  const unread = filteredNotifs.filter((n) => !n.read_at).length;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
          <Bell size={20} /> Notifications & Messages
          {unread > 0 && (
            <span style={{ fontSize: 12, background: "var(--color-danger)", color: "#fff", borderRadius: 10, padding: "1px 8px" }}>
              {unread}
            </span>
          )}
        </h2>
        {unread > 0 && (
          <button onClick={markAllRead} className="btn ghost sm" style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <CheckCheck size={15} /> Mark all read
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
        <button className={`btn sm ${activeTab === "all" ? "primary" : "ghost"}`} onClick={() => setActiveTab("all")}>All ({notifs.length + chatMessages.length})</button>
        <button className={`btn sm ${activeTab === "alerts" ? "primary" : "ghost"}`} onClick={() => setActiveTab("alerts")}>System Alerts ({notifs.length})</button>
        <button className={`btn sm ${activeTab === "messages" ? "primary" : "ghost"}`} onClick={() => setActiveTab("messages")}>Messages & Chat ({chatMessages.length})</button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", color: "var(--muted)", padding: 40 }}>Loading...</div>
      ) : filteredNotifs.length === 0 ? (
        <div style={{ textAlign: "center", color: "var(--muted)", padding: 40 }}>
          <Bell size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
          <div>No notifications yet</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filteredNotifs.map((n) => (
            <div
              key={n.id}
              onClick={() => handleClick(n as Notif)}
              style={{
                display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 16px",
                borderRadius: 8, cursor: n.link ? "pointer" : "default",
                background: n.read_at ? "var(--surface-2)" : "var(--surface-1)",
                border: "1px solid var(--border)",
                borderLeft: n.read_at ? "3px solid transparent" : n.type === "message" ? "3px solid var(--color-brand-blue)" : "3px solid var(--primary)",
                transition: "background 0.2s",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: "1px 6px", borderRadius: 4,
                    background: n.type === "message" ? "rgba(0,163,255,0.15)" : "var(--primary)",
                    color: n.type === "message" ? "var(--color-brand-blue)" : "var(--primary-ink)",
                  }}>
                    {n.type === "message" ? "Chat Message" : TYPE_LABELS[n.type] || n.type}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>
                    {new Date(n.created_at).toLocaleDateString(undefined, {
                      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                </div>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{n.title}</div>
                {n.body && <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.4 }}>{n.body}</div>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0, color: "var(--muted)" }}>
                {n.link && <ChevronRight size={16} />}
                {!n.read_at && <div style={{ width: 8, height: 8, borderRadius: "50%", background: n.type === "message" ? "var(--color-brand-blue)" : "var(--primary)" }} />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
