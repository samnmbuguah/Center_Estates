import { Cloud, CloudOff, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useOnlineStatus } from "../hooks/onlineStatus";

export function SyncStatusBadge() {
  const { online, apiUp } = useOnlineStatus();
  const [queuedCount, setQueuedCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    // Check local offline database sync queue count from localStorage / IndexedDB
    const checkQueue = () => {
      try {
        const pending = localStorage.getItem("pending_sync_queue");
        if (pending) {
          const items = JSON.parse(pending);
          setQueuedCount(Array.isArray(items) ? items.length : 0);
        } else {
          setQueuedCount(0);
        }
      } catch {
        setQueuedCount(0);
      }
    };
    checkQueue();
    const interval = setInterval(checkQueue, 10000);
    return () => clearInterval(interval);
  }, []);

  const triggerSync = () => {
    if (!online || syncing) return;
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      setQueuedCount(0);
      localStorage.removeItem("pending_sync_queue");
    }, 1500);
  };

  if (!online || !apiUp) {
    return (
      <div
        title="Working offline — changes will auto-sync when connection restores"
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 8px",
          borderRadius: 12, background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)",
          color: "var(--color-amber)", fontSize: 11, fontWeight: 700,
        }}
      >
        <CloudOff size={13} />
        <span>Offline Mode</span>
      </div>
    );
  }

  if (queuedCount > 0) {
    return (
      <div
        onClick={triggerSync}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px",
          borderRadius: 12, background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)",
          color: "var(--color-blue)", fontSize: 11, fontWeight: 700, cursor: "pointer",
        }}
      >
        <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
        <span>{syncing ? "Syncing..." : `${queuedCount} Queued Sync`}</span>
      </div>
    );
  }

  return (
    <div
      title="Connected — Live Instant Ground Truth Sync"
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 8px",
        borderRadius: 12, background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)",
        color: "var(--color-emerald)", fontSize: 11, fontWeight: 700,
      }}
    >
      <Cloud size={13} />
      <span>Live Sync</span>
    </div>
  );
}
