"use client";

import { Box, Button, Chip, CircularProgress, Stack } from "@mui/material";
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";

const Unit3DScene = dynamic(() => import("./Unit3DScene"), {
  ssr: false,
  loading: () => (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 2, height: "100%", minHeight: 280 }}>
      <CircularProgress size={26} />
      <span style={{ fontSize: 13, color: "var(--muted)" }}>Loading 3D viewer…</span>
    </Box>
  ),
});

type Render = {
  id: string;
  render_kind: string;
  title: string;
  caption: string;
  render_url: string;
  is_primary: boolean;
};

export default function Unit3DViewer({
  renders,
  unitCode = "Unit",
  unitType = "Unit",
  area = 0,
  floor = "",
  height = 420,
}: {
  renders?: Render[];
  unitCode?: string;
  unitType?: string;
  area?: number | string;
  floor?: string;
  height?: number;
}) {
  const modelRenders = useMemo(() => (renders ?? []).filter((r) => r.render_kind === "model_3d"), [renders]);
  const imageRenders = useMemo(() => (renders ?? []).filter((r) => r.render_kind !== "model_3d"), [renders]);
  const activeModel = modelRenders[0];
  const fallback = useMemo(() => ({
    unitCode,
    unitType,
    area: Number(area || 0),
    floor: String(floor || "Ground"),
  }), [unitCode, unitType, area, floor]);
  const [activeImage, setActiveImage] = useState<string | null>(imageRenders[0]?.render_url ?? null);

  return (
    <Box sx={{ width: "100%" }}>
      <Box
        sx={{
          position: "relative", width: "100%", height, borderRadius: 3, overflow: "hidden",
          border: "1px solid var(--border)", background: "linear-gradient(135deg, #eef2ff 0%, #f8fafc 60%, #f1f5f9 100%)",
        }}
      >
        <Unit3DScene modelUrl={activeModel?.render_url ?? null} fallback={fallback} />
      </Box>

      <Stack direction="row" spacing={1} sx={{ mt: 1.5, alignItems: "center", flexWrap: "wrap", gap: 1 }}>
        <Chip size="small" label={modelRenders.length ? "3D model loaded" : "Procedural preview"} color={modelRenders.length ? "success" : "info"} />
        {activeModel?.caption && <span style={{ fontSize: 12, color: "var(--muted)" }}>{activeModel.caption}</span>}
        <Box sx={{ flex: 1 }} />
        <Button size="small" variant="text" onClick={() => window.dispatchEvent(new CustomEvent("unit3d:toggle-rotate"))}>Toggle rotate</Button>
        <Button size="small" variant="text" onClick={() => window.dispatchEvent(new CustomEvent("unit3d:reset"))}>Reset view</Button>
      </Stack>

      {imageRenders.length > 0 && (
        <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: "wrap", gap: 1 }}>
          {imageRenders.map((r) => (
            <img
              key={r.id}
              src={r.render_url}
              alt={r.caption || r.title || "Unit rendering"}
              onClick={() => setActiveImage(r.render_url)}
              onError={() => setActiveImage(null)}
              style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8, cursor: "pointer", border: activeImage === r.render_url ? "2px solid #ea580c" : "1px solid var(--border)", background: "#fff" }}
            />
          ))}
          <Box sx={{ flex: 1 }} />
        </Stack>
      )}

      {activeImage && (
        <Box sx={{ mt: 1.5, borderRadius: 2, overflow: "hidden", border: "1px solid var(--border)" }}>
          <img src={activeImage} alt="Unit rendering" style={{ width: "100%", maxHeight: 320, objectFit: "contain", display: "block", background: "#f8fafc" }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
        </Box>
      )}
    </Box>
  );
}
