"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { reportClientError } from "@/components/monitoring/lib/reportError";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    reportClientError({
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack ?? undefined,
      extra: { source: "ErrorBoundary" },
    });
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div style={{
            padding: "20px",
            textAlign: "center",
            backgroundColor: "#fee2e2",
            border: "1px solid #ef4444",
            borderRadius: "8px",
            margin: "20px"
          }}>
            <h2 style={{ color: "#dc2626", marginTop: 0 }}>Something went wrong</h2>
            <p style={{ color: "#991b1b" }}>
              {this.state.error?.message || "An unexpected error occurred"}
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: "8px 16px",
                backgroundColor: "#dc2626",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                marginTop: "10px"
              }}
            >
              Reload Page
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WithErrorBoundaryWrapper(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}
