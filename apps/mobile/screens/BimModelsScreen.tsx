import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { fetchBimModels } from "../api/client";
import type { RootStackParamList } from "../navigation/types";
import { Muted, Screen, Title } from "../ui/components";
import { colors, radius, spacing, typography } from "../theme/theme";

type Props = NativeStackScreenProps<RootStackParamList, "BimModels">;

interface BimModel {
  id: number;
  name: string;
  discipline: string;
  element_count: number;
  upload_date: string;
  description?: string;
}

export function BimModelsScreen({ route }: Props) {
  const { project } = route.params;
  const [models, setModels] = useState<BimModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<BimModel | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchBimModels(project.id);
      setModels(data);
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
        <Title>{selected.name}</Title>
        <View style={styles.detailCard}>
          <Text style={styles.detailLabel}>Discipline</Text>
          <Text style={styles.detailValue}>{selected.discipline}</Text>
          <Text style={styles.detailLabel}>Element count</Text>
          <Text style={styles.detailValue}>{selected.element_count}</Text>
          <Text style={styles.detailLabel}>Upload date</Text>
          <Text style={styles.detailValue}>{selected.upload_date}</Text>
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
      <Title>BIM Models</Title>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {models.map((m) => (
          <Pressable
            key={m.id}
            style={styles.card}
            onPress={() => setSelected(m)}
            accessibilityRole="button"
            accessibilityLabel={m.name}
          >
            <Text style={styles.cardTitle}>{m.name}</Text>
            <View style={styles.cardRow}>
              <Muted>{m.discipline}</Muted>
              <Muted>{m.element_count} elements</Muted>
            </View>
            <Muted>{m.upload_date}</Muted>
          </Pressable>
        ))}
        {models.length === 0 ? <Muted>No BIM models available.</Muted> : null}
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
  cardTitle: { ...typography.heading, marginBottom: spacing.xs },
  cardRow: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.xs },
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
