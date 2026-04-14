/**
 * CosmosScene — fully imperative Three.js rendering.
 *
 * WHY: The Enter.pro dev-tools babel plugin injects `data-source-*` props into
 * every JSX element, including lowercase R3F primitives like <mesh>.
 * R3F's custom reconciler tries to apply these as Three.js object paths and throws:
 *   "Cannot set 'data-source-stack'. Ensure it is an object before setting 'source-stack'."
 *
 * Fix: create ALL Three.js geometry / material / mesh objects imperatively inside
 * useEffect, so no lowercase Three.js JSX is ever written.  Only uppercase React
 * components (Stars, OrbitControls, Html, EffectComposer, Bloom) appear in JSX —
 * those go through the normal React reconciler and the data-* attributes are ignored.
 */

import { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import { useThree, useFrame }    from '@react-three/fiber';
import { Stars, OrbitControls, Html } from '@react-three/drei';
import { EffectComposer, Bloom }  from '@react-three/postprocessing';
import * as THREE from 'three';

import { type CosmosLayout, type CosmosNote } from './cosmos-layout';
import { NodeWindow }  from './NodeWindow';
import type { HoveredNodeInfo } from './KnowledgeStarMap';

const MONO = "'IBM Plex Mono','Roboto Mono',monospace";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface CosmosSceneProps {
  layout:              CosmosLayout;
  notes:               CosmosNote[];
  highlightedNoteIds?: string[];
  flashNoteId?:        string | null;
  openNodes:           Set<string>;
  onNodeToggle:        (id: string) => void;
  onNodeHover?:        (info: HoveredNodeInfo | null) => void;
}

// ── ImperativeCore — creates Three.js objects without any JSX primitives ─────
interface CoreProps {
  layout:        CosmosLayout;
  notes:         CosmosNote[];
  highlightSet:  Set<string>;
  flashNoteId:   string | null;
  openNodes:     Set<string>;
  hoveredId:     string | null;
  setHoveredId:  (id: string | null) => void;
  onNodeToggle:  (id: string) => void;
  onNodeHover?:  (info: HoveredNodeInfo | null) => void;
  currentPosRef: React.MutableRefObject<Map<string, THREE.Vector3>>;
}

function ImperativeCore({
  layout, notes, highlightSet, flashNoteId, openNodes,
  hoveredId, setHoveredId, onNodeToggle, onNodeHover,
  currentPosRef,
}: CoreProps) {
  const { scene, camera, gl } = useThree();

  // Maps for fast lookups
  const meshToNoteId = useRef(new Map<THREE.Mesh, string>());
  const noteMeshes   = useRef(new Map<string, THREE.Mesh>());
  const animPhases   = useRef(new Map<string, number>());
  const notesMapRef  = useRef(new Map<string, CosmosNote>());

  // Keep ref copies of state to avoid stale closures in event listeners
  const hoveredIdRef   = useRef<string | null>(null);
  const onToggleRef    = useRef(onNodeToggle);
  const onHoverRef     = useRef(onNodeHover);
  useEffect(() => { hoveredIdRef.current = hoveredId; }, [hoveredId]);
  useEffect(() => { onToggleRef.current = onNodeToggle; }, [onNodeToggle]);
  useEffect(() => { onHoverRef.current = onNodeHover; }, [onNodeHover]);

  // ── Build scene objects imperatively ──────────────────────────────────────
  useEffect(() => {
    const group = new THREE.Group();
    group.name = 'cosmos-core';

    // ── Lights (imperative, no JSX) ─────────────────────────────────────────
    const ambient = new THREE.AmbientLight(0x000000, 0.04);
    const p1      = new THREE.PointLight(0x3050a0, 0.8, 120, 2);
    const p2      = new THREE.PointLight(0x00ff66, 0.5, 150, 2);
    p2.position.set(50, 30, 20);
    const p3      = new THREE.PointLight(0x66f0ff, 0.4, 150, 2);
    p3.position.set(-50, -20, -30);
    group.add(ambient, p1, p2, p3);

    // ── Galaxy cluster halos ────────────────────────────────────────────────
    layout.clusters.forEach(cluster => {
      if (cluster.tag === '__untagged__' || cluster.noteIds.length < 2) return;
      const geo  = new THREE.SphereGeometry(cluster.radius, 20, 20);
      const mat  = new THREE.MeshBasicMaterial({
        color:       new THREE.Color(cluster.color),
        transparent: true,
        opacity:     0.022,
        side:        THREE.BackSide,
        depthWrite:  false,
      });
      const halo = new THREE.Mesh(geo, mat);
      halo.position.set(...cluster.center);
      halo.name = `halo-${cluster.tag}`;
      group.add(halo);

      // Inner ring
      const rGeo = new THREE.RingGeometry(cluster.radius * 0.85, cluster.radius, 32);
      const rMat = new THREE.MeshBasicMaterial({
        color:       new THREE.Color(cluster.color),
        transparent: true,
        opacity:     0.055,
        side:        THREE.DoubleSide,
        depthWrite:  false,
      });
      const ring = new THREE.Mesh(rGeo, rMat);
      ring.position.set(...cluster.center);
      group.add(ring);
    });

    // ── Connection edges ────────────────────────────────────────────────────
    layout.edges.forEach((edge, i) => {
      const points = [
        new THREE.Vector3(...edge.from),
        new THREE.Vector3(...edge.to),
      ];
      const geo  = new THREE.BufferGeometry().setFromPoints(points);
      const mat  = new THREE.LineBasicMaterial({
        color:       new THREE.Color(edge.color),
        transparent: true,
        opacity:     0.08,
        depthWrite:  false,
      });
      const line = new THREE.Line(geo, mat);
      line.name  = `edge-${i}`;
      group.add(line);
    });

    // ── Note nodes ──────────────────────────────────────────────────────────
    meshToNoteId.current.clear();
    noteMeshes.current.clear();
    animPhases.current.clear();
    notesMapRef.current.clear();

    notes.forEach(note => {
      notesMapRef.current.set(note.id, note);

      const np = layout.positions[note.id];
      if (!np) return;

      // Seeded phase
      let h = 0;
      for (let i = 0; i < note.id.length; i++) h = (h * 31 + note.id.charCodeAt(i)) | 0;
      animPhases.current.set(note.id, (h >>> 0) / 0xffffffff * Math.PI * 2);

      const size = 0.55 + (note.tags?.length ?? 0) * 0.08;
      const geo  = new THREE.SphereGeometry(size, 18, 18);
      const mat  = new THREE.MeshStandardMaterial({
        color:             new THREE.Color('black'),
        emissive:          new THREE.Color(np.color),
        emissiveIntensity: 0.7,
        roughness:         0.1,
        metalness:         0.1,
      });
      const mesh     = new THREE.Mesh(geo, mat);
      mesh.position.set(...np.pos);
      mesh.name      = `note-${note.id}`;
      mesh.userData  = { noteId: note.id };
      group.add(mesh);

      meshToNoteId.current.set(mesh, note.id);
      noteMeshes.current.set(note.id, mesh);
      currentPosRef.current.set(note.id, mesh.position.clone());
    });

    // ── Empty state ghost ────────────────────────────────────────────────────
    if (notes.length === 0) {
      const ghostPositions: [number,number,number][] = [
        [0,5,0], [-8,0,3], [8,2,-2], [-4,-5,5], [5,-4,-4], [0,-8,0],
      ];
      ghostPositions.forEach(pos => {
        const g   = new THREE.SphereGeometry(0.4, 10, 10);
        const m   = new THREE.MeshBasicMaterial({ color: 0x1e2638, transparent: true, opacity: 0.5 });
        const msh = new THREE.Mesh(g, m);
        msh.position.set(...pos);
        group.add(msh);
      });
      const ghostEdges = [[0,1],[0,2],[1,3],[2,4],[3,5],[4,5],[1,2],[3,4]];
      ghostEdges.forEach(([a, b]) => {
        const pts = [
          new THREE.Vector3(...ghostPositions[a]),
          new THREE.Vector3(...ghostPositions[b]),
        ];
        const eg = new THREE.BufferGeometry().setFromPoints(pts);
        const em = new THREE.LineBasicMaterial({ color: 0x1e2638, transparent: true, opacity: 0.4 });
        group.add(new THREE.Line(eg, em));
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
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, layout, scene]);

  // ── Click / hover via canvas event listeners ─────────────────────────────
  useEffect(() => {
    const canvas   = gl.domElement;
    let downX = 0, downY = 0;

    const getPointer = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      return new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width)  *  2 - 1,
        ((e.clientY - rect.top)  / rect.height) * -2 + 1,
      );
    };

    const onDown = (e: MouseEvent) => { downX = e.clientX; downY = e.clientY; };

    const onUp = (e: MouseEvent) => {
      const dx = e.clientX - downX, dy = e.clientY - downY;
      if (Math.sqrt(dx*dx + dy*dy) > 6) return; // drag, not click
      const rc   = new THREE.Raycaster();
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
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, gl]);

  // ── Animation + hover raycasting ─────────────────────────────────────────
  const raycaster = useRef(new THREE.Raycaster());

  useFrame(({ clock, pointer }) => {
    const t = clock.getElapsedTime();

    // Animate each note
    noteMeshes.current.forEach((mesh, noteId) => {
      const np    = layout.positions[noteId];
      if (!np) return;
      const phase = animPhases.current.get(noteId) ?? 0;
      const pulse = Math.sin(t * 1.1 + phase) * 0.3 + 0.6;

      let scale     = 1.0;
      let intensity = pulse;

      if (flashNoteId === noteId) {
        scale     = 1 + Math.sin((t % 1.0) * Math.PI) * 1.5;
        intensity = 3.0;
      } else if (hoveredId === noteId) {
        scale = 1.4; intensity = 2.2;
      } else if (highlightSet.has(noteId)) {
        scale = 1.25; intensity = 2.0;
      } else if (openNodes.has(noteId)) {
        scale = 1.1; intensity = 1.6;
      }

      mesh.scale.setScalar(scale);
      (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = intensity;

      // Floating
      mesh.position.set(
        np.pos[0] + Math.sin(t * 0.3  + phase)       * 0.18,
        np.pos[1] + Math.cos(t * 0.25 + phase * 0.8) * 0.22,
        np.pos[2] + Math.sin(t * 0.2  + phase * 1.3) * 0.15,
      );
      currentPosRef.current.set(noteId, mesh.position.clone());
    });

    // Hover raycasting (throttled — every other frame is fine)
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

  return null; // All rendering is imperative — nothing to return
}

// ── Cluster label (Html — React component, babel-safe) ─────────────────────
function ClusterLabel({ cluster }: { cluster: CosmosLayout['clusters'][0] }) {
  if (cluster.tag === '__untagged__' || cluster.noteIds.length < 3) return null;
  return (
    <Html
      position={[cluster.center[0], cluster.center[1] + cluster.radius + 1.5, cluster.center[2]]}
      center
      style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}
    >
      <div style={{
        fontFamily: MONO, fontSize: 8, letterSpacing: '0.10em',
        color: `${cluster.color}66`,
        textTransform: 'uppercase',
      }}>
        {cluster.tag}
      </div>
    </Html>
  );
}

// ── Empty state hint (Html — babel-safe) ─────────────────────────────────────
function EmptyHint() {
  return (
    <Html position={[0, -13, 0]} center style={{ pointerEvents: 'none' }}>
      <div style={{
        fontFamily: MONO, fontSize: 9, letterSpacing: '0.08em',
        color: 'rgba(60,72,95,0.50)', textAlign: 'center', lineHeight: 1.8,
      }}>
        KNOWLEDGE COSMOS<br />
        <span style={{ fontSize: 8, opacity: 0.6 }}>使用 Capture Pod 投入第一条知识</span>
      </div>
    </Html>
  );
}

// ── Main exported scene component ───────────────────────────────────────────
export function CosmosScene({
  layout, notes, highlightedNoteIds = [],
  flashNoteId = null, openNodes, onNodeToggle, onNodeHover,
}: CosmosSceneProps) {
  const highlightSet  = useMemo(() => new Set(highlightedNoteIds), [highlightedNoteIds]);
  const [hoveredId,   setHoveredId]  = useState<string | null>(null);
  const currentPosRef = useRef(new Map<string, THREE.Vector3>());
  const notesMap      = useMemo(() => new Map(notes.map(n => [n.id, n])), [notes]);

  const handleSetHovered = useCallback((id: string | null) => setHoveredId(id), []);

  return (
    <>
      {/* ── Imperative core (no JSX primitives) ── */}
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
      />

      {/* ── Background stars (React component — safe) ── */}
      <Stars radius={380} depth={100} count={9000} factor={4.5} saturation={0.3} fade speed={0.4} />

      {/* ── Cluster labels (Html — safe) ── */}
      {layout.clusters.map(c => <ClusterLabel key={c.tag} cluster={c} />)}

      {/* ── Empty state ── */}
      {notes.length === 0 && <EmptyHint />}

      {/* ── Hover label (Html — safe) ── */}
      {hoveredId && !openNodes.has(hoveredId) && (() => {
        const pos = currentPosRef.current.get(hoveredId);
        const note = notesMap.get(hoveredId);
        const np   = layout.positions[hoveredId];
        if (!pos || !note || !np) return null;
        return (
          <Html
            key={`label-${hoveredId}`}
            position={[pos.x, pos.y + 1.2, pos.z]}
            center
            style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}
          >
            <div style={{
              fontFamily: MONO, fontSize: 9, letterSpacing: '0.05em',
              color:      np.color,
              background: 'rgba(4,6,14,0.88)',
              border:     `1px solid ${np.color}44`,
              borderRadius: 5, padding: '3px 7px',
              boxShadow:  `0 0 10px ${np.color}28`,
            }}>
              {(note.title || '未命名').slice(0, 26)}{(note.title || '').length > 26 ? '…' : ''}
            </div>
          </Html>
        );
      })()}

      {/* ── Open node windows (Html — safe) ── */}
      {Array.from(openNodes).map(noteId => {
        const pos  = currentPosRef.current.get(noteId);
        const note = notesMap.get(noteId);
        const np   = layout.positions[noteId];
        if (!pos || !note || !np) return null;
        return (
          <Html
            key={`win-${noteId}`}
            position={[pos.x + 1.5, pos.y + 1.0, pos.z]}
            center={false}
            distanceFactor={18}
            style={{ pointerEvents: 'all' }}
          >
            <NodeWindow
              note={{ id: note.id, title: note.title, summary: note.summary, tags: note.tags, created_at: note.created_at }}
              accentColor={np.color}
              onClose={() => onNodeToggle(noteId)}
            />
          </Html>
        );
      })}

      {/* ── Orbit controls (React component — safe) ── */}
      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        autoRotate
        autoRotateSpeed={0.10}
        zoomSpeed={0.7}
        panSpeed={0.6}
        minDistance={8}
        maxDistance={180}
        makeDefault
      />

      {/* ── Post-processing bloom (React component — safe) ── */}
      <EffectComposer>
        <Bloom
          luminanceThreshold={0.18}
          luminanceSmoothing={0.7}
          intensity={0.65}
          mipmapBlur
        />
      </EffectComposer>
    </>
  );
}
