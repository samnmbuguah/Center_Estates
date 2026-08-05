"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  moduleName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div style={{ 
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", 
          minHeight: 400, padding: 40, textAlign: "center", gap: 16 
        }}>
          <span style={{ fontSize: 48 }}>⚠️</span>
          <h2 style={{ color: "var(--text)", margin: 0 }}>
            {this.props.moduleName || "This page"} encountered an error
          </h2>
          <p className="muted" style={{ maxWidth: 480 }}>
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <button className="btn primary" onClick={() => {
            this.setState({ hasError: false, error: null });
            window.location.reload();
          }}>
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
