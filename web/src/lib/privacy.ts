// Per-section privacy blur preference (Memories, Hive Mind, ...).
//
// Stored in localStorage — this is a screenshot-safety preference, not a
// workspace identity, so it stays per-browser. Mirrors the pattern from
// the legacy dashboard's privacyBlur_<section> keys so users who toggled
// blur on the old dashboard get the same default here.
//
// Per-row "I clicked to reveal this one" state is intentionally NOT
// persisted — closing and reopening the page re-blurs everything, which
// is the safer default if your screen wakes up showing this page.

import { signal } from '@preact/signals';

export type PrivacySection = 'memories' | 'hive' | 'scheduled';

function key(section: PrivacySection): string {
  return `claudeclaw.privacy.${section}`;
}

function loadInitial(section: PrivacySection): boolean {
  try {
    const v = localStorage.getItem(key(section));
    if (v === 'on') return true;
    if (v === 'off') return false;
    // Legacy dashboard used `privacyBlur_<section>_all = 'blurred' | 'revealed'`.
    const legacy = localStorage.getItem(`privacyBlur_${section}_all`);
    if (legacy === 'blurred') return true;
    if (legacy === 'revealed') return false;
  } catch {}
  return false;
}

const _signals: Partial<Record<PrivacySection, ReturnType<typeof signal<boolean>>>> = {};

export function privacyBlur(section: PrivacySection) {
  if (!_signals[section]) _signals[section] = signal<boolean>(loadInitial(section));
  return _signals[section]!;
}

export function togglePrivacyBlur(section: PrivacySection): void {
  const sig = privacyBlur(section);
  const next = !sig.value;
  sig.value = next;
  try { localStorage.setItem(key(section), next ? 'on' : 'off'); } catch {}
}
