import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { IssueRow, SCurve, WeeklyReport } from "@monitoring/shared-types";

import { fetchIssues, fetchProject, fetchProjectMembers, fetchScurve, fetchWeeklyReport } from "../api/client";
import type { RootStackParamList } from "../navigation/types";
import { Badge, Card, Muted, Screen, Title } from "../ui/components";
import { issueBadge } from "../ui/status";
import { colors, spacing, typography } from "../theme/theme";

type Props = NativeStackScreenProps<RootStackParamList, "Reports">;

function fmtWeek(iso: string): string {
  const m = /^(\d{4})-W(\d{2})$/.exec(iso);
  return m ? `Week ${Number(m[2])} · ${m[1]}` : iso;
}

function variance(actual: number, planned: number): { label: string; color: string } {
  const d = Math.round(actual - planned);
  if (d >= 5) return { label: `Ahead +${d}%`, color: colors.success };
  if (d <= -5) return { label: `Behind ${-d}%`, color: colors.danger };
  return { label: "On track", color: colors.success };
}

function fmtDate(d: string) {
  if (!d) return "—";
  const parts = d.split("T")[0]?.split("-");
  return parts ? `${parts[2]}/${parts[1]}/${parts[0]}` : d;
}

export function ReportsScreen({ navigation, route }: Props) {
  const { project } = route.params;
  const [weekly, setWeekly] = useState<WeeklyReport | null>(null);
  const [scurve, setScurve] = useState<SCurve | null>(null);
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [projDetail, setProjDetail] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetchWeeklyReport(project.id),
      fetchScurve(project.id),
      fetchIssues(project.id),
      fetchProject(project.id),
      fetchProjectMembers(project.id),
    ])
      .then(([w, s, i, pd, pm]) => {
        setWeekly(w);
        setScurve(s);
        setIssues(i);
        setProjDetail(pd);
        setMembers(pm);
      })
      .catch((e) => setError((e as Error).message));
  }, [project.id]);

  const startDate = projDetail?.planned_start_date;
  const endDate = projDetail?.planned_completion_date;
  const today = Date.now();
  const totalDays = startDate && endDate
    ? Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000)
    : 0;
  const elapsedDays = startDate
    ? Math.max(0, Math.ceil((today - new Date(startDate).getTime()) / 86400000))
    : 0;
  const pctElapsed = totalDays > 0 ? Math.min(100, Math.round((elapsedDays / totalDays) * 100)) : 0;

  return (
    <Screen>
      <ScrollView>
      <Title>{project.name}</Title>
      {error ? <Muted>{error}</Muted> : null}

      {/* Project info card */}
      <Card>
        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Muted>Contract span</Muted>
            <Text style={typography.body}>
              {startDate ? fmtDate(startDate) : "—"} → {endDate ? fmtDate(endDate) : "—"}
            </Text>
          </View>
          {totalDays > 0 && (
            <View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                <Muted>{elapsedDays} of {totalDays} days</Muted>
                <Muted>{pctElapsed}%</Muted>
              </View>
              <View style={{ height: 6, backgroundColor: colors.surfaceAlt, borderRadius: 3 }}>
                <View style={{ width: `${pctElapsed}%`, height: 6, backgroundColor: colors.primary, borderRadius: 3 }} />
              </View>
            </View>
          )}
          {members.length > 0 && (
            <View style={{ marginTop: 4 }}>
              <Muted>Team</Muted>
              {members.slice(0, 5).map((m: any) => (
                <Text key={m.id} style={typography.body}>{m.role_name || m.role}: {m.username}</Text>
              ))}
            </View>
          )}
        </View>
      </Card>

      <Text style={[typography.heading, { marginTop: spacing.md }]}>Progress (planned vs actual)</Text>
      {!scurve || scurve.series.length === 0 ? (
        <Muted>No progress data yet.</Muted>
      ) : (
        <>
          {/* Headline: where the project stands right now vs the plan. */}
          {(() => {
            const last = scurve.series[scurve.series.length - 1];
            const v = variance(last.actual_percent, last.planned_percent);
            return (
              <Card>
                <View style={styles.cardRow}>
                  <View style={{ flex: 1 }}>
                    <Muted>Latest · {fmtWeek(last.week)}</Muted>
                    <Text style={styles.bigPct}>
                      {last.actual_percent}% <Text style={typography.muted}>actual</Text>
                    </Text>
                    <Muted>Planned {last.planned_percent}%</Muted>
                  </View>
                  <Badge badge={{ label: v.label, color: v.color }} />
                </View>
                <ProgressBar planned={last.planned_percent} actual={last.actual_percent} />
              </Card>
            );
          })()}

          {/* Week-by-week, newest first, so the current state reads top-down. */}
          <Muted>Bar = actual · line = planned target</Muted>
          {[...scurve.series].reverse().map((p) => {
            const v = variance(p.actual_percent, p.planned_percent);
            return (
              <Card key={p.week}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={typography.body}>{fmtWeek(p.week)}</Text>
                  <Text style={{ color: v.color, fontWeight: "700" }}>
                    {p.actual_percent}% / {p.planned_percent}%
                  </Text>
                </View>
                <ProgressBar planned={p.planned_percent} actual={p.actual_percent} />
              </Card>
            );
          })}
        </>
      )}

      <Text style={[typography.heading, { marginTop: spacing.md }]}>Weekly submissions</Text>
      {weekly?.weeks.map((w) => (
        <Card key={w.week} onPress={() => navigation.navigate("Milestones", { project })}>
          <View style={styles.cardRow}>
            <View style={{ flex: 1 }}>
              <Text style={typography.body}>
                {w.week}: {w.submissions} submissions · {w.avg_percent_complete}% avg
              </Text>
              <Muted>
                {w.material_deliveries} deliveries · {w.hs_incidents} H&S
                {w.urgent_issues > 0 ? ` · ${w.urgent_issues} urgent` : ""}
              </Muted>
            </View>
            <Text style={styles.chevron}>›</Text>
          </View>
        </Card>
      ))}

      <Text style={[typography.heading, { marginTop: spacing.md }]}>Open issues</Text>
      {issues.length === 0 ? <Muted>No open issues.</Muted> : null}
      {issues.map((o) => {
        const badge = issueBadge(o.flag);
        return (
          <Card
            key={o.id}
            onPress={() =>
              navigation.navigate("MilestoneDetail", { project, milestoneEntryId: o.milestone_entry_id })
            }
          >
            <View style={styles.cardRow}>
              <View style={{ flex: 1, gap: spacing.xs }}>
                {badge ? <Badge badge={badge} /> : null}
                <Text style={typography.body}>{o.milestone_id}: {o.body}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </View>
          </Card>
        );
      })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  chevron: { color: colors.textMuted, fontSize: 24, fontWeight: "300" },
  bigPct: { fontSize: 26, fontWeight: "800", color: colors.text, marginVertical: 2 },
});

function ProgressBar({ planned, actual }: { planned: number; actual: number }) {
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  return (
    <View style={{ height: 8, backgroundColor: colors.surfaceAlt, borderRadius: 4, marginTop: spacing.xs }}>
      {/* planned marker */}
      <View style={{ position: "absolute", left: `${clamp(planned)}%`, top: -2, width: 2, height: 12, backgroundColor: colors.textMuted }} />
      <View style={{ width: `${clamp(actual)}%`, height: 8, backgroundColor: colors.primary, borderRadius: 4 }} />
    </View>
  );
}
