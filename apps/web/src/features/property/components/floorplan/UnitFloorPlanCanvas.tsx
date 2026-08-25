"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Box, Button, Chip, IconButton, MenuItem, Paper, Select,
  Tooltip, Typography, Alert,
} from "@mui/material";
import {
  ZoomIn, ZoomOut, RotateCcw, Edit3, Trash2, Check,
  Square, Building2,
} from "lucide-react";

export type Point = { x: number; y: number }; // Normalized 0.0 to 1.0

export type UnitLayout = {
  id: string;
  code: string;
  unit_type?: string;
  floor?: string;
  area?: string | number | null;
  status: "available" | "occupied" | "reserved" | "sold" | "unavailable" | string;
  tenant_name?: string;
  monthly_rent?: string | number;
  lease_end?: string;
  meter_code?: string;
  polygon?: Point[];
};

export type FloorPlanData = {
  id?: string;
  title: string;
  floor: string;
  image_url?: string;
  units: UnitLayout[];
};

interface UnitFloorPlanCanvasProps {
  floorPlan: FloorPlanData;
  availableUnits?: { id: string; code: string; status: string; area?: string | number | null; tenant_name?: string }[];
  readOnly?: boolean;
  onSaveUnitPolygon?: (unitId: string, polygon: Point[]) => Promise<void> | void;
  onSelectUnit?: (unit: UnitLayout) => void;
  height?: number | string;
}

