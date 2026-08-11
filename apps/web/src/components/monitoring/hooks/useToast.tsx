"use client";

import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from "react";

interface ToastItem {
  id: string;
  type: "success" | "error" | "info";
  message: string;
}

interface ToastContextValue {
  toasts: ToastItem[];
  toast: {
    success: (msg: string) => void;
    error: (msg: string) => void;
    info: (msg: string) => void;
  };
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const add = useCallback((t: Omit<ToastItem, "id">) => {
    const id = crypto.randomUUID();
    setToasts(prev => prev.some(item => item.type === t.type && item.message === t.message)
      ? prev
      : [...prev, { ...t, id }].slice(-4));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useMemo(() => ({
    success: (msg: string) => add({ type: "success", message: msg }),
    error: (msg: string) => add({ type: "error", message: msg }),
    info: (msg: string) => add({ type: "info", message: msg }),
  }), [add]);

  useEffect(() => {
    const handleApiError = (event: Event) => {
      const message = (event as CustomEvent<{ message?: string }>).detail?.message;
      if (message) add({ type: "error", message });
    };
    window.addEventListener("ce:api-error", handleApiError);
    const handleUnexpectedError = () => add({
      type: "error",
      message: "Something unexpected happened. Your unsaved form data has been retained; retry or refresh the page.",
    });
    window.addEventListener("error", handleUnexpectedError);
    window.addEventListener("unhandledrejection", handleUnexpectedError);
    return () => {
      window.removeEventListener("ce:api-error", handleApiError);
      window.removeEventListener("error", handleUnexpectedError);
      window.removeEventListener("unhandledrejection", handleUnexpectedError);
    };
  }, [add]);

  return (
    <ToastContext.Provider value={{ toasts, toast, dismissToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
