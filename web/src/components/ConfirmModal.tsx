import { Modal } from '@/components/Modal';

// Themed replacement for window.confirm(). Caller renders it
// conditionally with `open` state, supplies the message + button labels,
// and gets onConfirm()/onClose() callbacks. The body uses theme tokens
// so it picks up Graphite/Midnight/Crimson/custom-accent automatically.

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** When true, the confirm button uses the danger color and the modal
   *  reads like a destructive-action warning. */
  destructive?: boolean;
  /** Optional extra detail rendered as a smaller paragraph under body. */
  detail?: string;
}

export function ConfirmModal({
  open, onClose, onConfirm,
  title, body, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  destructive = false, detail,
}: Props) {
  if (!open) return null;
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      width={460}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            class="px-3 py-1.5 rounded text-[12.5px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-elevated)] transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => { onConfirm(); onClose(); }}
            class={[
              'ml-auto px-3 py-1.5 rounded text-[12.5px] font-medium transition-colors',
              destructive
                ? 'bg-[var(--color-status-failed)] text-white hover:opacity-90'
                : 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]',
            ].join(' ')}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      {body && (
        <div class="text-[13px] text-[var(--color-text)] leading-relaxed">{body}</div>
      )}
      {detail && (
        <div class="text-[11.5px] text-[var(--color-text-muted)] leading-relaxed mt-2">{detail}</div>
      )}
    </Modal>
  );
}
