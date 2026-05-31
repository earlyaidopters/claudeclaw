import { useEffect, useMemo, useState } from 'preact/hooks';
import { Modal } from '@/components/Modal';
import { apiPatch } from '@/lib/api';
import { pushToast } from '@/lib/toasts';
import { useFetch } from '@/lib/useFetch';
import { describeCron } from '@/lib/cron';
import { ScheduleBuilder } from '@/components/ScheduleBuilder';

interface ScheduledTask {
  id: string;
  prompt: string;
  schedule: string;
  next_run: number;
  agent_id: string;
}

interface AgentLite { id: string; name: string }

interface Props {
  open: boolean;
  task: ScheduledTask | null;
  onClose: () => void;
  onSaved: () => void;
}

const PRESETS: Array<{ label: string; cron: string }> = [
  { label: 'Daily 9am', cron: '0 9 * * *' },
  { label: 'Weekdays 8am', cron: '0 8 * * 1-5' },
  { label: 'Every Monday 9am', cron: '0 9 * * 1' },
  { label: 'Every Sunday 6pm', cron: '0 18 * * 0' },
  { label: 'Every 4 hours', cron: '0 */4 * * *' },
];

export function EditTaskModal({ open, task, onClose, onSaved }: Props) {
  const [prompt, setPrompt] = useState('');
  const [schedule, setSchedule] = useState('');
  const [agentId, setAgentId] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const agentsFetch = useFetch<{ agents: AgentLite[] }>(open ? '/api/agents' : null);

  useEffect(() => {
    if (!task) return;
    setPrompt(task.prompt);
    setSchedule(task.schedule);
    setAgentId(task.agent_id);
    setErr(null);
  }, [task?.id]);

  const cronPreview = useMemo(() => describeCron(schedule), [schedule]);
  const dirty = task ? (prompt !== task.prompt || schedule !== task.schedule || agentId !== task.agent_id) : false;

  async function save() {
    if (!task) return;
    setBusy(true);
    setErr(null);
    try {
      const patch: any = {};
      if (prompt !== task.prompt) patch.prompt = prompt;
      if (schedule !== task.schedule) patch.schedule = schedule;
      if (agentId !== task.agent_id) patch.agent_id = agentId;
      await apiPatch(`/api/tasks/${task.id}`, patch);
      pushToast({ tone: 'success', title: 'Task updated' });
      onSaved();
      onClose();
    } catch (e: any) {
      const msg = e?.message || String(e);
      setErr(msg);
      pushToast({ tone: 'error', title: 'Update failed', description: msg, durationMs: 7000 });
    } finally {
      setBusy(false);
    }
  }

  if (!task) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit scheduled task"
      width={620}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            class="px-3 py-1.5 rounded text-[12.5px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-elevated)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy || !dirty || !cronPreview.ok || !prompt.trim()}
            class="ml-auto px-3 py-1.5 rounded text-[12.5px] font-medium bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </>
      }
    >
      <div class="flex flex-col gap-4">
        <div>
          <label class="block text-[10.5px] uppercase tracking-wider text-[var(--color-text-faint)] mb-1.5">
            Prompt
          </label>
          <textarea
            value={prompt}
            onInput={(e) => setPrompt((e.target as HTMLTextAreaElement).value)}
            rows={6}
            class="w-full px-3 py-2 rounded bg-[var(--color-bg)] border border-[var(--color-border)] focus:border-[var(--color-accent)] focus:outline-none text-[12.5px] text-[var(--color-text)] font-mono leading-relaxed resize-y"
          />
        </div>

        <div>
          <label class="block text-[10.5px] uppercase tracking-wider text-[var(--color-text-faint)] mb-1.5">
            Schedule
          </label>
          <ScheduleBuilder
            cron={schedule}
            onChange={setSchedule}
            externalError={cronPreview.ok ? null : cronPreview.text}
          />
          <div class="mt-3 flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.cron}
                type="button"
                onClick={() => setSchedule(p.cron)}
                class={[
                  'text-[10.5px] px-2 py-1 rounded transition-colors',
                  schedule === p.cron
                    ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)] border border-[var(--color-accent)]'
                    : 'bg-[var(--color-elevated)] text-[var(--color-text-muted)] border border-[var(--color-border)] hover:text-[var(--color-text)]',
                ].join(' ')}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label class="block text-[10.5px] uppercase tracking-wider text-[var(--color-text-faint)] mb-1.5">
            Agent
          </label>
          <select
            value={agentId}
            onInput={(e) => setAgentId((e.target as HTMLSelectElement).value)}
            class="w-full px-3 py-2 rounded bg-[var(--color-bg)] border border-[var(--color-border)] focus:border-[var(--color-accent)] focus:outline-none text-[12.5px] text-[var(--color-text)]"
          >
            {agentsFetch.data?.agents
              ? agentsFetch.data.agents.map((a) => (
                  <option key={a.id} value={a.id}>@{a.id} {a.name && a.name !== a.id ? `· ${a.name}` : ''}</option>
                ))
              : <option value={agentId}>@{agentId}</option>}
          </select>
        </div>

        {err && (
          <div class="text-[11.5px] text-[var(--color-status-failed)] bg-[var(--color-status-failed-soft,_rgba(255,0,0,0.08))] border border-[var(--color-status-failed)] rounded px-2 py-1.5">
            {err}
          </div>
        )}
      </div>
    </Modal>
  );
}
