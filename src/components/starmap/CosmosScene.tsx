/**
 * CosmosScene — fully imperative Three.js rendering.
 *
 * WHY IMPERATIVE: The Enter.pro dev-tools babel plugin injects `data-source-*`
 * props into every JSX element. R3F's reconciler tries to set these as Three.js
 * object path-traversal properties and throws. Fix: create ALL Three.js objects
 * inside useEffect imperatively. Only uppercase React components are used as JSX.
 * Even <Html> from drei must be called as createElement(Html, ...) because drei's
 * Html returns React.createElement("group", _extends({}, props, {ref})) — spreading
 * babel-injected props onto a THREE.Group.
 */

import { useRef, useMemo, useState, useCallback, useEffect, createElement } from 'react';
import { useThree, useFrame }   from '@react-three/fiber';
import { OrbitControls, Html }  from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

import { type CosmosLayout, type CosmosNote } from './cosmos-layout';
import { NodeWindow }  from './NodeWindow';
import type { HoveredNodeInfo } from './KnowledgeStarMap';
import type { NodeType } from '@/types';

const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";
const INTER = "'Inter',system-ui,sans-serif";

const NODE_TYPE_CFG: Record<string, { label: string; color: string }> = {
  capture:  { label: 'CAPTURE',  color: '#00ff66' },
  summary:  { label: 'SUMMARY',  color: '#66f0ff' },
  insight:  { label: 'INSIGHT',  color: '#b496ff' },
  action:   { label: 'ACTION',   color: '#ff4466' },
  question: { label: 'QUESTION', color: '#ffa040' },
  relation: { label: 'RELATION', color: '#c0c8d8' },
};

/** Pick Three.js geometry based on knowledge node type */
function makeNodeGeometry(nodeType: NodeType | undefined, size: number): THREE.BufferGeometry {
  switch (nodeType) {
    case 'summary':  return new THREE.OctahedronGeometry(size * 1.05);
    case 'insight':  return new THREE.IcosahedronGeometry(size * 0.95, 1);
    case 'action':   return new THREE.BoxGeometry(size * 1.2, size * 1.2, size * 1.2);
    case 'question': return new THREE.TetrahedronGeometry(size * 1.15);
    case 'relation': return new THREE.TorusGeometry(size * 0.8, size * 0.25, 8, 16);
    default:         return new THREE.SphereGeometry(size, 18, 18); // 'capture' or unknown
  }
}

const INIT_CAM_POS  = new THREE.Vector3(0, 0, 90);
const INIT_CAM_TGT  = new THREE.Vector3(0, 0, 0);

// ── Public API ────────────────────────────────────────────────────────────────
export interface CosmosSceneProps {
  layout:              CosmosLayout;
  notes:               CosmosNote[];
  highlightedNoteIds?: string[];
  flashNoteId?:        string | null;
  openNodes:           Set<string>;
  onNodeToggle:        (id: string) => void;
  onNodeHover?:        (info: HoveredNodeInfo | null) => void;
  recenterActiveRef:   React.MutableRefObject<boolean>;
  onLodChange?:        (level: 0 | 1 | 2) => void;
  onFlashNote?:        (id: string) => void;
  userId?:             string;
  entranceNoteId?:     string;
  onEmptyStateClick?:  () => void;
  onNodeConnect?:      (sourceId: string, targetId: string) => void;
  onNodeDropToGalaxy?: (noteId: string, galaxyTag: string | null) => void;
  onNodeDropToPod?:    (noteId: string, podId: string) => void;
  onNodeWorkbenchSelect?: (noteId: string) => void;
}

// ── ImperativeCore ────────────────────────────────────────────────────────────
interface CoreProps {
  layout:             CosmosLayout;
  notes:              CosmosNote[];
  highlightSet:       Set<string>;
  flashNoteId:        string | null;
  openNodes:          Set<string>;
  hoveredId:          string | null;
  setHoveredId:       (id: string | null) => void;
  onNodeToggle:       (id: string) => void;
  onNodeHover?:       (info: HoveredNodeInfo | null) => void;
  currentPosRef:      React.MutableRefObject<Map<string, THREE.Vector3>>;
  recenterActiveRef:  React.MutableRefObject<boolean>;
  onLodChange?:       (level: 0 | 1 | 2) => void;
  entranceNoteId?:    string;
  onEmptyStateClick?: () => void;
  onNodeConnect?:     (sourceId: string, targetId: string) => void;
  onNodeDropToGalaxy?: (noteId: string, galaxyTag: string | null) => void;
  onNodeDropToPod?:    (noteId: string, podId: string) => void;
  onNodeWorkbenchSelect?: (noteId: string) => void;
}

