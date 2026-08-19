"use client";

import { useEffect, useState, useRef } from "react";
import { Copy, Download, Plus, Printer, QrCode, X, Sparkles, Building2, MapPin } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { apiFetch } from "@/lib/api";

type Property = { id: string; name: string };
type Code = { id: string; token: string; label: string; property_name: string; building_name?: string; floor: string; unit: string; active: boolean };

export function FeedbackQrManager({ organizationId }: { organizationId: string | null }) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [codes, setCodes] = useState<Code[]>([]);
  const [property, setProperty] = useState("");
  const [label, setLabel] = useState("");
  const [floor, setFloor] = useState("");
  const [unit, setUnit] = useState("");
  const [notice, setNotice] = useState("");
  const [printTarget, setPrintTarget] = useState<Code | null>(null);

  async function load() {
    if (!organizationId) return;
    const [propsRes, codesRes] = await Promise.all([
      apiFetch("/property/properties/", {}, organizationId),
      apiFetch("/companion/feedback-qr-codes/", {}, organizationId),
    ]);
    if (propsRes.ok) {
      const data = await propsRes.json();
      setProperties(Array.isArray(data) ? data : data.results || []);
    }
    if (codesRes.ok) {
      const data = await codesRes.json();
      setCodes(Array.isArray(data) ? data : data.results || []);
    }
  }

  useEffect(() => { void load(); }, [organizationId]);

  async function createCode() {
    if (!organizationId || !property || !label.trim()) return;
    const response = await apiFetch(
      "/companion/feedback-qr-codes/",
      { method: "POST", body: JSON.stringify({ property, label: label.trim(), floor, unit }) },
      organizationId
    );
    if (!response.ok) {
      setNotice("Could not create the feedback QR link.");
      return;
    }
    setNotice("QR feedback link created successfully.");
    setLabel("");
    setFloor("");
    setUnit("");
    void load();
  }

  function urlFor(code: Code) {
    if (typeof window === "undefined") return `/feedback/${code.token}`;
    return `${window.location.origin}/feedback/${code.token}`;
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {/* Create Card */}
      <div style={{ padding: 20, border: "1px solid var(--border)", borderRadius: 12, background: "var(--surface)", display: "grid", gap: 14 }}>
        <div>
          <h3 style={{ margin: "0 0 4px", fontSize: "1.1rem", fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
            <QrCode size={18} color="#dc2626" />
            <span>Smart Helpdesk QR Code Generator</span>
          </h3>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Generate location-specific QR codes for lobbies, towers, floors, and tenant units. Cleaners, guards, tenants, and visitors can scan to instantly log requests without logging in.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
          <select value={property} onChange={(e) => setProperty(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)" }}>
            <option value="">Select property *</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input placeholder="Location Label e.g. Tower A Lobby *" value={label} onChange={(e) => setLabel(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)" }} />
          <input placeholder="Floor (e.g. Floor 2 / Ground)" value={floor} onChange={(e) => setFloor(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)" }} />
          <input placeholder="Unit / Area (e.g. Unit 204)" value={unit} onChange={(e) => setUnit(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)" }} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button className="btn primary" onClick={() => void createCode()} disabled={!property || !label.trim()} style={{ background: "#dc2626", borderColor: "#dc2626", fontWeight: 700 }}>
            <Plus size={15} /> Generate Smart QR Code
          </button>
          {notice && <span style={{ fontSize: 13, color: "#16a34a", fontWeight: 600 }}>✓ {notice}</span>}
        </div>
      </div>

      {/* Grid of Generated QR Codes */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
        {codes.map((code) => (
          <article
            key={code.id}
            style={{
              padding: 18,
              border: "1px solid var(--border)",
              borderRadius: 14,
              background: "var(--surface)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
              textAlign: "center",
              boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
            }}
          >
            <div style={{ padding: 10, background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0" }}>
              <QRCodeSVG value={urlFor(code)} size={140} includeMargin level="H" />
            </div>
            <div>
              <strong style={{ fontSize: 14, display: "block" }}>{code.label}</strong>
              <span className="muted" style={{ fontSize: 12 }}>
                {code.property_name}{code.floor ? ` · Floor ${code.floor}` : ""}{code.unit ? ` · Unit ${code.unit}` : ""}
              </span>
            </div>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
              <button className="btn ghost sm" onClick={() => void navigator.clipboard.writeText(urlFor(code))} title="Copy public link">
                <Copy size={12} /> Link
              </button>
              <button className="btn ghost sm" onClick={() => setPrintTarget(code)} title="Print physical placard">
                <Printer size={12} /> Placard
              </button>
            </div>
          </article>
        ))}
      </div>

      {/* PRINT PLACARD MODAL */}
      {printTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 16 }}>
          <div style={{ background: "#ffffff", borderRadius: 16, maxWidth: 440, width: "100%", padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <strong style={{ fontSize: 16 }}>Printable QR Placard</strong>
              <button style={{ background: "none", border: 0, cursor: "pointer" }} onClick={() => setPrintTarget(null)}>
                <X size={18} />
              </button>
            </div>

            {/* Placard Preview */}
            <div id="print-placard-area" style={{ border: "2px solid #0f172a", borderRadius: 12, padding: 24, textAlign: "center", background: "#fff", color: "#0f172a" }}>
              <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", color: "#dc2626", marginBottom: 4 }}>
                Center Estates · Smart Helpdesk
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 2 }}>{printTarget.property_name}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#475569", marginBottom: 14 }}>
                {printTarget.label}{printTarget.floor ? ` · Floor ${printTarget.floor}` : ""}{printTarget.unit ? ` · Unit ${printTarget.unit}` : ""}
              </div>

              <div style={{ display: "inline-block", padding: 12, background: "#fff", border: "1.5px solid #cbd5e1", borderRadius: 12, marginBottom: 14 }}>
                <QRCodeSVG value={urlFor(printTarget)} size={180} includeMargin level="H" />
              </div>

              <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>
                📷 Scan with your camera to report an issue
              </div>
              <div style={{ fontSize: 11, color: "#64748b" }}>
                Plumbing · Electrical · Cleaning · Security · Facilities
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
              <button className="btn ghost" onClick={() => setPrintTarget(null)}>Close</button>
              <button
                className="btn primary"
                onClick={() => {
                  const printContents = document.getElementById("print-placard-area")?.innerHTML;
                  const printWindow = window.open("", "_blank");
                  if (printWindow && printContents) {
                    printWindow.document.write(`
                      <html>
                        <head>
                          <title>${printTarget.label} - QR Placard</title>
                          <style>
                            body { font-family: system-ui, sans-serif; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
                            @media print { body { padding: 0; } }
                          </style>
                        </head>
                        <body>
                          <div style="max-width: 400px; width: 100%; border: 3px solid #000; border-radius: 16px; padding: 32px; text-align: center;">
                            ${printContents}
                          </div>
                          <script>window.print(); setTimeout(() => window.close(), 1000);<\/script>
                        </body>
                      </html>
                    `);
                    printWindow.document.close();
                  }
                }}
                style={{ background: "#0f172a", color: "#fff", fontWeight: 700 }}
              >
                <Printer size={15} /> Print Placard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

