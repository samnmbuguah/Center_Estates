"use client";

import { useEffect } from "react";
import { installGlobalErrorHandlers } from "@/components/monitoring/lib/reportError";

export default function ErrorMonitoring() {
  useEffect(() => {
    installGlobalErrorHandlers();
  }, []);
  return null;
}
