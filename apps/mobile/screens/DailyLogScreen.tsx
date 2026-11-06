import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  fetchBoqItems,
  fetchWorkPlanTasks,
  type BoqItemRow,
  type WorkPlanTaskRow,
} from "../api/client";
import { PhotoCaptureModal } from "../capture/PhotoCaptureModal";
import type { RootStackParamList } from "../navigation/types";
import { enqueueSubmission, initQueueTable } from "../sitediary/offlineQueue";
import { SiteConditionForm } from "../sitediary/SiteConditionForm";
import {
  HS_SEVERITIES,
  parseQuantity,
  validateDateYMD,
  type HsSeverity,
} from "../sitediary/validation";
import { colors, radius, spacing, typography } from "../theme/theme";
import { Button, Field, Muted, Screen, Title } from "../ui/components";

type Props = NativeStackScreenProps<RootStackParamList, "DailyLog">;

type Section = "log" | "materials" | "hs";

/** A captured photo and the state of its upload to the media store. */
type IncidentPhoto = { localUri: string; remoteUrl: string | null; uploading: boolean };

const SECTIONS: { key: Section; label: string }[] = [
  { key: "log", label: "Daily log" },
  { key: "materials", label: "Delivery" },
  { key: "hs", label: "H&S" },
];

const HS_COMMON_DESCRIPTIONS = [
  "Working at height without PPE harness",
  "Unbarricaded excavation trench",
  "Tripping hazard in walkway",
  "Exposed wiring / electrical hazard",
  "Missing scaffolding toe-boards",
];

const HS_COMMON_ACTIONS = [
  "Work stopped immediately until rectified",
  "Hazard area barricaded with caution tape",
  "Toolbox safety briefing conducted on site",
  "Defective equipment tagged out of service",
  "First aid administered on site",
];

/**
 * Site Diary — the weekly-report data-entry sections (SRS-MOB-MAT / SRS-MOB-HS)
 * plus the daily site log. Online submit; the office reviews on desktop.
 */
