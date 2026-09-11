import { useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, RotateCcw, SlidersHorizontal, Search } from "lucide-react";
import { fetchStockMovements } from "../api";
import { ErrorBanner } from "../components";
import type { StockMovement } from "../api-types";

const TYPE_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  grn: { label: "Goods receipt", color: "var(--color-green)", icon: <ArrowDownRight size={14} /> },
  issue: { label: "Issue", color: "var(--color-danger)", icon: <ArrowUpRight size={14} /> },
  return: { label: "Return", color: "var(--color-blue)", icon: <RotateCcw size={14} /> },
  adjustment: { label: "Adjustment", color: "var(--color-amber)", icon: <SlidersHorizontal size={14} /> },
};

export function StockMovements() {
  const [rows, setRows] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    fetchStockMovements().then(setRows).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => rows.filter((m) => {
    if (typeFilter && m.movement_type !== typeFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (m.item_name ?? "").toLowerCase().includes(q)
      || (m.reference ?? "").toLowerCase().includes(q)
      || (m.project_name ?? "").toLowerCase().includes(q);
  }), [rows, typeFilter, search]);

  const totals = useMemo(() => {
    const t: Record<string, number> = { grn: 0, issue: 0, return: 0, adjustment: 0 };
    rows.forEach((m) => { t[m.movement_type] = (t[m.movement_type] || 0) + Number(m.quantity || 0); });
    return t;
  }, [rows]);

  return (
    <div>
      <h2>Stock Ledger</h2>
      <p className="muted" style={{ fontSize: 13 }}>Immutable audit of every goods receipt, issue, return and stock-take adjustment.</p>
      <ErrorBanner message={error} />

      <div className="grid mb-md" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 16 }}>
        {(["grn", "issue", "return", "adjustment"] as const).map((k) => (
          <div key={k} className="card card-compact" style={{ borderLeft: `4px solid ${TYPE_META[k].color}` }}>
            <div className="row" style={{ gap: 8, alignItems: "center", marginBottom: 6, color: TYPE_META[k].color }}>
              {TYPE_META[k].icon}<span className="muted fs-xs">{TYPE_META[k].label}</span>
            </div>
            <div className="fw-700 fs-24">{totals[k].toLocaleString()}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div className="row" style={{ gap: 8, alignItems: "center", flex: 1, minWidth: 200 }}>
            <Search size={16} style={{ color: "var(--muted)" }} />
            <input placeholder="Search item, reference or project…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, minWidth: 0 }} />
          </div>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ minWidth: 150 }}>
            <option value="">All movements</option>
            <option value="grn">Goods receipts</option>
            <option value="issue">Issues</option>
            <option value="return">Returns</option>
            <option value="adjustment">Adjustments</option>
          </select>
        </div>
      </div>

      {loading ? <p className="muted">Loading...</p> : (
        <div className="card">
          <table>
            <thead><tr><th>Date</th><th>Item</th><th>Type</th><th>Quantity</th><th>Reference</th><th>Project</th><th>By</th></tr></thead>
            <tbody>
              {filtered.map((m) => {
                const meta = TYPE_META[m.movement_type] ?? TYPE_META.adjustment;
                const qty = Number(m.quantity || 0);
                return (
                  <tr key={m.id}>
                    <td className="mono" style={{ fontSize: 12 }}>{m.created_at ? new Date(m.created_at).toLocaleDateString() : "—"}</td>
                    <td>{m.item_name || `#${m.item}`}</td>
                    <td><span className="badge" style={{ background: meta.color, display: "inline-flex", alignItems: "center", gap: 4 }}>{meta.icon}{meta.label}</span></td>
                    <td className="num mono" style={{ color: qty < 0 ? "var(--color-danger)" : "var(--color-green)", fontWeight: 700 }}>{qty > 0 ? `+${qty.toLocaleString()}` : qty.toLocaleString()}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{m.reference || "—"}</td>
                    <td style={{ fontSize: 12 }}>{m.project_name || "—"}</td>
                    <td style={{ fontSize: 12 }}>{m.created_by_name || "—"}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={7} className="empty">No stock movements recorded.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
