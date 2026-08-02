import { useCallback, useEffect, useRef, useState } from "react";
import { Search, Send, Users, MessageSquare } from "lucide-react";
import { authHeaders, getToken } from "../api";
interface ChatMsg {
  id: string;
  project_id: string | null;
  sender: string;
  sender_id: string;
  recipient_id: string | null;
  channel: string;
  body: string;
  attachment_url: string;
  attachment_name: string;
  created_at: number;
  read_at: number | null;
}

interface Conversation {
  user_id: string;
  username: string;
  last_message: string;
  last_message_at: number;
  unread: number;
}

interface ProjectUser {
  id: number;
  username: string;
  email: string;
  role: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeUser, setActiveUser] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<ProjectUser[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);
  const token = getToken();
  const base = `${API_BASE}/chat`;


  const apiFetch = useCallback(async (path: string, options?: RequestInit) => {
    const res = await fetch(`${base}${path}`, {
      ...options,
      headers: { ...options?.headers, ...authHeaders() },
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }, [base]);

  const fetchConversations = useCallback(async () => {
    try {
      const data = await apiFetch("/conversations");
      setConversations(data);
    } catch { /* ignore */ }
  }, [apiFetch]);

  const fetchMessages = useCallback(async () => {
    if (!activeUser) return;
    setLoading(true);
    try {
      const data = await apiFetch(`/messages?other_id=${activeUser}&limit=100`);
      setMessages(data.reverse());
    } catch { /* ignore */ }
    setLoading(false);
  }, [apiFetch, activeUser]);

  const fetchUsers = useCallback(async () => {
    try {
      const u = await apiFetch("/users");
      setUsers(u);
    } catch { /* ignore */ }
  }, [apiFetch]);

  // Mark messages as read when conversation is opened
  const markRead = useCallback(async (messageId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ msg_type: "mark_read", message_id: messageId }));
    } else {
      try {
        await apiFetch(`/messages/${messageId}/read`, { method: "PUT" });
      } catch { /* ignore */ }
    }
  }, [apiFetch]);

  useEffect(() => {
    fetchConversations();
    fetchUsers();
  }, [fetchConversations, fetchUsers]);

  // WebSocket connection
  useEffect(() => {
    if (!activeUser) return;
    const apiBase = API_BASE;

    if (!apiBase || apiBase.startsWith("/") || (typeof window !== "undefined" && window.location.hostname.includes("monitoringerp.co.ke"))) return; // cPanel — no WS support, polling handles it
    const wsBase = apiBase.replace(/^http/, "ws");
    try {
      const ws = new WebSocket(`${wsBase}/ws/chat/${activeUser}/?token=${token}`);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const type = data.msg_type;

        if (type === "new_message") {
          setMessages((prev) => {
            if (prev.some((m) => m.id === data.id)) return prev;
            return [...prev, {
              id: data.id,
              project_id: null,
              sender: data.sender,
              sender_id: String(data.sender_id),
              recipient_id: String(data.recipient_id || ""),
              channel: "",
              body: data.body,
              attachment_url: "",
              attachment_name: "",
              created_at: data.created_at,
              read_at: data.read_at || null,
            }];
          });
          // If message is for the current user from the other user, mark read
          if (String(data.sender_id) === activeUser) {
            markRead(data.id);
          }
        } else if (type === "read_receipt") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === data.message_id ? { ...m, read_at: data.read_at } : m
            )
          );
        } else if (type === "typing") {
          if (String(data.sender_id) === activeUser) {
            setTypingUser(data.sender);
            if (typingTimer.current) clearTimeout(typingTimer.current);
            typingTimer.current = setTimeout(() => setTypingUser(null), 3000);
          }
        }
      } catch { /* ignore */ }
    };

    ws.onopen = () => {
      // Mark any unread messages from this user as read
      messages.forEach((m) => {
        if (m.sender_id === activeUser && !m.read_at) markRead(m.id);
      });
    };

    ws.onerror = () => { /* fall back to polling */ };
    wsRef.current = ws;
    return () => { ws.close(); wsRef.current = null; };
    } catch { /* ignore */ }
  }, [activeUser, token, markRead]);

  // Fallback polling
  useEffect(() => {
    fetchMessages();
    const interval = setInterval(() => {
      if (!activeUser) return;
      fetchMessages();
    }, 30000);
    pollRef.current = interval;
    return () => clearInterval(interval);
  }, [activeUser, fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    if (!body.trim() || !activeUser) return;
    setError("");
    const msgId = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    const msgBody = body.trim();
    setBody("");

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        msg_type: "send_message",
        id: msgId,
        body: msgBody,
      }));
    } else {
      // Fallback via REST
      apiFetch("/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient_id: activeUser, body: msgBody }),
      }).then(() => fetchMessages()).catch(() => setError("Failed to send message"));
    }
    fetchConversations();
  };

  const handleTyping = () => {
    const now = Date.now();
    if (now - lastTypingSent.current > 2000 && wsRef.current?.readyState === WebSocket.OPEN) {
      lastTypingSent.current = now;
      wsRef.current.send(JSON.stringify({ msg_type: "typing" }));
    }
  };

  const selectUser = (userId: string) => {
    setActiveUser(userId);
    setTypingUser(null);
  };

  const filteredUsers = users.filter(
    u => u.username.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: "flex", height: "calc(100vh - 80px)", padding: 0, overflow: "hidden" }}>
      {/* Sidebar */}
      <div style={{ width: 300, borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", background: "var(--surface-2)" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <MessageSquare size={18} /> Chat
          </h2>
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 8, top: 8, color: "var(--muted)" }} />
            <input placeholder="Search users..."
              value={search} onChange={e => setSearch(e.target.value)}
              style={{
                width: "100%", padding: "6px 8px 6px 28px", borderRadius: 6,
                border: "1px solid var(--border)", background: "var(--surface-1)",
                color: "var(--text)", fontSize: 13, boxSizing: "border-box", outline: "none",
              }} />
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {filteredUsers.map(u => {
            const conv = conversations.find(c => c.user_id === String(u.id));
            return (
              <div key={u.id} onClick={() => selectUser(String(u.id))}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
                  cursor: "pointer", background: activeUser === String(u.id) ? "var(--primary)" : "transparent",
                  color: activeUser === String(u.id) ? "var(--primary-ink)" : "var(--text)",
                  borderBottom: "1px solid var(--border)",
                }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%", background: "var(--primary)",
                  color: "var(--primary-ink)", display: "flex", alignItems: "center",
                  justifyContent: "center", fontWeight: 600, fontSize: 14, flexShrink: 0,
                }}>
                  {u.username.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{u.username}</div>
                  <div style={{ fontSize: 12, color: activeUser === String(u.id) ? "var(--primary-ink)" : "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {conv ? conv.last_message : u.role || ""}
                  </div>
                </div>
                {conv && conv.unread > 0 && (
                  <div style={{
                    background: "#d92d2d", color: "#fff", borderRadius: 10,
                    padding: "1px 7px", fontSize: 11, fontWeight: 600,
                  }}>
                    {conv.unread}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {activeUser ? (
          <>
            <div style={{
              padding: "10px 16px", borderBottom: "1px solid var(--border)",
              fontWeight: 600, fontSize: 15, background: "var(--surface-2)",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%", background: "var(--primary)",
                color: "var(--primary-ink)", display: "flex", alignItems: "center",
                justifyContent: "center", fontWeight: 600, fontSize: 12,
              }}>
                {users.find(u => String(u.id) === activeUser)?.username?.charAt(0).toUpperCase() || "?"}
              </div>
              {users.find(u => String(u.id) === activeUser)?.username || "Unknown"}
              {typingUser && (
                <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 8 }}>
                  typing...
                </span>
              )}
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              {loading ? (
                <div style={{ textAlign: "center", color: "var(--muted)", paddingTop: 40 }}>Loading...</div>
              ) : messages.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--muted)", paddingTop: 40 }}>No messages yet. Say hello!</div>
              ) : (
                messages.map(m => {
                  const fromMe = String(m.sender_id) !== activeUser;
                  return (
                    <div key={m.id} style={{
                      display: "flex", justifyContent: fromMe ? "flex-end" : "flex-start",
                      marginBottom: 8,
                    }}>
                      <div style={{
                        maxWidth: "70%", padding: "8px 14px", borderRadius: 12,
                        background: fromMe ? "var(--primary)" : "var(--surface-2)",
                        color: fromMe ? "var(--primary-ink)" : "var(--text)",
                        fontSize: 14, lineHeight: 1.4, wordBreak: "break-word",
                        borderBottomRightRadius: fromMe ? 4 : 12,
                        borderBottomLeftRadius: fromMe ? 12 : 4,
                      }}>
                        {m.body}
                        <div style={{
                          fontSize: 10, marginTop: 4, opacity: 0.6,
                          textAlign: "right",
                        }}>
                          {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          {m.read_at && fromMe && " ✓✓"}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              {typingUser && (
                <div style={{ fontSize: 12, color: "var(--muted)", padding: "4px 0" }}>
                  {typingUser} is typing...
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", display: "flex", gap: 8, background: "var(--surface-2)" }}>
              <input value={body} onChange={e => { setBody(e.target.value); handleTyping(); }}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="Type a message..."
                style={{
                  flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)",
                  background: "var(--surface-1)", color: "var(--text)", fontSize: 14, outline: "none",
                }} />
              <button onClick={sendMessage} disabled={!body.trim()}
                style={{
                  padding: "8px 16px", borderRadius: 8, border: "none",
                  background: body.trim() ? "var(--primary)" : "var(--border)",
                  color: body.trim() ? "var(--primary-ink)" : "var(--muted)",
                  cursor: body.trim() ? "pointer" : "default",
                  display: "flex", alignItems: "center", gap: 4, fontSize: 14,
                }}>
                <Send size={16} /> Send
              </button>
            </div>
            {error && <div style={{ padding: "4px 16px", fontSize: 13, color: "#d92d2d" }}>{error}</div>}
          </>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, color: "var(--muted)", flexDirection: "column", gap: 12 }}>
            <Users size={48} opacity={0.3} />
            <div>Select a user to start chatting</div>
          </div>
        )}
      </div>
    </div>
  );
}
