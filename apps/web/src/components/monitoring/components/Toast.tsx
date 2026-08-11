"use client";

import { useToast } from "../hooks/useToast";

export function ToastContainer() {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  const bgColor = (type: string) => {
    switch (type) {
      case "success": return "var(--success)";
      case "error": return "var(--danger)";
      case "info": return "#2563eb";
      default: return "var(--surface-1)";
    }
  };

  return (
    <div style={{
      position: "fixed", bottom: 20, right: 20, zIndex: 10000,
      display: "flex", flexDirection: "column", gap: 8, pointerEvents: "auto",
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          padding: "12px 16px", borderRadius: 8,
          background: bgColor(t.type), color: "#fff",
          boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
          animation: "slideUp 0.3s ease",
          display: "flex", alignItems: "center", gap: 10,
          maxWidth: 360, minWidth: 260,
        }}>
          <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{t.message}</span>
          <button onClick={() => dismissToast(t.id)} style={{
            background: "none", border: "none", color: "#fff",
            cursor: "pointer", padding: 0, fontSize: 18, lineHeight: 1, opacity: 0.8,
          }}>×</button>
        </div>
      ))}
    </div>
  );
}
