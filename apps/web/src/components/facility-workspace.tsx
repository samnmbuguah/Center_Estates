"use client";

import { FacilityFeaturePage } from "@/features/facility/FacilityFeaturePage";
import { FacilityTab } from "@/features/facility/types/facility.types";

export function FacilityWorkspace({ defaultTab = "overview" }: { defaultTab?: FacilityTab }) {
  return <FacilityFeaturePage defaultTab={defaultTab} />;
}

export default FacilityWorkspace;
export { FacilityFeaturePage };
