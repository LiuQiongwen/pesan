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
 *
 * OPTIMIZATIONS IMPLEMENTED:
 * - LOD: cluster labels hidden at dist > 70, halos/rings fade at dist 70–130
 * - Hover-only edges: all edges hidden by default, hover shows note's connections
 * - Camera recenter: smooth lerp tween on Space / double-click / "↺" button
 * - Auto-rotate: pauses on interaction, resumes after 3 s of inactivity
 * - Raycasting throttle: every 3rd frame
 * - Shared materials: one MeshStandardMaterial per unique cluster color
 * - New-node flash: white emissive pulse with time-based fade
 * - Damped orbit: dampingFactor 0.08
 */

import { useRef, useMemo, useState, useCallback, useEffect, createElement } from 'react';
import { useThree, useFrame }   from '@react-three/fiber';
import { OrbitControls, Html }  from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';

import { type CosmosLayout, type CosmosNote } from './cosmos-layout';
import { NodeWindow }  from './NodeWindow';
import type { HoveredNodeInfo } from './KnowledgeStarMap';

const MONO = "'IBM Plex Mono','Roboto Mono',monospace";
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
}

function ImperativeCore({
  layout, notes, highlightSet, flashNoteId, openNodes,
  hoveredId, setHoveredId, onNodeToggle, onNodeHover,
  currentPosRef, recenterActiveRef, onLodChange,
}: CoreProps) {
  const { scene, camera, gl } = useThree();

  // ── Fast-lookup refs ───────────────────────────────────────────────────────
  const meshToNoteId     = useRef(new Map<THREE.Mesh, string>());
  const noteMeshes       = useRef(new Map<string, THREE.Mesh>());
  const animPhases       = useRef(new Map<string, number>());
  const notesMapRef      = useRef(new Map<string, CosmosNote>());
  const flashTimesRef    = useRef(new Map<string, number>()); // noteId → start time

  // Shared materials per cluster color (reduces material count from N → ≤8)
  const sharedMatsRef    = useRef(new Map<string, THREE.MeshStandardMaterial>());

  // Edge refs for hover-only display
  const edgesByNoteIdRef = useRef(new Map<string, THREE.Line[]>());
  const allEdgeLinesRef  = useRef<THREE.Line[]>([]);

  // Halo/ring refs for LOD opacity
  const haloMeshesRef    = useRef<THREE.Mesh[]>([]);
  const ringMeshesRef    = useRef<THREE.Mesh[]>([]);

  // Auto-rotate management
  const orbitAutoRotate  = useRef(true);
  const autoRotateTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // LOD tracking
  const lodLevelRef      = useRef<0 | 1 | 2>(0);
  const lastHoveredRef   = useRef<string | null>(null);
  const frameCountRef    = useRef(0);

  // Stale-closure-safe refs for callbacks
  const hoveredIdRef  = useRef<string | null>(null);
  const onToggleRef   = useRef(onNodeToggle);
  const onHoverRef    = useRef(onNodeHover);
  useEffect(() => { hoveredIdRef.current = hoveredId; }, [hoveredId]);
  useEffect(() => { onToggleRef.current  = onNodeToggle; }, [onNodeToggle]);
  useEffect(() => { onHoverRef.current   = onNodeHover;  }, [onNodeHover]);

  // ── Build scene imperatively ───────────────────────────────────────────────
  useEffect(() => {
    const group = new THREE.Group();
    group.name  = 'cosmos-core';

    // Clear lookup maps before rebuild
    meshToNoteId.current.clear();
    noteMeshes.current.clear();
    animPhases.current.clear();
    notesMapRef.current.clear();
    edgesByNoteIdRef.current.clear();
    allEdgeLinesRef.current = [];
    haloMeshesRef.current   = [];
    ringMeshesRef.current   = [];

    // Dispose and rebuild shared materials
    sharedMatsRef.current.forEach(m => m.dispose());
    sharedMatsRef.current.clear();
    const sharedMats = sharedMatsRef.current; // capture for cleanup

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
        color: new THREE.Color(cluster.color),
        transparent: true,
        opacity: 0.022,
        side: THREE.BackSide,
        depthWrite: false,
      });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.position.set(...cluster.center);
      halo.name = `halo-${cluster.tag}`;
      group.add(halo);
      haloMeshesRef.current.push(halo);

      const ringGeo = new THREE.RingGeometry(cluster.radius * 0.85, cluster.radius, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(cluster.color),
        transparent: true,
        opacity: 0.055,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.set(...cluster.center);
      group.add(ring);
      ringMeshesRef.current.push(ring);
    });

    // ── Connection edges (hidden by default — shown only on hover) ───────────
    layout.edges.forEach(edge => {
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(...edge.from),
        new THREE.Vector3(...edge.to),
      ]);
      const mat = new THREE.LineBasicMaterial({
        color:       new THREE.Color(edge.color),
        transparent: true,
        opacity:     0,   // ← hidden by default; revealed on hover
        depthWrite:  false,
      });
      const line = new THREE.Line(geo, mat);
      group.add(line);
      allEdgeLinesRef.current.push(line);

      // Map edge to both connected note IDs
      for (const id of [edge.fromNoteId, edge.toNoteId]) {
        if (!edgesByNoteIdRef.current.has(id)) edgesByNoteIdRef.current.set(id, []);
        edgesByNoteIdRef.current.get(id)!.push(line);
      }
    });

    // ── Note nodes (shared material per color) ───────────────────────────────
    notes.forEach(note => {
      notesMapRef.current.set(note.id, note);

      const np = layout.positions[note.id];
      if (!np) return;

      // Seeded animation phase
      let h = 0;
      for (let i = 0; i < note.id.length; i++) h = (h * 31 + note.id.charCodeAt(i)) | 0;
      animPhases.current.set(note.id, (h >>> 0) / 0xffffffff * Math.PI * 2);

      // Shared material per cluster color
      if (!sharedMatsRef.current.has(np.color)) {
        sharedMatsRef.current.set(np.color, new THREE.MeshStandardMaterial({
          color:             new THREE.Color('black'),
          emissive:          new THREE.Color(np.color),
          emissiveIntensity: 0.7,
          roughness:         0.1,
          metalness:         0.1,
        }));
      }
      const mat = sharedMatsRef.current.get(np.color)!.clone(); // clone for per-node intensity

      const size = 0.55 + (note.tags?.length ?? 0) * 0.08;
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(size, 18, 18), mat);
      mesh.position.set(...np.pos);
      mesh.name     = `note-${note.id}`;
      mesh.userData = { noteId: note.id };
      group.add(mesh);

      meshToNoteId.current.set(mesh, note.id);
      noteMeshes.current.set(note.id, mesh);
      currentPosRef.current.set(note.id, mesh.position.clone());
    });

    // ── Empty state ghost ────────────────────────────────────────────────────
    if (notes.length === 0) {
      const ghostPos: [number,number,number][] = [
        [0,5,0], [-8,0,3], [8,2,-2], [-4,-5,5], [5,-4,-4], [0,-8,0],
      ];
      ghostPos.forEach(pos => {
        const g = new THREE.Mesh(
          new THREE.SphereGeometry(0.4, 10, 10),
          new THREE.MeshBasicMaterial({ color: 0x1e2638, transparent: true, opacity: 0.5 }),
        );
        g.position.set(...pos);
        group.add(g);
      });
      [[0,1],[0,2],[1,3],[2,4],[3,5],[4,5],[1,2],[3,4]].forEach(([a, b]) => {
        group.add(new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(...ghostPos[a]),
            new THREE.Vector3(...ghostPos[b]),
          ]),
          new THREE.LineBasicMaterial({ color: 0x1e2638, transparent: true, opacity: 0.4 }),
        ));
      });
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

  // ── Click / hover via canvas events ───────────────────────────────────────
  useEffect(() => {
    const canvas = gl.domElement;
    let downX = 0, downY = 0;

    const getPointer = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      return new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width)  *  2 - 1,
        ((e.clientY - rect.top)  / rect.height) * -2 + 1,
      );
    };

    const onDown = (e: MouseEvent) => {
      downX = e.clientX; downY = e.clientY;
      // Pause auto-rotate on interaction
      orbitAutoRotate.current = false;
      if (autoRotateTimer.current) clearTimeout(autoRotateTimer.current);
    };

    const onUp = (e: MouseEvent) => {
      const dx = e.clientX - downX, dy = e.clientY - downY;
      // Resume auto-rotate after 3 s of inactivity
      autoRotateTimer.current = setTimeout(() => { orbitAutoRotate.current = true; }, 3000);
      if (Math.sqrt(dx*dx + dy*dy) > 6) return; // drag, not click
      const rc = new THREE.Raycaster();
      rc.setFromCamera(getPointer(e), camera);
      const hits = rc.intersectObjects(Array.from(meshToNoteId.current.keys()));
      if (hits.length) {
        const id = meshToNoteId.current.get(hits[0].object as THREE.Mesh);
        if (id) onToggleRef.current(id);
      }
    };

    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('mouseup',   onUp);
    return () => {
      canvas.removeEventListener('mousedown', onDown);
      canvas.removeEventListener('mouseup',   onUp);
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

    // ── Camera recenter tween ───────────────────────────────────────────────
    if (recenterActiveRef.current) {
      camera.position.lerp(INIT_CAM_POS, 0.065);
      (controls as unknown as { target: THREE.Vector3; update: () => void } | null)?.target?.lerp(INIT_CAM_TGT, 0.065);
      (controls as unknown as { update: () => void } | null)?.update?.();
      if (camera.position.distanceTo(INIT_CAM_POS) < 0.8) {
        recenterActiveRef.current = false;
      }
    }

    // ── Auto-rotate sync ────────────────────────────────────────────────────
    if (controls) {
      const oc = controls as unknown as { autoRotate: boolean };
      if (oc.autoRotate !== orbitAutoRotate.current) {
        oc.autoRotate = orbitAutoRotate.current;
      }
    }

    // ── LOD level ───────────────────────────────────────────────────────────
    const newLod: 0 | 1 | 2 = dist < 70 ? 0 : dist < 130 ? 1 : 2;
    if (newLod !== lodLevelRef.current) {
      lodLevelRef.current = newLod;
      onLodChange?.(newLod);
    }

    // ── Halo / ring LOD opacity (smooth lerp) ───────────────────────────────
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
      // Hide all
      allEdgeLinesRef.current.forEach(l => {
        (l.material as THREE.LineBasicMaterial).opacity = 0;
      });
      // Show connected edges
      if (hoveredId) {
        edgesByNoteIdRef.current.get(hoveredId)?.forEach(l => {
          (l.material as THREE.LineBasicMaterial).opacity = 0.28;
        });
      }
    }

    // ── Note animation ──────────────────────────────────────────────────────
    noteMeshes.current.forEach((mesh, noteId) => {
      const np    = layout.positions[noteId];
      if (!np) return;
      const phase = animPhases.current.get(noteId) ?? 0;
      const pulse = Math.sin(t * 1.1 + phase) * 0.3 + 0.6;
      const mat   = mesh.material as THREE.MeshStandardMaterial;

      let scale     = 1.0;
      let intensity = pulse;
      const flashStart = flashTimesRef.current.get(noteId);

      if (flashStart !== undefined) {
        // White flash pulse: 0–0.4 s = flash in, 0.4–1.2 s = fade out
        const elapsed = t - flashStart;
        if (elapsed < 1.2) {
          const p = elapsed < 0.4
            ? elapsed / 0.4
            : 1 - (elapsed - 0.4) / 0.8;
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
      }

      mesh.scale.setScalar(scale);
      mat.emissiveIntensity = intensity;

      // Floating motion
      mesh.position.set(
        np.pos[0] + Math.sin(t * 0.3  + phase)       * 0.18,
        np.pos[1] + Math.cos(t * 0.25 + phase * 0.8) * 0.22,
        np.pos[2] + Math.sin(t * 0.2  + phase * 1.3) * 0.15,
      );
      currentPosRef.current.set(noteId, mesh.position.clone());
    });

    // Trigger flash for new flashNoteId
    if (flashNoteId && !flashTimesRef.current.has(flashNoteId)) {
      flashTimesRef.current.set(flashNoteId, t);
    }

    // ── Hover raycasting (throttled: every 3rd frame) ───────────────────────
    if (frameCountRef.current % 3 !== 0) return;
    raycaster.current.setFromCamera(pointer, camera);
    const hits = raycaster.current.intersectObjects(Array.from(meshToNoteId.current.keys()));
    const hitId = hits.length ? meshToNoteId.current.get(hits[0].object as THREE.Mesh) ?? null : null;

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

// ── Cluster label (Html — must use createElement, not JSX) ───────────────────
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

// ── Empty state hint ──────────────────────────────────────────────────────────
function EmptyHint() {
  return createElement(Html,
    { position: [0, -13, 0] as [number,number,number], center: true, style: { pointerEvents: 'none' } },
    <div style={{
      fontFamily: MONO, fontSize: 9, letterSpacing: '0.08em',
      color: 'rgba(60,72,95,0.50)', textAlign: 'center' as const, lineHeight: 1.8,
    }}>
      KNOWLEDGE COSMOS<br />
      <span style={{ fontSize: 8, opacity: 0.6 }}>使用 Capture Pod 投入第一条知识</span>
    </div>
  );
}

// ── Main exported scene ───────────────────────────────────────────────────────
export function CosmosScene({
  layout, notes, highlightedNoteIds = [],
  flashNoteId = null, openNodes, onNodeToggle, onNodeHover,
  recenterActiveRef, onLodChange,
}: CosmosSceneProps) {
  const highlightSet  = useMemo(() => new Set(highlightedNoteIds), [highlightedNoteIds]);
  const navigate      = useNavigate();
  const [hoveredId,   setHoveredId]  = useState<string | null>(null);
  const currentPosRef = useRef(new Map<string, THREE.Vector3>());
  const notesMap      = useMemo(() => new Map(notes.map(n => [n.id, n])), [notes]);
  const [lodLevel,    setLodLevel]   = useState<0|1|2>(0);

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
      />

      {/* Cluster labels — hidden when LOD level > 0 (camera too far) */}
      {lodLevel === 0 && layout.clusters.map(c => <ClusterLabel key={c.tag} cluster={c} />)}

      {/* Empty state */}
      {notes.length === 0 && <EmptyHint />}

      {/* Hover label */}
      {hoveredId && !openNodes.has(hoveredId) && (() => {
        const pos  = currentPosRef.current.get(hoveredId);
        const note = notesMap.get(hoveredId);
        const np   = layout.positions[hoveredId];
        if (!pos || !note || !np) return null;
        return createElement(Html,
          {
            key: `label-${hoveredId}`,
            position: [pos.x, pos.y + 1.2, pos.z] as [number,number,number],
            center: true,
            style: { pointerEvents: 'none', whiteSpace: 'nowrap' },
          },
          <div style={{
            fontFamily: MONO, fontSize: 9, letterSpacing: '0.05em',
            color: np.color, background: 'rgba(1,4,13,0.90)',
            border: `1px solid ${np.color}44`, borderRadius: 5, padding: '3px 7px',
            boxShadow: `0 0 10px ${np.color}28`,
          }}>
            {(note.title || '未命名').slice(0, 26)}{(note.title || '').length > 26 ? '…' : ''}
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
          />
        );
      })}

      {/* OrbitControls — createElement avoids babel data-source-* injection */}
      {createElement(OrbitControls, {
        enablePan: true, enableZoom: true, enableRotate: true,
        autoRotate: true, autoRotateSpeed: 0.10,
        enableDamping: true, dampingFactor: 0.08,
        zoomSpeed: 0.7, panSpeed: 0.6,
        minDistance: 8, maxDistance: 180,
        makeDefault: true,
      })}

      {/* Bloom — createElement avoids babel data-source-* injection */}
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