function ImperativeCore({
  layout, notes, highlightSet, flashNoteId, openNodes,
  hoveredId, setHoveredId, onNodeToggle, onNodeHover,
  currentPosRef, recenterActiveRef, onLodChange,
  entranceNoteId, onEmptyStateClick, onNodeConnect, onNodeDropToGalaxy, onNodeDropToPod,
  onNodeWorkbenchSelect,
}: CoreProps) {
  const { scene, camera, gl } = useThree();

  // ── Fast-lookup refs ───────────────────────────────────────────────────────
  const meshToNoteId     = useRef(new Map<THREE.Mesh, string>());
  const noteMeshes       = useRef(new Map<string, THREE.Mesh>());
  const animPhases       = useRef(new Map<string, number>());
  const notesMapRef      = useRef(new Map<string, CosmosNote>());
  const flashTimesRef    = useRef(new Map<string, number>());

  // Shared materials per cluster color
  const sharedMatsRef    = useRef(new Map<string, THREE.MeshStandardMaterial>());

  // Edge refs
  const edgesByNoteIdRef = useRef(new Map<string, THREE.Line[]>());
  const allEdgeLinesRef  = useRef<THREE.Line[]>([]);

  // Halo/ring refs for LOD opacity
  const haloMeshesRef    = useRef<THREE.Mesh[]>([]);
  const ringMeshesRef    = useRef<THREE.Mesh[]>([]);
  // Galaxy-keyed maps for targeted animation during drag-to-galaxy
  const halosByTagRef    = useRef(new Map<string, THREE.Mesh>());
  const ringsByTagRef    = useRef(new Map<string, THREE.Mesh>());
  // Flag: drag-to-galaxy mode is active (hold timer fired)
  const galaxyDragActiveRef = useRef(false);
  // Global listener refs (attached during active drag so events fire even over dock)
  const globalMoveRef = useRef<((e: MouseEvent) => void) | null>(null);
  const globalUpRef   = useRef<((e: MouseEvent) => void) | null>(null);

  // Entrance / empty state refs
  const emptyCTAMeshRef  = useRef<THREE.Mesh | null>(null);
  const emptyRingsRef    = useRef<THREE.Mesh[]>([]);
  const entranceRingsRef = useRef<THREE.Mesh[]>([]);
  const waveRingsRef     = useRef<Array<{ mesh: THREE.Mesh; startT: number }>>([]);

  // Camera fly-in ref
  const flyTargetRef     = useRef<THREE.Vector3 | null>(null);

  // Drag feedback ref
  const isDraggingRef    = useRef(false);

  // Drag-to-connect state
  type ConnectState = {
    sourceId:           string;
    sourceMesh:         THREE.Mesh;
    sourceOrigScale:    THREE.Vector3;
    sourceOrigEmit:     number;
    line:               THREE.Line | null;
    potentialTargetId:  string | null;
    potentialGalaxyTag: string | null;   // galaxy tag under cursor
  };
  const connectStateRef  = useRef<ConnectState | null>(null);
  const holdTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onNodeConnectRef      = useRef(onNodeConnect);
  const onNodeDropToGalaxyRef = useRef(onNodeDropToGalaxy);
  const onNodeDropToPodRef    = useRef(onNodeDropToPod);
  const onNodeWorkbenchSelectRef = useRef(onNodeWorkbenchSelect);

  // Auto-rotate management
  const orbitAutoRotate  = useRef(true);
  const autoRotateTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // LOD tracking
  const lodLevelRef      = useRef<0 | 1 | 2>(0);
  const lastHoveredRef   = useRef<string | null>(null);
  const frameCountRef    = useRef(0);

  // Stale-closure-safe refs
  const hoveredIdRef          = useRef<string | null>(null);
  const onToggleRef           = useRef(onNodeToggle);
  const onHoverRef            = useRef(onNodeHover);
  const onEmptyStateClickRef  = useRef(onEmptyStateClick);
  useEffect(() => { hoveredIdRef.current          = hoveredId;         }, [hoveredId]);
  useEffect(() => { onToggleRef.current           = onNodeToggle;      }, [onNodeToggle]);
  useEffect(() => { onHoverRef.current            = onNodeHover;       }, [onNodeHover]);
  useEffect(() => { onEmptyStateClickRef.current  = onEmptyStateClick; }, [onEmptyStateClick]);
  useEffect(() => { onNodeConnectRef.current      = onNodeConnect;      }, [onNodeConnect]);
  useEffect(() => { onNodeDropToGalaxyRef.current = onNodeDropToGalaxy; }, [onNodeDropToGalaxy]);
  useEffect(() => { onNodeDropToPodRef.current    = onNodeDropToPod;    }, [onNodeDropToPod]);
  useEffect(() => { onNodeWorkbenchSelectRef.current = onNodeWorkbenchSelect; }, [onNodeWorkbenchSelect]);

  // ── Build scene imperatively ───────────────────────────────────────────────
  useEffect(() => {
    const group = new THREE.Group();
    group.name  = 'cosmos-core';

    meshToNoteId.current.clear();
    noteMeshes.current.clear();
    animPhases.current.clear();
    notesMapRef.current.clear();
    edgesByNoteIdRef.current.clear();
    allEdgeLinesRef.current  = [];
    haloMeshesRef.current    = [];
    ringMeshesRef.current    = [];
    halosByTagRef.current.clear();
    ringsByTagRef.current.clear();
    entranceRingsRef.current = [];
    emptyRingsRef.current    = [];
    emptyCTAMeshRef.current  = null;

    sharedMatsRef.current.forEach(m => m.dispose());
    sharedMatsRef.current.clear();
    const sharedMats = sharedMatsRef.current;

    // ── Lights ──────────────────────────────────────────────────────────────
    const ambient = new THREE.AmbientLight(0x000000, 0.04);
    const p1 = new THREE.PointLight(0x3050a0, 0.8, 120, 2);
    const p2 = new THREE.PointLight(0x00ff66, 0.5, 150, 2);
    p2.position.set(50, 30, 20);
    const p3 = new THREE.PointLight(0x66f0ff, 0.4, 150, 2);
    p3.position.set(-50, -20, -30);
    group.add(ambient, p1, p2, p3);

    // ── Star field ──────────────────────────────────────────────────────────
    const starCount     = 9000;
    const starPositions = new Float32Array(starCount * 3);
    const starColors    = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r     = 280 + Math.random() * 200;
      const theta = Math.acos(1 - 2 * Math.random());
      const phi   = 2 * Math.PI * Math.random();
      starPositions[i * 3]     = r * Math.sin(theta) * Math.cos(phi);
      starPositions[i * 3 + 1] = r * Math.sin(theta) * Math.sin(phi);
      starPositions[i * 3 + 2] = r * Math.cos(theta);
      const c = new THREE.Color().setHSL(0.58 + Math.random() * 0.10, 0.25, 0.65 + Math.random() * 0.35);
      starColors[i * 3] = c.r; starColors[i * 3 + 1] = c.g; starColors[i * 3 + 2] = c.b;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeo.setAttribute('color',    new THREE.BufferAttribute(starColors, 3));
    const starMat = new THREE.PointsMaterial({
      size: 0.28, vertexColors: true, sizeAttenuation: true,
      transparent: true, opacity: 0.72, depthWrite: false,
    });
    group.add(new THREE.Points(starGeo, starMat));

    // ── Galaxy cluster halos ─────────────────────────────────────────────────
    layout.clusters.forEach(cluster => {
      if (cluster.tag === '__untagged__' || cluster.noteIds.length < 2) return;
      const haloGeo = new THREE.SphereGeometry(cluster.radius, 20, 20);
      const haloMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(cluster.color), transparent: true,
        opacity: 0.022, side: THREE.BackSide, depthWrite: false,
      });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.position.set(...cluster.center);
      group.add(halo);
      haloMeshesRef.current.push(halo);
      halosByTagRef.current.set(cluster.tag, halo);

      const ringGeo = new THREE.RingGeometry(cluster.radius * 0.85, cluster.radius, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(cluster.color), transparent: true,
        opacity: 0.055, side: THREE.DoubleSide, depthWrite: false,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.set(...cluster.center);
      group.add(ring);
      ringMeshesRef.current.push(ring);
      ringsByTagRef.current.set(cluster.tag, ring);
    });

    // ── Connection edges ─────────────────────────────────────────────────────
    layout.edges.forEach(edge => {
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(...edge.from),
        new THREE.Vector3(...edge.to),
      ]);
      const mat = new THREE.LineBasicMaterial({
        color: new THREE.Color(edge.color), transparent: true,
        opacity: 0, depthWrite: false,
      });
      const line = new THREE.Line(geo, mat);
      group.add(line);
      allEdgeLinesRef.current.push(line);
      for (const id of [edge.fromNoteId, edge.toNoteId]) {
        if (!edgesByNoteIdRef.current.has(id)) edgesByNoteIdRef.current.set(id, []);
        edgesByNoteIdRef.current.get(id)!.push(line);
      }
    });

    // ── Note nodes ───────────────────────────────────────────────────────────
    notes.forEach(note => {
      notesMapRef.current.set(note.id, note);
      const np = layout.positions[note.id];
      if (!np) return;
      let h = 0;
      for (let i = 0; i < note.id.length; i++) h = (h * 31 + note.id.charCodeAt(i)) | 0;
      animPhases.current.set(note.id, (h >>> 0) / 0xffffffff * Math.PI * 2);
      if (!sharedMatsRef.current.has(np.color)) {
        sharedMatsRef.current.set(np.color, new THREE.MeshStandardMaterial({
          color: new THREE.Color('black'),
          emissive: new THREE.Color(np.color),
          emissiveIntensity: 0.7, roughness: 0.1, metalness: 0.1,
        }));
      }
      const mat  = sharedMatsRef.current.get(np.color)!.clone();
      const size = 0.50 + (note.tags?.length ?? 0) * 0.06;
      const geo  = makeNodeGeometry(note.node_type as NodeType, size);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(...np.pos);
      mesh.name     = `note-${note.id}`;
      mesh.userData = { noteId: note.id };
      group.add(mesh);
      meshToNoteId.current.set(mesh, note.id);
      noteMeshes.current.set(note.id, mesh);
      currentPosRef.current.set(note.id, mesh.position.clone());
    });

    // ── Entrance note rings (most recent note) ───────────────────────────────
    if (entranceNoteId && noteMeshes.current.has(entranceNoteId)) {
      const entranceMesh = noteMeshes.current.get(entranceNoteId)!;
      const basePos = entranceMesh.position.clone();
      const np = layout.positions[entranceNoteId];
      const color = np?.color ?? '#00ff66';

      for (let i = 0; i < 2; i++) {
        const r = 1.4 + i * 0.7;
        const rGeo = new THREE.RingGeometry(r, r + 0.14, 56);
        const rMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(color), transparent: true,
          opacity: 0.80 - i * 0.20, side: THREE.DoubleSide, depthWrite: false,
        });
        const rMesh = new THREE.Mesh(rGeo, rMat);
        rMesh.position.copy(basePos);
        rMesh.userData = { baseRadius: r, ringIdx: i, entranceNoteId };
        group.add(rMesh);
        entranceRingsRef.current.push(rMesh);
      }
    }

    // ── Empty state: Glowing entrance orb + pulsing rings ───────────────────
    if (notes.length === 0) {
      // Central orb
      const orbGeo = new THREE.SphereGeometry(1.8, 28, 28);
      const orbMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color('black'),
        emissive: new THREE.Color('#00ff66'),
        emissiveIntensity: 2.2,
        roughness: 0.0, metalness: 0.0,
      });
      const orb = new THREE.Mesh(orbGeo, orbMat);
      orb.position.set(0, 0, 0);
      orb.name = '__empty_cta__';
      group.add(orb);
      emptyCTAMeshRef.current = orb;

      // Concentric pulsing rings
      for (let i = 0; i < 3; i++) {
        const baseR = 3.5 + i * 2.2;
        const rGeo = new THREE.RingGeometry(baseR, baseR + 0.12, 64);
        const rMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color('#00ff66'), transparent: true,
          opacity: 0.35 - i * 0.08, side: THREE.DoubleSide, depthWrite: false,
        });
        const rMesh = new THREE.Mesh(rGeo, rMat);
        rMesh.position.set(0, 0, 0);
        rMesh.userData = { ringIdx: i, baseOpacity: 0.35 - i * 0.08 };
        group.add(rMesh);
        emptyRingsRef.current.push(rMesh);
      }
    }

    scene.add(group);

    return () => {
      scene.remove(group);
      group.traverse(obj => {
        if ('geometry' in obj) (obj as THREE.Mesh).geometry?.dispose();
        if ('material' in obj) {
          const m = (obj as THREE.Mesh).material;
          if (Array.isArray(m)) m.forEach(x => x.dispose()); else m?.dispose();
        }
      });
      sharedMats.forEach(m => m.dispose());
      sharedMats.clear();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, layout, scene]);

  // ── Click / drag-to-connect / hover via canvas events ────────────────────
  useEffect(() => {
    const canvas = gl.domElement;
    let downX = 0, downY = 0, downShift = false;

    const getPointer = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      return new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width)  *  2 - 1,
        ((e.clientY - rect.top)  / rect.height) * -2 + 1,
      );
    };

    /** Project screen mouse → 3-D point on the plane z = planeZ */
    const getPointer3D = (e: MouseEvent, planeZ: number): THREE.Vector3 | null => {
      const ptr = getPointer(e);
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ptr, camera);
      const plane  = new THREE.Plane(new THREE.Vector3(0, 0, 1), -planeZ);
      const target = new THREE.Vector3();
      return ray.ray.intersectPlane(plane, target) ? target : null;
    };

    /** Clean up a drag-to-connect session without triggering a connection */
    const cancelConnect = () => {
      const cs = connectStateRef.current;
      if (!cs) return;
      // Restore source node visuals
      cs.sourceMesh.scale.copy(cs.sourceOrigScale);
      (cs.sourceMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = cs.sourceOrigEmit;
      // Remove potential node-target highlight
      if (cs.potentialTargetId) {
        const tm = noteMeshes.current.get(cs.potentialTargetId);
        if (tm) {
          const np = layout.positions[cs.potentialTargetId];
          (tm.material as THREE.MeshStandardMaterial).emissiveIntensity = np?.emissiveIntensity ?? 1.2;
          tm.scale.setScalar(1.0);
        }
      }
      // Restore galaxy halo highlight
      if (cs.potentialGalaxyTag) {
        const halo = halosByTagRef.current.get(cs.potentialGalaxyTag);
        const ring = ringsByTagRef.current.get(cs.potentialGalaxyTag);
        if (halo) halo.scale.setScalar(1.0);
        if (ring) ring.scale.setScalar(1.0);
      }
      // Remove drag line
      if (cs.line) {
        scene.remove(cs.line);
        cs.line.geometry.dispose();
        (cs.line.material as THREE.LineBasicMaterial).dispose();
      }
      connectStateRef.current = null;
      galaxyDragActiveRef.current = false;
      // Remove global listeners and dispatch drag-end event
      if (globalMoveRef.current) { window.removeEventListener('mousemove', globalMoveRef.current); globalMoveRef.current = null; }
      if (globalUpRef.current)   { window.removeEventListener('mouseup',   globalUpRef.current);   globalUpRef.current   = null; }
      window.dispatchEvent(new CustomEvent('cosmos:pod-drag', { detail: { active: false } }));
    };

    const onDown = (e: MouseEvent) => {
      downX = e.clientX; downY = e.clientY;
      downShift = e.shiftKey;
      isDraggingRef.current   = false;
      orbitAutoRotate.current = false;
      if (autoRotateTimer.current) clearTimeout(autoRotateTimer.current);
      if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }

      // Hit-test for a note mesh
      const rc = new THREE.Raycaster();
      rc.setFromCamera(getPointer(e), camera);
      const meshes = Array.from(meshToNoteId.current.keys());
      const hits   = rc.intersectObjects(meshes);
      if (!hits.length) return;
      const hitMesh = hits[0].object as THREE.Mesh;
      const noteId  = meshToNoteId.current.get(hitMesh);
      if (!noteId) return;

      // Shift+click → workbench selection, skip hold-drag timer
      if (e.shiftKey) return;

      // Start 350 ms hold timer → enter drag-to-connect mode
      holdTimerRef.current = setTimeout(() => {
        holdTimerRef.current = null;
        const srcMesh = noteMeshes.current.get(noteId);
        if (!srcMesh) return;
        const mat = srcMesh.material as THREE.MeshStandardMaterial;
        const origEmit = mat.emissiveIntensity;
        const origScale = srcMesh.scale.clone();

        // Visual: lift source node
        mat.emissiveIntensity = 4.5;
        srcMesh.scale.setScalar(1.65);

        // Create dashed drag line (two-point BufferGeometry)
        const lineGeo = new THREE.BufferGeometry();
        const pts = new Float32Array(6);
        lineGeo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
        const np = layout.positions[noteId];
        const lineMat = new THREE.LineBasicMaterial({
          color: new THREE.Color(np?.color ?? '#00ff66'),
          transparent: true, opacity: 0, linewidth: 2,
        });
        const dragLine = new THREE.Line(lineGeo, lineMat);
        dragLine.name = '__drag_connect_line__';
        scene.add(dragLine);

        connectStateRef.current = {
          sourceId:           noteId,
          sourceMesh:         srcMesh,
          sourceOrigScale:    origScale,
          sourceOrigEmit:     origEmit,
          line:               dragLine,
          potentialTargetId:  null,
          potentialGalaxyTag: null,
        };
        galaxyDragActiveRef.current = true;

        // Attach global listeners so mouseup fires even when cursor is over the dock
        const gMove = (ev: MouseEvent) => onMove(ev);
        const gUp   = (ev: MouseEvent) => onUp(ev);
        globalMoveRef.current = gMove;
        globalUpRef.current   = gUp;
        window.addEventListener('mousemove', gMove);
        window.addEventListener('mouseup',   gUp);

        // Notify CommandDock to enter receiving mode
        window.dispatchEvent(new CustomEvent('cosmos:pod-drag', {
          detail: { active: true, noteId },
        }));

        navigator.vibrate?.(30);
      }, 350);
    };

    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - downX, dy = e.clientY - downY;
      if (Math.sqrt(dx * dx + dy * dy) > 6) isDraggingRef.current = true;

      const cs = connectStateRef.current;
      if (!cs || !cs.line) return;

      // Cancel hold timer once we're clearly dragging
      if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; cancelConnect(); return; }

      // Broadcast cursor position so dock can compute hover
      window.dispatchEvent(new CustomEvent('cosmos:pod-drag', {
        detail: { active: true, noteId: cs.sourceId, x: e.clientX, y: e.clientY },
      }));

      // Update drag line endpoint
      const cursor3D = getPointer3D(e, cs.sourceMesh.position.z);
      if (!cursor3D) return;
      const pos = cs.line.geometry.getAttribute('position') as THREE.BufferAttribute;
      const src = cs.sourceMesh.position;
      pos.setXYZ(0, src.x, src.y, src.z);
      pos.setXYZ(1, cursor3D.x, cursor3D.y, cursor3D.z);
      pos.needsUpdate = true;
      (cs.line.material as THREE.LineBasicMaterial).opacity = 0.85;

      // Detect potential target (nearest note mesh under cursor, excl. source)
      const rc = new THREE.Raycaster();
      rc.setFromCamera(getPointer(e), camera);
      const candidates = Array.from(meshToNoteId.current.keys())
        .filter(m => meshToNoteId.current.get(m) !== cs.sourceId);
      const hits = rc.intersectObjects(candidates);
      const newTarget = hits.length ? (meshToNoteId.current.get(hits[0].object as THREE.Mesh) ?? null) : null;

      if (newTarget !== cs.potentialTargetId) {
        // Un-highlight previous target
        if (cs.potentialTargetId) {
          const pm = noteMeshes.current.get(cs.potentialTargetId);
          if (pm) { (pm.material as THREE.MeshStandardMaterial).emissiveIntensity = layout.positions[cs.potentialTargetId]?.emissiveIntensity ?? 1.2; pm.scale.setScalar(1.0); }
        }
        // Highlight new target
        if (newTarget) {
          const tm = noteMeshes.current.get(newTarget);
          if (tm) { (tm.material as THREE.MeshStandardMaterial).emissiveIntensity = 5.0; tm.scale.setScalar(1.55); }
        }
        cs.potentialTargetId = newTarget;
      }

      // Galaxy zone detection (only when no note is under cursor)
      let newGalaxyTag: string | null = null;
      if (!newTarget && cursor3D) {
        for (const cluster of layout.clusters) {
          if (cluster.tag === '__untagged__') continue;
          const cx = new THREE.Vector3(...cluster.center);
          if (cursor3D.distanceTo(cx) < cluster.radius * 1.4) {
            newGalaxyTag = cluster.tag;
            break;
          }
        }
      }

      if (newGalaxyTag !== cs.potentialGalaxyTag) {
        // Restore previous galaxy halo
        if (cs.potentialGalaxyTag) {
          const ph = halosByTagRef.current.get(cs.potentialGalaxyTag);
          const pr = ringsByTagRef.current.get(cs.potentialGalaxyTag);
          if (ph) ph.scale.setScalar(1.0);
          if (pr) pr.scale.setScalar(1.0);
        }
        // Highlight new galaxy halo
        if (newGalaxyTag) {
          const nh = halosByTagRef.current.get(newGalaxyTag);
          const nr = ringsByTagRef.current.get(newGalaxyTag);
          if (nh) nh.scale.setScalar(1.15);
          if (nr) nr.scale.setScalar(1.15);
          // Update drag line color to match galaxy
          const cluster = layout.clusters.find(c => c.tag === newGalaxyTag);
          if (cluster && cs.line) {
            (cs.line.material as THREE.LineBasicMaterial).color.set(new THREE.Color(cluster.color));
          }
        } else {
          // Restore drag line to source node color
          const np = layout.positions[cs.sourceId];
          if (np && cs.line) {
            (cs.line.material as THREE.LineBasicMaterial).color.set(new THREE.Color(np.color));
          }
        }
        cs.potentialGalaxyTag = newGalaxyTag;
      }
    };

    const onUp = (e: MouseEvent) => {
      const dx = e.clientX - downX, dy = e.clientY - downY;
      isDraggingRef.current = false;
      if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
      autoRotateTimer.current = setTimeout(() => { orbitAutoRotate.current = true; }, 3000);

      // ── Drag-to-connect / drag-to-galaxy / drag-to-pod release ─────────
      if (connectStateRef.current) {
        const { sourceId, potentialTargetId, potentialGalaxyTag } = connectStateRef.current;

        // 1. Check if dropped on a dock button (expand hit area ±14px for comfort)
        const podEls = document.querySelectorAll('[data-pod-id]');
        let droppedPodId: string | null = null;
        for (const el of podEls) {
          const r = el.getBoundingClientRect();
          if (e.clientX >= r.left - 14 && e.clientX <= r.right  + 14 &&
              e.clientY >= r.top  - 14 && e.clientY <= r.bottom + 14) {
            droppedPodId = el.getAttribute('data-pod-id');
            break;
          }
        }

        cancelConnect(); // also cleans up global listeners + dispatches deactivate

        if (droppedPodId) {
          // Dispatch flash event for dock button animation
          window.dispatchEvent(new CustomEvent('cosmos:pod-drop', { detail: { podId: droppedPodId } }));
          onNodeDropToPodRef.current?.(sourceId, droppedPodId);
        } else if (potentialTargetId && potentialTargetId !== sourceId) {
          onNodeConnectRef.current?.(sourceId, potentialTargetId);
        } else {
          onNodeDropToGalaxyRef.current?.(sourceId, potentialGalaxyTag);
        }
        return;
      }

      // ── Normal click (no drag) ───────────────────────────────────────────
      if (Math.sqrt(dx*dx + dy*dy) > 6) return;

      const rc = new THREE.Raycaster();
      rc.setFromCamera(getPointer(e), camera);

      const allMeshes: THREE.Mesh[] = Array.from(meshToNoteId.current.keys());
      if (emptyCTAMeshRef.current) allMeshes.push(emptyCTAMeshRef.current);

      const hits = rc.intersectObjects(allMeshes);
      if (hits.length) {
        const hitMesh = hits[0].object as THREE.Mesh;
        if (hitMesh === emptyCTAMeshRef.current) {
          const waveGeo = new THREE.RingGeometry(1.9, 2.3, 64);
          const waveMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color('#00ff66'), transparent: true,
            opacity: 0.85, side: THREE.DoubleSide, depthWrite: false,
          });
          const waveMesh = new THREE.Mesh(waveGeo, waveMat);
          waveMesh.position.set(0, 0, 0);
          scene.add(waveMesh);
          waveRingsRef.current.push({ mesh: waveMesh, startT: performance.now() / 1000 });
          flyTargetRef.current = new THREE.Vector3(0, 0, 0);
          onEmptyStateClickRef.current?.();
          return;
        }
        const id = meshToNoteId.current.get(hitMesh);
        if (id) {
          if (downShift) {
            // Shift+click → workbench multi-select
            onNodeWorkbenchSelectRef.current?.(id);
          } else {
            const worldPos = noteMeshes.current.get(id)?.position.clone();
            if (worldPos) flyTargetRef.current = worldPos.clone();
            onToggleRef.current(id);
          }
        }
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelConnect();
    };

    // ── Right-click: dispatch cosmos-context-menu CustomEvent ─────────────
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      const rect   = canvas.getBoundingClientRect();
      const mouse  = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(mouse, camera);
      const allMeshes = Array.from(meshToNoteId.current.keys()) as THREE.Mesh[];
      const hits      = raycaster.intersectObjects(allMeshes);
      if (hits.length) {
        const hitId = meshToNoteId.current.get(hits[0].object as THREE.Mesh);
        if (hitId) {
          window.dispatchEvent(new CustomEvent('cosmos-context-menu', {
            detail: { noteId: hitId, x: e.clientX, y: e.clientY },
          }));
        }
      }
    };

    canvas.addEventListener('mousedown',    onDown);
    canvas.addEventListener('mousemove',    onMove);
    canvas.addEventListener('mouseup',      onUp);
    canvas.addEventListener('contextmenu',  onContextMenu);
    window.addEventListener('keydown',      onKeyDown);
    return () => {
      canvas.removeEventListener('mousedown',   onDown);
      canvas.removeEventListener('mousemove',   onMove);
      canvas.removeEventListener('mouseup',     onUp);
      canvas.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keydown',     onKeyDown);
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (autoRotateTimer.current) clearTimeout(autoRotateTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, gl]);

  // ── Animation + LOD + hover edges ─────────────────────────────────────────
  const raycaster = useRef(new THREE.Raycaster());

  useFrame(({ clock, pointer, controls }) => {
    const t    = clock.getElapsedTime();
    const dist = camera.position.length();

    frameCountRef.current++;

    // ── OrbitControls: disable during drag-to-connect ───────────────────────
    if (controls) {
      const ctrl = controls as unknown as { enabled: boolean; autoRotate: boolean };
      ctrl.enabled     = !connectStateRef.current;
      ctrl.autoRotate  = orbitAutoRotate.current && !connectStateRef.current;
    }

    // ── Drag line pulse animation ───────────────────────────────────────────
    if (connectStateRef.current?.line) {
      const mat = connectStateRef.current.line.material as THREE.LineBasicMaterial;
      mat.opacity = 0.6 + Math.sin(t * 7) * 0.25;
    }

    // ── Galaxy-drag mode: all halos brighter, potential galaxy pulses ───────
    if (galaxyDragActiveRef.current) {
      const potTag = connectStateRef.current?.potentialGalaxyTag ?? null;
      haloMeshesRef.current.forEach(h => {
        const m = h.material as THREE.MeshBasicMaterial;
        // Raise base opacity so all halos become more visible as "landing zones"
        const baseOpacity = potTag ? 0.05 : 0.055;
        m.opacity = THREE.MathUtils.lerp(m.opacity, baseOpacity, 0.08);
      });
      ringMeshesRef.current.forEach(r => {
        const m = r.material as THREE.MeshBasicMaterial;
        const baseOpacity = potTag ? 0.10 : 0.12;
        m.opacity = THREE.MathUtils.lerp(m.opacity, baseOpacity, 0.08);
      });
      // Potential galaxy: extra bright + pulse scale
      if (potTag) {
        const ph = halosByTagRef.current.get(potTag);
        const pr = ringsByTagRef.current.get(potTag);
        if (ph) (ph.material as THREE.MeshBasicMaterial).opacity = 0.12 + Math.sin(t * 4) * 0.04;
        if (pr) (pr.material as THREE.MeshBasicMaterial).opacity = 0.22 + Math.sin(t * 4) * 0.06;
      }
    }

    // ── Camera fly-in tween ─────────────────────────────────────────────────
    if (flyTargetRef.current) {
      const dir = camera.position.clone().sub(flyTargetRef.current).normalize().multiplyScalar(20);
      const targetPos = flyTargetRef.current.clone().add(dir);
      camera.position.lerp(targetPos, 0.055);
      (controls as unknown as { target: THREE.Vector3; update: () => void } | null)?.target?.lerp(flyTargetRef.current, 0.055);
      (controls as unknown as { update: () => void } | null)?.update?.();
      if (camera.position.distanceTo(targetPos) < 1.5) flyTargetRef.current = null;
    }

    // ── Camera recenter tween ───────────────────────────────────────────────
    if (recenterActiveRef.current) {
      camera.position.lerp(INIT_CAM_POS, 0.065);
      (controls as unknown as { target: THREE.Vector3; update: () => void } | null)?.target?.lerp(INIT_CAM_TGT, 0.065);
      (controls as unknown as { update: () => void } | null)?.update?.();
      if (camera.position.distanceTo(INIT_CAM_POS) < 0.8) recenterActiveRef.current = false;
    }

    // ── Auto-rotate sync ────────────────────────────────────────────────────
    if (controls) {
      const oc = controls as unknown as { autoRotate: boolean };
      if (oc.autoRotate !== orbitAutoRotate.current) oc.autoRotate = orbitAutoRotate.current;
    }

    // ── LOD level ───────────────────────────────────────────────────────────
    const newLod: 0 | 1 | 2 = dist < 70 ? 0 : dist < 130 ? 1 : 2;
    if (newLod !== lodLevelRef.current) {
      lodLevelRef.current = newLod;
      onLodChange?.(newLod);
    }

    // ── Halo / ring LOD opacity ──────────────────────────────────────────────
    const haloTarget = dist < 70 ? 0.022 : dist < 130 ? 0.022 * (1 - (dist - 70) / 60) : 0;
    const ringTarget = dist < 70 ? 0.055 : dist < 130 ? 0.055 * (1 - (dist - 70) / 60) : 0;
    haloMeshesRef.current.forEach(h => {
      const m = h.material as THREE.MeshBasicMaterial;
      m.opacity = THREE.MathUtils.lerp(m.opacity, haloTarget, 0.04);
    });
    ringMeshesRef.current.forEach(r => {
      const m = r.material as THREE.MeshBasicMaterial;
      m.opacity = THREE.MathUtils.lerp(m.opacity, ringTarget, 0.04);
    });

    // ── Hover-only edge reveal ───────────────────────────────────────────────
    if (hoveredId !== lastHoveredRef.current) {
      lastHoveredRef.current = hoveredId;
      allEdgeLinesRef.current.forEach(l => { (l.material as THREE.LineBasicMaterial).opacity = 0; });
      if (hoveredId) {
        edgesByNoteIdRef.current.get(hoveredId)?.forEach(l => {
          (l.material as THREE.LineBasicMaterial).opacity = 0.28;
        });
      }
    }

    // ── Empty state orb + ring animation ────────────────────────────────────
    if (emptyCTAMeshRef.current) {
      const orbMat = emptyCTAMeshRef.current.material as THREE.MeshStandardMaterial;
      orbMat.emissiveIntensity = 2.0 + Math.sin(t * 1.8) * 0.6;
      emptyCTAMeshRef.current.scale.setScalar(1 + Math.sin(t * 1.2) * 0.05);
      emptyRingsRef.current.forEach((ring, i) => {
        const m = ring.material as THREE.MeshBasicMaterial;
        const base = ring.userData.baseOpacity as number;
        m.opacity = base * (0.7 + Math.sin(t * 0.9 + i * Math.PI / 1.5) * 0.5);
        const s = 1 + Math.sin(t * 0.6 + i * Math.PI / 1.5) * 0.12;
        ring.scale.setScalar(s);
        ring.rotation.z += 0.003 * (i % 2 === 0 ? 1 : -1);
      });
    }

    // ── Entrance note rings animation ────────────────────────────────────────
    entranceRingsRef.current.forEach((ring, i) => {
      const noteId = ring.userData.entranceNoteId as string;
      const mesh = noteMeshes.current.get(noteId);
      if (mesh) ring.position.copy(mesh.position);
      const m = ring.material as THREE.MeshBasicMaterial;
      m.opacity = 0.65 - i * 0.15 + Math.sin(t * 1.4 + i * Math.PI) * 0.28;
      ring.rotation.z += 0.006 * (i % 2 === 0 ? 1 : -1);
    });

    // ── Radial wave rings (from CTA click) ───────────────────────────────────
    const now = performance.now() / 1000;
    waveRingsRef.current = waveRingsRef.current.filter(({ mesh: wm, startT }) => {
      const elapsed = now - startT;
      const progress = elapsed / 0.70; // 700ms duration
      if (progress >= 1) {
        scene.remove(wm);
        wm.geometry.dispose();
        (wm.material as THREE.MeshBasicMaterial).dispose();
        return false;
      }
      wm.scale.setScalar(1 + progress * 9);
      (wm.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - progress);
      return true;
    });

    // ── Note animation ──────────────────────────────────────────────────────
    const dragBoost = isDraggingRef.current ? 3.0 : 1.0;

    noteMeshes.current.forEach((mesh, noteId) => {
      const np    = layout.positions[noteId];
      if (!np) return;
      const phase = animPhases.current.get(noteId) ?? 0;
      const pulse = Math.sin(t * 1.1 + phase) * 0.3 + 0.6;
      const mat   = mesh.material as THREE.MeshStandardMaterial;

      let scale     = 1.0;
      let intensity = pulse;
      const flashStart = flashTimesRef.current.get(noteId);
      const isEntrance = noteId === entranceNoteId;

      if (flashStart !== undefined) {
        const elapsed = t - flashStart;
        if (elapsed < 1.2) {
          const p = elapsed < 0.4 ? elapsed / 0.4 : 1 - (elapsed - 0.4) / 0.8;
          mat.emissive.setRGB(
            THREE.MathUtils.lerp(new THREE.Color(np.color).r, 1, p),
            THREE.MathUtils.lerp(new THREE.Color(np.color).g, 1, p),
            THREE.MathUtils.lerp(new THREE.Color(np.color).b, 1, p),
          );
          scale     = 1 + p * 0.8;
          intensity = 1.5 + p * 2.0;
        } else {
          flashTimesRef.current.delete(noteId);
          mat.emissive.set(np.color);
        }
      } else if (hoveredId === noteId) {
        scale = 1.4; intensity = 2.2;
      } else if (highlightSet.has(noteId)) {
        scale = 1.25; intensity = 2.0;
      } else if (openNodes.has(noteId)) {
        scale = 1.1; intensity = 1.6;
      } else if (isEntrance) {
        // Entrance note: stronger base glow + pulse
        scale = 1.3 + Math.sin(t * 1.4) * 0.08;
        intensity = 1.8 + Math.sin(t * 1.4) * 0.5;
      }

      mesh.scale.setScalar(scale);
      mat.emissiveIntensity = intensity;

      // Floating motion (amplified during drag for physics feel)
      mesh.position.set(
        np.pos[0] + Math.sin(t * 0.3  + phase)       * 0.18 * dragBoost,
        np.pos[1] + Math.cos(t * 0.25 + phase * 0.8) * 0.22 * dragBoost,
        np.pos[2] + Math.sin(t * 0.2  + phase * 1.3) * 0.15 * dragBoost,
      );
      currentPosRef.current.set(noteId, mesh.position.clone());
    });

    if (flashNoteId && !flashTimesRef.current.has(flashNoteId)) {
      flashTimesRef.current.set(flashNoteId, t);
    }

    // ── Hover raycasting (throttled: every 3rd frame) ───────────────────────
    if (frameCountRef.current % 3 !== 0) return;
    raycaster.current.setFromCamera(pointer, camera);
    const allMeshes: THREE.Object3D[] = Array.from(meshToNoteId.current.keys());
    if (emptyCTAMeshRef.current) allMeshes.push(emptyCTAMeshRef.current);
    const hits = raycaster.current.intersectObjects(allMeshes);
    const hitMesh = hits.length ? hits[0].object as THREE.Mesh : null;
    const hitId = hitMesh && hitMesh !== emptyCTAMeshRef.current
      ? (meshToNoteId.current.get(hitMesh) ?? null)
      : null;

    // Cursor feedback: pointer on any clickable element
    const isCTAHit = hitMesh === emptyCTAMeshRef.current;
    gl.domElement.style.cursor = (hitId || isCTAHit) ? 'pointer' : '';

    if (hitId !== hoveredIdRef.current) {
      hoveredIdRef.current = hitId;
      setHoveredId(hitId);
      if (hitId) {
        const note = notesMapRef.current.get(hitId);
        if (note) onHoverRef.current?.({ noteId: hitId, title: note.title, tags: note.tags, summary: note.summary });
      } else {
        onHoverRef.current?.(null);
      }
    }
  });

  return null;
}

