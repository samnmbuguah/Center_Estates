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
    if (
      typeof window !== "undefined" &&
      (error.name === "ChunkLoadError" ||
        error.message?.includes("Loading chunk") ||
        error.message?.includes("ChunkLoadError"))
    ) {
      const lastReload = sessionStorage.getItem("ce_chunk_reload_ts");
      const now = Date.now();
      if (!lastReload || now - Number(lastReload) > 10000) {
        sessionStorage.setItem("ce_chunk_reload_ts", String(now));
        window.location.reload();
      }
    }
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      const isChunkError =
        this.state.error?.name === "ChunkLoadError" ||
        this.state.error?.message?.includes("Loading chunk") ||
        this.state.error?.message?.includes("ChunkLoadError");

      return this.props.fallback || (
        <div style={{ 
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", 
          minHeight: 400, padding: 40, textAlign: "center", gap: 16 
        }}>
          <span style={{ fontSize: 48 }}>{isChunkError ? "🔄" : "⚠️"}</span>
          <h2 style={{ color: "var(--text)", margin: 0 }}>
            {isChunkError ? "A new version was deployed" : `${this.props.moduleName || "This page"} encountered an error`}
          </h2>
          <p className="muted" style={{ maxWidth: 480 }}>
            {isChunkError
              ? "New features were deployed to production. Refreshing your session will load the latest version."
              : this.state.error?.message || "An unexpected error occurred."}
          </p>
          <button className="btn primary" onClick={() => {
            this.setState({ hasError: false, error: null });
            window.location.reload();
          }}>
            Reload Page & Update
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
