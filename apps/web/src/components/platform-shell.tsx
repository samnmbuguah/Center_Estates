import Link from "next/link";
import { modules } from "@/lib/modules";

export function PlatformShell({ children }: { children: React.ReactNode }) {
  return <div className="platform">
    <aside className="sidebar">
      <Link className="brand" href="/"><span className="brand-mark">CE</span><span>Center Estates<br /><small>ERP Platform</small></span></Link>
      <nav aria-label="Platform modules">
        <Link className="nav-link" href="/">Command Center</Link>
        {modules.map((module) => <Link className="nav-link" href={`/${module.slug}`} key={module.slug}><span className="nav-dot" style={{ background: module.accent }} />{module.name.replace(" Management", "")}</Link>)}
      </nav>
      <div className="sidebar-foot">Module visibility will be driven by each organization&apos;s subscriptions.</div>
    </aside>
    <div className="workspace">
      <header className="topbar"><div><strong>Acme Property Group</strong><span className="environment">Development workspace</span></div><div className="profile">AK</div></header>
      <main>{children}</main>
    </div>
  </div>;
}

