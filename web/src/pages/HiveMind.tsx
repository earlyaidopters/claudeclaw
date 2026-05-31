import { useEffect, useState, useMemo } from 'preact/hooks';
import { lazy, Suspense } from 'preact/compat';
import { Brain as BrainIcon, Box, List as ListIcon } from 'lucide-preact';
import { PageHeader, Tab } from '@/components/PageHeader';
import { PageState } from '@/components/PageState';
import { PrivacyToggle } from '@/components/PrivacyToggle';
import { BrainGraph } from '@/components/BrainGraph';
import { useFetch } from '@/lib/useFetch';
import { formatRelativeTime } from '@/lib/format';
import { privacyBlur } from '@/lib/privacy';
import { hasWebGL } from '@/lib/webgl';

// Lazy-load 3D so the ~150KB three.js bundle only ships when the user
// flips to the 3D view. Default 2D path stays cheap.
const BrainGraph3D = lazy(() =>
  import('@/components/BrainGraph3D').then((m) => ({ default: m.BrainGraph3D })),
);

interface HiveEntry {
  id: number;
  agent_id: string;
  chat_id: string;
  action: string;
  summary: string;
  artifacts: string | null;
  created_at: number;
}

const AGENT_HUE: Record<string, string> = {
  main: 'var(--color-accent)',
  research: '#5eb6ff',
  comms: '#10b981',
  content: '#f59e0b',
  ops: '#a78bfa',
};

const KNOWN_AGENTS = ['main', 'research', 'comms', 'content', 'ops'];
const VIEW_KEY = 'claudeclaw.hive.view';
type ViewMode = 'brain2d' | 'brain3d' | 'activity';

function loadView(): ViewMode {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    if (v === 'brain2d' || v === 'brain3d' || v === 'activity') return v;
    // Migrate the old 'brain' value to 'brain2d'.
    if (v === 'brain') return 'brain2d';
  } catch {}
  return 'brain2d';
}

