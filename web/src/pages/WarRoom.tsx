import { useState, useEffect } from 'preact/hooks';
import { useLocation } from 'wouter-preact';
import { Mic, MessageSquare, Video, ExternalLink, Pin, PinOff, Sliders, Users } from 'lucide-preact';
import { PageHeader, Tab } from '@/components/PageHeader';
import { PageState } from '@/components/PageState';
import { AgentAvatar } from '@/components/AgentAvatar';
import { Pill } from '@/components/Pill';
import { VoicesPane } from '@/pages/Voices';
import { StandupConfigPane } from '@/pages/StandupConfig';
import { useFetch } from '@/lib/useFetch';
import { apiPost, dashboardToken, chatId, legacyUrl } from '@/lib/api';
import { formatRelativeTime } from '@/lib/format';

// 'voices' is the embedded voice configuration tab — used to be its own
// page at /voices, now folded under War Room since it conceptually
// belongs there. Direct navigation to /voices still works (App.tsx
// renders the standalone Voices page) for back-compat.
type Mode = 'picker' | 'voice' | 'text' | 'meet' | 'voices' | 'standup';

interface PinState { ok: boolean; agent: string | null; mode: 'direct' | 'auto'; }
interface RosterAgent { id: string; name: string; description: string; }
interface TextMeetingSummary { id: string; started_at: number; ended_at: number | null; entry_count: number; preview: string; }
interface VoiceMeeting { id: string; started_at: number; ended_at: number | null; duration_s: number | null; mode: string; pinned_agent: string; entry_count: number; }
interface MeetSession { id: string; agent_id: string; provider: string; status: string; meet_url: string; created_at: number; }

export function WarRoom() {
  // Allow ?mode=voices (or any other Mode) on the URL so links from the
  // command palette and the legacy /voices route can deep-link directly
  // to a tab without going through the picker.
  const [, setLocation] = useLocation();
  const initialMode = readModeFromUrl();
  const [mode, setMode] = useState<Mode>(initialMode);
  useEffect(() => {
    if (mode === 'picker') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') !== mode) {
      params.set('mode', mode);
      // Replace, don't push, so back-button doesn't re-cycle through tabs.
      window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    }
    void setLocation;
  }, [mode]);

  if (mode === 'picker') {
    return (
      <div class="flex flex-col h-full">
        <PageHeader title="War Room" />
        <div class="flex-1 overflow-y-auto p-8">
          <div class="max-w-3xl mx-auto">
            <p class="text-[13px] text-[var(--color-text-muted)] mb-6 leading-relaxed">
              Pull all agents into one conversation. Voice rooms speak in real-time via Pipecat + Gemini Live.
              Text rooms work async with full transcript and per-agent pinning.
            </p>
            <div class="grid grid-cols-2 gap-4">
              <ModeCard
                icon={<Mic size={22} />}
                title="Voice"
                description="Live voice meeting with all agents in the same Gemini Live session. Pin one agent for direct mode, or use auto-routing."
                onClick={() => setMode('voice')}
              />
              <ModeCard
                icon={<MessageSquare size={22} />}
                title="Text"
                description="Threaded text meeting with full transcript, agent intervener routing, and SSE streaming. Async-friendly."
                onClick={() => setMode('text')}
              />
              <ModeCard
                icon={<Video size={22} />}
                title="Live Meetings"
                description="Send an agent into a Google Meet via Pika, or create a Daily.co room. Active sessions and history."
                onClick={() => setMode('meet')}
              />
              <ModeCard
                icon={<Sliders size={22} />}
                title="Voice config"
                description="Per-agent Gemini Live voice picker. Used to be its own tab; now lives here under War Room."
                onClick={() => setMode('voices')}
              />
              <ModeCard
                icon={<Users size={22} />}
                title="Standup roster"
                description="Pick which agents run /standup and /discuss, in what order, and how many speak per turn."
                onClick={() => setMode('standup')}
              />
              <ExternalCard
                icon={<ExternalLink size={22} />}
                title="Open in classic"
                description="Voice and text War Room pages from the legacy dashboard, served by the same backend."
                href={legacyUrl(`/warroom?mode=picker&token=${encodeURIComponent(dashboardToken)}&chatId=${encodeURIComponent(chatId)}`)}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div class="flex flex-col h-full">
      <PageHeader
        title="War Room"
        breadcrumb="War Room"
        tabs={
          <>
            <Tab label="Voice" active={mode === 'voice'} onClick={() => setMode('voice')} />
            <Tab label="Text" active={mode === 'text'} onClick={() => setMode('text')} />
            <Tab label="Live Meetings" active={mode === 'meet'} onClick={() => setMode('meet')} />
            <Tab label="Voice config" active={mode === 'voices'} onClick={() => setMode('voices')} />
            <Tab label="Standup" active={mode === 'standup'} onClick={() => setMode('standup')} />
            <button
              type="button"
              onClick={() => setMode('picker')}
              class="ml-auto text-[11.5px] text-[var(--color-text-faint)] hover:text-[var(--color-text-muted)]"
            >
              ← Back to picker
            </button>
          </>
        }
      />
      <div class="flex-1 overflow-y-auto flex flex-col">
        {mode === 'voice' && <VoicePane />}
        {mode === 'text' && <TextPane />}
        {mode === 'meet' && <MeetPane />}
        {mode === 'voices' && <VoicesPane embedded />}
        {mode === 'standup' && <StandupConfigPane />}
      </div>
    </div>
  );
}

