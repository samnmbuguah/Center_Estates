import { useState } from "react";
import { CheckCircle2, Award, Star, DollarSign, Clock, ShieldCheck, Search } from "lucide-react";
import { Pagination } from "@/components/module-ui";

type BidRow = {
  vendor: string;
  bidAmount: number;
  timeline: string;
  rating: number;
  compliance: "100% Compliant" | "Minor Variance";
  recommended?: boolean;
};

export function TenderBiddingMatrixView() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const bids: BidRow[] = [
    { vendor: "Apex Construction Ltd", bidAmount: 14200000, timeline: "45 Days", rating: 4.8, compliance: "100% Compliant", recommended: true },
    { vendor: "BuildCorp Engineering", bidAmount: 15800000, timeline: "60 Days", rating: 4.5, compliance: "100% Compliant" },
    { vendor: "Safari Electrical Contractors", bidAmount: 16500000, timeline: "50 Days", rating: 4.2, compliance: "Minor Variance" },
  ];

  const filtered = bids.filter((b) => b.vendor.toLowerCase().includes(search.toLowerCase()));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 12, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 900, color: "#000000", margin: 0 }}>
            Tender Vendor Bidding Comparison Matrix
          </h2>
          <span style={{ fontSize: 13, color: "#0f172a", fontWeight: 750 }}>
            Side-by-side comparative analysis of incoming contractor bids highlighting price, timeline, and rating.
          </span>
        </div>

        <div style={{ position: "relative", minWidth: 260 }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none" }} />
          <input
            type="text"
            placeholder="Search contractors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: "8px 12px 8px 36px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              fontSize: 13,
              fontWeight: 700,
              color: "#000000",
              width: "100%",
              boxSizing: "border-box",
            }}
          />
        </div>
      </div>

      <div className="data-panel" style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 12, overflow: "hidden" }}>
        <div className="table-scroll">
          <table className="fc-data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ padding: "14px 20px", textAlign: "left", fontSize: 12, fontWeight: 900, color: "#000000" }}>Contractor / Vendor</th>
                <th style={{ padding: "14px 20px", textAlign: "left", fontSize: 12, fontWeight: 900, color: "#000000" }}>Bid Amount (KES)</th>
                <th style={{ padding: "14px 20px", textAlign: "left", fontSize: 12, fontWeight: 900, color: "#000000" }}>Execution Timeline</th>
                <th style={{ padding: "14px 20px", textAlign: "left", fontSize: 12, fontWeight: 900, color: "#000000" }}>Contractor Rating</th>
                <th style={{ padding: "14px 20px", textAlign: "left", fontSize: 12, fontWeight: 900, color: "#000000" }}>Technical Compliance</th>
                <th style={{ padding: "14px 20px", textAlign: "right", fontSize: 12, fontWeight: 900, color: "#000000" }}>Recommendation</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((b) => (
                <tr key={b.vendor} style={{ background: b.recommended ? "#f0fdf4" : "transparent", borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "14px 20px", fontSize: 14, fontWeight: 900, color: "#000000" }}>
                    {b.vendor}
                    {b.recommended && (
                      <span style={{ marginLeft: 8, background: "#dcfce7", color: "#166534", padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 900 }}>
                        ★ Best Value
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "14px 20px", fontSize: 14, fontWeight: 900, color: b.recommended ? "#16a34a" : "#000000" }}>
                    KES {b.bidAmount.toLocaleString()}
                  </td>
                  <td style={{ padding: "14px 20px", fontSize: 13, fontWeight: 800, color: "#000000" }}>
                    {b.timeline}
                  </td>
                  <td style={{ padding: "14px 20px", fontSize: 13, fontWeight: 800, color: "#d97706" }}>
                    ★ {b.rating} / 5.0
                  </td>
                  <td style={{ padding: "14px 20px" }}>
                    <span style={{ background: "#dcfce7", color: "#15803d", padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 800 }}>
                      {b.compliance}
                    </span>
                  </td>
                  <td style={{ padding: "14px 20px", textAlign: "right" }}>
                    <button
                      style={{
                        background: b.recommended ? "#16a34a" : "#ffffff",
                        color: b.recommended ? "#ffffff" : "#000000",
                        border: `1px solid ${b.recommended ? "#16a34a" : "#cbd5e1"}`,
                        padding: "6px 14px",
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 900,
                        cursor: "pointer",
                      }}
                    >
                      {b.recommended ? "Award Tender ✓" : "Review Bid"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "0 20px 16px" }}>
          <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />
        </div>
      </div>
    </div>
  );
}
