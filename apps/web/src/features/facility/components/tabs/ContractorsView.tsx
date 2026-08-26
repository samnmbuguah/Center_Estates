"use client";

import React, { useState } from "react";
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { Download, FileUp, Pencil, Plus, RotateCcw, Trophy, X } from "lucide-react";
import { Row } from "../../types/facility.types";
import { exportCsv } from "../../utils/facility.utils";
import { FcStatus } from "../FacilityToolbar";
import { apiFetch } from "@/lib/api";
import { BulkContractorUploaderModal } from "../modals/BulkContractorUploaderModal";
import { EditContractorModal } from "../modals/EditContractorModal";

function FcKpiCard({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  sub,
}: {
  icon: string;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="fc-kpi-card" style={{ textAlign: "left" }}>
      <div className="fc-kpi-top">
        <span className="fc-kpi-icon" style={{ background: iconBg, color: iconColor }}>
          {icon}
        </span>
        <span className="fc-kpi-label">{label}</span>
      </div>
      <strong className="fc-kpi-value">{value}</strong>
      {sub && <span className="fc-kpi-sub">{sub}</span>}
    </div>
  );
}

function SpiderRadarChart({ pillars }: { pillars: { name: string; weight: number; score: number }[] }) {
  const size = 260;
  const center = size / 2;
  const radius = 85;
  const count = pillars.length || 7;
  const levels = [0.25, 0.5, 0.75, 1.0];

  const getCoordinates = (index: number, valueRatio: number) => {
    const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
    const r = radius * valueRatio;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  const polygonPoints = pillars
    .map((p, idx) => {
      const coord = getCoordinates(idx, Math.max(0.1, p.score / 100));
      return `${coord.x},${coord.y}`;
    })
    .join(" ");

  const benchmarkPoints = pillars
    .map((_, idx) => {
      const coord = getCoordinates(idx, 0.85); // 85% SLA benchmark
      return `${coord.x},${coord.y}`;
    })
    .join(" ");

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg width={size} height={size} style={{ overflow: "visible" }}>
        {/* Background Grids */}
        {levels.map((lvl, lIdx) => {
          const pts = Array.from({ length: count })
            .map((_, idx) => {
              const c = getCoordinates(idx, lvl);
              return `${c.x},${c.y}`;
            })
            .join(" ");
          return (
            <polygon
              key={lIdx}
              points={pts}
              fill={lIdx === levels.length - 1 ? "var(--surface-sunken)" : "none"}
              stroke="var(--border)"
              strokeDasharray={lIdx < levels.length - 1 ? "2,2" : "none"}
              strokeWidth={1}
            />
          );
        })}

        {/* Spokes */}
        {pillars.map((_, idx) => {
          const end = getCoordinates(idx, 1.0);
          return (
            <line
              key={idx}
              x1={center}
              y1={center}
              x2={end.x}
              y2={end.y}
              stroke="var(--border)"
              strokeWidth={1}
            />
          );
        })}

        {/* Benchmark polygon */}
        <polygon
          points={benchmarkPoints}
          fill="none"
          stroke="#94a3b8"
          strokeWidth={1.5}
          strokeDasharray="3,3"
        />

        {/* Score polygon */}
        <polygon
          points={polygonPoints}
          fill="rgba(37, 99, 235, 0.22)"
          stroke="#2563eb"
          strokeWidth={2.5}
        />

        {/* Vertex dots & text */}
        {pillars.map((p, idx) => {
          const coord = getCoordinates(idx, Math.max(0.1, p.score / 100));
          const labelCoord = getCoordinates(idx, 1.25);
          const shortName = p.name.split(" ")[0];
          return (
            <g key={idx}>
              <circle cx={coord.x} cy={coord.y} r={4} fill="#2563eb" stroke="#fff" strokeWidth={1.5} />
              <text
                x={labelCoord.x}
                y={labelCoord.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={9}
                fontWeight={700}
                fill="var(--text-secondary)"
              >
                {shortName} ({p.score}%)
              </text>
            </g>
          );
        })}
      </svg>
      <div style={{ display: "flex", gap: 14, marginTop: 12, fontSize: 11 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#2563eb", fontWeight: 700 }}>
          <span style={{ width: 10, height: 10, background: "rgba(37,99,235,0.4)", border: "1.5px solid #2563eb", borderRadius: 2 }} /> Provider Score
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#64748b" }}>
          <span style={{ width: 10, height: 2, background: "#94a3b8" }} /> 85% Target Benchmark
        </span>
      </div>
    </div>
  );
}

type ScorecardPillar = { name: string; weight: number; score: number; metric?: string };
type ScorecardData = {
  weighted_score: number;
  completed_jobs: number;
  pillars?: ScorecardPillar[];
};

export function ContractorsView({
  rows,
  kpis,
  onAdd,
  canAdminister,
  organizationId,
  reload,
}: {
  rows: Row[];
  kpis?: Record<string, string | number>;
  onAdd: () => void;
  canAdminister?: boolean;
  organizationId?: string | null;
  reload?: () => void;
}) {
  const [selectedContractor, setSelectedContractor] = useState<Row | null>(null);
  const [editingContractor, setEditingContractor] = useState<Row | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [scorecardData, setScorecardData] = useState<ScorecardData | null>(null);
  const [showScorecardModal, setShowScorecardModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scorecardError, setScorecardError] = useState("");
  const [referenceDate] = useState(() => new Date());

  // Retained for API compatibility with the shared tab renderer while this
  // view derives its richer metrics from provider rows.
  void kpis;
  void onAdd;

  const displayRows = rows;

  const activeCount = displayRows.filter((r) => r.status === "active" || r.approval_status === "approved").length;

  const today = referenceDate.toISOString().slice(0, 10);
  const in60Days = new Date(referenceDate.getTime() + 60 * 86400000).toISOString().slice(0, 10);
  const expiringDocs = displayRows.flatMap((r) => {
    const items: { contractor: string; doc: string; date: string }[] = [];
    for (const [field, label] of [["insurance_expires_on", "Insurance"], ["license_expires_on", "License"], ["tax_compliance_expires_on", "Tax compliance"]] as const) {
      const d = r[field] ? String(r[field]) : "";
      if (d && d <= in60Days) items.push({ contractor: String(r.name), doc: label, date: d });
    }
    return items;
  }).sort((a, b) => a.date.localeCompare(b.date));
  const expiredCount = expiringDocs.filter((d) => d.date <= today).length;
  const activeContracts = displayRows.reduce((s, r) => s + Number(r.active_contracts_count ?? 0), 0);
  const rated = displayRows.filter((r) => Number(r.rating ?? 0) > 0);
  const avgRating = rated.length ? (rated.reduce((s, r) => s + Number(r.rating ?? 0), 0) / rated.length).toFixed(1) : "—";

  const viewScorecard = async (contractor: Row) => {
    setSelectedContractor(contractor);
    setShowScorecardModal(true);
    setLoading(true);
    setScorecardData(null);
    setScorecardError("");
    try {
      const res = await apiFetch(`/facility/contractors/${contractor.id}/scorecard/`);
      if (res.ok) {
        const data = await res.json();
        setScorecardData(data as ScorecardData);
      } else {
        setScorecardError("The live performance scorecard could not be loaded. Retry after contractor activity has been recorded.");
      }
    } catch {
      setScorecardError("The live performance scorecard could not be loaded. Check your connection and retry.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* KPI Strip */}
      <div className="fc-kpi-strip">
        <FcKpiCard icon="🤝" iconBg="#e0e7ff" iconColor="#4f46e5" label="Registered Providers" value={String(displayRows.length)} sub="Specialist vendor master" />
        <FcKpiCard icon="✓" iconBg="#dcfce7" iconColor="#16a34a" label="Active & Approved" value={String(activeCount)} sub={`${displayRows.length - activeCount} pending or suspended`} />
        <FcKpiCard icon="📄" iconBg="#dbeafe" iconColor="#2563eb" label="Active SLA Contracts" value={String(activeContracts)} sub="Across all providers" />
        <FcKpiCard icon="⭐" iconBg="#fdf4ff" iconColor="#9333ea" label="Average Vendor Rating" value={avgRating === "—" ? "—" : `${avgRating} / 5.0`} sub={`${rated.length} rated on 7 pillars`} />
        <FcKpiCard icon="🚨" iconBg="#fee2e2" iconColor="#dc2626" label="Compliance Expiring" value={expiredCount > 0 ? `${expiredCount} expired` : `${expiringDocs.length} due ≤60d`} sub="Tax, insurance & licenses" />
      </div>

      {expiringDocs.length > 0 && (
        <Alert
          severity={expiredCount > 0 ? "error" : "warning"}
          variant="outlined"
          sx={{ borderRadius: 2.5, alignItems: "flex-start", bgcolor: "background.paper", "& .MuiAlert-message": { width: "100%" } }}
        >
          <AlertTitle sx={{ fontWeight: 800, mb: 1 }}>
            {expiredCount > 0
              ? `${expiredCount} expired compliance document${expiredCount === 1 ? "" : "s"} require action`
              : `${expiringDocs.length} compliance document${expiringDocs.length === 1 ? "" : "s"} expire within 60 days`}
          </AlertTitle>
          <Stack direction="row" useFlexGap sx={{ flexWrap: "wrap", gap: 1 }}>
            {expiringDocs.slice(0, 8).map((d, i) => {
              const expired = d.date <= today;
              return (
                <Chip
                  key={`${d.contractor}-${d.doc}-${i}`}
                  size="small"
                  color={expired ? "error" : "warning"}
                  variant="outlined"
                  label={`${d.contractor} · ${d.doc} · ${expired ? "Expired" : "Due"} ${d.date}`}
                  sx={{ fontWeight: 700, bgcolor: "background.paper" }}
                />
              );
            })}
            {expiringDocs.length > 8 && <Chip size="small" label={`+${expiringDocs.length - 8} more`} />}
          </Stack>
        </Alert>
      )}

      {/* Main Vendor Master Table */}
      <article className="data-panel">
        <Box
          sx={{
            p: { xs: 2, md: 2.5 },
            borderBottom: 1,
            borderColor: "divider",
            display: "flex",
            justifyContent: "space-between",
            alignItems: { xs: "stretch", md: "center" },
            flexDirection: { xs: "column", md: "row" },
            gap: 2,
          }}
        >
          <Box>
            <Typography component="h2" variant="h6" sx={{ fontSize: 17, fontWeight: 850 }}>
              Service providers and SLA performance
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
              Manage provider contacts, compliance, contracts and weighted performance scorecards.
            </Typography>
          </Box>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button variant="outlined" size="small" startIcon={<Download size={16} />} onClick={() => exportCsv(displayRows, "contractor-master.csv")}>
              Export CSV
            </Button>
            <Button variant="outlined" size="small" startIcon={<FileUp size={16} />} onClick={() => setShowBulkModal(true)} disabled={!canAdminister}>
              Bulk upload
            </Button>
            <Button variant="contained" size="small" startIcon={<Plus size={16} />} onClick={() => setShowAddModal(true)} disabled={!canAdminister}>
              Add provider
            </Button>
          </Stack>
        </Box>

        <div style={{ overflowX: "auto" }}>
          <table className="data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--surface-sunken)", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "12px 16px", textAlign: "left" }}>Provider</th>
                <th style={{ padding: "12px 16px", textAlign: "left" }}>Primary contact</th>
                <th style={{ padding: "12px 16px", textAlign: "left" }}>Emergency and compliance</th>
                <th style={{ padding: "12px 16px", textAlign: "center" }}>Rating</th>
                <th style={{ padding: "12px 16px", textAlign: "center" }}>Approval status</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((vendor) => (
                <tr key={String(vendor.id)} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "12px 14px" }}>
                    <strong style={{ display: "block", fontSize: "0.85rem", color: "var(--text-primary)" }}>
                      {String(vendor.name)}
                    </strong>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 2 }}>
                      <span style={{ background: "var(--surface-sunken)", border: "1px solid var(--border)", padding: "1px 5px", borderRadius: 3, fontSize: 10, fontWeight: 800 }}>
                        {String(vendor.code)}
                      </span>
                      <span style={{ color: "#2563eb", fontSize: 11, fontWeight: 700 }}>{String(vendor.specialty)}</span>
                    </div>
                  </td>

                  <td style={{ padding: "12px 14px", fontSize: 12 }}>
                    <div style={{ color: "var(--text-primary)", fontWeight: 700 }}>{String(vendor.contact_name ?? "Desk Lead")}</div>
                    <div style={{ color: "var(--text-secondary)" }}>{String(vendor.phone ?? "—")} · {String(vendor.email ?? "")}</div>
                  </td>

                  <td style={{ padding: "12px 14px", fontSize: 12 }}>
                    <span style={{ color: "#dc2626", fontWeight: 800 }}>🚨 {String(vendor.emergency_phone ?? "24/7 Callout Ready")}</span>
                    <div style={{ color: "var(--text-secondary)", fontSize: 11 }}>Tax PIN: {String(vendor.pin_number ?? "—")}</div>
                  </td>

                  <td style={{ padding: "12px 14px", textAlign: "center" }}>
                    <span style={{ background: "#fff7ed", color: "#ea580c", padding: "3px 8px", borderRadius: 6, fontSize: 12, fontWeight: 800 }}>
                      ★ {vendor.rating == null ? "Not rated" : Number(vendor.rating).toFixed(1)}
                    </span>
                  </td>

                  <td style={{ padding: "12px 14px", textAlign: "center" }}>
                    <FcStatus value={String(vendor.approval_status ?? vendor.status ?? "review")} />
                  </td>

                  <td style={{ padding: "12px 14px", textAlign: "right" }}>
                    <Stack direction="row" spacing={0.75} justifyContent="flex-end">
                      <Tooltip title="Edit provider information, contacts and compliance">
                        <span>
                          <Button size="small" variant="outlined" startIcon={<Pencil size={14} />} onClick={() => setEditingContractor(vendor)} disabled={!canAdminister}>
                            Edit
                          </Button>
                        </span>
                      </Tooltip>
                      <Button size="small" variant="text" startIcon={<Trophy size={15} />} onClick={() => viewScorecard(vendor)}>
                        Scorecard
                      </Button>
                    </Stack>
                  </td>
                </tr>
              ))}
              {displayRows.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)" }}>No service providers have been added for this property.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      {/* 7-Pillar Scorecard Modal */}
      {showScorecardModal && selectedContractor && (
        <Dialog open fullWidth maxWidth="md" onClose={() => setShowScorecardModal(false)}>
          <DialogTitle sx={{ pr: 7 }}>
            <Typography component="span" sx={{ display: "block", fontWeight: 850, fontSize: 19 }}>Provider performance scorecard</Typography>
            <Typography component="span" variant="body2" color="text.secondary">{String(selectedContractor.name)} · {String(selectedContractor.specialty)}</Typography>
            <IconButton aria-label="Close scorecard" onClick={() => setShowScorecardModal(false)} sx={{ position: "absolute", right: 12, top: 12 }}><X size={19} /></IconButton>
          </DialogTitle>
          <DialogContent dividers>

            {loading ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)" }}>Calculating weighted KPI scorecard...</div>
            ) : scorecardError ? (
              <Alert severity="error" action={<Button color="inherit" size="small" startIcon={<RotateCcw size={14} />} onClick={() => void viewScorecard(selectedContractor)}>Retry</Button>}>{scorecardError}</Alert>
            ) : scorecardData ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Overall Score Meter */}
                <div style={{ padding: 16, background: "var(--surface-sunken)", borderRadius: 8, border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase" }}>Overall Weighted Score</span>
                    <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "#16a34a" }}>
                      {scorecardData.weighted_score} / 100
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ background: "#dcfce7", color: "#166534", padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 800 }}>
                      APPROVED · TIER 1 SPECIALIST VENDOR
                    </span>
                    <small style={{ display: "block", color: "var(--text-muted)", marginTop: 4 }}>
                      {scorecardData.completed_jobs} verified work orders executed
                    </small>
                  </div>
                </div>

                {/* Dual Column: Radar Chart + 7 Pillars Table */}
                <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 20, alignItems: "center" }}>
                  {/* Left: Spider Radar Chart */}
                  <div style={{ padding: 12, background: "var(--surface-sunken)", borderRadius: 8, border: "1px solid var(--border)" }}>
                    <SpiderRadarChart pillars={scorecardData.pillars || []} />
                  </div>

                  {/* Right: Pillars List */}
                  <div style={{ display: "grid", gap: 8 }}>
                    {scorecardData.pillars?.map((p) => (
                      <div key={p.name} style={{ padding: "8px 12px", background: "var(--surface-sunken)", borderRadius: 6, border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <strong style={{ fontSize: "0.82rem", color: "var(--text-primary)" }}>{p.name}</strong>
                          <span style={{ fontSize: 11, color: "var(--text-secondary)", marginLeft: 6 }}>({p.weight}% Weight)</span>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.metric}</div>
                        </div>
                        <div style={{ fontSize: "1rem", fontWeight: 900, color: p.score >= 90 ? "#16a34a" : "#2563eb" }}>
                          {p.score}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            ) : null}
          </DialogContent>
          <DialogActions><Button onClick={() => setShowScorecardModal(false)}>Close</Button></DialogActions>
        </Dialog>
      )}

      {showBulkModal && (
        <BulkContractorUploaderModal
          organizationId={organizationId ?? null}
          onClose={() => setShowBulkModal(false)}
          onSuccess={() => {
            setShowBulkModal(false);
            if (reload) reload();
          }}
        />
      )}
      {/* Create / Edit Provider Modal */}
      {(showAddModal || editingContractor) && (
        <EditContractorModal
          contractor={editingContractor}
          organizationId={organizationId}
          onClose={() => {
            setShowAddModal(false);
            setEditingContractor(null);
          }}
          onSaved={() => {
            reload?.();
          }}
        />
      )}
    </div>
  );
}
