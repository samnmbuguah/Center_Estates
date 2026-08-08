"use client";

import { cloneElement, isValidElement, useId, type ReactNode, type CSSProperties } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Skeleton,
  TextField,
} from "@mui/material";

/**
 * Shared UI primitives for module workspaces.
 * Styling is driven by the "Site Office / Blueprint-Industrial" design system
 * in globals.css (vars: --bg/--surface/--border/--primary/--success/...).
 */

export const money = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 0,
});

export const number = new Intl.NumberFormat("en-KE");

/** Normalise a status string to a tone for pills/badges. */
export function statusTone(value?: string | null): "green" | "red" | "yellow" | "blue" | "cyan" | "purple" | "gray" {
  const slug = String(value ?? "").toLowerCase();
  if (/(active|completed|approved|paid|applied|resolved|good|healthy|operational|available|sold|delivered|done|success|final|issued)/.test(slug)) return "green";
  if (/(overdue|expired|failed|rejected|critical|urgent|error|inactive|blacklisted|cancelled|canceled|regret|void)/.test(slug)) return "red";
  if (/(pending|in progress|open|in-review|in review|draft|scheduled|on-hold|on hold|review|processing|reserved|awaiting|submitted|outstanding|partial)/.test(slug)) return "yellow";
  if (/(new|inspection|analysis|planning|technical|verified|paid|award)/.test(slug)) return "blue";
  if (/(final|report|analytics|data)/.test(slug)) return "cyan";
  if (/(high|normal|low|medium|standard)/.test(slug)) return "purple";
  return "gray";
}

export function StatusPill({ value, tone, children }: { value?: string | null; tone?: "green" | "red" | "yellow" | "blue" | "cyan" | "purple" | "gray"; children?: ReactNode }) {
  const t = tone ?? statusTone(value);
  const label = children ?? String(value ?? "—").replace(/_/g, " ");
  return <span className={`pill pill-${t}`}>{label}</span>;
}

export function Badge({ value, tone, children }: { value?: string | null; tone?: "green" | "red" | "yellow" | "blue" | "cyan" | "gray" | "purple" | "orange"; children?: ReactNode }) {
  const t = tone ?? statusTone(value);
  const label = children ?? String(value ?? "—").replace(/_/g, " ");
  return <span className={`badge badge-${t}`}>{label}</span>;
}

export function KpiCard({
  icon,
  label,
  value,
  sub,
  iconBg = "rgba(0, 163, 255, 0.12)",
  iconColor = "var(--primary)",
  borderColor,
  onClick,
  link,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  iconBg?: string;
  iconColor?: string;
  borderColor?: string;
  onClick?: () => void;
  link?: string;
}) {
  return (
    <button className="fc-kpi-card" onClick={onClick} style={{ textAlign: "left", borderTop: borderColor ? `3px solid ${borderColor}` : undefined }}>
      <div className="fc-kpi-top">
        <span className="fc-kpi-icon" style={{ background: iconBg, color: iconColor }}>{icon}</span>
        <span className="fc-kpi-label">{label}</span>
      </div>
      <strong className="fc-kpi-value">{value}</strong>
      {sub ? <span className="fc-kpi-sub">{sub}</span> : null}
      {link ? <span className="fc-kpi-link">{link} →</span> : null}
    </button>
  );
}

