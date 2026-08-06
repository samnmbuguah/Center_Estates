import { ErrorBoundary } from "@/components/error-boundary";
import { PropertyWorkspace } from "@/components/property-workspace";
import { PropertyContextBar } from "@/components/property-context-bar";

export default function PropertyPage() {
  return (
    <ErrorBoundary moduleName="Property Management">
      <div style={{ padding: "20px 24px 0" }}>
        <PropertyContextBar />
      </div>
      <PropertyWorkspace initialTab="overview" />
    </ErrorBoundary>
  );
}
