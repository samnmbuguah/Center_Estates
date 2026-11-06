import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { Text } from "react-native";
import type { ProjectRow } from "@monitoring/shared-types";

import { fetchProjects } from "../api/client";
import type { RootStackParamList } from "../navigation/types";
import { Button, Card, Muted, Screen, Title } from "../ui/components";
import { typography } from "../theme/theme";

type Props = NativeStackScreenProps<RootStackParamList, "Projects">;

export function ProjectsScreen({ navigation }: Props) {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const allProjects = await fetchProjects();
      // Filter strictly for active construction projects (exclude sales/property stubs)
      const constructionOnly = allProjects.filter(
        (p) => p.onboarding_complete !== false && (p.modules?.length ?? 0) > 0,
      );
      setProjects(constructionOnly);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <Screen>
      <Title>Projects</Title>
      {error ? <Muted>{error}</Muted> : null}
      {!loading && projects.length === 0 ? <Muted>No projects assigned.</Muted> : null}
      {projects.map((p) => (
        <Card key={p.id} onPress={() => navigation.navigate("ProjectHub", { project: p })}>
          <Text style={typography.heading}>{p.name}</Text>
          <Muted>
            {p.geofence_radius_m != null
              ? `Geofenced site · ${p.geofence_radius_m} m radius`
              : "No site geofence set"}
          </Muted>
        </Card>
      ))}
      <Button title={loading ? "Loading…" : "Refresh"} variant="ghost" onPress={load} />
    </Screen>
  );
}
