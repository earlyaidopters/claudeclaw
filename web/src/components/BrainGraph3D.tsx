import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { X, Search, RotateCw, Sparkles, ChevronDown, ChevronRight, SlidersHorizontal } from 'lucide-preact';
import { formatRelativeTime } from '@/lib/format';

interface HiveEntry {
  id: number;
  agent_id: string;
  chat_id: string;
  action: string;
  summary: string;
  artifacts: string | null;
  created_at: number;
}

interface Props {
  entries: HiveEntry[];
  agentFilter: string;
  agentColors: Record<string, string>;
  blurOn: boolean;
}

// ── Lobes & agent mapping ──────────────────────────────────────────
// Same shape as the 2D version so the user gets consistent semantics:
// each agent has a "home" lobe, dots cluster in that lobe's region,
// the side panel filters apply identically.

interface Lobe {
  id: string;
  label: string;
  color: THREE.Color;
}

const FRONTAL = new THREE.Color('#5eb6ff');
const PARIETAL = new THREE.Color('#10b981');
const TEMPORAL = new THREE.Color('#f59e0b');
const OCCIPITAL = new THREE.Color('#a78bfa');

const LOBES: Lobe[] = [
  { id: 'frontal',   label: 'Frontal',   color: FRONTAL },
  { id: 'parietal',  label: 'Parietal',  color: PARIETAL },
  { id: 'temporal',  label: 'Temporal',  color: TEMPORAL },
  { id: 'occipital', label: 'Occipital', color: OCCIPITAL },
];

const LOBE_BY_ID = LOBES.reduce<Record<string, Lobe>>((acc, l) => { acc[l.id] = l; return acc; }, {});

const AGENT_LOBE: Record<string, string> = {
  main: 'frontal',
  research: 'parietal',
  comms: 'temporal',
  content: 'occipital',
  ops: 'parietal',
  meta: 'frontal',
};

function lobeFor(agentId: string): string {
  return AGENT_LOBE[agentId] || 'frontal';
}

const SYNAPSE_LOBES = ['frontal', 'parietal', 'temporal', 'occipital'] as const;
function pickRandomOtherLobe(exclude: string): string {
  const pool = SYNAPSE_LOBES.filter((l) => l !== exclude);
  return pool[Math.floor(Math.random() * pool.length)];
}

// ── Hash-based 3D noise ────────────────────────────────────────────
// Cheap, deterministic value noise with smoothstep interpolation.
// Good enough to give the brain mesh a lumpy organic surface.

function hash(x: number, y: number, z: number): number {
  let h = x * 374761393 + y * 668265263 + z * 2147483647;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return ((h >>> 0) / 0xffffffff) * 2 - 1;
}

function smooth(t: number) { return t * t * (3 - 2 * t); }

function noise3D(x: number, y: number, z: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = smooth(xf), v = smooth(yf), w = smooth(zf);
  // Trilinear interpolation of corner hashes
  const c000 = hash(xi,     yi,     zi    );
  const c100 = hash(xi + 1, yi,     zi    );
  const c010 = hash(xi,     yi + 1, zi    );
  const c110 = hash(xi + 1, yi + 1, zi    );
  const c001 = hash(xi,     yi,     zi + 1);
  const c101 = hash(xi + 1, yi,     zi + 1);
  const c011 = hash(xi,     yi + 1, zi + 1);
  const c111 = hash(xi + 1, yi + 1, zi + 1);
  const x00 = c000 * (1 - u) + c100 * u;
  const x10 = c010 * (1 - u) + c110 * u;
  const x01 = c001 * (1 - u) + c101 * u;
  const x11 = c011 * (1 - u) + c111 * u;
  const y0 = x00 * (1 - v) + x10 * v;
  const y1 = x01 * (1 - v) + x11 * v;
  return y0 * (1 - w) + y1 * w;
}

function fbm(x: number, y: number, z: number): number {
  return noise3D(x, y, z) * 0.55 + noise3D(x * 2.3, y * 2.3, z * 2.3) * 0.28 + noise3D(x * 5.1, y * 5.1, z * 5.1) * 0.17;
}

// Ridge noise — `1 - |fbm|` produces meandering linear ridges. Stacked
// at multiple frequencies and run through *domain warping* (sampling
// the ridge at coordinates that have themselves been jittered by
// another noise field) the result is the twisted, looping cortex
// pattern that's instantly recognizable as a brain rather than a
// generic noisy ball.
function ridgedFbm(x: number, y: number, z: number): number {
  const r1 = (1 - Math.abs(fbm(x, y, z))) * 0.55;
  const r2 = (1 - Math.abs(fbm(x * 2.7, y * 2.7, z * 2.7))) * 0.30;
  const r3 = (1 - Math.abs(fbm(x * 6.3, y * 6.3, z * 6.3))) * 0.15;
  return r1 + r2 + r3;
}

function domainWarpedRidge(x: number, y: number, z: number): number {
  // Sample warp offsets from independent noise fields, then evaluate
  // the ridge noise at the warped coordinate. Warp amplitude ~0.6
  // gives strong meandering without making the ridges chaotic.
  const wx = fbm(x * 0.7, y * 0.7, z * 0.7) * 0.6;
  const wy = fbm(x * 0.7 + 5.1, y * 0.7 + 5.1, z * 0.7 + 5.1) * 0.6;
  const wz = fbm(x * 0.7 + 9.3, y * 0.7 + 9.3, z * 0.7 + 9.3) * 0.6;
  return ridgedFbm(x + wx, y + wy, z + wz);
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// ── Brain hemisphere builder ────────────────────────────────────────
// Returns a deformed ellipsoid mesh with vertex colors painted by
// soft lobe membership. The same lobe-weight function is later
// re-used to assign dots to surface positions.

function lobeWeights(x: number, y: number, z: number) {
  // Three.js camera defaults to looking in -z direction. With our
  // camera at +z, vertices facing the user have z > 0 — that's the
  // "front" of the brain (frontal lobe). Previous version inverted
  // this and painted the visible surface as occipital, which is why
  // everything looked dark/violet. Tight smoothstep bands give each
  // lobe a clearly-dominant region.
  const front = z;
  const wFrontal = smoothstep(0.15, 0.55, front);
  const wOccipital = smoothstep(-0.15, -0.55, front);
  const wParietal = smoothstep(0.05, 0.45, y) * (1 - wFrontal - wOccipital);
  const wTemporal = smoothstep(-0.05, -0.45, y);
  return { wFrontal, wParietal, wTemporal, wOccipital };
}

function buildHemisphere(side: 'left' | 'right'): { mesh: THREE.Mesh; surface: THREE.Vector3[] } {
  const detail = 6;
  const geo = new THREE.IcosahedronGeometry(1, detail);
  // Anatomical proportions: longer front-to-back than wide-or-tall,
  // matching a real brain's superior axis (~16cm L × 14cm W × 12cm H).
  geo.scale(0.50, 0.70, 1.18);

  const sign = side === 'left' ? -1 : 1;

  const positions = geo.attributes.position;
  const count = positions.count;
  const colors = new Float32Array(count * 3);
  const surface: THREE.Vector3[] = [];

  for (let i = 0; i < count; i++) {
    let x = positions.getX(i);
    let y = positions.getY(i);
    let z = positions.getZ(i);

    // Flatten the inner wall so the longitudinal fissure is crisp.
    const facingMidline = (sign === -1 && x > 0) || (sign === 1 && x < 0);
    if (facingMidline) {
      const t = Math.min(1, Math.abs(x) / 0.45);
      x *= 0.35 * (1 - t * 0.6);
    }

    // Anatomical bulges, applied before the noise displacement so the
    // ridges follow the bulge contours rather than fight them.
    //
    // Temporal pouch: lower-side area (y < 0, |x| moderate) bulges
    // outward and downward. This is the big lateral-lower bump that
    // gives a brain its iconic "kidney bean" side profile.
    const pouchT = smoothstep(0.0, -0.55, y) * smoothstep(0.0, 0.55, Math.abs(x));
    if (pouchT > 0) {
      x *= 1 + pouchT * 0.18;
      y -= pouchT * 0.10;
    }
    // Frontal pole: round and bulge the very front (high z).
    const frontT = smoothstep(0.7, 1.05, z);
    if (frontT > 0) {
      z *= 1 + frontT * 0.06;
      const radial = Math.sqrt(x * x + y * y) + 0.0001;
      const radialBoost = 1 + frontT * 0.05;
      x *= radialBoost;
      y *= radialBoost;
    }
    // Occipital pole: same treatment at the back.
    const backT = smoothstep(-0.7, -1.05, z);
    if (backT > 0) {
      z *= 1 + backT * 0.04;
    }

    const len = Math.sqrt(x * x + y * y + z * z) + 0.0001;
    const nx = x / len, ny = y / len, nz = z / len;

    // Domain-warped ridge — gives the twisting, looping fold pattern
    // that real cortex has. Higher amplitude than before since the
    // bloom pass will pick up the highlights and let valleys shadow.
    const sx = nx * 3.6;
    const sy = ny * 3.6;
    const sz = nz * 2.8;
    const ridge = domainWarpedRidge(sx, sy, sz);
    const displacement = (ridge - 0.42) * 0.26;

    const factor = 1 + displacement;
    const px = x * factor;
    const py = y * factor;
    const pz = z * factor;

    positions.setXYZ(i, px, py, pz);

    // Lobe colors: blended by weight, no desaturation — let the
    // agent-mapped hues actually show.
    const w = lobeWeights(nx, ny, nz);
    const sum = w.wFrontal + w.wParietal + w.wTemporal + w.wOccipital + 0.0001;
    const wf = w.wFrontal / sum;
    const wp = w.wParietal / sum;
    const wt = w.wTemporal / sum;
    const wo = w.wOccipital / sum;

    const cr = wf * FRONTAL.r + wp * PARIETAL.r + wt * TEMPORAL.r + wo * OCCIPITAL.r;
    const cg = wf * FRONTAL.g + wp * PARIETAL.g + wt * TEMPORAL.g + wo * OCCIPITAL.g;
    const cb = wf * FRONTAL.b + wp * PARIETAL.b + wt * TEMPORAL.b + wo * OCCIPITAL.b;

    // Pure lobe colors — desaturation here was the reason every
    // region used to read as "purple". A tiny base mix (0.08) just
    // softens the edges where two lobes meet.
    const baseR = 0.5, baseG = 0.48, baseB = 0.55;
    const mix = 0.92;
    colors[i * 3]     = cr * mix + baseR * (1 - mix);
    colors[i * 3 + 1] = cg * mix + baseG * (1 - mix);
    colors[i * 3 + 2] = cb * mix + baseB * (1 - mix);

    // Save outward-facing surface vertices for dot placement.
    if (sign === -1 && x < -0.05) surface.push(new THREE.Vector3(px, py, pz));
    if (sign === 1 && x > 0.05) surface.push(new THREE.Vector3(px, py, pz));
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  // MeshStandardMaterial gives proper PBR specular highlights; with
  // moderate roughness the gyri ridges catch light convincingly.
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.62,
    metalness: 0.0,
    flatShading: false,
  });

  const mesh = new THREE.Mesh(geo, mat);
  // Bigger gap so the longitudinal fissure is visible even from
  // shallow viewing angles. The flattened inner walls meet here.
  mesh.position.x = sign * 0.04;
  return { mesh, surface };
}

