"use client";

import { useEffect } from "react";

export default function ChunkErrorRecovery() {
  useEffect(() => {
    const handleChunkError = (event: ErrorEvent | PromiseRejectionEvent) => {
      const msg = event instanceof ErrorEvent ? event.message : String(event.reason);
      if (
        msg.includes("ChunkLoadError") ||
        msg.includes("Loading chunk") ||
        msg.includes("Script error")
      ) {
        const lastReload = sessionStorage.getItem("ce_chunk_reload_ts");
        const now = Date.now();
        if (!lastReload || now - Number(lastReload) > 10000) {
          sessionStorage.setItem("ce_chunk_reload_ts", String(now));
          window.location.reload();
        }
      }
    };

    window.addEventListener("error", handleChunkError);
    window.addEventListener("unhandledrejection", handleChunkError);
    return () => {
      window.removeEventListener("error", handleChunkError);
      window.removeEventListener("unhandledrejection", handleChunkError);
    };
  }, []);

  return null;
}
