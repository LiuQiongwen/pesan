import { useRef, useMemo, useState, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { Stars, OrbitControls, Html, Line } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { type CosmosLayout, type CosmosNote, type ClusterInfo } from './cosmos-layout';
import { NodeWindow } from './NodeWindow';
import type { HoveredNodeInfo } from './KnowledgeStarMap';

const INTER = "'Inter',system-ui,sans-serif";
const MONO  = "'IBM Plex Mono','Roboto Mono',monospace";

// ── Galaxy halo (translucent cluster sphere) ───────────────────────────────
function GalaxyHalo({ cluster }: { cluster: ClusterInfo }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const color = useMemo(() => new THREE.Color(cluster.color), [cluster.color]);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    meshRef.current.rotation.y = t * 0.015;
    meshRef.current.rotation.x = t * 0.008;
  });

  if (cluster.tag === '__untagged__' || cluster.noteIds.length < 2) return null;

  return (
    <group position={cluster.center}>
      {/* Outer halo sphere */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[cluster.radius, 20, 20]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.022}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>
      {/* Inner glow ring */}
      <mesh>
        <ringGeometry args={[cluster.radius * 0.85, cluster.radius, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.06}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// ── Connection edge ───────────────────────────────────────────────────────────
function ConnectionEdge({
  from, to, color, active,
}: { from: [number,number,number]; to: [number,number,number]; color: string; active: boolean }) {
  const c = useMemo(() => new THREE.Color(color), [color]);
  return (
    <Line
      points={[from, to]}
      color={c}
      lineWidth={active ? 0.8 : 0.3}
      transparent
      opacity={active ? 0.50 : 0.10}
      depthWrite={false}
    />
  );
}

// ── Individual note node ───────────────────────────────────────────────────────
interface NoteNodeProps {
  note: CosmosNote;
  pos: [number, number, number];
  color: string;
  isHighlighted: boolean;
  isFlashing: boolean;
  isOpen: boolean;
  onToggle: (id: string) => void;
  onHoverChange: (id: string | null) => void;
  isHovered: boolean;
}

function NoteNode({
  note, pos, color, isHighlighted, isFlashing,
  isOpen, onToggle, onHoverChange, isHovered,
}: NoteNodeProps) {
  const meshRef  = useRef<THREE.Mesh>(null);
  const mat      = useRef<THREE.MeshStandardMaterial>(null);
  const baseColor = useMemo(() => new THREE.Color(color), [color]);
  const phase     = useMemo(() => {
    let h = 0;
    for (let i = 0; i < note.id.length; i++) h = (h * 31 + note.id.charCodeAt(i)) | 0;
    return (h >>> 0) / 0xffffffff * Math.PI * 2;
  }, [note.id]);

  useFrame(({ clock }) => {
    if (!meshRef.current || !mat.current) return;
    const t = clock.getElapsedTime();

    // Pulse glow
    const pulse = Math.sin(t * 1.1 + phase) * 0.3 + 0.6;

    let scale = 1.0;
    let emissiveIntensity = pulse;

    if (isFlashing) {
      const ft = t % 1.0;
      scale = 1 + Math.sin(ft * Math.PI) * 1.5;
      emissiveIntensity = 3.0;
    } else if (isHovered) {
      scale = 1.4;
      emissiveIntensity = 2.2;
    } else if (isHighlighted) {
      scale = 1.25;
      emissiveIntensity = 2.0;
    } else if (isOpen) {
      scale = 1.1;
      emissiveIntensity = 1.6;
    }

    meshRef.current.scale.setScalar(scale);
    mat.current.emissiveIntensity = emissiveIntensity;
  });

  // Gentle floating animation
  const posRef = useRef<[number, number, number]>([...pos] as [number,number,number]);
  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    meshRef.current.position.set(
      pos[0] + Math.sin(t * 0.3 + phase) * 0.18,
      pos[1] + Math.cos(t * 0.25 + phase * 0.8) * 0.22,
      pos[2] + Math.sin(t * 0.2 + phase * 1.3) * 0.15,
    );
    posRef.current = [
      pos[0] + Math.sin(t * 0.3 + phase) * 0.18,
      pos[1] + Math.cos(t * 0.25 + phase * 0.8) * 0.22,
      pos[2] + Math.sin(t * 0.2 + phase * 1.3) * 0.15,
    ];
  });

  const nodeSize = 0.55 + (note.tags?.length ?? 0) * 0.08;

  return (
    <group>
      <mesh
        ref={meshRef}
        position={pos}
        onClick={e => { e.stopPropagation(); onToggle(note.id); }}
        onPointerOver={e => { e.stopPropagation(); onHoverChange(note.id); }}
        onPointerOut={e => { e.stopPropagation(); onHoverChange(null); }}
      >
        <sphereGeometry args={[nodeSize, 18, 18]} />
        <meshStandardMaterial
          ref={mat}
          color="black"
          emissive={baseColor}
          emissiveIntensity={0.7}
          roughness={0.1}
          metalness={0.1}
        />
      </mesh>

      {/* Hover label */}
      {(isHovered || isHighlighted) && !isOpen && (
        <Html
          position={[pos[0], pos[1] + nodeSize + 0.8, pos[2]]}
          center
          style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}
        >
          <div style={{
            fontFamily: MONO, fontSize: 9, letterSpacing: '0.05em',
            color: color,
            background: 'rgba(4,6,14,0.85)',
            border: `1px solid ${color}44`,
            borderRadius: 5, padding: '3px 7px',
            boxShadow: `0 0 12px ${color}30`,
          }}>
            {(note.title || '未命名').slice(0, 24)}
            {(note.title || '').length > 24 ? '…' : ''}
          </div>
        </Html>
      )}

      {/* Open node window */}
      {isOpen && (
        <Html
          position={[pos[0] + 1.2, pos[1] + 1.0, pos[2]]}
          center={false}
          style={{ pointerEvents: 'all' }}
          distanceFactor={20}
        >
          <NodeWindow
            note={{
              id: note.id,
              title: note.title,
              summary: note.summary,
              tags: note.tags,
              created_at: note.created_at,
            }}
            accentColor={color}
            onClose={() => onToggle(note.id)}
          />
        </Html>
      )}
    </group>
  );
}

