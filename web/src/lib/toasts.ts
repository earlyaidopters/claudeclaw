import { signal } from '@preact/signals';

export interface Toast {
  id: number;
  tone: 'info' | 'success' | 'warn' | 'error';
  title: string;
  description?: string;
  // Optional inline action button (e.g. Restart now). Returning a promise
  // lets the toast show "…" while it runs and dismiss on resolve.
  action?: { label: string; run: () => Promise<void> | void };
  // Auto-dismiss in ms. 0 = persistent until user closes.
  durationMs?: number;
}

let nextId = 1;
export const toasts = signal<Toast[]>([]);

export function pushToast(t: Omit<Toast, 'id'>): number {
  const id = nextId++;
  const full: Toast = { id, durationMs: 4000, ...t };
  toasts.value = [...toasts.value, full];
  if (full.durationMs && full.durationMs > 0) {
    setTimeout(() => dismissToast(id), full.durationMs);
  }
  return id;
}

export function dismissToast(id: number) {
  toasts.value = toasts.value.filter((t) => t.id !== id);
}
