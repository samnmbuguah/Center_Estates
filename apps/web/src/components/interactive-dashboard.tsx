"use client";

import { useState, useCallback, useMemo } from "react";
import {
  Box, Card, CardContent, Typography, Select, MenuItem, Chip,
  IconButton, Tooltip, CircularProgress, Dialog, DialogTitle,
  DialogContent, DialogActions, Button, ToggleButton, ToggleButtonGroup,
  Stack, Grid
} from "@mui/material";
import { 
  TrendingUp, TrendingDown, Download, RefreshCw, Calendar,
  BarChart3, PieChart, LineChart, Maximize2, Info, ArrowUpRight
} from "lucide-react";

export interface KPICard {
  title: string;
  value: number | string;
  previousValue?: number;
  trend?: "up" | "down" | "neutral";
  trendPercentage?: number;
  icon: React.ReactNode;
  color: string;
  suffix?: string;
  prefix?: string;
  drillDown?: () => void;
}

export interface ChartData {
  label: string;
  value: number;
  color?: string;
  breakdown?: { label: string; value: number }[];
}

export interface DashboardProps {
  title: string;
  subtitle?: string;
  kpiCards: KPICard[];
  chartData?: {
    bar?: ChartData[];
    line?: ChartData[];
    pie?: ChartData[];
  };
  loading?: boolean;
  onRefresh?: () => void;
  onExport?: () => void;
  timeRange?: "7d" | "30d" | "90d" | "1y" | "custom";
  onTimeRangeChange?: (range: "7d" | "30d" | "90d" | "1y" | "custom") => void;
}

