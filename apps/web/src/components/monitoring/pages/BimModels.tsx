import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useParams } from "@/components/monitoring/react-router-shim";
import { Download, FileUp, Layers, Upload } from "lucide-react";

import { get, post, uploadFile, uploadIfcFile, sampleIfcUrl } from "../api";
import { useAuth } from "../auth";
import { ErrorBanner } from "../components";
const BimViewer = lazy(() => import("./BimViewer").then(m => ({ default: m.BimViewer })));

export function BimModels() {
  const { id = "" } = useParams();
  const { can } = useAuth();
  const [models, setModels] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", discipline: "architectural", file_format: "ifc", version: "" });
  const [uploading, setUploading] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerName, setViewerName] = useState("");
  const [viewerFormat, setViewerFormat] = useState("");
  const [viewerModelId, setViewerModelId] = useState("");
  const [viewerElements, setViewerElements] = useState<any[]>([]);
  const [viewerBoqLinks, setViewerBoqLinks] = useState<any[]>([]);
  const [viewerDiscrepancies, setViewerDiscrepancies] = useState<any[]>([]);
  const [uploadFile_, setUploadFile_] = useState<File | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  // IFC direct upload state
  const [ifcFile, setIfcFile] = useState<File | null>(null);
  const [ifcUploading, setIfcUploading] = useState(false);
  const [ifcResult, setIfcResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = () => get<any[]>(`/projects/${id}/bim-models`).then(setModels).catch(e => setError(e.message));
  useEffect(() => { load(); }, [id]);

  async function loadModelDetails(modelId: string) {
    try {
      const [elements, boqLinks, discrepancies] = await Promise.all([
        get<any[]>(`/projects/${id}/bim-models/${modelId}/elements`).catch(() => []),
        get<any[]>(`/projects/${id}/bim-models/${modelId}/boq-links`).catch(() => []),
        get<any[]>(`/projects/${id}/bim-models/${modelId}/discrepancies`).catch(() => []),
      ]);
      setViewerElements(elements);
      setViewerBoqLinks(boqLinks);
      setViewerDiscrepancies(discrepancies);
    } catch (e) {
      console.error("Failed to load model details:", e);
    }
  }

  async function submit() {
    if (!form.name || !uploadFile_) { setError("Name and file are required"); return; }
    setUploading(true); setError(null);
    try {
      const remoteUrl = await uploadFile(uploadFile_);
      await post(`/projects/${id}/bim-models`, { ...form, remote_url: remoteUrl });
      setForm({ name: "", discipline: "architectural", file_format: "ifc", version: "" });
      setUploadFile_(null);
      if (uploadRef.current) uploadRef.current.value = "";
      load();
    } catch (e: any) { setError(e.message); }
    finally { setUploading(false); }
  }

  async function handleIfcUpload() {
    if (!ifcFile) return;
    setIfcUploading(true);
    setIfcResult(null);
    setError(null);
    try {
      const result = await uploadIfcFile(id, ifcFile);
      setIfcResult(result);
      setIfcFile(null);
      load();
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e: any) { setError(e.message); }
    finally { setIfcUploading(false); }
  }

  const isViewable3d = (fmt: string) => ["glb", "gltf"].includes(fmt);

  async function openViewer(model: any) {
    setViewerUrl(model.remote_url);
    setViewerName(model.name);
    setViewerFormat(model.file_format);
    setViewerModelId(model.id);
    await loadModelDetails(model.id);
  }

  return (
    <div>
      {viewerUrl && (
        <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading 3D viewer...</div>}>
          <BimViewer 
            url={viewerUrl} 
            name={viewerName} 
            format={viewerFormat} 
            projectId={id} 
            modelId={viewerModelId} 
            elements={viewerElements}
            boqLinks={viewerBoqLinks}
            discrepancies={viewerDiscrepancies}
            onClose={() => { 
              setViewerUrl(null); 
              setViewerModelId(""); 
              setViewerElements([]);
              setViewerBoqLinks([]);
              setViewerDiscrepancies([]);
            }} 
          />
        </Suspense>
      )}
      <h2>BIM Models</h2>
      <ErrorBanner message={error} />

      <div className="card">
        <table>
          <thead><tr><th>Name</th><th>Discipline</th><th>Format</th><th>Elements</th><th>Current</th><th>Uploaded</th><th></th><th></th></tr></thead>
          <tbody>
            {models.map(m => (
              <tr key={m.id}>
                <td>{m.name}</td><td>{m.discipline}</td><td className="mono">{m.file_format}</td>
                <td>{m.element_count ?? "—"}</td>
                <td>{m.is_current ? "✓ Current" : "Archived"}</td>
                <td className="muted">{m.uploaded_by}</td>
                <td>
                  {m.remote_url && isViewable3d(m.file_format) && (
                    <button className="btn ghost sm" onClick={() => openViewer(m)}>
                      <Layers size={14} style={{ marginRight: 4 }} />3D View
                    </button>
                  )}
                </td>
                <td>{m.remote_url && <a href={m.remote_url} target="_blank" rel="noreferrer"><Download size={14} /></a>}</td>
              </tr>
            ))}
            {models.length === 0 && <tr><td colSpan={8} className="empty">No BIM models uploaded.</td></tr>}
          </tbody>
        </table>
      </div>

      {can("documents.upload") && (
        <>
          {/* Direct file upload for all BIM formats */}
          <div className="card">
            <div className="row" style={{ gap: 8, alignItems: "center", marginBottom: 12 }}>
              <Layers size={18} />
              <h3 style={{ margin: 0 }}>Upload BIM Model</h3>
            </div>
            <div className="row wrap" style={{ gap: 8 }}>
              <input placeholder="Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={{ flex: 1 }} />
              <select value={form.discipline} onChange={e => setForm({ ...form, discipline: e.target.value })}>
                <option value="architectural">Architectural</option>
                <option value="structural">Structural</option>
                <option value="mechanical">Mechanical</option>
                <option value="electrical">Electrical</option>
                <option value="plumbing">Plumbing</option>
                <option value="civil">Civil</option>
              </select>
              <select value={form.file_format} onChange={e => setForm({ ...form, file_format: e.target.value })}>
                <option value="ifc">IFC</option>
                <option value="rvt">Revit (RVT)</option>
                <option value="dwg">AutoCAD (DWG)</option>
                <option value="dgn">MicroStation (DGN)</option>
                <option value="skp">SketchUp (SKP)</option>
                <option value="glb">glTF Binary (GLB)</option>
                <option value="gltf">glTF (GLTF)</option>
              </select>
              <input placeholder="Version" value={form.version} onChange={e => setForm({ ...form, version: e.target.value })} style={{ width: 80 }} />
              <input ref={uploadRef} type="file" onChange={e => setUploadFile_(e.target.files?.[0] || null)} style={{ flex: 2 }} />
              <button className="btn" onClick={submit} disabled={uploading || !form.name || !uploadFile_}>
                <Upload size={14} style={{ marginRight: 4 }} />{uploading ? "Uploading..." : "Upload"}
              </button>
            </div>
          </div>

          {/* IFC direct file upload with quantity extraction */}
          <div className="card" style={{ border: "1px solid var(--primary)" }}>
            <div className="row" style={{ gap: 8, alignItems: "center", marginBottom: 12 }}>
              <FileUp size={18} style={{ color: "var(--primary)" }} />
              <h3 style={{ margin: 0 }}>Upload IFC File for Quantity Takeoff</h3>
              <a href={sampleIfcUrl} className="btn ghost sm" download style={{ marginLeft: "auto", textDecoration: "none", fontSize: 12 }}>
                <Download size={14} style={{ marginRight: 4 }} />Sample IFC
              </a>
            </div>
            <p className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
              Upload an IFC file (from Revit, ArchiCAD, or Tekla). The system extracts element quantities
              and creates BoQ line items automatically. You only need to enter the pricing rates.
            </p>
            <div className="row" style={{ gap: 8 }}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".ifc"
                onChange={e => setIfcFile(e.target.files?.[0] || null)}
                style={{ flex: 1 }}
              />
              <button className="btn btn-primary" onClick={handleIfcUpload} disabled={ifcUploading || !ifcFile}>
                {ifcUploading ? "Parsing..." : "Upload & Extract Quantities"}
              </button>
            </div>

            {ifcResult && (
              <div style={{ marginTop: 12, padding: 12, background: "rgba(34,197,94,0.1)", borderRadius: 8 }}>
                <strong style={{ color: "var(--success)" }}>✓ IFC Processed Successfully</strong>
                <div style={{ fontSize: 13, marginTop: 4, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <span>Elements found: <strong>{ifcResult.element_count}</strong></span>
                  <span>IFC version: <strong>{ifcResult.ifc_version}</strong></span>
                  <span>BoQ items: <strong>{ifcResult.boq_items_created}</strong></span>
                  <span>Types found: <strong>{(ifcResult.types_found || []).join(", ")}</strong></span>
                </div>

                {/* Draft items for review/editing */}
                {ifcResult.draft_items && ifcResult.draft_items.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <h4 style={{ fontSize: 13, marginBottom: 6 }}>Draft Items — Review & Edit</h4>
                    <div style={{ overflow: "auto", maxHeight: 300 }}>
                      <table style={{ fontSize: 12 }}>
                        <thead><tr>
                          <th>Section</th><th>Item #</th><th>Description</th><th>Unit</th><th>Qty</th>
                        </tr></thead>
                        <tbody>
                          {ifcResult.draft_items.map((item: any, i: number) => (
                            <tr key={i}>
                              <td><input value={item.section} style={{ width: 80 }} /></td>
                              <td><input value={item.item_number} style={{ width: 140 }} /></td>
                              <td><input value={item.description} style={{ width: 200 }} /></td>
                              <td><input value={item.unit} style={{ width: 60 }} /></td>
                              <td><input value={item.quantity ?? ""} type="number" style={{ width: 70 }} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
