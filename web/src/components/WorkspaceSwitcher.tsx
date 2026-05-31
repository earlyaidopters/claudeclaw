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
  const rawName = workspaceName.value;
  // Treat the default "ClaudeClaw" workspace as ImpactWorks OS.
  const isDefault = !rawName || rawName === 'ClaudeClaw';
  const name = isDefault ? 'ImpactWorks OS' : rawName;
  const tagline = isDefault ? 'Gearbox' : null;

  return (
    <div ref={ref} class="relative px-3 pt-3 pb-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        class="w-full px-2 py-2 rounded-md hover:bg-[var(--color-elevated)] transition-colors text-left"
      >
        <div class="flex items-center gap-2">
          {isDefault ? (
            <img
              src="/impactworks-logo.png"
              alt="ImpactWorks"
              class="w-11 h-11 rounded-full shrink-0 object-cover"
              style={{ border: '1px solid var(--color-border)' }}
              onError={(e) => {
                // Hide the broken-image icon and fall back to the theme swatch.
                (e.currentTarget as HTMLImageElement).style.display = 'none';
                const fallback = (e.currentTarget as HTMLImageElement).nextElementSibling as HTMLElement | null;
                if (fallback) fallback.style.display = 'block';
              }}
            />
          ) : null}
          <div
            class="w-11 h-11 rounded-full shrink-0"
            style={{
              display: isDefault ? 'none' : 'block',
              background: `linear-gradient(135deg, ${current.swatch} 0%, var(--color-elevated) 100%)`,
              border: '1px solid var(--color-border)',
            }}
          />
          <span class="flex-1 min-w-0 text-[14px] font-semibold text-[var(--color-text)] truncate">{name}</span>
          <ChevronDown size={15} class="text-[var(--color-text-faint)] shrink-0" />
        </div>
        {tagline && (
          <div
            class="text-[10px] text-[var(--color-text-faint)] truncate"
            style={{ paddingLeft: 'calc(2.75rem + 0.5rem)', marginTop: "-10px" }}
          >
            {tagline}
          </div>
        )}
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
