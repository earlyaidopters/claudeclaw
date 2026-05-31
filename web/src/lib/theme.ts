import { signal, effect } from '@preact/signals';

export type ThemeName = 'graphite' | 'midnight' | 'crimson';

const STORAGE_KEY = 'claudeclaw.theme';
const ACCENT_KEY = 'claudeclaw.theme.customAccent';
const SCALE_KEY = 'claudeclaw.uiScale';
const SHOW_COSTS_KEY = 'claudeclaw.showCosts';

function loadInitial(): ThemeName {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'graphite' || saved === 'midnight' || saved === 'crimson') {
      return saved;
    }
  } catch {}
  return 'graphite';
}

function loadCustomAccent(): string | null {
  try {
    const v = localStorage.getItem(ACCENT_KEY);
    if (v && /^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
  } catch {}
  return null;
}

function loadScale(): number {
  try {
    const v = parseFloat(localStorage.getItem(SCALE_KEY) || '');
    if (Number.isFinite(v) && v >= 0.8 && v <= 1.6) return v;
  } catch {}
  return 1.0;
}

function loadShowCosts(): boolean {
  try {
    const v = localStorage.getItem(SHOW_COSTS_KEY);
    if (v === 'on') return true;
    if (v === 'off') return false;
  } catch {}
  // Default OFF for Claude Code subscription users — costs are only
  // meaningful if you're on the API path. Toggle on in Settings → Display.
  return false;
}

export const theme = signal<ThemeName>(loadInitial());

/** Custom accent override (hex). When set, it overrides the active
 *  theme's --color-accent (and derives --color-accent-soft/-hover from
 *  it) via inline style on <html>. Null restores the theme default. */
export const customAccent = signal<string | null>(loadCustomAccent());

/** Global UI zoom factor. Applied via the CSS `zoom` property on the
 *  root element so layout calculations stay correct (unlike transform
 *  scale, which would clip overflows). 1.0 is the design baseline;
 *  most users will want 1.1–1.25. */
export const uiScale = signal<number>(loadScale());

/** Whether to surface per-agent / per-session cost figures. Default OFF
 *  because most users are on the Claude Code subscription path where
 *  cost is irrelevant. Flip on in Settings → Display if you've moved
 *  to the API. Affects Agent cards, AgentDetail KPIs, Usage page KPIs
 *  + 30-day chart, and the Chat session bar's "Cost today" cell. */
export const showCosts = signal<boolean>(loadShowCosts());

export const themeMeta: Record<ThemeName, { label: string; swatch: string }> = {
  graphite: { label: 'Graphite', swatch: '#8b8af0' },
  midnight: { label: 'Midnight', swatch: '#5eb6ff' },
  crimson: { label: 'Crimson', swatch: '#ff5e6e' },
};

// Apply theme + scale + accent override to <html> whenever any signal
// changes. Persist each to localStorage so the choice survives reloads.
effect(() => {
  const next = theme.value;
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem(STORAGE_KEY, next); } catch {}
});

effect(() => {
  const accent = customAccent.value;
  const root = document.documentElement;
  if (accent) {
    root.style.setProperty('--color-accent', accent);
    root.style.setProperty(
      '--color-accent-soft',
      `color-mix(in srgb, ${accent} 18%, transparent)`,
    );
    root.style.setProperty('--color-accent-hover', shadeHex(accent, -10));
    try { localStorage.setItem(ACCENT_KEY, accent); } catch {}
  } else {
    root.style.removeProperty('--color-accent');
    root.style.removeProperty('--color-accent-soft');
    root.style.removeProperty('--color-accent-hover');
    try { localStorage.removeItem(ACCENT_KEY); } catch {}
  }
});

effect(() => {
  const s = uiScale.value;
  // Use CSS `zoom` (not transform: scale) — keeps layout calculations
  // correct so scrollbars and viewport math behave. Cross-browser
  // support landed in Firefox 126 (May 2024).
  document.documentElement.style.zoom = String(s);
  try { localStorage.setItem(SCALE_KEY, String(s)); } catch {}
});

effect(() => {
  try { localStorage.setItem(SHOW_COSTS_KEY, showCosts.value ? 'on' : 'off'); } catch {}
});

export function setTheme(next: ThemeName) {
  theme.value = next;
}

export function setCustomAccent(hex: string | null) {
  if (hex && !/^#[0-9a-fA-F]{6}$/.test(hex)) return;
  customAccent.value = hex ? hex.toLowerCase() : null;
}

export function setUiScale(next: number) {
  uiScale.value = Math.max(0.8, Math.min(1.6, next));
}

export function setShowCosts(next: boolean) {
  showCosts.value = next;
}

// Lighten/darken a hex color by `pct` percent (-100..100). Used to
// derive the hover variant from the user's accent.
function shadeHex(hex: string, pct: number): string {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return hex;
  const num = parseInt(m[1], 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  const t = pct < 0 ? 0 : 255;
  const p = Math.abs(pct) / 100;
  r = Math.round((t - r) * p + r);
  g = Math.round((t - g) * p + g);
  b = Math.round((t - b) * p + b);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}
