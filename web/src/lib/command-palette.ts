import { signal } from '@preact/signals';
import { ROUTES } from './routes';
import { setTheme } from './theme';

export const commandPaletteOpen = signal(false);

export interface PaletteAction {
  id: string;
  label: string;
  hint?: string;
  group: 'Navigation' | 'Actions' | 'Theme';
  // When invoked, the palette closes itself after running.
  run: (ctx: { navigate: (path: string) => void }) => void;
}

// Built-in actions. Page-specific actions can be added later by calling
// registerActions(...) on mount and unregisterActions(...) on unmount.
export function buildActions(): PaletteAction[] {
  const nav: PaletteAction[] = ROUTES.map((r) => ({
    id: 'nav:' + r.path,
    label: r.label,
    hint: r.shortcut ? r.shortcut.toUpperCase() : undefined,
    group: 'Navigation',
    run: ({ navigate }) => navigate(r.path),
  }));

  const themes: PaletteAction[] = [
    { id: 'theme:graphite', label: 'Theme: Graphite', group: 'Theme', run: () => setTheme('graphite') },
    { id: 'theme:midnight', label: 'Theme: Midnight', group: 'Theme', run: () => setTheme('midnight') },
    { id: 'theme:crimson',  label: 'Theme: Crimson',  group: 'Theme', run: () => setTheme('crimson')  },
  ];

  const actions: PaletteAction[] = [
    {
      id: 'action:new-task',
      label: 'New mission task',
      hint: 'C',
      group: 'Actions',
      run: ({ navigate }) => navigate('/mission?new=1'),
    },
    {
      id: 'action:new-agent',
      label: 'Create new agent',
      group: 'Actions',
      run: ({ navigate }) => navigate('/agents?new=1'),
    },
  ];

  return [...nav, ...actions, ...themes];
}

// Token-aware match: every whitespace-separated token in the query must
// appear somewhere in the label. So "new task" matches "New mission task"
// because both "new" and "task" appear in the label, in any order.
// Initials still work as a fallback ("mc" → "Mission Control").
export function filterActions(query: string, actions: PaletteAction[]): PaletteAction[] {
  const q = query.trim().toLowerCase();
  if (!q) return actions;
  const tokens = q.split(/\s+/).filter(Boolean);
  const initials = (s: string) =>
    s.split(/[\s:]+/).map((w) => w[0] || '').join('').toLowerCase();
  return actions.filter((a) => {
    const hay = a.label.toLowerCase();
    if (tokens.every((t) => hay.includes(t))) return true;
    if (initials(a.label).includes(q.replace(/\s+/g, ''))) return true;
    return false;
  });
}
