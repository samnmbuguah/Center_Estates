"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { modules } from "@/lib/modules";

export default function Home() {
  const { session } = useAuth();
  const allowed = new Set(session?.modules.map((module) => module.slug) ?? []);
  const subscribedModules = modules.filter((module) => allowed.has(module.slug));
  const name = session?.user.firstName || session?.user.username || "there";
  return <div className="page-wrap">
    <section className="hero"><p className="eyebrow">Command Center</p><h1>Good morning, {name}.</h1><p>Access subscribed modules, shared approvals and cross-platform activity from one workspace.</p></section>
    <section aria-labelledby="modules-heading">
      <div className="section-heading"><div><p className="eyebrow">Your workspace</p><h2 id="modules-heading">ERP modules</h2></div><span className="status-pill">{subscribedModules.length} active</span></div>
      <div className="module-grid">{subscribedModules.map((module) => <Link className="module-card" href={`/${module.slug}`} key={module.slug}>
        <span className="module-icon" style={{ background: `${module.accent}18`, color: module.accent }}>{module.name.slice(0, 1)}</span>
        <h3>{module.name}</h3><p>{module.description}</p><span className="open-link">Open module <span aria-hidden>→</span></span>
      </Link>)}</div>
    </section>
  </div>;
}
