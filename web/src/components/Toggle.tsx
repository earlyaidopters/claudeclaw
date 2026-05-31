// Polished iOS-style toggle. Replaces ad-hoc inline styling that landed
// in Settings.tsx and felt unfinished (the "weird white knob" the user
// flagged). Uses theme tokens so it adopts whatever theme is active.

interface ToggleProps {
  on: boolean;
  onChange: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
  ariaLabel?: string;
}

export function Toggle({ on, onChange, disabled, size = 'md', ariaLabel }: ToggleProps) {
  const dims = size === 'sm'
    ? { track: { w: 32, h: 18 }, knob: 14, travel: 14 }
    : { track: { w: 38, h: 22 }, knob: 18, travel: 16 };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      onClick={() => { if (!disabled) onChange(); }}
      disabled={disabled}
      class="relative shrink-0 inline-flex items-center rounded-full transition-colors disabled:opacity-40 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-card)]"
      style={{
        width: dims.track.w + 'px',
        height: dims.track.h + 'px',
        backgroundColor: on ? 'var(--color-accent)' : 'var(--color-border-strong)',
      }}
    >
      <span
        class="inline-block rounded-full transition-transform shadow-sm"
        style={{
          width: dims.knob + 'px',
          height: dims.knob + 'px',
          backgroundColor: 'var(--color-card)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
          transform: on ? `translateX(${dims.travel + 2}px)` : 'translateX(2px)',
        }}
      />
    </button>
  );
}
