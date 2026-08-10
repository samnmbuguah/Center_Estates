import { ErrorBoundary } from "@/components/error-boundary";
import { PropertyWorkspace } from "@/components/property-workspace";

export default function PropertyOnboardingPage() {
  return (
    <ErrorBoundary moduleName="Property onboarding">
      <PropertyWorkspace initialTab="properties" standaloneOnboarding />
    </ErrorBoundary>
  );
}