type LobePools = Record<'left' | 'right', THREE.Vector3[]>;

function blendedLobeColor(nx: number, ny: number, nz: number): THREE.Color {
  const w = lobeWeights(nx, ny, nz);
  const sum = w.wFrontal + w.wParietal + w.wTemporal + w.wOccipital + 0.0001;
  const wf = w.wFrontal / sum;
  const wp = w.wParietal / sum;
  const wt = w.wTemporal / sum;
  const wo = w.wOccipital / sum;

  const cr = wf * FRONTAL.r + wp * PARIETAL.r + wt * TEMPORAL.r + wo * OCCIPITAL.r;
  const cg = wf * FRONTAL.g + wp * PARIETAL.g + wt * TEMPORAL.g + wo * OCCIPITAL.g;
  const cb = wf * FRONTAL.b + wp * PARIETAL.b + wt * TEMPORAL.b + wo * OCCIPITAL.b;

  const baseR = 0.5, baseG = 0.48, baseB = 0.55;
  const mix = 0.92;
  return new THREE.Color(
    cr * mix + baseR * (1 - mix),
    cg * mix + baseG * (1 - mix),
    cb * mix + baseB * (1 - mix),
  );
}

function cloneMaterialWithVertexColors(material: THREE.Material | THREE.Material[] | undefined) {
  const cloneOne = (m: THREE.Material | undefined) => {
    const cloned = m
      ? m.clone()
      : new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0 });
    const std = cloned as THREE.MeshStandardMaterial;
    std.vertexColors = true;
    // Subtle emissive tint matching the vertex color, so each lobe
    // gives off a faint colored glow that the bloom pass picks up.
    // Don't tint with a single hue — set emissiveIntensity and let the
    // vertex colors drive the per-fragment emissive (Three.js
    // multiplies emissive * emissiveMap; with no map, vertexColors
    // contribute via the diffuse channel, but raising emissive on a
    // white base color makes the whole mesh glow uniformly. Trick:
    // set emissive to a soft warm color and keep intensity moderate.)
    if (std.emissive !== undefined) {
      std.emissive = new THREE.Color(0x331122);
      std.emissiveIntensity = 0.06;
    }
    return cloned;
  };
  return Array.isArray(material) ? material.map(cloneOne) : cloneOne(material);
}

function isDominantLobe(lobeId: string, w: ReturnType<typeof lobeWeights>) {
  // Argmax classification — pick the lobe with the highest weight at
  // this point and check it matches. This guarantees every surface
  // vertex gets classified into exactly one lobe, even when no
  // single weight is high enough on a complex anatomical mesh
  // (where the previous fixed thresholds left many vertices with
  // no lobe and produced 0-pool results).
  let maxKey = 'frontal';
  let maxVal = w.wFrontal;
  if (w.wParietal > maxVal) { maxVal = w.wParietal; maxKey = 'parietal'; }
  if (w.wTemporal > maxVal) { maxVal = w.wTemporal; maxKey = 'temporal'; }
  if (w.wOccipital > maxVal) { maxVal = w.wOccipital; maxKey = 'occipital'; }
  return maxKey === lobeId;
}

function pointLobeId(nx: number, ny: number, nz: number): string | null {
  const w = lobeWeights(nx, ny, nz);
  for (const lobe of LOBES) {
    if (isDominantLobe(lobe.id, w)) return lobe.id;
  }
  return null;
}

function buildProceduralBrain(brainGroup: THREE.Group): LobePools {
  const left = buildHemisphere('left');
  const right = buildHemisphere('right');
  brainGroup.add(left.mesh);
  brainGroup.add(right.mesh);
  return { left: left.surface, right: right.surface };
}

function prepareLoadedBrainModel(
  model: THREE.Object3D,
): { pools: LobePools; brainGeos: BrainGeoSnapshot[] } {
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const targetSize = 1.6;
  const scale = targetSize / Math.max(size.x, size.y, size.z, 0.0001);

  model.position.copy(center).multiplyScalar(-scale);
  model.scale.setScalar(scale);
  model.updateMatrixWorld(true);

  const lobePoolCounts = new Map<string, number>();
  const pools: LobePools = { left: [], right: [] };
  const brainGeos: BrainGeoSnapshot[] = [];
  const world = new THREE.Vector3();
  const normal = new THREE.Vector3();

  model.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const originalGeo = obj.geometry as THREE.BufferGeometry | undefined;
    const position = originalGeo?.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!originalGeo || !position) return;

    const geo = originalGeo.clone();
    obj.geometry = geo;
    obj.material = cloneMaterialWithVertexColors(obj.material);
    obj.updateMatrixWorld(true);

    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const baseColors = new Float32Array(pos.count * 3);
    const vertexLobeIds: string[] = new Array(pos.count);
    const step = Math.max(1, Math.floor(pos.count / 900));

    for (let i = 0; i < pos.count; i++) {
      world.fromBufferAttribute(pos, i).applyMatrix4(obj.matrixWorld);
      normal.copy(world).normalize();

      const color = blendedLobeColor(normal.x, normal.y, normal.z);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
      baseColors[i * 3] = color.r;
      baseColors[i * 3 + 1] = color.g;
      baseColors[i * 3 + 2] = color.b;

      // Argmax lobe assignment for every vertex so the activity-glow
      // pass knows which lobe each vertex belongs to.
      const lobeId = pointLobeId(normal.x, normal.y, normal.z) || 'frontal';
      vertexLobeIds[i] = lobeId;

      if (i % step !== 0) continue;
      const side = world.x < 0 ? 'left' : 'right';
      const poolKey = `${side}-${lobeId}`;
      if ((lobePoolCounts.get(poolKey) ?? 0) >= 120) continue;
      lobePoolCounts.set(poolKey, (lobePoolCounts.get(poolKey) ?? 0) + 1);
      const sample = world.clone();
      pools[side].push(sample);
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    brainGeos.push({ mesh: obj, baseColors, vertexLobeIds });
  });

  return { pools, brainGeos };
}

// Walk every brain mesh's vertex color attribute and brighten each
// vertex by its lobe's activity intensity. Bloom catches the bright
// spots, so heavily-active lobes glow visibly. Cheap O(verts) on
// each entry change — typically called once per refresh.
// Reference activity count where a lobe is considered "fully lit".
// Using a fixed reference (rather than max-of-current-lobes) means
// unchecking the busiest lobe doesn't cause the others to suddenly
// look brighter — each lobe's brightness reflects its actual entry
// count, independent of how active its siblings are.
const ACTIVITY_FULL_LIT = 30;

