import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { fetchDroneDatasets } from "../api/client";
import type { RootStackParamList } from "../navigation/types";
import { Muted, Screen, Title } from "../ui/components";
import { colors, radius, spacing, typography } from "../theme/theme";

type Props = NativeStackScreenProps<RootStackParamList, "DroneDatasets">;

interface DroneDataset {
  id: number;
  data_type: string;
  flight_date: string;
  classification: string;
  thumbnail_url?: string;
  description?: string;
}

export function DroneDatasetsScreen({ route }: Props) {
  const { project } = route.params;
  const [datasets, setDatasets] = useState<DroneDataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<DroneDataset | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchDroneDatasets(project.id);
      setDatasets(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [project.id]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      </Screen>
    );
  }

  if (selected) {
    return (
      <Screen>
        <Pressable onPress={() => setSelected(null)} style={styles.backLink}>
          <Text style={styles.backText}>← Back to list</Text>
        </Pressable>
        <Title>{selected.data_type}</Title>
        <View style={styles.detailCard}>
          {selected.thumbnail_url ? (
            <Image source={{ uri: selected.thumbnail_url }} style={styles.thumbnail} />
          ) : null}
          <Text style={styles.detailLabel}>Data type</Text>
          <Text style={styles.detailValue}>{selected.data_type}</Text>
          <Text style={styles.detailLabel}>Flight date</Text>
          <Text style={styles.detailValue}>{selected.flight_date}</Text>
          <Text style={styles.detailLabel}>Classification</Text>
          <Text style={styles.detailValue}>{selected.classification}</Text>
          {selected.description ? (
            <>
              <Text style={styles.detailLabel}>Description</Text>
              <Text style={styles.detailValue}>{selected.description}</Text>
            </>
          ) : null}
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>Drone Datasets</Title>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {datasets.map((d) => (
          <Pressable
            key={d.id}
            style={styles.card}
            onPress={() => setSelected(d)}
            accessibilityRole="button"
            accessibilityLabel={d.data_type}
          >
            <View style={styles.cardRow}>
              {d.thumbnail_url ? (
                <Image source={{ uri: d.thumbnail_url }} style={styles.cardThumb} />
              ) : (
                <View style={styles.cardThumbPlaceholder}>
                  <Text style={styles.thumbPlaceholderText}>🛸</Text>
                </View>
              )}
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>{d.data_type}</Text>
                <Muted>{d.flight_date}</Muted>
                <View style={styles.classificationBadge}>
                  <Text style={styles.classificationText}>{d.classification}</Text>
                </View>
              </View>
            </View>
          </Pressable>
        ))}
        {datasets.length === 0 ? <Muted>No drone datasets available.</Muted> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backLink: { marginBottom: spacing.sm },
  backText: { color: colors.primary, fontWeight: "600", fontSize: 15 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardRow: { flexDirection: "row", gap: spacing.md },
  cardContent: { flex: 1, gap: 4 },
  cardTitle: { ...typography.heading },
  cardThumb: { width: 64, height: 64, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  cardThumbPlaceholder: {
    width: 64, height: 64, borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center",
  },
  thumbPlaceholderText: { fontSize: 28 },
  classificationBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  classificationText: { color: "#fff", fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },
  thumbnail: { width: "100%", height: 180, borderRadius: radius.md, marginBottom: spacing.md },
  detailCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  detailLabel: { ...typography.muted, marginTop: spacing.sm },
  detailValue: { ...typography.body, fontWeight: "600" },
});