export function KpiStrip({ children, cols }: { children: ReactNode; cols?: number }) {
  const style: CSSProperties = cols ? { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` } : {};
  return <div className="fc-kpi-strip" style={style}>{children}</div>;
}

export function Panel({ title, badge, action, children, style }: { title?: ReactNode; badge?: number; action?: ReactNode; children: ReactNode; style?: CSSProperties }) {
  return (
    <article className="data-panel" style={style}>
      {(title || action) && (
        <header className="panel-title">
          <h2 style={{ fontSize: 14, margin: 0, display: "flex", gap: 8, alignItems: "center" }}>
            {title}
            {badge !== undefined && (
              <span style={{ background: "#fee2e2", borderRadius: 99, color: "#c02727", fontSize: 10, fontWeight: 800, padding: "2px 8px" }}>{badge}</span>
            )}
          </h2>
          {action}
        </header>
      )}
      {children}
    </article>
  );
}

export function EmptyState({ icon = "📋", title = "No records", description, action }: { icon?: ReactNode; title?: string; description?: string; action?: ReactNode }) {
  return (
    <div className="card" style={{ textAlign: "center", padding: 48 }}>
      <div style={{ fontSize: 34, marginBottom: 12, opacity: 0.45 }}>{icon}</div>
      <h3 style={{ margin: "0 0 6px", fontSize: 16 }}>{title}</h3>
      {description && <p className="muted" style={{ margin: "0 auto 18px", maxWidth: 420, fontSize: 13 }}>{description}</p>}
      {action}
    </div>
  );
}

export function LoadingState({ rows = 4 }: { rows?: number }) {
  return (
    <div className="data-loading" role="status" aria-label="Loading records" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} variant="rounded" height={18} animation="wave" sx={{ opacity: 1 - i * 0.12 }} />
      ))}
    </div>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Alert
      severity="error"
      className="error-banner"
      sx={{ my: 1.5, border: "1px solid", borderColor: "error.main", alignItems: "center" }}
      action={onRetry ? <Button color="inherit" size="small" onClick={onRetry}>Retry</Button> : undefined}
    >
      {message}
    </Alert>
  );
}

export function PageHead({ eyebrow, title, subtitle, actions }: { eyebrow?: string; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <section className="page-head portfolio-head" style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
      <div>
        {eyebrow && <p className="eyebrow" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--primary)", margin: "0 0 4px" }}>{eyebrow}</p>}
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "2px 0 4px", color: "var(--text)" }}>{title}</h1>
        {subtitle && <p className="muted" style={{ fontSize: 13, margin: 0, color: "var(--muted)" }}>{subtitle}</p>}
      </div>
      {actions && <div className="portfolio-toolbar" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>{actions}</div>}
    </section>
  );
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <TextField
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? "Search records…"}
      size="small"
      slotProps={{ htmlInput: { "aria-label": placeholder ?? "Search records" } }}
      sx={{ minWidth: { xs: "100%", sm: 240 }, "& .MuiInputBase-root": { bgcolor: "background.paper" } }}
    />
  );
}

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="fc-pagination" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 14 }}>
      <span className="fc-pager-info" style={{ fontSize: 12, color: "var(--muted)" }}>
        Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
      </span>
      <div className="row" style={{ gap: 6 }}>
        <button className="btn ghost sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>← Prev</button>
        <span className="mono" style={{ fontSize: 12, padding: "0 8px", color: "var(--muted)" }}>{page} / {pages}</span>
        <button className="btn ghost sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next →</button>
      </div>
    </div>
  );
}

export function DetailDrawer({ title, onClose, children, width = 380 }: { title: ReactNode; onClose: () => void; children: ReactNode; width?: number }) {
  return (
    <>
      <div className="modal-overlay" style={{ background: "rgba(7, 16, 29, 0.4)", zIndex: 90 }} onClick={onClose} />
      <aside className="fc-detail-panel" style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: `min(${width}px, 92vw)`, zIndex: 91, background: "var(--surface)", borderLeft: "1px solid var(--border)", boxShadow: "-12px 0 40px rgba(0,0,0,0.25)", overflowY: "auto", padding: 18, animation: "slideUp 0.2s ease" }}>
        <div className="fc-detail-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
          <strong style={{ fontSize: 15 }}>{title}</strong>
          <button className="btn ghost sm" onClick={onClose} aria-label="Close">×</button>
        </div>
        {children}
      </aside>
    </>
  );
}

export function Field({ label, children, required }: { label: string; children: ReactNode; required?: boolean }) {
  const generatedId = useId();
  const control = isValidElement<{ id?: string }>(children)
    ? cloneElement(children, { id: children.props.id ?? generatedId })
    : children;
  const controlId = isValidElement<{ id?: string }>(control) ? control.props.id : undefined;
  return (
    <div className="field">
      <label htmlFor={controlId} style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
        {label} {required && <span aria-hidden="true" style={{ color: "var(--danger)" }}>*</span>}
      </label>
      {control}
    </div>
  );
}

export function Modal({ title, onClose, children, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const titleId = useId();
  return (
    <Dialog
      open
      onClose={onClose}
      fullWidth
      maxWidth={wide ? "md" : "sm"}
      aria-labelledby={titleId}
      slotProps={{ paper: { sx: { borderRadius: 2.5, backgroundImage: "none" } } }}
    >
      <DialogTitle id={titleId} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, py: 1.75, fontSize: 16, fontWeight: 800 }}>
        {title}
        <IconButton size="small" onClick={onClose} aria-label="Close dialog">×</IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ p: { xs: 2, sm: 2.5 } }}>
        {children}
      </DialogContent>
    </Dialog>
  );
}