export function UnitFloorPlanCanvas({
  floorPlan,
  availableUnits = [],
  readOnly = false,
  onSaveUnitPolygon,
  onSelectUnit,
  height = 550,
}: UnitFloorPlanCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // View state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });

  // Drawing state
  const [mode, setMode] = useState<"view" | "draw-polygon" | "draw-box">("view");
  const [drawingPoints, setDrawingPoints] = useState<Point[]>([]);
  const [boxStart, setBoxStart] = useState<Point | null>(null);
  const [selectedUnitForDraw, setSelectedUnitForDraw] = useState<string>("");
  const [selectedUnit, setSelectedUnit] = useState<UnitLayout | null>(null);
  const [hoveredUnit, setHoveredUnit] = useState<UnitLayout | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  // Local state for unit outlines
  const [unitsData, setUnitsData] = useState<UnitLayout[]>(floorPlan.units || []);

  useEffect(() => {
    setUnitsData(floorPlan.units || []);
  }, [floorPlan.units]);

  // Convert client pixel to normalized coordinate (0..1)
  const getNormalizedPoint = useCallback((clientX: number, clientY: number): Point | null => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    return { x: Number(x.toFixed(4)), y: Number(y.toFixed(4)) };
  }, []);

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (mode === "view" || e.button === 1 || e.altKey) {
      setIsPanning(true);
      setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPanning) {
      setPan({ x: e.clientX - startPan.x, y: e.clientY - startPan.y });
      return;
    }

    const norm = getNormalizedPoint(e.clientX, e.clientY);
    if (norm) setMousePos(norm);
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // SVG Click Handler for Drawing Mode
  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isPanning) return;
    const pt = getNormalizedPoint(e.clientX, e.clientY);
    if (!pt) return;

    if (mode === "draw-polygon") {
      if (drawingPoints.length > 2) {
        const first = drawingPoints[0];
        const dist = Math.hypot(pt.x - first.x, pt.y - first.y);
        if (dist < 0.03) {
          finishPolygon();
          return;
        }
      }
      setDrawingPoints((prev) => [...prev, pt]);
    } else if (mode === "draw-box") {
      if (!boxStart) {
        setBoxStart(pt);
      } else {
        const poly: Point[] = [
          { x: Math.min(boxStart.x, pt.x), y: Math.min(boxStart.y, pt.y) },
          { x: Math.max(boxStart.x, pt.x), y: Math.min(boxStart.y, pt.y) },
          { x: Math.max(boxStart.x, pt.x), y: Math.max(boxStart.y, pt.y) },
          { x: Math.min(boxStart.x, pt.x), y: Math.max(boxStart.y, pt.y) },
        ];
        saveDrawnOutline(poly);
        setBoxStart(null);
      }
    }
  };

  const finishPolygon = () => {
    if (drawingPoints.length >= 3) {
      saveDrawnOutline(drawingPoints);
    }
    setDrawingPoints([]);
  };

  const saveDrawnOutline = async (polygon: Point[]) => {
    if (!selectedUnitForDraw) {
      alert("Please select a unit code to assign this drawing outline.");
      return;
    }

    const unitObj = availableUnits.find((u) => u.id === selectedUnitForDraw || u.code === selectedUnitForDraw);
    const updatedUnits = unitsData.filter((u) => u.code !== (unitObj?.code || selectedUnitForDraw));
    const newUnitLayout: UnitLayout = {
      id: unitObj?.id || selectedUnitForDraw,
      code: unitObj?.code || selectedUnitForDraw,
      status: (unitObj?.status as any) || "available",
      area: unitObj?.area,
      tenant_name: unitObj?.tenant_name,
      polygon,
    };
    updatedUnits.push(newUnitLayout);
    setUnitsData(updatedUnits);

    if (onSaveUnitPolygon) {
      await onSaveUnitPolygon(unitObj?.id || selectedUnitForDraw, polygon);
    }

    setMode("view");
    setDrawingPoints([]);
    setBoxStart(null);
  };

  const deleteUnitPolygon = async (unitCode: string) => {
    const unitObj = unitsData.find((u) => u.code === unitCode);
    const updated = unitsData.map((u) => (u.code === unitCode ? { ...u, polygon: undefined } : u));
    setUnitsData(updated);
    if (unitObj && onSaveUnitPolygon) {
      await onSaveUnitPolygon(unitObj.id, []);
    }
    setSelectedUnit(null);
  };

  // Color helper based on occupancy status
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "occupied":
        return { fill: "rgba(37, 99, 235, 0.45)", stroke: "#2563eb", badge: "#1d4ed8", bg: "#dbeafe" };
      case "available":
        return { fill: "rgba(22, 163, 74, 0.45)", stroke: "#16a34a", badge: "#15803d", bg: "#dcfce7" };
      case "reserved":
        return { fill: "rgba(217, 119, 6, 0.45)", stroke: "#d97706", badge: "#b45309", bg: "#fef3c7" };
      case "sold":
        return { fill: "rgba(147, 51, 234, 0.45)", stroke: "#9333ea", badge: "#7e22ce", bg: "#f3e8ff" };
      default:
        return { fill: "rgba(100, 116, 139, 0.35)", stroke: "#64748b", badge: "#475569", bg: "#f1f5f9" };
    }
  };

  // Calculate polygon centroid for label positioning
  const getCentroid = (points: Point[]) => {
    if (!points || points.length === 0) return { x: 0.5, y: 0.5 };
    const sumX = points.reduce((s, p) => s + p.x, 0);
    const sumY = points.reduce((s, p) => s + p.y, 0);
    return { x: sumX / points.length, y: sumY / points.length };
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 3,
        overflow: "hidden",
        position: "relative",
        background: "var(--surface)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Top Toolbar */}
      <Box
        sx={{
          p: 1.5,
          borderBottom: "1px solid var(--border)",
          background: "var(--surface-sunken, #f8fafc)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 1.5,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 0.75 }}>
            <Building2 size={16} /> {floorPlan.title || "Floor Layout"} — Level {floorPlan.floor}
          </Typography>
          <Chip
            size="small"
            label={`${unitsData.filter((u) => u.polygon && u.polygon.length > 0).length} mapped units`}
            sx={{ fontWeight: 700, fontSize: 11 }}
          />
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {/* Status Legend */}
          <Box sx={{ display: { xs: "none", md: "flex" }, alignItems: "center", gap: 1.5, mr: 1 }}>
            {[
              { label: "Available", color: "#16a34a" },
              { label: "Occupied", color: "#2563eb" },
              { label: "Reserved", color: "#d97706" },
            ].map((st) => (
              <Box key={st.label} sx={{ display: "flex", alignItems: "center", gap: 0.5, fontSize: 11, fontWeight: 700 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: "50%", background: st.color }} />
                <span>{st.label}</span>
              </Box>
            ))}
          </Box>

          {/* Zoom controls */}
          <Tooltip title="Zoom In">
            <IconButton size="small" onClick={() => setZoom((z) => Math.min(3, z + 0.2))}>
              <ZoomIn size={16} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Zoom Out">
            <IconButton size="small" onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))}>
              <ZoomOut size={16} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Reset View">
            <IconButton size="small" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>
              <RotateCcw size={16} />
            </IconButton>
          </Tooltip>

          {/* Draw / Edit Outline Mode Toggle */}
          {!readOnly && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, ml: 1, pl: 1, borderLeft: "1px solid var(--border)" }}>
              {mode === "view" ? (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<Edit3 size={14} />}
                  onClick={() => setMode("draw-polygon")}
                  sx={{ fontWeight: 700, fontSize: 12 }}
                >
                  Draw Unit Outline
                </Button>
              ) : (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Select
                    size="small"
                    value={selectedUnitForDraw}
                    onChange={(e) => setSelectedUnitForDraw(String(e.target.value))}
                    displayEmpty
                    sx={{ minWidth: 160, fontSize: 12, height: 32 }}
                  >
                    <MenuItem value="" disabled>Select Unit to Outline</MenuItem>
                    {availableUnits.map((u) => (
                      <MenuItem key={u.id} value={u.code}>
                        {u.code} {u.tenant_name ? `(${u.tenant_name})` : ""}
                      </MenuItem>
                    ))}
                  </Select>

                  <Tooltip title="Draw Freeform Boundary">
                    <IconButton
                      size="small"
                      color={mode === "draw-polygon" ? "primary" : "default"}
                      onClick={() => setMode("draw-polygon")}
                    >
                      <Edit3 size={16} />
                    </IconButton>
                  </Tooltip>

                  <Tooltip title="Rectangle Box Tool">
                    <IconButton
                      size="small"
                      color={mode === "draw-box" ? "primary" : "default"}
                      onClick={() => { setMode("draw-box"); setBoxStart(null); }}
                    >
                      <Square size={16} />
                    </IconButton>
                  </Tooltip>

                  {mode === "draw-polygon" && drawingPoints.length >= 3 && (
                    <Button size="small" variant="contained" color="success" startIcon={<Check size={14} />} onClick={finishPolygon}>
                      Complete
                    </Button>
                  )}

                  <Button size="small" variant="outlined" onClick={() => { setMode("view"); setDrawingPoints([]); setBoxStart(null); }}>
                    Cancel
                  </Button>
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Box>

      {/* Helper Banner for Drawing Mode */}
      {mode !== "view" && (
        <Alert severity="info" sx={{ py: 0.5, borderRadius: 0 }}>
          {mode === "draw-polygon"
            ? "Click on the floor plan to place unit boundary corners. Double click or click the first dot to seal the outline."
            : "Click top-left corner, then click bottom-right corner to map a rectangular unit space."}
        </Alert>
      )}

      {/* Main Canvas Area */}
      <Box
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        sx={{
          height,
          position: "relative",
          overflow: "hidden",
          background: "radial-gradient(#e2e8f0 1px, transparent 1px)",
          backgroundSize: "20px 20px",
          cursor: isPanning ? "grabbing" : mode !== "view" ? "crosshair" : "grab",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Box
          sx={{
            width: "100%",
            height: "100%",
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center center",
            transition: isPanning ? "none" : "transform 0.1s ease-out",
            position: "relative",
          }}
        >
          {/* Background Floor Plan Image */}
          {floorPlan.image_url ? (
            <img
              src={floorPlan.image_url}
              alt={floorPlan.title}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                userSelect: "none",
                pointerEvents: "none",
              }}
            />
          ) : (
            <Box
              sx={{
                width: "100%",
                height: "100%",
                border: "2px dashed #cbd5e1",
                borderRadius: 2,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#94a3b8",
              }}
            >
              <Typography variant="body2">Architectural floor plan canvas grid</Typography>
            </Box>
          )}

          {/* Interactive SVG Overlay */}
          <svg
            ref={svgRef}
            onClick={handleSvgClick}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              overflow: "visible",
            }}
            viewBox="0 0 1000 1000"
            preserveAspectRatio="none"
          >
            {/* Render Saved Unit Polygons */}
            {unitsData.map((unit) => {
              if (!unit.polygon || unit.polygon.length < 3) return null;
              const pointsStr = unit.polygon.map((p) => `${p.x * 1000},${p.y * 1000}`).join(" ");
              const col = getStatusColor(unit.status);
              const centroid = getCentroid(unit.polygon);
              const isSelected = selectedUnit?.code === unit.code;

              return (
                <g key={unit.code} style={{ cursor: "pointer" }}>
                  <polygon
                    points={pointsStr}
                    fill={col.fill}
                    stroke={isSelected ? "#000" : col.stroke}
                    strokeWidth={isSelected ? 4 : 2}
                    strokeDasharray={isSelected ? "4,4" : undefined}
                    onMouseEnter={() => setHoveredUnit(unit)}
                    onMouseLeave={() => setHoveredUnit(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (mode === "view") {
                        setSelectedUnit(unit);
                        if (onSelectUnit) onSelectUnit(unit);
                      }
                    }}
                    style={{
                      transition: "fill 0.15s, stroke-width 0.15s",
                    }}
                  />
                  {/* Unit Label Tag */}
                  <text
                    x={centroid.x * 1000}
                    y={centroid.y * 1000}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#0f172a"
                    fontWeight="800"
                    fontSize="18"
                    pointerEvents="none"
                    style={{ userSelect: "none" }}
                  >
                    {unit.code}
                  </text>
                  {unit.area && (
                    <text
                      x={centroid.x * 1000}
                      y={centroid.y * 1000 + 20}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#475569"
                      fontWeight="600"
                      fontSize="13"
                      pointerEvents="none"
                      style={{ userSelect: "none" }}
                    >
                      {Number(unit.area).toLocaleString()} sq ft
                    </text>
                  )}
                </g>
              );
            })}

            {/* Currently Drawing Polygon */}
            {mode === "draw-polygon" && drawingPoints.length > 0 && (
              <g>
                <polyline
                  points={drawingPoints.map((p) => `${p.x * 1000},${p.y * 1000}`).join(" ")}
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="3"
                  strokeDasharray="5,5"
                />
                {drawingPoints.map((p, i) => (
                  <circle
                    key={i}
                    cx={p.x * 1000}
                    cy={p.y * 1000}
                    r={i === 0 ? 8 : 5}
                    fill={i === 0 ? "#16a34a" : "#ef4444"}
                    stroke="#fff"
                    strokeWidth="2"
                  />
                ))}
                {mousePos && (
                  <line
                    x1={drawingPoints[drawingPoints.length - 1].x * 1000}
                    y1={drawingPoints[drawingPoints.length - 1].y * 1000}
                    x2={mousePos.x * 1000}
                    y2={mousePos.y * 1000}
                    stroke="#ef4444"
                    strokeWidth="2"
                    strokeDasharray="3,3"
                  />
                )}
              </g>
            )}

            {/* Currently Drawing Box */}
            {mode === "draw-box" && boxStart && mousePos && (
              <rect
                x={Math.min(boxStart.x, mousePos.x) * 1000}
                y={Math.min(boxStart.y, mousePos.y) * 1000}
                width={Math.abs(mousePos.x - boxStart.x) * 1000}
                height={Math.abs(mousePos.y - boxStart.y) * 1000}
                fill="rgba(239, 68, 68, 0.25)"
                stroke="#ef4444"
                strokeWidth="2"
                strokeDasharray="4,4"
              />
            )}
          </svg>
        </Box>

        {/* Hover Tooltip Card */}
        {hoveredUnit && mode === "view" && (
          <Paper
            elevation={4}
            sx={{
              position: "absolute",
              bottom: 16,
              left: 16,
              p: 2,
              borderRadius: 2.5,
              minWidth: 220,
              zIndex: 10,
              background: "rgba(255, 255, 255, 0.96)",
              backdropFilter: "blur(8px)",
              border: "1px solid var(--border)",
            }}
          >
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 900, color: "var(--primary)" }}>
                Unit {hoveredUnit.code}
              </Typography>
              <Chip
                size="small"
                label={hoveredUnit.status}
                sx={{
                  textTransform: "capitalize",
                  fontWeight: 800,
                  fontSize: 10,
                  background: getStatusColor(hoveredUnit.status).bg,
                  color: getStatusColor(hoveredUnit.status).badge,
                }}
              />
            </Box>
            <Typography variant="body2" sx={{ fontSize: 12 }}>
              <strong>Area:</strong> {hoveredUnit.area ? `${Number(hoveredUnit.area).toLocaleString()} sq ft` : "—"}
            </Typography>
            {hoveredUnit.tenant_name && (
              <Typography variant="body2" sx={{ fontSize: 12, mt: 0.5 }}>
                <strong>Tenant:</strong> {hoveredUnit.tenant_name}
              </Typography>
            )}
            {hoveredUnit.monthly_rent && (
              <Typography variant="body2" sx={{ fontSize: 12, mt: 0.5 }}>
                <strong>Rent:</strong> KES {Number(hoveredUnit.monthly_rent).toLocaleString()}/mo
              </Typography>
            )}
            {hoveredUnit.meter_code && (
              <Typography variant="caption" sx={{ display: "block", color: "text.secondary", mt: 0.5 }}>
                Meter: {hoveredUnit.meter_code}
              </Typography>
            )}
          </Paper>
        )}
      </Box>

      {/* Selected Unit Details Modal / Drawer Action */}
      {selectedUnit && mode === "view" && (
        <Box
          sx={{
            p: 2,
            borderTop: "1px solid var(--border)",
            background: "var(--surface)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 1.5,
          }}
        >
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
              Selected: Unit {selectedUnit.code} ({selectedUnit.status})
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {selectedUnit.area ? `${Number(selectedUnit.area).toLocaleString()} sq ft` : ""} · {selectedUnit.tenant_name ? `Leased by ${selectedUnit.tenant_name}` : "Available for lease"}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 1 }}>
            {!readOnly && (
              <Button
                size="small"
                color="error"
                variant="outlined"
                startIcon={<Trash2 size={14} />}
                onClick={() => deleteUnitPolygon(selectedUnit.code)}
              >
                Clear Outline
              </Button>
            )}
            <Button
              size="small"
              variant="contained"
              onClick={() => {
                if (onSelectUnit) onSelectUnit(selectedUnit);
              }}
            >
              View Unit Details →
            </Button>
          </Box>
        </Box>
      )}
    </Paper>
  );
}
