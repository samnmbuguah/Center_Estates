import { Text } from "react-native";

import { useAuth } from "../auth/AuthContext";
import { useTourContext } from "../tour/TourProvider";
import { Button, Card, Muted, Screen, Title } from "../ui/components";
import { typography } from "../theme/theme";

export function AccountScreen() {
  const { me, signOut } = useAuth();
  const tour = useTourContext();
  return (
    <Screen>
      <Title>Account</Title>

      <Card>
        <Text style={typography.heading}>{me?.username ?? "—"}</Text>
        <Muted>{me?.roles?.length ? me.roles.join(" · ") : "no roles assigned"}</Muted>
      </Card>

      <Card>
        <Text style={typography.body}>On-site field tool</Text>
        <Muted>
          This app handles site capture: milestones, photo evidence, observations,
          daily reports and signed submissions. The office modules — Finance,
          Store &amp; Procurement, Users, Roles and Settings — are managed on the
          web portal.
        </Muted>
      </Card>

      <Button title={tour.completed ? "Restart Tour" : "Start Tour"} variant="ghost" onPress={() => { tour.resetTour(); setTimeout(() => tour.startTour(), 300); }} />

      <Button title="Sign out" variant="danger" onPress={signOut} />
    </Screen>
  );
}
