import type { ReactNode } from "react";
import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import { Skeleton } from "./Skeleton";
import { EmptyState } from "./EmptyState";
import { ErrorBanner } from "./ErrorBanner";

/** Full-page loading skeleton grid used while portfolio data loads. */
export function PageLoading({ rows = 4 }: { rows?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 4 }}>
      <Skeleton height={28} width="40%" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="card" style={{ padding: 16 }}>
            <Skeleton height={12} width="50%" style={{ marginBottom: 10 }} />
            <Skeleton height={28} width="40%" />
          </div>
        ))}
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="card" style={{ padding: 16 }}>
          <Skeleton height={14} count={3} style={{ marginBottom: 8 }} />
        </div>
      ))}
    </div>
  );
}

export function PageError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <ErrorBanner message={message} />
      {onRetry && (
        <button className="btn ghost" onClick={onRetry} style={{ alignSelf: "flex-start" }}>
          <RefreshCw size={14} style={{ marginRight: 6 }} /> Retry
        </button>
      )}
    </div>
  );
}

export function PageEmpty({
  title = "Nothing here yet",
  description,
  action,
  icon,
}: {
  title?: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  icon?: ReactNode;
}) {
  return (
    <EmptyState
      icon={icon ?? <Inbox size={40} />}
      title={title}
      description={description ?? "When data is available it will appear here. No demo figures are shown."}
      action={action}
    />
  );
}

/** Inline empty row for tables — honest zero state. */
export function TableEmpty({ colSpan, label = "No records yet" }: { colSpan: number; label?: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="empty" style={{ textAlign: "center", padding: 28, color: "var(--muted)" }}>
        {label}
      </td>
    </tr>
  );
}

export function StatusPill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "success" | "warning" | "danger" | "info" | "neutral";
}) {
  const palette = {
    success: { bg: "rgba(16,185,129,0.12)", fg: "#10b981", border: "rgba(16,185,129,0.3)" },
    warning: { bg: "rgba(245,158,11,0.12)", fg: "#f59e0b", border: "rgba(245,158,11,0.3)" },
    danger: { bg: "rgba(239,68,68,0.12)", fg: "#ef4444", border: "rgba(239,68,68,0.3)" },
    info: { bg: "rgba(0,163,255,0.12)", fg: "#00a3ff", border: "rgba(0,163,255,0.3)" },
    neutral: { bg: "var(--surface-2)", fg: "var(--muted)", border: "var(--border)" },
  } as const;
  const c = palette[tone] ?? palette.neutral;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 11,
        fontWeight: 700,
        padding: "2px 8px",
        borderRadius: 12,
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
        whiteSpace: "nowrap",
      }}
    >
      {tone === "danger" && <AlertTriangle size={10} />}
      {label}
    </span>
  );
}
