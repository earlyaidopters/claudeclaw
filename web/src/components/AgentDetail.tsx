import { useRef, useState } from 'preact/hooks';
import { Camera, Trash2, ExternalLink } from 'lucide-preact';
import { Modal } from '@/components/Modal';
import { AgentAvatar } from '@/components/AgentAvatar';
import { Pill, StatusDot } from '@/components/Pill';
import { Tab } from '@/components/PageHeader';
import { useFetch } from '@/lib/useFetch';
import { formatRelativeTime, formatCost } from '@/lib/format';
import { chatId, dashboardToken } from '@/lib/api';
import { pushToast } from '@/lib/toasts';
import { showCosts } from '@/lib/theme';

interface Agent {
  id: string;
  name: string;
  description: string;
  model: string;
  running: boolean;
  todayTurns: number;
  todayCost: number;
}

interface ConvoTurn { role: 'user' | 'assistant'; content: string; created_at?: number; }
interface ScheduledTask { id: string; prompt: string; schedule: string; next_run: number; status: string; last_status: string | null; }
interface HiveEntry { id: number; action: string; summary: string; created_at: number; }
interface AgentTokens { todayCost: number; todayTurns: number; allTimeCost: number; }

type TabKey = 'overview' | 'conversation' | 'tasks' | 'hive';

interface Props {
  agent: Agent | null;
  onClose: () => void;
}

