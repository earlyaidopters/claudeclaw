import { useState } from 'preact/hooks';
import { X, Check, AlertTriangle, Info, AlertCircle } from 'lucide-preact';
import { toasts, dismissToast, type Toast } from '@/lib/toasts';

const TONE_CFG: Record<Toast['tone'], { icon: any; color: string }> = {
  info:    { icon: Info,         color: 'var(--color-accent)' },
  success: { icon: Check,        color: 'var(--color-status-done)' },
  warn:    { icon: AlertTriangle, color: 'var(--color-priority-medium)' },
  error:   { icon: AlertCircle,  color: 'var(--color-status-failed)' },
};

export function ToastStack() {
  const list = toasts.value;
  if (list.length === 0) return null;
  return (
    <div class="fixed bottom-4 right-4 z-[110] flex flex-col gap-2 pointer-events-none">
      {list.map((t) => <ToastCard key={t.id} toast={t} />)}
    </div>
  );
}

function ToastCard({ toast }: { toast: Toast }) {
  const [running, setRunning] = useState(false);
  const cfg = TONE_CFG[toast.tone];
  const Icon = cfg.icon;

  async function runAction() {
    if (!toast.action) return;
    setRunning(true);
    try {
      await toast.action.run();
      dismissToast(toast.id);
    } catch (err: any) {
      console.error('Toast action failed', err);
    } finally { setRunning(false); }
  }

  return (
    <div
      class="pointer-events-auto bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg shadow-2xl px-3 py-2.5 flex items-start gap-2.5 max-w-sm animate-toast-in"
      style={{ borderLeft: '3px solid ' + cfg.color }}
    >
      <Icon size={14} class="mt-0.5 shrink-0" style={{ color: cfg.color }} />
      <div class="flex-1 min-w-0">
        <div class="text-[12.5px] text-[var(--color-text)] font-medium leading-snug">{toast.title}</div>
        {toast.description && (
          <div class="text-[11.5px] text-[var(--color-text-muted)] leading-snug mt-0.5">{toast.description}</div>
        )}
        {toast.action && (
          <button
            type="button"
            onClick={runAction}
            disabled={running}
            class="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--color-accent-soft)] text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-white transition-colors disabled:opacity-50"
          >
            {running ? '…' : toast.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => dismissToast(toast.id)}
        class="text-[var(--color-text-faint)] hover:text-[var(--color-text)] p-0.5"
      >
        <X size={11} />
      </button>
    </div>
  );
}
