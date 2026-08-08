"use client";

import { ExternalLink, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/auth-provider";

const dashboardUrl = process.env.NEXT_PUBLIC_POSTHOG_DASHBOARD_URL ?? "";
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com";

export default function UsageAnalyticsPage() {
  const { session } = useAuth();
  const isAdministrator = Boolean(session?.user.isSuperuser || session?.permissions.includes("*") || session?.roles.includes("admin"));

  if (!isAdministrator) {
    return (
      <div className="page-wrap">
        <section className="empty-state"><ShieldCheck size={36} /><h1>Administrator access required</h1><p>Usage analytics contains organization-wide staff activity and is restricted to authorized administrators.</p></section>
      </div>
    );
  }

  return (
    <div className="page-wrap analytics-page">
      <header className="page-head">
        <div><p className="eyebrow">Administration</p><h1>Usage Analytics</h1><p>Embedded PostHog insights for adoption, navigation, task completion and workflow performance.</p></div>
        <a className="btn ghost" href={posthogHost} target="_blank" rel="noreferrer">Open PostHog <ExternalLink size={15} /></a>
      </header>
      {dashboardUrl ? (
        <section className="analytics-embed-card">
          <iframe title="Center Estates PostHog analytics dashboard" src={dashboardUrl} allow="fullscreen" referrerPolicy="strict-origin-when-cross-origin" />
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
