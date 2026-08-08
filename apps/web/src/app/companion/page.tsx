import { ErrorBoundary } from "@/components/error-boundary";
import { CompanionWorkspace } from "@/components/companion-workspace";

export default function CompanionPage() {
  return (
    <ErrorBoundary moduleName="Companion">
      <CompanionWorkspace initialTab="overview" />
    </ErrorBoundary>
  );
}