function applyActivityGlow(
  brainGeos: BrainGeoSnapshot[],
  activityByLobe: Record<string, number>,
  hoveredLobe: string | null,
  glowIntensity: number,
) {
  if (brainGeos.length === 0) return;
  for (const geo of brainGeos) {
    const colorAttr = geo.mesh.geometry.getAttribute('color') as THREE.BufferAttribute | undefined;
    if (!colorAttr) continue;
    const arr = colorAttr.array as Float32Array;
    const lobeIds = geo.vertexLobeIds;
    const base = geo.baseColors;
    for (let i = 0; i < lobeIds.length; i++) {
      const lobeId = lobeIds[i];
      const activity = activityByLobe[lobeId] || 0;
      // Absolute activity scaled to a fixed reference. Quiet lobes
      // sit at baseline (1.6×); a lobe with 30+ entries reaches the
      // full activity boost regardless of how busy its siblings are.
      const t = Math.min(1, activity / ACTIVITY_FULL_LIT);
      let boost = 1.6 + Math.pow(t, 0.5) * 0.9 * glowIntensity;
      if (hoveredLobe && lobeId === hoveredLobe) {
        boost *= 1.4;
      }
      arr[i * 3]     = Math.min(2.4, base[i * 3]     * boost);
      arr[i * 3 + 1] = Math.min(2.4, base[i * 3 + 1] * boost);
      arr[i * 3 + 2] = Math.min(2.4, base[i * 3 + 2] * boost);
    }
    colorAttr.needsUpdate = true;
  }
}

// Pick a deterministic dot position for an entry inside its lobe's
// surface points. Stable across renders so the visualization doesn't
// shuffle on every poll.
// Cache sorted lobe regions per (surfaceArrayRef, lobeId). The sort
// is the thing that makes the layout *predictable* — slot 0 lands at
// the top of the lobe and slots fill downward, so a chronological
// entry list maps to a chronological top-to-bottom band on the brain.
// WeakMap keys on the surface array reference so cache invalidates
// naturally when the brain is rebuilt (procedural fallback, etc).
const sortedRegionCache = new WeakMap<THREE.Vector3[], Map<string, THREE.Vector3[]>>();

function getSortedRegion(surface: THREE.Vector3[], lobeId: string): THREE.Vector3[] {
  let perLobe = sortedRegionCache.get(surface);
  if (!perLobe) {
    perLobe = new Map();
    sortedRegionCache.set(surface, perLobe);
  }
  let region = perLobe.get(lobeId);
  if (region) return region;

  region = surface.filter((v) => {
    const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    if (len < 1e-6) return false;
    const nx = v.x / len, ny = v.y / len, nz = v.z / len;
    const w = lobeWeights(nx, ny, nz);
    return isDominantLobe(lobeId, w);
  });
  // Sort top-to-bottom (high Y first), tie-break front-to-back. This
  // gives every lobe a stable column of slots: slot 0 at the top of
  // the cortex, last slot at the bottom. Combined with a chronological
  // entry sort, the user can read recency by scanning down a lobe.
  region.sort((a, b) => (b.y - a.y) || (b.z - a.z) || (a.x - b.x));
  perLobe.set(lobeId, region);
  return region;
}

function pickSurface(surface: THREE.Vector3[], lobeId: string, slotIdx: number): THREE.Vector3 | null {
  const region = getSortedRegion(surface, lobeId);
  if (region.length === 0) return null;
  return region[slotIdx % region.length];
}

// ── Component ───────────────────────────────────────────────────────

interface BrainFilters {
  query: string;
  hiddenAgents: Set<string>;
  hiddenLobes: Set<string>;
  nodeSize: number;
}

const DEFAULT_FILTERS: BrainFilters = {
  query: '',
  hiddenAgents: new Set(),
  hiddenLobes: new Set(),
  nodeSize: 1,
};

interface DotData {
  entry: HiveEntry & { lobe: string };
  pos: THREE.Vector3;
  mesh: THREE.Mesh;
  halo: THREE.Mesh;
}

// Per-mesh data captured when the GLB loads, used to modulate vertex
// emissive based on per-lobe activity. baseColors holds the original
// lobe-weighted vertex colors; vertexLobeIds[i] is the dominant lobe
// for vertex i. The activity-glow effect uses these to recompute the
// `color` attribute without touching geometry topology.
interface BrainGeoSnapshot {
  mesh: THREE.Mesh;
  baseColors: Float32Array;
  vertexLobeIds: string[];
}

// Approximate centroids of each lobe in the brain's local space, used
// as endpoints when an agent activity event spawns a cross-lobe
// synapse arc. Values picked to land just inside the cortex of the
// 1.6-unit normalized brain. Two temporal centroids (left and right)
// so arcs don't always emerge from the same point.
const LOBE_CENTROIDS: Record<string, THREE.Vector3> = {
  frontal: new THREE.Vector3(0, 0.20, 0.62),
  parietal: new THREE.Vector3(0, 0.62, 0.05),
  temporal: new THREE.Vector3(0.58, -0.30, 0.10),
  temporal_l: new THREE.Vector3(-0.58, -0.30, 0.10),
  occipital: new THREE.Vector3(0, 0.20, -0.62),
};

interface SynapseArc {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  // Rendered to the synapsesGroup (parented to brainGroup so the arc
  // rotates and breathes with the brain). createdAt drives uProgress.
  createdAt: number;
  lifeSec: number;
}