export function DailyLogScreen({ navigation, route }: Props) {
  const { project } = route.params;
  const today = new Date().toISOString().slice(0, 10);
  const [section, setSection] = useState<Section>("log");
  const [busy, setBusy] = useState(false);

  // Material delivery
  const [deliveryDate, setDeliveryDate] = useState(today);
  const [material, setMaterial] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [supplier, setSupplier] = useState("");
  const [remarks, setRemarks] = useState("");
  // Receipt photo captured locally (will upload during sync)
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [showReceiptCamera, setShowReceiptCamera] = useState(false);

  // BoQ & Work Plan State
  const [boqItems, setBoqItems] = useState<BoqItemRow[]>([]);
  const [workPlanTasks, setWorkPlanTasks] = useState<WorkPlanTaskRow[]>([]);
  const [selectedBoqItem, setSelectedBoqItem] = useState<BoqItemRow | null>(null);
  const [selectedTask, setSelectedTask] = useState<WorkPlanTaskRow | null>(null);
  const [boqModalVisible, setBoqModalVisible] = useState(false);
  const [boqSearchQuery, setBoqSearchQuery] = useState("");
  const [loadingBoq, setLoadingBoq] = useState(false);

  useEffect(() => {
    if (project?.id) {
      setLoadingBoq(true);
      Promise.all([
        fetchBoqItems(project.id).catch(() => []),
        fetchWorkPlanTasks(project.id).catch(() => []),
      ])
        .then(([boq, tasks]) => {
          setBoqItems(Array.isArray(boq) ? boq : []);
          setWorkPlanTasks(Array.isArray(tasks) ? tasks : []);
        })
        .finally(() => setLoadingBoq(false));
    }
  }, [project?.id]);

  const filteredBoqItems = useMemo(() => {
    if (!boqSearchQuery.trim()) return boqItems;
    const q = boqSearchQuery.toLowerCase();
    return boqItems.filter(
      (b) =>
        (b.description || "").toLowerCase().includes(q) ||
        (b.section || "").toLowerCase().includes(q) ||
        (b.item_number || "").toLowerCase().includes(q),
    );
  }, [boqItems, boqSearchQuery]);

  const handleSelectBoqItem = (item: BoqItemRow) => {
    setSelectedBoqItem(item);
    setMaterial(item.description);
    setUnit(item.unit || "");
    setBoqModalVisible(false);
  };

  const plannedQty = selectedBoqItem ? Number(selectedBoqItem.quantity) : null;
  const enteredQty = Number(quantity);
  const isOverPlanned = plannedQty != null && Number.isFinite(enteredQty) && enteredQty > plannedQty;
  const varianceAmt = plannedQty != null && Number.isFinite(enteredQty) ? enteredQty - plannedQty : 0;

  // H&S incident
  const [incidentDate, setIncidentDate] = useState(today);
  const [severity, setSeverity] = useState<HsSeverity>("near_miss");
  const [description, setDescription] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  // Optional incident photos (captured locally, uploaded during sync)
  const [incidentPhotos, setIncidentPhotos] = useState<IncidentPhoto[]>([]);
  const [showIncidentCamera, setShowIncidentCamera] = useState(false);

  async function run(action: () => Promise<unknown>, doneMessage: string) {
    setBusy(true);
    try {
      await action();
      Alert.alert("Submitted", doneMessage);
      navigation.goBack();
    } catch (e) {
      Alert.alert("Offline queue", "Saved offline — will submit when connectivity returns.");
      navigation.goBack();
    } finally {
      setBusy(false);
    }
  }

  function onReceiptCaptured(localUri: string) {
    setReceiptUri(localUri);
  }

  function removeReceipt() {
    setReceiptUri(null);
  }

  function submitDelivery() {
    const date = validateDateYMD(deliveryDate);
    if (!date.ok) return Alert.alert("Check the date", date.reason);
    if (!material.trim()) return Alert.alert("Missing material", "Name the material delivered.");
    const qty = parseQuantity(quantity);
    if (!qty.ok) return Alert.alert("Check quantity", qty.reason);

    const finalRemarks = [
      selectedTask ? `Target Work Plan: [${selectedTask.task_id}] ${selectedTask.task_name}` : "",
      remarks.trim(),
    ].filter(Boolean).join(" · ");

    initQueueTable();
    enqueueSubmission("material_delivery", project.id, {
      project_id: project.id,
      delivery_date: deliveryDate,
      material: material.trim(),
      quantity: qty.quantity,
      unit: unit.trim(),
      supplier: supplier.trim(),
      remarks: finalRemarks,
      boq_item_id: selectedBoqItem ? selectedBoqItem.id : null,
      receipt_local_uri: receiptUri,
    });
    Alert.alert("Saved", "Delivery recorded offline — will sync when connectivity returns.");
    navigation.goBack();
  }

  function onIncidentCaptured(localUri: string) {
    setIncidentPhotos((ps) => [...ps, { localUri, remoteUrl: null, uploading: false }]);
  }

  function removeIncidentPhoto(localUri: string) {
    setIncidentPhotos((ps) => ps.filter((p) => p.localUri !== localUri));
  }

  function submitIncident() {
    const date = validateDateYMD(incidentDate);
    if (!date.ok) return Alert.alert("Check the date", date.reason);
    if (!description.trim())
      return Alert.alert("Missing description", "Describe what happened.");
    initQueueTable();
    enqueueSubmission("safety_incident", project.id, {
      project_id: project.id,
      incident_date: incidentDate,
      severity,
      description: description.trim(),
      action_taken: actionTaken.trim(),
      photo_urls: incidentPhotos.filter((p) => p.remoteUrl).map((p) => p.remoteUrl),
      pending_photos: incidentPhotos.filter((p) => !p.remoteUrl).map((p) => p.localUri),
    });
    Alert.alert(
      "Saved",
      severity === "serious" || severity === "lost_time"
        ? "Incident recorded offline. It will be submitted when connectivity returns."
        : "Incident recorded offline.",
    );
    navigation.goBack();
  }

  return (
    <Screen>
      <Title>Site Diary</Title>
      <Muted>{project.name}</Muted>

      <View style={styles.segments} accessibilityRole="tablist">
        {SECTIONS.map((s) => (
          <Pressable
            key={s.key}
            onPress={() => setSection(s.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: section === s.key }}
            style={[styles.segment, section === s.key && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, section === s.key && styles.segmentTextActive]}>
              {s.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {section === "log" && (
        <SiteConditionForm project={project} onDone={() => navigation.goBack()} />
      )}

      {section === "materials" && (
        <>
          <Field label="Delivery date" value={deliveryDate} onChangeText={setDeliveryDate} placeholder="YYYY-MM-DD" />

          {/* BoQ Selector Section */}
          <View style={{ marginBottom: spacing.sm }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <Text style={[typography.muted, { fontSize: 13, fontWeight: "600" }]}>Bill of Quantities (BoQ) Item</Text>
              {selectedBoqItem && (
                <Pressable onPress={() => { setSelectedBoqItem(null); }}>
                  <Text style={{ color: colors.danger, fontSize: 12, fontWeight: "600" }}>Clear BoQ link</Text>
                </Pressable>
              )}
            </View>

            {selectedBoqItem ? (
              <View style={styles.boqSelectedCard}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.boqSectionTag}>
                      {selectedBoqItem.section ? selectedBoqItem.section.toUpperCase().replace(/_/g, " ") : "BOQ ITEM"} {selectedBoqItem.item_number}
                    </Text>
                    <Text style={styles.boqItemDesc} numberOfLines={2}>
                      {selectedBoqItem.description}
                    </Text>
                    <Text style={styles.boqPlannedText}>
                      Planned Allowance: <Text style={{ fontWeight: "800", color: colors.text }}>{Number(selectedBoqItem.quantity).toLocaleString()} {selectedBoqItem.unit}</Text>
                    </Text>
                  </View>
                  <Button
                    title="Change"
                    variant="ghost"
                    onPress={() => setBoqModalVisible(true)}
                  />
                </View>
              </View>
            ) : (
              <Button
                title={loadingBoq ? "Loading BoQ items..." : `📦 Link to BoQ item (${boqItems.length} available)`}
                variant="ghost"
                onPress={() => setBoqModalVisible(true)}
              />
            )}
          </View>

          <Field label="Material Name / Description" value={material} onChangeText={setMaterial} placeholder="e.g. Cement 42.5N, Rebar Y16" />

          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Field label="Quantity" value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" placeholder="e.g. 15.0" />
            </View>
            <View style={{ width: 110 }}>
              <Field label="Unit" value={unit} onChangeText={setUnit} placeholder="tonnes, m³…" />
            </View>
          </View>

          {/* Real-time BoQ Variance Feedback */}
          {selectedBoqItem && plannedQty != null && enteredQty > 0 ? (
            <View style={[styles.varianceBadge, isOverPlanned ? styles.varianceOver : styles.varianceOk]}>
              <Text style={[styles.varianceText, isOverPlanned ? styles.varianceTextOver : styles.varianceTextOk]}>
                {isOverPlanned
                  ? `⚠️ Exceeds BoQ planned allowance by +${varianceAmt.toFixed(2)} ${unit} (+${Math.round((varianceAmt / plannedQty) * 100)}%)`
                  : `✓ Within BoQ allowance: ${Math.round((enteredQty / plannedQty) * 100)}% of ${plannedQty.toLocaleString()} ${unit}`}
              </Text>
            </View>
          ) : null}

          {/* Target Work Plan Task */}
          {workPlanTasks.length > 0 && (
            <View style={{ marginVertical: spacing.xs }}>
              <Text style={[typography.muted, { fontSize: 12, marginBottom: 4 }]}>
                Intended Work Plan Activity (Optional):
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: "row", marginBottom: spacing.xs }}>
                {workPlanTasks.slice(0, 10).map((t) => {
                  const isSelected = selectedTask?.id === t.id;
                  return (
                    <Pressable
                      key={t.id}
                      onPress={() => setSelectedTask(isSelected ? null : t)}
                      style={[styles.taskChip, isSelected && styles.taskChipActive]}
                    >
                      <Text style={[styles.taskChipText, isSelected && styles.taskChipTextActive]}>
                        [{t.task_id}] {t.task_name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          <Field label="Supplier" value={supplier} onChangeText={setSupplier} placeholder="e.g. Bamburi, Apex Steel" />

          {/* Quick Supplier Chips */}
          <View style={{ marginBottom: spacing.sm }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: "row", gap: 6 }}>
              {["Bamburi Special Products", "Apex Steel Ltd", "Devki Steel Mills", "Savannah Cement", "Simba Cement", "Tononoka Steel"].map((sup) => (
                <Pressable
                  key={sup}
                  style={[styles.supplierChip, supplier === sup && styles.supplierChipActive]}
                  onPress={() => setSupplier(sup)}
                >
                  <Text style={[styles.supplierChipText, supplier === sup && styles.supplierChipTextActive]}>
                    {sup}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <Field label="Remarks / Storage Location" value={remarks} onChangeText={setRemarks} placeholder="e.g. Offloaded at North yard, batch #4190" />

          <Text style={[typography.muted, { marginBottom: spacing.xs }]}>Delivery note / receipt (proof)</Text>
          {receiptUri ? (
            <View style={styles.receiptRow}>
              <Image source={{ uri: receiptUri }} style={styles.receiptThumb} />
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Muted>Photo captured ✓ (will upload during sync)</Muted>
                <Button title="Remove" variant="ghost" onPress={removeReceipt} />
              </View>
            </View>
          ) : (
            <Button title="📷 Photo of delivery note" variant="ghost" onPress={() => setShowReceiptCamera(true)} />
          )}

          <Button title="Record delivery" loading={busy} onPress={submitDelivery} />
        </>
      )}

      {section === "hs" && (
        <>
          <Field label="Incident date" value={incidentDate} onChangeText={setIncidentDate} placeholder="YYYY-MM-DD" />
          <Text style={[typography.muted, { marginBottom: spacing.xs }]}>Severity</Text>
          <View style={styles.chips}>
            {HS_SEVERITIES.map((s) => (
              <Pressable
                key={s.value}
                onPress={() => setSeverity(s.value)}
                accessibilityRole="radio"
                accessibilityState={{ checked: severity === s.value }}
                style={[styles.chip, severity === s.value && styles.chipActive]}
              >
                <Text style={[styles.chipText, severity === s.value && styles.chipTextActive]}>
                  {s.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={{ marginBottom: spacing.xs }}>
            <Text style={[typography.muted, { fontSize: 11, marginBottom: 4 }]}>Quick hazard tags:</Text>
            <View style={styles.chipRow}>
              {HS_COMMON_DESCRIPTIONS.map((tag) => (
                <Pressable
                  key={tag}
                  onPress={() => setDescription((prev) => (prev.trim() ? `${prev.trim()} · ${tag}` : tag))}
                  style={[styles.chip, { paddingVertical: 4, paddingHorizontal: 8 }]}
                  accessibilityRole="button"
                >
                  <Text style={[styles.chipText, { fontSize: 11 }]}>+ {tag}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <Field label="What happened" value={description} onChangeText={setDescription} multiline placeholder="Describe the incident..." />

          <View style={{ marginBottom: spacing.xs }}>
            <Text style={[typography.muted, { fontSize: 11, marginBottom: 4 }]}>Quick corrective action:</Text>
            <View style={styles.chipRow}>
              {HS_COMMON_ACTIONS.map((tag) => (
                <Pressable
                  key={tag}
                  onPress={() => setActionTaken((prev) => (prev.trim() ? `${prev.trim()} · ${tag}` : tag))}
                  style={[styles.chip, { paddingVertical: 4, paddingHorizontal: 8 }]}
                  accessibilityRole="button"
                >
                  <Text style={[styles.chipText, { fontSize: 11 }]}>+ {tag}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <Field label="Action taken" value={actionTaken} onChangeText={setActionTaken} multiline placeholder="optional" />

          <Text style={[typography.muted, { marginBottom: spacing.xs }]}>Photos (optional)</Text>
          <View style={styles.photoStrip}>
              {incidentPhotos.map((p) => (
              <View key={p.localUri} style={styles.photoItem}>
                <Image source={{ uri: p.localUri }} style={styles.receiptThumb} />
                <Text style={styles.photoNote}>Captured ✓</Text>
                <Pressable onPress={() => removeIncidentPhoto(p.localUri)} accessibilityRole="button">
                  <Text style={styles.photoRemove}>Remove</Text>
                </Pressable>
              </View>
            ))}
          </View>
          <Button title="📷 Add photo" variant="ghost" onPress={() => setShowIncidentCamera(true)} />

          {(severity === "serious" || severity === "lost_time") && (
            <Muted>Submitting will immediately alert the office (push + email).</Muted>
          )}
          <Button title="Report incident" loading={busy} onPress={submitIncident} />
        </>
      )}

      <PhotoCaptureModal
        visible={showReceiptCamera}
        title="Photograph the delivery note"
        projectCode={project.code}
        onCaptured={onReceiptCaptured}
        onClose={() => setShowReceiptCamera(false)}
      />
      <PhotoCaptureModal
        visible={showIncidentCamera}
        title="Photograph the incident"
        projectCode={project.code}
        onCaptured={onIncidentCaptured}
        onClose={() => setShowIncidentCamera(false)}
      />

      {/* BoQ Selection Modal */}
      <Modal visible={boqModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Select BoQ Item</Text>
                <Muted style={{ fontSize: 12 }}>Match delivery to Bill of Quantities allowance</Muted>
              </View>
              <Pressable onPress={() => setBoqModalVisible(false)}>
                <Text style={styles.closeModalText}>✕</Text>
              </Pressable>
            </View>

            <TextInput
              style={styles.searchInput}
              placeholder="Search by description, rebar, concrete, block..."
              placeholderTextColor={colors.textMuted}
              value={boqSearchQuery}
              onChangeText={setBoqSearchQuery}
            />

            <ScrollView style={{ maxHeight: 380, marginVertical: spacing.xs }}>
              {filteredBoqItems.length === 0 ? (
                <View style={{ padding: spacing.md, alignItems: "center" }}>
                  <Muted>No matching BoQ items found.</Muted>
                </View>
              ) : (
                filteredBoqItems.map((item) => (
                  <Pressable
                    key={item.id}
                    style={styles.boqListItem}
                    onPress={() => handleSelectBoqItem(item)}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                      <Text style={styles.boqItemNumber}>
                        [{item.section ? item.section.toUpperCase().replace(/_/g, " ") : "BOQ"}] {item.item_number}
                      </Text>
                      <Text style={styles.boqItemQty}>
                        {Number(item.quantity).toLocaleString()} {item.unit}
                      </Text>
                    </View>
                    <Text style={styles.boqItemTitle} numberOfLines={2}>
                      {item.description}
                    </Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  segments: {
    flexDirection: "row",
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    padding: 4,
    marginVertical: spacing.md,
    gap: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm - 2,
    alignItems: "center",
  },
  segmentActive: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong },
  segmentText: { color: colors.textMuted, fontWeight: "600", fontSize: 13 },
  segmentTextActive: { color: colors.text },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.md },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: colors.primaryText },
  receiptRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center", marginBottom: spacing.sm },
  receiptThumb: { width: 64, height: 64, borderRadius: radius.sm, backgroundColor: colors.surface3 },
  photoStrip: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.sm },
  photoItem: { alignItems: "center", gap: 2 },
  photoNote: { color: colors.textMuted, fontSize: 11 },
  photoRetry: { color: colors.primary, fontSize: 11, fontWeight: "700" },
  photoRemove: { color: colors.danger, fontSize: 11, fontWeight: "600" },
  boqSelectedCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  boqSectionTag: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.primary,
    marginBottom: 2,
  },
  boqItemDesc: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 4,
  },
  boqPlannedText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  varianceBadge: {
    padding: spacing.xs,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
  },
  varianceOk: {
    backgroundColor: "#ecfdf5",
    borderColor: "#10b981",
  },
  varianceOver: {
    backgroundColor: "#fff1f2",
    borderColor: "#ef4444",
  },
  varianceText: {
    fontSize: 12,
    fontWeight: "700",
  },
  varianceTextOk: {
    color: "#047857",
  },
  varianceTextOver: {
    color: "#b91c1c",
  },
  taskChip: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.sm,
    marginRight: 6,
  },
  taskChipActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  taskChipText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: "600",
  },
  taskChipTextActive: {
    color: colors.bg,
  },
  supplierChip: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  supplierChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  supplierChipText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  supplierChipTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    padding: spacing.md,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.text,
  },
  closeModalText: {
    fontSize: 20,
    color: colors.textMuted,
    padding: spacing.xs,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    fontSize: 13,
    color: colors.text,
    backgroundColor: colors.surfaceAlt,
    marginBottom: spacing.xs,
  },
  boqListItem: {
    padding: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  boqItemNumber: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary,
  },
  boqItemQty: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
  },
  boqItemTitle: {
    fontSize: 13,
    color: colors.text,
    fontWeight: "500",
  },
});
