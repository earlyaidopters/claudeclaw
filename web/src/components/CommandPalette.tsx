import { useState, useEffect, useMemo, useRef } from 'preact/hooks';
import { useLocation } from 'wouter-preact';
import { Search, ArrowRight } from 'lucide-preact';
import {
  commandPaletteOpen,
  buildActions,
  filterActions,
  type PaletteAction,
} from '@/lib/command-palette';
import { matchesModKey } from '@/lib/personalization';

export function CommandPalette() {
  const open = commandPaletteOpen.value;
  const [, navigate] = useLocation();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const allActions = useMemo(() => buildActions(), []);
  const visible = useMemo(() => filterActions(query, allActions), [query, allActions]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      // Focus next tick so the input exists.
      queueMicrotask(() => inputRef.current?.focus());
    }
  }, [open]);

  // Global Cmd/Ctrl+K to open, Escape to close, plus arrow navigation while open.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (matchesModKey(e) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        commandPaletteOpen.value = !commandPaletteOpen.value;
        return;
      }
      if (!commandPaletteOpen.value) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        commandPaletteOpen.value = false;
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, Math.max(visible.length - 1, 0)));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const a = visible[activeIndex];
        if (a) runAction(a);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, activeIndex]);

  function runAction(a: PaletteAction) {
    a.run({ navigate });
    commandPaletteOpen.value = false;
  }

  if (!open) return null;

  // Group by group label, preserving order.
  const grouped: { group: string; items: PaletteAction[] }[] = [];
  let cursor = 0;
  for (const a of visible) {
    if (!grouped.length || grouped[grouped.length - 1].group !== a.group) {
      grouped.push({ group: a.group, items: [] });
    }
    grouped[grouped.length - 1].items.push(a);
  }
  void cursor;

  return (
    <div
      class="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] bg-black/50"
      onClick={() => { commandPaletteOpen.value = false; }}
    >
      <div
        class="flex flex-col w-[560px] max-w-[92vw] max-h-[80vh] bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div class="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-border)] shrink-0">
          <Search size={16} class="text-[var(--color-text-faint)]" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Jump to a page or run an action…"
            class="flex-1 bg-transparent outline-none text-[14px] text-[var(--color-text)] placeholder:text-[var(--color-text-faint)]"
            value={query}
            onInput={(e) => { setQuery((e.target as HTMLInputElement).value); setActiveIndex(0); }}
          />
        </div>

        <div class="flex-1 min-h-0 overflow-y-auto py-1">
          {visible.length === 0 && (
            <div class="px-4 py-6 text-center text-[var(--color-text-faint)] text-[13px]">
              No matches.
            </div>
          )}
          {grouped.map((g) => (
            <div key={g.group}>
              <div class="px-4 pt-2 pb-1 section-label">{g.group}</div>
              {g.items.map((a) => {
                const idx = visible.indexOf(a);
                const active = idx === activeIndex;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => runAction(a)}
                    class={[
                      'w-full flex items-center gap-2 px-4 py-2 text-[13px] transition-colors',
                      active
                        ? 'bg-[var(--color-accent-soft)] text-[var(--color-text)]'
                        : 'text-[var(--color-text-muted)] hover:bg-[var(--color-elevated)]',
                    ].join(' ')}
                  >
                    <span class="flex-1 text-left truncate">{a.label}</span>
                    {a.hint && (
                      <span class="text-[10px] text-[var(--color-text-faint)] uppercase tracking-wider">
                        {a.hint}
                      </span>
                    )}
                    {active && <ArrowRight size={12} class="text-[var(--color-accent)]" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div class="flex items-center gap-3 px-4 py-2 border-t border-[var(--color-border)] text-[10px] text-[var(--color-text-faint)] uppercase tracking-wider shrink-0">
          <span>↑↓ Navigate</span>
          <span>↵ Select</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>
  );
}