// ── Cluster label ──────────────────────────────────────────────────────────────
function ClusterLabel({ cluster }: { cluster: ClusterInfo }) {
  if (cluster.tag === '__untagged__' || cluster.noteIds.length < 3) return null;
  return (
    <Html
      position={[cluster.center[0], cluster.center[1] + cluster.radius + 1.5, cluster.center[2]]}
      center
      style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}
    >
      <div style={{
        fontFamily: MONO, fontSize: 8, letterSpacing: '0.10em',
        color: `${cluster.color}70`,
        textTransform: 'uppercase',
      }}>
        {cluster.tag}
      </div>
    </Html>
  );
}

// ── Empty state ghost ─────────────────────────────────────────────────────────
function EmptyGhost() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (groupRef.current) groupRef.current.rotation.y = clock.getElapsedTime() * 0.08;
  });

  const ghosts: [number, number, number][] = [
    [0,5,0], [-8,0,3], [8,2,-2], [-4,-5,5], [5,-4,-4], [0,-8,0],
  ];
  const ghostEdges = [[0,1],[0,2],[1,3],[2,4],[3,5],[4,5],[1,2],[3,4]];

  return (
    <group ref={groupRef}>
      {ghosts.map((pos, i) => (
        <mesh key={i} position={pos}>
          <sphereGeometry args={[0.4, 10, 10]} />
          <meshBasicMaterial color="#1e2638" transparent opacity={0.5} />
        </mesh>
      ))}
      {ghostEdges.map(([a, b], i) => (
        <Line key={i} points={[ghosts[a], ghosts[b]]} color="#1e2638" lineWidth={0.3} transparent opacity={0.4} />
      ))}
      <Html position={[0, -11, 0]} center>
        <div style={{
          fontFamily: MONO, fontSize: 9, letterSpacing: '0.08em',
          color: 'rgba(60,72,95,0.55)', textAlign: 'center', lineHeight: 1.8,
        }}>
          KNOWLEDGE COSMOS<br />
          <span style={{ fontSize: 8, opacity: 0.6 }}>使用 Capture Pod 投入第一条知识</span>
        </div>
      </Html>
    </group>
  );
}

