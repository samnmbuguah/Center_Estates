import { useEffect, useState } from "react";
import { API_BASE } from "../api";

export function useOnlineStatus(intervalMs = 30000) {
  const [online, setOnline] = useState(navigator.onLine);
  const [apiUp, setApiUp] = useState<boolean | null>(null);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    const check = async () => {
      if (!navigator.onLine) { setApiUp(null); return; }
      try {
        const res = await fetch(`${API_BASE}/healthz`);
        setApiUp(res.ok);
      } catch {
        setApiUp(false);
      }
    };
    check();
    const timer = setInterval(check, intervalMs);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      clearInterval(timer);
    };
  }, [intervalMs]);

  return { online, apiUp };
}

/** Inline badge showing connectivity state. Renders nothing when all OK. */
export function SyncStatusBadge({ online, apiUp }: { online: boolean; apiUp: boolean | null }) {
  if (online && apiUp) return null;

  return (
    <span style={{
      marginLeft: 8, padding: "2px 10px", borderRadius: 12, fontSize: 11, fontWeight: 500,
      background: apiUp === false ? "var(--danger)" : "var(--warning)",
      color: "#fff",
      display: "inline-flex", alignItems: "center", gap: 4,
    }}>
      {!online ? "Offline" : apiUp === false ? "API Down" : "Checking…"}
    </span>
  );
}