"use client";

import { ErrorBoundary } from "@/components/error-boundary";
import FacilityWorkspace from "@/components/facility-workspace";
import { PropertyContextBar } from "@/components/property-context-bar";

export default function FacilityPage() {
  return (
    <ErrorBoundary moduleName="Facility Management">
      <div style={{ padding: "20px 24px 0" }}>
        <PropertyContextBar />
      </div>
      <FacilityWorkspace defaultTab="overview" />
    </ErrorBoundary>
  );
}
