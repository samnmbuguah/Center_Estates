import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { useParams } from "@/components/monitoring/react-router-shim";
import { AlertTriangle, CheckCircle, TrendingUp } from "lucide-react";

interface ReconItem {
  boq_item_id: number;
  item_number: string;
  section: string;
  description: string;
  unit: string;
  planned_quantity: string;
  delivered_quantity: string;
  variance: string;
  status: "on_track" | "slightly_over" | "significantly_over";
}

const STATUS_META: { [K in ReconItem["status"]]: { color: string; bg: string; label: string; icon: ReactElement } } = {
  on_track: {
    color: "var(--green)",
    bg: "rgba(34,197,94,0.1)",
    label: "On Track",
    icon: <CheckCircle size={16} />,
  },
  slightly_over: {
    color: "#d97706",
    bg: "rgba(217,119,6,0.1)",
    label: "Slightly Over",
    icon: <TrendingUp size={16} />,
  },
  significantly_over: {
    color: "#dc2626",
    bg: "rgba(220,38,38,0.1)",
    label: "Significantly Over",
    icon: <AlertTriangle size={16} />,
  },
};

export function BoQMaterialReconciliation() {
  const { id = "" } = useParams();
  const [data, setData] = useState<ReconItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { get } = await import("../api");
        const res = await get<any[]>(`/projects/${id}/boq-material-reconciliation`);
        setData(res ?? []);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  return (
    <div>
      <h2>BoQ &harr; Material Reconciliation</h2>
      <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
        Delivered quantities compared against Bill of Quantities allowances.
      </p>
      {error && <div className="error-banner">{error}</div>}
      {loading ? <p className="muted">Loading...</p> : data.length === 0 ? (
        <p className="muted">No BoQ items found for this project.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Description</th>
                <th>Planned Qty</th>
                <th>Unit</th>
                <th>Delivered Qty</th>
                <th>Variance</th>
                <th>Progress</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map(item => {
                const planned = parseFloat(item.planned_quantity || "0");
                const delivered = parseFloat(item.delivered_quantity || "0");
                const pct = planned > 0 ? Math.min((delivered / planned) * 100, 100) : 0;
                const meta = STATUS_META[item.status]!;
                return (
                  <tr key={item.boq_item_id}>
                    <td style={{ whiteSpace: "nowrap" }}>{item.item_number || <span className="muted">&mdash;</span>}</td>
                    <td>{item.description}</td>
                    <td>{item.planned_quantity}</td>
                    <td>{item.unit || <span className="muted">&mdash;</span>}</td>
                    <td>{item.delivered_quantity}</td>
                    <td style={{ color: parseFloat(item.variance) > 0 ? meta.color : undefined, fontWeight: 600 }}>
                      {parseFloat(item.variance) > 0 ? "+" : ""}{item.variance}
                    </td>
                    <td style={{ minWidth: 100 }}>
                      <div style={{ background: "var(--border)", borderRadius: 6, height: 8, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: meta.color, borderRadius: 6, transition: "width 0.3s" }} />
                      </div>
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>{Math.round(pct)}%</span>
                    </td>
                    <td>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 4, fontSize: 12, color: meta.color, background: meta.bg }}>
                        {meta.icon} {meta.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
