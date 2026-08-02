"use client";

import { useEffect, useRef, useState } from "react";

export interface BimElement {
  id: string;
  guid: string;
  name: string;
  type: string;
  discipline: string;
  status: "verified" | "pending" | "discrepancy";
  boqItem?: {
    itemNumber: string;
    description: string;
    unit: string;
    rate: number;
    plannedQty: number;
    executedQty: number;
  };
}

interface BimViewerProps {
  modelName: string;
  elements?: BimElement[];
  onSelectElement?: (element: BimElement | null) => void;
}

const DEFAULT_ELEMENTS: BimElement[] = [
  {
    id: "elem-1",
    guid: "3m7A29xL0901wPq_1",
    name: "Foundation Slab - Grid A1-D4",
    type: "IfcSlab",
    discipline: "Structural",
    status: "verified",
    boqItem: { itemNumber: "1.1.2", description: "C35/45 Reinforced Concrete Foundation", unit: "m³", rate: 18500, plannedQty: 420, executedQty: 420 },
  },
  {
    id: "elem-2",
    guid: "2k8B18yM1822xQr_2",
    name: "RC Columns Level 1 (Col C1-C12)",
    type: "IfcColumn",
    discipline: "Structural",
    status: "verified",
    boqItem: { itemNumber: "1.2.1", description: "Class 1 High-Yield Reinforced Concrete Columns", unit: "m³", rate: 24000, plannedQty: 180, executedQty: 165 },
  },
  {
    id: "elem-3",
    guid: "4p9C30zN2733ySt_3",
    name: "External Masonry Cavity Walls L1",
    type: "IfcWall",
    discipline: "Architectural",
    status: "pending",
    boqItem: { itemNumber: "2.1.4", description: "200mm Machine Cut Quarry Stone Masonry", unit: "m²", rate: 3200, plannedQty: 1250, executedQty: 840 },
  },
  {
    id: "elem-4",
    guid: "1x5D12aO3644zTu_4",
    name: "HVAC Main Ducting Trunk Level 2",
    type: "IfcDuctSegment",
    discipline: "MEP",
    status: "discrepancy",
    boqItem: { itemNumber: "4.3.1", description: "Galvanised Sheet Steel Ductwork 600x400", unit: "m", rate: 8500, plannedQty: 340, executedQty: 110 },
  },
];

