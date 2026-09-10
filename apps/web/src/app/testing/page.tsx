"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { 
  CheckCircle2, CircleDotDashed, ExternalLink, FlaskConical, 
  RefreshCw, ShieldCheck, Sparkles, Printer, FileText, Search, 
  Check, X, AlertTriangle, ChevronDown, CheckCheck, Bot, Info, ArrowUpRight
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { apiErrorMessage, apiFetch } from "@/lib/api";

type Status = "not_started" | "in_progress" | "passed" | "failed" | "blocked";
type Item = { 
  key: string; 
  module: string; 
  title: string; 
  url: string; 
  status: Status; 
  notes: string; 
  evidence_url: string; 
  tested_at: string | null; 
  tested_by: string;
  is_auto_verified?: boolean;
};

type Checklist = { 
  results: Item[]; 
  summary: Record<Status, number>; 
  total: number;
  organization_name?: string;
  auto_detected_count?: number;
};

type AIAuditResult = {
  score: number;
  passed_count: number;
  total_features: number;
  verdict: string;
  assessment: string;
  evaluated_at: string;
};

const statusMeta: Record<Status, { label: string; color: string; bg: string }> = {
  not_started: { label: "Not tested", color: "var(--color-slate-500)", bg: "var(--color-slate-100)" },
  in_progress: { label: "In progress", color: "var(--color-info)", bg: "var(--color-blue-soft)" },
  passed: { label: "Passed", color: "var(--color-success)", bg: "var(--color-green-soft)" },
  failed: { label: "Failed", color: "var(--color-danger)", bg: "var(--color-red-soft)" },
  blocked: { label: "Blocked", color: "var(--color-warning)", bg: "#fffbeb" },
};

