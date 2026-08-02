import type { ReactNode } from "react";

export function EmptyState({ icon, title, description, action }: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="card" style={{ textAlign: "center", padding: 48 }}>
      {icon && <div style={{ marginBottom: 16, opacity: 0.4 }}>{icon}</div>}
      <h3 style={{ margin: "0 0 8px" }}>{title}</h3>
      {description && <p className="muted" style={{ margin: "0 0 20px", maxWidth: 400, marginInline: "auto" }}>{description}</p>}
      {action && <button className="btn" onClick={action.onClick}>{action.label}</button>}
    </div>
  );
}
