import type { ComponentChildren } from 'preact';

type Tone = 'queued' | 'running' | 'done' | 'failed' | 'cancelled' | 'high' | 'medium' | 'low' | 'neutral' | 'accent';

interface Props {
  tone?: Tone;
  children: ComponentChildren;
}

const TONE_STYLE: Record<Tone, string> = {
  queued: 'bg-[color-mix(in_srgb,var(--color-status-queued)_18%,transparent)] text-[var(--color-status-queued)]',
  running: 'bg-[color-mix(in_srgb,var(--color-status-running)_18%,transparent)] text-[var(--color-status-running)]',
  done: 'bg-[color-mix(in_srgb,var(--color-status-done)_18%,transparent)] text-[var(--color-status-done)]',
  failed: 'bg-[color-mix(in_srgb,var(--color-status-failed)_18%,transparent)] text-[var(--color-status-failed)]',
  cancelled: 'bg-[var(--color-elevated)] text-[var(--color-text-muted)]',
  high: 'bg-[color-mix(in_srgb,var(--color-priority-high)_18%,transparent)] text-[var(--color-priority-high)]',
  medium: 'bg-[color-mix(in_srgb,var(--color-priority-medium)_18%,transparent)] text-[var(--color-priority-medium)]',
  low: 'bg-[var(--color-elevated)] text-[var(--color-text-muted)]',
  neutral: 'bg-[var(--color-elevated)] text-[var(--color-text-muted)]',
  accent: 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]',
};

export function Pill({ tone = 'neutral', children }: Props) {
  return (
    <span class={'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ' + TONE_STYLE[tone]}>
      {children}
    </span>
  );
}

export function StatusDot({ tone }: { tone: Tone }) {
  const colorMap: Record<Tone, string> = {
    queued: 'var(--color-status-queued)',
    running: 'var(--color-status-running)',
    done: 'var(--color-status-done)',
    failed: 'var(--color-status-failed)',
    cancelled: 'var(--color-text-faint)',
    high: 'var(--color-priority-high)',
    medium: 'var(--color-priority-medium)',
    low: 'var(--color-text-faint)',
    neutral: 'var(--color-text-faint)',
    accent: 'var(--color-accent)',
  };
  return (
    <span
      class="inline-block w-1.5 h-1.5 rounded-full shrink-0"
      style={{ backgroundColor: colorMap[tone] }}
    />
  );
}