// ── Cluster label ─────────────────────────────────────────────────────────────
function ClusterLabel({ cluster }: { cluster: CosmosLayout['clusters'][0] }) {
  if (cluster.tag === '__untagged__' || cluster.noteIds.length < 3) return null;
  return createElement(Html,
    {
      position: [
        cluster.center[0],
        cluster.center[1] + cluster.radius + 1.5,
        cluster.center[2],
      ] as [number,number,number],
      center: true,
      style: { pointerEvents: 'none', whiteSpace: 'nowrap' },
    },
    <div style={{
      fontFamily: MONO, fontSize: 8, letterSpacing: '0.10em',
      color: `${cluster.color}66`, textTransform: 'uppercase' as const,
    }}>
      {cluster.tag}
    </div>
  );
}

// ── Empty state CTA label ─────────────────────────────────────────────────────
function EmptyCtaLabel({ onClick }: { onClick?: () => void }) {
  return createElement(Html,
    {
      position: [0, -4, 0] as [number,number,number],
      center: true,
      style: { pointerEvents: 'auto', cursor: 'pointer' },
    },
    <div
      onClick={onClick}
      style={{
        fontFamily: MONO, textAlign: 'center' as const,
        animation: 'cosmos-pulse 2.2s ease-in-out infinite',
      }}
    >
      <div style={{ fontSize: 13, letterSpacing: '0.18em', color: 'rgba(0,255,102,0.92)', marginBottom: 7, textTransform: 'uppercase' as const, fontWeight: 700 }}>
        &lt; CLICK TO BEGIN &gt;
      </div>
      <div style={{ fontSize: 9, color: 'rgba(0,255,102,0.48)', letterSpacing: '0.10em' }}>
        在宇宙中创造第一条知识
      </div>
    </div>
  );
}

