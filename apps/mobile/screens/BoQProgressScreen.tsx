import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { fetchBoqItems, updateBoqProgress, type BoqItemRow } from "../api/client";
import type { RootStackParamList } from "../navigation/types";
import { Muted, Screen, Title } from "../ui/components";
import { colors, radius, spacing, typography } from "../theme/theme";

type Props = NativeStackScreenProps<RootStackParamList, "BoQProgress">;

type SectionGroup = { section: string; items: BoqItemRow[] };

function groupBySection(items: BoqItemRow[]): SectionGroup[] {
  const map = new Map<string, BoqItemRow[]>();
  for (const item of items) {
    const list = map.get(item.section) ?? [];
    list.push(item);
    map.set(item.section, list);
  }
  return Array.from(map.entries()).map(([section, sectionItems]) => ({
    section,
    items: sectionItems,
  }));
}

export function BoQProgressScreen({ route }: Props) {
  const { project } = route.params;
  const [groups, setGroups] = useState<SectionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editItem, setEditItem] = useState<BoqItemRow | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const items = await fetchBoqItems(project.id);
      setGroups(groupBySection(items));
    } catch {
      // silent — pull-to-refresh retries
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

  const openEdit = (item: BoqItemRow) => {
    setEditItem(item);
    setEditValue(item.executed_quantity ?? "");
  };

  const saveProgress = async () => {
    if (!editItem) return;
    setSaving(true);
    try {
      const parsed = parseFloat(editValue);
      if (isNaN(parsed)) return;
      await updateBoqProgress(project.id, editItem.id, parsed);
      setEditItem(null);
      await load();
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>BoQ Progress</Title>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {groups.map((g) => (
          <View key={g.section} style={styles.section}>
            <Text style={styles.sectionTitle}>{g.section.toUpperCase()}</Text>
            {g.items.map((item) => (
              <Pressable
                key={item.id}
                style={styles.card}
                onPress={() => openEdit(item)}
                accessibilityRole="button"
                accessibilityLabel={`Update ${item.item_number}`}
              >
                <Text style={styles.itemNumber}>{item.item_number}</Text>
                <Text style={styles.description}>{item.description}</Text>
                <View style={styles.row}>
                  <Muted>Planned: {item.quantity}</Muted>
                  <Muted>Rate: {item.rate}</Muted>
                </View>
                <View style={styles.row}>
                  <Text style={styles.execLabel}>
                    Executed: <Text style={styles.execValue}>{item.executed_quantity || "0"}</Text>
                  </Text>
                  {item.progress_updated_at ? <Muted>Updated</Muted> : null}
                </View>
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>

      <Modal visible={!!editItem} transparent animationType="fade" onRequestClose={() => setEditItem(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setEditItem(null)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <Text style={styles.modalTitle}>
              {editItem?.item_number} — {editItem?.description}
            </Text>
            <Muted>Planned quantity: {editItem?.quantity}</Muted>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              placeholder="Executed quantity"
              placeholderTextColor={colors.textMuted}
              value={editValue}
              onChangeText={setEditValue}
            />
            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => setEditItem(null)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.saveBtn, saving && { opacity: 0.5 }]}
                onPress={saveProgress}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={colors.primaryText} />
                ) : (
                  <Text style={styles.saveText}>Save</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.lg },
  sectionTitle: {
    ...typography.heading,
    color: colors.primary,
    marginBottom: spacing.sm,
    letterSpacing: 1,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemNumber: { ...typography.muted, fontSize: 12 },
  description: { ...typography.body, fontWeight: "600", marginVertical: spacing.xs },
  row: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xs },
  execLabel: { fontSize: 14, color: colors.text, fontWeight: "600" },
  execValue: { color: colors.primary },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  modalTitle: { ...typography.heading },
  input: {
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    borderRadius: radius.sm,
    padding: spacing.md,
    fontSize: 16,
    minHeight: 44,
  },
  modalActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  cancelBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  cancelText: { color: colors.text, fontWeight: "600" },
  saveBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
  },
  saveText: { color: colors.primaryText, fontWeight: "700" },
});
