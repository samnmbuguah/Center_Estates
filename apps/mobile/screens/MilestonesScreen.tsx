import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Text, View } from "react-native";

import { listMilestones, type MilestoneRow } from "../milestone/repository";
import type { RootStackParamList } from "../navigation/types";
import { Badge, Card, Muted, Screen, Title } from "../ui/components";
import { runSync } from "../sync/sync";
import { colors, spacing, typography } from "../theme/theme";

type Props = NativeStackScreenProps<RootStackParamList, "Milestones">;

export function MilestonesScreen({ navigation, route }: Props) {
  const { project } = route.params;
  const [entries, setEntries] = useState<MilestoneRow[]>([]);

  const reload = useCallback(() => {
    listMilestones(project.id).then(setEntries);
    runSync().catch(() => {});
  }, [project.id]);

  useFocusEffect(reload);

  return (
    <Screen>
      <Title>{project.name}</Title>

      <Text style={[typography.heading, { marginTop: spacing.sm }]}>Milestones</Text>
      {entries.length === 0 ? <Muted>No milestones yet — sync to load from the work plan.</Muted> : null}
      {entries.map((m) => (
        <Card
          key={m.id}
          onPress={() => navigation.navigate("MilestoneDetail", { project, milestoneEntryId: m.id })}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={typography.heading}>{m.milestoneId}</Text>
            <Badge badge={m.submittedAt ? { label: "Submitted", color: colors.success } : { label: "Draft", color: colors.textMuted }} />
          </View>
          <Muted>{m.percentComplete}% complete</Muted>
        </Card>
      ))}
    </Screen>
  );
}
