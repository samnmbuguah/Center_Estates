import { ErrorBoundary } from "@/components/error-boundary";
import { PropertyOnboardingForm } from "@/components/property-onboarding-form";

export default function PropertyOnboardingPage() {
  return (
    <ErrorBoundary moduleName="Property onboarding">
      <PropertyOnboardingForm />
    </ErrorBoundary>
  );
}
