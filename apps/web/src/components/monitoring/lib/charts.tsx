/**
 * Reusable chart components for dashboards. Thin wrappers around Recharts so
 * pages stay readable and chart styling is consistent.
 */
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const COLORS = ["var(--accent, #2563eb)", "var(--danger, #dc2626)", "var(--warning, #f59e0b)", "var(--success, #16a34a)"];

interface BarDatum { label: string; [key: string]: string | number }
interface PieDatum { name: string; value: number }
interface LineDatum { label: string; [key: string]: string | number }

export function SimpleBarChart({ data, bars, height = 200 }: {
  data: BarDatum[]; bars: { key: string; color: string }[]; height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #334155)" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--muted, #94a3b8)" />
        <YAxis tick={{ fontSize: 11 }} stroke="var(--muted, #94a3b8)" />
        <Tooltip contentStyle={{ background: "var(--card-bg, #1e293b)", border: "1px solid var(--border, #334155)", borderRadius: 8 }} />
        {bars.map((b) => <Bar key={b.key} dataKey={b.key} fill={b.color} radius={[4, 4, 0, 0]} />)}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SimplePieChart({ data, height = 200 }: { data: PieDatum[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, value }: any) => `${name} (${value})`}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip contentStyle={{ background: "var(--card-bg, #1e293b)", border: "1px solid var(--border, #334155)", borderRadius: 8 }} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function SimpleLineChart({ data, lines, height = 200 }: {
  data: LineDatum[]; lines: { key: string; color: string; name: string }[]; height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #334155)" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--muted, #94a3b8)" />
        <YAxis tick={{ fontSize: 11 }} stroke="var(--muted, #94a3b8)" />
        <Tooltip contentStyle={{ background: "var(--card-bg, #1e293b)", border: "1px solid var(--border, #334155)", borderRadius: 8 }} />
        <Legend />
        {lines.map((l) => <Line key={l.key} type="monotone" dataKey={l.key} stroke={l.color} name={l.name} strokeWidth={2} dot={{ r: 3 }} />)}
      </LineChart>
    </ResponsiveContainer>
  );
}
