import { useState } from 'preact/hooks';
import { Pause, Play, Trash2, Clock, LayoutGrid, List, CheckSquare, Pencil } from 'lucide-preact';
import { PageHeader } from '@/components/PageHeader';
import { Pill } from '@/components/Pill';
import { PageState } from '@/components/PageState';
import { PrivacyToggle } from '@/components/PrivacyToggle';
import { ConfirmModal } from '@/components/ConfirmModal';
import { EditTaskModal } from '@/components/EditTaskModal';
import { useFetch } from '@/lib/useFetch';
import { apiPost, apiDelete } from '@/lib/api';
import { formatRelativeTime } from '@/lib/format';
import { privacyBlur } from '@/lib/privacy';
import { pushToast } from '@/lib/toasts';
import { describeCron } from '@/lib/cron';

interface ScheduledTask {
  id: string;
  prompt: string;
  schedule: string;
  next_run: number;
  last_run: number | null;
  last_result: string | null;
  status: 'active' | 'paused' | 'running';
  created_at: number;
  agent_id: string;
  started_at: number | null;
  last_status: 'success' | 'failed' | 'timeout' | null;
}

type ViewMode = 'cards' | 'list';

function formatCountdown(unixSeconds: number): string {
  const diff = unixSeconds - Date.now() / 1000;
  if (diff < 0) return 'overdue';
  if (diff < 60) return 'in ' + Math.floor(diff) + 's';
  if (diff < 3600) return 'in ' + Math.floor(diff / 60) + 'm';
  if (diff < 86400) return 'in ' + Math.floor(diff / 3600) + 'h';
  return 'in ' + Math.floor(diff / 86400) + 'd';
}

const VIEW_KEY = 'claudeclaw.scheduled.view';

function loadView(): ViewMode {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    if (v === 'cards' || v === 'list') return v;
  } catch {}
  return 'cards';
}