export function BrainGraph3D({ entries, agentFilter, agentColors, blurOn }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const sceneStateRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    leftSurface: THREE.Vector3[];
    rightSurface: THREE.Vector3[];
    brainGeos: BrainGeoSnapshot[];
    dotsGroup: THREE.Group;
    synapsesGroup: THREE.Group;
    synapses: SynapseArc[];
    spawnSynapse: (fromLobe: string, toLobe: string, color: THREE.Color) => void;
    bloom: UnrealBloomPass;
    raycaster: THREE.Raycaster;
    pointer: THREE.Vector2;
    dotMap: Map<THREE.Object3D, DotData>;
    rafId: number;
    lastInteract: number;
    brainGroup: THREE.Group;
    cleanup: () => void;
  } | null>(null);

  // Track which entry ids we've already converted into synapse arcs,
  // so a re-render of the same `entries` list doesn't spawn duplicate
  // arcs. Keep a tail-cap to bound memory across long sessions.
  const seenEntryIdsRef = useRef<Set<number>>(new Set());
  // Track the previous lobe so each new entry traces FROM the lobe
  // that just fired TO the lobe of the new entry — gives the arcs a
  // narrative ("comms hands off to research").
  const previousLobeRef = useRef<string | null>(null);

  const [hovered, setHovered] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [selected, setSelected] = useState<HiveEntry | null>(null);
  const [filters, setFilters] = useState<BrainFilters>(DEFAULT_FILTERS);
  const [panelOpen, setPanelOpen] = useState(false);
  const [ready, setReady] = useState(false);
  // Which lobe the cursor is currently over (drives the per-lobe
  // highlight and the hover-time stats card with its pie chart).
  const [hoveredLobe, setHoveredLobe] = useState<string | null>(null);

  // Refs so the rAF animate loop can read the latest hovered/selected
  // without re-binding the loop on every state change.
  const hoveredEntryRef = useRef<number | null>(null);
  const selectedEntryRef = useRef<number | null>(null);
  useEffect(() => { hoveredEntryRef.current = hovered; }, [hovered]);
  useEffect(() => { selectedEntryRef.current = selected?.id ?? null; }, [selected]);

  // Init scene once
  useEffect(() => {
    if (!wrapRef.current) return;
    setReady(false);
    const wrap = wrapRef.current;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;

    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 100);
    // Three-quarter side view — the iconic angle for a brain.
    // Front lobe forward-right, temporal pouch visible below.
    camera.position.set(3.4, 0.6, 2.4);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.setClearColor(0x000000, 0);
    wrap.appendChild(renderer.domElement);
    renderer.domElement.style.outline = 'none';
    renderer.domElement.style.display = 'block';

    // Lighting — calibrated for PBR. Total intensity ~1.0 so vertex
    // colors aren't washed out. Stronger directional contrast picks
    // out the cortex ridges; weaker ambient keeps the lobe hues
    // recognizable.
    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const key = new THREE.DirectionalLight(0xffffff, 0.65);
    key.position.set(2, 3, 4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.18);
    fill.position.set(-3, -1, 2);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.25);
    rim.position.set(0, 1, -3);
    scene.add(rim);

    // Brain. The GLB path is preferred; the procedural mesh remains as
    // a runtime fallback if the asset is absent, corrupt, or blocked.
    const brainGroup = new THREE.Group();
    scene.add(brainGroup);

    // ── Backside fresnel rim halo ────────────────────────────────────
    // A larger sphere rendered with BackSide + a fresnel falloff sits
    // behind the brain mesh and pushes a soft glow OUT past the
    // silhouette. Reads as if the cortex itself is emitting light.
    // Cheap (one extra draw call), no shadows, additive blending so it
    // never darkens anything underneath. The bloom pass picks up the
    // bright rim and turns it into a real halo.
    const haloGeometry = new THREE.SphereGeometry(0.96, 64, 48);
    const haloMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      uniforms: {
        uColor: { value: new THREE.Color(0xa074ff) },
        uIntensity: { value: 0.9 },
        uPower: { value: 3.2 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vNormalW;
        varying vec3 vViewDir;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vNormalW = normalize(mat3(modelMatrix) * normal);
          vViewDir = normalize(cameraPosition - worldPos.xyz);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uIntensity;
        uniform float uPower;
        varying vec3 vNormalW;
        varying vec3 vViewDir;
        void main() {
          // BackSide flips normals; negate so fresnel reads the front
          // surface. Pow-falloff concentrates the glow at the
          // silhouette and fades to zero toward the camera-facing
          // poles, which keeps the brain's own detail visible through
          // the shell.
          float facing = clamp(dot(-vNormalW, vViewDir), 0.0, 1.0);
          float fresnel = pow(1.0 - facing, uPower);
          gl_FragColor = vec4(uColor * fresnel * uIntensity, fresnel);
        }
      `,
    });
    const haloMesh = new THREE.Mesh(haloGeometry, haloMaterial);
    haloMesh.renderOrder = -1; // draw before brain so the brain's
                               // depth-tested fragments paint on top
    brainGroup.add(haloMesh);

    // Dots group — parented to the brain so the dots rotate, breathe,
    // and tilt with it. Previously they sat in scene root, which left
    // them floating in space while the brain spun around them.
    const dotsGroup = new THREE.Group();
    brainGroup.add(dotsGroup);

    // Synapse arcs group — same parent so arcs follow the brain's
    // rotation and breathing. Each arc is a TubeGeometry along a
    // quadratic Bezier whose control point is pushed outward from
    // origin to give the line a satisfying arc above the cortex.
    const synapsesGroup = new THREE.Group();
    synapsesGroup.renderOrder = 2; // drawn after the brain meshes
    brainGroup.add(synapsesGroup);
    const synapses: SynapseArc[] = [];

    function spawnSynapse(fromLobe: string, toLobe: string, color: THREE.Color) {
      // Resolve endpoints. Temporal lobe randomizes between left/right
      // hemispheres so repeated arcs to/from temporal don't hammer the
      // same spot.
      const pickEndpoint = (id: string): THREE.Vector3 => {
        if (id === 'temporal') {
          return (Math.random() < 0.5 ? LOBE_CENTROIDS.temporal : LOBE_CENTROIDS.temporal_l).clone();
        }
        return (LOBE_CENTROIDS[id] || LOBE_CENTROIDS.frontal).clone();
      };
      const from = pickEndpoint(fromLobe);
      const to = pickEndpoint(toLobe);
      // Don't draw a same-point arc.
      if (from.distanceTo(to) < 0.05) return;

      // Control point pushed outward from origin along the midpoint
      // direction so the arc bows over the cortex instead of cutting
      // through it. 1.4× radius is enough lift to read clearly.
      const mid = from.clone().add(to).multiplyScalar(0.5);
      const lift = mid.clone().normalize().multiplyScalar(1.18);
      mid.lerp(lift, 0.7);

      const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
      const tubeGeo = new THREE.TubeGeometry(curve, 48, 0.008, 8, false);

      const mat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uColor: { value: color.clone() },
          uProgress: { value: 0 },
          uIntensity: { value: 1.4 },
        },
        vertexShader: /* glsl */ `
          varying float vU;
          void main() {
            // TubeGeometry's UV.x runs 0..1 along the spine.
            vU = uv.x;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          uniform float uProgress;
          uniform float uIntensity;
          varying float vU;
          void main() {
            // Moving Gaussian bullet riding the curve.
            float head = exp(-pow((vU - uProgress) * 8.0, 2.0));
            // Trailing tail behind the head fades smoothly.
            float trail = clamp(1.0 - (uProgress - vU) * 2.5, 0.0, 1.0);
            trail *= step(vU, uProgress);
            float fade = smoothstep(0.0, 0.08, uProgress) * (1.0 - smoothstep(0.85, 1.0, uProgress));
            float a = (head * 1.6 + trail * 0.45) * fade;
            gl_FragColor = vec4(uColor * uIntensity, clamp(a, 0.0, 1.0));
          }
        `,
      });
      const tube = new THREE.Mesh(tubeGeo, mat);
      tube.frustumCulled = false;
      synapsesGroup.add(tube);

      synapses.push({
        mesh: tube,
        material: mat,
        createdAt: performance.now() / 1000,
        lifeSec: 1.2,
      });

      // Hard cap — never let runaway entry feeds spawn unbounded arcs.
      while (synapses.length > 24) {
        const oldest = synapses.shift()!;
        synapsesGroup.remove(oldest.mesh);
        oldest.mesh.geometry.dispose();
        oldest.material.dispose();
      }
    }

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.65;
    controls.minDistance = 2.2;
    controls.maxDistance = 5.5;
    controls.enablePan = false;
    // Shift the lookAt point slightly down so the brain renders in
    // the upper half of the canvas. With target at origin (the default)
    // the brain landed visually low and users had to scroll the page
    // to see the bottom of the cortex.
    controls.target.set(0, -0.18, 0);
    controls.update();

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const dotMap = new Map<THREE.Object3D, DotData>();
    let lastInteract = Date.now();
    controls.addEventListener('start', () => { lastInteract = Date.now(); });
    controls.addEventListener('change', () => { lastInteract = Date.now(); });

    // Post-processing: bloom pass picks up the emissive dots and the
    // bright ridge highlights and gives them a soft HDR-style glow.
    // Tuned conservatively so the brain doesn't look radioactive — the
    // glow should suggest activity, not blow out the colors.
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(w, h),
      0.42, // strength — pushed up for demo wow. The cortex now reads
            // as luminous instead of merely lit; active lobes blow out
            // into a real HDR-feeling halo. Tier-2 slider can drive
            // this dynamically; baseline lives here.
      0.34, // radius — slightly wider so the halo wraps the silhouette
      0.78, // threshold — lower so quieter lobes still contribute
    );
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    let disposed = false;
    let rafId = 0;
    const start = performance.now();
    // Idle blend tracks a smooth 0..1 weight so the cinematic drift
    // fades in/out instead of cutting on/off when the user grabs the
    // brain or lets it go.
    let idleWeight = 0;
    function animate() {
      rafId = requestAnimationFrame(animate);
      const t = (performance.now() - start) / 1000;

      // Cinematic idle drift. Two non-resonant rotation rates give the
      // brain a Lissajous-style path that never quite repeats. Subtle
      // X tilt + Y spin reads as if the camera is gently orbiting.
      // Fades in over ~1s of inactivity, fades out the moment the user
      // touches the OrbitControls. Replaces the previous straight
      // rotation.y += 0.0035 which felt mechanical for a hero shot.
      const idleTarget = (Date.now() - lastInteract > 1200) ? 1 : 0;
      idleWeight += (idleTarget - idleWeight) * 0.05;
      const driftY = Math.cos(t * 0.18) * 0.0042;
      const driftX = Math.sin(t * 0.11) * 0.0009;
      brainGroup.rotation.y += driftY * idleWeight;
      brainGroup.rotation.x += driftX * idleWeight;

      // Breathing pulse — bumped from 2.4% to 5% amplitude. At the old
      // setting the pulse was so subtle most viewers missed it. 5%
      // reads as alive without becoming distracting.
      const breathe = 1 + Math.sin(t * 0.7) * 0.025;
      brainGroup.scale.setScalar(breathe);

      // Neural firing — every dot has its own deterministic pulse
      // schedule based on its entry id so a few flash brightly at any
      // given time, like neurons firing across the cortex.
      // Synapse arcs — advance each pulse, dispose expired. The
      // animation reads as if information is flowing between lobes
      // when an agent kicks off work.
      const nowSec = performance.now() / 1000;
      for (let i = synapses.length - 1; i >= 0; i--) {
        const s = synapses[i];
        const age = nowSec - s.createdAt;
        const progress = Math.min(1, age / s.lifeSec);
        s.material.uniforms.uProgress.value = progress;
        if (progress >= 1) {
          synapsesGroup.remove(s.mesh);
          s.mesh.geometry.dispose();
          s.material.dispose();
          synapses.splice(i, 1);
        }
      }

      const hoveredDimming = hoveredEntryRef.current !== null || selectedEntryRef.current !== null;
      dotMap.forEach((d) => {
        const isFocused = d.entry.id === hoveredEntryRef.current
                       || selectedEntryRef.current === d.entry.id;
        const dotMat = d.mesh.material as THREE.MeshBasicMaterial;
        const haloMat = d.halo.material as THREE.MeshBasicMaterial;

        if (isFocused) {
          // Hovered/selected dot pops: full opacity, big halo, scale up.
          d.mesh.scale.setScalar(1.7);
          d.halo.scale.setScalar(2.0);
          dotMat.opacity = 1.0;
          haloMat.opacity = 0.85;
          return;
        }

        // Slow per-dot pulse keeps the layout feeling alive without
        // making any one dot scream for attention. When the user is
        // hovering something, dim the others so the focused one stands
        // out clearly.
        const seed = (d.entry.id % 100) / 100;
        const phase = (t * 0.45 + seed * 8) % 5;
        let scale = 1;
        let opacityBoost = 0;
        if (phase < 0.55) {
          const pulse = Math.sin((phase / 0.55) * Math.PI);
          scale = 1 + pulse * 0.25;
          opacityBoost = pulse * 0.18;
        }
        d.mesh.scale.setScalar(scale);
        d.halo.scale.setScalar(scale);
        const baseOpacity = hoveredDimming ? 0.22 : 0.82;
        const baseHalo = hoveredDimming ? 0.05 : 0.22;
        dotMat.opacity = Math.min(1, baseOpacity + opacityBoost);
        haloMat.opacity = Math.min(1, baseHalo + opacityBoost * 0.4);
      });

      controls.update();
      composer.render();
    }
    animate();

    function resize() {
      const nw = wrap.clientWidth;
      const nh = wrap.clientHeight;
      if (nw === 0 || nh === 0) return;
      renderer.setSize(nw, nh, false);
      composer.setSize(nw, nh);
      bloom.setSize(nw, nh);
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
    }
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    requestAnimationFrame(() => requestAnimationFrame(resize));

    sceneStateRef.current = {
      scene, camera, renderer, controls,
      leftSurface: [], rightSurface: [], brainGeos: [],
      dotsGroup, synapsesGroup, synapses, spawnSynapse, bloom,
      raycaster, pointer, dotMap,
      rafId, lastInteract, brainGroup,
      cleanup: () => {
        disposed = true;
        cancelAnimationFrame(rafId);
        ro.disconnect();
        controls.dispose();
        composer.dispose();
        scene.traverse((obj) => {
          if ((obj as any).geometry) (obj as any).geometry.dispose();
          if ((obj as any).material) {
            const m = (obj as any).material;
            if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
            else m.dispose();
          }
        });
        renderer.dispose();
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      },
    };

    const activateBrain = (pools: LobePools, brainGeos: BrainGeoSnapshot[] = []) => {
      if (disposed || !sceneStateRef.current) return;
      sceneStateRef.current.leftSurface = pools.left;
      sceneStateRef.current.rightSurface = pools.right;
      sceneStateRef.current.brainGeos = brainGeos;
      setReady(true);
    };

    const fallbackToProcedural = (err: unknown) => {
      if (import.meta.env.DEV) console.warn('Falling back to procedural brain mesh; /brain.glb failed to load.', err);
      if (disposed) return;
      // Remove only the loaded GLB (if any) — keep dotsGroup, the
      // backside halo, and synapsesGroup parented. Earlier code naively
      // removed every child except dotsGroup, which silently detached
      // the halo shell and synapse arcs whenever brain.glb failed.
      // Codex T3-1 finding: the new visual effects vanished on the
      // procedural fallback path. Whitelist the things we built at init
      // and drop the rest (the loaded gltf scene).
      const keep = new Set<THREE.Object3D>([dotsGroup, synapsesGroup, haloMesh]);
      const toRemove: THREE.Object3D[] = [];
      brainGroup.children.forEach((c) => { if (!keep.has(c)) toRemove.push(c); });
      toRemove.forEach((c) => brainGroup.remove(c));
      activateBrain(buildProceduralBrain(brainGroup));
    };

    const loader = new GLTFLoader();
    // Brain GLB ships with meshopt geometry compression (~8x smaller).
    // Without this decoder the load fails and we fall back to procedural.
    loader.setMeshoptDecoder(MeshoptDecoder as any);
    loader.load(
      '/brain.glb',
      (gltf) => {
        if (disposed) return;
        try {
          const { pools, brainGeos } = prepareLoadedBrainModel(gltf.scene);
          if (pools.left.length + pools.right.length === 0) {
            throw new Error('Loaded brain GLB did not expose usable surface vertices.');
          }
          // Keep dotsGroup parented; just add the loaded gltf scene
          // alongside it.
          brainGroup.add(gltf.scene);
          activateBrain(pools, brainGeos);
        } catch (err) {
          fallbackToProcedural(err);
        }
      },
      undefined,
      fallbackToProcedural,
    );

    return () => { sceneStateRef.current?.cleanup(); sceneStateRef.current = null; };
  }, []);

  // Sync dots whenever entries / agentColors / filters / agentFilter change.
  useEffect(() => {
    const state = sceneStateRef.current;
    if (!state || !ready) return;

    // Detect newly arrived entries since last sync. Each one fires a
    // synapse arc from the previously-active lobe to the new entry's
    // lobe — visually narrating "this agent just handed off to that
    // one". Skips the very first sync (initial bulk load) so a fresh
    // page open doesn't fire 100 arcs simultaneously.
    const seen = seenEntryIdsRef.current;
    const isInitialLoad = seen.size === 0;
    const newEntries: typeof entries = [];
    for (const e of entries) {
      if (!seen.has(e.id)) {
        seen.add(e.id);
        if (!isInitialLoad) newEntries.push(e);
      }
    }
    if (!isInitialLoad && newEntries.length > 0) {
      // Fire arcs for up to a small batch — bursts shouldn't drown
      // the visualization with overlapping pulses.
      for (const e of newEntries.slice(0, 6)) {
        const toLobe = lobeFor(e.agent_id);
        const fromLobe = previousLobeRef.current && previousLobeRef.current !== toLobe
          ? previousLobeRef.current
          : pickRandomOtherLobe(toLobe);
        let colorHex = agentColors[e.agent_id] || '#a074ff';
        if (typeof colorHex === 'string' && colorHex.startsWith('var(')) {
          const m = colorHex.match(/var\((--[^)]+)\)/);
          if (m) {
            const resolved = getComputedStyle(document.documentElement)
              .getPropertyValue(m[1]).trim();
            if (resolved) colorHex = resolved;
          }
        }
        state.spawnSynapse(fromLobe, toLobe, new THREE.Color(colorHex));
        previousLobeRef.current = toLobe;
      }
    }
    // Memory cap: keep the seen set bounded so a long session doesn't
    // grow it unbounded. We re-add every render, so trimming is safe.
    if (seen.size > 4000) {
      const arr = Array.from(seen);
      seenEntryIdsRef.current = new Set(arr.slice(arr.length - 2000));
    }

    // Clear old dots
    while (state.dotsGroup.children.length > 0) {
      const child = state.dotsGroup.children[0];
      state.dotsGroup.remove(child);
      if ((child as any).geometry) (child as any).geometry.dispose();
      if ((child as any).material) (child as any).material.dispose();
    }
    state.dotMap.clear();

    // Track slot index per (lobe, side) so dots spread out evenly.
    const slotIdx: Record<string, number> = {};
    let placed = 0;

    // Place entries in chronological order so the layout is *meaningful*
    // instead of feeling random. Newest entries get slot 0 (top of the
    // lobe column from getSortedRegion), older ones fill downward.
    // Tie-break by entry id desc when timestamps collide (the API
    // returns entries with whole-second precision, so same-second
    // entries are common). Without the tiebreak the layout shuffles
    // on each render whenever Array#sort isn't stable for ties.
    const placementOrder = [...entries].sort((a, b) => (b.created_at - a.created_at) || (b.id - a.id));

    for (const e of placementOrder) {
      const lobe = lobeFor(e.agent_id);
      // Alternate sides deterministically per slot — within a lobe the
      // first slot of newest entries goes left, second right, third
      // left, etc. Stable across renders because slotIdx is keyed.
      const lobeSlot = (slotIdx[lobe] ?? -1) + 1;
      slotIdx[lobe] = lobeSlot;
      const side = (lobeSlot % 2 === 0) ? 'left' : 'right';
      const surface = side === 'left' ? state.leftSurface : state.rightSurface;
      // Half the slot index per side, so each side fills its own
      // top-to-bottom column without doubling up positions.
      const sideSlot = Math.floor(lobeSlot / 2);
      const pos = pickSurface(surface, lobe, sideSlot);
      if (!pos) continue;
      placed++;

      // Push the dot a bit outward along the surface normal so it
      // Push the dot outward by an *absolute* amount along the radial
      // direction. A relative scale (e.g. ×1.08) doesn't help vertices
      // that already sit at radius 0.7 when the mesh extends to 0.8 —
      // they get pushed to 0.756 and stay inside the surface. An
      // absolute 0.10-unit push always pokes the dot clear of the
      // anatomical GLB's sulci.
      const radial = pos.clone();
      if (radial.lengthSq() > 0) radial.normalize();
      // Push 0.06 absolute units along the radial direction so the
      // dot sits clearly on the brain's surface without floating off
      // into space.
      const outward = pos.clone().add(radial.multiplyScalar(0.06));

      // Resolve CSS custom properties (e.g. `var(--color-accent)`) to
      // a hex string before handing to THREE.Color, which can't parse
      // CSS vars.
      let colorHex = agentColors[e.agent_id] || '#888';
      if (typeof colorHex === 'string' && colorHex.startsWith('var(')) {
        const m = colorHex.match(/var\((--[^)]+)\)/);
        if (m) {
          const resolved = getComputedStyle(document.documentElement)
            .getPropertyValue(m[1])
            .trim();
          if (resolved) colorHex = resolved;
        }
      }
      const color = new THREE.Color(colorHex);

      // Visible dots, agent-colored. Earlier iterations hid them and
      // relied on cortex glow alone, but users couldn't tell which spot
      // on the brain mapped to which entry. With visible dots + the
      // chronological layout above (newest at top of lobe, oldest at
      // bottom), every dot is a deterministic mark you can scan and
      // hover.
      const r = 0.022;
      const dotGeo = new THREE.SphereGeometry(r, 12, 12);
      const dotMat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.82, depthWrite: false,
      });
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.copy(outward);
      state.dotsGroup.add(dot);

      // Soft halo behind each dot — additive blend so it reads as
      // glow, not as a sphere. The bloom pass picks it up.
      const haloGeo = new THREE.SphereGeometry(r * 2.6, 10, 10);
      const haloMat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.22, depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.position.copy(outward);
      state.dotsGroup.add(halo);

      const entryWithLobe = { ...e, lobe };
      state.dotMap.set(dot, { entry: entryWithLobe, pos: outward, mesh: dot, halo });
    }
    if (placed === 0 && entries.length > 0 && import.meta.env.DEV) {
      console.warn('[brain3d] no dots placed despite', entries.length, 'entries — surface pools may be empty');
    }
  }, [entries, agentColors, filters.nodeSize, ready]);

  // Activity glow — recompute brain vertex colors so each lobe brightens
  // in proportion to how much agent activity has landed there. Bloom
  // catches the hot regions and the cortex grooves naturally appear lit.
  useEffect(() => {
    const state = sceneStateRef.current;
    if (!state || !ready || state.brainGeos.length === 0) return;

    // Activity per lobe: sum entries whose agent maps there, but
    // respect the agent / lobe / search filters so the brain
    // actually responds to filter toggles.
    const activity: Record<string, number> = {
      frontal: 0, parietal: 0, temporal: 0, occipital: 0,
    };
    for (const e of entries) {
      if (filters.hiddenAgents.has(e.agent_id)) continue;
      if (agentFilter !== 'all' && e.agent_id !== agentFilter) continue;
      if (filters.query) {
        const q = filters.query.toLowerCase();
        if (!e.summary.toLowerCase().includes(q) && !e.action.toLowerCase().includes(q)) continue;
      }
      const lobe = lobeFor(e.agent_id);
      if (filters.hiddenLobes.has(lobe)) continue;
      activity[lobe] = (activity[lobe] || 0) + 1;
    }
    applyActivityGlow(state.brainGeos, activity, hoveredLobe, filters.nodeSize);
  }, [entries, ready, filters.hiddenAgents, filters.hiddenLobes, filters.query, agentFilter, hoveredLobe, filters.nodeSize]);

  // The "Glow intensity" slider also drives the bloom pass strength so
  // moving it has a visible HDR effect on the silhouette, not only the
  // per-vertex brightness boost. Range tuned so the default (slider=1)
  // matches the new baseline of 0.42, slider=0 dampens to 0.30, and
  // slider=2 pushes to 0.60 for that demo-wow saturated look.
  useEffect(() => {
    const state = sceneStateRef.current;
    if (!state || !ready) return;
    const slider = filters.nodeSize;
    state.bloom.strength = 0.30 + (slider / 2) * 0.30;
  }, [filters.nodeSize, ready]);

  // Apply visibility (agent / lobe / search filter) without rebuilding meshes.
  useEffect(() => {
    const state = sceneStateRef.current;
    if (!state) return;
    state.dotMap.forEach((d) => {
      const e = d.entry;
      let visible = true;
      if (filters.hiddenAgents.has(e.agent_id)) visible = false;
      if (filters.hiddenLobes.has(e.lobe)) visible = false;
      if (agentFilter !== 'all' && e.agent_id !== agentFilter) visible = false;
      if (filters.query) {
        const q = filters.query.toLowerCase();
        if (!e.summary.toLowerCase().includes(q) && !e.action.toLowerCase().includes(q)) visible = false;
      }
      // Hidden dots stop participating in raycasting too — Three.js
      // skips invisible objects in intersectObjects by default.
      d.mesh.visible = visible;
      d.halo.visible = visible;
    });
  }, [filters.hiddenAgents, filters.hiddenLobes, filters.query, agentFilter]);

  // Pointer move → raycast against dots first (specific entry), then
  // against the brain mesh (which lobe is under the cursor).
  function handleMove(e: MouseEvent) {
    const state = sceneStateRef.current;
    if (!state || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    setMousePos({ x: cx, y: cy });

    state.pointer.x = (cx / rect.width) * 2 - 1;
    state.pointer.y = -(cy / rect.height) * 2 + 1;
    state.raycaster.setFromCamera(state.pointer, state.camera);

    // 1) Specific entry hit (invisible dot meshes)
    const dotMeshes = Array.from(state.dotMap.keys());
    const dotHits = state.raycaster.intersectObjects(dotMeshes, false);
    if (dotHits.length > 0) {
      const data = state.dotMap.get(dotHits[0].object);
      if (data) {
        setHovered(data.entry.id);
        // Also lift the lobe glow so the hovered entry's region brightens.
        setHoveredLobe(data.entry.lobe);
        return;
      }
    }
    setHovered(null);

    // 2) Lobe hit (the brain mesh)
    if (state.brainGeos.length > 0) {
      const meshes = state.brainGeos.map((g) => g.mesh);
      const meshHits = state.raycaster.intersectObjects(meshes, false);
      if (meshHits.length > 0 && meshHits[0].face) {
        const hit = meshHits[0];
        const geo = state.brainGeos.find((g) => g.mesh === hit.object);
        if (geo) {
          const lobeId = geo.vertexLobeIds[hit.face!.a];
          if (lobeId) {
            setHoveredLobe(lobeId);
            return;
          }
        }
      }
    }
    setHoveredLobe(null);
  }

  function handleClick() {
    const state = sceneStateRef.current;
    if (!state) return;
    state.raycaster.setFromCamera(state.pointer, state.camera);
    const dotMeshes = Array.from(state.dotMap.keys());
    const hits = state.raycaster.intersectObjects(dotMeshes, false);
    if (hits.length > 0) {
      const data = state.dotMap.get(hits[0].object);
      if (data) {
        setSelected(data.entry);
        setPanelOpen(true);
      }
    }
  }

  // Pulse hovered dot
  useEffect(() => {
    const state = sceneStateRef.current;
    if (!state) return;
    state.dotMap.forEach((d) => {
      const target = d.entry.id === hovered ? 1.6 : 1;
      d.mesh.scale.setScalar(target);
      d.halo.scale.setScalar(target);
    });
  }, [hovered]);

  const hoveredEntry = useMemo(() => {
    if (!hovered) return null;
    const state = sceneStateRef.current;
    if (!state) return null;
    for (const d of state.dotMap.values()) {
      if (d.entry.id === hovered) return d.entry;
    }
    return null;
  }, [hovered]);

  const visibleAgents = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of entries) counts[e.agent_id] = (counts[e.agent_id] || 0) + 1;
    return counts;
  }, [entries]);

  const visibleEntryCount = useMemo(() => {
    let n = 0;
    sceneStateRef.current?.dotMap.forEach((d) => {
      const e = d.entry;
      if (filters.hiddenAgents.has(e.agent_id)) return;
      if (filters.hiddenLobes.has(e.lobe)) return;
      if (agentFilter !== 'all' && e.agent_id !== agentFilter) return;
      if (filters.query) {
        const q = filters.query.toLowerCase();
        if (!e.summary.toLowerCase().includes(q) && !e.action.toLowerCase().includes(q)) return;
      }
      n++;
    });
    return n;
  }, [filters, agentFilter, entries]);

  function update<K extends keyof BrainFilters>(key: K, value: BrainFilters[K]) {
    setFilters((f) => ({ ...f, [key]: value }));
  }
  function toggleHidden(set: 'hiddenAgents' | 'hiddenLobes', id: string) {
    setFilters((f) => {
      const next = new Set(f[set]);
      if (next.has(id)) next.delete(id); else next.add(id);
      return { ...f, [set]: next };
    });
  }

  return (
    <div class="flex-1 flex min-h-0 relative">
      <div
        ref={wrapRef}
        class="flex-1 relative overflow-hidden"
        style={{
          background:
            'radial-gradient(ellipse 70% 60% at 50% 50%, color-mix(in srgb, var(--color-accent) 7%, transparent), transparent 70%), var(--color-bg)',
          cursor: 'grab',
        }}
        onMouseMove={handleMove as any}
        onMouseDown={(e: any) => { (e.currentTarget as HTMLElement).style.cursor = 'grabbing'; }}
        onMouseUp={(e: any) => { (e.currentTarget as HTMLElement).style.cursor = 'grab'; }}
        onMouseLeave={() => setHovered(null)}
        onClick={handleClick as any}
      >
        {!panelOpen && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setPanelOpen(true); }}
            class="absolute top-4 right-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-card)] border border-[var(--color-border)] hover:border-[var(--color-accent)] text-[11.5px] text-[var(--color-text)] shadow-lg transition-colors z-30"
            style={{ backdropFilter: 'blur(8px)' }}
          >
            <SlidersHorizontal size={12} />
            Filters
            <span class="text-[10.5px] text-[var(--color-text-faint)] tabular-nums">
              {visibleEntryCount}
            </span>
          </button>
        )}

        {/* Drag hint */}
        <div class="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10.5px] text-[var(--color-text-faint)] pointer-events-none select-none z-30 px-2 py-0.5 rounded bg-[var(--color-bg)]/60" style={{ backdropFilter: 'blur(4px)' }}>
          drag to rotate · scroll to zoom
        </div>

        {hoveredEntry && mousePos && !selected && (
          <div
            class="absolute pointer-events-none bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg shadow-xl px-3 py-2 text-[11.5px] text-[var(--color-text)] max-w-[320px] z-10"
            style={{
              left: Math.min(mousePos.x + 14, (wrapRef.current?.clientWidth || 800) - 340),
              top: Math.min(mousePos.y + 14, (wrapRef.current?.clientHeight || 500) - 110),
              backdropFilter: 'blur(8px)',
            }}
          >
            <div class="flex items-center gap-2 mb-1">
              <span
                class="inline-block w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: agentColors[hoveredEntry.agent_id] || 'var(--color-text-muted)' }}
              />
              <span class="font-mono text-[10.5px] text-[var(--color-text-muted)]">
                @{hoveredEntry.agent_id} · {hoveredEntry.action}
              </span>
              <span class="text-[10px] text-[var(--color-text-faint)] ml-auto tabular-nums">
                {formatRelativeTime(hoveredEntry.created_at)}
              </span>
            </div>
            <div class={'leading-snug ' + (blurOn ? 'privacy-blur revealed' : '')}>
              {hoveredEntry.summary}
            </div>
          </div>
        )}

        {/* Lobe hover stats — only when not hovering a specific entry. */}
        {!hoveredEntry && hoveredLobe && mousePos && !selected && (
          <LobeStatsTooltip
            lobeId={hoveredLobe}
            entries={entries}
            agentColors={agentColors}
            mousePos={mousePos}
            wrapWidth={wrapRef.current?.clientWidth || 800}
            wrapHeight={wrapRef.current?.clientHeight || 500}
          />
        )}
      </div>

      <aside
        class={[
          'absolute top-0 right-0 bottom-0 w-[320px] bg-[var(--color-card)] border-l border-[var(--color-border)] flex flex-col min-h-0 shadow-2xl z-20',
          'transition-transform duration-300 ease-out',
          panelOpen ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
        style={{ backdropFilter: 'blur(8px)' }}
      >
        {selected ? (
          <DetailPanel
            entry={selected}
            color={agentColors[selected.agent_id] || 'var(--color-text-muted)'}
            blurOn={blurOn}
            lobeLabel={LOBE_BY_ID[lobeFor(selected.agent_id)]?.label}
            onClose={() => { setSelected(null); setPanelOpen(false); }}
          />
        ) : (
          <FilterPanel
            filters={filters}
            update={update}
            toggleHidden={toggleHidden}
            visibleAgents={visibleAgents}
            agentColors={agentColors}
            onReset={() => setFilters(DEFAULT_FILTERS)}
            totalEntries={entries.length}
            visibleEntries={visibleEntryCount}
            onClose={() => setPanelOpen(false)}
          />
        )}
      </aside>
    </div>
  );
}

// Detail + Filter panels: identical to the 2D version visually.

function DetailPanel({
  entry, color, blurOn, lobeLabel, onClose,
}: {
  entry: HiveEntry; color: string; blurOn: boolean; lobeLabel?: string; onClose: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  return (
    <>
      <header class="flex items-center px-4 py-3 border-b border-[var(--color-border)] gap-2">
        <span class="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        <span class="font-mono text-[12px] text-[var(--color-text)]">@{entry.agent_id}</span>
        {lobeLabel && (
          <span class="text-[10px] uppercase tracking-wider text-[var(--color-text-faint)] ml-1">{lobeLabel}</span>
        )}
        <span class="text-[10.5px] text-[var(--color-text-faint)] ml-auto tabular-nums">
          {formatRelativeTime(entry.created_at)}
        </span>
        <button type="button" onClick={onClose} class="p-1 rounded hover:bg-[var(--color-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
          <X size={13} />
        </button>
      </header>
      <div class="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        <Field label="Action"><span class="font-mono text-[11.5px] text-[var(--color-text)]">{entry.action}</span></Field>
        <Field label="Summary">
          <div
            class={'text-[12.5px] text-[var(--color-text)] leading-relaxed ' + (blurOn && !revealed ? 'privacy-blur' : (blurOn && revealed ? 'privacy-blur revealed' : ''))}
            onClick={() => blurOn && setRevealed((v) => !v)}
          >
            {entry.summary}
          </div>
        </Field>
        {entry.artifacts && (
          <Field label="Artifacts">
            <div class="font-mono text-[11px] text-[var(--color-text-muted)] whitespace-pre-wrap break-words">{entry.artifacts}</div>
          </Field>
        )}
        <Field label="Chat">
          <div class="font-mono text-[11px] text-[var(--color-text-muted)] truncate">{entry.chat_id}</div>
        </Field>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: any }) {
  return (
    <div>
      <div class="text-[10px] uppercase tracking-wider text-[var(--color-text-faint)] mb-1">{label}</div>
      {children}
    </div>
  );
}

function FilterPanel({
  filters, update, toggleHidden, visibleAgents, agentColors, onReset, totalEntries, visibleEntries, onClose,
}: {
  filters: BrainFilters;
  update: <K extends keyof BrainFilters>(key: K, value: BrainFilters[K]) => void;
  toggleHidden: (set: 'hiddenAgents' | 'hiddenLobes', id: string) => void;
  visibleAgents: Record<string, number>;
  agentColors: Record<string, string>;
  onReset: () => void;
  totalEntries: number;
  visibleEntries: number;
  onClose: () => void;
}) {
  const [openSection, setOpenSection] = useState({ agents: true, lobes: false, display: false });
  return (
    <>
      <header class="flex items-center px-4 py-3 border-b border-[var(--color-border)] gap-2">
        <Sparkles size={13} class="text-[var(--color-accent)]" />
        <span class="text-[12.5px] font-semibold text-[var(--color-text)]">Filters</span>
        <span class="text-[10.5px] text-[var(--color-text-faint)] ml-auto tabular-nums">
          {visibleEntries} / {totalEntries}
        </span>
        <button type="button" onClick={onReset} class="p-1 rounded hover:bg-[var(--color-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors" title="Reset">
          <RotateCw size={11} />
        </button>
        <button type="button" onClick={onClose} class="p-1 rounded hover:bg-[var(--color-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors" title="Close">
          <X size={13} />
        </button>
      </header>
      <div class="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        <div class="relative">
          <Search size={12} class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]" />
          <input
            value={filters.query}
            onInput={(e) => update('query', (e.target as HTMLInputElement).value)}
            placeholder="Search summaries…"
            class="w-full pl-7 pr-2.5 py-1.5 rounded bg-[var(--color-bg)] border border-[var(--color-border)] focus:border-[var(--color-accent)] focus:outline-none text-[12px] text-[var(--color-text)]"
          />
        </div>
        <Section label="Agents" open={openSection.agents} onToggle={() => setOpenSection((s) => ({ ...s, agents: !s.agents }))}>
          <div class="space-y-1">
            {Object.entries(visibleAgents).sort((a, b) => b[1] - a[1]).map(([id, count]) => {
              const on = !filters.hiddenAgents.has(id);
              const color = agentColors[id] || 'var(--color-text-muted)';
              const lobe = LOBE_BY_ID[lobeFor(id)];
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleHidden('hiddenAgents', id)}
                  class="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[var(--color-elevated)] transition-colors text-left"
                >
                  <span class="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color, boxShadow: on ? `0 0 6px ${color}` : 'none' }} />
                  <span class={'font-mono text-[11.5px] ' + (on ? 'text-[var(--color-text)]' : 'text-[var(--color-text-faint)]')}>@{id}</span>
                  {lobe && <span class="text-[10px]" style={{ color: on ? `#${lobe.color.getHexString()}` : 'var(--color-text-faint)', opacity: on ? 0.75 : 0.4 }}>{lobe.label.toLowerCase()}</span>}
                  <span class="ml-auto text-[10.5px] tabular-nums text-[var(--color-text-faint)]">{count}</span>
                  <span class={'brain-switch ' + (on ? 'is-on' : '')} />
                </button>
              );
            })}
          </div>
        </Section>
        <Section label="Regions" open={openSection.lobes} onToggle={() => setOpenSection((s) => ({ ...s, lobes: !s.lobes }))}>
          <div class="space-y-1">
            {LOBES.map((l) => {
              const on = !filters.hiddenLobes.has(l.id);
              const colorHex = `#${l.color.getHexString()}`;
              return (
                <button key={l.id} type="button" onClick={() => toggleHidden('hiddenLobes', l.id)} class="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[var(--color-elevated)] transition-colors text-left">
                  <span class="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: colorHex, opacity: on ? 1 : 0.3, boxShadow: on ? `0 0 6px ${colorHex}` : 'none' }} />
                  <span class={'text-[12px] ' + (on ? 'text-[var(--color-text)]' : 'text-[var(--color-text-faint)]')}>{l.label}</span>
                  <span class={'brain-switch ml-auto ' + (on ? 'is-on' : '')} />
                </button>
              );
            })}
          </div>
        </Section>
        <Section label="Display" open={openSection.display} onToggle={() => setOpenSection((s) => ({ ...s, display: !s.display }))}>
          <SliderRow
            label="Glow intensity"
            value={filters.nodeSize}
            min={0}
            max={2}
            step={0.05}
            onInput={(v) => update('nodeSize', v)}
          />
        </Section>
      </div>
    </>
  );
}