export function BimViewer({ modelName, elements = DEFAULT_ELEMENTS, onSelectElement }: BimViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selected, setSelected] = useState<BimElement | null>(elements[0] || null);
  const [filterDiscipline, setFilterDiscipline] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"shaded" | "wireframe" | "progress">("progress");
  const [rotation, setRotation] = useState({ x: 25, y: -45 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const filteredElements = elements.filter(
    (item) => filterDiscipline === "all" || item.discipline.toLowerCase() === filterDiscipline.toLowerCase()
  );

  // HTML5 WebGL / 3D Canvas Renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Background grid / gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
      bgGrad.addColorStop(0, "#0f172a");
      bgGrad.addColorStop(1, "#1e293b");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Floor grid floor
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1;
      const gridCenterY = h * 0.65;
      for (let i = -10; i <= 10; i++) {
        const xOffset = i * 25 * zoom;
        ctx.beginPath();
        ctx.moveTo(w / 2 + xOffset - 150 * zoom, gridCenterY + 80 * zoom);
        ctx.moveTo(w / 2 + xOffset + 150 * zoom, gridCenterY - 80 * zoom);
        ctx.stroke();
      }

      // Render 3D isometric structural boxes for elements
      const cx = w / 2;
      const cy = h / 2;
      const radX = (rotation.x * Math.PI) / 180;
      const radY = (rotation.y * Math.PI) / 180;

      filteredElements.forEach((elem, idx) => {
        const isSel = selected?.id === elem.id;
        const executedPct = elem.boqItem ? (elem.boqItem.executedQty / elem.boqItem.plannedQty) : 0.5;

        // Position offsets
        const posX = (idx - 1.5) * 80 * zoom;
        const posY = (idx % 2 === 0 ? -30 : 20) * zoom;
        const posZ = (idx * 20) * zoom;

        // Isometric projection
        const projX = cx + (posX * Math.cos(radY) - posZ * Math.sin(radY));
        const projY = cy + (posX * Math.sin(radY) * Math.sin(radX) + posY * Math.cos(radX) + posZ * Math.cos(radY) * Math.sin(radX));
        const sizeX = 55 * zoom;
        const sizeY = 70 * zoom;

        // Colors
        let color = "#3b82f6";
        if (viewMode === "progress") {
          color = elem.status === "verified" ? "#22c55e" : elem.status === "pending" ? "#eab308" : "#ef4444";
        } else if (elem.discipline === "Structural") color = "#6366f1";
        else if (elem.discipline === "MEP") color = "#06b6d4";

        ctx.save();
        ctx.translate(projX, projY);

        if (viewMode === "wireframe") {
          ctx.strokeStyle = isSel ? "#fbbf24" : color;
          ctx.lineWidth = isSel ? 3 : 1.5;
          ctx.strokeRect(-sizeX / 2, -sizeY / 2, sizeX, sizeY);
        } else {
          // Shaded 3D Box Top & Front Faces
          ctx.fillStyle = color;
          ctx.globalAlpha = isSel ? 0.95 : 0.75;
          ctx.fillRect(-sizeX / 2, -sizeY / 2, sizeX, sizeY);

          // Executed Progress Fill overlay
          if (viewMode === "progress") {
            ctx.fillStyle = "#ffffff";
            ctx.globalAlpha = 0.35;
            ctx.fillRect(-sizeX / 2, sizeY / 2 - sizeY * executedPct, sizeX, sizeY * executedPct);
          }

          // Highlight Border
          if (isSel) {
            ctx.strokeStyle = "#fbbf24";
            ctx.lineWidth = 3;
            ctx.globalAlpha = 1;
            ctx.strokeRect(-sizeX / 2 - 2, -sizeY / 2 - 2, sizeX + 4, sizeY + 4);
          }
        }

        // Element Label
        ctx.globalAlpha = 1;
        ctx.font = "bold 11px Inter, sans-serif";
        ctx.fillStyle = isSel ? "#fbbf24" : "#ffffff";
        ctx.textAlign = "center";
        ctx.fillText(elem.name.split(" ")[0], 0, -sizeY / 2 - 8);

        ctx.restore();
      });

      // Overlay watermark & camera meta
      ctx.fillStyle = "#94a3b8";
      ctx.font = "12px monospace";
      ctx.textAlign = "left";
      ctx.fillText(`Model: ${modelName} | Pitch: ${rotation.x.toFixed(0)}° Yaw: ${rotation.y.toFixed(0)}° | Zoom: ${(zoom * 100).toFixed(0)}%`, 16, h - 16);
    };

    render();
  }, [modelName, filteredElements, selected, viewMode, rotation, zoom]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setRotation((prev) => ({ x: Math.max(-80, Math.min(80, prev.x + dy * 0.5)), y: prev.y + dx * 0.5 }));
    dragStart.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => setIsDragging(false);

  return (
    <div className="bim-container" style={{ background: "#0f172a", borderRadius: 12, padding: 16, color: "#f8fafc" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1.1rem", display: "flex", alignItems: "center", gap: 8 }}>
            <span>🏢 3D BIM Model Viewer</span>
            <span style={{ fontSize: "0.75rem", background: "#1e293b", padding: "2px 8px", borderRadius: 12, color: "#cbd5e1" }}>IFC 4.0</span>
          </h3>
          <small style={{ color: "#94a3b8" }}>{modelName} — Interactive WebGL & BoQ material inspector</small>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select
            value={filterDiscipline}
            onChange={(e) => setFilterDiscipline(e.target.value)}
            style={{ background: "#1e293b", color: "#f8fafc", border: "1px solid #334155", padding: "6px 12px", borderRadius: 6 }}
          >
            <option value="all">All Disciplines</option>
            <option value="Structural">Structural</option>
            <option value="Architectural">Architectural</option>
            <option value="MEP">MEP Services</option>
          </select>

          <div style={{ display: "flex", background: "#1e293b", borderRadius: 6, padding: 2, border: "1px solid #334155" }}>
            {(["progress", "shaded", "wireframe"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  background: viewMode === mode ? "#3b82f6" : "transparent",
                  color: "#ffffff",
                  border: "none",
                  padding: "4px 10px",
                  borderRadius: 4,
                  fontSize: "0.8rem",
                  cursor: "pointer",
                  textTransform: "capitalize",
                }}
              >
                {mode}
              </button>
            ))}
          </div>

          <button
            onClick={() => { setRotation({ x: 25, y: -45 }); setZoom(1); }}
            style={{ background: "#334155", color: "#f8fafc", border: "none", padding: "6px 12px", borderRadius: 6, cursor: "pointer" }}
          >
            Reset View
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16 }}>
        {/* 3D Canvas Viewport */}
        <div style={{ position: "relative", borderRadius: 8, overflow: "hidden", border: "1px solid #334155" }}>
          <canvas
            ref={canvasRef}
            width={720}
            height={440}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ width: "100%", height: "440px", display: "block", cursor: isDragging ? "grabbing" : "grab" }}
          />

          <div style={{ position: "absolute", bottom: 16, right: 16, display: "flex", gap: 4 }}>
            <button onClick={() => setZoom((z) => Math.min(2, z + 0.15))} style={{ width: 32, height: 32, background: "#1e293b", color: "#fff", border: "1px solid #334155", borderRadius: 4, cursor: "pointer" }}>+</button>
            <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.15))} style={{ width: 32, height: 32, background: "#1e293b", color: "#fff", border: "1px solid #334155", borderRadius: 4, cursor: "pointer" }}>-</button>
          </div>
        </div>

        {/* Selected Element & BoQ Breakdown Panel */}
        <div style={{ background: "#1e293b", borderRadius: 8, padding: 14, border: "1px solid #334155", overflowY: "auto", maxHeight: 440 }}>
          <h4 style={{ margin: "0 0 10px 0", fontSize: "0.95rem", color: "#fbbf24" }}>Element Details & BoQ Link</h4>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Select Model Element</label>
            <select
              value={selected?.id ?? ""}
              onChange={(e) => {
                const found = elements.find((x) => x.id === e.target.value) || null;
                setSelected(found);
                onSelectElement?.(found);
              }}
              style={{ width: "100%", background: "#0f172a", color: "#fff", border: "1px solid #334155", padding: 8, borderRadius: 6, marginTop: 4 }}
            >
              {filteredElements.map((el) => (
                <option key={el.id} value={el.id}>
                  {el.name} ({el.discipline})
                </option>
              ))}
            </select>
          </div>

          {selected ? (
            <div>
              <div style={{ background: "#0f172a", padding: 10, borderRadius: 6, marginBottom: 10, fontSize: "0.85rem" }}>
                <div><span style={{ color: "#94a3b8" }}>IFC GUID:</span> <code style={{ color: "#38bdf8" }}>{selected.guid}</code></div>
                <div><span style={{ color: "#94a3b8" }}>Type:</span> <strong>{selected.type}</strong></div>
                <div><span style={{ color: "#94a3b8" }}>Discipline:</span> <strong>{selected.discipline}</strong></div>
                <div style={{ marginTop: 6 }}>
                  <span style={{
                    padding: "2px 8px", borderRadius: 4, fontSize: "0.75rem", fontWeight: "bold",
                    background: selected.status === "verified" ? "#166534" : selected.status === "pending" ? "#854d0e" : "#991b1b",
                    color: selected.status === "verified" ? "#4ade80" : selected.status === "pending" ? "#fde047" : "#fca5a5"
                  }}>
                    {selected.status.toUpperCase()}
                  </span>
                </div>
              </div>

              {selected.boqItem ? (
                <div style={{ background: "#0f172a", padding: 10, borderRadius: 6, fontSize: "0.85rem", borderLeft: "3px solid #3b82f6" }}>
                  <strong style={{ color: "#60a5fa", display: "block", marginBottom: 4 }}>Linked BoQ Item #{selected.boqItem.itemNumber}</strong>
                  <p style={{ margin: "0 0 6px 0", color: "#cbd5e1" }}>{selected.boqItem.description}</p>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, margin: "8px 0" }}>
                    <div><small style={{ color: "#94a3b8" }}>Planned Qty:</small><br /><strong>{selected.boqItem.plannedQty} {selected.boqItem.unit}</strong></div>
                    <div><small style={{ color: "#94a3b8" }}>Executed Qty:</small><br /><strong style={{ color: "#4ade80" }}>{selected.boqItem.executedQty} {selected.boqItem.unit}</strong></div>
                    <div><small style={{ color: "#94a3b8" }}>Rate:</small><br /><strong>KES {selected.boqItem.rate.toLocaleString()}</strong></div>
                    <div><small style={{ color: "#94a3b8" }}>Executed Value:</small><br /><strong style={{ color: "#fbbf24" }}>KES {(selected.boqItem.executedQty * selected.boqItem.rate).toLocaleString()}</strong></div>
                  </div>

                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginBottom: 2 }}>
                      <span>Physical Completion</span>
                      <span>{((selected.boqItem.executedQty / selected.boqItem.plannedQty) * 100).toFixed(1)}%</span>
                    </div>
                    <div style={{ width: "100%", height: 6, background: "#334155", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ width: `${Math.min(100, (selected.boqItem.executedQty / selected.boqItem.plannedQty) * 100)}%`, height: "100%", background: "#22c55e" }} />
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ color: "#94a3b8", fontStyle: "italic", fontSize: "0.85rem" }}>No direct BoQ link mapped to this IFC element.</div>
              )}
            </div>
          ) : (
            <div style={{ color: "#94a3b8", fontSize: "0.85rem" }}>Click or select an element to view details.</div>
          )}
        </div>
      </div>
    </div>
  );
}
