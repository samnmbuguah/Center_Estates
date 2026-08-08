"use client";

import { ErrorBoundary } from "@/components/error-boundary";
import FacilityWorkspace from "@/components/facility-workspace";

export default function FacilityPage() {
  return (
    <ErrorBoundary moduleName="Facility Management">
      <FacilityWorkspace defaultTab="overview" />
    </ErrorBoundary>
  );
}
