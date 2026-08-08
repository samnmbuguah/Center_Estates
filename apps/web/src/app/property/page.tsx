import { ErrorBoundary } from "@/components/error-boundary";
import { PropertyWorkspace } from "@/components/property-workspace";

export default function PropertyPage() {
  return (
    <ErrorBoundary moduleName="Property Management">
      <PropertyWorkspace initialTab="overview" />
    </ErrorBoundary>
  );
}
