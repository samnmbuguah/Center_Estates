"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft, Building2, Users, FileText, Compass, Wrench, Home, History } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api";

type Recent = { id: string; label: string; hint: string; group: string; path: string };
type Command = {
  id: string;
  label: string;
  hint?: string;
  group: string;
  icon: React.ReactNode;
  action: () => void;
  recent?: Recent;
};

const MODULE_ROUTES: { slug: string; label: string }[] = [
  { slug: "property", label: "Property Management" },
  { slug: "facility", label: "Facility Management" },
  { slug: "sales", label: "Sales Management" },
  { slug: "tender", label: "Tender Management" },
  { slug: "valuation", label: "Valuation" },
  { slug: "monitoring", label: "Construction Monitoring" },
  { slug: "companion", label: "Companion" },
];

const PAGE_ROUTES: { path: string; label: string }[] = [
  { path: "/overview", label: "Portfolio Overview" },
  { path: "/tickets", label: "Tickets & Issues" },
  { path: "/calendar", label: "Calendar" },
  { path: "/analytics", label: "Usage Analytics" },
  { path: "/administration", label: "Administration" },
  { path: "/settings", label: "Settings" },
  { path: "/tenant-portal", label: "Tenant Portal" },
  { path: "/buyer-portal", label: "Buyer Portal" },
  { path: "/agent-portal", label: "Agent Portal" },
];

const RECENTS_KEY = "ce_cmd_recents";