export function AgentDetail({ agent, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  if (!agent) return null;

  return (
    <Modal open={!!agent} onClose={onClose} title="" width={720}>
      <Header agent={agent} />
      <div class="flex items-center gap-1 border-b border-[var(--color-border)] mb-4 -mx-5 px-5 pb-2">
        <Tab label="Overview" active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
        <Tab label="Conversation" active={activeTab === 'conversation'} onClick={() => setActiveTab('conversation')} />
        <Tab label="Scheduled" active={activeTab === 'tasks'} onClick={() => setActiveTab('tasks')} />
        <Tab label="Hive Mind" active={activeTab === 'hive'} onClick={() => setActiveTab('hive')} />
      </div>

      {activeTab === 'overview' && <OverviewTab agent={agent} />}
      {activeTab === 'conversation' && <ConversationTab agentId={agent.id} />}
      {activeTab === 'tasks' && <TasksTab agentId={agent.id} />}
      {activeTab === 'hive' && <HiveTab agentId={agent.id} />}
    </Modal>
  );
}

function Header({ agent }: { agent: Agent }) {
  // Cache-bust the avatar by bumping a counter every time we upload or
  // delete — the AgentAvatar component reads `?token=...` only and
  // would otherwise serve the stale cached image.
  const [avatarVersion, setAvatarVersion] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pickAndUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      pushToast({ tone: 'error', title: 'Image too large', description: 'Max 5 MB.', durationMs: 6000 });
      input.value = '';
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append('image', file);
      const res = await fetch(`/api/agents/${encodeURIComponent(agent.id)}/avatar?token=${encodeURIComponent(dashboardToken)}`, {
        method: 'PUT',
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).error || `HTTP ${res.status}`);
      }
      setAvatarVersion((v) => v + 1);
      pushToast({
        tone: 'success',
        title: 'Avatar updated',
        description: 'Telegram propagation needs @BotFather → /setuserpic on your phone.',
        durationMs: 8000,
      });
    } catch (err: any) {
      pushToast({ tone: 'error', title: 'Upload failed', description: err?.message || String(err), durationMs: 7000 });
    } finally {
      setBusy(false);
      input.value = '';
    }
  }

  async function clearAvatar() {
    if (!confirm(`Remove the custom avatar for ${agent.id}? The dashboard will fall back to Telegram's avatar (if set) or initials.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/agents/${encodeURIComponent(agent.id)}/avatar?token=${encodeURIComponent(dashboardToken)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).error || `HTTP ${res.status}`);
      }
      setAvatarVersion((v) => v + 1);
      pushToast({ tone: 'success', title: 'Avatar removed' });
    } catch (err: any) {
      pushToast({ tone: 'error', title: 'Delete failed', description: err?.message || String(err), durationMs: 7000 });
    } finally { setBusy(false); }
  }

  function openBotFather() {
    // Deep-links to BotFather in the Telegram app (or web) so the user
    // can finish the loop with /setuserpic. The actual upload to
    // BotFather can't be automated via the Bot API.
    window.open('https://t.me/BotFather', '_blank', 'noreferrer');
  }

  return (
    <div class="flex items-start gap-3 mb-4 -mt-2">
      <div class="relative shrink-0 group">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          class="relative block rounded-full focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none disabled:opacity-50"
          title="Change avatar"
        >
          {/* cacheBust appends ?v=<n> to the avatar URL so the browser
              skips its 1h HTTP cache and refetches after upload/delete.
              Without this, the new image bytes are on disk but every
              IMG element across the dashboard keeps showing the old
              cached PNG until the cache expires. */}
          <AgentAvatar
            agentId={agent.id}
            name={agent.name}
            running={agent.running}
            size={44}
            cacheBust={avatarVersion}
          />
          <span class="absolute inset-0 rounded-full flex items-center justify-center bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera size={16} />
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={pickAndUpload}
          class="hidden"
        />
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <StatusDot tone={agent.running ? 'done' : 'cancelled'} />
          <h2 class="text-[15px] font-semibold text-[var(--color-text)] truncate">{agent.name || agent.id}</h2>
          <code class="text-[10px] text-[var(--color-text-faint)] font-mono">{agent.id}</code>
        </div>
        {agent.description && (
          <div class="text-[12px] text-[var(--color-text-muted)] mt-0.5 leading-snug">{agent.description}</div>
        )}
        <div class="flex items-center gap-2 mt-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            class="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-elevated)] border border-[var(--color-border)] transition-colors disabled:opacity-40"
          >
            <Camera size={11} /> {busy ? 'Working…' : 'Change avatar'}
          </button>
          <button
            type="button"
            onClick={clearAvatar}
            disabled={busy}
            class="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-status-failed)] border border-[var(--color-border)] hover:border-[var(--color-status-failed)] transition-colors disabled:opacity-40"
            title="Remove custom avatar (revert to Telegram or initials)"
          >
            <Trash2 size={11} />
          </button>
          <button
            type="button"
            onClick={openBotFather}
            class="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded text-[10.5px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-elevated)] transition-colors"
            title="Telegram bot avatars can only be set via @BotFather → /setuserpic"
          >
            Set on Telegram <ExternalLink size={10} />
          </button>
        </div>
      </div>
    </div>
  );
}

function OverviewTab({ agent }: { agent: Agent }) {
  const tokens = useFetch<AgentTokens>(`/api/agents/${agent.id}/tokens`);
  const costsOn = showCosts.value;
  return (
    <div class="space-y-3">
      <div class={(costsOn ? 'grid-cols-3' : 'grid-cols-1') + ' grid gap-2'}>
        <Kpi label="Today turns" value={String(agent.todayTurns)} />
        {costsOn && <Kpi label="Today cost" value={formatCost(agent.todayCost)} />}
        {costsOn && <Kpi label="Lifetime cost" value={formatCost(tokens.data?.allTimeCost || 0)} />}
      </div>
      <Section label="Configuration">
        <Row label="Model"><Pill tone="neutral">{agent.model || 'default'}</Pill></Row>
        <Row label="Status">{agent.running
          ? <Pill tone="done">running</Pill>
          : <Pill tone="cancelled">offline</Pill>}</Row>
      </Section>
    </div>
  );
}

function ConversationTab({ agentId }: { agentId: string }) {
  const { data, loading, error } = useFetch<{ turns: ConvoTurn[] }>(
    `/api/agents/${agentId}/conversation?chatId=${encodeURIComponent(chatId)}&limit=10`,
  );
  const turns = data?.turns ?? [];

  if (loading) return <Loading />;
  if (error) return <ErrorBlock error={error} />;
  if (turns.length === 0) return <Empty text="No conversation history yet." />;

  return (
    <div class="space-y-2">
      {turns.map((t, i) => (
        <div
          key={i}
          class={[
            'rounded-lg px-3 py-2 text-[12px] leading-relaxed whitespace-pre-wrap',
            t.role === 'user'
              ? 'bg-[var(--color-accent-soft)] text-[var(--color-text)] border border-[var(--color-accent-soft)]'
              : 'bg-[var(--color-elevated)] border border-[var(--color-border)] text-[var(--color-text-muted)]',
          ].join(' ')}
        >
          <div class="text-[10px] text-[var(--color-text-faint)] uppercase tracking-wider mb-1">
            {t.role}
            {t.created_at && <span class="ml-2 normal-case tracking-normal">{formatRelativeTime(t.created_at)}</span>}
          </div>
          <div class="line-clamp-6">{t.content}</div>
        </div>
      ))}
    </div>
  );
}

function TasksTab({ agentId }: { agentId: string }) {
  const { data, loading, error } = useFetch<{ tasks: ScheduledTask[] }>(`/api/agents/${agentId}/tasks`);
  const tasks = data?.tasks ?? [];

  if (loading) return <Loading />;
  if (error) return <ErrorBlock error={error} />;
  if (tasks.length === 0) return <Empty text={`No scheduled tasks for ${agentId}.`} />;

  return (
    <div class="space-y-1.5">
      {tasks.map((t) => (
        <div key={t.id} class="bg-[var(--color-elevated)] border border-[var(--color-border)] rounded p-2.5">
          <div class="text-[12px] text-[var(--color-text)] line-clamp-2 mb-1">{t.prompt}</div>
          <div class="flex items-center gap-2 text-[10.5px] text-[var(--color-text-faint)]">
            <span class="font-mono">{t.schedule}</span>
            <span>·</span>
            <span class="tabular-nums">next: {formatRelativeTime(t.next_run)}</span>
            <Pill tone={t.status === 'paused' ? 'cancelled' : 'done'}>{t.status}</Pill>
            {t.last_status && (
              <Pill tone={t.last_status === 'success' ? 'done' : 'failed'}>last: {t.last_status}</Pill>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function HiveTab({ agentId }: { agentId: string }) {
  const { data, loading, error } = useFetch<{ entries: HiveEntry[] }>(`/api/hive-mind?agent=${agentId}&limit=30`);
  const entries = data?.entries ?? [];

  if (loading) return <Loading />;
  if (error) return <ErrorBlock error={error} />;
  if (entries.length === 0) return <Empty text={`No hive mind activity for ${agentId} yet.`} />;

  return (
    <div class="space-y-1">
      {entries.map((e) => (
        <div key={e.id} class="flex items-start gap-3 px-3 py-2 bg-[var(--color-elevated)] border border-[var(--color-border)] rounded text-[11.5px]">
          <span class="text-[var(--color-text-faint)] tabular-nums whitespace-nowrap shrink-0">
            {formatRelativeTime(e.created_at)}
          </span>
          <span class="font-mono text-[10.5px] text-[var(--color-text-muted)] whitespace-nowrap shrink-0">
            {e.action}
          </span>
          <span class="text-[var(--color-text)] line-clamp-2">{e.summary}</span>
        </div>
      ))}
    </div>
  );
}

// ── Tiny helpers ───────────────────────────────────────────────────

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div class="bg-[var(--color-elevated)] border border-[var(--color-border)] rounded p-2.5">
      <div class="text-[10px] uppercase tracking-wider text-[var(--color-text-faint)] mb-0.5">{label}</div>
      <div class="text-[15px] font-semibold tabular-nums text-[var(--color-text)]">{value}</div>
    </div>
  );
}

function Section({ label, children }: any) {
  return (
    <div>
      <div class="text-[10px] uppercase tracking-wider text-[var(--color-text-faint)] mb-1.5">{label}</div>
      <div class="bg-[var(--color-elevated)] border border-[var(--color-border)] rounded p-3 space-y-1.5">
        {children}
      </div>
    </div>
  );
}

function Row({ label, children }: any) {
  return (
    <div class="flex items-center justify-between text-[12px]">
      <span class="text-[var(--color-text-muted)]">{label}</span>
      {children}
    </div>
  );
}

function Loading() { return <div class="text-[11px] text-[var(--color-text-faint)] py-6 text-center">Loading…</div>; }
function Empty({ text }: { text: string }) { return <div class="text-[11.5px] text-[var(--color-text-faint)] py-8 text-center">{text}</div>; }
function ErrorBlock({ error }: { error: string }) {
  return (
    <div class="text-[var(--color-status-failed)] text-[11.5px] font-mono p-3 bg-[var(--color-elevated)] border border-[var(--color-status-failed)] rounded">
      {error}
    </div>
  );
}
