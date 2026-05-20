// Tiny WebGL availability probe. Run once on demand and cache the
// result so the answer is stable across navigations. We don't need
// fancy capability detection — if WebGL exists at all, the brain
// scene will run; the renderer's own pixel ratio + extension checks
// handle the rest.

let cached: boolean | null = null;

export function hasWebGL(): boolean {
  if (cached !== null) return cached;
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl') || (c.getContext as any)('experimental-webgl');
    cached = !!gl;
  } catch {
    cached = false;
  }
  return cached;
}
