"use client";

import type { ReactNode } from "react";
import { Box, Chip, Paper, Typography, useTheme } from "@mui/material";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { money } from "@/components/module-ui";

type Datum = Record<string, string | number>;
export type PortfolioDashboardData = {
  kpis?: Record<string, number>;
  collectionTrend?: Datum[];
  leaseExpiry?: Datum[];
  aging?: Datum[];
  portfolio?: Datum[];
};

const COLORS = ["#dc2626", "#17243b", "#f59e0b", "#64748b", "#16a34a", "#2563eb"];
const compactMoney = (value: number) => new Intl.NumberFormat("en-KE", { notation: "compact", maximumFractionDigits: 1 }).format(value);

function ChartCard({ title, subtitle, children, action }: { title: string; subtitle: string; children: ReactNode; action?: ReactNode }) {
  return <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 3, minWidth: 0, height: "100%", bgcolor: "background.paper" }}>
    <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, mb: 2 }}>
      <Box><Typography sx={{ fontWeight: 900 }}>{title}</Typography><Typography variant="caption" color="text.secondary" sx={{ fontWeight: 650 }}>{subtitle}</Typography></Box>
      {action}
    </Box>
    {children}
  </Paper>;
}

export function PortfolioAnalyticsDashboard({ data }: { data: PortfolioDashboardData | null }) {
  const theme = useTheme();
  if (!data) return null;
  const text = theme.palette.text.secondary;
  const grid = theme.palette.divider;
  const trend = data.collectionTrend ?? [];
  const portfolio = data.portfolio ?? [];
  const ageing = (data.aging ?? []).map((row) => ({ ...row, amount: Number(row.amount ?? 0) }));
  const totalOutstanding = ageing.reduce((sum, row) => sum + Number(row.amount), 0);
  const collected = Number(data.kpis?.collectedYtd ?? 0);
  const collection = [{ name: "Collected", value: collected }, { name: "Outstanding", value: totalOutstanding }];
  const expectedLine = theme.palette.mode === "dark" ? theme.palette.info.light : theme.palette.primary.dark;
  const tooltipStyle = {
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 10,
    color: theme.palette.text.primary,
  };
  const emptyChart = (message: string) => <Box sx={{ height: 270, display: "grid", placeItems: "center", color: "text.secondary", textAlign: "center", px: 2 }}><Typography variant="body2" sx={{ fontWeight: 700 }}>{message}</Typography></Box>;

  return <Box component="section" aria-label="Portfolio performance analytics" sx={{ mb: 3 }}>
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 2, mb: 1.5, flexWrap: "wrap" }}>
      <Box><Typography variant="h6" sx={{ fontWeight: 950 }}>Portfolio performance</Typography><Typography variant="body2" color="text.secondary" sx={{ fontWeight: 650 }}>Live financial, occupancy and lease-risk signals across properties you can access.</Typography></Box>
      <Chip label="Live portfolio data" color="success" variant="outlined" size="small" />
    </Box>
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.6fr .85fr .85fr" }, gap: 2 }}>
      <ChartCard title="Monthly rent collection trend" subtitle="Expected billing compared with actual collections" action={<Chip size="small" label="Year to date" />}>
        {trend.length ? <ResponsiveContainer width="100%" height={270}>
          <AreaChart data={trend} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
            <defs><linearGradient id="collectedFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#dc2626" stopOpacity={0.2}/><stop offset="95%" stopColor="#dc2626" stopOpacity={0}/></linearGradient></defs>
            <CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false}/><XAxis dataKey="month" tick={{ fill: text, fontSize: 11 }}/><YAxis tickFormatter={compactMoney} tick={{ fill: text, fontSize: 11 }} width={50}/><Tooltip contentStyle={tooltipStyle} formatter={(value) => money.format(Number(value))}/><Legend />
            <Area type="monotone" dataKey="actual" name="Collected" stroke="#dc2626" strokeWidth={3} fill="url(#collectedFill)" />
            <Line type="monotone" dataKey="expected" name="Expected / billed" stroke={expectedLine} strokeWidth={2.5} dot={{ r: 3 }} />
          </AreaChart>
        </ResponsiveContainer> : emptyChart("Billing and collection activity will appear here once invoices are issued.")}
      </ChartCard>
      <ChartCard title="Collection summary" subtitle="Year-to-date collection position">
        {collection.some((item) => item.value > 0) ? <ResponsiveContainer width="100%" height={270}><PieChart><Pie data={collection} dataKey="value" nameKey="name" innerRadius={62} outerRadius={90} paddingAngle={2}>{collection.map((_, index) => <Cell key={index} fill={COLORS[index]} />)}</Pie><Tooltip contentStyle={tooltipStyle} formatter={(value) => money.format(Number(value))}/><Legend /></PieChart></ResponsiveContainer> : emptyChart("No collections have been recorded for this period.")}
      </ChartCard>
      <ChartCard title="Lease expiry outlook" subtitle="Active leases by expiry window">
        {(data.leaseExpiry ?? []).length ? <ResponsiveContainer width="100%" height={270}><BarChart data={data.leaseExpiry ?? []} layout="vertical" margin={{ left: 10, right: 18 }}><CartesianGrid stroke={grid} strokeDasharray="3 3" horizontal={false}/><XAxis type="number" allowDecimals={false} tick={{ fill: text, fontSize: 11 }}/><YAxis type="category" dataKey="label" width={76} tick={{ fill: text, fontSize: 11 }}/><Tooltip contentStyle={tooltipStyle}/><Bar dataKey="count" name="Leases" fill="#2563eb" radius={[0, 7, 7, 0]}/></BarChart></ResponsiveContainer> : emptyChart("No active lease expiry dates are available.")}
      </ChartCard>
    </Box>
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.55fr 1fr" }, gap: 2, mt: 2 }}>
      <ChartCard title="Occupancy by property" subtitle="Occupied and vacant unit comparison">
        {portfolio.length ? <ResponsiveContainer width="100%" height={300}><BarChart data={portfolio} margin={{ left: 4, right: 12, bottom: 20 }}><CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name" tick={{ fill: text, fontSize: 10 }} interval={0} angle={-12} textAnchor="end" height={54}/><YAxis tick={{ fill: text, fontSize: 11 }} allowDecimals={false}/><Tooltip contentStyle={tooltipStyle}/><Legend/><Bar dataKey="occupied" name="Occupied" stackId="units" fill="#16a34a" radius={[0, 0, 0, 0]}/><Bar dataKey="vacant" name="Vacant" stackId="units" fill="#f59e0b" radius={[6, 6, 0, 0]}/></BarChart></ResponsiveContainer> : emptyChart("Onboard properties and units to compare occupancy.")}
      </ChartCard>
      <ChartCard title="Rent ageing summary" subtitle="Outstanding balances by age bucket">
        {totalOutstanding > 0 ? <ResponsiveContainer width="100%" height={300}><PieChart><Pie data={ageing} dataKey="amount" nameKey="label" innerRadius={66} outerRadius={100}>{ageing.map((_, index) => <Cell key={index} fill={["#16a34a", "#f59e0b", "#ef4444", "#991b1b"][index] ?? COLORS[index % COLORS.length]} />)}</Pie><Tooltip contentStyle={tooltipStyle} formatter={(value) => money.format(Number(value))}/><Legend /></PieChart></ResponsiveContainer> : emptyChart("There are no outstanding balances to age.")}
      </ChartCard>
    </Box>
  </Box>;
}
