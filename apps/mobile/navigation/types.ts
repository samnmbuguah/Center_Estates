import type { ProjectRow } from "@monitoring/shared-types";

/** Stack routes + their params. Kept central so screens are type-safe. */
export type RootStackParamList = {
  Login: undefined;
  Projects: undefined;
  ProjectHub: { project?: ProjectRow };
  Milestones: { project: ProjectRow };
  MilestoneDetail: { project: ProjectRow; milestoneEntryId: string };
  Capture: { project: ProjectRow; milestoneEntryId: string };
  AddObservation: { milestoneEntryId: string };
  Reports: { project: ProjectRow };
  DailyLog: { project: ProjectRow };
  BoQProgress: { project: ProjectRow };
  QualityTests: { project: ProjectRow };
  BimModels: { project: ProjectRow };
  DroneDatasets: { project: ProjectRow };
  Tickets: { project: ProjectRow };
};