export function InteractiveDashboard({
  title,
  subtitle,
  kpiCards,
  chartData,
  loading = false,
  onRefresh,
  onExport,
  timeRange = "30d",
  onTimeRangeChange
}: DashboardProps) {
  const [selectedKPI, setSelectedKPI] = useState<KPICard | null>(null);
  const [chartType, setChartType] = useState<"bar" | "line" | "pie">("bar");
  const [viewMode, setViewMode] = useState<"overview" | "detailed">("overview");

  const calculateTrend = useCallback((current: number, previous: number) => {
    if (!previous) return { trend: "neutral", percentage: 0 };
    const percentage = ((current - previous) / previous) * 100;
    return {
      trend: percentage > 0 ? "up" : percentage < 0 ? "down" : "neutral",
      percentage: Math.abs(percentage)
    };
  }, []);

  const renderKPICard = (kpi: KPICard) => {
    const trend = kpi.previousValue 
      ? calculateTrend(Number(kpi.value), kpi.previousValue)
      : { trend: kpi.trend || "neutral", percentage: kpi.trendPercentage || 0 };

    return (
      <Card 
        sx={{ 
          height: "100%", 
          borderRadius: 2, 
          border: `1px solid ${kpi.color}20`,
          transition: "all 0.3s ease",
          cursor: kpi.drillDown ? "pointer" : "default",
          "&:hover": { 
            boxShadow: `0 4px 20px ${kpi.color}30`,
            transform: "translateY(-2px)"
          }
        }}
        onClick={kpi.drillDown}
      >
        <CardContent sx={{ p: 2 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
            <Box sx={{ 
              width: 48, height: 48, borderRadius: 2, 
              bgcolor: `${kpi.color}15`, 
              color: kpi.color,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 24
            }}>
              {kpi.icon}
            </Box>
            {trend.trend !== "neutral" && (
              <Chip
                size="small"
                icon={trend.trend === "up" ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                label={`${trend.percentage.toFixed(1)}%`}
                color={trend.trend === "up" ? "success" : "error"}
                sx={{ height: 24 }}
              />
            )}
          </Box>
          
          <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 600, mb: 0.5 }}>
            {kpi.title}
          </Typography>
          
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>
            {kpi.prefix || ""}{typeof kpi.value === "number" ? kpi.value.toLocaleString() : kpi.value}{kpi.suffix || ""}
          </Typography>
          
          {kpi.previousValue && (
            <Typography variant="caption" sx={{ color: "#94a3b8" }}>
              vs {kpi.previousValue.toLocaleString()} {kpi.suffix || ""} previous period
            </Typography>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderChart = () => {
    if (!chartData) return null;

    const data = chartData[chartType] || [];
    if (data.length === 0) return null;

    return (
      <Card sx={{ borderRadius: 2, border: "1px solid #e2e8f0" }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {chartType === "bar" ? "Bar Chart" : chartType === "line" ? "Line Chart" : "Pie Chart"}
            </Typography>
            <Box sx={{ display: "flex", gap: 1 }}>
              <ToggleButtonGroup
                size="small"
                value={chartType}
                exclusive
                onChange={(e, value) => value && setChartType(value as any)}
              >
                <ToggleButton value="bar">
                  <BarChart3 size={16} />
                </ToggleButton>
                <ToggleButton value="line">
                  <LineChart size={16} />
                </ToggleButton>
                <ToggleButton value="pie">
                  <PieChart size={16} />
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </Box>

          {/* Chart rendering - simplified SVG charts */}
          <Box sx={{ height: 300, position: "relative" }}>
            {chartType === "bar" && (
              <Box sx={{ display: "flex", alignItems: "flex-end", justifyContent: "space-around", height: "100%", gap: 2 }}>
              {data.map((item, index) => (
                <Box key={index} sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <Box 
                    sx={{ 
                      width: "80%", 
                      height: `${(item.value / Math.max(...data.map(d => d.value))) * 80}%`,
                      bgcolor: item.color || "#4f46e5",
                      borderRadius: 1,
                      transition: "height 0.3s ease",
                      position: "relative",
                      "&:hover": { opacity: 0.8 }
                    }}
                  />
                  <Typography variant="caption" sx={{ mt: 1, fontSize: 10, textAlign: "center" }}>
                    {item.label}
                  </Typography>
                  <Typography variant="caption" sx={{ fontSize: 10, fontWeight: 600 }}>
                    {item.value.toLocaleString()}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}

          {chartType === "line" && (
            <svg width="100%" height="100%" viewBox="0 0 400 200">
              <polyline
                fill="none"
                stroke="#4f46e5"
                strokeWidth="2"
                points={data.map((item, index) => 
                  `${index * (400 / (data.length - 1))},${200 - (item.value / Math.max(...data.map(d => d.value))) * 180}`
                ).join(" ")}
              />
              {data.map((item, index) => (
                <circle
                  key={index}
                  cx={index * (400 / (data.length - 1))}
                  cy={200 - (item.value / Math.max(...data.map(d => d.value))) * 180}
                  r="4"
                  fill="#4f46e5"
                />
              ))}
            </svg>
          )}

          {chartType === "pie" && (
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
              <svg width="200" height="200" viewBox="0 0 200 200">
                {data.map((item, index) => {
                  const total = data.reduce((sum, d) => sum + d.value, 0);
                  const percentage = item.value / total;
                  const circumference = 2 * Math.PI * 80;
                  const offset = data.slice(0, index).reduce((sum, d) => sum + d.value, 0) / total * circumference;
                  
                  return (
                    <circle
                      key={index}
                      cx="100"
                      cy="100"
                      r="80"
                      fill="transparent"
                      stroke={item.color || "#4f46e5"}
                      strokeWidth="30"
                      strokeDasharray={`${percentage * circumference} ${circumference}`}
                      strokeDashoffset={-offset}
                      transform="rotate(-90 100 100)"
                    />
                  );
                })}
              </svg>
              <Box sx={{ position: "absolute", display: "flex", flexDirection: "column", gap: 1 }}>
                {data.slice(0, 3).map((item, index) => (
                  <Box key={index} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <Box 
                      sx={{ 
                        width: 12, height: 12, borderRadius: "50%", 
                        bgcolor: item.color || "#4f46e5" 
                      }} 
                    />
                    <Typography variant="caption" sx={{ fontSize: 10 }}>
                      {item.label}: {item.value}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4, flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>

        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          {onTimeRangeChange && (
            <Select
              size="small"
              value={timeRange}
              onChange={(e) => onTimeRangeChange(e.target.value as any)}
              sx={{ minWidth: 120 }}
            >
              <MenuItem value="7d">7 Days</MenuItem>
              <MenuItem value="30d">30 Days</MenuItem>
              <MenuItem value="90d">90 Days</MenuItem>
              <MenuItem value="1y">1 Year</MenuItem>
              <MenuItem value="custom">Custom</MenuItem>
            </Select>
          )}

          <Tooltip title="Refresh data">
            <IconButton onClick={onRefresh} disabled={loading}>
              {loading ? <CircularProgress size={20} /> : <RefreshCw size={20} />}
            </IconButton>
          </Tooltip>

          {onExport && (
            <Tooltip title="Export dashboard">
              <IconButton onClick={onExport}>
                <Download size={20} />
              </IconButton>
            </Tooltip>
          )}

          <Tooltip title="View details">
            <IconButton onClick={() => setViewMode(viewMode === "overview" ? "detailed" : "overview")}>
              <Maximize2 size={20} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 8 }}>
          <CircularProgress size={40} />
        </Box>
      ) : (
        <>
          {/* KPI Cards */}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)", lg: "repeat(6, 1fr)" }, gap: 2, mb: 4 }}>
            {kpiCards.map((kpi, index) => (
              <Box key={index}>
                {renderKPICard(kpi)}
              </Box>
            ))}
          </Box>

          {/* Charts */}
          {chartData && renderChart()}

          {/* Detailed View */}
          {viewMode === "detailed" && (
            <Card sx={{ borderRadius: 2, border: "1px solid #e2e8f0", mt: 4 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
                  Detailed Analysis
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Detailed breakdown and analysis would appear here when you select detailed view mode.
                  This includes comprehensive metrics, trends, and comparative analysis.
                </Typography>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* KPI Detail Dialog */}
      <Dialog 
        open={Boolean(selectedKPI)} 
        onClose={() => setSelectedKPI(null)}
        maxWidth="md"
      >
        <DialogTitle>{selectedKPI?.title} Details</DialogTitle>
        <DialogContent>
          {selectedKPI && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" sx={{ mb: 2 }}>
                {selectedKPI.title} has a current value of {selectedKPI.prefix || ""}{typeof selectedKPI.value === "number" ? selectedKPI.value.toLocaleString() : selectedKPI.value}{selectedKPI.suffix || ""}.
                {selectedKPI.previousValue && (
                  <> This represents a {selectedKPI.trend === "up" ? "increase" : "decrease"} of {selectedKPI.trendPercentage?.toFixed(1)}% compared to the previous period ({selectedKPI.previousValue.toLocaleString()}{selectedKPI.suffix || ""}).</>
                )}
              </Typography>
              <Box sx={{ p: 2, bgcolor: `${selectedKPI.color}10`, borderRadius: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                  <Info size={16} style={{ color: selectedKPI.color }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: selectedKPI.color }}>
                    Performance Insights
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Click on the trend icon to view detailed historical data and analysis for this metric.
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedKPI(null)}>Close</Button>
          {selectedKPI?.drillDown && (
            <Button variant="contained" onClick={() => {
              selectedKPI.drillDown?.();
              setSelectedKPI(null);
            }}>
              View Details <ArrowUpRight size={16} style={{ marginLeft: 4 }} />
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}