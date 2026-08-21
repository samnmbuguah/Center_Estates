"use client";

import { useState, useRef, useEffect } from "react";
import { 
  Layers, Download, Maximize2, RotateCcw, Search, Filter, 
  Ruler, Camera, Share2, FileText, AlertTriangle, CheckCircle2,
  Eye, EyeOff, Zap, Box, Info
} from "lucide-react";

interface Props {
  url: string;
  name: string;
  format: string;
  onClose: () => void;
  projectId?: string;
  modelId?: string;
  elements?: any[];
  boqLinks?: any[];
  discrepancies?: any[];
}

export function BimViewer({ url, name, format, onClose, projectId, modelId, elements = [], boqLinks = [], discrepancies = [] }: Props) {
  const [activeTab, setActiveTab] = useState<"viewer" | "elements" | "boq" | "discrepancies">("viewer");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedElement, setSelectedElement] = useState<any>(null);
  const [visibleLayers, setVisibleLayers] = useState<Record<string, boolean>>({
    architectural: true,
    structural: true,
    mechanical: true,
    electrical: true,
    plumbing: true,
    civil: true,
  });
  const [viewMode, setViewMode] = useState<"3d" | "wireframe" | "xray">("3d");
  const [showMeasurements, setShowMeasurements] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Filter elements based on search and layer visibility
  const filteredElements = elements.filter(el => {
    const matchesSearch = !searchQuery || 
      el.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      el.type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      el.ifc_type?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesLayer = visibleLayers[el.discipline] !== false;
    
    return matchesSearch && matchesLayer;
  });

  // Element type statistics
  const elementStats = elements.reduce((acc, el) => {
    const type = el.ifc_type || el.type || "other";
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Discrepancy severity stats
  const discrepancyStats = discrepancies.reduce((acc, d) => {
    const severity = d.severity || "medium";
    acc[severity] = (acc[severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  function handleResetView() {
    setZoomLevel(100);
    setRotation({ x: 0, y: 0 });
  }

  function handleZoomIn() {
    setZoomLevel(prev => Math.min(prev + 10, 200));
  }

  function handleZoomOut() {
    setZoomLevel(prev => Math.max(prev - 10, 25));
  }

  function toggleLayer(layer: string) {
    setVisibleLayers(prev => ({ ...prev, [layer]: !prev[layer] }));
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.95)",
      display: "flex", flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 24px", background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)", 
        borderBottom: "1px solid rgba(255,255,255,0.1)",
      }}>
        <div className="row" style={{ gap: 16, alignItems: "center" }}>
          <div>
            <strong style={{ fontSize: 18, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
              <Box size={20} />
              {name}
            </strong>
            <div className="row" style={{ gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>
                {format.toUpperCase()} MODEL
              </span>
              <span style={{ fontSize: 12, color: "#64748b" }}>
                {elements.length} elements
              </span>
              <span style={{ fontSize: 12, color: "#64748b" }}>
                {boqLinks.length} BoQ links
              </span>
              {discrepancies.length > 0 && (
                <span style={{ fontSize: 12, color: "#ef4444", fontWeight: 600 }}>
                  {discrepancies.length} discrepancies
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="row" style={{ gap: 12, alignItems: "center" }}>
          <div className="row" style={{ gap: 8, background: "rgba(255,255,255,0.1)", padding: "4px 8px", borderRadius: 8 }}>
            <button 
              className="btn ghost sm" 
              onClick={handleZoomOut}
              style={{ color: "#fff", padding: "4px 8px" }}
            >
              −
            </button>
            <span style={{ color: "#fff", fontSize: 12, minWidth: 40, textAlign: "center" }}>
              {zoomLevel}%
            </span>
            <button 
              className="btn ghost sm" 
              onClick={handleZoomIn}
              style={{ color: "#fff", padding: "4px 8px" }}
            >
              +
            </button>
          </div>
          
          <button 
            className="btn ghost sm" 
            onClick={handleResetView}
            style={{ color: "#fff" }}
            title="Reset View"
          >
            <RotateCcw size={16} />
          </button>
          
          <a href={url} target="_blank" rel="noreferrer" className="btn ghost sm" style={{ color: "#fff" }}>
            <Download size={16} style={{ marginRight: 4 }} />Download
          </a>
          
          <button 
            className="btn sm" 
            onClick={onClose} 
            style={{ background: "var(--primary)", color: "#fff", border: 0, padding: "8px 16px", borderRadius: 6, cursor: "pointer" }}
          >
            Close
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Left Sidebar - Controls */}
        <div style={{ 
          width: 280, 
          background: "rgba(30,41,59,0.8)", 
          borderRight: "1px solid rgba(255,255,255,0.1)",
          display: "flex", flexDirection: "column",
          overflow: "hidden"
        }}>
          {/* View Mode Selector */}
          <div style={{ padding: 16, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
            <h4 style={{ color: "#fff", margin: "0 0 12px 0", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              View Mode
            </h4>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              {(["3d", "wireframe", "xray"] as const).map(mode => (
                <button
                  key={mode}
                  className={`btn sm ${viewMode === mode ? "" : "ghost"}`}
                  onClick={() => setViewMode(mode)}
                  style={{ 
                    flex: 1, 
                    minWidth: 70,
                    background: viewMode === mode ? "var(--primary)" : "rgba(255,255,255,0.1)",
                    color: "#fff",
                    border: viewMode === mode ? "none" : "1px solid rgba(255,255,255,0.2)"
                  }}
                >
                  {mode === "3d" ? "3D" : mode === "wireframe" ? "Wire" : "X-Ray"}
                </button>
              ))}
            </div>
          </div>

          {/* Layer Controls */}
          <div style={{ padding: 16, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
            <h4 style={{ color: "#fff", margin: "0 0 12px 0", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Layers
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {Object.entries(visibleLayers).map(([layer, visible]) => (
                <button
                  key={layer}
                  onClick={() => toggleLayer(layer)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 12px",
                    background: visible ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 6,
                    color: "#fff",
                    cursor: "pointer",
                    textAlign: "left"
                  }}
                >
                  {visible ? <Eye size={14} /> : <EyeOff size={14} />}
                  <span style={{ textTransform: "capitalize" }}>{layer}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tools */}
          <div style={{ padding: 16, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
            <h4 style={{ color: "#fff", margin: "0 0 12px 0", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Tools
            </h4>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <button
                className={`btn sm ${showMeasurements ? "" : "ghost"}`}
                onClick={() => setShowMeasurements(!showMeasurements)}
                style={{ 
                  background: showMeasurements ? "var(--primary)" : "rgba(255,255,255,0.1)",
                  color: "#fff",
                  border: showMeasurements ? "none" : "1px solid rgba(255,255,255,0.2)"
                }}
              >
                <Ruler size={14} style={{ marginRight: 4 }} />Measure
              </button>
              <button
                className="btn ghost sm"
                style={{ color: "#fff", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)" }}
              >
                <Camera size={14} style={{ marginRight: 4 }} />Snapshot
              </button>
              <button
                className="btn ghost sm"
                style={{ color: "#fff", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)" }}
              >
                <Share2 size={14} style={{ marginRight: 4 }} />Share
              </button>
            </div>
          </div>

          {/* Element Statistics */}
          <div style={{ padding: 16, flex: 1, overflow: "auto" }}>
            <h4 style={{ color: "#fff", margin: "0 0 12px 0", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Element Types
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {Object.entries(elementStats).map(([type, count]) => (
                <div key={type} style={{ 
                  display: "flex", 
                  justifyContent: "space-between", 
                  padding: "6px 8px",
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: 4,
                  color: "#fff",
                  fontSize: 12
                }}>
                  <span>{type}</span>
                  <span style={{ fontWeight: 600 }}>{String(count)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Center - 3D Viewer */}
        <div style={{ flex: 1, position: "relative", background: "#0f172a" }}>
          <canvas 
            ref={canvasRef}
            style={{ 
              width: "100%", 
              height: "100%",
              opacity: viewMode === "xray" ? 0.7 : 1
            }}
          />
          
          {/* Placeholder for actual 3D rendering */}
          <div style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff"
          }}>
            <div style={{ fontSize: 64, marginBottom: 16, opacity: 0.5 }}>🧊</div>
            <h3 style={{ margin: "0 0 8px 0", opacity: 0.8 }}>3D Model Viewer</h3>
            <p style={{ color: "#94a3b8", fontSize: 14, margin: 0, textAlign: "center", maxWidth: 400 }}>
              Advanced BIM visualization with element filtering, measurement tools, and BoQ integration
            </p>
            <div className="row" style={{ gap: 8, marginTop: 16 }}>
              <a href={url} target="_blank" rel="noreferrer" style={{ 
                display: "inline-block", 
                background: "var(--primary)", 
                color: "#fff", 
                padding: "10px 20px", 
                borderRadius: 8, 
                fontWeight: 600, 
                textDecoration: "none" 
              }}>
                Open 3D Model Source →
              </a>
            </div>
          </div>

          {/* Measurement overlay */}
          {showMeasurements && (
            <div style={{
              position: "absolute",
              bottom: 16,
              left: 16,
              background: "rgba(0,0,0,0.8)",
              padding: 12,
              borderRadius: 8,
              color: "#fff",
              fontSize: 12
            }}>
              <div className="row" style={{ gap: 8, alignItems: "center" }}>
                <Ruler size={14} />
                <span>Measurement Tool Active</span>
              </div>
              <p style={{ margin: "4px 0 0 0", color: "#94a3b8" }}>
                Click on elements to measure distances
              </p>
            </div>
          )}
        </div>

        {/* Right Sidebar - Tabs */}
        <div style={{ 
          width: 320, 
          background: "rgba(30,41,59,0.8)", 
          borderLeft: "1px solid rgba(255,255,255,0.1)",
          display: "flex", flexDirection: "column",
          overflow: "hidden"
        }}>
          {/* Tab Headers */}
          <div style={{ 
            display: "flex", 
            borderBottom: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(15,23,42,0.8)"
          }}>
            {[
              { id: "viewer" as const, label: "Viewer", icon: Layers },
              { id: "elements" as const, label: "Elements", icon: Box },
              { id: "boq" as const, label: "BoQ Links", icon: FileText },
              { id: "discrepancies" as const, label: "Issues", icon: AlertTriangle, count: discrepancies.length }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1,
                  padding: "12px 8px",
                  background: activeTab === tab.id ? "rgba(59,130,246,0.2)" : "transparent",
                  border: "none",
                  borderBottom: activeTab === tab.id ? "2px solid var(--primary)" : "2px solid transparent",
                  color: "#fff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  fontSize: 12
                }}
              >
                <tab.icon size={14} />
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span style={{
                    background: "#ef4444",
                    color: "#fff",
                    borderRadius: 10,
                    padding: "2px 6px",
                    fontSize: 10,
                    fontWeight: 600
                  }}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
            {activeTab === "viewer" && (
              <div>
                <h4 style={{ color: "#fff", margin: "0 0 12px 0", fontSize: 14 }}>Model Information</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ padding: 12, background: "rgba(255,255,255,0.05)", borderRadius: 8 }}>
                    <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ color: "#94a3b8", fontSize: 12 }}>Name</span>
                      <span style={{ color: "#fff", fontSize: 12 }}>{name}</span>
                    </div>
                    <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ color: "#94a3b8", fontSize: 12 }}>Format</span>
                      <span style={{ color: "#fff", fontSize: 12 }}>{format.toUpperCase()}</span>
                    </div>
                    <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ color: "#94a3b8", fontSize: 12 }}>Elements</span>
                      <span style={{ color: "#fff", fontSize: 12 }}>{elements.length}</span>
                    </div>
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <span style={{ color: "#94a3b8", fontSize: 12 }}>BoQ Links</span>
                      <span style={{ color: "#fff", fontSize: 12 }}>{boqLinks.length}</span>
                    </div>
                  </div>

                  {discrepancies.length > 0 && (
                    <div style={{ padding: 12, background: "rgba(239,68,68,0.1)", borderRadius: 8, border: "1px solid rgba(239,68,68,0.3)" }}>
                      <div className="row" style={{ gap: 8, alignItems: "center", marginBottom: 8 }}>
                        <AlertTriangle size={16} style={{ color: "#ef4444" }} />
                        <strong style={{ color: "#fff", fontSize: 12 }}>Discrepancies Found</strong>
                      </div>
                      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                        {Object.entries(discrepancyStats).map(([severity, count]) => (
                          <span key={severity} style={{
                            padding: "4px 8px",
                            background: severity === "high" ? "rgba(239,68,68,0.2)" : "rgba(251,191,36,0.2)",
                            borderRadius: 4,
                            color: "#fff",
                            fontSize: 11
                          }}>
                            {severity}: {String(count)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "elements" && (
              <div>
                <div className="row" style={{ gap: 8, marginBottom: 12 }}>
                  <div style={{ flex: 1, position: "relative" }}>
                    <Search size={14} style={{ 
                      position: "absolute", 
                      left: 8, 
                      top: "50%", 
                      transform: "translateY(-50%)",
                      color: "#94a3b8" 
                    }} />
                    <input
                      placeholder="Search elements..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 8px 8px 32px",
                        background: "rgba(255,255,255,0.1)",
                        border: "1px solid rgba(255,255,255,0.2)",
                        borderRadius: 6,
                        color: "#fff",
                        fontSize: 12
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {filteredElements.length === 0 ? (
                    <p style={{ color: "#94a3b8", fontSize: 12, textAlign: "center", padding: 20 }}>
                      No elements found
                    </p>
                  ) : (
                    filteredElements.map((el, i) => (
                      <div
                        key={i}
                        onClick={() => setSelectedElement(el)}
                        style={{
                          padding: "10px 12px",
                          background: selectedElement === el ? "rgba(59,130,246,0.2)" : "rgba(255,255,255,0.05)",
                          border: selectedElement === el ? "1px solid var(--primary)" : "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 6,
                          cursor: "pointer"
                        }}
                      >
                        <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ color: "#fff", fontSize: 12, fontWeight: 500 }}>
                            {el.name || el.ifc_type || "Unknown"}
                          </span>
                          <span style={{ 
                            color: "#94a3b8", 
                            fontSize: 10,
                            textTransform: "capitalize"
                          }}>
                            {el.discipline || "general"}
                          </span>
                        </div>
                        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                          <span style={{ color: "#64748b", fontSize: 10 }}>
                            {el.ifc_type || el.type}
                          </span>
                          {el.boq_item_id && (
                            <span style={{ 
                              color: "#22c55e", 
                              fontSize: 10,
                              background: "rgba(34,197,94,0.1)",
                              padding: "2px 6px",
                              borderRadius: 4
                            }}>
                              ✓ BoQ Linked
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === "boq" && (
              <div>
                {boqLinks.length === 0 ? (
                  <p style={{ color: "#94a3b8", fontSize: 12, textAlign: "center", padding: 20 }}>
                    No BoQ links found
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {boqLinks.map((link, i) => (
                      <div
                        key={i}
                        style={{
                          padding: 12,
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 6
                        }}
                      >
                        <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
                          <span style={{ color: "#fff", fontSize: 12, fontWeight: 500 }}>
                            {link.section || "General"}
                          </span>
                          <span style={{ color: "#94a3b8", fontSize: 10 }}>
                            {link.item_number}
                          </span>
                        </div>
                        <p style={{ color: "#94a3b8", fontSize: 11, margin: "0 0 8px 0" }}>
                          {link.description}
                        </p>
                        <div className="row" style={{ gap: 8, fontSize: 10 }}>
                          <span style={{ color: "#64748b" }}>
                            Qty: {link.quantity}
                          </span>
                          <span style={{ color: "#64748b" }}>
                            Unit: {link.unit}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "discrepancies" && (
              <div>
                {discrepancies.length === 0 ? (
                  <p style={{ color: "#94a3b8", fontSize: 12, textAlign: "center", padding: 20 }}>
                    No discrepancies found
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {discrepancies.map((disc, i) => (
                      <div
                        key={i}
                        style={{
                          padding: 12,
                          background: disc.severity === "high" ? "rgba(239,68,68,0.1)" : "rgba(251,191,36,0.1)",
                          border: disc.severity === "high" ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(251,191,36,0.3)",
                          borderRadius: 6
                        }}
                      >
                        <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
                          <div className="row" style={{ gap: 8, alignItems: "center" }}>
                            {disc.severity === "high" ? (
                              <AlertTriangle size={14} style={{ color: "#ef4444" }} />
                            ) : (
                              <Info size={14} style={{ color: "#fbbf24" }} />
                            )}
                            <span style={{ 
                              color: disc.severity === "high" ? "#ef4444" : "#fbbf24",
                              fontSize: 11,
                              fontWeight: 600,
                              textTransform: "uppercase"
                            }}>
                              {disc.severity}
                            </span>
                          </div>
                          <span style={{ 
                            color: disc.status === "open" ? "#fbbf24" : "#22c55e",
                            fontSize: 10,
                            fontWeight: 600
                          }}>
                            {disc.status}
                          </span>
                        </div>
                        <p style={{ color: "#fff", fontSize: 12, margin: "0 0 8px 0" }}>
                          {disc.description}
                        </p>
                        {disc.confidence_score && (
                          <div className="row" style={{ gap: 8, fontSize: 10 }}>
                            <span style={{ color: "#94a3b8" }}>
                              Confidence: {disc.confidence_score}%
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
