import { apiFetch } from "@/lib/api";

export type TelemetryEvent = {
  event: string;
  properties?: Record<string, unknown>;
  timestamp?: string;
  url?: string;
  module?: string;
  durationMs?: number;
};

class TelemetryEngine {
  private user: { id?: number; username?: string; role?: string } | null = null;
  private organizationId: string | null = null;
  private currentPath: string = "";
  private pageStartTime: number = Date.now();
  private posthogKey: string | null = process.env.NEXT_PUBLIC_POSTHOG_KEY || null;
  private posthogHost: string = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com";
  private backendQueue: TelemetryEvent[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private clickHandler: ((event: MouseEvent) => void) | null = null;
  private visibilityHandler: (() => void) | null = null;
  private lastPageView = "";
  private lastPageViewAt = 0;
  private backendEnabled = false;
  private consecutiveFailures = 0;
  private readonly maxTransientFailures = 3;

  public init(user: { id?: number; username?: string; role?: string } | null, organizationId: string | null) {
    const sessionChanged = this.user?.id !== user?.id || this.organizationId !== organizationId;
    this.user = user;
    this.organizationId = organizationId;
    this.backendEnabled = Boolean(user && organizationId);
    if (sessionChanged) {
      this.consecutiveFailures = 0;
      this.backendQueue = [];
      if (this.flushTimer) clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (typeof window !== "undefined") {
      this.currentPath = window.location.pathname;
      this.pageStartTime = Date.now();
      this.setupGlobalClickTracker();
    }
  }

  public trackPageView(pathname: string) {
    if (typeof window === "undefined") return;
    const now = Date.now();
    const pageKey = `${pathname}${window.location.search}`;
    if (pageKey === this.lastPageView && now - this.lastPageViewAt < 1_000) return;
    this.lastPageView = pageKey;
    this.lastPageViewAt = now;
    const duration = now - this.pageStartTime;

    if (this.currentPath && duration > 500) {
      this.sendEvent("page_leave", {
        path: this.currentPath,
        durationSeconds: Math.round(duration / 1000),
      });
    }

    this.currentPath = pathname;
    this.pageStartTime = now;

    const moduleName = pathname.split("/")[1] || "dashboard";
    this.sendEvent("page_view", {
      path: pathname,
      module: moduleName,
      search: window.location.search,
    });
  }

  public trackClick(elementName: string, detail?: Record<string, unknown>) {
    this.sendEvent("user_click", {
      element: elementName,
      path: this.currentPath,
      ...detail,
    });
  }

  public sendEvent(event: string, properties: Record<string, unknown> = {}) {
    const payload: TelemetryEvent = {
      event,
      properties: {
        ...properties,
        username: this.user?.username,
        userId: this.user?.id,
        role: this.user?.role,
        organizationId: this.organizationId,
      },
      timestamp: new Date().toISOString(),
      url: typeof window !== "undefined" ? window.location.href : "",
      module: this.currentPath ? this.currentPath.split("/")[1] || "dashboard" : "dashboard",
    };

    // 1. Batch local telemetry so navigation and click bursts consume one
    // backend worker instead of one request per interaction.
    if (this.backendEnabled && this.organizationId) {
      this.backendQueue.push(payload);
      if (this.backendQueue.length >= 20) void this.flush();
      else this.scheduleFlush();
    }

    // 2. PostHog Telemetry dispatch if a valid project API key (phc_) is configured.
    //    Personal keys (phx_) and other key types are rejected by /e/ with 401.
    if (this.posthogKey?.startsWith("phc_") && typeof window !== "undefined") {
      try {
        fetch(`${this.posthogHost}/e/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: this.posthogKey,
            event,
            properties: {
              distinct_id: this.user?.username || "anonymous",
              ...payload.properties,
            },
            timestamp: payload.timestamp,
          }),
        }).catch((err) => {
          console.error("PostHog telemetry error:", err);
        });
      } catch (err) {
        console.error("PostHog telemetry error:", err);
      }
    }
  }

  private setupGlobalClickTracker() {
    if (typeof window === "undefined") return;
    if (!this.clickHandler) this.clickHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const clickable = target.closest("button, a, [role='button'], input[type='submit'], select");
      if (clickable) {
        const text = clickable.textContent?.trim().slice(0, 60) || clickable.getAttribute("aria-label") || clickable.tagName;
        const tag = clickable.tagName.toLowerCase();
        const href = clickable.getAttribute("href") || undefined;
        this.trackClick(`${tag}:${text}`, { href });
      }
    };
    window.removeEventListener("click", this.clickHandler, { capture: true });
    window.addEventListener("click", this.clickHandler, { capture: true });
    if (!this.visibilityHandler) {
      this.visibilityHandler = () => {
        if (document.visibilityState === "hidden") void this.flush();
      };
      document.addEventListener("visibilitychange", this.visibilityHandler);
    }
  }

  private scheduleFlush() {
    if (!this.backendEnabled || this.flushTimer) return;
    this.flushTimer = setTimeout(() => void this.flush(), 5_000);
  }

  public async flush() {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = null;
    if (!this.backendEnabled || !this.organizationId || this.backendQueue.length === 0) return;
    const events = this.backendQueue.splice(0, 100);
    try {
      const response = await apiFetch("/companion/telemetry/", {
        method: "POST",
        body: JSON.stringify({ events }),
      }, this.organizationId);
      if (response.ok) {
        this.consecutiveFailures = 0;
      } else if ([401, 403].includes(response.status)) {
        // Telemetry is non-critical. An expired/unauthorized session must not
        // create a permanent background request loop or pollute the console.
        this.backendEnabled = false;
        this.backendQueue = [];
        return;
      } else if (response.status >= 400 && response.status < 500) {
        // Invalid or throttled client batches cannot improve by immediate retry.
        return;
      } else {
        throw new Error(`Telemetry returned ${response.status}`);
      }
    } catch {
      this.consecutiveFailures += 1;
      if (this.consecutiveFailures < this.maxTransientFailures) {
        this.backendQueue = [...events, ...this.backendQueue].slice(-200);
      } else {
        this.backendEnabled = false;
        this.backendQueue = [];
      }
    }
    if (this.backendEnabled && this.backendQueue.length > 0) this.scheduleFlush();
  }
}

export const telemetry = new TelemetryEngine();
