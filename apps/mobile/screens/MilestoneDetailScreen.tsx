import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Alert, Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { ISSUE_FLAG, UPLOAD_STATUS } from "@monitoring/shared-types";

import {
  addObservation,
  deleteEvidence,
  getMilestone,
  listEvidence,
  listMilestones,
  listObservations,
  retryEvidence,
  setPercent,
  submitMilestone,
  subscribeEvidence,
  type EvidenceRow,
  type MilestoneRow,
  type ObservationRow,
} from "../milestone/repository";
import {
  checkPrerequisites,
  classifyProgressChange,
  deriveStatus,
  regressionAudit,
} from "../milestone/governance";
import type { RootStackParamList } from "../navigation/types";
import { apiUrl, mediaUrl } from "../sync/api";
import { fetchMilestoneMiniBoQ, type MilestoneMiniBoQItem, type MilestoneValuation } from "../api/client";
import { uploadPendingEvidence } from "../sync/mediaUploader";
import { runSync } from "../sync/sync";
import { useHaptics } from "../hooks/useHaptics";
import { Badge, Button, Card, IconButton, Muted, Screen, Title } from "../ui/components";
import { ProgressSlider } from "../ui/ProgressSlider";
import { geofenceBadge, issueBadge, uploadBadge } from "../ui/status";
import { colors, radius, spacing, typography } from "../theme/theme";

type Props = NativeStackScreenProps<RootStackParamList, "MilestoneDetail">;

/** Best displayable URI for an evidence photo: the on-device file if we still
 *  have it (instant, works offline), else the uploaded copy on the server. */
function evidenceImageUri(e: EvidenceRow): string | null {
  if (e.localUri) return e.localUri;
  if (!e.remoteUrl) return null;
  return /^https?:\/\//.test(e.remoteUrl) ? e.remoteUrl : mediaUrl(e.remoteUrl);
}