function readModeFromUrl(): Mode {
  try {
    const m = new URLSearchParams(window.location.search).get('mode');
    if (m === 'voice' || m === 'text' || m === 'meet' || m === 'voices' || m === 'picker' || m === 'standup') return m;
  } catch {}
  return 'picker';
}

function ModeCard({ icon, title, description, onClick }: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      class="text-left bg-[var(--color-card)] border border-[var(--color-border)] hover:border-[var(--color-accent)] rounded-lg p-5 transition-colors"
    >
      <div class="text-[var(--color-accent)] mb-3">{icon}</div>
      <div class="text-[15px] font-semibold text-[var(--color-text)] mb-1">{title}</div>
      <div class="text-[12px] text-[var(--color-text-muted)] leading-relaxed">{description}</div>
    </button>
  );
}

function ExternalCard({ icon, title, description, href }: any) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      class="block text-left bg-[var(--color-card)] border border-[var(--color-border)] hover:border-[var(--color-text-muted)] rounded-lg p-5 transition-colors"
    >
      <div class="text-[var(--color-text-muted)] mb-3">{icon}</div>
      <div class="text-[15px] font-semibold text-[var(--color-text)] mb-1">{title}</div>
      <div class="text-[12px] text-[var(--color-text-muted)] leading-relaxed">{description}</div>
    </a>
  );
}

// ── Voice pane ─────────────────────────────────────────────────────

