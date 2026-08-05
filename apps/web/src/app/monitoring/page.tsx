"use client";

import { ErrorBoundary } from "@/components/error-boundary";
import MonitoringWorkspace from "@/components/monitoring-workspace";

export default function MonitoringPage() {
  return (
    <ErrorBoundary moduleName="Monitoring">
      <MonitoringWorkspace />
    </ErrorBoundary>
  );
}
