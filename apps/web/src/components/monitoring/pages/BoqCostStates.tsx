import { useEffect, useState } from "react";
import { useParams, Link } from "@/components/monitoring/react-router-shim";
import { ArrowLeft, CheckCircle, Filter, Upload, Download } from "lucide-react";
import { fetchBoqItems, fetchProjects, transitionCostState, bulkTransitionCostState, boqTemplateUrl } from "../api";
import { useAuth } from "../auth";
import { ErrorBanner } from "../components";

const money = (v: unknown) => Number(v ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATE_COLORS: Record<string, string> = {
  budgeted: "var(--muted)",
  ascertained: "var(--color-violet-strong)",
  committed: "var(--accent)",
  certified: "var(--success)",
  paid: "var(--color-emerald-strong)",
};

const STATE_ORDER = ["budgeted", "ascertained", "committed", "certified", "paid"];

interface ProjectOption { id: string; name: string }

export function BoqCostStates() {
  const { id = "" } = useParams();
  const { can } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [filterState, setFilterState] = useState<string>("all");
  const [bulkTarget, setBulkTarget] = useState("");
  const [editing, setEditing] = useState<{ id: number; certified_amount: string; certified_quantity: string } | null>(null);

  const load = () => {
    setLoading(true);
    fetchBoqItems(id).then(setItems).catch((e) => setError(e.message)).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    fetchProjects().then(setProjects).catch(() => {});
  }, [id]);

  const projectName = projects.find((p) => p.id === id)?.name ?? id;

  const filtered = filterState === "all" ? items : items.filter((i) => i.cost_state === filterState);

  // Section grouping
  const sections = new Map<string, any[]>();
  for (const item of filtered) {
    const sec = item.section || "general";
    if (!sections.has(sec)) sections.set(sec, []);
    sections.get(sec)!.push(item);
  }

  const stateCounts = STATE_ORDER.map((s) => ({
    state: s,
    count: items.filter((i) => i.cost_state === s).length,
    total: items.filter((i) => i.cost_state === s).reduce((sum, i) => sum + Number(i.amount || 0), 0),
  }));

  const canTransition = (current: string, target: string): boolean => {
    const valid: Record<string, string[]> = {
      budgeted: ["ascertained", "committed"],
      ascertained: ["committed"],
      committed: ["certified"],
      certified: ["paid"],
      paid: [],
    };
    return valid[current]?.includes(target) ?? false;
  };

  const validNextStates = (current: string): string[] => {
    const valid: Record<string, string[]> = {
      budgeted: ["ascertained", "committed"],
      ascertained: ["committed"],
      committed: ["certified"],
      certified: ["paid"],
      paid: [],
    };
    return valid[current] ?? [];
  };

  async function handleTransition(itemId: number, target: string, extra?: Record<string, unknown>) {
    try {
      await transitionCostState(itemId, target, extra);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleBulkTransition() {
    if (!bulkTarget || selected.size === 0) return;
    try {
      await bulkTransitionCostState(Array.from(selected), bulkTarget);
      setSelected(new Set());
      setBulkTarget("");
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  function toggleSelect(id: number) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function toggleAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((i) => i.id)));
    }
  }

  return (
    <div>
      <div className="row" style={{ alignItems: "center", gap: 12, marginBottom: 16 }}>
        <Link to={`/app/projects/${id}/cost-dashboard`} className="btn ghost"><ArrowLeft size={16} /></Link>
        <div>
          <h2 style={{ margin: 0 }}>BoQ Cost States</h2>
          <div className="muted" style={{ fontSize: 13 }}>{projectName} — {items.length} items</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <a
            href={boqTemplateUrl}
            download="boq_template.xlsx"
            className="btn ghost sm"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}
          >
            <Download size={14} /> Download Template
          </a>
          <Link to={id ? `/property-onboarding?module=construction&step=ingestion&id=${id}&type=boq` : "/property-onboarding?module=construction&step=ingestion"} className="btn primary sm" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Upload size={14} /> Import BoQ
          </Link>
        </div>
      </div>
      <ErrorBanner message={error} />

      {loading ? <p className="muted">Loading...</p> : (
      <>
      {/* State summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, marginBottom: 16 }}>
        <div className="card" style={{ padding: "10px 12px", cursor: "pointer", border: filterState === "all" ? "2px solid var(--accent)" : "2px solid transparent" }}
          onClick={() => setFilterState("all")}>
          <div className="muted" style={{ fontSize: 11 }}>All Items</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{items.length}</div>
        </div>
        {stateCounts.map(({ state, count, total }) => (
          <div key={state} className="card" style={{ padding: "10px 12px", cursor: "pointer", border: filterState === state ? `2px solid ${STATE_COLORS[state]}` : "2px solid transparent" }}
            onClick={() => setFilterState(state)}>
            <div className="muted" style={{ fontSize: 11 }}>{state.charAt(0).toUpperCase() + state.slice(1)}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: STATE_COLORS[state] }}>{count}</div>
            <div className="muted" style={{ fontSize: 10 }}>KES {money(total)}</div>
          </div>
        ))}
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && can("finance.certificate.issue") && (
        <div className="card row" style={{ gap: 8, marginBottom: 12, alignItems: "center" }}>
          <span className="muted">{selected.size} items selected</span>
          <select value={bulkTarget} onChange={(e) => setBulkTarget(e.target.value)}>
            <option value="">Transition to...</option>
            {STATE_ORDER.filter((s) => s !== "budgeted").map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          <button className="btn" disabled={!bulkTarget} onClick={handleBulkTransition}>Apply</button>
          <button className="btn ghost" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}

      {/* BoQ Items */}
      {Array.from(sections.entries()).map(([section, secItems]) => (
        <div key={section} style={{ marginBottom: 16 }}>
          <h3 style={{ textTransform: "capitalize", fontSize: 14, marginBottom: 8 }}>
            {section.replace(/_/g, " ")}
            <span className="muted" style={{ marginLeft: 8, fontWeight: 400 }}>({secItems.length} items — KES {money(secItems.reduce((s: number, i: any) => s + Number(i.amount || 0), 0))})</span>
          </h3>
          <div className="card" style={{ overflow: "auto" }}>
            <table>
              <thead>
                <tr>
                  {can("finance.certificate.issue") && <th style={{ width: 30 }}><input type="checkbox" checked={selected.size === secItems.length && secItems.length > 0} onChange={toggleAll} /></th>}
                  <th>Item</th>
                  <th>Description</th>
                  <th>Unit</th>
                  <th className="num">Qty</th>
                  <th className="num">Rate</th>
                  <th className="num">Amount</th>
                  <th>State</th>
                  <th className="num">Cert. Qty</th>
                  <th className="num">Cert. Amt</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {secItems.map((item: any) => {
                  const nextStates = validNextStates(item.cost_state);
                  const isEditing = editing?.id === item.id;
                  const editQty = isEditing ? editing!.certified_quantity : "";
                  const editAmt = isEditing ? editing!.certified_amount : "";
                  return (
                    <tr key={item.id} style={{ background: selected.has(item.id) ? "var(--surface-2)" : undefined }}>
                      {can("finance.certificate.issue") && (
                        <td><input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)} /></td>
                      )}
                      <td className="mono">{item.item_number}</td>
                      <td>{item.description}</td>
                      <td className="muted">{item.unit}</td>
                      <td className="num">{item.quantity}</td>
                      <td className="num">{money(item.rate)}</td>
                      <td className="num"><b>{money(item.amount)}</b></td>
                      <td>
                        <span className="badge" style={{ background: STATE_COLORS[item.cost_state] || "var(--muted)", color: "#fff" }}>
                          {item.cost_state}
                        </span>
                      </td>
                      <td className="num">{isEditing ? (
                        <input style={{ width: 70 }} value={editQty} onChange={(e) => editing && setEditing({ ...editing, certified_quantity: e.target.value })} />
                      ) : item.certified_quantity || "—"}</td>
                      <td className="num">{isEditing ? (
                        <input style={{ width: 90 }} value={editAmt} onChange={(e) => editing && setEditing({ ...editing, certified_amount: e.target.value })} />
                      ) : (Number(item.certified_amount) > 0 ? money(item.certified_amount) : "—")}</td>
                      <td>
                        {can("finance.certificate.issue") && nextStates.length > 0 && (
                          isEditing ? (
                            <div className="row" style={{ gap: 4 }}>
                              <button className="btn sm" onClick={() => {
                                handleTransition(item.id, "certified", {
                                  certified_amount: editAmt,
                                  certified_quantity: editQty,
                                });
                                setEditing(null);
                              }}><CheckCircle size={14} /></button>
                              <button className="btn ghost sm" onClick={() => setEditing(null)}>Cancel</button>
                            </div>
                          ) : (
                            <div className="row" style={{ gap: 4 }}>
                              {nextStates.includes("certified") && (
                                <button className="btn ghost sm" onClick={() => setEditing({
                                  id: item.id,
                                  certified_amount: String(Number(item.amount || 0)),
                                  certified_quantity: String(item.quantity || 0),
                                })}>Certify</button>
                              )}
                              {nextStates.filter((s) => s !== "certified").map((s) => (
                                <button key={s} className="btn ghost sm" onClick={() => handleTransition(item.id, s)}>
                                  {s.charAt(0).toUpperCase() + s.slice(1)}
                                </button>
                              ))}
                            </div>
                          )
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {items.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📐</div>
          <h3 style={{ margin: "0 0 8px 0", fontSize: 18, fontWeight: 700 }}>No BoQ Line Items Found</h3>
          <p className="muted" style={{ maxWidth: 520, margin: "0 auto 24px", fontSize: 14, lineHeight: 1.6 }}>
            This project does not have a Bill of Quantities baseline yet. Upload your priced BoQ spreadsheet (.xlsx) to automatically generate line items and cost tracking states, or download the standard template to get started.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link to={id ? `/property-onboarding?module=construction&step=ingestion&id=${id}&type=boq` : "/property-onboarding?module=construction&step=ingestion"} className="btn primary" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Upload size={16} /> Upload & Ingest BoQ
            </Link>
            <a href={boqTemplateUrl} target="_blank" rel="noreferrer" className="btn ghost" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Download size={16} /> Download BoQ Template
            </a>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}