function VoicePane() {
  const pin = useFetch<PinState>('/api/warroom/pin', 5_000);
  const roster = useFetch<{ agents: RosterAgent[] }>('/api/warroom/agents', 60_000);
  const meetings = useFetch<{ meetings: VoiceMeeting[] }>('/api/warroom/meetings?limit=10', 60_000);
  const [busy, setBusy] = useState<string | null>(null);

  async function setPin(agent: string | null, mode: 'direct' | 'auto' = 'direct') {
    setBusy('pin');
    try {
      if (agent === null) await apiPost('/api/warroom/unpin');
      else await apiPost('/api/warroom/pin', { agent, mode });
      pin.refresh();
    } catch (err: any) { alert('Pin failed: ' + (err?.message || err)); }
    finally { setBusy(null); }
  }

  return (
    <div class="p-6 space-y-5">
      <section>
        <div class="text-[10px] uppercase tracking-wider text-[var(--color-text-faint)] mb-2">Pin an agent</div>
        <div class="text-[11.5px] text-[var(--color-text-muted)] mb-3 leading-relaxed">
          Direct mode routes every voice utterance to the pinned agent. Auto mode keeps the router on but uses the pin as the default route.
        </div>
        <div class="flex flex-wrap gap-1.5">
          <PinButton
            agent={null} label="Unpin" active={!pin.data?.agent}
            onClick={() => setPin(null)} disabled={busy === 'pin'}
          />
          {(roster.data?.agents ?? []).map((a) => (
            <PinButton
              key={a.id} agent={a} label={a.name || a.id}
              active={pin.data?.agent === a.id}
              onClick={() => setPin(a.id, pin.data?.mode || 'direct')}
              disabled={busy === 'pin'}
            />
          ))}
        </div>
        {pin.data?.agent && (
          <div class="mt-3 flex items-center gap-2 text-[11px] text-[var(--color-text-muted)]">
            <span>Mode:</span>
            <button
              type="button"
              onClick={() => setPin(pin.data!.agent!, 'direct')}
              class={[
                'px-2 py-0.5 rounded text-[10px] uppercase tracking-wider',
                pin.data.mode === 'direct' ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]' : 'text-[var(--color-text-faint)] hover:text-[var(--color-text)]',
              ].join(' ')}
            >
              Direct
            </button>
            <button
              type="button"
              onClick={() => setPin(pin.data!.agent!, 'auto')}
              class={[
                'px-2 py-0.5 rounded text-[10px] uppercase tracking-wider',
                pin.data.mode === 'auto' ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]' : 'text-[var(--color-text-faint)] hover:text-[var(--color-text)]',
              ].join(' ')}
            >
              Auto
            </button>
          </div>
        )}
      </section>

      <section>
        <div class="text-[10px] uppercase tracking-wider text-[var(--color-text-faint)] mb-2">Open the voice room</div>
        <a
          href={legacyUrl(`/warroom?mode=voice&token=${encodeURIComponent(dashboardToken)}&chatId=${encodeURIComponent(chatId)}`)}
          target="_blank"
          rel="noreferrer"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors"
        >
          <Mic size={13} /> Launch voice meeting
        </a>
      </section>

      <section>
        <div class="text-[10px] uppercase tracking-wider text-[var(--color-text-faint)] mb-2">Recent voice meetings</div>
        {meetings.loading && <div class="text-[11px] text-[var(--color-text-faint)]">Loading…</div>}
        {!meetings.loading && (meetings.data?.meetings ?? []).length === 0 && (
          <div class="text-[11px] text-[var(--color-text-faint)]">None yet</div>
        )}
        <div class="space-y-1">
          {(meetings.data?.meetings ?? []).map((m) => (
            <div key={m.id} class="flex items-center gap-3 px-3 py-2 bg-[var(--color-card)] border border-[var(--color-border)] rounded text-[11.5px]">
              <span class="text-[var(--color-text-muted)] tabular-nums">{formatRelativeTime(m.started_at)}</span>
              <span class="text-[var(--color-text-faint)]">·</span>
              <span class="text-[var(--color-text-muted)]">{m.mode}</span>
              {m.pinned_agent && (<><span class="text-[var(--color-text-faint)]">·</span><span class="text-[var(--color-text)]">@{m.pinned_agent}</span></>)}
              <span class="text-[var(--color-text-faint)]">·</span>
              <span class="text-[var(--color-text-muted)] tabular-nums">{m.entry_count} turns</span>
              {m.duration_s !== null && (<><span class="text-[var(--color-text-faint)]">·</span><span class="text-[var(--color-text-muted)] tabular-nums">{Math.round(m.duration_s / 60)}m</span></>)}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function PinButton({ agent, label, active, onClick, disabled }: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      class={[
        'inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] border transition-colors disabled:opacity-40',
        active
          ? 'bg-[var(--color-accent-soft)] border-[var(--color-accent)] text-[var(--color-accent)]'
          : 'bg-[var(--color-card)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)]',
      ].join(' ')}
    >
      {agent && <AgentAvatar agentId={agent.id} size={18} running />}
      {!agent && <PinOff size={13} />}
      {label}
      {active && <Pin size={11} />}
    </button>
  );
}

// ── Text pane ──────────────────────────────────────────────────────

function TextPane() {
  const meetings = useFetch<{ meetings: TextMeetingSummary[] }>(`/api/warroom/text/list?chatId=${encodeURIComponent(chatId)}&limit=20`, 30_000);
  const [creating, setCreating] = useState(false);

  async function newMeeting() {
    setCreating(true);
    try {
      const res = await apiPost<{ ok: boolean; meetingId: string }>('/api/warroom/text/new', { chatId });
      // Open in same window — text war room is served by legacy backend at /warroom/text.
      window.location.href = legacyUrl(`/warroom/text?token=${encodeURIComponent(dashboardToken)}&meetingId=${encodeURIComponent(res.meetingId)}&chatId=${encodeURIComponent(chatId)}`);
    } catch (err: any) {
      alert('New meeting failed: ' + (err?.message || err));
    } finally { setCreating(false); }
  }

  const list = meetings.data?.meetings ?? [];

  return (
    <div class="p-6 space-y-4">
      <button
        type="button"
        onClick={newMeeting}
        disabled={creating}
        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-40 transition-colors"
      >
        <MessageSquare size={13} /> {creating ? 'Creating…' : 'New text meeting'}
      </button>

      <section>
        <div class="text-[10px] uppercase tracking-wider text-[var(--color-text-faint)] mb-2">Recent text meetings</div>
        {meetings.loading && <PageState loading />}
        {!meetings.loading && list.length === 0 && (
          <div class="text-[11.5px] text-[var(--color-text-faint)]">None yet — start a new one above.</div>
        )}
        <div class="space-y-1.5">
          {list.map((m) => (
            <a
              key={m.id}
              href={legacyUrl(`/warroom/text?token=${encodeURIComponent(dashboardToken)}&meetingId=${encodeURIComponent(m.id)}&chatId=${encodeURIComponent(chatId)}`)}
              class="block bg-[var(--color-card)] border border-[var(--color-border)] hover:border-[var(--color-border-strong)] rounded-lg p-3 transition-colors"
            >
              <div class="flex items-center gap-2 mb-1">
                <span class="font-mono text-[10px] text-[var(--color-text-faint)]">{m.id.slice(3, 11)}</span>
                <span class="text-[11px] text-[var(--color-text-muted)]">{formatRelativeTime(m.started_at)}</span>
                {m.ended_at !== null
                  ? <Pill tone="cancelled">ended</Pill>
                  : <Pill tone="running">live</Pill>}
                <span class="ml-auto text-[10px] text-[var(--color-text-faint)] tabular-nums">{m.entry_count} turns</span>
              </div>
              <div class="text-[12px] text-[var(--color-text)] line-clamp-1">{m.preview || '(no messages yet)'}</div>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}

// ── Meet pane ──────────────────────────────────────────────────────

function MeetPane() {
  const sessions = useFetch<{ active: MeetSession[]; recent: MeetSession[] }>('/api/meet/sessions', 5_000);
  const active = sessions.data?.active ?? [];
  const recent = sessions.data?.recent ?? [];

  return (
    <div class="p-6 space-y-5">
      <DispatchForm onChange={sessions.refresh} />

      <section>
        <div class="text-[10px] uppercase tracking-wider text-[var(--color-text-faint)] mb-2">Active sessions</div>
        {sessions.loading && active.length === 0 && <PageState loading />}
        {!sessions.loading && active.length === 0 && (
          <div class="text-[11.5px] text-[var(--color-text-faint)]">No active video meetings.</div>
        )}
        <div class="space-y-1.5">
          {active.map((s) => <MeetRow key={s.id} session={s} live onChange={sessions.refresh} />)}
        </div>
      </section>

      <section>
        <div class="text-[10px] uppercase tracking-wider text-[var(--color-text-faint)] mb-2">Recent</div>
        {recent.length === 0 && (
          <div class="text-[11.5px] text-[var(--color-text-faint)]">None.</div>
        )}
        <div class="space-y-1.5">
          {recent.map((s) => <MeetRow key={s.id} session={s} live={false} onChange={sessions.refresh} />)}
        </div>
      </section>
    </div>
  );
}

function DispatchForm({ onChange }: { onChange: () => void }) {
  const agents = useFetch<{ agents: { id: string; name: string; running: boolean }[] }>('/api/agents', 60_000);
  const list = agents.data?.agents ?? [];
  const [tab, setTab] = useState<'meet' | 'daily'>('meet');
  const [agent, setAgent] = useState<string>('');
  const [meetUrl, setMeetUrl] = useState('');
  const [autoBrief, setAutoBrief] = useState(true);
  const [dailyMode, setDailyMode] = useState<'direct' | 'auto'>('direct');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // Default to first agent once loaded.
  if (!agent && list.length > 0) setTimeout(() => setAgent(list[0].id), 0);

  async function dispatchMeet() {
    if (!agent || !meetUrl) return;
    if (!/^https:\/\/meet\.google\.com\//.test(meetUrl)) {
      setStatus({ kind: 'err', text: 'meet_url must start with https://meet.google.com/' });
      return;
    }
    setBusy(true); setStatus(null);
    try {
      const res = await apiPost<{ ok: boolean; error?: string; message?: string }>('/api/meet/join', {
        agent, meet_url: meetUrl, auto_brief: autoBrief,
      });
      if (!res.ok) throw new Error(res.error || 'Join failed');
      setStatus({ kind: 'ok', text: res.message || 'Agent dispatched.' });
      setMeetUrl('');
      onChange();
    } catch (err: any) {
      setStatus({ kind: 'err', text: err?.message || String(err) });
    } finally { setBusy(false); }
  }

  async function dispatchDaily() {
    if (!agent) return;
    setBusy(true); setStatus(null);
    try {
      const res = await apiPost<{ ok: boolean; room_url?: string; error?: string; message?: string }>('/api/meet/join-daily', {
        agent, mode: dailyMode, auto_brief: autoBrief,
      });
      if (!res.ok) throw new Error(res.error || 'Create failed');
      const tail = res.room_url ? ' Room: ' + res.room_url : '';
      setStatus({ kind: 'ok', text: (res.message || 'Daily room ready.') + tail });
      onChange();
    } catch (err: any) {
      setStatus({ kind: 'err', text: err?.message || String(err) });
    } finally { setBusy(false); }
  }

  return (
    <section>
      <div class="text-[10px] uppercase tracking-wider text-[var(--color-text-faint)] mb-2">Dispatch an agent</div>
      <div class="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg overflow-hidden">
        <div class="flex border-b border-[var(--color-border)]">
          <DispatchTab label="Google Meet (Pika)" active={tab === 'meet'} onClick={() => setTab('meet')} />
          <DispatchTab label="Daily.co (Pipecat + Gemini)" active={tab === 'daily'} onClick={() => setTab('daily')} />
        </div>
        <div class="p-4 space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <Field label="Agent">
              <select
                value={agent}
                onChange={(e) => setAgent((e.target as HTMLSelectElement).value)}
                disabled={busy || list.length === 0}
                class="w-full bg-[var(--color-elevated)] border border-[var(--color-border)] rounded px-2.5 py-1.5 text-[12.5px] outline-none focus:border-[var(--color-accent)]"
              >
                {list.map((a) => (
                  <option key={a.id} value={a.id}>{a.name || a.id}{a.running ? '' : ' (offline)'}</option>
                ))}
              </select>
            </Field>
            {tab === 'daily' && (
              <Field label="Mode">
                <select
                  value={dailyMode}
                  onChange={(e) => setDailyMode((e.target as HTMLSelectElement).value as any)}
                  disabled={busy}
                  class="w-full bg-[var(--color-elevated)] border border-[var(--color-border)] rounded px-2.5 py-1.5 text-[12.5px] outline-none focus:border-[var(--color-accent)]"
                >
                  <option value="direct">Direct (one agent)</option>
                  <option value="auto">Auto (router decides)</option>
                </select>
              </Field>
            )}
          </div>

          {tab === 'meet' && (
            <Field label="Google Meet URL">
              <input
                type="text"
                value={meetUrl}
                onInput={(e) => setMeetUrl((e.target as HTMLInputElement).value.trim())}
                placeholder="https://meet.google.com/abc-defg-hij"
                disabled={busy}
                class="w-full bg-[var(--color-elevated)] border border-[var(--color-border)] rounded px-2.5 py-1.5 text-[12.5px] font-mono outline-none focus:border-[var(--color-accent)]"
              />
            </Field>
          )}

          <label class="flex items-center gap-2 text-[12px] text-[var(--color-text-muted)] cursor-pointer">
            <input
              type="checkbox"
              checked={autoBrief}
              onChange={(e) => setAutoBrief((e.target as HTMLInputElement).checked)}
              disabled={busy}
            />
            Auto-brief the agent with chat context before joining
          </label>

          {status && (
            <div class={'text-[11px] ' + (status.kind === 'err' ? 'text-[var(--color-status-failed)]' : 'text-[var(--color-status-done)]')}>
              {status.text}
            </div>
          )}

          <div class="flex justify-end">
            <button
              type="button"
              onClick={tab === 'meet' ? dispatchMeet : dispatchDaily}
              disabled={busy || !agent || (tab === 'meet' && !meetUrl)}
              class="inline-flex items-center gap-1 px-3 py-1.5 rounded text-[12px] font-medium bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Video size={12} /> {busy ? 'Dispatching…' : tab === 'meet' ? 'Send agent to Meet' : 'Create Daily room'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function DispatchTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      class={[
        'flex-1 px-4 py-2 text-[12px] transition-colors',
        active
          ? 'bg-[var(--color-elevated)] text-[var(--color-text)]'
          : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-elevated)]',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

function Field({ label, children }: { label: string; children: any }) {
  return (
    <div>
      <label class="block text-[10px] uppercase tracking-wider text-[var(--color-text-faint)] mb-1">{label}</label>
      {children}
    </div>
  );
}

function MeetRow({ session, live, onChange }: { session: MeetSession; live: boolean; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  async function leave() {
    setBusy(true);
    try { await apiPost('/api/meet/leave', { session_id: session.id }); onChange(); }
    catch (err: any) { alert('Leave failed: ' + (err?.message || err)); }
    finally { setBusy(false); }
  }
  return (
    <div class="flex items-center gap-3 bg-[var(--color-card)] border border-[var(--color-border)] rounded p-3 text-[11.5px]">
      <AgentAvatar agentId={session.agent_id} size={24} running={live} />
      <div class="flex-1 min-w-0">
        <div class="text-[12px] text-[var(--color-text)] truncate">{session.meet_url}</div>
        <div class="text-[10px] text-[var(--color-text-faint)]">{session.provider} · {session.status} · {formatRelativeTime(session.created_at)}</div>
      </div>
      {live && (
        <button
          type="button"
          onClick={leave}
          disabled={busy}
          class="px-2 py-1 rounded text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-status-failed)] border border-[var(--color-border)] hover:border-[var(--color-status-failed)] transition-colors disabled:opacity-40"
        >
          {busy ? 'Leaving…' : 'Leave'}
        </button>
      )}
    </div>
  );
}
