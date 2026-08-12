import { Suspense } from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import { PropertyOnboardingForm } from "@/components/property-onboarding-form";

export default function PropertyOnboardingPage() {
  return (
    <ErrorBoundary moduleName="Property onboarding">
      <Suspense fallback={<div style={{ padding: 40, textAlign: "center" }}>Loading property form...</div>}>
        <PropertyOnboardingForm />
      </Suspense>
    </ErrorBoundary>
  );
}
