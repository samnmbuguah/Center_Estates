import { useEffect, useState, useMemo } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Coins,
  Layers,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  fetchMilestoneMiniBoQ,
  saveMilestoneMiniBoQ,
  get,
} from "../api";


interface BoQAllocationDrawerProps {
  open: boolean;
  milestone: {
    id: string | number;
    milestone_id: string;
    percent_complete?: number;
  } | null;
  projectId: string;
  onClose: () => void;
  onSuccess?: () => void;
}

interface ProjectBoqItem {
  id: number;
  section: string;
  item_number: string;
  description: string;
  unit: string;
  quantity: string | number;
  rate: string | number;
  amount: string | number;
}

export function BoQAllocationDrawer({
  open,
  milestone,
  projectId,
  onClose,
  onSuccess,
}: BoQAllocationDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [allBoqItems, setAllBoqItems] = useState<ProjectBoqItem[]>([]);
  const [allocatedItems, setAllocatedItems] = useState<
    { boq_item_id: number; allocated_quantity: number; notes?: string }[]
  >([]);

  useEffect(() => {
    if (!open || !milestone?.id || !projectId) return;

    setLoading(true);
    setError(null);

    Promise.all([
      // Fetch master BoQ items
      get<ProjectBoqItem[]>(`/projects/${projectId}/boq-items`)
        .catch(() => get<ProjectBoqItem[]>(`/boq/?project_id=${projectId}`))
        .catch(() => []),
      // Fetch existing mini-BoQ items
      fetchMilestoneMiniBoQ(milestone.id),
    ])

      .then(([boqList, miniBoqRes]) => {
        setAllBoqItems(Array.isArray(boqList) ? boqList : []);
        const existing = (miniBoqRes?.items || []).map((it: any) => ({
          boq_item_id: it.boq_item_id || it.boq_item?.id,
          allocated_quantity: Number(it.allocated_quantity || 0),
          notes: it.notes || "",
        }));
        setAllocatedItems(existing);
      })
      .catch((err: any) => {
        setError(err.message || "Failed to load BoQ items");
      })
      .finally(() => setLoading(false));
  }, [open, milestone?.id, projectId]);

  const filteredBoq = useMemo(() => {
    if (!search.trim()) return allBoqItems;
    const q = search.toLowerCase();
    return allBoqItems.filter(
      (b) =>
        (b.item_number || "").toLowerCase().includes(q) ||
        (b.description || "").toLowerCase().includes(q) ||
        (b.section || "").toLowerCase().includes(q)
    );
  }, [allBoqItems, search]);

  const allocatedMap = useMemo(() => {
    const map = new Map<number, number>();
    for (const it of allocatedItems) {
      map.set(it.boq_item_id, it.allocated_quantity);
    }
    return map;
  }, [allocatedItems]);

  const handleToggleItem = (item: ProjectBoqItem) => {
    if (allocatedMap.has(item.id)) {
      setAllocatedItems(allocatedItems.filter((it) => it.boq_item_id !== item.id));
    } else {
      const defaultQty = Number(item.quantity) || 1;
      setAllocatedItems([
        ...allocatedItems,
        { boq_item_id: item.id, allocated_quantity: defaultQty, notes: "" },
      ]);
    }
  };

  const handleUpdateQty = (itemId: number, qty: number) => {
    setAllocatedItems(
      allocatedItems.map((it) =>
        it.boq_item_id === itemId ? { ...it, allocated_quantity: Math.max(0, qty) } : it
      )
    );
  };

  const handleSave = async () => {
    if (!milestone?.id) return;
    setSaving(true);
    setError(null);
    try {
      await saveMilestoneMiniBoQ(milestone.id, allocatedItems);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save mini-BoQ allocation");
    } finally {
      setSaving(false);
    }
  };

  if (!open || !milestone) return null;

  const totalAllocatedValue = allocatedItems.reduce((sum, alloc) => {
    const orig = allBoqItems.find((b) => b.id === alloc.boq_item_id);
    const rate = Number(orig?.rate || 0);
    return sum + rate * alloc.allocated_quantity;
  }, 0);

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1150 }}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 900,
          width: "92vw",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          padding: 0,
          overflow: "hidden",
          borderRadius: 12,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 22px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "var(--surface)",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Layers size={18} color="#0066cc" />
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
                BoQ Allocation Matrix
              </h3>
              <span
                style={{
                  fontFamily: "monospace",
                  padding: "2px 8px",
                  borderRadius: 4,
                  fontSize: 12,
                  background: "var(--accent-subtle, rgba(0, 102, 204, 0.1))",
                  color: "var(--color-brand-blue, #0066cc)",
                  fontWeight: 600,
                }}
              >
                {milestone.milestone_id}
              </span>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
              Assign Bill of Quantities line items and quantities to this milestone to power automated valuation.
            </p>
          </div>
          <button className="btn ghost sm" onClick={onClose} style={{ padding: 6 }}>
            <X size={18} />
          </button>
        </div>

        {/* Live Metrics Strip */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 22px",
            background: "var(--surface-2, rgba(0,0,0,0.02))",
            borderBottom: "1px solid var(--border)",
            fontSize: 12,
          }}
        >
          <div>
            <span>Allocated Items: </span>
            <strong style={{ color: "#0066cc" }}>{allocatedItems.length} lines</strong>
          </div>
          <div>
            <span>Total Milestone BoQ Value: </span>
            <strong style={{ fontFamily: "monospace", fontSize: 14, color: "#16a34a" }}>
              KES {totalAllocatedValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </strong>
          </div>
        </div>

        {/* Search Bar */}
        <div style={{ padding: "12px 22px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ position: "relative" }}>
            <Search
              size={16}
              style={{ position: "absolute", left: 10, top: 10, color: "var(--muted)" }}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by BoQ section, item number, or description..."
              style={{
                width: "100%",
                paddingLeft: 34,
                paddingRight: 12,
                height: 36,
                borderRadius: 6,
                border: "1px solid var(--border)",
                fontSize: 13,
              }}
            />
          </div>
        </div>

        {/* Scrollable Item Selector */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 22px" }}>
          {error && (
            <div
              style={{
                padding: "8px 12px",
                borderRadius: 6,
                background: "#fee2e2",
                color: "#991b1b",
                fontSize: 12,
                marginBottom: 12,
              }}
            >
              {error}
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>
              Loading project Bill of Quantities...
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredBoq.map((item) => {
                const isAllocated = allocatedMap.has(item.id);
                const currentQty = allocatedMap.get(item.id) ?? Number(item.quantity);
                const rate = Number(item.rate || 0);
                const subtotal = currentQty * rate;

                return (
                  <div
                    key={item.id}
                    style={{
                      border: "1px solid",
                      borderColor: isAllocated ? "var(--color-brand-blue, #0066cc)" : "var(--border)",
                      background: isAllocated ? "rgba(0, 102, 204, 0.02)" : "var(--surface)",
                      borderRadius: 8,
                      padding: "10px 14px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      transition: "border-color 0.15s ease",
                    }}
                  >
                    {/* Item details */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span
                          style={{
                            fontFamily: "monospace",
                            fontSize: 12,
                            fontWeight: 700,
                            color: "var(--muted)",
                          }}
                        >
                          {item.section}/{item.item_number}
                        </span>
                        <strong style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.description}
                        </strong>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                        Contract Scope: {Number(item.quantity).toLocaleString()} {item.unit} @ KES {rate.toLocaleString()}
                      </div>
                    </div>

                    {/* Allocation Input & Actions */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {isAllocated && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 11, color: "var(--muted)" }}>Allocated Qty:</span>
                          <input
                            type="number"
                            min={0}
                            max={Number(item.quantity) * 1.5}
                            value={currentQty}
                            onChange={(e) => handleUpdateQty(item.id, Number(e.target.value) || 0)}
                            style={{
                              width: 90,
                              height: 30,
                              fontSize: 12,
                              padding: "2px 8px",
                              borderRadius: 4,
                              border: "1px solid var(--border)",
                              textAlign: "right",
                              fontFamily: "monospace",
                            }}
                          />
                          <span style={{ fontSize: 11, color: "var(--muted)", width: 30 }}>{item.unit}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, fontFamily: "monospace", width: 110, textAlign: "right" }}>
                            KES {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}

                      <button
                        className={`btn sm ${isAllocated ? "danger" : "ghost"}`}
                        onClick={() => handleToggleItem(item)}
                        style={{ padding: "4px 10px", fontSize: 12 }}
                      >
                        {isAllocated ? (
                          <>
                            <Trash2 size={13} />
                            <span>Remove</span>
                          </>
                        ) : (
                          <>
                            <Plus size={13} />
                            <span>Allocate</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}

              {filteredBoq.length === 0 && (
                <div style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>
                  No BoQ items match "{search}".
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "14px 22px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "var(--surface)",
          }}
        >
          <div style={{ fontSize: 12, color: "var(--muted)" }}>
            Saving updates this milestone's mini-BoQ line allocations and re-derives the IPC valuation.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button className="btn primary" onClick={handleSave} disabled={saving || loading}>
              {saving ? "Saving..." : "Save Allocations"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
