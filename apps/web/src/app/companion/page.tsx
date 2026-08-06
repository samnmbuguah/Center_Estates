import { ErrorBoundary } from "@/components/error-boundary";
import { CompanionWorkspace } from "@/components/companion-workspace";
import { PropertyContextBar } from "@/components/property-context-bar";

export default function CompanionPage() {
  return (
    <ErrorBoundary moduleName="Companion">
      <div style={{ padding: "20px 24px 0" }}>
        <PropertyContextBar />
      </div>
      <CompanionWorkspace initialTab="overview" />
    </ErrorBoundary>
  );
}
