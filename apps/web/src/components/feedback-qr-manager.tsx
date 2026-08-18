"use client";

import { useEffect, useState } from "react";
import { Copy, Download, Plus } from "lucide-react";
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

  async function load() {
    if (!organizationId) return;
    const [propsRes, codesRes] = await Promise.all([
      apiFetch("/property/properties/", {}, organizationId),
      apiFetch("/companion/feedback-qr-codes/", {}, organizationId),
    ]);
    if (propsRes.ok) setProperties(await propsRes.json());
    if (codesRes.ok) setCodes(await codesRes.json());
  }
  useEffect(() => { void load(); }, [organizationId]);

  async function createCode() {
    if (!organizationId || !property || !label.trim()) return;
    const response = await apiFetch("/companion/feedback-qr-codes/", { method: "POST", body: JSON.stringify({ property, label: label.trim(), floor, unit }) }, organizationId);
    if (!response.ok) { setNotice("Could not create the feedback QR link."); return; }
    setNotice("QR feedback link created."); setLabel(""); setFloor(""); setUnit(""); void load();
  }

  function urlFor(code: Code) { return `${window.location.origin}/feedback/${code.token}`; }

  return <div style={{ display: "grid", gap: 20 }}>
    <div style={{ padding: 16, border: "1px solid var(--border)", borderRadius: 12, display: "grid", gap: 12 }}>
      <h3 style={{ margin: 0 }}>Public feedback QR codes</h3>
      <p className="muted" style={{ margin: 0 }}>Create a QR link for a lobby, tower, floor or unit. Visitors can report issues without signing in; their location is attached automatically.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
        <select value={property} onChange={e => setProperty(e.target.value)}><option value="">Select property</option>{properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <input placeholder="Label e.g. Tower A lobby" value={label} onChange={e => setLabel(e.target.value)} />
        <input placeholder="Floor (optional)" value={floor} onChange={e => setFloor(e.target.value)} />
        <input placeholder="Unit (optional)" value={unit} onChange={e => setUnit(e.target.value)} />
      </div>
      <button className="btn primary" onClick={() => void createCode()} disabled={!property || !label.trim()}><Plus size={15} /> Create QR code</button>
      {notice && <span className="muted">{notice}</span>}
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 14 }}>
      {codes.map(code => <article key={code.id} style={{ padding: 14, border: "1px solid var(--border)", borderRadius: 12, display: "grid", justifyItems: "center", gap: 8 }}>
        <QRCodeSVG value={urlFor(code)} size={150} includeMargin />
        <strong>{code.label}</strong><span className="muted">{code.property_name}{code.floor ? ` · Floor ${code.floor}` : ""}{code.unit ? ` · Unit ${code.unit}` : ""}</span>
        <div style={{ display: "flex", gap: 6 }}><button className="btn ghost sm" onClick={() => void navigator.clipboard.writeText(urlFor(code))}><Copy size={13} /> Copy link</button><a className="btn ghost sm" href={urlFor(code)} download={`${code.label.replace(/\W+/g, "-")}-feedback-qr.svg`}><Download size={13} /> Download</a></div>
      </article>)}
    </div>
  </div>;
}