// ── Main Scene ────────────────────────────────────────────────────────────────
export interface CosmosSceneProps {
  layout: CosmosLayout;
  notes: CosmosNote[];
  highlightedNoteIds?: string[];
  flashNoteId?: string | null;
  openNodes: Set<string>;
  onNodeToggle: (id: string) => void;
  onNodeHover?: (info: HoveredNodeInfo | null) => void;
}

export function CosmosScene({
  layout, notes, highlightedNoteIds = [],
  flashNoteId, openNodes, onNodeToggle, onNodeHover,
}: CosmosSceneProps) {
  const highlightSet = useMemo(() => new Set(highlightedNoteIds), [highlightedNoteIds]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleHoverChange = useCallback((id: string | null) => {
    setHoveredId(id);
    if (id) {
      const note = notes.find(n => n.id === id);
      if (note) {
        onNodeHover?.({ noteId: id, title: note.title, tags: note.tags, summary: note.summary });
      }
    } else {
      onNodeHover?.(null);
    }
  }, [notes, onNodeHover]);

  // Active edges: edges connected to hovered or highlighted nodes
  const activeNodeSet = useMemo(() => {
    const s = new Set(highlightedNoteIds);
    if (hoveredId) s.add(hoveredId);
    return s;
  }, [highlightedNoteIds, hoveredId]);

  return (
    <>
      {/* Ambient + subtle point lights */}
      <ambientLight intensity={0.04} />
      <pointLight position={[0, 0, 0]} intensity={0.8} color="#3050a0" distance={120} decay={2} />
      <pointLight position={[50, 30, 20]} intensity={0.5} color="#00ff66" distance={150} decay={2} />
      <pointLight position={[-50, -20, -30]} intensity={0.4} color="#66f0ff" distance={150} decay={2} />

      {/* Background star field */}
      <Stars
        radius={380}
        depth={100}
        count={9000}
        factor={4.5}
        saturation={0.3}
        fade
        speed={0.4}
      />

      {/* Galaxy cluster halos */}
      {layout.clusters.map(cluster => (
        <GalaxyHalo key={cluster.tag} cluster={cluster} />
      ))}

      {/* Cluster labels */}
      {layout.clusters.map(cluster => (
        <ClusterLabel key={cluster.tag + '_label'} cluster={cluster} />
      ))}

      {/* Connections */}
      {layout.edges.map((edge, i) => {
        const edgeNotes = notes.filter(n => {
          const p = layout.positions[n.id];
          return p && (
            (Math.abs(p.pos[0] - edge.from[0]) < 0.01) ||
            (Math.abs(p.pos[0] - edge.to[0]) < 0.01)
          );
        });
        const isActive = edgeNotes.some(n => activeNodeSet.has(n.id));
        return (
          <ConnectionEdge
            key={i}
            from={edge.from}
            to={edge.to}
            color={edge.color}
            active={isActive}
          />
        );
      })}

      {/* Note nodes */}
      {notes.map(note => {
        const np = layout.positions[note.id];
        if (!np) return null;
        return (
          <NoteNode
            key={note.id}
            note={note}
            pos={np.pos}
            color={np.color}
            isHighlighted={highlightSet.has(note.id)}
            isFlashing={flashNoteId === note.id}
            isOpen={openNodes.has(note.id)}
            onToggle={onNodeToggle}
            onHoverChange={handleHoverChange}
            isHovered={hoveredId === note.id}
          />
        );
      })}

      {/* Empty state */}
      {notes.length === 0 && <EmptyGhost />}

      {/* Orbit controls */}
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

      {/* Post-processing bloom */}
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
