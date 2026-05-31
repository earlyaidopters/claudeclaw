// Personalization signals backed by /api/dashboard/settings.
//
// The theme already lives in localStorage (web/src/lib/theme.ts) — we keep
// that pattern for theme since it's per-browser by design. Everything in
// THIS file lives on the server so a name change shows up in another
// browser, and so power-users have one source of truth.
//
// Hydration strategy: we boot with sensible defaults (so the UI doesn't
// flicker), kick off a fetch to /api/dashboard/settings on module load,
// and update the signals once the response arrives. Mutations are
// optimistic: the signal flips immediately and a debounced PATCH writes
// it back. If the PATCH fails we keep the local value but log a warning;
// the user can retry by editing again.

import { signal } from '@preact/signals';
import { apiGet, apiPatch } from './api';

// ── Defaults ────────────────────────────────────────────────────────────

const DEFAULT_WORKSPACE_NAME = 'ClaudeClaw';
const DEFAULT_COLLAPSED: string[] = []; // every section starts open

// hotkey mod is 'auto' by default; resolveModKey() consults navigator.platform
// when this is 'auto' so Mac users get ⌘ and everyone else gets Ctrl.
export type HotkeyMod = 'meta' | 'ctrl' | 'auto';
const DEFAULT_HOTKEY_MOD: HotkeyMod = 'auto';

// ── Signals ────────────────────────────────────────────────────────────

export const workspaceName = signal<string>(DEFAULT_WORKSPACE_NAME);
export const collapsedSections = signal<Set<string>>(new Set(DEFAULT_COLLAPSED));
export const hotkeyMod = signal<HotkeyMod>(DEFAULT_HOTKEY_MOD);
export const missionColumnOrder = signal<string[]>([]);
export const missionColumnWidths = signal<Record<string, number>>({});

// ── Hydration ──────────────────────────────────────────────────────────

let _hydrated = false;

export async function hydratePersonalization(): Promise<void> {
  if (_hydrated) return;
  _hydrated = true;
  try {
    const data = await apiGet<Record<string, string>>('/api/dashboard/settings');
    if (typeof data?.workspace_name === 'string' && data.workspace_name.trim()) {
      workspaceName.value = data.workspace_name;
    }
    if (data?.hotkey_mod === 'meta' || data?.hotkey_mod === 'ctrl' || data?.hotkey_mod === 'auto') {
      hotkeyMod.value = data.hotkey_mod;
    }
    if (typeof data?.sidebar_collapsed_sections === 'string') {
      const parsed = safeParseArray(data.sidebar_collapsed_sections);
      if (parsed) collapsedSections.value = new Set(parsed);
    }
    if (typeof data?.mission_column_order === 'string') {
      const parsed = safeParseArray(data.mission_column_order);
      if (parsed) missionColumnOrder.value = parsed;
    }
    if (typeof data?.mission_column_widths === 'string') {
      const parsed = safeParseObject(data.mission_column_widths);
      if (parsed) missionColumnWidths.value = parsed as Record<string, number>;
    }
  } catch (err) {
    // Best-effort: dashboard works without personalization on a fresh
    // install or when the server is briefly unreachable.
    // eslint-disable-next-line no-console
    console.warn('[personalization] hydrate failed', err);
  }
}

// Hydrate once, eagerly. Returns a promise consumers can await if they
// need to gate first paint on personalization (most don't — defaults are
// fine for the initial render).
export const personalizationReady = hydratePersonalization();

// ── Mutators ───────────────────────────────────────────────────────────

const debouncedSave = makeDebouncedSaver();

export function setWorkspaceName(next: string): void {
  const trimmed = next.replace(/[\u0000-\u001f]/g, '').slice(0, 32).trim();
  workspaceName.value = trimmed || DEFAULT_WORKSPACE_NAME;
  debouncedSave('workspace_name', workspaceName.value);
}

export function setHotkeyMod(next: HotkeyMod): void {
  hotkeyMod.value = next;
  debouncedSave('hotkey_mod', next);
}

export function toggleSectionCollapsed(name: string): void {
  const next = new Set(collapsedSections.value);
  if (next.has(name)) next.delete(name);
  else next.add(name);
  collapsedSections.value = next;
  debouncedSave('sidebar_collapsed_sections', JSON.stringify([...next]));
}

export function setMissionColumnOrder(next: string[]): void {
  missionColumnOrder.value = next;
  debouncedSave('mission_column_order', JSON.stringify(next));
}

export function setMissionColumnWidth(agentId: string, px: number): void {
  const clamped = Math.max(240, Math.min(640, Math.round(px)));
  const next = { ...missionColumnWidths.value, [agentId]: clamped };
  missionColumnWidths.value = next;
  debouncedSave('mission_column_widths', JSON.stringify(next));
}

/** Replace the entire widths map in one shot — used by the "uniform"
 *  layout presets so we hit the backend once instead of N times. */
export function setMissionColumnWidthsBulk(next: Record<string, number>): void {
  const cleaned: Record<string, number> = {};
  for (const [id, px] of Object.entries(next)) {
    cleaned[id] = Math.max(240, Math.min(640, Math.round(px)));
  }
  missionColumnWidths.value = cleaned;
  debouncedSave('mission_column_widths', JSON.stringify(cleaned));
}

// ── Hotkey resolution ──────────────────────────────────────────────────

const isMac = /Mac|iPhone|iPad/i.test(navigator.platform || '');

/** True if the current event satisfies the configured modifier. */
export function matchesModKey(e: KeyboardEvent): boolean {
  const mode = hotkeyMod.value;
  if (mode === 'meta') return e.metaKey;
  if (mode === 'ctrl') return e.ctrlKey;
  // auto: prefer ⌘ on macOS, Ctrl elsewhere; accept either to be lenient.
  return isMac ? e.metaKey : e.ctrlKey;
}

/** Display string for the modifier (sidebar hint, command palette footer). */
export function modKeyLabel(): string {
  const mode = hotkeyMod.value;
  if (mode === 'meta') return '⌘';
  if (mode === 'ctrl') return 'Ctrl';
  return isMac ? '⌘' : 'Ctrl';
}

// ── Helpers ────────────────────────────────────────────────────────────

function makeDebouncedSaver(): (key: string, value: string) => void {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const inflight = new Map<string, string>(); // last value posted, dedup
  return (key, value) => {
    const existing = timers.get(key);
    if (existing) clearTimeout(existing);
    timers.set(key, setTimeout(async () => {
      timers.delete(key);
      if (inflight.get(key) === value) return;
      inflight.set(key, value);
      try {
        await apiPatch('/api/dashboard/settings', { key, value });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(`[personalization] save failed for ${key}`, err);
      }
    }, 600));
  };
}

function safeParseArray(raw: string): string[] | null {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : null;
  } catch { return null; }
}

function safeParseObject(raw: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  } catch { return null; }
}
