"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, ShieldCheck, Users, Activity, Layers } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api";

const dashboardUrl = process.env.NEXT_PUBLIC_POSTHOG_DASHBOARD_URL ?? "";
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com";

type UserStats = { events: number; modules: string[]; last_seen: string | null };
type TelemetryResponse = {
  by_module: Record<string, number>;
  by_user: Record<string, UserStats>;
  events: { id: string; actor: string; note: string; created_at: string }[];
};

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });
}

export default function UsageAnalyticsPage() {
  const { session } = useAuth();
  const [telemetry, setTelemetry] = useState<TelemetryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const isAdministrator = Boolean(session?.user.isSuperuser || session?.permissions.includes("*") || session?.roles.includes("admin"));

  const loadTelemetry = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch("/companion/telemetry/", {}, session?.activeOrganizationId ?? null);
      if (response.ok) {
        setTelemetry(await response.json());
      } else {
        setError("Telemetry could not be loaded.");
      }
    } catch {
      setError("Telemetry could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [session?.activeOrganizationId]);

  useEffect(() => {
    if (isAdministrator) void loadTelemetry();
  }, [isAdministrator, loadTelemetry]);

  if (!isAdministrator) {
    return (
      <div className="page-wrap">
        <section className="empty-state"><ShieldCheck size={36} /><h1>Administrator access required</h1><p>Usage analytics contains organization-wide staff activity and is restricted to authorized administrators.</p></section>
      </div>
    );
  }

  const users = telemetry ? Object.entries(telemetry.by_user).sort((a, b) => b[1].events - a[1].events) : [];
  const modules = telemetry ? Object.entries(telemetry.by_module).sort((a, b) => b[1] - a[1]) : [];
  const totalEvents = users.reduce((sum, [, s]) => sum + s.events, 0);

  return (
    <div className="page-wrap analytics-page">
      <header className="page-head">
        <div><p className="eyebrow">Administration</p><h1>Usage Analytics</h1><p>Embedded PostHog insights for adoption, navigation, task completion and workflow performance.</p></div>
        <a className="btn ghost" href={posthogHost} target="_blank" rel="noreferrer">Open PostHog <ExternalLink size={15} /></a>
      </header>

      {/* Per-user activity summary */}
      <section className="panel" style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <Users size={18} style={{ color: "var(--brand-primary)" }} />
          <h2 style={{ margin: 0, fontSize: 17 }}>Per-user activity</h2>
          <span className="status-pill">{totalEvents} events · {users.length} users</span>
        </div>
        {error && <div className="form-error" style={{ marginBottom: 10 }}>{error}</div>}
        {loading && <p className="muted" style={{ padding: 16 }}>Loading telemetry…</p>}
        {!loading && !error && (
          <div className="table-scroll">
            <table className="fc-data-table">
              <thead>
                <tr><th>User</th><th>Events</th><th>Modules used</th><th>Last activity</th></tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: "center", padding: 20 }} className="muted">No telemetry recorded yet — activity appears as staff use the platform.</td></tr>
                ) : users.map(([username, stats]) => (
                  <tr key={username}>
                    <td><strong style={{ fontSize: 13 }}>{username}</strong></td>
                    <td className="mono" style={{ fontSize: 12 }}>{stats.events}</td>
                    <td>
                      <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {stats.modules.length ? stats.modules.slice(0, 5).map((m) => <span key={m} className="status-pill" style={{ fontSize: 10 }}>{m}</span>) : <span className="muted" style={{ fontSize: 12 }}>—</span>}
                      </span>
                    </td>
                    <td className="muted" style={{ fontSize: 12 }}>{formatWhen(stats.last_seen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Module usage */}
      <section className="panel" style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <Layers size={18} style={{ color: "var(--brand-primary)" }} />
          <h2 style={{ margin: 0, fontSize: 17 }}>Module usage</h2>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {modules.map(([module, count]) => (
            <span key={module} className="status-pill" style={{ fontSize: 12, padding: "6px 12px" }}>
              {module}: <strong>{count}</strong>
            </span>
          ))}
        </div>
      </section>

      {/* Recent telemetry feed */}
      <section className="panel" style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <Activity size={18} style={{ color: "var(--brand-primary)" }} />
          <h2 style={{ margin: 0, fontSize: 17 }}>Recent activity</h2>
        </div>
        <div className="table-scroll">
          <table className="fc-data-table">
            <thead><tr><th>When</th><th>User</th><th>Event</th></tr></thead>
            <tbody>
              {telemetry?.events.length === 0 && <tr><td colSpan={3} style={{ textAlign: "center", padding: 20 }} className="muted">No recent activity.</td></tr>}
              {telemetry?.events.slice(0, 25).map((e) => (
                <tr key={e.id}>
                  <td className="muted" style={{ fontSize: 12 }}>{formatWhen(e.created_at)}</td>
                  <td style={{ fontSize: 13 }}>{e.actor}</td>
                  <td style={{ fontSize: 12 }}>{e.note.replace(/^Telemetry \[/, "")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {dashboardUrl ? (
        <section className="analytics-embed-card">
          <iframe title="Center Estates PostHog analytics dashboard" src={dashboardUrl} allow="fullscreen" sandbox="allow-scripts allow-same-origin allow-popups" referrerPolicy="strict-origin-when-cross-origin" />
        </section>
      ) : (
        <section className="panel analytics-setup">
          <ShieldCheck size={34} />
          <div><h2>Dashboard embed is ready to configure</h2><p>Create a shared PostHog dashboard link, set <code>NEXT_PUBLIC_POSTHOG_DASHBOARD_URL</code> during the web image build, and redeploy. Event collection continues independently of the embed.</p></div>
        </section>
      )}
    </div>
  );
}