function Section({ label, open, onToggle, children }: { label: string; open: boolean; onToggle: () => void; children: any }) {
  return (
    <div>
      <button type="button" onClick={onToggle} class="w-full flex items-center gap-1 text-[10.5px] uppercase tracking-wider text-[var(--color-text-faint)] hover:text-[var(--color-text-muted)] mb-1.5">
        {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        {label}
      </button>
      {open && children}
    </div>
  );
}

function SliderRow({ label, value, min, max, step, onInput, fmt }: { label: string; value: number; min: number; max: number; step: number; onInput: (v: number) => void; fmt?: (v: number) => string }) {
  return (
    <div>
      <div class="flex items-center justify-between mb-1">
        <span class="text-[11px] text-[var(--color-text-muted)]">{label}</span>
        <span class="text-[10.5px] text-[var(--color-text-faint)] tabular-nums">{fmt ? fmt(value) : value.toFixed(2)}</span>
      </div>
      <input type="range" class="brain-slider" min={min} max={max} step={step} value={value} onInput={(e) => onInput(parseFloat((e.target as HTMLInputElement).value))} />
    </div>
  );
}

// ── Lobe hover stats ─────────────────────────────────────────────────
// Each lobe stands in for a "function" of the brain. Hovering shows
// what that lobe is currently full of: total entry count + a small
// agent-distribution pie chart.

const LOBE_FUNCTION: Record<string, string> = {
  frontal:   'Decisions & planning',
  parietal:  'Sensing & integration',
  temporal:  'Language & memory',
  occipital: 'Output & creation',
};

function LobeStatsTooltip({
  lobeId, entries, agentColors, mousePos, wrapWidth, wrapHeight,
}: {
  lobeId: string;
  entries: HiveEntry[];
  agentColors: Record<string, string>;
  mousePos: { x: number; y: number };
  wrapWidth: number;
  wrapHeight: number;
}) {
  const lobe = LOBE_BY_ID[lobeId];
  if (!lobe) return null;

  // Tally entries that map to this lobe, grouped by agent.
  const byAgent: Record<string, number> = {};
  let total = 0;
  for (const e of entries) {
    if (lobeFor(e.agent_id) !== lobeId) continue;
    byAgent[e.agent_id] = (byAgent[e.agent_id] || 0) + 1;
    total++;
  }
  const slices = Object.entries(byAgent).sort((a, b) => b[1] - a[1]);

  return (
    <div
      class="absolute pointer-events-none bg-[var(--color-card)]/95 border border-[var(--color-border)] rounded-lg shadow-xl p-3 text-[12px] text-[var(--color-text)] z-10 brain-tooltip-enter"
      style={{
        left: Math.min(mousePos.x + 14, wrapWidth - 230),
        top: Math.min(mousePos.y + 14, wrapHeight - 200),
        backdropFilter: 'blur(8px)',
        width: 220,
      }}
    >
      <div class="flex items-center gap-2 mb-1">
        <span
          class="inline-block w-2 h-2 rounded-full"
          style={{ backgroundColor: `#${lobe.color.getHexString()}` }}
        />
        <span class="font-semibold">{lobe.label}</span>
        <span class="ml-auto text-[10.5px] text-[var(--color-text-faint)] tabular-nums">{total}</span>
      </div>
      <div class="text-[10.5px] uppercase tracking-wider text-[var(--color-text-faint)] mb-2">
        {LOBE_FUNCTION[lobeId] || lobe.label}
      </div>
      {total === 0 ? (
        <div class="text-[11px] text-[var(--color-text-faint)]">No activity yet in this region.</div>
      ) : (
        <div class="flex items-center gap-3">
          <LobePie slices={slices} agentColors={agentColors} />
          <div class="flex-1 space-y-1 min-w-0">
            {slices.slice(0, 4).map(([agentId, count]) => (
              <div key={agentId} class="flex items-center gap-1.5 text-[10.5px]">
                <span
                  class="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: agentColors[agentId] || 'var(--color-text-muted)' }}
                />
                <span class="font-mono truncate text-[var(--color-text-muted)]">@{agentId}</span>
                <span class="ml-auto tabular-nums text-[var(--color-text-faint)]">{count}</span>
              </div>
            ))}
            {slices.length > 4 && (
              <div class="text-[10px] text-[var(--color-text-faint)]">
                +{slices.length - 4} more
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function LobePie({
  slices, agentColors,
}: {
  slices: [string, number][];
  agentColors: Record<string, string>;
}) {
  const total = slices.reduce((sum, [, c]) => sum + c, 0);
  const cx = 32, cy = 32, r = 28;
  let acc = 0;
  // Resolve CSS-var colors once for SVG fill (Three.js path resolves
  // them too; SVG can use them directly but only if they're real CSS
  // refs, which is fine for our case).
  function color(agent: string) {
    const raw = agentColors[agent] || '#888';
    if (raw.startsWith('var(')) {
      const m = raw.match(/var\((--[^)]+)\)/);
      if (m) {
        const v = getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim();
        if (v) return v;
      }
    }
    return raw;
  }
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" class="shrink-0">
      <circle cx={cx} cy={cy} r={r} fill="var(--color-bg)" stroke="var(--color-border)" stroke-width="0.5" />
      {slices.map(([agentId, count], i) => {
        const startAngle = (acc / total) * 2 * Math.PI - Math.PI / 2;
        const endAngle = ((acc + count) / total) * 2 * Math.PI - Math.PI / 2;
        acc += count;
        const x1 = cx + r * Math.cos(startAngle);
        const y1 = cy + r * Math.sin(startAngle);
        const x2 = cx + r * Math.cos(endAngle);
        const y2 = cy + r * Math.sin(endAngle);
        const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
        // Single-slice case: draw a filled circle instead of an arc
        // (an arc with start === end would render nothing).
        if (slices.length === 1) {
          return <circle key={agentId} cx={cx} cy={cy} r={r} fill={color(agentId)} />;
        }
        const d = `M ${cx},${cy} L ${x1},${y1} A ${r},${r} 0 ${largeArc} 1 ${x2},${y2} Z`;
        return <path key={agentId} d={d} fill={color(agentId)} stroke="var(--color-bg)" stroke-width="0.5" />;
      })}
    </svg>
  );
}
