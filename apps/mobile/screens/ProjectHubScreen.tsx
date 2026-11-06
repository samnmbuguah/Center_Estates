import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAuth } from "../auth/AuthContext";
import type { RootStackParamList } from "../navigation/types";
import { Muted, Screen, Title } from "../ui/components";
import { colors, MIN_TOUCH_SIZE, radius, spacing, typography } from "../theme/theme";

type Props = NativeStackScreenProps<RootStackParamList, "ProjectHub">;

type Tile = {
  to: "Milestones" | "Reports" | "DailyLog" | "BoQProgress" | "QualityTests" | "BimModels" | "DroneDatasets" | "Tickets";
  label: string;
  glyph: string;
  sub: string;
  perm?: string;
};

const TILES: Tile[] = [
  { to: "Milestones", label: "Milestones", glyph: "📐", sub: "Progress & evidence" },
  { to: "Tickets", label: "Tickets & Snags", glyph: "🎫", sub: "Defects · tasks · SLA" },
  { to: "DailyLog", label: "Site Diary", glyph: "📋", sub: "Logs · deliveries · H&S", perm: "site.reporting.daily.manage" },
  { to: "BoQProgress", label: "BoQ Progress", glyph: "📏", sub: "Field progress quantities", perm: "site.reporting.daily.manage" },
  { to: "Reports", label: "Reports", glyph: "📊", sub: "Progress, costs & issues" },
  { to: "QualityTests", label: "Quality Tests", glyph: "🔬", sub: "Concrete · steel · soil", perm: "quality.view" },
  { to: "BimModels", label: "BIM Models", glyph: "🏗️", sub: "Model metadata" },
  { to: "DroneDatasets", label: "Drone Datasets", glyph: "🛸", sub: "Orthophoto · DSM · point cloud" },
];

type QuickAction = {
  key: string;
  label: string;
  glyph: string;
  to: keyof RootStackParamList;
  params: (project: any) => any;
  perm?: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  { key: "tickets", label: "Tickets", glyph: "🎫", to: "Tickets", params: (p) => ({ project: p }) },
  { key: "daily", label: "Daily Log", glyph: "📋", to: "DailyLog", params: (p) => ({ project: p }), perm: "site.reporting.daily.manage" },
  { key: "milestones", label: "Milestones", glyph: "📐", to: "Milestones", params: (p) => ({ project: p }) },
  { key: "photo", label: "Capture Photo", glyph: "📸", to: "Milestones", params: (p) => ({ project: p }) },
  { key: "boq", label: "BoQ Progress", glyph: "📏", to: "BoQProgress", params: (p) => ({ project: p }), perm: "site.reporting.daily.manage" },
];

/** Project hub: the landing screen for a project — big action tiles to the
 * work areas, so the Clerk sees everything they can do at a glance. */
export function ProjectHubScreen({ navigation, route }: Props) {
  const { project } = route.params;
  const { can } = useAuth();
  const tiles = TILES.filter((t) => !t.perm || can(t.perm));

  if (!project) return <Screen><Title>Project not found</Title></Screen>;

  const quickActions = QUICK_ACTIONS.filter((a) => !a.perm || can(a.perm));

  return (
    <Screen>
      <Title>{project.name}</Title>
      <Muted>
        {project.geofence_radius_m != null
          ? `Geofenced site · ${project.geofence_radius_m} m radius`
          : "No site geofence set"}
      </Muted>

      <View style={styles.quickActions}>
        {quickActions.map((a) => (
          <Pressable
            key={a.key}
            style={styles.quickAction}
            accessibilityRole="button"
            accessibilityLabel={a.label}
            onPress={() => navigation.navigate(a.to, a.params(project) as any)}
          >
            <Text style={styles.quickActionGlyph}>{a.glyph}</Text>
            <Text style={styles.quickActionLabel}>{a.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.grid}>
        {tiles.map((t) => (
          <Pressable
            key={t.to}
            style={styles.tile}
            accessibilityRole="button"
            accessibilityLabel={t.label}
            onPress={() => navigation.navigate(t.to, { project })}
          >
            <Text style={styles.glyph}>{t.glyph}</Text>
            <Text style={styles.tileLabel}>{t.label}</Text>
            <Text style={styles.tileSub}>{t.sub}</Text>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.lg,
  },
  tile: {
    width: "47.5%", backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md, minHeight: 116,
    justifyContent: "center", gap: 4,
  },
  glyph: { fontSize: 28, marginBottom: 4 },
  tileLabel: { ...typography.heading },
  tileSub: { ...typography.muted },
  quickActions: {
    flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.lg,
  },
  quickAction: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs,
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.primary,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    minHeight: MIN_TOUCH_SIZE,
  },
  quickActionGlyph: { fontSize: 18 },
  quickActionLabel: { ...typography.body, fontWeight: "600", color: colors.primary },
});
