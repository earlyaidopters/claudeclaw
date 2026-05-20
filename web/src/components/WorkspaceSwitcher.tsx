import { useState, useRef, useEffect } from 'preact/hooks';
import { ChevronDown, Check } from 'lucide-preact';
import { theme, themeMeta, setTheme, type ThemeName } from '@/lib/theme';
import { workspaceName } from '@/lib/personalization';

const THEME_ORDER: ThemeName[] = ['graphite', 'midnight', 'crimson'];

export function WorkspaceSwitcher() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const current = themeMeta[theme.value];
  const name = workspaceName.value;

  return (
    <div ref={ref} class="relative px-3 pt-3 pb-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        class="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-[var(--color-elevated)] transition-colors"
      >
        <div
          class="w-6 h-6 rounded shrink-0"
          style={{
            background: `linear-gradient(135deg, ${current.swatch} 0%, var(--color-elevated) 100%)`,
            border: '1px solid var(--color-border)',
          }}
        />
        <span class="text-[14px] font-semibold text-[var(--color-text)] truncate">{name}</span>
        <ChevronDown size={15} class="ml-auto text-[var(--color-text-faint)]" />
      </button>

      {open && (
        <div class="absolute left-3 right-3 top-full mt-1 z-50 bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg shadow-2xl overflow-hidden">
          <div class="px-3 py-2 section-label border-b border-[var(--color-border)]">Theme</div>
          {THEME_ORDER.map((name) => {
            const meta = themeMeta[name];
            const active = theme.value === name;
            return (
              <button
                key={name}
                type="button"
                onClick={() => { setTheme(name); setOpen(false); }}
                class="w-full flex items-center gap-2 px-3 py-1.5 text-[12.5px] hover:bg-[var(--color-elevated)] transition-colors"
              >
                <div
                  class="w-4 h-4 rounded shrink-0"
                  style={{ background: meta.swatch, border: '1px solid var(--color-border)' }}
                />
                <span class="text-[var(--color-text)]">{meta.label}</span>
                {active && <Check size={14} class="ml-auto text-[var(--color-accent)]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
