import type { ReactNode } from "react";
import { Link } from "@/components/monitoring/react-router-shim";

export function KpiCard({
  label,
  value,
  sub,
  color = "var(--primary)",
  icon,
  to,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  icon?: ReactNode;
  to?: string;
}) {
  const body = (
    <div
      className="card kpi-card"
      style={{
        padding: "14px 16px",
        borderRadius: 12,
        borderTop: `3px solid ${color}`,
        cursor: to ? "pointer" : "default",
        transition: "transform 0.15s, box-shadow 0.15s",
        height: "100%",
      }}
      onMouseEnter={(e) => {
        if (!to) return;
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 24px -8px ${color}40`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "";
      }}
    >
      {icon && <div style={{ marginBottom: 4, fontSize: 20 }}>{icon}</div>}
      <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 900, color: "var(--text)", lineHeight: 1.1 }}>{value}</div>
      {sub != null && sub !== "" && (
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{sub}</div>
      )}
    </div>
  );
  return to ? <Link to={to} style={{ textDecoration: "none", color: "inherit" }}>{body}</Link> : body;
}

export function MetricStrip({
  items,
}: {
  items: { label: string; value: string | number; color?: string }[];
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fit, minmax(140px, 1fr))`,
        gap: 12,
      }}
    >
      {items.map((it) => (
        <div
          key={it.label}
          className="card"
          style={{ padding: "14px 16px", borderLeft: it.color ? `3px solid ${it.color}` : undefined }}
        >
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>{it.label}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: it.color || "var(--text)" }}>{it.value}</div>
        </div>
      ))}
    </div>
  );
}
