"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { modules } from "@/lib/modules";

export default function Home() {
  const { session } = useAuth();
  const allowed = new Set(session?.modules.map((module) => module.slug) ?? []);
  const subscribedModules = modules.filter((module) => allowed.has(module.slug));
  const name = session?.user.firstName || session?.user.username || "there";
  const organization = session?.organizations.find(item => item.id === session.activeOrganizationId);
  return <div className="page-wrap command-center">
    <section className="command-hero"><div><p className="eyebrow">Command Center</p><h1>Good morning, {name}.</h1><p>One place to move between your property portfolio, field operations, commercial controls and reporting.</p><div className="command-context"><span><i/>Live workspace</span><strong>{organization?.name ?? "Active organization"}</strong><small>{session?.permissions.includes("*") ? "Platform administrator" : session?.roles.join(", ") || "Organization member"}</small></div></div><aside><p>Workspace access</p><strong>{subscribedModules.length}</strong><span>subscribed modules</span><div>{subscribedModules.slice(0,6).map(module => <i key={module.slug} title={module.name} style={{background:module.accent}} />)}</div></aside></section>
    <section aria-labelledby="modules-heading">
      <div className="section-heading command-section-heading"><div><p className="eyebrow">Your workspace</p><h2 id="modules-heading">ERP modules</h2><span>Open a module to continue where your team left off.</span></div><span className="status-pill">{subscribedModules.length} active</span></div>
      <div className="module-grid">{subscribedModules.map((module) => <Link className="module-card" href={`/${module.slug}`} key={module.slug}>
        <header><span className="module-icon" style={{ background: `${module.accent}18`, color: module.accent }}>{module.name.slice(0, 1)}</span><span className="module-live"><i style={{background:module.accent}}/>Available</span></header>
        <h3>{module.name}</h3><p>{module.description}</p><div className="module-features">{module.features.slice(0,3).map(feature => <span key={feature}>{feature}</span>)}</div><span className="open-link">Open workspace <span aria-hidden>→</span></span>
      </Link>)}</div>
    </section>
    <section className="command-help"><div><span>?</span><p><strong>Need help finding a workflow?</strong><small>Use the module navigation or search within a workspace. Access is filtered by your organization subscription and role.</small></p></div><Link href="/monitoring">Open construction control room →</Link></section>
  </div>;
}
