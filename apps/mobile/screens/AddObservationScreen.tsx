import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { View } from "react-native";
import { ISSUE_FLAG, type IssueFlag } from "@monitoring/shared-types";

import { addObservation } from "../milestone/repository";
import type { RootStackParamList } from "../navigation/types";
import { Button, Field, Muted, Screen, Title } from "../ui/components";
import { spacing } from "../theme/theme";

type Props = NativeStackScreenProps<RootStackParamList, "AddObservation">;

const FLAGS: { label: string; value: IssueFlag; variant: "primary" | "danger" | "ghost" }[] = [
  { label: "Note", value: ISSUE_FLAG.NONE, variant: "ghost" },
  { label: "Issue", value: ISSUE_FLAG.ISSUE, variant: "primary" },
  { label: "Urgent", value: ISSUE_FLAG.URGENT, variant: "danger" },
];

export function AddObservationScreen({ navigation, route }: Props) {
  const { milestoneEntryId } = route.params;
  const [body, setBody] = useState("");
  const [flag, setFlag] = useState<IssueFlag>(ISSUE_FLAG.NONE);

  async function onSave() {
    if (!body.trim()) return;
    await addObservation(milestoneEntryId, body.trim(), flag);
    navigation.goBack();
  }

  return (
    <Screen>
      <Title>Add observation</Title>
      <Field
        label="Observation"
        value={body}
        onChangeText={setBody}
        multiline
        placeholder="Describe what you observed on site"
      />
      <Muted>Flag</Muted>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        {FLAGS.map((f) => (
          <View key={f.value} style={{ flex: 1 }}>
            <Button
              title={f.label}
              variant={flag === f.value ? f.variant : "ghost"}
              onPress={() => setFlag(f.value)}
            />
          </View>
        ))}
      </View>
      <Button title="Save observation" onPress={onSave} disabled={!body.trim()} />
    </Screen>
  );
}
