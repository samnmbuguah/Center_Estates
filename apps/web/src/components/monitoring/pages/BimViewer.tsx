import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import { fetchBimBoqLinks } from "../api";

interface Props {
  url: string;
  name: string;
  format: string;
  onClose: () => void;
  projectId?: string;
  modelId?: string;
}

interface BoqLinkItem {
  id: string;
  item_number: string;
  description: string;
  unit: string;
  planned_quantity: number;
  executed_quantity: number;
  rate: number | null;
  progress_percentage: number;
}

interface BoqLinkData {
  ifc_guid: string;
  ifc_type: string;
  boq_item: BoqLinkItem;
}

function BoqInfoPanel({ data, onClose }: { data: BoqLinkData; onClose: () => void }) {
  const item = data.boq_item;
  const progressColor = item.progress_percentage >= 80 ? "#22c55e"
    : item.progress_percentage >= 50 ? "#eab308"
    : "#ef4444";

  return (
    <div style={{
      position: "absolute", top: 16, right: 16, width: 320,
      background: "var(--surface)", borderRadius: 8,
      border: "1px solid var(--border)", boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
      zIndex: 10, padding: 16, fontSize: 13,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <strong style={{ color: "var(--primary)" }}>BoQ Link</strong>
        <button className="btn ghost sm" onClick={onClose} style={{ fontSize: 16, lineHeight: 1, padding: "2px 8px" }}>×</button>
      </div>

      <div style={{ marginBottom: 8 }}>
        <span className="muted" style={{ fontSize: 11 }}>IFC Type</span>
        <div style={{ fontWeight: 600 }}>{data.ifc_type}</div>
      </div>
      <div style={{ marginBottom: 8 }}>
        <span className="muted" style={{ fontSize: 11 }}>GUID</span>
        <div style={{ fontFamily: "monospace", fontSize: 11, wordBreak: "break-all" }}>{data.ifc_guid}</div>
      </div>

      <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "12px 0" }} />

      <div style={{ marginBottom: 8 }}>
        <span className="muted" style={{ fontSize: 11 }}>Item</span>
        <div style={{ fontWeight: 600 }}>{item.item_number}</div>
      </div>
      <div style={{ marginBottom: 8 }}>
        <span className="muted" style={{ fontSize: 11 }}>Description</span>
        <div>{item.description}</div>
      </div>
      <div style={{ marginBottom: 8 }}>
        <span className="muted" style={{ fontSize: 11 }}>Unit</span>
        <div>{item.unit}</div>
      </div>
      <div style={{ marginBottom: 8 }}>
        <span className="muted" style={{ fontSize: 11 }}>Planned Qty</span>
        <div>{item.planned_quantity}</div>
      </div>
      <div style={{ marginBottom: 8 }}>
        <span className="muted" style={{ fontSize: 11 }}>Executed Qty</span>
        <div>{item.executed_quantity}</div>
      </div>
      {item.rate !== null && (
        <div style={{ marginBottom: 8 }}>
          <span className="muted" style={{ fontSize: 11 }}>Unit Rate</span>
          <div>{item.rate.toLocaleString()}</div>
        </div>
      )}
      <div style={{ marginBottom: 8 }}>
        <span className="muted" style={{ fontSize: 11 }}>Progress</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
          <div style={{ flex: 1, height: 8, background: "var(--bg)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{
              width: `${Math.min(item.progress_percentage, 100)}%`, height: "100%",
              background: progressColor, borderRadius: 4, transition: "width 0.3s",
            }} />
          </div>
          <span style={{ fontWeight: 600, color: progressColor, fontSize: 12 }}>
            {item.progress_percentage}%
          </span>
        </div>
      </div>
    </div>
  );
}

