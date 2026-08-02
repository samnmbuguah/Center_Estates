import React from "react";
import { Play, X } from "lucide-react";
import { useState } from "react";

interface TourLauncherProps {
  userRole?: string;
  isCompleted: boolean;
  isActive: boolean;
  onStartTour: () => void;
  onDismiss?: () => void;
}

function TourLauncherInner({ userRole, isCompleted, isActive, onStartTour, onDismiss }: TourLauncherProps) {
  const [dismissed, setDismissed] = useState(false);

  if (isCompleted || isActive || dismissed) {
    return null;
  }

  const roleName = userRole
    ? userRole.replace(/_/g, " ")
    : "your account";

  return (
    <div
      style={{
        background: "var(--surface-2)",
        borderRadius: 12,
        padding: "16px 20px",
        marginBottom: 20,
        color: "var(--text)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        border: "1px solid var(--border)",
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, color: "var(--text)" }}>
          Welcome to the system!
        </div>
        <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.5, color: "var(--muted)" }}>
          Take a quick tour of your <strong style={{ textTransform: "capitalize" }}>{roleName}</strong> dashboard and key features. It only takes a minute.
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <button
          onClick={onStartTour}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "var(--primary)", border: "none", color: "var(--primary-ink)",
            fontWeight: 600, fontSize: 13, cursor: "pointer",
            padding: "8px 16px", borderRadius: 8, whiteSpace: "nowrap",
          }}
        >
          <Play size={14} /> Start Tour
        </button>
        <button
          onClick={() => {
            setDismissed(true);
            onDismiss?.();
          }}
          style={{
            background: "transparent", border: "none",
            color: "var(--muted)", cursor: "pointer", padding: "8px 10px",
            borderRadius: 8, lineHeight: 1,
          }}
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

export const TourLauncher = React.memo(TourLauncherInner);
export default TourLauncher;
