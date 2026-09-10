"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

type Fallback = { unitCode: string; unitType: string; area: number; floor: string };

function buildFallbackScene(scene: THREE.Scene, fallback: Fallback) {
  scene.background = new THREE.Color(0xf1f5f9);
  // Floor slab sized roughly from the recorded area (width x depth in metres).
  const area = fallback.area || 60;
  const dim = Math.max(4, Math.sqrt(area));
  const width = dim;
  const depth = dim;

  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.15, depth),
    new THREE.MeshStandardMaterial({ color: 0xdcd7d0, roughness: 0.9 }),
  );
  slab.position.y = -0.08;
  scene.add(slab);

  // Outer walls (translucent so the interior rooms remain visible).
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x93a5c4, roughness: 0.7, transparent: true, opacity: 0.28 });
  const wallH = 2.8;
  const wallT = 0.1;
  const walls: [number, number, number, number, number][] = [
    [width, 0, wallT, 0, depth / 2],
    [width, 0, wallT, 0, -depth / 2],
    [wallT, 0, depth, -width / 2, 0],
    [wallT, 0, depth, width / 2, 0],
  ];
  walls.forEach(([w, , d, x, z]) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w === width ? w : wallT, wallH, d === depth ? d : wallT), wallMat);
    wall.position.set(x, wallH / 2, z);
    scene.add(wall);
  });

  // 2x2 room grid suggested by unit type, so even the fallback reads as a flat.
  const roomColours = [0xc7d4f0, 0xd4e8d4, 0xf3e2c7, 0xe8d6ef];
  const roomMat = roomColours.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }));
  const halfW = width / 2 - 0.35;
  const halfD = depth / 2 - 0.35;
  for (let ry = 0; ry < 2; ry++) {
    for (let rx = 0; rx < 2; rx++) {
      const rw = halfW - 0.05;
      const rd = halfD - 0.05;
      const cx = rx === 0 ? -halfW / 2 : halfW / 2;
      const cz = ry === 0 ? -halfD / 2 : halfD / 2;
      const room = new THREE.Mesh(new THREE.BoxGeometry(rw, 0.05, rd), roomMat[(rx + ry * 2) % roomMat.length]);
      room.position.set(cx, 0.02, cz);
      scene.add(room);
    }
  }

  // Central “core” block (bathroom/kitchen).
  const core = new THREE.Mesh(
    new THREE.BoxGeometry(Math.min(1.6, halfW), 1.1, Math.min(1.6, halfD)),
    new THREE.MeshStandardMaterial({ color: 0xb9c4d6, roughness: 0.6 }),
  );
  core.position.set(0, 0.55, 0);
  scene.add(core);

  // Soft grid helper.
  const grid = new THREE.GridHelper(Math.max(width, depth) * 2, Math.round(Math.max(width, depth) * 2), 0xcbd5e1, 0xe2e8f0);
  grid.position.y = 0.01;
  scene.add(grid);
  return grid;
}

export default function Unit3DScene({ modelUrl, fallback }: { modelUrl: string | null; fallback: Fallback }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 420;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf1f5f9);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 2000);
    camera.position.set(9, 8, 11);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 1, 0);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dir = new THREE.DirectionalLight(0xffffff, 1.1);
    dir.position.set(6, 10, 8);
    dir.castShadow = true;
    scene.add(dir);
    const fill = new THREE.DirectionalLight(0xbfd0ff, 0.4);
    fill.position.set(-6, 4, -6);
    scene.add(fill);

    const grid = buildFallbackScene(scene, fallback);
    let modelRoot: THREE.Group | null = null;
    let autoRotate = false;
    let disposed = false;

    if (modelUrl) {
      const loader = new GLTFLoader();
      loader.load(
        modelUrl,
        (gltf) => {
          if (disposed) return;
          modelRoot = gltf.scene;
          modelRoot.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (mesh.isMesh) {
              mesh.castShadow = true;
              mesh.receiveShadow = true;
            }
          });
          const box = new THREE.Box3().setFromObject(modelRoot);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z) || 1;
          const fov = camera.fov * (Math.PI / 180);
          const fit = (maxDim / 2) / Math.tan(fov / 2);
          camera.position.set(center.x + fit, center.y + fit * 0.8, center.z + fit);
          controls.target.copy(center);
          // Remove fallback geometry once a real model arrives.
          scene.children.slice().forEach((child) => {
            if (child !== modelRoot && child !== dir && child !== fill && (child as THREE.Mesh).isMesh) scene.remove(child);
          });
          if (grid) scene.remove(grid);
          scene.add(modelRoot!);
          controls.update();
        },
        undefined,
        () => { /* keep the fallback scene on failure */ },
      );
    }

    const onRotate = () => { autoRotate = !autoRotate; };
    const onReset = () => {
      camera.position.set(9, 8, 11);
      camera.lookAt(0, 0, 0);
      controls.target.set(0, 1, 0);
      controls.update();
    };
    window.addEventListener("unit3d:toggle-rotate", onRotate);
    window.addEventListener("unit3d:reset", onReset);

    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      if (modelRoot && autoRotate) modelRoot.rotation.y = (modelRoot.rotation.y ?? 0) + 0.004;
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("unit3d:toggle-rotate", onRotate);
      window.removeEventListener("unit3d:reset", onReset);
      window.removeEventListener("resize", onResize);
      controls.dispose();
      renderer.dispose();
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry?.dispose();
          const mat = mesh.material as THREE.Material | THREE.Material[];
          Array.isArray(mat) ? mat.forEach((m) => m.dispose()) : mat?.dispose();
        }
      });
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
    };
  }, [modelUrl, fallback]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%", minHeight: 280 }} />;
}
