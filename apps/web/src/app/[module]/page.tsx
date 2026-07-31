import { notFound } from "next/navigation";
import { getModule, modules } from "@/lib/modules";

export function generateStaticParams() {
  return modules.map((module) => ({ module: module.slug }));
}

export default async function ModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module: slug } = await params;
  const selectedModule = getModule(slug);
  if (!selectedModule) notFound();
  return <div className="page-wrap">
    <section className="module-hero" style={{ borderColor: selectedModule.accent }}>
      <div><p className="eyebrow">Subscribed module</p><h1>{selectedModule.name}</h1><p>{selectedModule.description}</p></div>
      <span className="module-icon large" style={{ background: `${selectedModule.accent}18`, color: selectedModule.accent }}>{selectedModule.name.slice(0, 1)}</span>
    </section>
    {"migration" in selectedModule && <div className="notice">This module will reuse and migrate the existing MonitoringERP implementation.</div>}
    <section><div className="section-heading"><div><p className="eyebrow">Initial boundary</p><h2>Module capabilities</h2></div></div>
      <div className="feature-grid">{selectedModule.features.map((feature, index) => <article className="feature-card" key={feature}><span>{String(index + 1).padStart(2, "0")}</span><h3>{feature}</h3><p>Route and implementation details are traced in the module specification and development plan.</p></article>)}</div>
    </section>
  </div>;
}
