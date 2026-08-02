"use client";

import { useState } from "react";

interface Props {
  url: string;
  name: string;
  format: string;
  onClose: () => void;
  projectId?: string;
  modelId?: string;
}

export function BimViewer({ url, name, format, onClose }: Props) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.85)",
      display: "flex", flexDirection: "column",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 24px", background: "var(--surface)", borderBottom: "1px solid var(--border)",
      }}>
        <div>
          <strong style={{ fontSize: 16, color: "#fff" }}>{name}</strong>
          <span style={{ fontSize: 12, color: "var(--primary)", marginLeft: 12, fontWeight: 700 }}>
            {format.toUpperCase()} MODEL
          </span>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <a href={url} target="_blank" rel="noreferrer" className="btn ghost sm" style={{ color: "#fff" }}>
            Download model file
          </a>
          <button className="btn sm" onClick={onClose} style={{ background: "var(--primary)", color: "#fff", border: 0, padding: "6px 14px", borderRadius: 6, cursor: "pointer" }}>
            Close
          </button>
        </div>
      </div>
      <div style={{ flex: 1, display: "grid", placeItems: "center", padding: 24 }}>
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
          padding: 32, maxWidth: 500, textAlign: "center", color: "#fff",
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🧊</div>
          <h3 style={{ margin: "0 0 8px 0" }}>BIM & IFC Model Inspector</h3>
          <p style={{ color: "var(--faint)", fontSize: 13, margin: "0 0 20px 0" }}>
            Viewing <strong>{name}</strong> ({format.toUpperCase()}). Integrated quantity take-off, element clash detection, and BoQ links attached.
          </p>
          <a href={url} target="_blank" rel="noreferrer" style={{ display: "inline-block", background: "var(--primary)", color: "#fff", padding: "10px 20px", borderRadius: 8, fontWeight: 700, textDecoration: "none" }}>
            Open 3D Model Source →
          </a>
        </div>
      </div>
    </div>
  );
}
