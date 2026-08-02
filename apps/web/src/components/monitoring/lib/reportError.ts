/** First-party error reporter — works with or without Sentry. */

import { API_BASE, getToken } from "../api";

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

  // Prefer Sentry when loaded
  try {
    const w = window as unknown as { Sentry?: { captureException: (e: Error, ctx?: object) => void } };
    if (w.Sentry?.captureException) {
      const err = new Error(input.message);
      if (input.stack) err.stack = input.stack;
      w.Sentry.captureException(err, {
        extra: { componentStack: input.componentStack, ...input.extra },
      });
    }
  } catch {
    /* ignore */
  }

  // Always attempt first-party collector (survives missing Sentry DSN)
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    await fetch(`${API_BASE}/client-errors`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        message: input.message,
        stack: input.stack,
        componentStack: input.componentStack,
        url: typeof window !== "undefined" ? window.location.href : "",
        release: typeof process !== "undefined" ? process.env.NODE_ENV || "production" : "production",

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
  window.addEventListener("error", (ev) => {
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
    const stack = reason instanceof Error ? reason.stack : undefined;
    reportClientError({ message, stack });
  });
}
