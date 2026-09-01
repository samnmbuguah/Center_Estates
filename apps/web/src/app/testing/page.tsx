"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, CircleDotDashed, ExternalLink, FlaskConical, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { apiErrorMessage, apiFetch } from "@/lib/api";

type Status = "not_started" | "in_progress" | "passed" | "failed" | "blocked";
type Item = { key: string; module: string; title: string; url: string; status: Status; notes: string; evidence_url: string; tested_at: string | null; tested_by: string };
type Checklist = { results: Item[]; summary: Record<Status, number>; total: number };

const statusMeta: Record<Status, { label: string; color: string }> = {
  not_started: { label: "Not tested", color: "#64748b" },
  in_progress: { label: "In progress", color: "#2563eb" },
  passed: { label: "Passed", color: "#15803d" },
  failed: { label: "Failed", color: "#dc2626" },
  blocked: { label: "Blocked", color: "#b45309" },
};

export default function TestingPage() {
  const { session } = useAuth();
  const [data, setData] = useState<Checklist | null>(null);
  const [moduleFilter, setModuleFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const isAdmin = Boolean(session?.user.isSuperuser || session?.permissions.includes("*") || session?.roles.some((role) => /admin/i.test(role)));

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true); setError("");
    try {
      const response = await apiFetch("/testing/checklist/", {}, session?.activeOrganizationId ?? null);
      if (!response.ok) throw new Error(await apiErrorMessage(response, "The test checklist could not be loaded."));
      setData(await response.json() as Checklist);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The test checklist could not be loaded."); }
    finally { setLoading(false); }
  }, [isAdmin, session?.activeOrganizationId]);

  useEffect(() => { void load(); }, [load]);
  const modules = useMemo(() => ["All", ...Array.from(new Set(data?.results.map((item) => item.module) ?? []))], [data]);
  const visible = useMemo(() => (data?.results ?? []).filter((item) => (moduleFilter === "All" || item.module === moduleFilter) && (statusFilter === "all" || item.status === statusFilter)), [data, moduleFilter, statusFilter]);
  const completion = data ? Math.round(((data.summary.passed ?? 0) / Math.max(data.total, 1)) * 100) : 0;

  const update = async (item: Item, status: Status, notes = item.notes) => {
    setSaving(item.key); setError("");
    try {
      const response = await apiFetch(`/testing/checklist/${item.key}/`, { method: "PATCH", body: JSON.stringify({ status, notes, evidence_url: item.evidence_url }), headers: { "Content-Type": "application/json" } }, session?.activeOrganizationId ?? null);
      if (!response.ok) throw new Error(await apiErrorMessage(response, "The test status could not be saved."));
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The test status could not be saved."); }
    finally { setSaving(null); }
  };

  if (!isAdmin) return <main className="page-wrap" style={{ maxWidth: 760, margin: "48px auto" }}><section className="content-card" style={{ padding: 32, textAlign: "center" }}><ShieldCheck size={42} color="#dc2626" /><h1>Administrator access required</h1><p className="muted">Release testing evidence is managed by organization administrators.</p></section></main>;

  return <main className="page-wrap" style={{ maxWidth: 1320, margin: "0 auto", paddingBottom: 40 }}>
    <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
      <div><p className="eyebrow" style={{ marginBottom: 4 }}>Release readiness</p><h1 style={{ margin: 0 }}>Testing hub</h1><p className="muted" style={{ margin: "6px 0 0" }}>Record the workflows your team has actually tested. A tick means the current organization has passed that acceptance check.</p></div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}><a className="btn btn-secondary" href="https://api.centerestates.com/console/" target="_blank" rel="noreferrer">API console <ExternalLink size={15} /></a><button className="btn btn-secondary" onClick={() => void load()} disabled={loading}><RefreshCw size={15} className={loading ? "animate-spin" : ""} />Refresh</button></div>
    </header>
    {error && <div role="alert" className="alert-error" style={{ marginBottom: 12 }}>{error}</div>}
    <section className="content-card" style={{ padding: 18, marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "center", flexWrap: "wrap" }}><div><strong>{completion}% release checks passed</strong><div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{data?.summary.passed ?? 0} of {data?.total ?? 0} workflows recorded as passed.</div></div><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{(["passed", "in_progress", "blocked", "failed", "not_started"] as Status[]).map((status) => <span key={status} style={{ color: statusMeta[status].color, fontWeight: 700, fontSize: 13 }}>{data?.summary[status] ?? 0} {statusMeta[status].label}</span>)}</div></div>
      <div style={{ height: 9, borderRadius: 9, overflow: "hidden", background: "var(--surface-muted, #e2e8f0)", marginTop: 14 }}><div style={{ width: `${completion}%`, height: "100%", background: "linear-gradient(90deg, #0f766e, #22c55e)", transition: "width .25s" }} /></div>
    </section>
    <section className="content-card" style={{ padding: 14, marginBottom: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
      <label>Module <select value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)}>{modules.map((module) => <option key={module}>{module}</option>)}</select></label>
      <label>Status <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option>{Object.entries(statusMeta).map(([status, meta]) => <option key={status} value={status}>{meta.label}</option>)}</select></label>
      <span className="muted" style={{ alignSelf: "center", fontSize: 13 }}>{visible.length} checks shown</span>
    </section>
    <section style={{ display: "grid", gap: 10 }} aria-busy={loading}>
      {visible.map((item) => <article className="content-card" key={item.key} style={{ padding: "14px 16px", display: "grid", gridTemplateColumns: "auto minmax(0, 1fr) auto", gap: 14, alignItems: "center" }}>
        <button aria-label={`Mark ${item.title} as ${item.status === "passed" ? "not tested" : "passed"}`} title={item.status === "passed" ? "Mark as not tested" : "Mark as passed"} onClick={() => void update(item, item.status === "passed" ? "not_started" : "passed")} disabled={saving === item.key} style={{ border: 0, background: "transparent", color: item.status === "passed" ? "#16a34a" : "#94a3b8", cursor: "pointer", padding: 2 }}>{item.status === "passed" ? <CheckCircle2 size={25} /> : <CircleDotDashed size={25} />}</button>
        <div><div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><strong>{item.title}</strong><span style={{ color: statusMeta[item.status].color, fontSize: 12, fontWeight: 800 }}>{statusMeta[item.status].label}</span></div><div className="muted" style={{ marginTop: 4, fontSize: 12 }}>{item.module}{item.tested_by ? ` · last updated by ${item.tested_by}` : " · no evidence recorded yet"}</div></div>
        <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}><Link className="btn btn-secondary" style={{ padding: "7px 10px", fontSize: 12 }} href={item.url}>Open workflow</Link><select aria-label={`Status for ${item.title}`} value={item.status} disabled={saving === item.key} onChange={(event) => void update(item, event.target.value as Status)}>{Object.entries(statusMeta).map(([status, meta]) => <option key={status} value={status}>{meta.label}</option>)}</select></div>
      </article>)}
      {!loading && visible.length === 0 && <div className="content-card" style={{ textAlign: "center", padding: 42 }}><FlaskConical size={30} /><h2>No checks match these filters</h2><p className="muted">Change a filter to see the release checklist.</p></div>}
    </section>
    <section className="content-card" style={{ padding: 16, marginTop: 14, borderLeft: "4px solid #2563eb" }}><TriangleAlert size={17} style={{ verticalAlign: "middle", marginRight: 8, color: "#2563eb" }} /><strong>How to use this page:</strong> run the linked workflow as its intended role, confirm the expected result and mark it Passed. Use Blocked or Failed for gaps, then record supporting evidence in your delivery issue tracker. API documentation is generated from the live OpenAPI schema in the console.</section>
  </main>;
}