export default function TestingPage() {
  const { session } = useAuth();
  const [data, setData] = useState<Checklist | null>(null);
  const [moduleFilter, setModuleFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [aiAuditLoading, setAiAuditLoading] = useState(false);
  const [aiAuditData, setAiAuditData] = useState<AIAuditResult | null>(null);
  const [showAiModal, setShowAiModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editEvidenceUrl, setEditEvidenceUrl] = useState("");

  const load = useCallback(async (autoScan = false) => {
    setLoading(true); setError("");
    try {
      const url = autoScan ? "/testing/checklist/?auto_scan=true" : "/testing/checklist/";
      const response = await apiFetch(url, {}, session?.activeOrganizationId ?? null);
      if (!response.ok) throw new Error(await apiErrorMessage(response, "The test checklist could not be loaded."));
      const result = (await response.json()) as Checklist;
      setData(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The test checklist could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [session?.activeOrganizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAutoScan = async () => {
    setScanning(true);
    setError("");
    setSuccessMsg("");
    try {
      const response = await apiFetch("/testing/auto-scan/", { method: "POST" }, session?.activeOrganizationId ?? null);
      if (!response.ok) throw new Error(await apiErrorMessage(response, "Auto-scan failed to execute."));
      const res = await response.json();
      setSuccessMsg(res.message || `Auto-scan successfully verified ${res.detected_features} operational workflows!`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Auto-scan failed.");
    } finally {
      setScanning(false);
    }
  };

  const handleAiAudit = async () => {
    setAiAuditLoading(true);
    setError("");
    try {
      const response = await apiFetch("/testing/ai-audit/", { method: "POST" }, session?.activeOrganizationId ?? null);
      if (!response.ok) throw new Error(await apiErrorMessage(response, "AI QM Audit failed."));
      const res = (await response.json()) as AIAuditResult;
      setAiAuditData(res);
      setShowAiModal(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "AI Quality Master Audit could not be completed.");
    } finally {
      setAiAuditLoading(false);
    }
  };

  const update = async (item: Item, status: Status, notes = item.notes, evidence_url = item.evidence_url) => {
    setSaving(item.key); setError(""); setSuccessMsg("");
    try {
      const response = await apiFetch(
        `/testing/checklist/${item.key}/`,
        {
          method: "PATCH",
          body: JSON.stringify({ status, notes, evidence_url }),
          headers: { "Content-Type": "application/json" }
        },
        session?.activeOrganizationId ?? null
      );
      if (!response.ok) throw new Error(await apiErrorMessage(response, "The test status could not be saved."));
      await load();
      if (editingItem?.key === item.key) {
        setEditingItem(null);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The test status could not be saved.");
    } finally {
      setSaving(null);
    }
  };

  const modules = useMemo(() => ["All", ...Array.from(new Set(data?.results.map((item) => item.module) ?? []))], [data]);

  const visible = useMemo(() => {
    return (data?.results ?? []).filter((item) => {
      const matchesModule = moduleFilter === "All" || item.module === moduleFilter;
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      const matchesSearch = !searchQuery.trim() || 
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.module.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.notes.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.key.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesModule && matchesStatus && matchesSearch;
    });
  }, [data, moduleFilter, statusFilter, searchQuery]);

  const completion = data ? Math.round(((data.summary.passed ?? 0) / Math.max(data.total, 1)) * 100) : 0;
  const autoVerifiedCount = useMemo(() => (data?.results ?? []).filter((r) => r.is_auto_verified).length, [data]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <main className="page-wrap testing-hub-root" style={{ maxWidth: 1360, margin: "0 auto", paddingBottom: 60 }}>
      {/* Printable Report Stylesheet Header */}
      <div className="print-only" style={{ display: "none", marginBottom: 24, borderBottom: "2px solid var(--color-slate-900)", paddingBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0, color: "var(--color-slate-900)" }}>CENTER ESTATES · RELEASE READINESS AUDIT REPORT</h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--color-slate-600)" }}>
              Organization: <strong>{data?.organization_name || session?.organizations.find(o => o.id === session.activeOrganizationId)?.name || "Legend Management Limited"}</strong> · Audit Date: {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: 22, fontWeight: 900, color: completion >= 80 ? "var(--color-success)" : "#ca8a04" }}>{completion}% READINESS SCORE</span>
            <div style={{ fontSize: 12, color: "var(--color-slate-500)" }}>{data?.summary.passed ?? 0} of {data?.total ?? 0} Workflows Verified ({autoVerifiedCount} Auto-Detected)</div>
          </div>
        </div>
      </div>

      {/* Main Page Header */}
      <header className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--primary, var(--color-brand-red))", background: "rgba(226, 59, 59, 0.1)", padding: "3px 8px", borderRadius: 4 }}>
              ADMINISTRATION & GOVERNANCE
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary, var(--color-slate-500))" }}>• 36 End-to-End Workflows</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 850, letterSpacing: "-0.02em", color: "var(--text, var(--color-slate-900))" }}>
            Testing & Release Readiness Hub
          </h1>
          <p className="muted" style={{ margin: "6px 0 0", fontSize: 14, maxWidth: 840, lineHeight: 1.5 }}>
            Continuous quality assurance matrix. Live telemetry tracks button clicks and database operations, automatically verifying workflows as your team operates.
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button 
            className="btn btn-primary" 
            onClick={() => void handleAutoScan()} 
            disabled={scanning || loading}
            style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 750, background: "linear-gradient(135deg, var(--color-brand-red), var(--color-danger-strong))", color: "#fff", border: 0 }}
          >
            <Sparkles size={15} className={scanning ? "animate-spin" : ""} />
            {scanning ? "Scanning System Data…" : "⚡ Auto-Scan System Usage"}
          </button>

          <button 
            className="btn btn-secondary" 
            onClick={() => void handleAiAudit()} 
            disabled={aiAuditLoading || loading}
            style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 700, borderColor: "var(--primary-subtle, var(--color-red-200))", color: "var(--primary, var(--color-brand-red))" }}
          >
            <Bot size={15} />
            {aiAuditLoading ? "Auditing…" : "🤖 AI QM Audit"}
          </button>

          <button 
            className="btn btn-secondary" 
            onClick={handlePrint}
            style={{ display: "flex", alignItems: "center", gap: 7 }}
          >
            <Printer size={15} />
            Export Report
          </button>

          <button 
            className="btn btn-secondary" 
            onClick={() => void load()} 
            disabled={loading}
            style={{ display: "flex", alignItems: "center", gap: 7 }}
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </header>

      {/* Alerts */}
      {error && <div role="alert" className="alert-error no-print" style={{ marginBottom: 14, padding: "12px 16px", borderRadius: 8, background: "var(--color-red-soft)", border: "1px solid var(--color-red-200)", color: "var(--color-danger)" }}>{error}</div>}
      {successMsg && <div role="status" className="no-print" style={{ marginBottom: 14, padding: "12px 16px", borderRadius: 8, background: "var(--color-green-soft)", border: "1px solid var(--color-green-200)", color: "var(--color-success)", fontWeight: 650, display: "flex", alignItems: "center", gap: 8 }}><CheckCheck size={18} />{successMsg}</div>}

      {/* Release Metrics Overview Card */}
      <section className="content-card no-print" style={{ padding: "20px 24px", marginBottom: 16, background: "var(--surface, #ffffff)", borderRadius: 12, border: "1px solid var(--border, var(--color-slate-200))", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20, alignItems: "center" }}>
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 32, fontWeight: 900, color: completion >= 80 ? "var(--color-success)" : completion >= 50 ? "var(--color-info)" : "var(--color-brand-red)", letterSpacing: "-0.03em" }}>
                {completion}%
              </span>
              <span style={{ fontSize: 13, fontWeight: 750, textTransform: "uppercase", color: "var(--text-secondary, var(--color-slate-500))" }}>
                Readiness Index
              </span>
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary, var(--color-slate-500))", marginTop: 2 }}>
              <strong>{data?.summary.passed ?? 0}</strong> of <strong>{data?.total ?? 0}</strong> workflows recorded as passed.
            </div>
            {autoVerifiedCount > 0 && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 800, color: "var(--color-emerald-strong)", background: "#ecfdf5", padding: "2px 8px", borderRadius: 4, marginTop: 6 }}>
                ⚡ {autoVerifiedCount} features auto-verified from database activity
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {(["passed", "in_progress", "blocked", "failed", "not_started"] as Status[]).map((status) => (
              <div key={status} style={{ padding: "8px 14px", borderRadius: 8, background: statusMeta[status].bg, border: `1px solid color-mix(in srgb, ${statusMeta[status].color} 20%, transparent)`, textAlign: "center", minWidth: 90 }}>
                <div style={{ fontSize: 18, fontWeight: 850, color: statusMeta[status].color }}>{data?.summary[status] ?? 0}</div>
                <div style={{ fontSize: 11, fontWeight: 750, color: statusMeta[status].color, textTransform: "uppercase" }}>{statusMeta[status].label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Multi-tier Progress Bar */}
        <div style={{ height: 10, borderRadius: 10, overflow: "hidden", background: "var(--surface-muted, var(--color-slate-200))", marginTop: 18, display: "flex" }}>
          <div style={{ width: `${completion}%`, height: "100%", background: "linear-gradient(90deg, var(--color-emerald), var(--color-success))", transition: "width .3s" }} title={`Passed: ${completion}%`} />
          <div style={{ width: `${Math.round(((data?.summary.in_progress ?? 0) / Math.max(data?.total ?? 1, 1)) * 100)}%`, height: "100%", background: "var(--color-blue)" }} title="In Progress" />
          <div style={{ width: `${Math.round(((data?.summary.blocked ?? 0) / Math.max(data?.total ?? 1, 1)) * 100)}%`, height: "100%", background: "var(--color-amber)" }} title="Blocked" />
          <div style={{ width: `${Math.round(((data?.summary.failed ?? 0) / Math.max(data?.total ?? 1, 1)) * 100)}%`, height: "100%", background: "var(--color-danger)" }} title="Failed" />
        </div>
      </section>

      {/* Filter and Search Bar */}
      <section className="content-card no-print" style={{ padding: "14px 18px", marginBottom: 16, background: "var(--surface, #ffffff)", borderRadius: 10, border: "1px solid var(--border, var(--color-slate-200))", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", flex: 1, minWidth: 280 }}>
          {/* Search */}
          <div style={{ position: "relative", minWidth: 220, flex: 1 }}>
            <Search size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary, var(--color-slate-400))" }} />
            <input
              type="text"
              placeholder="Search workflows, evidence or keys…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: "100%", padding: "7px 10px 7px 32px", fontSize: 13, borderRadius: 6, border: "1px solid var(--border, var(--color-slate-300))", outline: "none" }}
            />
          </div>

          {/* Module Filter */}
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "var(--text-secondary, var(--color-slate-500))" }}>
            Module:
            <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} style={{ padding: "7px 10px", fontSize: 13, borderRadius: 6, border: "1px solid var(--border, var(--color-slate-300))", background: "var(--surface, #ffffff)", fontWeight: 600 }}>
              {modules.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>

          {/* Status Filter */}
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "var(--text-secondary, var(--color-slate-500))" }}>
            Status:
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: "7px 10px", fontSize: 13, borderRadius: 6, border: "1px solid var(--border, var(--color-slate-300))", background: "var(--surface, #ffffff)", fontWeight: 600 }}>
              <option value="all">All statuses</option>
              {Object.entries(statusMeta).map(([st, meta]) => (
                <option key={st} value={st}>{meta.label}</option>
              ))}
            </select>
          </label>
        </div>

        <span className="muted" style={{ fontSize: 13, fontWeight: 700 }}>
          {visible.length} of {data?.total ?? 0} workflows shown
        </span>
      </section>

      {/* Workflow Item Grid */}
      <section style={{ display: "grid", gap: 10 }} aria-busy={loading}>
        {visible.map((item) => (
          <article 
            className="content-card testing-row" 
            key={item.key} 
            style={{ 
              padding: "16px 20px", 
              background: "var(--surface, #ffffff)", 
              borderRadius: 10, 
              border: "1px solid var(--border, var(--color-slate-200))",
              display: "grid", 
              gridTemplateColumns: "auto minmax(0, 1fr) auto", 
              gap: 16, 
              alignItems: "center",
              transition: "all 0.15s ease",
            }}
          >
            {/* Quick Toggle Check Icon */}
            <button 
              aria-label={`Mark ${item.title} as ${item.status === "passed" ? "not tested" : "passed"}`} 
              title={item.status === "passed" ? "Click to reset status" : "Click to mark as Passed"} 
              onClick={() => void update(item, item.status === "passed" ? "not_started" : "passed")} 
              disabled={saving === item.key} 
              style={{ 
                border: 0, 
                background: "transparent", 
                color: item.status === "passed" ? "var(--color-success)" : "var(--color-slate-400)", 
                cursor: "pointer", 
                padding: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {item.status === "passed" ? <CheckCircle2 size={28} /> : <CircleDotDashed size={28} />}
            </button>

            {/* Workflow Info & Evidence Notes */}
            <div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                <strong style={{ fontSize: 14, color: "var(--text, var(--color-slate-900))" }}>{item.title}</strong>
                <span style={{ 
                  background: statusMeta[item.status].bg, 
                  color: statusMeta[item.status].color, 
                  fontSize: 11, 
                  fontWeight: 800, 
                  padding: "2px 8px", 
                  borderRadius: 4, 
                  textTransform: "uppercase",
                  border: `1px solid color-mix(in srgb, ${statusMeta[item.status].color} 20%, transparent)`
                }}>
                  {statusMeta[item.status].label}
                </span>

                {item.is_auto_verified && (
                  <span style={{ fontSize: 11, fontWeight: 800, color: "var(--color-emerald-deep)", background: "#d1fae5", padding: "2px 8px", borderRadius: 4, display: "inline-flex", alignItems: "center", gap: 3 }}>
                    ⚡ Auto-Verified
                  </span>
                )}
              </div>

              <div className="muted" style={{ fontSize: 12, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontWeight: 700, color: "var(--text-secondary, var(--color-slate-600))" }}>{item.module}</span>
                <span>•</span>
                <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--text-secondary, var(--color-slate-500))" }}>{item.key}</span>
                <span>•</span>
                <span>{item.tested_by ? `Tested by ${item.tested_by}` : "No tester assigned"}</span>
                {item.tested_at && (
                  <>
                    <span>•</span>
                    <span>{new Date(item.tested_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  </>
                )}
              </div>

              {/* Live Evidence Note */}
              {item.notes && (
                <div style={{ marginTop: 6, fontSize: 12, padding: "6px 10px", background: "var(--surface-2, var(--color-slate-50))", borderRadius: 6, border: "1px solid var(--border, var(--color-slate-200))", color: "var(--text, var(--color-slate-700))" }}>
                  <strong>Evidence:</strong> {item.notes}
                  {item.evidence_url && (
                    <a href={item.evidence_url} target="_blank" rel="noreferrer" style={{ marginLeft: 8, color: "var(--primary, var(--color-sky))", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 2 }}>
                      View Attachment <ExternalLink size={11} />
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Workflow Actions */}
            <div className="no-print" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
              <Link className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }} href={item.url}>
                Open Workflow <ArrowUpRight size={13} />
              </Link>

              <button 
                className="btn btn-secondary" 
                style={{ padding: "6px 10px", fontSize: 12 }} 
                onClick={() => {
                  setEditingItem(item);
                  setEditNotes(item.notes);
                  setEditEvidenceUrl(item.evidence_url);
                }}
                title="Edit test notes and evidence URL"
              >
                Notes
              </button>

              <select 
                aria-label={`Status for ${item.title}`} 
                value={item.status} 
                disabled={saving === item.key} 
                onChange={(event) => void update(item, event.target.value as Status)}
                style={{ 
                  padding: "6px 10px", 
                  fontSize: 12, 
                  fontWeight: 750, 
                  borderRadius: 6, 
                  border: "1px solid var(--border, var(--color-slate-300))",
                  background: statusMeta[item.status].bg,
                  color: statusMeta[item.status].color,
                  cursor: "pointer"
                }}
              >
                {Object.entries(statusMeta).map(([st, meta]) => (
                  <option key={st} value={st}>{meta.label}</option>
                ))}
              </select>
            </div>
          </article>
        ))}

        {!loading && visible.length === 0 && (
          <div className="content-card" style={{ textAlign: "center", padding: 48, background: "#ffffff", borderRadius: 12, border: "1px solid var(--color-slate-200)" }}>
            <FlaskConical size={36} color="var(--color-slate-400)" />
            <h2 style={{ fontSize: 18, margin: "12px 0 4px" }}>No workflows match the selected filter</h2>
            <p className="muted" style={{ fontSize: 14 }}>Try clearing the search query or changing the module filter.</p>
          </div>
        )}
      </section>

      {/* Formal QA Sign-off Block for Print & Export */}
      <div className="print-only" style={{ display: "none", marginTop: 40, paddingTop: 20, borderTop: "2px solid var(--color-slate-900)" }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 16 }}>OFFICIAL ACCEPTANCE & RELEASE SIGN-OFF</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24 }}>
          <div style={{ borderTop: "1px solid var(--color-slate-400)", paddingTop: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700 }}>Quality Assurance Lead</div>
            <div style={{ fontSize: 11, color: "var(--color-slate-500)", marginTop: 2 }}>Signature & Date: ___________________</div>
          </div>
          <div style={{ borderTop: "1px solid var(--color-slate-400)", paddingTop: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700 }}>Head of Operations / Property Manager</div>
            <div style={{ fontSize: 11, color: "var(--color-slate-500)", marginTop: 2 }}>Signature & Date: ___________________</div>
          </div>
          <div style={{ borderTop: "1px solid var(--color-slate-400)", paddingTop: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700 }}>Systems Auditor / Tech Lead</div>
            <div style={{ fontSize: 11, color: "var(--color-slate-500)", marginTop: 2 }}>Signature & Date: ___________________</div>
          </div>
        </div>
      </div>

      {/* Guidelines Card */}
      <section className="content-card no-print" style={{ padding: 18, marginTop: 20, background: "var(--color-slate-50)", borderRadius: 10, border: "1px solid var(--color-slate-200)", borderLeft: "4px solid var(--color-info)" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <Info size={20} color="var(--color-info)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong style={{ color: "var(--color-slate-800)", fontSize: 14 }}>How Acceptance Testing Works:</strong>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: 13, lineHeight: 1.5 }}>
              1. <strong>Automated Scan:</strong> Click <em>⚡ Auto-Scan System Usage</em> to auto-verify features with database activity (properties, units, leases, invoices, receipts, work orders, meter readings).<br />
              2. <strong>Manual Testing:</strong> Click <em>Open Workflow</em>, exercise the business action in the role, confirm outcome, and set status to <strong>Passed</strong>.<br />
              3. <strong>AI Audit:</strong> Click <em>🤖 AI QM Audit</em> to receive an institutional readiness briefing from Quartermaster AI before production sign-off.
            </p>
          </div>
        </div>
      </section>

      {/* Notes & Evidence Modal */}
      {editingItem && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1400, background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#ffffff", borderRadius: 12, width: "100%", maxWidth: 540, padding: 24, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Record Evidence & Notes</h3>
              <button onClick={() => setEditingItem(null)} style={{ border: 0, background: "transparent", cursor: "pointer", color: "var(--color-slate-500)" }}><X size={20} /></button>
            </div>
            <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--color-slate-500)" }}>
              Workflow: <strong>{editingItem.title}</strong> ({editingItem.key})
            </p>

            <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
              Verification Notes / Findings:
              <textarea 
                value={editNotes} 
                onChange={(e) => setEditNotes(e.target.value)} 
                placeholder="e.g. Created test lease REF-9281 with 10% annual escalation, invoice generated successfully."
                rows={4}
                style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid var(--color-slate-300)", marginTop: 4, fontSize: 13, resize: "vertical" }}
              />
            </label>

            <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 16, marginTop: 12 }}>
              Supporting Evidence URL (Jira / Screenshot / Document):
              <input 
                type="url"
                value={editEvidenceUrl} 
                onChange={(e) => setEditEvidenceUrl(e.target.value)} 
                placeholder="https://..."
                style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--color-slate-300)", marginTop: 4, fontSize: 13 }}
              />
            </label>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button className="btn btn-secondary" onClick={() => setEditingItem(null)}>Cancel</button>
              <button 
                className="btn btn-primary" 
                onClick={() => void update(editingItem, editingItem.status, editNotes, editEvidenceUrl)}
                disabled={saving === editingItem.key}
                style={{ background: "var(--color-brand-red)", color: "#fff", border: 0, fontWeight: 750 }}
              >
                {saving === editingItem.key ? "Saving…" : "Save Evidence"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI QM Audit Modal */}
      {showAiModal && aiAuditData && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1400, background: "rgba(15, 23, 42, 0.65)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#ffffff", borderRadius: 16, width: "100%", maxWidth: 680, maxHeight: "90vh", overflowY: "auto", padding: 28, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, background: "var(--color-green-soft)", color: "var(--color-success)", padding: "3px 8px", borderRadius: 4 }}>
                    QUARTERMASTER AI AUDIT
                  </span>
                  <span style={{ fontSize: 12, color: "var(--color-slate-500)" }}>
                    {new Date(aiAuditData.evaluated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 850, color: "var(--color-slate-900)" }}>
                  Executive Release Readiness Assessment
                </h2>
              </div>
              <button onClick={() => setShowAiModal(false)} style={{ border: 0, background: "transparent", cursor: "pointer", color: "var(--color-slate-500)" }}><X size={22} /></button>
            </div>

            {/* Score & Verdict Banner */}
            <div style={{ display: "flex", gap: 16, alignItems: "center", padding: "16px 20px", background: aiAuditData.score >= 80 ? "var(--color-green-soft)" : "var(--color-blue-soft)", borderRadius: 12, border: "1px solid var(--color-green-200)", marginBottom: 20 }}>
              <div style={{ fontSize: 36, fontWeight: 900, color: aiAuditData.score >= 80 ? "var(--color-success)" : "var(--color-info)" }}>
                {aiAuditData.score}%
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", color: "var(--color-slate-600)" }}>Readiness Verdict</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "var(--color-slate-900)" }}>
                  {aiAuditData.verdict === "PRODUCTION_READY" ? "🟢 PRODUCTION READY" : aiAuditData.verdict === "STAGING_VERIFIED" ? "🟡 STAGING VERIFIED (CONDITIONAL)" : "🔴 TESTING IN PROGRESS"}
                </div>
                <div style={{ fontSize: 12, color: "var(--color-slate-500)" }}>
                  {aiAuditData.passed_count} of {aiAuditData.total_features} core workflows verified.
                </div>
              </div>
            </div>

            {/* AI Assessment Content */}
            <div style={{ fontSize: 14, lineHeight: 1.65, color: "var(--color-slate-700)", background: "var(--color-slate-50)", padding: 20, borderRadius: 10, border: "1px solid var(--color-slate-200)", whiteSpace: "pre-line" }}>
              {aiAuditData.assessment}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={() => setShowAiModal(false)}>Close</button>
              <button className="btn btn-primary" onClick={handlePrint} style={{ background: "var(--color-brand-red)", color: "#fff", border: 0, fontWeight: 750 }}>
                Print Audit Report
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
