/**
 * galaxy-theme.ts — Galaxy visual variant system.
 * Each galaxy (tag cluster) is assigned a variant that controls
 * its halo shape, particle count, animation, and node distribution.
 */
import type { ClusterInfo } from './cosmos-layout';

export type GalaxyVariant = 'cluster' | 'ring' | 'chain' | 'nebula';

export interface GalaxyTheme {
  variant: GalaxyVariant;
  haloOpacity: number;
  haloScaleY: number;            // 1 = sphere, <1 = oblate ellipsoid
  hasRing: boolean;
  ringCount: number;
  ringRotateSpeed: number;       // rad/frame
  particleCount: number;
  particleSize: number;
  particleDrift: number;         // position noise amplitude
  hasCoreGlow: boolean;
  coreGlowIntensity: number;
  coreGlowRadius: number;
  breatheAmplitude: number;      // 0–1 emissive pulsing
  breatheSpeed: number;          // Hz multiplier
}

export const GALAXY_THEMES: Record<GalaxyVariant, GalaxyTheme> = {
  cluster: {
    variant: 'cluster',
    haloOpacity: 0.025,
    haloScaleY: 1.0,
    hasRing: false,
    ringCount: 0,
    ringRotateSpeed: 0,
    particleCount: 60,
    particleSize: 0.10,
    particleDrift: 0.003,
    hasCoreGlow: true,
    coreGlowIntensity: 1.8,
    coreGlowRadius: 0.8,
    breatheAmplitude: 0.08,
    breatheSpeed: 0.3,
  },
  ring: {
    variant: 'ring',
    haloOpacity: 0.018,
    haloScaleY: 0.4,
    hasRing: true,
    ringCount: 2,
    ringRotateSpeed: 0.0008,
    particleCount: 40,
    particleSize: 0.08,
    particleDrift: 0.002,
    hasCoreGlow: true,
    coreGlowIntensity: 1.2,
    coreGlowRadius: 0.6,
    breatheAmplitude: 0.05,
    breatheSpeed: 0.25,
  },
  chain: {
    variant: 'chain',
    haloOpacity: 0.012,
    haloScaleY: 0.5,
    hasRing: false,
    ringCount: 0,
    ringRotateSpeed: 0,
    particleCount: 30,
    particleSize: 0.06,
    particleDrift: 0.001,
    hasCoreGlow: false,
    coreGlowIntensity: 0,
    coreGlowRadius: 0,
    breatheAmplitude: 0.03,
    breatheSpeed: 0.2,
  },
  nebula: {
    variant: 'nebula',
    haloOpacity: 0.012,
    haloScaleY: 0.7,
    hasRing: false,
    ringCount: 0,
    ringRotateSpeed: 0,
    particleCount: 120,
    particleSize: 0.14,
    particleDrift: 0.006,
    hasCoreGlow: false,
    coreGlowIntensity: 0,
    coreGlowRadius: 0,
    breatheAmplitude: 0.12,
    breatheSpeed: 0.18,
  },
};

/** Auto-assign a galaxy variant based on cluster properties. */
export function getGalaxyVariant(cluster: ClusterInfo): GalaxyVariant {
  if (cluster.tag === '__untagged__') return 'nebula';
  const n = cluster.noteIds.length;
  if (n > 25) return 'nebula';
  if (n > 15) return 'ring';
  // Could check for wiki/chain sources here in the future
  return 'cluster';
}

/** Get the theme for a cluster. */
export function getGalaxyTheme(cluster: ClusterInfo): GalaxyTheme {
  return GALAXY_THEMES[getGalaxyVariant(cluster)];
}
