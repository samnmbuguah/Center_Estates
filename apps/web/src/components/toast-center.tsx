"use client";

import { useEffect, useState } from "react";
import { TOAST_EVENT, type ToastItem } from "@/lib/toast";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";

export function ToastCenter() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    function handleToast(e: Event) {
      const customEvent = e as CustomEvent<ToastItem>;
      if (!customEvent.detail) return;
      const newToast = customEvent.detail;
      setToasts((prev) => [...prev.slice(-4), newToast]); // keep max 5 toasts

      const timer = setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
      }, newToast.duration || 4000);

      return () => clearTimeout(timer);
    }

    window.addEventListener(TOAST_EVENT, handleToast);
    return () => window.removeEventListener(TOAST_EVENT, handleToast);
  }, []);

  function removeToast(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 99999,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        maxWidth: "min(420px, calc(100vw - 32px))",
        pointerEvents: "none",
      }}
    >
      {toasts.map((t) => {
        const isSuccess = t.type === "success";
        const isError = t.type === "error";
        const isWarning = t.type === "warning";

        const bg = isSuccess
          ? "var(--color-green-soft)"
          : isError
          ? "var(--color-red-soft)"
          : isWarning
          ? "#fffbeb"
          : "var(--surface, #ffffff)";
        const border = isSuccess
          ? "var(--color-green-200)"
          : isError
          ? "var(--color-red-200)"
          : isWarning
          ? "var(--color-amber-200)"
          : "var(--border, var(--color-slate-200))";
        const textColor = isSuccess
          ? "var(--color-success-strong)"
          : isError
          ? "var(--color-danger-strong)"
          : isWarning
          ? "var(--color-amber-deep)"
          : "var(--text, var(--color-slate-900))";

        return (
          <div
            key={t.id}
            style={{
              pointerEvents: "auto",
              background: bg,
              border: `1.5px solid ${border}`,
              borderRadius: 12,
              padding: "12px 16px",
              boxShadow: "0 10px 25px -5px rgba(0,0,0,0.12), 0 8px 10px -6px rgba(0,0,0,0.08)",
              display: "grid",
              gridTemplateColumns: "auto 1fr auto",
              gap: 12,
              alignItems: "flex-start",
              animation: "toastSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
              backdropFilter: "blur(12px)",
            }}
          >
            <div style={{ marginTop: 2 }}>
              {isSuccess && <CheckCircle2 size={20} color="var(--color-success)" />}
              {isError && <XCircle size={20} color="var(--color-danger)" />}
              {isWarning && <AlertTriangle size={20} color="var(--color-warning)" />}
              {!isSuccess && !isError && !isWarning && <Info size={20} color="var(--color-sky)" />}
            </div>

            <div>
              {t.title && (
                <div style={{ fontWeight: 800, fontSize: 13, color: textColor, marginBottom: 2 }}>
                  {t.title}
                </div>
              )}
              <div style={{ fontSize: 13, color: "var(--text, var(--color-slate-800))", lineHeight: 1.4, fontWeight: 500 }}>
                {t.message}
              </div>
              {t.action && (
                <button
                  onClick={() => {
                    t.action?.onClick();
                    removeToast(t.id);
                  }}
                  style={{
                    marginTop: 8,
                    padding: "4px 10px",
                    borderRadius: 6,
                    border: "1px solid currentColor",
                    background: "transparent",
                    color: textColor,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {t.action.label}
                </button>
              )}
            </div>

            <button
              onClick={() => removeToast(t.id)}
              aria-label="Close notification"
              style={{
                background: "transparent",
                border: 0,
                color: "var(--muted, var(--color-slate-500))",
                cursor: "pointer",
                padding: 2,
                borderRadius: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
