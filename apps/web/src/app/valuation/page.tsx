import { ErrorBoundary } from "@/components/error-boundary";
import { ValuationWorkspace } from "@/components/valuation-workspace";

export default function ValuationPage() {
  return (
    <ErrorBoundary moduleName="Valuation">
      <ValuationWorkspace initialTab="overview" />
    </ErrorBoundary>
  );
}
