import { useEffect, useState } from 'preact/hooks';
import { ArrowUp, ArrowDown, Save, RotateCcw, Users } from 'lucide-preact';
import { AgentAvatar } from '@/components/AgentAvatar';
import { PageState } from '@/components/PageState';
import { apiGet, apiPatch } from '@/lib/api';
import { pushToast } from '@/lib/toasts';

interface Agent { id: string; name: string; description?: string; running?: boolean; }
interface SavedConfig { agents: Array<{ id: string; enabled: boolean }>; maxSpeakers: number; }

// Hard ceiling matches SLASH_HARD_CAP in src/warroom-text-orchestrator.ts.
// The backend re-clamps in case this slips out of sync, but matching the
// slider keeps the UI honest about what'll actually run.
const MAX_CAP = 8;
const DEFAULT_CAP = 8;

export function StandupConfigPane() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [order, setOrder] = useState<string[]>([]);
  const [enabled, setEnabled] = useState<Set<string>>(new Set());
  const [maxSpeakers, setMaxSpeakers] = useState<number>(DEFAULT_CAP);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Snapshot of last saved state so Reset can roll back without
  // re-fetching from the server.
  const [snapshot, setSnapshot] = useState<{ order: string[]; enabled: string[]; maxSpeakers: number } | null>(null);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true); setError(null);
    try {
      const [agentsRes, settingsRes] = await Promise.all([
        apiGet<{ agents: Agent[] }>('/api/agents'),
        apiGet<Record<string, string>>('/api/dashboard/settings'),
      ]);
      const roster = agentsRes.agents || [];
      setAgents(roster);

      let nextOrder: string[];
      let nextEnabled: Set<string>;
      let nextMax = DEFAULT_CAP;

      const raw = settingsRes['standup_config'];
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as SavedConfig;
          if (parsed && Array.isArray(parsed.agents)) {
            const known = new Set<string>();
            const persisted: string[] = [];
            const enabledSet = new Set<string>();
            for (const a of parsed.agents) {
              if (!a || typeof a.id !== 'string') continue;
              known.add(a.id);
              persisted.push(a.id);
              if (a.enabled !== false) enabledSet.add(a.id);
            }
            // Append any roster agents NOT in saved config (newly added
            // agents) at the bottom, enabled by default. This mirrors
            // the backend's pickSlashRoster behavior.
            const rosterIds = roster.map((a) => a.id);
            const newcomers = rosterIds.filter((id) => !known.has(id));
            // Drop persisted entries whose agent has been deleted.
            const persistedStillThere = persisted.filter((id) => rosterIds.includes(id));
            nextOrder = [...persistedStillThere, ...newcomers];
            nextEnabled = new Set(persistedStillThere.filter((id) => enabledSet.has(id)).concat(newcomers));
            const rawMax = Number(parsed.maxSpeakers);
            nextMax = Number.isFinite(rawMax)
              ? Math.max(1, Math.min(MAX_CAP, Math.floor(rawMax)))
              : DEFAULT_CAP;
          } else {
            nextOrder = roster.map((a) => a.id);
            nextEnabled = new Set(nextOrder);
          }
        } catch {
          nextOrder = roster.map((a) => a.id);
          nextEnabled = new Set(nextOrder);
        }
      } else {
        // No saved config — default order matches the backend canonical
        // order with everyone else appended.
        const CANONICAL = ['research', 'ops', 'comms', 'content', 'main'];
        const rosterIds = new Set(roster.map((a) => a.id));
        const canonical = CANONICAL.filter((id) => rosterIds.has(id));
        const others = roster.map((a) => a.id).filter((id) => !CANONICAL.includes(id));
        nextOrder = [...canonical, ...others];
        nextEnabled = new Set(nextOrder);
      }

      setOrder(nextOrder);
      setEnabled(nextEnabled);
      setMaxSpeakers(nextMax);
      setSnapshot({ order: [...nextOrder], enabled: [...nextEnabled], maxSpeakers: nextMax });
      setDirty(false);
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  function bumpDirty(nextOrder?: string[], nextEnabled?: Set<string>, nextMax?: number) {
    if (!snapshot) return;
    const o = nextOrder ?? order;
    const e = nextEnabled ?? enabled;
    const m = nextMax ?? maxSpeakers;
    const orderEq = o.length === snapshot.order.length && o.every((id, i) => snapshot.order[i] === id);
    const enabledEq = e.size === snapshot.enabled.length && [...e].every((id) => snapshot.enabled.includes(id));
    setDirty(!(orderEq && enabledEq && m === snapshot.maxSpeakers));
  }

  function move(idx: number, delta: -1 | 1) {
    const next = [...order];
    const target = idx + delta;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setOrder(next);
    bumpDirty(next, undefined, undefined);
  }

  function toggle(id: string) {
    const next = new Set(enabled);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setEnabled(next);
    bumpDirty(undefined, next, undefined);
  }

  function changeMax(value: number) {
    const clamped = Math.max(1, Math.min(MAX_CAP, Math.round(value)));
    setMaxSpeakers(clamped);
    bumpDirty(undefined, undefined, clamped);
  }

  async function save() {
    if (!dirty) return;
    setSaving(true);
    try {
      const value = JSON.stringify({
        agents: order.map((id) => ({ id, enabled: enabled.has(id) })),
        maxSpeakers,
      });
      await apiPatch('/api/dashboard/settings', { key: 'standup_config', value });
      setSnapshot({ order: [...order], enabled: [...enabled], maxSpeakers });
      setDirty(false);
      pushToast({ tone: 'success', title: 'Standup roster saved', description: 'Takes effect on the next /standup or /discuss.' });
    } catch (err: any) {
      pushToast({ tone: 'error', title: 'Save failed', description: err?.message || String(err), durationMs: 6000 });
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    if (!snapshot) return;
    setOrder([...snapshot.order]);
    setEnabled(new Set(snapshot.enabled));
    setMaxSpeakers(snapshot.maxSpeakers);
    setDirty(false);
  }

  if (loading) return <PageState loading />;
  if (error) return <PageState error={error} />;

  // What WILL actually run on the next /standup, given the cap.
  const enabledOrdered = order.filter((id) => enabled.has(id));
  const willSpeak = enabledOrdered.slice(0, maxSpeakers);
  const willSkip = enabledOrdered.slice(maxSpeakers);

  return (
    <div class="p-6 space-y-5 max-w-3xl">
      <section>
        <div class="flex items-center gap-2 mb-2">
          <Users size={14} class="text-[var(--color-accent)]" />
          <h3 class="text-[13px] font-semibold text-[var(--color-text)]">/standup roster</h3>
        </div>
        <p class="text-[11.5px] text-[var(--color-text-muted)] leading-relaxed">
          Reorder, toggle, and cap who runs in <code class="font-mono text-[var(--color-text-faint)]">/standup</code> and <code class="font-mono text-[var(--color-text-faint)]">/discuss</code>. Order in this list is speak order. Disabled agents are skipped entirely. Saved to dashboard settings, not per meeting.
        </p>
      </section>

      <section class="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg overflow-hidden">
        <div class="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
          <div class="text-[10px] uppercase tracking-wider text-[var(--color-text-faint)]">Agents</div>
          <div class="text-[11px] text-[var(--color-text-muted)] tabular-nums">
            {willSpeak.length} will speak · {willSkip.length} in rotation · {agents.length - enabledOrdered.length} disabled
          </div>
        </div>
        <ul class="divide-y divide-[var(--color-border)]">
          {order.map((id, idx) => {
            const agent = agents.find((a) => a.id === id);
            if (!agent) return null;
            const isEnabled = enabled.has(id);
            const willRun = isEnabled && idx < (() => {
              // Can't easily compute "is this agent within the cap" since
              // disabled rows pad the list. Compute against enabledOrdered.
              const enabledIdx = enabledOrdered.indexOf(id);
              return enabledIdx >= 0 && enabledIdx < maxSpeakers ? Number.MAX_SAFE_INTEGER : -1;
            })();
            const enabledIdx = enabledOrdered.indexOf(id);
            const inCap = isEnabled && enabledIdx >= 0 && enabledIdx < maxSpeakers;
            return (
              <li
                key={id}
                class={'flex items-center gap-3 px-4 py-2.5 ' + (isEnabled ? '' : 'opacity-55')}
              >
                <span class="text-[10px] text-[var(--color-text-faint)] tabular-nums w-5">{idx + 1}.</span>
                <AgentAvatar agentId={id} size={26} running={agent.running} />
                <div class="flex-1 min-w-0">
                  <div class="text-[12.5px] text-[var(--color-text)] truncate">{agent.name || id}</div>
                  {agent.description && (
                    <div class="text-[10.5px] text-[var(--color-text-faint)] truncate">{agent.description}</div>
                  )}
                </div>
                {isEnabled && !inCap && (
                  <span
                    class="text-[10px] uppercase tracking-wider text-[var(--color-text-faint)]"
                    title="Speaks on a later /standup once rotation cycles to this slot."
                  >
                    rotation queue
                  </span>
                )}
                {isEnabled && inCap && enabledIdx === 0 && (
                  <span class="text-[10px] uppercase tracking-wider text-[var(--color-accent)]">leads</span>
                )}
                <button
                  type="button"
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                  class="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-elevated)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Move up"
                >
                  <ArrowUp size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => move(idx, 1)}
                  disabled={idx === order.length - 1}
                  class="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-elevated)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Move down"
                >
                  <ArrowDown size={13} />
                </button>
                <label class="flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)] cursor-pointer ml-1">
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={() => toggle(id)}
                  />
                  in
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      <section class="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg p-4">
        <div class="flex items-center justify-between mb-2">
          <div>
            <div class="text-[12px] text-[var(--color-text)]">Max agents per turn</div>
            <div class="text-[10.5px] text-[var(--color-text-faint)] mt-0.5">
              The meeting watchdog gives each turn 300s. Higher caps shrink each agent's budget so the math still fits.
            </div>
          </div>
          <div class="text-[18px] font-semibold tabular-nums text-[var(--color-accent)]">{maxSpeakers}</div>
        </div>
        <input
          type="range"
          min={1}
          max={MAX_CAP}
          step={1}
          value={maxSpeakers}
          onInput={(e) => changeMax(Number((e.target as HTMLInputElement).value))}
          class="w-full"
        />
        <div class="flex justify-between text-[9.5px] text-[var(--color-text-faint)] tabular-nums mt-1">
          <span>1</span>
          <span>{MAX_CAP}</span>
        </div>
        {willSkip.length > 0 && (
          <p class="text-[10.5px] text-[var(--color-text-faint)] mt-3 leading-relaxed">
            With more than {maxSpeakers} agents enabled, <code class="font-mono">/standup</code> cycles
            through the {willSkip.length} in the rotation queue on subsequent calls — the preview above
            shows the next batch only.
          </p>
        )}
      </section>

      <section class="flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving}
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Save size={13} /> {saving ? 'Saving…' : 'Save roster'}
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={!dirty || saving}
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] border border-[var(--color-border)] hover:bg-[var(--color-elevated)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <RotateCcw size={12} /> Reset
        </button>
        <span class={'text-[11.5px] tabular-nums ml-1 ' + (dirty ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-faint)]')}>
          {dirty ? '● modified' : 'saved'}
        </span>
      </section>
    </div>
  );
}