export function CommandPalette() {
  const { session } = useAuth();
  const router = useRouter();
  const organizationId = session?.activeOrganizationId ?? null;
  const allowedSlugs = useMemo(
    () => new Set((session?.modules ?? []).map((m) => m.slug)),
    [session?.modules],
  );
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [results, setResults] = useState<Command[]>([]);
  const [recents, setRecents] = useState<Recent[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => { setOpen(false); setQuery(""); setActive(0); }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENTS_KEY);
      if (raw) setRecents(JSON.parse(raw) as Recent[]);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        close();
      }
    };
    const openHandler = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-command-palette", openHandler);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-command-palette", openHandler);
    };
  }, [close]);

  useEffect(() => {
    if (open) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 30);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  const navigationCommands = useMemo<Command[]>(() => {
    const cmds: Command[] = [];
    MODULE_ROUTES.forEach((m) => {
      if (allowedSlugs.size > 0 && !allowedSlugs.has(m.slug)) return;
      cmds.push({
        id: `module:${m.slug}`, label: m.label, hint: "Module", group: "Navigate",
        icon: <Compass size={15} />, action: () => router.push(`/${m.slug}`),
      });
    });
    PAGE_ROUTES.forEach((p) => {
      cmds.push({
        id: `page:${p.path}`, label: p.label, hint: "Page", group: "Navigate",
        icon: <Compass size={15} />, action: () => router.push(p.path),
      });
    });
    return cmds;
  }, [allowedSlugs, router]);

  useEffect(() => {
    if (!open || !organizationId) return;
    const q = query.trim();
    if (q.length < 2) { setResults([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      const toRows = async (res: Response) => {
        if (!res.ok) return [] as Record<string, unknown>[];
        const data = await res.json();
        return (Array.isArray(data) ? data : data.results ?? []) as Record<string, unknown>[];
      };
      const get = (path: string) => apiFetch(`${path}?search=${encodeURIComponent(q)}`, {}, organizationId);
      try {
        const [buyers, sales, listings, tenants, leases, assets, workOrders] = await Promise.all([
          get("/sales/buyers/").then(toRows),
          get("/sales/sales/").then(toRows),
          get("/sales/inventory/").then(toRows),
          get("/property/tenants/").then(toRows),
          get("/property/leases/").then(toRows),
          get("/facility/assets/").then(toRows),
          get("/facility/work-orders/").then(toRows),
        ]);
        if (cancelled) return;
        const cmds: Command[] = [];
        const push = (cmd: Command) => cmds.push(cmd);

        buyers.slice(0, 4).forEach((b) => push({
          id: `buyer:${b.id}`, label: String(b.full_name ?? b.reference ?? "Buyer"),
          hint: `${String(b.reference ?? "")} · ${String(b.status ?? "")}`, group: "Buyers",
          icon: <Users size={15} />, action: () => router.push(`/sales/buyers/${String(b.id)}`),
          recent: { id: `buyer:${b.id}`, label: String(b.full_name ?? "Buyer"), hint: "Buyer", group: "Buyers", path: `/sales/buyers/${String(b.id)}` },
        }));
        sales.slice(0, 4).forEach((s) => push({
          id: `sale:${s.id}`, label: String(s.reference ?? "Sale"),
          hint: `${String(s.buyer_name ?? "")} · ${String(s.unit_code ?? "")}`, group: "Sales",
          icon: <FileText size={15} />, action: () => router.push("/sales?tab=sales"),
        }));
        listings.slice(0, 4).forEach((l) => push({
          id: `listing:${l.id}`, label: `Unit ${String(l.unit_code ?? l.code ?? "")}`,
          hint: `${String(l.project_name ?? "")} · ${String(l.status ?? "")}`, group: "Units",
          icon: <Building2 size={15} />, action: () => router.push("/sales?tab=inventory"),
        }));
        tenants.slice(0, 4).forEach((t) => push({
          id: `tenant:${t.id}`, label: String(t.name ?? t.code ?? "Tenant"),
          hint: `${String(t.code ?? "")} · ${String(t.status ?? "")}`, group: "Tenants",
          icon: <Home size={15} />, action: () => router.push("/property?tab=tenants"),
          recent: { id: `tenant:${t.id}`, label: String(t.name ?? "Tenant"), hint: "Tenant", group: "Tenants", path: "/property?tab=tenants" },
        }));
        leases.slice(0, 4).forEach((l) => push({
          id: `lease:${l.id}`, label: `Lease ${String(l.reference ?? "")}`,
          hint: `${String(l.tenant_name ?? "")} · ${String(l.unit_code ?? "")}`, group: "Leases",
          icon: <FileText size={15} />, action: () => router.push("/property?tab=leases"),
        }));
        assets.slice(0, 4).forEach((a) => push({
          id: `asset:${a.id}`, label: String(a.name ?? a.code ?? "Asset"),
          hint: `${String(a.code ?? "")} · ${String(a.category ?? "")}`, group: "Assets",
          icon: <Wrench size={15} />, action: () => router.push("/facility?tab=assets"),
        }));
        workOrders.slice(0, 4).forEach((w) => push({
          id: `wo:${w.id}`, label: String(w.number ?? w.title ?? "Work order"),
          hint: `${String(w.title ?? "")} · ${String(w.status ?? "")}`, group: "Work Orders",
          icon: <Wrench size={15} />, action: () => router.push("/facility?tab=work-orders"),
        }));
        setResults(cmds);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 220);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [open, query, organizationId, router]);

  const recentCommands = useMemo<Command[]>(() => recents.map((r) => ({
    id: `recent:${r.id}`, label: r.label, hint: r.hint, group: "Recent",
    icon: <History size={15} />, action: () => router.push(r.path),
  })), [recents, router]);

  const commands = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length === 0) return [...recentCommands, ...navigationCommands];
    const nav = navigationCommands.filter((c) => c.label.toLowerCase().includes(q) || c.group.toLowerCase().includes(q));
    return [...nav, ...results];
  }, [navigationCommands, results, recentCommands, query]);

  useEffect(() => { setActive(0); }, [commands.length]);

  const rememberRecent = (cmd: Command) => {
    if (!cmd.recent) return;
    const next = [cmd.recent, ...recents.filter((r) => r.id !== cmd.recent!.id)].slice(0, 5);
    setRecents(next);
    try { localStorage.setItem(RECENTS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const run = (cmd: Command | undefined) => {
    if (!cmd) return;
    rememberRecent(cmd);
    close();
    cmd.action();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, commands.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); run(commands[active]); }
  };

  if (!open) return null;

  const groups: { name: string; items: { cmd: Command; index: number }[] }[] = [];
  commands.forEach((cmd, index) => {
    let group = groups.find((g) => g.name === cmd.group);
    if (!group) { group = { name: cmd.group, items: [] }; groups.push(group); }
    group.items.push({ cmd, index });
  });

  return (
    <div
      onClick={close}
      style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(15,23,42,0.45)", backdropFilter: "blur(2px)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "12vh" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        style={{ width: "min(640px, 92vw)", background: "var(--surface, #fff)", borderRadius: 14, boxShadow: "0 24px 60px rgba(15,23,42,0.35)", border: "1px solid var(--border)", overflow: "hidden" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
          <Search size={18} style={{ color: "var(--muted)" }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search buyers, sales, units, tenants, leases, assets or jump to a page…"
            aria-label="Command palette search"
            style={{ flex: 1, border: "none", outline: "none", fontSize: 15, background: "transparent", color: "var(--text)" }}
          />
          <kbd style={{ fontSize: 10, color: "var(--muted)", border: "1px solid var(--border)", borderRadius: 5, padding: "2px 6px" }}>ESC</kbd>
        </div>

        <div style={{ maxHeight: "52vh", overflowY: "auto", padding: 6 }}>
          {loading && <div style={{ padding: 12, fontSize: 12, color: "var(--muted)" }}>Searching…</div>}
          {!loading && commands.length === 0 && (
            <div style={{ padding: 20, fontSize: 13, color: "var(--muted)", textAlign: "center" }}>
              {query.trim().length < 2 ? "Type to search…" : "No matches found."}
            </div>
          )}
          {groups.map((group) => (
            <div key={group.name}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--muted)", padding: "8px 10px 4px" }}>{group.name}</div>
              {group.items.map(({ cmd, index }) => (
                <button
                  key={cmd.id}
                  type="button"
                  onMouseEnter={() => setActive(index)}
                  onClick={() => run(cmd)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
                    padding: "9px 10px", borderRadius: 8, border: "none", cursor: "pointer",
                    background: active === index ? "var(--surface-2, #f1f5f9)" : "transparent",
                    color: "var(--text)",
                  }}
                >
                  <span style={{ color: "var(--primary, #ea580c)", display: "inline-flex" }}>{cmd.icon}</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{cmd.label}</span>
                  {cmd.hint && <span style={{ fontSize: 11, color: "var(--muted)" }}>{cmd.hint}</span>}
                  {active === index && <CornerDownLeft size={13} style={{ color: "var(--muted)" }} />}
                </button>
              ))}
            </div>
          ))}
        </div>

        <div style={{ borderTop: "1px solid var(--border)", padding: "8px 14px", fontSize: 11, color: "var(--muted)", display: "flex", gap: 14 }}>
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>⌘K toggle</span>
        </div>
      </div>
    </div>
  );
}
