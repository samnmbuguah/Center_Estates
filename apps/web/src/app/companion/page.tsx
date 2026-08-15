import { Suspense } from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import { CompanionWorkspace } from "@/components/companion-workspace";

export default function CompanionPage() {
  return (
    <ErrorBoundary moduleName="Companion">
      <Suspense fallback={<div className="page-wrap" style={{ padding: 24 }}>Loading Companion…</div>}>
        <CompanionWorkspace initialTab="overview" />
      </Suspense>
    </ErrorBoundary>
  );
}
