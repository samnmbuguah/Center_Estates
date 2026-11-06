import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";

import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import {
  fetchQualityTests,
  createQualityTest,
  updateQualityTest,
  deleteQualityTest,
  uploadProofPhoto,
  type QualityTestRow,
} from "../api/client";
import { calculateCuringSchedule } from "../quality/curingScheduler";
import type { RootStackParamList } from "../navigation/types";
import { Muted, Screen, Title } from "../ui/components";
import { colors, radius, spacing, typography } from "../theme/theme";

type Props = NativeStackScreenProps<RootStackParamList, "QualityTests">;

const TEST_TYPES = ["concrete_cube", "soil_compaction", "steel_tensile", "material", "other"];

const emptyForm = () => ({
  test_type: "concrete_cube",
  sample_id: "",
  location: "",
  grade: "",
  test_date: "",
  result_date: "",
  result_value: "",
  passed: null as boolean | null,
  notes: "",
  photo_urls: [] as string[],
});

type FormState = ReturnType<typeof emptyForm>;

export function QualityTestsScreen({ route }: Props) {
  const { project } = route.params;
  const [tests, setTests] = useState<QualityTestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<QualityTestRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchQualityTests(project.id);
      setTests(data);
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

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm());
    setModalVisible(true);
  };

  const openEdit = (t: QualityTestRow) => {
    setEditing(t);
    setForm({
      test_type: t.test_type,
      sample_id: t.sample_id,
      location: t.location,
      grade: t.grade,
      test_date: t.test_date,
      result_date: t.result_date,
      result_value: t.result_value,
      passed: t.passed,
      notes: t.notes,
      photo_urls: [...t.photo_urls],
    });
    setModalVisible(true);
  };

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setUploadingPhoto(true);
    try {
      const remoteUrl = await uploadProofPhoto(result.assets[0].uri);
      setForm((prev) => ({ ...prev, photo_urls: [...prev.photo_urls, remoteUrl] }));
    } catch {
      Alert.alert("Upload failed", "Could not upload photo.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Camera permission is required to take photos.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setUploadingPhoto(true);
    try {
      const remoteUrl = await uploadProofPhoto(result.assets[0].uri);
      setForm((prev) => ({ ...prev, photo_urls: [...prev.photo_urls, remoteUrl] }));
    } catch {
      Alert.alert("Upload failed", "Could not upload photo.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const removePhoto = (index: number) => {
    setForm((prev) => ({
      ...prev,
      photo_urls: prev.photo_urls.filter((_, i) => i !== index),
    }));
  };

  const save = async () => {
    if (!form.sample_id.trim() || !form.test_date.trim()) {
      Alert.alert("Required", "Sample ID and Test Date are required.");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateQualityTest(project.id, editing.id, form);
      } else {
        await createQualityTest(project.id, form);
      }
      setModalVisible(false);
      await load();
    } catch {
      Alert.alert("Error", "Failed to save test.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (t: QualityTestRow) => {
    Alert.alert(
      "Delete Test",
      `Delete ${t.test_type} — ${t.sample_id}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteQualityTest(project.id, t.id);
              await load();
            } catch {
              Alert.alert("Error", "Failed to delete test.");
            }
          },
        },
      ],
    );
  };

  const passedBadge = (t: QualityTestRow) => {
    if (t.passed === true) return { label: "PASS", color: colors.success };
    if (t.passed === false) return { label: "FAIL", color: colors.danger };
    return { label: "PENDING", color: colors.warning };
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
      <View style={styles.header}>
        <Title>Quality Tests</Title>
        <Pressable style={styles.fab} onPress={openNew} accessibilityRole="button" accessibilityLabel="New Test">
          <Text style={styles.fabText}>+</Text>
        </Pressable>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {tests.map((t) => {
          const badge = passedBadge(t);
          return (
            <Pressable
              key={t.id}
              style={styles.card}
              onPress={() => openEdit(t)}
              onLongPress={() => confirmDelete(t)}
              accessibilityRole="button"
              accessibilityLabel={`${t.test_type} ${t.sample_id}`}
            >
              <View style={styles.cardTop}>
                <Text style={styles.testType}>{t.test_type.replace(/_/g, " ").toUpperCase()}</Text>
                <View style={[styles.badge, { backgroundColor: badge.color }]}>
                  <Text style={styles.badgeText}>{badge.label}</Text>
                </View>
              </View>
              <Text style={styles.sampleId}>{t.sample_id}</Text>
              {t.test_type === "concrete_cube" && t.test_date ? (() => {
                const curing = calculateCuringSchedule(t.test_date, t.passed);
                if (!curing) return null;
                return (
                  <View style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: colors.surfaceAlt,
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: radius.sm,
                    marginTop: 4,
                    marginBottom: 4,
                  }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: curing.badgeColor, marginRight: 6 }} />
                    <Text style={{ fontSize: 12, color: colors.text, fontWeight: "500" }}>{curing.statusLabel}</Text>
                  </View>
                );
              })() : null}
              <View style={styles.cardRow}>
                <Muted>{t.test_date}</Muted>
                {t.result_value ? <Muted>Result: {t.result_value}</Muted> : null}
              </View>
              {t.location ? <Text style={styles.location}>{t.location}</Text> : null}
              {t.photo_urls.length > 0 ? (
                <Text style={styles.photoCount}>{t.photo_urls.length} photo(s)</Text>
              ) : null}
            </Pressable>
          );
        })}
        {tests.length === 0 ? <Muted>No quality tests recorded yet.</Muted> : null}
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <ScrollView>
              <Text style={styles.modalTitle}>{editing ? "Edit Test" : "New Test"}</Text>

              <Text style={styles.fieldLabel}>Test Type</Text>
              <View style={styles.pickerRow}>
                {TEST_TYPES.map((tt) => (
                  <Pressable
                    key={tt}
                    style={[styles.pickerItem, form.test_type === tt && styles.pickerItemActive]}
                    onPress={() => setForm((prev) => ({ ...prev, test_type: tt }))}
                  >
                    <Text style={[styles.pickerText, form.test_type === tt && styles.pickerTextActive]}>
                      {tt.replace(/_/g, " ")}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Sample ID *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. CC-001"
                placeholderTextColor={colors.textMuted}
                value={form.sample_id}
                onChangeText={(v) => setForm((prev) => ({ ...prev, sample_id: v }))}
              />

              <Text style={styles.fieldLabel}>Location</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Column B-12"
                placeholderTextColor={colors.textMuted}
                value={form.location}
                onChangeText={(v) => setForm((prev) => ({ ...prev, location: v }))}
              />

              <Text style={styles.fieldLabel}>Grade</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. C30"
                placeholderTextColor={colors.textMuted}
                value={form.grade}
                onChangeText={(v) => setForm((prev) => ({ ...prev, grade: v }))}
              />

              <Text style={styles.fieldLabel}>Test Date (Pour Date) *</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
                value={form.test_date}
                onChangeText={(v) => setForm((prev) => ({ ...prev, test_date: v }))}
              />

              {form.test_type === "concrete_cube" && form.test_date ? (() => {
                const curing = calculateCuringSchedule(form.test_date, form.passed);
                if (!curing) return null;
                return (
                  <View style={{ marginBottom: spacing.sm }}>
                    <Text style={[typography.muted, { fontSize: 12, marginBottom: 4 }]}>
                      Curing Targets: 7d ({curing.date7d}) · 28d ({curing.date28d})
                    </Text>
                    <View style={{ flexDirection: "row", gap: spacing.sm }}>
                      <Pressable
                        style={[styles.pickerItem, { flex: 1, paddingVertical: 6 }]}
                        onPress={() => setForm((prev) => ({ ...prev, result_date: curing.date7d }))}
                      >
                        <Text style={[styles.pickerText, { fontSize: 11 }]}>Set 7-Day ({curing.date7d})</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.pickerItem, { flex: 1, paddingVertical: 6 }]}
                        onPress={() => setForm((prev) => ({ ...prev, result_date: curing.date28d }))}
                      >
                        <Text style={[styles.pickerText, { fontSize: 11 }]}>Set 28-Day ({curing.date28d})</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })() : null}

              <Text style={styles.fieldLabel}>Result Date</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
                value={form.result_date}
                onChangeText={(v) => setForm((prev) => ({ ...prev, result_date: v }))}
              />

              <Text style={styles.fieldLabel}>Result Value</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 28.5 MPa"
                placeholderTextColor={colors.textMuted}
                value={form.result_value}
                onChangeText={(v) => setForm((prev) => ({ ...prev, result_value: v }))}
              />

              <View style={styles.switchRow}>
                <Text style={styles.fieldLabel}>Passed</Text>
                <Switch
                  value={form.passed === true}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, passed: v ? true : false }))}
                  trackColor={{ false: colors.surfaceAlt, true: colors.success }}
                  thumbColor={form.passed === true ? colors.successText : colors.faint}
                />
              </View>

              <Text style={styles.fieldLabel}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Additional notes..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
                value={form.notes}
                onChangeText={(v) => setForm((prev) => ({ ...prev, notes: v }))}
              />

              <Text style={styles.fieldLabel}>Photos</Text>
              {form.photo_urls.map((url, i) => (
                <View key={i} style={styles.photoRow}>
                  <Text style={styles.photoUrl} numberOfLines={1}>{url}</Text>
                  <Pressable onPress={() => removePhoto(i)} style={styles.removePhoto}>
                    <Text style={styles.removePhotoText}>✕</Text>
                  </Pressable>
                </View>
              ))}
              <View style={styles.photoActions}>
                <Pressable style={styles.photoBtn} onPress={pickPhoto} disabled={uploadingPhoto}>
                  <Text style={styles.photoBtnText}>
                    {uploadingPhoto ? "Uploading..." : "📷 Gallery"}
                  </Text>
                </Pressable>
                <Pressable style={styles.photoBtn} onPress={takePhoto} disabled={uploadingPhoto}>
                  <Text style={styles.photoBtnText}>
                    {uploadingPhoto ? "Uploading..." : "📸 Camera"}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.modalActions}>
                <Pressable style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.saveBtn, saving && { opacity: 0.5 }]}
                  onPress={save}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color={colors.primaryText} />
                  ) : (
                    <Text style={styles.saveText}>{editing ? "Update" : "Create"}</Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  fab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  fabText: { color: colors.primaryText, fontSize: 28, fontWeight: "700", lineHeight: 30 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  testType: { ...typography.muted, fontSize: 11, letterSpacing: 0.5 },
  sampleId: { ...typography.body, fontWeight: "700" },
  cardRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xs },
  location: { ...typography.muted, marginTop: spacing.xs },
  photoCount: { fontSize: 12, color: colors.primary, marginTop: spacing.xs },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 0.3 },
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
    maxHeight: "90%",
  },
  modalTitle: { ...typography.title, marginBottom: spacing.md },
  fieldLabel: {
    ...typography.muted,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    borderRadius: radius.sm,
    padding: spacing.md,
    fontSize: 16,
    minHeight: 44,
  },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  pickerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  pickerItem: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pickerItemActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pickerText: { fontSize: 12, color: colors.text },
  pickerTextActive: { color: colors.primaryText, fontWeight: "700" },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.sm,
  },
  photoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  photoUrl: { flex: 1, fontSize: 12, color: colors.textMuted },
  removePhoto: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  removePhotoText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  photoActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  photoBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  photoBtnText: { fontSize: 14, color: colors.text },
  modalActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
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
