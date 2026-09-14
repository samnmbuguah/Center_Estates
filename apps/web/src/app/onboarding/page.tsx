import { Suspense } from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import { ModularOnboardingHub } from "@/components/onboarding/ModularOnboardingHub";

export default function OnboardingPage() {
  return (
    <ErrorBoundary moduleName="Asset onboarding">
      <Suspense fallback={<div style={{ padding: 40, textAlign: "center" }}>Loading onboarding hub...</div>}>
        <ModularOnboardingHub />
      </Suspense>
    </ErrorBoundary>
  );
}
