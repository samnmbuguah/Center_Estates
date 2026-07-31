import Link from "next/link";
import { modules } from "@/lib/modules";

export default function Home() {
  return <div className="page-wrap">
    <section className="hero"><p className="eyebrow">Command Center</p><h1>Good morning, Akin.</h1><p>Access subscribed modules, shared approvals and cross-platform activity from one workspace.</p></section>
    <section aria-labelledby="modules-heading">
      <div className="section-heading"><div><p className="eyebrow">Your workspace</p><h2 id="modules-heading">ERP modules</h2></div><span className="status-pill">Architecture scaffold</span></div>
      <div className="module-grid">{modules.map((module) => <Link className="module-card" href={`/${module.slug}`} key={module.slug}>
        <span className="module-icon" style={{ background: `${module.accent}18`, color: module.accent }}>{module.name.slice(0, 1)}</span>
        <h3>{module.name}</h3><p>{module.description}</p><span className="open-link">Open module <span aria-hidden>→</span></span>
      </Link>)}</div>
    </section>
  </div>;
}
