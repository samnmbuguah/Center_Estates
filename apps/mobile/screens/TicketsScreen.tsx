import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

import {
  addTicketComment,
  createTicket,
  fetchTicketComments,
  fetchTickets,
  updateTicketStatus,
  type TicketCommentRow,
  type TicketRow,
} from "../api/client";
import type { RootStackParamList } from "../navigation/types";
import { Badge, Card, Muted, Screen, Title } from "../ui/components";
import { colors, radius, spacing, typography } from "../theme/theme";

type Props = NativeStackScreenProps<RootStackParamList, "Tickets">;

type FilterMode = "all" | "open" | "urgent" | "resolved";

function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return d.toISOString().slice(0, 10);
}

function priorityColor(priority: string): string {
  switch (priority?.toLowerCase()) {
    case "urgent":
      return colors.danger;
    case "high":
      return "#f59e0b"; // amber
    case "normal":
      return colors.primary;
    case "low":
    default:
      return colors.muted;
  }
}

function statusColor(status: string): string {
  switch (status?.toLowerCase()) {
    case "resolved":
    case "closed":
      return colors.success;
    case "in_progress":
    case "acknowledged":
      return "#0284c7"; // sky blue
    case "open":
    default:
      return colors.danger;
  }
}

export function TicketsScreen({ route }: Props) {
  const { project } = route.params;
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [error, setError] = useState<string | null>(null);

  // Create Modal State
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newPriority, setNewPriority] = useState<"normal" | "high" | "urgent" | "low">("normal");
  const [newRisk, setNewRisk] = useState<"low" | "medium" | "high">("medium");
  const [newDueDate, setNewDueDate] = useState(defaultDueDate());
  const [creating, setCreating] = useState(false);

  // Discussion Modal State
  const [activeTicket, setActiveTicket] = useState<TicketRow | null>(null);
  const [comments, setComments] = useState<TicketCommentRow[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newCommentBody, setNewCommentBody] = useState("");
  const [sendingComment, setSendingComment] = useState(false);

  const loadTickets = useCallback(async () => {
    if (!project?.id) return;
    try {
      setError(null);
      const data = await fetchTickets(project.id);
      setTickets(Array.isArray(data) ? data : []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [project?.id]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const onRefresh = () => {
    setRefreshing(true);
    loadTickets();
  };

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (filter === "open") return t.status === "open" || t.status === "acknowledged" || t.status === "in_progress";
      if (filter === "urgent") return t.priority === "urgent";
      if (filter === "resolved") return t.status === "resolved" || t.status === "closed";
      return true;
    });
  }, [tickets, filter]);

  // Counts
  const counts = useMemo(() => {
    const total = tickets.length;
    const open = tickets.filter((t) => t.status === "open" || t.status === "acknowledged" || t.status === "in_progress").length;
    const urgent = tickets.filter((t) => t.priority === "urgent" && t.status !== "closed" && t.status !== "resolved").length;
    const resolved = tickets.filter((t) => t.status === "resolved" || t.status === "closed").length;
    return { total, open, urgent, resolved };
  }, [tickets]);

  // Handle Status Action
  const handleStatusChange = async (ticket: TicketRow, action: "acknowledge" | "resolve" | "close") => {
    try {
      await updateTicketStatus(ticket.id, action);
      loadTickets();
    } catch (e) {
      Alert.alert("Error", (e as Error).message);
    }
  };

  // Handle Create Ticket
  const handleCreate = async () => {
    if (!newTitle.trim()) {
      Alert.alert("Validation", "Please provide a title for the ticket.");
      return;
    }
    setCreating(true);
    try {
      await createTicket({
        project_id: project.id,
        title: newTitle.trim(),
        body: newBody.trim(),
        priority: newPriority,
        risk_level: newRisk,
        due_date: newDueDate.trim() || undefined,
      });
      setCreateModalVisible(false);
      setNewTitle("");
      setNewBody("");
      setNewPriority("normal");
      setNewRisk("medium");
      setNewDueDate(defaultDueDate());
      loadTickets();
    } catch (e) {
      Alert.alert("Creation Failed", (e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  // Open Comments Discussion
  const openDiscussion = async (ticket: TicketRow) => {
    setActiveTicket(ticket);
    setLoadingComments(true);
    try {
      const data = await fetchTicketComments(ticket.id);
      setComments(Array.isArray(data) ? data : []);
    } catch {
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  };

  // Send New Comment
  const handleSendComment = async () => {
    if (!activeTicket || !newCommentBody.trim()) return;
    setSendingComment(true);
    try {
      const newComment = await addTicketComment(activeTicket.id, newCommentBody.trim());
      setComments((prev) => [...prev, newComment]);
      setNewCommentBody("");
    } catch (e) {
      Alert.alert("Comment Failed", (e as Error).message);
    } finally {
      setSendingComment(false);
    }
  };

  return (
    <Screen>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Title>Tickets & Snags</Title>
          <Muted>{project?.name || "Project Site"}</Muted>
        </View>
        <Pressable
          style={styles.addButton}
          onPress={() => setCreateModalVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Raise New Ticket"
        >
          <Text style={styles.addButtonText}>+ Raise Ticket</Text>
        </Pressable>
      </View>

      {/* KPI Stats Strip */}
      <View style={styles.statsStrip}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{counts.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statNumber, { color: colors.danger }]}>{counts.open}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statNumber, { color: colors.danger }]}>{counts.urgent}</Text>
          <Text style={styles.statLabel}>Urgent</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statNumber, { color: colors.success }]}>{counts.resolved}</Text>
          <Text style={styles.statLabel}>Resolved</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {(["all", "open", "urgent", "resolved"] as FilterMode[]).map((f) => (
          <Pressable
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Muted style={{ marginTop: spacing.sm }}>Loading site tickets...</Muted>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingBottom: spacing.xxl }}
        >
          {filteredTickets.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>🎫</Text>
              <Text style={styles.emptyTitle}>No tickets found</Text>
              <Muted style={{ textAlign: "center" }}>
                {filter === "all"
                  ? "No tickets or snags recorded yet for this project."
                  : `No ${filter} tickets right now.`}
              </Muted>
            </Card>
          ) : (
            filteredTickets.map((t) => (
              <Card key={t.id} style={styles.ticketCard}>
                {/* Badges Bar */}
                <View style={styles.badgeRow}>
                  <View style={styles.leftBadges}>
                    <View style={[styles.pill, { backgroundColor: priorityColor(t.priority) }]}>
                      <Text style={styles.pillText}>{t.priority.toUpperCase()}</Text>
                    </View>
                    <View style={[styles.pillOutline, { borderColor: statusColor(t.status) }]}>
                      <Text style={[styles.pillOutlineText, { color: statusColor(t.status) }]}>
                        {t.status.replace("_", " ").toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  {t.escalation_level && t.escalation_level > 0 ? (
                    <View style={styles.escalationPill}>
                      <Text style={styles.escalationPillText}>L{t.escalation_level} ESCALATED</Text>
                    </View>
                  ) : null}
                </View>

                {/* Title & Body */}
                <Text style={styles.ticketTitle}>{t.title}</Text>
                {t.body ? <Text style={styles.ticketBody}>{t.body}</Text> : null}

                {/* Metadata Row */}
                <View style={styles.metaRow}>
                  {t.due_date ? (
                    <Text style={styles.metaItem}>📅 Due: {t.due_date}</Text>
                  ) : (
                    <Text style={styles.metaItem}>📅 No due date</Text>
                  )}
                  {t.risk_level ? (
                    <Text style={styles.metaItem}>⚠️ Risk: {t.risk_level}</Text>
                  ) : null}
                </View>

                {/* Actions Footer */}
                <View style={styles.actionRow}>
                  <Pressable
                    style={styles.commentButton}
                    onPress={() => openDiscussion(t)}
                  >
                    <Text style={styles.commentButtonText}>💬 Discussion</Text>
                  </Pressable>

                  <View style={styles.statusActionGroup}>
                    {t.status === "open" ? (
                      <Pressable
                        style={[styles.smallActionBtn, { backgroundColor: "#0284c7" }]}
                        onPress={() => handleStatusChange(t, "acknowledge")}
                      >
                        <Text style={styles.smallActionBtnText}>Acknowledge</Text>
                      </Pressable>
                    ) : null}

                    {t.status === "open" || t.status === "acknowledged" || t.status === "in_progress" ? (
                      <Pressable
                        style={[styles.smallActionBtn, { backgroundColor: colors.success }]}
                        onPress={() => handleStatusChange(t, "resolve")}
                      >
                        <Text style={styles.smallActionBtnText}>Mark Resolved</Text>
                      </Pressable>
                    ) : null}

                    {t.status === "resolved" ? (
                      <Pressable
                        style={[styles.smallActionBtn, { backgroundColor: colors.muted }]}
                        onPress={() => handleStatusChange(t, "close")}
                      >
                        <Text style={styles.smallActionBtnText}>Close Ticket</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              </Card>
            ))
          )}
        </ScrollView>
      )}

      {/* Raise Ticket Modal */}
      <Modal visible={createModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Raise New Site Ticket</Text>
              <Pressable onPress={() => setCreateModalVisible(false)}>
                <Text style={styles.closeModalText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 420 }}>
              <Text style={styles.inputLabel}>Title *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Rebar spacing defect on 3rd floor slab"
                placeholderTextColor={colors.muted}
                value={newTitle}
                onChangeText={setNewTitle}
              />

              <Text style={styles.inputLabel}>Description / Notes</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Provide location details, observed defects, or contractor instructions..."
                placeholderTextColor={colors.muted}
                value={newBody}
                onChangeText={setNewBody}
                multiline
                numberOfLines={3}
              />

              <Text style={styles.inputLabel}>Priority</Text>
              <View style={styles.chipGroup}>
                {(["normal", "high", "urgent", "low"] as const).map((p) => (
                  <Pressable
                    key={p}
                    style={[
                      styles.choiceChip,
                      newPriority === p && { backgroundColor: priorityColor(p), borderColor: priorityColor(p) },
                    ]}
                    onPress={() => setNewPriority(p)}
                  >
                    <Text
                      style={[
                        styles.choiceChipText,
                        newPriority === p && { color: "#ffffff", fontWeight: "700" },
                      ]}
                    >
                      {p.toUpperCase()}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.inputLabel}>Risk Level</Text>
              <View style={styles.chipGroup}>
                {(["low", "medium", "high"] as const).map((r) => (
                  <Pressable
                    key={r}
                    style={[
                      styles.choiceChip,
                      newRisk === r && { backgroundColor: colors.text, borderColor: colors.text },
                    ]}
                    onPress={() => setNewRisk(r)}
                  >
                    <Text
                      style={[
                        styles.choiceChipText,
                        newRisk === r && { color: colors.bg, fontWeight: "700" },
                      ]}
                    >
                      {r.toUpperCase()}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.inputLabel}>Target SLA Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.muted}
                value={newDueDate}
                onChangeText={setNewDueDate}
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => setCreateModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.submitBtn, creating && { opacity: 0.7 }]}
                onPress={handleCreate}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>Submit Ticket</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Discussion Comments Modal */}
      <Modal visible={!!activeTicket} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: 520 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.modalTitle} numberOfLines={1}>
                  {activeTicket?.title}
                </Text>
                <Muted style={{ fontSize: 12 }}>Ticket Discussion & Audit</Muted>
              </View>
              <Pressable onPress={() => setActiveTicket(null)}>
                <Text style={styles.closeModalText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView style={{ flex: 1, marginVertical: spacing.sm }}>
              {loadingComments ? (
                <View style={styles.centered}>
                  <ActivityIndicator color={colors.primary} />
                </View>
              ) : comments.length === 0 ? (
                <View style={{ padding: spacing.md, alignItems: "center" }}>
                  <Muted>No comments on this ticket yet. Start the thread below.</Muted>
                </View>
              ) : (
                comments.map((c) => (
                  <View key={c.id} style={styles.commentItem}>
                    <View style={styles.commentHeader}>
                      <Text style={styles.commentAuthor}>{c.author_name || "Engineer"}</Text>
                      <Text style={styles.commentDate}>
                        {c.created_at ? new Date(c.created_at).toLocaleDateString() : ""}
                      </Text>
                    </View>
                    <Text style={styles.commentBody}>{c.body}</Text>
                  </View>
                ))
              )}
            </ScrollView>

            {/* Comment Composer */}
            <View style={styles.commentComposer}>
              <TextInput
                style={styles.commentInput}
                placeholder="Write a message or reply..."
                placeholderTextColor={colors.muted}
                value={newCommentBody}
                onChangeText={setNewCommentBody}
              />
              <Pressable
                style={[
                  styles.sendCommentBtn,
                  (!newCommentBody.trim() || sendingComment) && { opacity: 0.5 },
                ]}
                onPress={handleSendComment}
                disabled={!newCommentBody.trim() || sendingComment}
              >
                {sendingComment ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.sendCommentBtnText}>Send</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  addButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  addButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: typography.body.fontSize,
  },
  statsStrip: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
    justifyContent: "space-around",
    borderWidth: 1,
    borderColor: colors.border,
  },
  statBox: {
    alignItems: "center",
  },
  statNumber: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
  },
  statLabel: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  filterRow: {
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
  },
  filterChipTextActive: {
    color: "#ffffff",
  },
  errorBox: {
    backgroundColor: "#fee2e2",
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  emptyCard: {
    alignItems: "center",
    padding: spacing.xl,
    marginTop: spacing.md,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.xs,
  },
  ticketCard: {
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  leftBadges: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  pill: {
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  pillText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
  },
  pillOutline: {
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 1,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  pillOutlineText: {
    fontSize: 10,
    fontWeight: "800",
  },
  escalationPill: {
    backgroundColor: "#fef3c7",
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  escalationPillText: {
    color: "#b45309",
    fontSize: 10,
    fontWeight: "800",
  },
  ticketTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4,
  },
  ticketBody: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  metaRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  metaItem: {
    fontSize: 11,
    color: colors.muted,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  commentButton: {
    paddingVertical: 4,
    paddingHorizontal: spacing.xs,
  },
  commentButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
  },
  statusActionGroup: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  smallActionBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.sm,
  },
  smallActionBtnText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
  },
  closeModalText: {
    fontSize: 20,
    color: colors.muted,
    padding: spacing.xs,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
    marginTop: spacing.sm,
    marginBottom: 4,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.bg,
  },
  textArea: {
    height: 70,
    textAlignVertical: "top",
  },
  chipGroup: {
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  choiceChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  choiceChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.muted,
  },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  cancelBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  cancelBtnText: {
    color: colors.muted,
    fontWeight: "600",
  },
  submitBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  submitBtnText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  commentItem: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  commentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  commentAuthor: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
  },
  commentDate: {
    fontSize: 10,
    color: colors.muted,
  },
  commentBody: {
    fontSize: 13,
    color: colors.text,
  },
  commentComposer: {
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    fontSize: 13,
    color: colors.text,
    backgroundColor: colors.bg,
  },
  sendCommentBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
    borderRadius: radius.md,
  },
  sendCommentBtnText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 12,
  },
});