export function Scheduled() {
  const { data, loading, error, refresh } = useFetch<{ tasks: ScheduledTask[] }>('/api/tasks', 30_000);
  const tasks = data?.tasks ?? [];
  const [view, setView] = useState<ViewMode>(loadView());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState<null | 'single' | 'bulk'>(null);
  const [pendingSingle, setPendingSingle] = useState<ScheduledTask | null>(null);
  const [editing, setEditing] = useState<ScheduledTask | null>(null);
  const [busy, setBusy] = useState(false);
  const blurOn = privacyBlur('scheduled').value;

  function setViewPersisted(v: ViewMode) {
    setView(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch {}
  }

  function toggleSelect(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }

  function selectAll() {
    if (selected.size === tasks.length) setSelected(new Set());
    else setSelected(new Set(tasks.map((t) => t.id)));
  }

  async function performBulkDelete() {
    setBusy(true);
    const ids = Array.from(selected);
    let ok = 0, failed = 0;
    for (const id of ids) {
      try {
        await apiDelete(`/api/tasks/${id}`);
        ok++;
      } catch { failed++; }
    }
    setSelected(new Set());
    refresh();
    setBusy(false);
    if (failed === 0) {
      pushToast({ tone: 'warn', title: `Deleted ${ok} task${ok === 1 ? '' : 's'}` });
    } else {
      pushToast({
        tone: 'error',
        title: `Deleted ${ok}, failed ${failed}`,
        description: 'Check the audit log for details.',
        durationMs: 7000,
      });
    }
  }

  async function performSingleDelete() {
    if (!pendingSingle) return;
    setBusy(true);
    try {
      await apiDelete(`/api/tasks/${pendingSingle.id}`);
      pushToast({ tone: 'warn', title: 'Task deleted' });
      refresh();
    } catch (err: any) {
      pushToast({ tone: 'error', title: 'Delete failed', description: err?.message || String(err), durationMs: 6000 });
    } finally {
      setBusy(false);
      setPendingSingle(null);
    }
  }

  async function action(task: ScheduledTask, act: 'pause' | 'resume') {
    try {
      if (act === 'pause') await apiPost(`/api/tasks/${task.id}/pause`);
      else await apiPost(`/api/tasks/${task.id}/resume`);
      refresh();
      pushToast({ tone: 'success', title: act === 'pause' ? 'Task paused' : 'Task resumed' });
    } catch (err: any) {
      pushToast({ tone: 'error', title: `${act} failed`, description: err?.message || String(err), durationMs: 6000 });
    }
  }

  const allSelected = tasks.length > 0 && selected.size === tasks.length;

  return (
    <div class="flex flex-col h-full">
      <PageHeader
        title="Scheduled"
        actions={
          <>
            <span class="text-[11.5px] text-[var(--color-text-muted)] tabular-nums">
              {tasks.length} scheduled{selected.size > 0 ? ` · ${selected.size} selected` : ''}
            </span>
            {selected.size > 0 && (
              <button
                type="button"
                onClick={() => setConfirmOpen('bulk')}
                disabled={busy}
                class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-[12px] text-white bg-[var(--color-status-failed)] hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                <Trash2 size={12} /> Delete {selected.size}
              </button>
            )}
            <PrivacyToggle section="scheduled" />
            <ViewSwitcher view={view} onChange={setViewPersisted} />
          </>
        }
      />

      {error && <PageState error={error} />}
      {loading && !data && <PageState loading />}
      {!loading && !error && tasks.length === 0 && (
        <PageState
          empty
          emptyTitle="No scheduled tasks"
          emptyDescription="Use mission-cli or ask the bot to create a recurring task. They'll show up here when they're scheduled."
        />
      )}

      {tasks.length > 0 && view === 'cards' && (
        <div class="flex-1 overflow-y-auto p-6">
          <div class="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))' }}>
            {tasks.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                blurOn={blurOn}
                selected={selected.has(t.id)}
                onToggleSelect={() => toggleSelect(t.id)}
                onAction={(a) => action(t, a)}
                onDeleteRequest={() => { setPendingSingle(t); setConfirmOpen('single'); }}
                onEdit={() => setEditing(t)}
              />
            ))}
          </div>
        </div>
      )}

      {tasks.length > 0 && view === 'list' && (
        <div class="flex-1 overflow-y-auto">
          <table class="w-full text-[12.5px]">
            <thead class="sticky top-0 bg-[var(--color-bg)] border-b border-[var(--color-border)] z-10">
              <tr class="text-left">
                <th class="px-6 py-2 w-[36px]">
                  <button
                    type="button"
                    onClick={selectAll}
                    class="text-[var(--color-text-faint)] hover:text-[var(--color-text)]"
                    title={allSelected ? 'Clear selection' : 'Select all'}
                  >
                    <CheckSquare size={14} class={allSelected ? 'text-[var(--color-accent)]' : ''} />
                  </button>
                </th>
                <th class="px-3 py-2 font-medium text-[10px] uppercase tracking-wider text-[var(--color-text-faint)]">Prompt</th>
                <th class="px-3 py-2 font-medium text-[10px] uppercase tracking-wider text-[var(--color-text-faint)] w-[18%]">Schedule</th>
                <th class="px-3 py-2 font-medium text-[10px] uppercase tracking-wider text-[var(--color-text-faint)] w-[10%]">Next</th>
                <th class="px-3 py-2 font-medium text-[10px] uppercase tracking-wider text-[var(--color-text-faint)] w-[10%]">Status</th>
                <th class="px-3 py-2 font-medium text-[10px] uppercase tracking-wider text-[var(--color-text-faint)] w-[8%]">Agent</th>
                <th class="px-3 py-2 font-medium text-[10px] uppercase tracking-wider text-[var(--color-text-faint)] w-[12%] text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <TaskListRow
                  key={t.id}
                  task={t}
                  blurOn={blurOn}
                  selected={selected.has(t.id)}
                  onToggleSelect={() => toggleSelect(t.id)}
                  onAction={(a) => action(t, a)}
                  onDeleteRequest={() => { setPendingSingle(t); setConfirmOpen('single'); }}
                  onEdit={() => setEditing(t)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <EditTaskModal
        open={editing !== null}
        task={editing}
        onClose={() => setEditing(null)}
        onSaved={refresh}
      />

      <ConfirmModal
        open={confirmOpen === 'single'}
        onClose={() => { setConfirmOpen(null); setPendingSingle(null); }}
        onConfirm={performSingleDelete}
        title="Delete this scheduled task?"
        body={pendingSingle ? truncateForBlur(pendingSingle.prompt, 140, blurOn) : ''}
        detail="The task and its schedule are removed. Past run results stay in the history table."
        confirmLabel="Delete"
        destructive
      />
      <ConfirmModal
        open={confirmOpen === 'bulk'}
        onClose={() => setConfirmOpen(null)}
        onConfirm={performBulkDelete}
        title={`Delete ${selected.size} scheduled task${selected.size === 1 ? '' : 's'}?`}
        body="All selected tasks will be removed and won't fire again. Past run results stay in the history table."
        confirmLabel={`Delete ${selected.size}`}
        destructive
      />
    </div>
  );
}

function truncateForBlur(text: string, max: number, blur: boolean): string {
  if (blur) return '(prompt hidden — turn off blur to see full text)';
  return text.length > max ? text.slice(0, max) + '…' : text;
}

function ViewSwitcher({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div class="inline-flex bg-[var(--color-elevated)] border border-[var(--color-border)] rounded p-0.5">
      <button
        type="button"
        onClick={() => onChange('cards')}
        class={[
          'inline-flex items-center justify-center w-7 h-7 rounded transition-colors',
          view === 'cards' ? 'bg-[var(--color-accent)] text-white' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
        ].join(' ')}
        title="Card view"
      >
        <LayoutGrid size={13} />
      </button>
      <button
        type="button"
        onClick={() => onChange('list')}
        class={[
          'inline-flex items-center justify-center w-7 h-7 rounded transition-colors',
          view === 'list' ? 'bg-[var(--color-accent)] text-white' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
        ].join(' ')}
        title="List view"
      >
        <List size={13} />
      </button>
    </div>
  );
}

interface RowProps {
  task: ScheduledTask;
  blurOn: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onAction: (a: 'pause' | 'resume') => void;
  onDeleteRequest: () => void;
  onEdit: () => void;
}

function TaskCard({ task, blurOn, selected, onToggleSelect, onAction, onDeleteRequest, onEdit }: RowProps) {
  const [showResult, setShowResult] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const statusTone = task.status === 'running' ? 'running' : task.status === 'paused' ? 'cancelled' : 'done';
  const blurClass = blurOn && !revealed ? 'privacy-blur' : (blurOn && revealed ? 'privacy-blur revealed' : '');

  return (
    <div
      class={[
        'bg-[var(--color-card)] border rounded-lg p-3 hover:border-[var(--color-border-strong)] transition-colors cursor-pointer group',
        selected ? 'border-[var(--color-accent)]' : 'border-[var(--color-border)]',
      ].join(' ')}
      onClick={onEdit}
    >
      <div class="flex items-start gap-2 mb-2">
        <input
          type="checkbox"
          checked={selected}
          onClick={(e) => e.stopPropagation()}
          onChange={onToggleSelect}
          class="mt-1 shrink-0 cursor-pointer accent-[var(--color-accent)]"
        />
        <div class="flex-1 min-w-0">
          <div
            class={'text-[12.5px] text-[var(--color-text)] line-clamp-2 leading-snug mb-1 ' + blurClass}
            onClick={(e) => { if (blurOn) { e.stopPropagation(); setRevealed((v) => !v); } }}
          >
            {task.prompt}
          </div>
          <div class="flex items-center gap-2 text-[10.5px] text-[var(--color-text-faint)] flex-wrap">
            <span class="inline-flex items-center gap-1">
              <Clock size={10} />
              {describeCron(task.schedule).text}
            </span>
            {task.status === 'active' && (
              <span class="text-[var(--color-accent)] tabular-nums">{formatCountdown(task.next_run)}</span>
            )}
            <Pill tone={statusTone}>{task.status}</Pill>
            {task.agent_id !== 'main' && <span class="font-mono">@{task.agent_id}</span>}
            {task.last_status && (
              <Pill tone={task.last_status === 'success' ? 'done' : task.last_status === 'timeout' ? 'medium' : 'failed'}>
                last: {task.last_status}
              </Pill>
            )}
          </div>
        </div>
        <RowActions task={task} onAction={onAction} onDeleteRequest={onDeleteRequest} />
      </div>
      {task.last_result && (
        <div class="mt-2 pt-2 border-t border-[var(--color-border)]" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => setShowResult((v) => !v)}
            class="text-[10.5px] text-[var(--color-text-faint)] hover:text-[var(--color-text-muted)]"
          >
            {showResult ? 'Hide' : 'Show'} last result · {formatRelativeTime(task.last_run || 0)}
          </button>
          {showResult && (
            <div
              class={'mt-1.5 text-[11px] text-[var(--color-text-muted)] whitespace-pre-wrap font-mono leading-relaxed line-clamp-6 ' + blurClass}
              onClick={(e) => { if (blurOn) { e.stopPropagation(); setRevealed((v) => !v); } }}
            >
              {task.last_result}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TaskListRow({ task, blurOn, selected, onToggleSelect, onAction, onDeleteRequest, onEdit }: RowProps) {
  const [revealed, setRevealed] = useState(false);
  const statusTone = task.status === 'running' ? 'running' : task.status === 'paused' ? 'cancelled' : 'done';
  const blurClass = blurOn && !revealed ? 'privacy-blur' : (blurOn && revealed ? 'privacy-blur revealed' : '');

  return (
    <tr
      class={'cursor-pointer ' + (selected ? 'bg-[var(--color-accent-soft)] border-b border-[var(--color-border)]' : 'border-b border-[var(--color-border)] hover:bg-[var(--color-elevated)] transition-colors')}
      onClick={onEdit}
    >
      <td class="px-6 py-2.5" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          class="cursor-pointer accent-[var(--color-accent)]"
        />
      </td>
      <td class="px-3 py-2.5 max-w-0">
        <span
          class={'text-[var(--color-text)] line-clamp-2 ' + blurClass}
          onClick={(e) => { if (blurOn) { e.stopPropagation(); setRevealed((v) => !v); } }}
        >
          {task.prompt}
        </span>
      </td>
      <td class="px-3 py-2.5 text-[var(--color-text-muted)] tabular-nums whitespace-nowrap">
        {describeCron(task.schedule).text}
      </td>
      <td class="px-3 py-2.5 text-[var(--color-text-faint)] tabular-nums whitespace-nowrap">
        {task.status === 'active' ? formatCountdown(task.next_run) : '—'}
      </td>
      <td class="px-3 py-2.5 whitespace-nowrap">
        <Pill tone={statusTone}>{task.status}</Pill>
        {task.last_status && (
          <Pill tone={task.last_status === 'success' ? 'done' : task.last_status === 'timeout' ? 'medium' : 'failed'}>
            {task.last_status}
          </Pill>
        )}
      </td>
      <td class="px-3 py-2.5 font-mono text-[11px] text-[var(--color-text-muted)] whitespace-nowrap">
        @{task.agent_id}
      </td>
      <td class="px-3 py-2.5 text-right whitespace-nowrap">
        <RowActions task={task} onAction={onAction} onDeleteRequest={onDeleteRequest} />
      </td>
    </tr>
  );
}

function RowActions({ task, onAction, onDeleteRequest }: {
  task: ScheduledTask;
  onAction: (a: 'pause' | 'resume') => void;
  onDeleteRequest: () => void;
}) {
  return (
    <div class="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {task.status === 'active' && (
        <button
          type="button"
          onClick={() => onAction('pause')}
          class="p-1.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-elevated)] transition-colors"
          title="Pause"
        >
          <Pause size={12} />
        </button>
      )}
      {task.status === 'paused' && (
        <button
          type="button"
          onClick={() => onAction('resume')}
          class="p-1.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-elevated)] transition-colors"
          title="Resume"
        >
          <Play size={12} />
        </button>
      )}
      <button
        type="button"
        onClick={onDeleteRequest}
        class="p-1.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-status-failed)] hover:bg-[var(--color-elevated)] transition-colors"
        title="Delete"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}
