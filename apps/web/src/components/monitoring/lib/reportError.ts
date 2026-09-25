/** First-party error reporter — works with or without Sentry. */

import { API_BASE_URL } from "@/lib/api";

let lastSent = 0;
const MIN_INTERVAL_MS = 2000;

export async function reportClientError(input: {
  message: string;
  stack?: string;
  componentStack?: string;
  extra?: Record<string, unknown>;
}): Promise<void> {
  const now = Date.now();
  if (now - lastSent < MIN_INTERVAL_MS) return;
  lastSent = now;

  // Always attempt first-party collector
  try {
    await fetch(`${API_BASE_URL}/client-errors/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: input.message,
        stack: input.stack,
        componentStack: input.componentStack,
        url: typeof window !== "undefined" ? window.location.pathname : "",
        release: typeof process !== "undefined" ? process.env.NODE_ENV || "production" : "production",
        organizationId: typeof window !== "undefined" ? localStorage.getItem("ce_organization") || "" : "",
        extra: input.extra || {},
      }),
      keepalive: true,
    });
  } catch {
    /* never throw from error reporter */
  }
}

export function installGlobalErrorHandlers(): void {
  if (typeof window === "undefined") return;

  const prevOnError = window.onerror;
  window.onerror = (message, source, lineno, colno, error) => {
    const msg = String(message || "");
    const errMsg = String(error?.message || "");
    if (/startTime|reportAllChanges/i.test(msg) || /startTime|reportAllChanges/i.test(errMsg)) {
      return true; // standard browser suppression for Uncaught TypeError
    }
    if (typeof prevOnError === "function") {
      return prevOnError(message, source, lineno, colno, error);
    }
    return false;
  };

  window.addEventListener("error", (ev) => {
    // Ignore third-party / browser extension web-vitals PerformanceObserver errors
    if (/reading 'startTime'|reportAllChanges/i.test(ev.message || "") || /reading 'startTime'|reportAllChanges/i.test(ev.error?.message || "")) {
      if (typeof ev.preventDefault === "function") ev.preventDefault();
      if (typeof ev.stopImmediatePropagation === "function") ev.stopImmediatePropagation();
      return;
    }

    // Deploys replace hashed chunks. If an already-open tab requests an old
    // chunk, recover once by loading the current index instead of leaving a
    // blank screen. The session guard prevents a reload loop.
    if (/Importing a module script failed|Failed to fetch dynamically imported module/i.test(ev.message || "")) {
      const key = "monitoring-erp:chunk-reload";
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        window.location.reload();
        return;
      }
    }

    reportClientError({
      message: ev.message || "window.error",
      stack: ev.error?.stack,
      extra: { filename: ev.filename, lineno: ev.lineno, colno: ev.colno },
    });
  });
  window.addEventListener("unhandledrejection", (ev) => {
    const reason = ev.reason;
    const message = reason instanceof Error ? reason.message : String(reason || "unhandledrejection");
    if (/reading 'startTime'|reportAllChanges/i.test(message)) {
      if (typeof ev.preventDefault === "function") ev.preventDefault();
      return;
    }
    const stack = reason instanceof Error ? reason.stack : undefined;
    reportClientError({ message, stack });
  });
}
