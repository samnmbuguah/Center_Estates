"use client";

import { Suspense } from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import FacilityWorkspace from "@/components/facility-workspace";
import { LoadingState } from "@/components/module-ui";

export default function FacilityPage() {
  return (
    <ErrorBoundary moduleName="Facility Management">
      <Suspense fallback={<LoadingState rows={6} />}>
        <FacilityWorkspace defaultTab="overview" />
      </Suspense>
    </ErrorBoundary>
  );
}

