"use client";

import { cloneElement, isValidElement, useId, useEffect, type ReactNode, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  Alert,
  Button,
  ButtonBase,
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
  const content = (
    <>
      <div className="fc-kpi-top">
        <span className="fc-kpi-icon" style={{ background: iconBg, color: iconColor }}>{icon}</span>
        <span className="fc-kpi-label">{label}</span>
      </div>
      <strong className="fc-kpi-value">{value}</strong>
      {sub ? <span className="fc-kpi-sub">{sub}</span> : null}
      {link ? <span className="fc-kpi-link">{link} →</span> : null}
    </>
  );

  if (onClick) {
    return <ButtonBase component="button" className="fc-kpi-card is-interactive" onClick={onClick} style={{ textAlign: "left", borderTop: borderColor ? `3px solid ${borderColor}` : undefined }}>{content}</ButtonBase>;
  }

  return <article className="fc-kpi-card" style={{ textAlign: "left", borderTop: borderColor ? `3px solid ${borderColor}` : undefined }}>{content}</article>;
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
              <span style={{ background: "var(--error-bg, var(--color-red-bg))", borderRadius: 99, color: "var(--error, #c02727)", fontSize: 10, fontWeight: 800, padding: "2px 8px" }}>{badge}</span>
            )}
          </h2>
          {action ? <div className="panel-actions">{action}</div> : null}
        </header>
      )}
      {children}
    </article>
  );
}

export function EmptyState({ icon = "📋", title = "No records", description, action }: { icon?: ReactNode; title?: string; description?: string; action?: ReactNode }) {
  return (
    <div className="card" style={{ textAlign: "center", padding: 48 }}>
      <div style={{ fontSize: 34, marginBottom: 12, opacity: 0.6 }}>{icon}</div>
      <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 800, color: "var(--text)" }}>{title}</h3>
      {description && <p style={{ margin: "0 auto 18px", maxWidth: 460, fontSize: 13, color: "var(--text-secondary)", fontWeight: 600, lineHeight: 1.5 }}>{description}</p>}
      {action}
    </div>
  );
}

export function LoadingState({ rows = 4 }: { rows?: number }) {
  return (
    <div className="data-loading ce-data-loading" role="status" aria-live="polite" aria-label="Loading records">
      <div className="ce-data-loading-head">
        <span className="ce-mini-pulse" aria-hidden="true" />
        <span>Bringing your data into focus</span>
        <span className="ce-loader-dots" aria-hidden="true"><i /><i /><i /></span>
      </div>
      <div className="ce-skeleton-grid">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} variant="rounded" height={i === 0 ? 56 : 42} animation="wave" sx={{ opacity: Math.max(0.46, 1 - i * 0.1) }} />
      ))}
      </div>
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
    <section className="page-head portfolio-head" style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
      <div>
        {eyebrow && <p className="eyebrow" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--brand-primary)", margin: "0 0 4px" }}>{eyebrow}</p>}
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: "2px 0 6px", color: "var(--text-primary)" }}>{title}</h1>
        {subtitle && <p className="muted" style={{ fontSize: 14, fontWeight: 600, margin: 0, color: "var(--text-secondary)" }}>{subtitle}</p>}
      </div>
      {actions && <div className="portfolio-toolbar" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>{actions}</div>}
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
      sx={{ minWidth: { xs: "100%", sm: 240 }, "& .MuiInputBase-root": { bgcolor: "background.paper", fontWeight: 600 } }}
    />
  );
}