export function HiveMind() {
  const [filter, setFilter] = useState<string>('all');
  const [view, setView] = useState<ViewMode>(loadView());
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const agentList = useFetch<{ agents: { id: string }[] }>('/api/agents');
  const path = filter === 'all'
    ? '/api/hive-mind?limit=200'
    : `/api/hive-mind?agent=${encodeURIComponent(filter)}&limit=200`;
  const { data, loading, error } = useFetch<{ entries: HiveEntry[] }>(path, 30_000);
  const entries = data?.entries ?? [];
  const allAgents = agentList.data?.agents?.map((a) => a.id) ?? KNOWN_AGENTS;
  const blurOn = privacyBlur('hive').value;

  // Resolve to 2D if user requested 3D but the browser can't do WebGL.
  const webgl = useMemo(() => hasWebGL(), []);
  const effectiveView: ViewMode = view === 'brain3d' && !webgl ? 'brain2d' : view;
  // One-time hint when we silently downgraded.
  const downgraded = view === 'brain3d' && !webgl;

  function setViewPersisted(v: ViewMode) {
    setView(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch {}
  }

  function toggleRow(id: number) {
    if (!blurOn) return;
    const next = new Set(revealed);
    if (next.has(id)) next.delete(id); else next.add(id);
    setRevealed(next);
  }

  return (
    <div class="flex flex-col h-full">
      <PageHeader
        title="Hive Mind"
        actions={
          <>
            <span class="text-[11px] text-[var(--color-text-muted)] tabular-nums">{entries.length} entries</span>
            <PrivacyToggle section="hive" />
            <ViewSwitcher view={view} onChange={setViewPersisted} webglAvailable={webgl} />
          </>
        }
        tabs={
          <>
            <Tab label="All" active={filter === 'all'} onClick={() => setFilter('all')} />
            {allAgents.map((id) => (
              <Tab key={id} label={id} active={filter === id} onClick={() => setFilter(id)} />
            ))}
          </>
        }
      />
      {downgraded && (
        <div class="px-6 py-2 text-[11px] text-[var(--color-text-muted)] bg-[var(--color-elevated)] border-b border-[var(--color-border)]">
          WebGL isn't available on this device. Showing the 2D brain instead.
        </div>
      )}
      {error && <PageState error={error} />}
      {loading && !data && <PageState loading />}
      {!loading && !error && entries.length === 0 && (
        <PageState
          empty
          emptyTitle="No activity yet"
          emptyDescription="Every agent action — Telegram messages, delegated tasks, memory consolidations, kill-switch refusals — lands here as it happens."
        />
      )}

      {entries.length > 0 && effectiveView === 'brain2d' && (
        <BrainGraph
          entries={entries}
          agentFilter={filter}
          agentColors={AGENT_HUE}
          blurOn={blurOn}
        />
      )}

      {entries.length > 0 && effectiveView === 'brain3d' && (
        <Suspense fallback={
          <div class="flex-1 flex items-center justify-center text-[12px] text-[var(--color-text-muted)]">
            Loading 3D engine…
          </div>
        }>
          <BrainGraph3D
            entries={entries}
            agentFilter={filter}
            agentColors={AGENT_HUE}
            blurOn={blurOn}
          />
        </Suspense>
      )}

      {entries.length > 0 && effectiveView === 'activity' && (
        <div class="flex-1 overflow-y-auto">
          <table class="w-full text-[12px]">
            <thead class="sticky top-0 bg-[var(--color-bg)] border-b border-[var(--color-border)]">
              <tr class="text-left">
                <th class="px-6 py-2 font-medium text-[10px] uppercase tracking-wider text-[var(--color-text-faint)] w-[12%]">When</th>
                <th class="px-3 py-2 font-medium text-[10px] uppercase tracking-wider text-[var(--color-text-faint)] w-[12%]">Agent</th>
                <th class="px-3 py-2 font-medium text-[10px] uppercase tracking-wider text-[var(--color-text-faint)] w-[14%]">Action</th>
                <th class="px-3 py-2 font-medium text-[10px] uppercase tracking-wider text-[var(--color-text-faint)]">Summary</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} class="border-b border-[var(--color-border)] hover:bg-[var(--color-elevated)] transition-colors">
                  <td class="px-6 py-2 text-[var(--color-text-faint)] tabular-nums whitespace-nowrap">
                    {formatRelativeTime(e.created_at)}
                  </td>
                  <td class="px-3 py-2">
                    <span class="inline-flex items-center gap-1.5" style={{ color: AGENT_HUE[e.agent_id] || 'var(--color-text-muted)' }}>
                      <span class="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'currentColor' }} />
                      {e.agent_id}
                    </span>
                  </td>
                  <td class="px-3 py-2 font-mono text-[11px] text-[var(--color-text-muted)]">{e.action}</td>
                  <td class="px-3 py-2 text-[var(--color-text)] truncate max-w-0">
                    <span
                      class={[blurOn ? 'privacy-blur' : '', revealed.has(e.id) ? 'revealed' : ''].filter(Boolean).join(' ')}
                      onClick={(ev) => { ev.stopPropagation(); toggleRow(e.id); }}
                    >
                      {e.summary}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ViewSwitcher({
  view, onChange, webglAvailable,
}: {
  view: ViewMode;
  onChange: (v: ViewMode) => void;
  webglAvailable: boolean;
}) {
  return (
    <div class="inline-flex bg-[var(--color-elevated)] border border-[var(--color-border)] rounded p-0.5">
      <ViewBtn icon={<BrainIcon size={13} />} title="2D brain" active={view === 'brain2d'} onClick={() => onChange('brain2d')} />
      <ViewBtn
        icon={<Box size={13} />}
        title={webglAvailable ? '3D brain' : '3D brain (WebGL not available)'}
        active={view === 'brain3d'}
        onClick={() => onChange('brain3d')}
        disabled={!webglAvailable}
      />
      <ViewBtn icon={<ListIcon size={13} />} title="Activity table" active={view === 'activity'} onClick={() => onChange('activity')} />
    </div>
  );
}

function ViewBtn({
  icon, title, active, onClick, disabled,
}: {
  icon: any;
  title: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      class={[
        'inline-flex items-center justify-center w-7 h-7 rounded transition-colors',
        active ? 'bg-[var(--color-accent)] text-white' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
        disabled ? 'opacity-30 cursor-not-allowed' : '',
      ].join(' ')}
    >
      {icon}
    </button>
  );
}
