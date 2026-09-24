"use client";

import { ErrorBoundary } from "@/components/error-boundary";
import { BimVerificationHub } from "@/components/monitoring/pages/BimVerificationHub";

export default function BimVerificationPage() {
  return (
    <ErrorBoundary moduleName="BIM Verification">
      <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "30px 24px" }}>
        <BimVerificationHub />
      </div>
    </ErrorBoundary>
  );
}
