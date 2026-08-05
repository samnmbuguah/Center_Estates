import { ErrorBoundary } from "@/components/error-boundary";
import { SalesWorkspace } from "@/components/sales-workspace";

export default function SalesPage() {
  return (
    <ErrorBoundary moduleName="Sales">
      <SalesWorkspace initialTab="overview" />
    </ErrorBoundary>
  );
}
