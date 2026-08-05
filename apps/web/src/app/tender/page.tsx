import { ErrorBoundary } from "@/components/error-boundary";
import { TenderWorkspace } from "@/components/tender-workspace";

export default function TenderPage() {
  return (
    <ErrorBoundary moduleName="Tender Management">
      <TenderWorkspace initialTab="overview" />
    </ErrorBoundary>
  );
}