export function MilestoneDetailScreen({ navigation, route }: Props) {
  const { project, milestoneEntryId } = route.params;
  const haptics = useHaptics();
  const [entry, setEntry] = useState<MilestoneRow | null>(null);
  const [evidence, setEvidence] = useState<EvidenceRow[]>([]);
  const [observations, setObservations] = useState<ObservationRow[]>([]);
  const [percent, setPercentInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  // Progress-verification governance (URS module 2).
  const [workDrawings, setWorkDrawings] = useState<boolean | null>(true);
  const [defects, setDefects] = useState<boolean | null>(false);
  const [regression, setRegression] = useState<{ prev: number; next: number } | null>(null);
  const [justify, setJustify] = useState("");
  const [miniBoq, setMiniBoq] = useState<{ items: MilestoneMiniBoQItem[]; valuation: MilestoneValuation | null }>({ items: [], valuation: null });
  const [showBoQ, setShowBoQ] = useState(false);
  const [allMilestones, setAllMilestones] = useState<MilestoneRow[]>([]);

  const reloadEvidence = useCallback(
    () => { listEvidence(milestoneEntryId).then(setEvidence); },
    [milestoneEntryId],
  );

  const reload = useCallback(() => {
    getMilestone(milestoneEntryId).then((m) => {
      setEntry(m);
      setPercentInput(String(m.percentComplete));
    });
    listMilestones(project.id).then(setAllMilestones).catch(() => {});
    reloadEvidence();
    listObservations(milestoneEntryId).then(setObservations);
    fetchMilestoneMiniBoQ(milestoneEntryId)
      .then((res) => {
        setMiniBoq({ items: res.items || [], valuation: res.valuation || null });
      })
      .catch(() => {});
  }, [milestoneEntryId, project.id, reloadEvidence]);

  const prereqCheck = useMemo(() => {
    return checkPrerequisites(entry?.prerequisites, allMilestones);
  }, [entry?.prerequisites, allMilestones]);

  useFocusEffect(
    useCallback(() => {
      reload();
      // Start uploading any captured-but-pending photos as soon as the
      // milestone is opened (don't wait for the next background sync), and
      // re-render live as their progress updates.
      uploadPendingEvidence().catch(() => {});
      return subscribeEvidence(reloadEvidence);
    }, [reload, reloadEvidence]),
  );

  const locked = entry?.submittedAt != null;

  // Persist the slider value to the store. Called before any navigation away
  // (Capture / Add observation) and before submit, so the drag isn't lost when
  // the screen reloads on focus — and so we always sign exactly what's shown.
  async function persistPercent() {
    const value = Number(percent);
    if (!Number.isNaN(value)) await setPercent(milestoneEntryId, value);
  }

  async function commitPercent(next: number) {
    await setPercent(milestoneEntryId, next);
    reload();
  }

  // Progressive-% rule: a decrease opens the regression workflow; a big jump
  // needs confirmation (inflation control); otherwise save straight through.
  function onSavePercent() {
    const next = Number(percent);
    if (Number.isNaN(next) || !entry) return;

    if (!prereqCheck.satisfied && next > 0) {
      const blockers = prereqCheck.blockedBy.map((b) => `• ${b.milestone_id} (${b.percent_complete}%)`).join("\n");
      Alert.alert(
        "Stage-Gate Locked",
        `Preceding contractual milestone(s) must reach 100% completion before progress can be claimed on this activity:\n\n${blockers}`
      );
      return;
    }

    const change = classifyProgressChange(entry.percentComplete, next);
    if (change.kind === "regression") {
      setJustify("");
      setRegression({ prev: change.prev, next: change.next });
      return;
    }
    if (change.kind === "inflation") {
      Alert.alert(
        "Large progress jump",
        `Progress jumps from ${change.prev}% to ${change.next}% (+${change.jump}%). Confirm this is correct?`,
        [{ text: "Cancel", style: "cancel" }, { text: "Confirm", onPress: () => commitPercent(change.next) }],
      );
      return;
    }
    commitPercent(next);
  }

  // Regression workflow: a mandatory justification is recorded as an immutable,
  // urgent-flagged observation (audit trail: user + timestamp) before the lower
  // value is accepted.
  async function confirmRegression() {
    if (!regression || justify.trim().length < 3) {
      Alert.alert("Justification required", "Enter why the recorded progress is being lowered.");
      return;
    }
    await addObservation(milestoneEntryId, regressionAudit(regression.prev, regression.next, justify), ISSUE_FLAG.URGENT);
    await setPercent(milestoneEntryId, regression.next);
    setRegression(null);
    reload();
  }

  async function goCapture() {
    await persistPercent();
    navigation.navigate("Capture", { project, milestoneEntryId });
  }

  async function goAddObservation() {
    await persistPercent();
    navigation.navigate("AddObservation", { milestoneEntryId });
  }

  function onRetryEvidence(id: string) {
    retryEvidence(id);
    reloadEvidence();
    uploadPendingEvidence().catch(() => {});
  }

  function onDeleteEvidence(id: string) {
    Alert.alert(
      "Delete this photo?",
      "It will be removed from this milestone. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => { deleteEvidence(id); reloadEvidence(); },
        },
      ],
    );
  }

  async function onSubmit() {
    if (!entry) return;
    const next = Number(percent);

    // Contractual stage-gate validation
    if (!prereqCheck.satisfied && next > 0) {
      const blockers = prereqCheck.blockedBy.map((b) => `• ${b.milestone_id} (${b.percent_complete}%)`).join("\n");
      Alert.alert(
        "Stage-Gate Locked",
        `Preceding contractual milestone(s) must reach 100% completion before work on this milestone can be submitted:\n\n${blockers}`
      );
      return;
    }

    // A lower-than-recorded value must go through the regression workflow first.
    if (!Number.isNaN(next) && next < entry.percentComplete) {
      Alert.alert("Regression", 'Use "Save progress" to record the required justification before submitting.');
      return;
    }
    // Mandatory verification answers (URS 2.2).
    if (workDrawings === null || defects === null) {
      Alert.alert("Verification needed", "Answer “work as per drawings?” and “visible defects?” before submitting.");
      return;
    }
    if (defects && evidence.length === 0) {
      Alert.alert("Photo required", "Visible defects need a photo — capture evidence before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      // Persist the slider value first so we sign exactly what's on screen.
      await persistPercent();
      // Record the verification answers as part of the submission (audit trail).
      await addObservation(milestoneEntryId, `Work as per drawings: ${workDrawings ? "Yes" : "No"}`);
      await addObservation(
        milestoneEntryId,
        `Visible defects: ${defects ? "Yes" : "No"}`,
        defects ? ISSUE_FLAG.ISSUE : ISSUE_FLAG.NONE,
      );
      const result = await submitMilestone(milestoneEntryId);
      if (!result.ok) {
        haptics.error();
        Alert.alert("Cannot submit", result.reason ?? "Unknown error");
        return;
      }
      await runSync().catch(() => {});
      // Submission confirmation (SRS-MOB-SUB): show the seal so the Clerk has
      // verifiable proof of exactly what was signed (audit/verify re-derives it).
      haptics.success();
      Alert.alert(
        "Submitted & sealed",
        `Signed with your device key. It will sync when online.\n\nSeal: ${
          result.integrityHash ? `${result.integrityHash.slice(0, 16)}…` : "—"
        }`,
      );
      reload();
    } catch (e) {
      Alert.alert("Submission error", (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!entry) return <Screen><Muted>Loading…</Muted></Screen>;

  return (
    <Screen>
      <Title>{entry.milestoneId}</Title>
      <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }}>
        <Badge badge={locked ? { label: "Submitted", color: "#16a34a" } : { label: "Draft", color: "#94a3b8" }} />
        <Badge badge={{ label: deriveStatus(locked ? entry.percentComplete : Number(percent) || 0), color: colors.primary }} />
        {!prereqCheck.satisfied ? (
          <Badge badge={{ label: `🔒 Stage-Gate (${prereqCheck.blockedBy.length} blocked)`, color: colors.danger }} />
        ) : entry?.prerequisites && entry.prerequisites.length > 0 ? (
          <Badge badge={{ label: `✓ Stage-Gate (${entry.prerequisites.length} passed)`, color: colors.success }} />
        ) : null}
      </View>

      {!prereqCheck.satisfied ? (
        <View style={styles.stageGateBanner}>
          <Text style={styles.stageGateTitle}>🔒 Contractual Stage-Gate Locked</Text>
          <Text style={styles.stageGateBody}>
            Preceding milestone(s) must reach 100% completion before progress on this activity can be claimed:
          </Text>
          {prereqCheck.blockedBy.map((b) => (
            <Text key={b.milestone_id} style={styles.stageGateItem}>
              • {b.milestone_id} — currently {b.percent_complete}% (incomplete)
            </Text>
          ))}
        </View>
      ) : null}

      {locked ? (
        <View>
          <Muted>Submitted — you can still update progress below.</Muted>
          <ProgressSlider
            label="Progress"
            value={Number(percent) || 0}
            onChange={(n) => setPercentInput(String(n))}
          />
          <Button title="Update progress" variant="ghost" onPress={onSavePercent} />
        </View>
      ) : (
        <View>
          <ProgressSlider
            label="Progress"
            value={Number(percent) || 0}
            onChange={(n) => setPercentInput(String(n))}
          />
          <Button title="Save progress" variant="ghost" onPress={onSavePercent} />

          <Text style={[typography.muted, { marginTop: spacing.sm }]}>Work as per drawings?</Text>
          <YN value={workDrawings} onChange={setWorkDrawings} />
          <Text style={typography.muted}>Visible defects?</Text>
          <YN value={defects} onChange={setDefects} />
          {defects ? <Muted>A photo is required for visible defects — capture evidence below.</Muted> : null}
        </View>
      )}

      {miniBoq.items.length > 0 && (
        <Card style={{ marginTop: spacing.md }}>
          <Pressable
            onPress={() => setShowBoQ(!showBoQ)}
            style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
          >
            <View style={{ flex: 1 }}>
              <Text style={typography.heading}>Mini-BoQ Scope ({miniBoq.items.length} items)</Text>
              {miniBoq.valuation && (
                <Muted>
                  Gross: KES {Number(miniBoq.valuation.current_gross || 0).toLocaleString()} · Net: KES {Number(miniBoq.valuation.net_payable || 0).toLocaleString()}
                </Muted>
              )}
            </View>
            <Text style={{ fontSize: 16, color: colors.primary, paddingLeft: spacing.sm }}>{showBoQ ? "▲" : "▼"}</Text>
          </Pressable>
          {showBoQ && (
            <View style={{ marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.surface3, paddingTop: spacing.xs }}>
              {miniBoq.items.map((it) => (
                <View key={it.id} style={{ paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.surface3 }}>
                  <Text style={[typography.body, { fontWeight: "600" }]}>
                    {it.boq_item_number} · {it.boq_description}
                  </Text>
                  <Text style={[typography.muted, { fontSize: 12 }]}>
                    Allocated: {Number(it.allocated_quantity).toLocaleString()} {it.boq_unit} @ KES {Number(it.boq_rate).toLocaleString()}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </Card>
      )}

      <Text style={[typography.heading, { marginTop: spacing.md }]}>Evidence ({evidence.length})</Text>
      {evidence.map((e) => {
        const uri = evidenceImageUri(e);
        return (
          <Card key={e.id}>
            <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" }}>
              {uri ? (
                <Pressable onPress={() => setViewerUri(uri)} accessibilityRole="imagebutton" accessibilityLabel="View photo">
                  <Image source={{ uri }} style={styles.thumb} />
                </Pressable>
              ) : (
                <View style={[styles.thumb, styles.thumbEmpty]}>
                  <Text style={{ fontSize: 24 }}>📷</Text>
                </View>
              )}
              <View style={{ flex: 1, gap: spacing.xs }}>
                <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }}>
                  <Badge badge={geofenceBadge(e.geofenceStatus, e.distanceM)} />
                  <Badge badge={uploadBadge(e.uploadStatus)} />
                </View>
                {e.uploadStatus === UPLOAD_STATUS.UPLOADING && (
                  <View>
                    <View style={{ height: 6, borderRadius: 4, backgroundColor: colors.surface3, overflow: "hidden" }}>
                      <View style={{ height: 6, borderRadius: 4, backgroundColor: colors.primary, width: `${e.uploadProgress}%` }} />
                    </View>
                    <Muted>Uploading {e.uploadProgress}%</Muted>
                  </View>
                )}
                {e.uploadStatus === UPLOAD_STATUS.FAILED && (
                  <Muted>Upload failed — retry, or delete to submit without it.</Muted>
                )}
                <Muted>{e.hash.slice(0, 12)}…</Muted>
                {e.uploadStatus === UPLOAD_STATUS.FAILED && (
                  <Button title="Retry upload" variant="ghost" onPress={() => onRetryEvidence(e.id)} />
                )}
              </View>
              {(!locked || e.uploadStatus === UPLOAD_STATUS.FAILED) && (
                <IconButton glyph="🗑" label="Delete photo" tint={colors.danger} onPress={() => onDeleteEvidence(e.id)} />
              )}
            </View>
          </Card>
        );
      })}
      {/* Evidence capture remains available after submission for supplementary photos */}
      <Button title="Capture evidence" onPress={goCapture} />

      <Text style={[typography.heading, { marginTop: spacing.md }]}>Observations ({observations.length})</Text>
      {observations.map((o) => {
        const badge = issueBadge(o.flag);
        return (
          <Card key={o.id}>
            {badge ? <Badge badge={badge} /> : null}
            <Text style={typography.body}>{o.body}</Text>
          </Card>
        );
      })}
      {/* Observations can always be added, even after submission */}
      <Button title="Add observation" variant="ghost" onPress={goAddObservation} />

      {!locked ? (
        <View style={{ marginTop: spacing.md }}>
          {evidence.length === 0 ? (
            <View style={{ backgroundColor: colors.surfaceAlt, padding: spacing.sm, borderRadius: radius.sm, marginBottom: spacing.xs, borderWidth: 1, borderColor: colors.border }}>
              <Text style={[typography.muted, { fontSize: 12 }]}>
                📷 At least 1 photo evidence is required before signing. Tap "Capture evidence" above.
              </Text>
            </View>
          ) : evidence.some((e) => e.uploadStatus === UPLOAD_STATUS.UPLOADING) ? (
            <View style={{ backgroundColor: colors.surfaceAlt, padding: spacing.sm, borderRadius: radius.sm, marginBottom: spacing.xs, borderWidth: 1, borderColor: colors.border }}>
              <Text style={[typography.muted, { fontSize: 12 }]}>
                ⏳ Uploading photo evidence to server... Please wait a few seconds before signing.
              </Text>
            </View>
          ) : null}
          <Button
            title={
              !prereqCheck.satisfied
                ? "🔒 Stage-gate locked"
                : evidence.some((e) => e.uploadStatus === UPLOAD_STATUS.UPLOADING)
                ? "Uploading evidence…"
                : "Sign & submit"
            }
            loading={submitting}
            disabled={!prereqCheck.satisfied || evidence.some((e) => e.uploadStatus === UPLOAD_STATUS.UPLOADING)}
            onPress={onSubmit}
          />
        </View>
      ) : null}

      {/* Full-screen photo viewer — tap anywhere to dismiss. */}
      <Modal visible={viewerUri != null} transparent animationType="fade" onRequestClose={() => setViewerUri(null)}>
        <Pressable style={styles.viewerBackdrop} onPress={() => setViewerUri(null)} accessibilityLabel="Close photo">
          {viewerUri ? <Image source={{ uri: viewerUri }} style={styles.viewerImage} resizeMode="contain" /> : null}
          <Text style={styles.viewerHint}>Tap to close</Text>
        </Pressable>
      </Modal>

      {/* Regression workflow — mandatory justification when lowering progress. */}
      <Modal visible={regression != null} transparent animationType="fade" onRequestClose={() => setRegression(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={typography.heading}>Lowering progress</Text>
            {regression ? (
              <Muted>Recorded progress drops {regression.prev}% → {regression.next}%. This is logged as a regression event.</Muted>
            ) : null}
            <TextInput
              style={styles.justifyInput}
              placeholder="Justification (required)"
              placeholderTextColor={colors.textMuted}
              value={justify}
              onChangeText={setJustify}
              multiline
            />
            <Button title="Confirm regression" variant="danger" onPress={confirmRegression} />
            <Button title="Cancel" variant="ghost" onPress={() => setRegression(null)} />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

/** Yes / No selector (unset until answered). */
function YN({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.ynRow}>
      {[["No", false], ["Yes", true]].map(([t, v]) => {
        const on = value === v;
        return (
          <Pressable key={t as string} onPress={() => onChange(v as boolean)} accessibilityRole="radio"
            accessibilityState={{ checked: on }} style={[styles.yn, on && styles.ynOn]}>
            <Text style={[styles.ynText, on && styles.ynTextOn]}>{t as string}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: { width: 64, height: 64, borderRadius: radius.sm, backgroundColor: colors.surface3 },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  viewerBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center" },
  viewerImage: { width: "100%", height: "82%" },
  viewerHint: { color: "rgba(255,255,255,0.6)", marginTop: spacing.md, fontSize: 13 },
  ynRow: { flexDirection: "row", gap: spacing.xs, marginTop: spacing.xs, marginBottom: spacing.sm },
  yn: {
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 18, paddingVertical: 6, minWidth: 56, alignItems: "center",
  },
  ynOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  ynText: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  ynTextOn: { color: colors.primaryText },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: spacing.lg },
  modalCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, gap: spacing.sm },
  justifyInput: {
    backgroundColor: colors.surfaceAlt, color: colors.text, borderRadius: radius.sm,
    padding: spacing.md, minHeight: 70, textAlignVertical: "top",
  },
  stageGateBanner: {
    backgroundColor: "#fff1f2",
    borderColor: "#ef4444",
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginVertical: spacing.sm,
  },
  stageGateTitle: {
    color: "#b91c1c",
    fontWeight: "800",
    fontSize: 13,
    marginBottom: 2,
  },
  stageGateBody: {
    color: "#991b1b",
    fontSize: 12,
    marginBottom: 4,
  },
  stageGateItem: {
    color: "#7f1d1d",
    fontSize: 12,
    fontWeight: "600",
  },
});