// ── Main exported scene ───────────────────────────────────────────────────────
export function CosmosScene({
  layout, notes, highlightedNoteIds = [],
  flashNoteId = null, openNodes, onNodeToggle, onNodeHover,
  recenterActiveRef, onLodChange, onFlashNote, userId,
  entranceNoteId, onEmptyStateClick, onNodeConnect, onNodeDropToGalaxy, onNodeDropToPod,
  onNodeWorkbenchSelect,
}: CosmosSceneProps) {
  const highlightSet  = useMemo(() => new Set(highlightedNoteIds), [highlightedNoteIds]);
  const navigate      = useNavigate();
  const [hoveredId,   setHoveredId]  = useState<string | null>(null);
  const currentPosRef = useRef(new Map<string, THREE.Vector3>());
  const notesMap      = useMemo(() => new Map(notes.map(n => [n.id, n])), [notes]);
  const [lodLevel,    setLodLevel]   = useState<0|1|2>(0);
  const [showButtons, setShowButtons] = useState(false);
  const btnTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Show action buttons 200ms after hover starts
  useEffect(() => {
    if (btnTimerRef.current) clearTimeout(btnTimerRef.current);
    if (hoveredId) {
      btnTimerRef.current = setTimeout(() => setShowButtons(true), 200);
    } else {
      setShowButtons(false);
    }
    return () => { if (btnTimerRef.current) clearTimeout(btnTimerRef.current); };
  }, [hoveredId]);

  const handleSetHovered = useCallback((id: string | null) => setHoveredId(id), []);
  const handleLodChange  = useCallback((lv: 0|1|2) => {
    setLodLevel(lv);
    onLodChange?.(lv);
  }, [onLodChange]);

  return (
    <>
      <ImperativeCore
        layout={layout}
        notes={notes}
        highlightSet={highlightSet}
        flashNoteId={flashNoteId ?? null}
        openNodes={openNodes}
        hoveredId={hoveredId}
        setHoveredId={handleSetHovered}
        onNodeToggle={onNodeToggle}
        onNodeHover={onNodeHover}
        currentPosRef={currentPosRef}
        recenterActiveRef={recenterActiveRef}
        onLodChange={handleLodChange}
        entranceNoteId={entranceNoteId}
        onEmptyStateClick={onEmptyStateClick}
        onNodeConnect={onNodeConnect}
        onNodeDropToGalaxy={onNodeDropToGalaxy}
        onNodeDropToPod={onNodeDropToPod}
        onNodeWorkbenchSelect={onNodeWorkbenchSelect}
      />
      {lodLevel === 0 && layout.clusters.map(c => <ClusterLabel key={c.tag} cluster={c} />)}

      {/* Empty state CTA */}
      {notes.length === 0 && <EmptyCtaLabel onClick={onEmptyStateClick} />}

      {/* Hover label — enhanced with type badge, 12px title, tags, time, CTA */}
      {hoveredId && !openNodes.has(hoveredId) && (() => {
        const pos  = currentPosRef.current.get(hoveredId);
        const note = notesMap.get(hoveredId);
        const np   = layout.positions[hoveredId];
        if (!pos || !note || !np) return null;

        const typeCfg = NODE_TYPE_CFG[note.node_type ?? 'capture'] ?? NODE_TYPE_CFG['capture'];
        const timeAgo = note.created_at
          ? formatDistanceToNow(new Date(note.created_at), { locale: zhCN, addSuffix: true })
          : '';
        const isEntrance = note.id === entranceNoteId;

        const r = parseInt(np.color.slice(1,3), 16);
        const g = parseInt(np.color.slice(3,5), 16);
        const b = parseInt(np.color.slice(5,7), 16);

        return createElement(Html,
          {
            key: `label-${hoveredId}`,
            position: [pos.x, pos.y + 2.2, pos.z] as [number,number,number],
            center: true,
            style: { pointerEvents: showButtons ? 'auto' : 'none', whiteSpace: 'nowrap' },
          },
          <div style={{
            width: 220,
            background: 'rgba(1,4,13,0.95)',
            backdropFilter: 'blur(16px)',
            border: `1px solid rgba(${r},${g},${b},0.38)`,
            borderRadius: 8,
            overflow: 'hidden',
            boxShadow: `0 0 24px rgba(${r},${g},${b},0.18), 0 12px 40px rgba(0,0,0,0.70)`,
            animation: 'cosmos-window-in 0.15s cubic-bezier(0.16,1,0.3,1)',
          }}>
            {/* Accent top bar */}
            <div style={{ height: 1.5, background: `linear-gradient(90deg, transparent, ${np.color}, transparent)` }} />
            <div style={{ padding: '8px 10px 8px' }}>
              {/* Type badge row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                <span style={{
                  fontFamily: MONO, fontSize: 7.5, letterSpacing: '0.10em',
                  color: typeCfg.color,
                  background: `${typeCfg.color}15`,
                  border: `1px solid ${typeCfg.color}35`,
                  padding: '1px 5px', borderRadius: 3,
                  textTransform: 'uppercase' as const,
                }}>{typeCfg.label}</span>
                {isEntrance && (
                  <span style={{
                    fontFamily: MONO, fontSize: 7, color: '#ffa040',
                    background: 'rgba(255,160,64,0.12)',
                    border: '1px solid rgba(255,160,64,0.28)',
                    padding: '1px 5px', borderRadius: 3,
                  }}>最近活跃</span>
                )}
              </div>
              {/* Title */}
              <div style={{
                fontFamily: INTER, fontSize: 12, fontWeight: 600,
                color: 'rgba(220,230,250,0.95)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                marginBottom: 6,
              }}>
                {(note.title || '(未命名)').slice(0, 30)}{(note.title || '').length > 30 ? '…' : ''}
              </div>
              {/* Tags + time */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 7 }}>
                {note.tags?.slice(0, 2).map(tag => (
                  <span key={tag} style={{
                    fontFamily: MONO, fontSize: 8, color: `rgba(${r},${g},${b},0.70)`,
                    background: `rgba(${r},${g},${b},0.09)`,
                    border: `1px solid rgba(${r},${g},${b},0.20)`,
                    padding: '1px 5px', borderRadius: 3,
                  }}>#{tag}</span>
                ))}
                {timeAgo && (
                  <span style={{
                    marginLeft: 'auto', fontFamily: MONO, fontSize: 8,
                    color: 'rgba(80,90,115,0.55)',
                  }}>{timeAgo}</span>
                )}
              </div>
              {/* CTA hint / quick action buttons */}
              {showButtons && hoveredId ? (
                <div style={{
                  display: 'flex', gap: 4, paddingTop: 6,
                  borderTop: `1px solid rgba(${r},${g},${b},0.10)`,
                }}>
                  {([
                    { label: '→ 打开', act: () => onNodeToggle(hoveredId),                        bg: `rgba(${r},${g},${b},0.12)`, border: `rgba(${r},${g},${b},0.28)` },
                    { label: '◇ 蒸馏', act: () => onNodeDropToPod?.(hoveredId, 'insight'),        bg: 'rgba(180,150,255,0.10)',    border: 'rgba(180,150,255,0.28)' },
                    { label: '+ 捕获', act: () => onNodeDropToPod?.(hoveredId, 'capture'),        bg: 'rgba(0,255,102,0.08)',      border: 'rgba(0,255,102,0.25)' },
                  ] as { label: string; act: () => void; bg: string; border: string }[]).map(btn => (
                    <button
                      key={btn.label}
                      onClick={e => { e.stopPropagation(); btn.act(); }}
                      style={{
                        flex: 1, padding: '3px 0',
                        fontFamily: MONO, fontSize: 8, letterSpacing: '0.04em',
                        color: `rgba(${r},${g},${b},0.85)`,
                        background: btn.bg,
                        border: `1px solid ${btn.border}`,
                        borderRadius: 4, cursor: 'pointer',
                      }}
                    >{btn.label}</button>
                  ))}
                </div>
              ) : (
                <div style={{
                  fontFamily: MONO, fontSize: 8.5, letterSpacing: '0.05em',
                  color: `rgba(${r},${g},${b},0.55)`,
                  borderTop: `1px solid rgba(${r},${g},${b},0.10)`,
                  paddingTop: 6,
                }}>
                  ▶ 点击展开
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Open node windows */}
      {Array.from(openNodes).map(noteId => {
        const pos  = currentPosRef.current.get(noteId);
        const note = notesMap.get(noteId);
        const np   = layout.positions[noteId];
        if (!pos || !note || !np) return null;
        return createElement(Html,
          {
            key: `win-${noteId}`,
            position: [pos.x + 1.5, pos.y + 1.0, pos.z] as [number,number,number],
            center: false,
            distanceFactor: 18,
            style: { pointerEvents: 'all' },
          },
          <NodeWindow
            note={{ id: note.id, title: note.title, summary: note.summary, tags: note.tags, created_at: note.created_at }}
            accentColor={np.color}
            onClose={() => onNodeToggle(noteId)}
            onNavigate={(id) => navigate(`/app/note/${id}`)}
            onNewNode={onFlashNote}
            userId={userId}
          />
        );
      })}

      {createElement(OrbitControls, {
        enablePan: true, enableZoom: true, enableRotate: true,
        autoRotate: true, autoRotateSpeed: 0.10,
        enableDamping: true, dampingFactor: 0.08,
        zoomSpeed: 0.7, panSpeed: 0.6,
        minDistance: 8, maxDistance: 180,
        makeDefault: true,
      })}

      {createElement(EffectComposer, {},
        createElement(Bloom, {
          luminanceThreshold: 0.20,
          luminanceSmoothing: 0.7,
          intensity: 0.60,
          mipmapBlur: true,
        })
      )}
    </>
  );
}
