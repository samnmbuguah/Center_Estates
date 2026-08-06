"use client";

import { useEffect, useRef, useState } from "react";
import { PlayCircle } from "lucide-react";
import { createTour, listTours, getTour } from "@/lib/tours/tourService";
import "@/lib/tours";

export function TourLauncher() {
  const [open, setOpen] = useState(false);
  const [activeTourId, setActiveTourId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onPointer);
    return () => window.removeEventListener("mousedown", onPointer);
  }, [open]);

  function start(id: string) {
    setOpen(false);
    const def = getTour(id);
    if (!def) return;
    const active = [...listTours()].find((t) => t.id === id);
    if (!active) return;
    setActiveTourId(id);
    const tour = createTour(def);
    tour.start();
  }

  const tours = listTours();

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        data-testid="tour-launcher-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 12px",
          borderRadius: 8,
          background: activeTourId ? "rgba(229,46,46,0.12)" : "var(--surface-2)",
          border: `1px solid ${activeTourId ? "rgba(229,46,46,0.3)" : "var(--border)"}`,
          color: activeTourId ? "#e52e2e" : "var(--text)",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
        }}
        title="Start a guided demo tour"
      >
        <PlayCircle size={14} style={{ color: activeTourId ? "#e52e2e" : "var(--primary)" }} />
        Demo Tour
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 260,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            boxShadow: "0 12px 30px rgba(0,0,0,0.2)",
            padding: 6,
            zIndex: 200,
          }}
        >
          <div style={{ padding: "8px 12px", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)" }}>
            Guided Demo Tours
          </div>
          {tours.length === 0 ? (
            <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--muted)" }}>No tours registered.</div>
          ) : (
            tours.map((tour) => (
              <button
                key={tour.id}
                type="button"
                data-testid={`tour-${tour.id}`}
                onClick={() => start(tour.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 8,
                  background: "none",
                  border: 0,
                  color: "var(--text)",
                  fontSize: 13,
                  textAlign: "left",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-2)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <PlayCircle size={15} style={{ color: "var(--primary)", flexShrink: 0 }} />
                {tour.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