export function BimViewer({ url, name, format, onClose, projectId, modelId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBoq, setSelectedBoq] = useState<BoqLinkData | null>(null);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const linksRef = useRef<Map<string, BoqLinkData>>(new Map());

  useEffect(() => {
    if (!projectId || !modelId) return;
    fetchBimBoqLinks(projectId, modelId).then((res: any) => {
      const map = new Map<string, BoqLinkData>();
      for (const link of res.links || []) {
        map.set(link.ifc_guid, link);
        map.set(link.ifc_type, link);
      }
      linksRef.current = map;
    }).catch(() => {});
  }, [projectId, modelId]);

  const handleClick = useCallback((event: MouseEvent) => {
    const container = containerRef.current;
    if (!container || !sceneRef.current || !cameraRef.current) return;

    const rect = container.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);

    const scene = sceneRef.current;
    const objects: THREE.Object3D[] = [];
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) objects.push(child);
    });

    const intersects = raycasterRef.current.intersectObjects(objects, false);
    if (intersects.length > 0 && intersects[0]) {
      const hit = intersects[0]!.object;
      const linkInfo = getLinkInfo(hit, linksRef.current);
      if (linkInfo) {
        setSelectedBoq(linkInfo);
      }
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x141c24);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(5, 5, 5);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controlsRef.current = controls;

    const ambientLight = new THREE.AmbientLight(0x404060, 0.5);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    scene.add(dirLight);
    const fillLight = new THREE.DirectionalLight(0xffaa88, 0.4);
    fillLight.position.set(-10, 5, -10);
    scene.add(fillLight);

    const gridHelper = new THREE.GridHelper(20, 20, 0x38bdf8, 0x26323f);
    scene.add(gridHelper);

    if (format === "glb" || format === "gltf") {
      const loader = new GLTFLoader();
      loader.load(
        url,
        (gltf) => {
          const model = gltf.scene;
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const scale = maxDim > 10 ? 10 / maxDim : 1;
          model.scale.set(scale, scale, scale);
          model.position.sub(center.clone().multiplyScalar(scale));
          scene.add(model);
          const dist = maxDim * scale * 1.5;
          camera.position.set(dist, dist * 0.6, dist);
          controls.target.set(0, 0, 0);
          controls.update();
          setLoading(false);
        },
        undefined,
        (err) => {
          console.error("GLTF load error:", err);
          setError("Failed to load 3D model.");
          setLoading(false);
        },
      );
    } else {
      setError(`3D viewer does not support .${format} files directly. Try converting to glTF/GLB.`);
      setLoading(false);
    }

    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    container.addEventListener("click", handleClick);

    return () => {
      window.removeEventListener("resize", onResize);
      container.removeEventListener("click", handleClick);
      container.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [url, format, handleClick]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.7)",
      display: "flex", flexDirection: "column",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 24px", background: "var(--surface)", borderBottom: "1px solid var(--border)",
      }}>
        <strong>{name}</strong>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {loading && <span className="muted">Loading model…</span>}
          {projectId && modelId && (
            <span className="muted" style={{ fontSize: 12 }}>
              Click any 3D element to see linked BoQ data
            </span>
          )}
          <a href={url} target="_blank" rel="noreferrer" className="btn ghost sm">Download</a>
          <button className="btn sm" onClick={onClose}>Close</button>
        </div>
      </div>
      <div ref={containerRef} style={{ flex: 1, position: "relative" }}>
        {selectedBoq && (
          <BoqInfoPanel data={selectedBoq} onClose={() => setSelectedBoq(null)} />
        )}
        {error && (
          <div style={{
            position: "absolute", inset: 0, display: "grid", placeItems: "center",
          }}>
            <div className="card" style={{ maxWidth: 400, textAlign: "center" }}>
              <p>{error}</p>
              {format !== "glb" && format !== "gltf" && (
                <a href={url} target="_blank" rel="noreferrer" className="btn ghost sm">Open in external viewer</a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function getLinkInfo(object: THREE.Object3D, links: Map<string, BoqLinkData>): BoqLinkData | null {
  let current: THREE.Object3D | null = object;
  while (current) {
    const name = current.name || "";
    const userData = current.userData || {};

    const guid = userData.guid || userData.GlobalId || userData.ifc_guid || name.split("_").pop() || "";
    if (guid) {
      const found = links.get(guid);
      if (found) return found;
    }

    const type = userData.type || userData.Type || userData.IfcType || "";
    if (type) {
      const found = links.get(type);
      if (found) return found;
    }

    current = current.parent;
  }
  return null;
}