export function ViewToolbar({
  title,
  subtitle,
  search,
  onSearch,
  placeholder,
  children,
}: {
  title: string;
  subtitle?: string;
  search?: string;
  onSearch?: (v: string) => void;
  placeholder?: string;
  children?: ReactNode;
}) {
  return (
    <div className="view-toolbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
      <div>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>{title}</h3>
        {subtitle && <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", margin: "2px 0 0" }}>{subtitle}</p>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {onSearch && <SearchInput value={search ?? ""} onChange={onSearch} placeholder={placeholder} />}
        {children}
      </div>
    </div>
  );
}

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="fc-pagination" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 16 }}>
      <span className="fc-pager-info" style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
        Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
      </span>
      <div className="row" style={{ gap: 8 }}>
        <Button variant="outlined" size="small" disabled={page <= 1} onClick={() => onPage(page - 1)}>← Previous</Button>
        <span className="mono" style={{ fontSize: 13, fontWeight: 800, padding: "0 8px", color: "var(--text-primary)" }}>{page} / {pages}</span>
        <Button variant="outlined" size="small" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next →</Button>
      </div>
    </div>
  );
}

export function DetailDrawer({ title, onClose, children, width = 540, centered = false }: { title: ReactNode; onClose: () => void; children: ReactNode; width?: number; centered?: boolean }) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="detail-drawer-portal-root"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1300,
        pointerEvents: "auto",
        display: "flex",
        justifyContent: centered ? "center" : "flex-end",
        alignItems: centered ? "center" : "stretch",
      }}
    >
      <div
        className="modal-overlay"
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.55)",
          backdropFilter: "blur(3px)",
          zIndex: 1301,
        }}
        onClick={onClose}
      />
      <aside
        className="fc-detail-panel"
        style={
          centered
            ? {
                position: "relative",
                zIndex: 1302,
                width: `min(${width}px, 94vw)`,
                maxWidth: "94vw",
                maxHeight: "88vh",
                overflowY: "auto",
                background: "var(--surface, #ffffff)",
                color: "var(--text-primary, var(--color-slate-900))",
                border: "1px solid var(--border, var(--color-slate-200))",
                borderRadius: 16,
                boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.35)",
                display: "flex",
                flexDirection: "column",
                animation: "slideUp 0.2s ease",
              }
            : {
                position: "relative",
                zIndex: 1302,
                height: "100vh",
                width: `min(${width}px, 92vw)`,
                maxHeight: "100vh",
                background: "var(--surface, #ffffff)",
                color: "var(--text-primary, var(--color-slate-900))",
                borderLeft: "1px solid var(--border, var(--color-slate-200))",
                boxShadow: "-16px 0 48px rgba(15, 23, 42, 0.25)",
                display: "flex",
                flexDirection: "column",
                animation: "slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
              }
        }
      >
        <div
          className="fc-detail-header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 20px",
            borderBottom: "1px solid var(--border, var(--color-slate-200))",
            background: "var(--surface, #ffffff)",
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary, var(--color-slate-900))", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 12 }}>
            {title}
          </div>
          <IconButton
            size="small"
            onClick={onClose}
            aria-label="Close details"
            sx={{
              background: "var(--surface-2, var(--color-slate-100))",
              border: "1px solid var(--border, var(--color-slate-200))",
              borderRadius: 8,
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "var(--text-secondary, var(--color-slate-500))",
              fontSize: 18,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            ×
          </IconButton>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          {children}
        </div>
      </aside>
    </div>,
    document.body
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

export function Modal({
  title,
  onClose,
  children,
  wide,
  extraWide,
  maxWidth,
  footer,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  extraWide?: boolean;
  maxWidth?: "xs" | "sm" | "md" | "lg" | "xl" | false;
  footer?: ReactNode;
}) {
  const titleId = useId();
  const resolvedMaxWidth = maxWidth || (extraWide ? "xl" : wide ? "lg" : "sm");
  // Honor an explicit maxWidth instead of collapsing every dialog to 560px.
  // xs stays at 560 (historic width); wide/extraWide keep their own sizes.
  const maxWidthPixels: Record<"xs" | "sm" | "md" | "lg" | "xl", number> = {
    xs: 560,
    sm: 600,
    md: 900,
    lg: 960,
    xl: 1200,
  };
  const pixelMaxWidth = extraWide
    ? 1320
    : wide
      ? 960
      : maxWidth
        ? maxWidthPixels[maxWidth]
        : 560;
  return (
    <Dialog
      open
      onClose={onClose}
      fullWidth
      maxWidth={resolvedMaxWidth}
      aria-labelledby={titleId}
      slotProps={{
        paper: {
          sx: {
            borderRadius: 3,
            maxWidth: pixelMaxWidth,
            width: "100%",
            maxHeight: "92vh",
            display: "flex",
            flexDirection: "column",
            backgroundImage: "none",
            boxShadow: "0 24px 64px rgba(15, 23, 42, 0.28)",
            overflow: "hidden",
          },
        },
      }}
    >
      <DialogTitle
        id={titleId}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          px: 3,
          py: 2,
          fontSize: 17,
          fontWeight: 800,
          borderBottom: "1px solid var(--border, var(--color-slate-200))",
          background: "var(--surface, #ffffff)",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        {title}
        <IconButton size="small" onClick={onClose} aria-label="Close dialog" sx={{ fontWeight: 800 }}>
          ×
        </IconButton>
      </DialogTitle>
      <DialogContent
        sx={{
          p: { xs: 2, sm: 3 },
          flex: "1 1 auto",
          overflowY: "auto",
        }}
      >
        {children}
      </DialogContent>
      {footer && (
        <div
          style={{
            padding: "14px 24px",
            borderTop: "1px solid var(--border, var(--color-slate-200))",
            background: "var(--surface-2, var(--color-slate-50))",
            display: "flex",
            justifyContent: "flex-end",
            gap: 12,
            position: "sticky",
            bottom: 0,
            zIndex: 10,
          }}
        >
          {footer}
        </div>
      )}
    </Dialog>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {Array.from({ length: cols }).map((_, c) => (
              <th key={c} style={{ padding: "12px 14px", borderBottom: "2px solid var(--border-color, var(--color-slate-300))" }}>
                <div className="skeleton-shimmer" style={{ height: 14, width: "60%" }} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r} style={{ borderBottom: "1px solid var(--border-subtle, var(--color-slate-200))" }}>
              {Array.from({ length: cols }).map((_, c) => (
                <td key={c} style={{ padding: "14px" }}>
                  <div className="skeleton-shimmer" style={{ height: 14, width: c === 0 ? "80%" : "50%" }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type DataTableColumn<T> = {
  id: string;
  header: string;
  accessor: (row: T, index: number) => ReactNode;
  align?: "left" | "center" | "right";
  width?: string | number;
};

export function DataTable<T>({
  rows,
  columns,
  keyExtractor,
  emptyTitle = "No records found",
  emptyDescription = "There are no entries in this view.",
  loading = false,
  onRowClick,
}: {
  rows: T[];
  columns: DataTableColumn<T>[];
  keyExtractor: (row: T, index: number) => string | number;
  emptyTitle?: string;
  emptyDescription?: string;
  loading?: boolean;
  onRowClick?: (row: T) => void;
}) {
  if (loading) {
    return <TableSkeleton rows={5} cols={columns.length} />;
  }

  if (!rows || rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="table-scroll" style={{ overflowX: "auto", width: "100%" }}>
      <table className="fc-data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.id}
                style={{
                  textAlign: col.align || "left",
                  width: col.width,
                  padding: "12px 14px",
                  fontSize: 13,
                  fontWeight: 800,
                  color: "var(--text-primary)",
                  borderBottom: "2px solid var(--border-color)",
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={keyExtractor(row, index)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              style={{
                cursor: onRowClick ? "pointer" : "default",
                borderBottom: "1px solid var(--border-subtle)",
              }}
            >
              {columns.map((col) => (
                <td
                  key={col.id}
                  style={{
                    textAlign: col.align || "left",
                    padding: "12px 14px",
                    fontSize: 14,
                    fontWeight: 500,
                    color: "var(--text-primary)",
                  }}
                >
                  {col.accessor(row, index)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
