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

  public init(user: { id?: number; username?: string; role?: string } | null, organizationId: string | null) {
    this.user = user;
    this.organizationId = organizationId;
    if (typeof window !== "undefined") {
      this.currentPath = window.location.pathname;
      this.pageStartTime = Date.now();
      this.setupGlobalClickTracker();
    }
  }

  public trackPageView(pathname: string) {
    if (typeof window === "undefined") return;
    const now = Date.now();
    const duration = now - this.pageStartTime;

    if (this.currentPath && duration > 500) {
      this.sendEvent("page_leave", {
        path: this.currentPath,
        durationSeconds: Math.round(duration / 1000),
      });
    }

    this.currentPath = pathname;
    this.pageStartTime = now;

    const module = pathname.split("/")[1] || "dashboard";
    this.sendEvent("page_view", {
      path: pathname,
      module,
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

    // 1. Post to backend local telemetry audit
    if (this.organizationId) {
      apiFetch("/companion/telemetry/", {
        method: "POST",
        body: JSON.stringify(payload),
      }, this.organizationId).catch(() => {
        /* silent failure */
      });
    }

    // 2. PostHog Telemetry dispatch if PostHog Key is configured
    if (this.posthogKey && typeof window !== "undefined") {
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
    const handler = (e: MouseEvent) => {
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
    window.removeEventListener("click", handler);
    window.addEventListener("click", handler, { capture: true });
  }
}

export const telemetry = new TelemetryEngine();
