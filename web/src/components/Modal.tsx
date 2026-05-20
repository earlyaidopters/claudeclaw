import { useEffect } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { X } from 'lucide-preact';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  width?: number;
  children: ComponentChildren;
  footer?: ComponentChildren;
}

export function Modal({ open, onClose, title, width = 480, children, footer }: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!open) return null;
  return (
    <div
      class="fixed inset-0 z-[90] flex items-start justify-center pt-[10vh] bg-black/50"
      onClick={onClose}
    >
      <div
        class="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl shadow-2xl flex flex-col max-h-[80vh]"
        style={{ width: width + 'px', maxWidth: '92vw' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div class="flex items-center px-5 py-3 border-b border-[var(--color-border)] shrink-0">
          <h2 class="text-[14px] font-semibold text-[var(--color-text)]">{title}</h2>
          <button
            type="button"
            class="ml-auto p-1 rounded hover:bg-[var(--color-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            onClick={onClose}
          >
            <X size={14} />
          </button>
        </div>
        <div class="flex-1 min-h-0 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div class="flex items-center gap-2 px-5 py-3 border-t border-[var(--color-border)] shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, children }: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <div
        class={[
          'fixed inset-0 z-[80] bg-black/50 transition-opacity',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none',
        ].join(' ')}
        onClick={onClose}
      />
      <div
        class={[
          'fixed left-0 right-0 bottom-0 z-[81] bg-[var(--color-card)] border-t border-[var(--color-border)] rounded-t-xl shadow-2xl flex flex-col transition-transform',
          open ? 'translate-y-0' : 'translate-y-full',
        ].join(' ')}
        style={{ height: '85vh' }}
      >
        <div class="flex items-center px-6 py-3 border-b border-[var(--color-border)] shrink-0">
          <div class="w-12 h-1 rounded-full bg-[var(--color-border)] mx-auto absolute left-1/2 -translate-x-1/2 top-1.5" />
          <h2 class="text-[13px] font-semibold text-[var(--color-text)]">{title}</h2>
          <button
            type="button"
            class="ml-auto p-1 rounded hover:bg-[var(--color-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            onClick={onClose}
          >
            <X size={14} />
          </button>
        </div>
        <div class="flex-1 min-h-0 overflow-y-auto">{children}</div>
      </div>
    </>
  );
}
