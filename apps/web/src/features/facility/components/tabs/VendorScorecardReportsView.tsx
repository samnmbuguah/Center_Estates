"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { TrendingUp, Award, AlertCircle, FileSpreadsheet, RotateCcw } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Row } from "../../types/facility.types";

interface VendorScorecardReportsViewProps {
  organizationId: string | null;
}

export function VendorScorecardReportsView({ organizationId }: VendorScorecardReportsViewProps) {
  const [trends, setTrends] = useState<Row[]>([]);
  const [properties, setProperties] = useState<Row[]>([]);
  const [contractors, setContractors] = useState<Row[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<string>("");
  const [selectedContractor, setSelectedContractor] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchFilters = useCallback(async () => {
    if (!organizationId) return;
    try {
      const [propRes, vndRes] = await Promise.all([
        apiFetch("/property/properties/", {}, organizationId),
        apiFetch("/facility/contractors/", {}, organizationId),
      ]);
      if (propRes.ok) setProperties(await propRes.json());
      if (vndRes.ok) setContractors(await vndRes.json());
    } catch {
      // Ignore
    }
  }, [organizationId]);

  const fetchTrends = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError("");
    let url = "/facility/appraisals/trend_report/?";
    if (selectedProperty) url += `property_id=${selectedProperty}&`;
    if (selectedContractor) url += `contractor_id=${selectedContractor}&`;
    try {
      const res = await apiFetch(url, {}, organizationId);
      if (res.ok) {
        const data = await res.json();
        setTrends(Array.isArray(data.trend) ? data.trend : []);
      } else {
        setError("Failed to load scorecard trend report.");
      }
    } catch {
      setError("Network error loading scorecard trend report.");
    } finally {
      setLoading(false);
    }
  }, [organizationId, selectedProperty, selectedContractor]);

  useEffect(() => {
    fetchFilters();
  }, [fetchFilters]);

  useEffect(() => {
    fetchTrends();
  }, [fetchTrends]);

  const totalAppraisals = trends.length;
  const avgScore = totalAppraisals
    ? Math.round((trends.reduce((acc, t) => acc + Number(t.total_score || 0), 0) / totalAppraisals) * 10) / 10
    : 0;
  const tier1Count = trends.filter((t) => Number(t.total_score || 0) >= 85).length;
  const riskCount = trends.filter((t) => Number(t.total_score || 0) < 70).length;

  return (
    <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <Typography variant="h5" sx={{ fontWeight: 800, color: "#0f172a" }}>
            Vendor Performance &amp; Scorecard Analytics
          </Typography>
          <Typography variant="body2" sx={{ color: "#64748b" }}>
            Multi-period trend analysis across contracted service lines and vendor governance tiers.
          </Typography>
        </div>

        <Stack direction="row" spacing={1.5}>
          <FormControl size="small" sx={{ width: 200 }}>
            <InputLabel>Property</InputLabel>
            <Select
              value={selectedProperty}
              label="Property"
              onChange={(e) => setSelectedProperty(e.target.value)}
            >
              <MenuItem value="">All Properties</MenuItem>
              {properties.map((p) => (
                <MenuItem key={p.id as string} value={p.id as string}>
                  {p.name as string}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ width: 200 }}>
            <InputLabel>Vendor / Contractor</InputLabel>
            <Select
              value={selectedContractor}
              label="Vendor / Contractor"
              onChange={(e) => setSelectedContractor(e.target.value)}
            >
              <MenuItem value="">All Contractors</MenuItem>
              {contractors.map((c) => (
                <MenuItem key={c.id as string} value={c.id as string}>
                  {c.name as string}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "14px" }}>
        <div style={{ background: "#ffffff", padding: "16px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: "#64748b" }}>PORTFOLIO AVG SCORE</Typography>
          <Typography variant="h4" sx={{ fontWeight: 800, color: "#2563eb", mt: 0.5 }}>{avgScore}%</Typography>
          <Typography variant="caption" sx={{ color: "#64748b" }}>Across {totalAppraisals} evaluations</Typography>
        </div>

        <div style={{ background: "#ffffff", padding: "16px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: "#15803d" }}>TIER 1 (APPROVED &ge;85%)</Typography>
          <Typography variant="h4" sx={{ fontWeight: 800, color: "#15803d", mt: 0.5 }}>{tier1Count}</Typography>
          <Typography variant="caption" sx={{ color: "#15803d" }}>High-performing contracts</Typography>
        </div>

        <div style={{ background: "#ffffff", padding: "16px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: "#b91c1c" }}>HIGH RISK (&lt;70%)</Typography>
          <Typography variant="h4" sx={{ fontWeight: 800, color: "#b91c1c", mt: 0.5 }}>{riskCount}</Typography>
          <Typography variant="caption" sx={{ color: "#b91c1c" }}>Requires contract review</Typography>
        </div>

        <div style={{ background: "#ffffff", padding: "16px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: "#475569" }}>EVALUATIONS RECORDED</Typography>
          <Typography variant="h4" sx={{ fontWeight: 800, color: "#0f172a", mt: 0.5 }}>{totalAppraisals}</Typography>
          <Typography variant="caption" sx={{ color: "#64748b" }}>Historical periods</Typography>
        </div>
      </div>

      {error && (
        <Alert severity="error" onClose={() => setError("")} sx={{ borderRadius: "8px" }}>
          {error}
        </Alert>
      )}

      {/* Trend Table */}
      <Paper elevation={0} sx={{ border: "1px solid rgba(0,0,0,0.08)", borderRadius: "10px", overflow: "hidden" }}>
        <TableContainer>
          <Table>
            <TableHead sx={{ background: "#f8fafc" }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, color: "#475569" }}>Evaluation Period</TableCell>
                <TableCell sx={{ fontWeight: 700, color: "#475569" }}>Property</TableCell>
                <TableCell sx={{ fontWeight: 700, color: "#475569" }}>Service Provider</TableCell>
                <TableCell sx={{ fontWeight: 700, color: "#475569" }}>Service Line</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, color: "#475569" }}>Appraisal Score</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, color: "#475569" }}>Tier Rating</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, color: "#475569" }}>Open Actions</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, color: "#475569" }}>Status</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: "#475569" }}>Export</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 4, color: "#64748b" }}>
                    Loading trend analytics...
                  </TableCell>
                </TableRow>
              ) : trends.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 5 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                      <TrendingUp size={32} color="#64748b" />
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>No historical data for this filter</Typography>
                      <Typography variant="body2" sx={{ color: "#64748b" }}>
                        Conduct and post periodic appraisals to generate historical trends.
                      </Typography>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                trends.map((t) => {
                  const score = Number(t.total_score || 0);
                  const isApproved = score >= 85;
                  const isMonitored = score >= 70 && score < 85;
                  const color = isApproved ? "#15803d" : isMonitored ? "#b45309" : "#b91c1c";
                  const bg = isApproved ? "#f0fdf4" : isMonitored ? "#fffbeb" : "#fef2f2";
                  return (
                    <TableRow key={t.id as string} hover>
                      <TableCell sx={{ fontWeight: 700 }}>{t.period_name as string}</TableCell>
                      <TableCell>{t.property_name as string}</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: "#2563eb" }}>{t.contractor_name as string}</TableCell>
                      <TableCell>{t.service_line_name as string}</TableCell>
                      <TableCell align="center">
                        <span style={{ fontWeight: 800, fontSize: "14px", color }}>
                          {score.toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          size="small"
                          label={t.tier_rating as string || (isApproved ? "Tier 1 Approved" : isMonitored ? "Tier 2 Monitored" : "High Risk")}
                          sx={{ fontWeight: 700, fontSize: "11px", bgcolor: bg, color }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          size="small"
                          label={`${t.open_actions_count || 0} Open`}
                          sx={{
                            fontWeight: 600,
                            fontSize: "11px",
                            bgcolor: Number(t.open_actions_count) > 0 ? "#fef2f2" : "#f0fdf4",
                            color: Number(t.open_actions_count) > 0 ? "#b91c1c" : "#15803d",
                          }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          size="small"
                          label={String(t.status).toUpperCase()}
                          sx={{ fontSize: "10px", fontWeight: 700 }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          startIcon={<FileSpreadsheet size={14} />}
                          onClick={() => window.open(`/api/v1/facility/appraisals/${t.id}/export_excel/`, "_blank")}
                          sx={{ textTransform: "none", fontWeight: 600, color: "#16a34a" }}
                        >
                          Excel
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </div>
  );
}

export default VendorScorecardReportsView;
