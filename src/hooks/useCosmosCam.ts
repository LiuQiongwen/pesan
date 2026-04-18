/**
 * useCosmosCam — smooth-damp camera controller for the knowledge star map.
 *
 * Provides focusNode / focusGalaxy / recenter / peek actions with
 * critically-damped spring interpolation (frame-rate independent).
 *
 * Must be called inside a R3F <Canvas> subtree.
 */
import { useRef, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSceneStore } from '@/stores/sceneStore';

// ── Constants ────────────────────────────────────────────────────────────────
const INIT_POS = new THREE.Vector3(0, 0, 90);
const INIT_TGT = new THREE.Vector3(0, 0, 0);

const NODE_FOCUS_DIST = 20;       // camera distance from focused node
const GALAXY_DIST_FACTOR = 1.6;   // multiplier on cluster radius

// SmoothTime presets (seconds)
const ST_SNAP     = 0.30;
const ST_STANDARD = 0.45;
const ST_CRUISE   = 0.55;
const ST_GENTLE   = 0.35;

// ── SmoothDamp helper (critically-damped spring, Unity-style) ────────────────
function smoothDamp(
  current: number,
  target: number,
  velocity: { value: number },
  smoothTime: number,
  dt: number,
): number {
  // Clamp dt to avoid instability on frame spikes
  const clampedDt = Math.min(dt, 0.1);
  const omega = 2.0 / Math.max(smoothTime, 0.0001);
  const x = omega * clampedDt;
  const exp = 1.0 / (1.0 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current - target;
  const temp = (velocity.value + omega * change) * clampedDt;
  velocity.value = (velocity.value - omega * temp) * exp;
  const result = target + (change + temp) * exp;
  // Prevent overshoot
  if ((target - current > 0) === (result > target)) {
    velocity.value = 0;
    return target;
  }
  return result;
}

function smoothDampVec3(
  current: THREE.Vector3,
  target: THREE.Vector3,
  velocity: THREE.Vector3,
  smoothTime: number,
  dt: number,
  out: THREE.Vector3,
): void {
  const vx = { value: velocity.x };
  const vy = { value: velocity.y };
  const vz = { value: velocity.z };
  out.x = smoothDamp(current.x, target.x, vx, smoothTime, dt);
  out.y = smoothDamp(current.y, target.y, vy, smoothTime, dt);
  out.z = smoothDamp(current.z, target.z, vz, smoothTime, dt);
  velocity.set(vx.value, vy.value, vz.value);
}

// ── Types ────────────────────────────────────────────────────────────────────
export interface CosmosCamAPI {
  focusNode:   (noteId: string) => void;
  focusGalaxy: (tag: string) => void;
  recenter:    () => void;
  peek:        (target: THREE.Vector3, distance?: number) => void;
  isAnimating: () => boolean;
}

type CamState = 'idle' | 'animating' | 'settling';

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useCosmosCam(): CosmosCamAPI {
  const { camera } = useThree();

  const stateRef      = useRef<CamState>('idle');
  const goalPosRef    = useRef(new THREE.Vector3());
  const goalTgtRef    = useRef(new THREE.Vector3());
  const velPosRef     = useRef(new THREE.Vector3());
  const velTgtRef     = useRef(new THREE.Vector3());
  const smoothTimeRef = useRef(ST_STANDARD);
  const settleTimer   = useRef(0);
  const tmpPos        = useRef(new THREE.Vector3());
  const tmpTgt        = useRef(new THREE.Vector3());
  // Store current orbit target (synced from controls)
  const curTgtRef     = useRef(new THREE.Vector3());

  /** Compute distance-aware smoothTime adjustment */
  const adjustedSmoothTime = useCallback((base: number, travelDist: number) => {
    if (travelDist <= 80) return base;
    const factor = Math.min(1 + (travelDist - 80) / 200, 1.5);
    return base * factor;
  }, []);

  /** Start a camera transition */
  const startTransition = useCallback((
    targetPos: THREE.Vector3,
    targetLookAt: THREE.Vector3,
    baseSmoothTime: number,
  ) => {
    const travel = camera.position.distanceTo(targetPos);
    goalPosRef.current.copy(targetPos);
    goalTgtRef.current.copy(targetLookAt);
    velPosRef.current.set(0, 0, 0);
    velTgtRef.current.set(0, 0, 0);
    smoothTimeRef.current = adjustedSmoothTime(baseSmoothTime, travel);
    stateRef.current = 'animating';
    settleTimer.current = 0;
  }, [camera, adjustedSmoothTime]);

  // ── Public actions ─────────────────────────────────────────────────────────
  const focusNode = useCallback((noteId: string) => {
    const layout = useSceneStore.getState().layout;
    const np = layout.positions[noteId];
    if (!np) return;
    const nodePos = new THREE.Vector3(...np.pos);
    const dir = camera.position.clone().sub(nodePos).normalize().multiplyScalar(NODE_FOCUS_DIST);
    const camTarget = nodePos.clone().add(dir);
    startTransition(camTarget, nodePos, ST_STANDARD);
  }, [camera, startTransition]);

  const focusGalaxy = useCallback((tag: string) => {
    const layout = useSceneStore.getState().layout;
    const cluster = layout.clusters.find(c => c.tag === tag);
    if (!cluster) return;
    const center = new THREE.Vector3(...cluster.center);
    const dist = cluster.radius * GALAXY_DIST_FACTOR;
    const dir = camera.position.clone().sub(center).normalize().multiplyScalar(Math.max(dist, 25));
    const camTarget = center.clone().add(dir);
    startTransition(camTarget, center, ST_CRUISE);
  }, [camera, startTransition]);

  const recenter = useCallback(() => {
    const travel = camera.position.distanceTo(INIT_POS);
    const base = travel < 30 ? ST_SNAP : ST_STANDARD;
    startTransition(INIT_POS.clone(), INIT_TGT.clone(), base);
  }, [camera, startTransition]);

  const peek = useCallback((target: THREE.Vector3, distance = 25) => {
    const dir = camera.position.clone().sub(target).normalize().multiplyScalar(distance);
    const camTarget = target.clone().add(dir);
    startTransition(camTarget, target, ST_GENTLE);
  }, [camera, startTransition]);

  const isAnimating = useCallback(() => stateRef.current !== 'idle', []);

  // ── Frame loop (priority -1: runs before scene rendering) ──────────────────
  useFrame(({ controls: rawControls }, delta) => {
    if (stateRef.current === 'idle') return;

    const controls = rawControls as unknown as {
      enabled: boolean;
      target: THREE.Vector3;
      update: () => void;
    } | null;

    // Sync curTgtRef from controls target
    if (controls?.target) {
      if (stateRef.current === 'animating') {
        // Disable orbit during animation
        controls.enabled = false;

        // SmoothDamp camera position
        smoothDampVec3(
          camera.position, goalPosRef.current,
          velPosRef.current, smoothTimeRef.current, delta,
          tmpPos.current,
        );
        camera.position.copy(tmpPos.current);

        // SmoothDamp orbit target
        smoothDampVec3(
          controls.target, goalTgtRef.current,
          velTgtRef.current, smoothTimeRef.current, delta,
          tmpTgt.current,
        );
        controls.target.copy(tmpTgt.current);
        controls.update();

        // Check if close enough to settle
        const posDist = camera.position.distanceTo(goalPosRef.current);
        const tgtDist = controls.target.distanceTo(goalTgtRef.current);
        if (posDist < 0.3 && tgtDist < 0.3) {
          camera.position.copy(goalPosRef.current);
          controls.target.copy(goalTgtRef.current);
          controls.update();
          stateRef.current = 'settling';
          settleTimer.current = 0;
        }
      } else if (stateRef.current === 'settling') {
        settleTimer.current += delta;
        if (settleTimer.current > 0.1) {
          controls.enabled = true;
          stateRef.current = 'idle';
        }
      }
    }
  });

  return { focusNode, focusGalaxy, recenter, peek, isAnimating };
}
