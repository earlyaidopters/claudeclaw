import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useLocation } from 'wouter-preact';
import { Plus, Wand2, Trash2, X, History, Inbox, GripVertical, Maximize2, Minimize2, LayoutGrid as LayoutIcon, Check } from 'lucide-preact';
import { PageHeader } from '@/components/PageHeader';
import { Pill, StatusDot } from '@/components/Pill';
import { PageState } from '@/components/PageState';
import { Modal, Drawer } from '@/components/Modal';
import { AgentAvatar } from '@/components/AgentAvatar';
import { useFetch } from '@/lib/useFetch';
import { apiPost, apiPatch, apiDelete, apiGet } from '@/lib/api';
import { formatRelativeTime } from '@/lib/format';
import { pushToast } from '@/lib/toasts';
import {
  workspaceName,
  missionColumnOrder,
  missionColumnWidths,
  setMissionColumnOrder,
  setMissionColumnWidth,
  setMissionColumnWidthsBulk,
} from '@/lib/personalization';

interface MissionTask {
  id: string;
  title: string;
  prompt: string;
  assigned_agent: string | null;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  priority: number;
  created_by: string;
  created_at: number;
  started_at: number | null;
  completed_at: number | null;
  result: string | null;
  error: string | null;
}

interface Agent { id: string; name: string; description: string; running: boolean; }

const TERMINAL: MissionTask['status'][] = ['completed', 'failed', 'cancelled'];
const DONE_VISIBLE_SECS = 30 * 60;

export function MissionControl() {
  const [location, navigate] = useLocation();
  const tasks = useFetch<{ tasks: MissionTask[] }>('/api/mission/tasks', 15_000);
  const agents = useFetch<{ agents: Agent[] }>('/api/agents', 60_000);

  const [createOpen, setCreateOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [bulkAssigning, setBulkAssigning] = useState(false);

  // ?new=1 from the command palette opens the create modal.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('new') === '1') {
      setCreateOpen(true);
      url.searchParams.delete('new');
      navigate(url.pathname);
    }
  }, [location]);

  const { byAgent, inbox, totalActive } = useMemo(() => {
    const all = tasks.data?.tasks ?? [];
    const agentList = agents.data?.agents ?? [];
    const now = Date.now() / 1000;
    const visible = all.filter((t) => {
      if (!TERMINAL.includes(t.status)) return true;
      if (!t.completed_at) return true;
      return now - t.completed_at < DONE_VISIBLE_SECS;
    });
    const inbox = visible.filter((t) => !t.assigned_agent);
    const byAgent: Record<string, MissionTask[]> = {};
    for (const a of agentList) byAgent[a.id] = [];
    for (const t of visible) {
      if (!t.assigned_agent) continue;
      (byAgent[t.assigned_agent] ??= []).push(t);
    }
    return { byAgent, inbox, totalActive: visible.filter((t) => !TERMINAL.includes(t.status)).length };
  }, [tasks.data, agents.data]);

  async function autoAssignAll() {
    setBulkAssigning(true);
    try {
      const res = await apiPost<{ assigned: number }>('/api/mission/tasks/auto-assign-all');
      tasks.refresh();
      if (typeof res?.assigned === 'number') {
        // Tiny inline feedback; toast system is a follow-up.
        console.info(`Auto-assigned ${res.assigned} task${res.assigned === 1 ? '' : 's'}`);
      }
    } catch (err: any) {
      alert('Auto-assign failed: ' + (err?.message || err));
    } finally { setBulkAssigning(false); }
  }

  const loading = (tasks.loading || agents.loading) && !tasks.data;
  const error = tasks.error || agents.error;
  const wsName = workspaceName.value;
  const headerTitle = wsName && wsName !== 'ClaudeClaw' ? `${wsName} · Tasks` : 'Mission Control';

  // Apply user-saved column order on top of API agent order. Any agents
  // not in the saved order keep their API position; saved agents that no
  // longer exist are skipped.
  const orderedAgents = useMemo(() => {
    const live = agents.data?.agents ?? [];
    const saved = missionColumnOrder.value;
    if (saved.length === 0) return live;
    const byId = new Map(live.map((a) => [a.id, a]));
    const out: Agent[] = [];
    for (const id of saved) {
      const a = byId.get(id);
      if (a) { out.push(a); byId.delete(id); }
    }
    for (const a of live) if (byId.has(a.id)) out.push(a);
    return out;
  }, [agents.data, missionColumnOrder.value]);

  function handleColumnDrop(targetId: string, draggedId: string) {
    if (targetId === draggedId) return;
    const ids = orderedAgents.map((a) => a.id);
    const from = ids.indexOf(draggedId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    const next = [...ids];
    next.splice(from, 1);
    next.splice(to, 0, draggedId);
    setMissionColumnOrder(next);
  }

  return (
    <div class="flex flex-col h-full">
      <PageHeader
        title={headerTitle}
        actions={
          <>
            <span class="text-[11px] text-[var(--color-text-muted)] tabular-nums mr-2">
              {totalActive} active · {inbox.length} unassigned · {tasks.data?.tasks?.length ?? 0} total
            </span>
            <LayoutMenu agents={orderedAgents} />
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-elevated)] transition-colors"
            >
              <History size={13} /> History
            </button>
            {inbox.length > 0 && (
              <button
                type="button"
                onClick={autoAssignAll}
                disabled={bulkAssigning}
                class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-elevated)] border border-[var(--color-border)] transition-colors disabled:opacity-40"
              >
                <Wand2 size={13} /> {bulkAssigning ? 'Assigning…' : `Auto-assign all (${inbox.length})`}
              </button>
            )}
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors"
            >
              <Plus size={14} /> New Task
            </button>
          </>
        }
      />

      {error && <PageState error={error} />}
      {loading && <PageState loading />}

      {!loading && !error && (
        <div class="flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
          <div class="flex gap-3 p-4 h-full min-w-max">
            <InboxColumn tasks={inbox} onChange={tasks.refresh} agents={orderedAgents} />
            {orderedAgents.map((a) => (
              <AgentColumn
                key={a.id}
                agent={a}
                tasks={byAgent[a.id] ?? []}
                onChange={tasks.refresh}
                onColumnDrop={handleColumnDrop}
              />
            ))}
          </div>
        </div>
      )}

      <CreateTaskModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        agents={agents.data?.agents ?? []}
        onCreated={tasks.refresh}
      />

      <Drawer open={historyOpen} onClose={() => setHistoryOpen(false)} title="Task history">
        {/* Remount on each open so the fetch fires fresh and a previous
            error doesn't leave the drawer stuck on an empty state. */}
        {historyOpen && <HistoryList />}
      </Drawer>
    </div>
  );
}

// ── Columns ─────────────────────────────────────────────────────────

// Inbox is pinned leftmost and not draggable/resizable — it's a fixed
// landing zone for unassigned tasks. Width chosen to match the default
// agent column width but slightly narrower since inbox cards are simpler.
function InboxColumn({ tasks, agents, onChange }: { tasks: MissionTask[]; agents: Agent[]; onChange: () => void }) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  return (
    <div
      class="w-[300px] shrink-0 flex flex-col bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg overflow-hidden"
      onDragOver={(e) => e.preventDefault()}
    >
      <div class="px-3 py-3 border-b border-[var(--color-border)] flex items-center gap-2">
        <Inbox size={15} class="text-[var(--color-text-muted)]" />
        <div class="flex-1 min-w-0">
          <div class="text-[13.5px] font-medium text-[var(--color-text)]">Inbox</div>
          <div class="text-[10.5px] text-[var(--color-text-faint)] uppercase tracking-wider">Unassigned</div>
        </div>
        <span class="text-[11.5px] text-[var(--color-text-muted)] tabular-nums">{tasks.length}</span>
      </div>

      <div class="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5">
        {tasks.length === 0 && (
          <div class="text-[11.5px] text-[var(--color-text-faint)] text-center py-6">
            All tasks are assigned
          </div>
        )}
        {tasks.map((t) => (
          <InboxCard
            key={t.id}
            task={t}
            agents={agents}
            onChange={onChange}
            onDragStart={() => setDraggingId(t.id)}
            onDragEnd={() => setDraggingId(null)}
            isDragging={draggingId === t.id}
          />
        ))}
      </div>
    </div>
  );
}

// Width presets cycled by the maximize/minimize buttons in the header.
// Tracks the resize handle's clamping range from personalization.ts
// (240–640). Three quick stops give keyboard-free "compact / normal /
// wide" behavior without needing the mouse.
const WIDTH_PRESETS = [260, 320, 480];
const DEFAULT_WIDTH = 320;
const COLUMN_DRAG_MIME = 'application/x-mission-column';

function AgentColumn({
  agent, tasks, onChange, onColumnDrop,
}: {
  agent: Agent;
  tasks: MissionTask[];
  onChange: () => void;
  onColumnDrop: (targetId: string, draggedId: string) => void;
}) {
  const [taskDragOver, setTaskDragOver] = useState(false);
  const [columnDragOver, setColumnDragOver] = useState(false);
  const queued = tasks.filter((t) => t.status === 'queued');
  const running = tasks.filter((t) => t.status === 'running');
  const terminal = tasks.filter((t) => TERMINAL.includes(t.status));

  const widths = missionColumnWidths.value;
  const width = widths[agent.id] ?? DEFAULT_WIDTH;

  function cyclePreset(direction: 'up' | 'down') {
    const stops = WIDTH_PRESETS;
    const i = stops.findIndex((px) => px >= width);
    const idx = i < 0 ? stops.length - 1 : i;
    const next = direction === 'up'
      ? Math.min(stops.length - 1, idx + 1)
      : Math.max(0, idx - 1);
    setMissionColumnWidth(agent.id, stops[next]);
  }

  // Card dropped from inbox or another column.
  async function handleTaskDrop(taskId: string) {
    try {
      await apiPatch(`/api/mission/tasks/${taskId}`, { assigned_agent: agent.id });
      onChange();
    } catch (err: any) {
      alert('Reassign failed: ' + (err?.message || err));
    }
  }

  // Top-level drop handler discriminates between a card drop (text/plain
  // is a task id) and a column reorder (custom MIME type).
  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setTaskDragOver(false); setColumnDragOver(false);
    const draggedColumnId = e.dataTransfer?.getData(COLUMN_DRAG_MIME);
    if (draggedColumnId) {
      onColumnDrop(agent.id, draggedColumnId);
      return;
    }
    const taskId = e.dataTransfer?.getData('text/plain');
    if (taskId) void handleTaskDrop(taskId);
  }

  return (
    <div
      class={[
        'shrink-0 flex flex-col bg-[var(--color-card)] border rounded-lg overflow-hidden relative transition-colors',
        taskDragOver
          ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]'
          : columnDragOver
          ? 'border-[var(--color-accent)]'
          : 'border-[var(--color-border)]',
      ].join(' ')}
      style={{ width: width + 'px' }}
      onDragOver={(e) => {
        e.preventDefault();
        const isColumn = Array.from(e.dataTransfer?.types ?? []).includes(COLUMN_DRAG_MIME);
        if (isColumn) setColumnDragOver(true); else setTaskDragOver(true);
      }}
      onDragLeave={(e) => {
        const rel = e.relatedTarget as Node | null;
        if (rel && (e.currentTarget as Node).contains(rel)) return;
        setTaskDragOver(false); setColumnDragOver(false);
      }}
      onDrop={handleDrop}
    >
      <div
        class="px-3 py-3 border-b border-[var(--color-border)] flex items-center gap-2"
      >
        <button
          type="button"
          draggable
          onDragStart={(e) => {
            e.dataTransfer?.setData(COLUMN_DRAG_MIME, agent.id);
            e.dataTransfer!.effectAllowed = 'move';
          }}
          class="cursor-grab active:cursor-grabbing text-[var(--color-text-faint)] hover:text-[var(--color-text-muted)] -ml-1"
          title="Drag to reorder"
        >
          <GripVertical size={14} />
        </button>
        <AgentAvatar agentId={agent.id} name={agent.name} running={agent.running} size={28} />
        <div class="flex-1 min-w-0">
          <div class="text-[13.5px] font-medium text-[var(--color-text)] truncate">{agent.name || agent.id}</div>
          <div class="text-[10.5px] text-[var(--color-text-faint)] uppercase tracking-wider flex items-center gap-1">
            <StatusDot tone={agent.running ? 'done' : 'cancelled'} />
            {agent.running ? 'Live' : 'Offline'}
          </div>
        </div>
        <span class="text-[11.5px] text-[var(--color-text-muted)] tabular-nums">{tasks.length}</span>
        <div class="flex items-center">
          <button
            type="button"
            onClick={() => cyclePreset('down')}
            disabled={width <= WIDTH_PRESETS[0]}
            class="p-1 rounded text-[var(--color-text-faint)] hover:text-[var(--color-text)] disabled:opacity-30 transition-colors"
            title="Narrower"
          >
            <Minimize2 size={12} />
          </button>
          <button
            type="button"
            onClick={() => cyclePreset('up')}
            disabled={width >= WIDTH_PRESETS[WIDTH_PRESETS.length - 1]}
            class="p-1 rounded text-[var(--color-text-faint)] hover:text-[var(--color-text)] disabled:opacity-30 transition-colors"
            title="Wider"
          >
            <Maximize2 size={12} />
          </button>
        </div>
      </div>

      <div class="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5">
        {tasks.length === 0 && (
          <div class="text-[11.5px] text-[var(--color-text-faint)] text-center py-6">
            No tasks
          </div>
        )}
        {[...running, ...queued, ...terminal].map((t) => (
          <TaskCard key={t.id} task={t} onChange={onChange} />
        ))}
      </div>

      <ResizeHandle agentId={agent.id} currentWidth={width} />
    </div>
  );
}

// Drag the right edge to resize. Mousemove updates the width signal
// optimistically; mouseup commits. We bind listeners on document so
// the user can drag past the column edge without losing the drag.
function ResizeHandle({ agentId, currentWidth }: { agentId: string; currentWidth: number }) {
  const startX = useRef(0);
  const startWidth = useRef(0);
  const dragging = useRef(false);

  function onPointerDown(e: PointerEvent) {
    e.preventDefault();
    dragging.current = true;
    startX.current = e.clientX;
    startWidth.current = currentWidth;
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp, { once: true });
  }
  function onMove(e: PointerEvent) {
    if (!dragging.current) return;
    const dx = e.clientX - startX.current;
    setMissionColumnWidth(agentId, startWidth.current + dx);
  }
  function onUp() {
    dragging.current = false;
    document.removeEventListener('pointermove', onMove);
  }

  return (
    <div
      onPointerDown={onPointerDown}
      class="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-[var(--color-accent)] active:bg-[var(--color-accent)] opacity-0 hover:opacity-50 transition-opacity"
      title="Drag to resize"
    />
  );
}

// ── Layout menu ─────────────────────────────────────────────────────
//
// Magnet/Rectangle-style layout presets. Snaps every agent column to
// the same width in one shot — uniform Compact/Normal/Wide, plus
// "Fit to viewport" that divides available horizontal space evenly,
// and Reset which clears all custom widths so columns revert to default.
//
// Inbox is intentionally not affected — it stays pinned at its
// hand-picked width regardless of layout choice.

const SIDEBAR_WIDTH = 260;
const INBOX_WIDTH = 300;
const PAGE_PADDING_X = 32; // p-4 on container = 16 each side
const COLUMN_GAP = 12; // gap-3

function LayoutMenu({ agents }: { agents: Agent[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const widths = missionColumnWidths.value;

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  function applyUniform(px: number) {
    const next: Record<string, number> = {};
    for (const a of agents) next[a.id] = px;
    setMissionColumnWidthsBulk(next);
    setOpen(false);
  }

  function applyFit() {
    if (agents.length === 0) { setOpen(false); return; }
    const available = window.innerWidth - SIDEBAR_WIDTH - INBOX_WIDTH - PAGE_PADDING_X
      - (agents.length + 1) * COLUMN_GAP;
    const per = Math.floor(available / agents.length);
    const next: Record<string, number> = {};
    for (const a of agents) next[a.id] = per;
    setMissionColumnWidthsBulk(next);
    setOpen(false);
  }

  function reset() {
    setMissionColumnWidthsBulk({});
    setOpen(false);
  }

  // Detect "currently active" preset by checking whether all agent
  // columns share a single width that matches one of our presets.
  const sample = agents[0] ? widths[agents[0].id] : undefined;
  const allSame = agents.length > 0 && agents.every((a) => widths[a.id] === sample);
  const activePreset =
    !allSame ? null
    : sample === 260 ? 'compact'
    : sample === 320 ? 'normal'
    : sample === 480 ? 'wide'
    : sample === undefined ? 'reset'
    : null;

  return (
    <div ref={ref} class="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-elevated)] transition-colors"
        title="Column layout presets"
      >
        <LayoutIcon size={13} /> Layout
      </button>
      {open && (
        <div class="absolute right-0 top-full mt-1 z-50 w-[240px] bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg shadow-2xl overflow-hidden">
          <div class="px-3 py-2 section-label border-b border-[var(--color-border)]">Uniform width</div>
          <LayoutItem
            label="Compact"
            hint="260 px each"
            active={activePreset === 'compact'}
            onClick={() => applyUniform(260)}
          />
          <LayoutItem
            label="Normal"
            hint="320 px each"
            active={activePreset === 'normal'}
            onClick={() => applyUniform(320)}
          />
          <LayoutItem
            label="Wide"
            hint="480 px each"
            active={activePreset === 'wide'}
            onClick={() => applyUniform(480)}
          />
          <div class="border-t border-[var(--color-border)]" />
          <LayoutItem
            label="Fit to viewport"
            hint="divide space evenly"
            onClick={applyFit}
          />
          <div class="border-t border-[var(--color-border)]" />
          <LayoutItem
            label="Reset"
            hint="clear custom widths"
            active={activePreset === 'reset'}
            onClick={reset}
          />
        </div>
      )}
    </div>
  );
}

function LayoutItem({
  label, hint, active, onClick,
}: {
  label: string; hint: string; active?: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      class="w-full flex items-center gap-2 px-3 py-2 text-[12.5px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-elevated)] transition-colors"
    >
      <span class="text-[var(--color-text)]">{label}</span>
      <span class="ml-auto text-[10.5px] text-[var(--color-text-faint)]">{hint}</span>
      {active && <Check size={12} class="text-[var(--color-accent)] ml-1" />}
    </button>
  );
}

// ── Cards ──────────────────────────────────────────────────────────

function InboxCard({
  task, agents, onChange, onDragStart, onDragEnd, isDragging,
}: {
  task: MissionTask; agents: Agent[]; onChange: () => void;
  onDragStart: () => void; onDragEnd: () => void; isDragging: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  async function autoAssign() {
    setBusy('assign');
    try {
      const res = await apiPost<{ ok: boolean; assigned_agent?: string }>(`/api/mission/tasks/${task.id}/auto-assign`);
      onChange();
      pushToast({
        tone: 'success',
        title: 'Auto-assigned',
        description: res.assigned_agent ? `Routed to @${res.assigned_agent}.` : 'Routed.',
      });
    } catch (err: any) {
      pushToast({ tone: 'error', title: 'Auto-assign failed', description: err?.message || String(err), durationMs: 6000 });
    } finally { setBusy(null); }
  }

  async function manualAssign(agentId: string) {
    setBusy('manual');
    try {
      await apiPatch(`/api/mission/tasks/${task.id}`, { assigned_agent: agentId });
      onChange();
      pushToast({ tone: 'success', title: 'Assigned', description: `Routed to @${agentId}.` });
    } catch (err: any) {
      pushToast({ tone: 'error', title: 'Assign failed', description: err?.message || String(err), durationMs: 6000 });
    } finally { setBusy(null); }
  }

  async function remove() {
    if (!confirm('Delete this task?')) return;
    setBusy('delete');
    try {
      await apiDelete(`/api/mission/tasks/${task.id}`);
      onChange();
      pushToast({ tone: 'warn', title: 'Task deleted' });
    } catch (err: any) {
      pushToast({ tone: 'error', title: 'Delete failed', description: err?.message || String(err), durationMs: 6000 });
    } finally { setBusy(null); }
  }

  return (
    <>
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer?.setData('text/plain', task.id); onDragStart(); }}
      onDragEnd={onDragEnd}
      class={[
        'bg-[var(--color-elevated)] border border-[var(--color-border)] rounded-md p-2.5 transition-all',
        isDragging ? 'opacity-40' : 'hover:border-[var(--color-border-strong)] cursor-grab',
      ].join(' ')}
    >
      <div
        class="cursor-pointer"
        onClick={() => setDetailsOpen(true)}
        title="Open task details"
      >
        <div class="flex items-center gap-1.5 mb-1">
          <Pill tone="neutral">unassigned</Pill>
          <span class="ml-auto text-[10px] text-[var(--color-text-faint)] tabular-nums">
            {formatRelativeTime(task.created_at)}
          </span>
        </div>
        <div class="text-[12.5px] text-[var(--color-text)] leading-snug mb-1.5 line-clamp-2">
          {task.title}
        </div>
      </div>
      {/* draggable=false on the action row stops the parent's HTML5 drag
          from swallowing button clicks. Without it, mousedown on Auto /
          select / Trash gets intercepted as drag-prep and onClick never
          fires. The card body above stays draggable so reassign-by-drag
          still works. */}
      <div
        class="flex items-center gap-1"
        draggable={false}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={autoAssign}
          disabled={busy !== null}
          class="inline-flex items-center gap-1 px-2 py-1 rounded text-[10.5px] font-medium bg-[var(--color-accent-soft)] text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-white transition-colors disabled:opacity-40"
        >
          <Wand2 size={11} /> {busy === 'assign' ? '…' : 'Auto'}
        </button>
        <select
          value=""
          onChange={(e) => { const v = (e.target as HTMLSelectElement).value; if (v) manualAssign(v); }}
          disabled={busy !== null}
          class="flex-1 bg-[var(--color-card)] border border-[var(--color-border)] rounded text-[10.5px] text-[var(--color-text-muted)] px-1 py-0.5 outline-none"
        >
          <option value="">Assign to…</option>
          {agents.map((a) => <option key={a.id} value={a.id}>{a.name || a.id}</option>)}
        </select>
        <button
          type="button"
          onClick={remove}
          disabled={busy !== null}
          class="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-status-failed)] transition-colors disabled:opacity-40"
          title="Delete"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>

    <TaskDetailsModal
      open={detailsOpen}
      onClose={() => setDetailsOpen(false)}
      task={task}
      agents={agents}
      busy={busy}
      onAutoAssign={async () => { await autoAssign(); setDetailsOpen(false); }}
      onManualAssign={async (agentId) => { await manualAssign(agentId); setDetailsOpen(false); }}
      onDelete={async () => { await remove(); setDetailsOpen(false); }}
    />
    </>
  );
}

// Modal preview for an unassigned inbox task. Opened when the user
// clicks the card body. Lets them see the full prompt + assign or
// delete in a focused view rather than fighting the cramped action
// row in the card.
function TaskDetailsModal({
  open, onClose, task, agents, busy, onAutoAssign, onManualAssign, onDelete,
}: {
  open: boolean;
  onClose: () => void;
  task: MissionTask;
  agents: Agent[];
  busy: string | null;
  onAutoAssign: () => Promise<void> | void;
  onManualAssign: (agentId: string) => Promise<void> | void;
  onDelete: () => Promise<void> | void;
}) {
  const [pickerAgent, setPickerAgent] = useState('');
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={'Task · ' + task.id.slice(0, 8)}
      width={560}
      footer={
        <>
          <button
            type="button"
            onClick={() => onDelete()}
            disabled={busy !== null}
            class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-status-failed)] border border-[var(--color-border)] hover:border-[var(--color-status-failed)] transition-colors disabled:opacity-40"
          >
            <Trash2 size={12} /> {busy === 'delete' ? 'Deleting…' : 'Delete'}
          </button>
          <div class="ml-auto flex items-center gap-2">
            <select
              value={pickerAgent}
              onChange={(e) => setPickerAgent((e.target as HTMLSelectElement).value)}
              disabled={busy !== null}
              class="bg-[var(--color-elevated)] border border-[var(--color-border)] rounded px-2 py-1 text-[12px] text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
            >
              <option value="">Assign to…</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name || a.id}</option>)}
            </select>
            <button
              type="button"
              onClick={() => pickerAgent && onManualAssign(pickerAgent)}
              disabled={!pickerAgent || busy !== null}
              class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-[12px] bg-[var(--color-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] border border-[var(--color-border)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy === 'manual' ? 'Assigning…' : 'Assign'}
            </button>
            <button
              type="button"
              onClick={() => onAutoAssign()}
              disabled={busy !== null}
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-medium bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-40 transition-colors"
            >
              <Wand2 size={12} /> {busy === 'assign' ? 'Classifying…' : 'Auto-assign'}
            </button>
          </div>
        </>
      }
    >
      <div class="space-y-3">
        <div>
          <div class="text-[10.5px] uppercase tracking-wider text-[var(--color-text-faint)] mb-1">Title</div>
          <div class="text-[14px] text-[var(--color-text)] leading-snug">{task.title}</div>
        </div>
        {task.prompt && task.prompt !== task.title && (
          <div>
            <div class="text-[10.5px] uppercase tracking-wider text-[var(--color-text-faint)] mb-1">Prompt</div>
            <div class="text-[12.5px] text-[var(--color-text-muted)] whitespace-pre-wrap font-mono leading-relaxed bg-[var(--color-elevated)] border border-[var(--color-border)] rounded p-3">
              {task.prompt}
            </div>
          </div>
        )}
        <div class="grid grid-cols-3 gap-3 pt-1">
          <Stat label="Created" value={formatRelativeTime(task.created_at)} />
          <Stat label="Priority" value={task.priority > 0 ? 'P' + task.priority : '—'} />
          <Stat label="Created by" value={task.created_by || 'dashboard'} />
        </div>
      </div>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div class="text-[10px] uppercase tracking-wider text-[var(--color-text-faint)] mb-1">{label}</div>
      <div class="text-[12.5px] text-[var(--color-text)] tabular-nums">{value}</div>
    </div>
  );
}

function TaskCard({ task, onChange }: { task: MissionTask; onChange: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const priorityTone = task.priority >= 7 ? 'high' : task.priority >= 4 ? 'medium' : 'low';
  const draggable = task.status === 'queued';

  async function cancel() {
    setBusy('cancel');
    try { await apiPost(`/api/mission/tasks/${task.id}/cancel`); onChange(); }
    catch (err: any) { alert('Cancel failed: ' + (err?.message || err)); }
    finally { setBusy(null); }
  }

  async function remove() {
    if (!confirm('Delete this task?')) return;
    setBusy('delete');
    try { await apiDelete(`/api/mission/tasks/${task.id}`); onChange(); }
    catch (err: any) { alert('Delete failed: ' + (err?.message || err)); }
    finally { setBusy(null); }
  }

  return (
    <div
      draggable={draggable}
      onDragStart={(e) => { if (draggable) e.dataTransfer?.setData('text/plain', task.id); }}
      onClick={() => setExpanded((v) => !v)}
      class={[
        'bg-[var(--color-elevated)] border border-[var(--color-border)] rounded-md p-2.5 transition-colors',
        draggable ? 'cursor-grab' : 'cursor-pointer',
        'hover:border-[var(--color-border-strong)]',
      ].join(' ')}
    >
      <div class="flex items-center gap-1.5 mb-1">
        <StatusDot tone={task.status as any} />
        <span class="text-[10px] text-[var(--color-text-faint)] tabular-nums uppercase tracking-wider">
          {task.id.slice(0, 6)}
        </span>
        <span class="ml-auto text-[10px] text-[var(--color-text-faint)]">
          {formatRelativeTime(task.completed_at || task.started_at || task.created_at)}
        </span>
      </div>
      <div class={'text-[12.5px] text-[var(--color-text)] leading-snug mb-1.5 ' + (expanded ? '' : 'line-clamp-2')}>
        {task.title}
      </div>
      <div class="flex items-center gap-1.5 flex-wrap">
        {task.priority > 0 && <Pill tone={priorityTone}>P{task.priority}</Pill>}
        <Pill tone={task.status as any}>{task.status}</Pill>
        <div class="ml-auto flex items-center gap-1">
          {(task.status === 'queued' || task.status === 'running') && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); cancel(); }}
              disabled={busy !== null}
              class="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-status-failed)] transition-colors disabled:opacity-40"
              title="Cancel"
            >
              <X size={11} />
            </button>
          )}
          {TERMINAL.includes(task.status) && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); remove(); }}
              disabled={busy !== null}
              class="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-status-failed)] transition-colors disabled:opacity-40"
              title="Delete"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
      </div>
      {expanded && task.prompt && task.prompt !== task.title && (
        <div class="mt-2 text-[11px] text-[var(--color-text-muted)] whitespace-pre-wrap font-mono leading-relaxed">
          {task.prompt}
        </div>
      )}
      {expanded && task.result && (
        <div class="mt-2 text-[11px] text-[var(--color-text)] whitespace-pre-wrap leading-relaxed border-t border-[var(--color-border)] pt-2">
          {task.result}
        </div>
      )}
      {task.error && (
        <div class="mt-1.5 text-[10.5px] text-[var(--color-status-failed)] line-clamp-2 font-mono">
          {task.error}
        </div>
      )}
    </div>
  );
}

// ── Create modal ───────────────────────────────────────────────────

function CreateTaskModal({
  open, onClose, agents, onCreated,
}: {
  open: boolean; onClose: () => void; agents: Agent[]; onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [agent, setAgent] = useState<string>('');
  const [priority, setPriority] = useState(5);
  const [autoAssign, setAutoAssign] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function close() {
    setTitle(''); setPrompt(''); setAgent(''); setPriority(5); setAutoAssign(true); setErr(null);
    onClose();
  }

  async function submit() {
    setBusy(true); setErr(null);
    try {
      const body: any = { title: title.trim(), prompt: prompt.trim(), priority };
      if (!autoAssign && agent) body.assigned_agent = agent;
      const created = await apiPost<{ task: MissionTask }>('/api/mission/tasks', body);
      if (autoAssign && !agent) {
        // Fire auto-assign in background; don't block the modal close.
        apiPost(`/api/mission/tasks/${created.task.id}/auto-assign`).catch(() => {});
      }
      onCreated();
      close();
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally { setBusy(false); }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="New mission task"
      width={520}
      footer={
        <>
          <button type="button" onClick={close} class="px-3 py-1.5 rounded text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text)]">Cancel</button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !title.trim() || !prompt.trim()}
            class="ml-auto px-3 py-1.5 rounded text-[12px] font-medium bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? 'Creating…' : 'Create'}
          </button>
        </>
      }
    >
      <div class="space-y-3">
        <div>
          <label class="block text-[10px] uppercase tracking-wider text-[var(--color-text-faint)] mb-1">Title</label>
          <input
            type="text"
            value={title}
            onInput={(e) => setTitle((e.target as HTMLInputElement).value)}
            placeholder="Short label (max 200 chars)"
            maxLength={200}
            autoFocus
            class="w-full bg-[var(--color-elevated)] border border-[var(--color-border)] rounded px-2.5 py-1.5 text-[12.5px] outline-none focus:border-[var(--color-accent)]"
          />
        </div>
        <div>
          <label class="block text-[10px] uppercase tracking-wider text-[var(--color-text-faint)] mb-1">Prompt</label>
          <textarea
            value={prompt}
            onInput={(e) => setPrompt((e.target as HTMLTextAreaElement).value)}
            placeholder="Full instructions for the agent. Max 10000 chars."
            maxLength={10000}
            rows={6}
            class="w-full bg-[var(--color-elevated)] border border-[var(--color-border)] rounded px-2.5 py-1.5 text-[12.5px] outline-none focus:border-[var(--color-accent)] resize-none font-mono"
          />
          <div class="text-[10px] text-[var(--color-text-faint)] mt-0.5 tabular-nums">{prompt.length} / 10000</div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-[10px] uppercase tracking-wider text-[var(--color-text-faint)] mb-1">Assign</label>
            <select
              value={autoAssign ? '__auto' : agent}
              onChange={(e) => {
                const v = (e.target as HTMLSelectElement).value;
                if (v === '__auto') { setAutoAssign(true); setAgent(''); }
                else { setAutoAssign(false); setAgent(v); }
              }}
              class="w-full bg-[var(--color-elevated)] border border-[var(--color-border)] rounded px-2.5 py-1.5 text-[12.5px] outline-none focus:border-[var(--color-accent)]"
            >
              <option value="__auto">Auto (Gemini classifier)</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name || a.id}</option>)}
            </select>
          </div>
          <div>
            <label class="block text-[10px] uppercase tracking-wider text-[var(--color-text-faint)] mb-1">Priority (0–10)</label>
            <input
              type="number"
              min={0}
              max={10}
              value={priority}
              onInput={(e) => setPriority(Math.max(0, Math.min(10, Number((e.target as HTMLInputElement).value) || 0)))}
              class="w-full bg-[var(--color-elevated)] border border-[var(--color-border)] rounded px-2.5 py-1.5 text-[12.5px] tabular-nums outline-none focus:border-[var(--color-accent)]"
            />
          </div>
        </div>
        {err && <div class="text-[var(--color-status-failed)] text-[11px]">{err}</div>}
      </div>
    </Modal>
  );
}

// ── History drawer ─────────────────────────────────────────────────

// Mounted fresh on every drawer open via the `historyOpen` guard in
// MissionControl. That means the fetch always retries on open — fixes
// the "drawer empty forever" symptom where a transient backend hiccup
// at first paint left the list permanently blank with no error visible.
function HistoryList() {
  const [items, setItems] = useState<MissionTask[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const PAGE = 20;

  useEffect(() => { void load(0, true); }, []);

  async function load(off: number, reset = false) {
    setLoading(true); setError(null);
    try {
      const data = await apiGet<{ tasks: MissionTask[]; total: number }>(`/api/mission/history?limit=${PAGE}&offset=${off}`);
      setTotal(data.total);
      setItems(reset ? data.tasks : [...items, ...data.tasks]);
      setOffset(off + data.tasks.length);
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally { setLoading(false); }
  }

  return (
    <div class="px-6 py-4">
      <div class="flex items-center gap-3 mb-3">
        <div class="text-[12px] text-[var(--color-text-muted)] tabular-nums">{total} historical tasks</div>
        {!loading && (
          <button
            type="button"
            onClick={() => load(0, true)}
            class="text-[11px] text-[var(--color-text-faint)] hover:text-[var(--color-text-muted)]"
          >
            ↻ Refresh
          </button>
        )}
      </div>
      {error && (
        <div class="bg-[var(--color-card)] border border-[var(--color-status-failed)] rounded p-3 mb-3">
          <div class="text-[12px] text-[var(--color-status-failed)] font-medium mb-1">Failed to load history</div>
          <div class="text-[11.5px] text-[var(--color-text-muted)] font-mono break-all">{error}</div>
          <button
            type="button"
            onClick={() => load(0, true)}
            class="mt-2 text-[11.5px] text-[var(--color-accent)] hover:underline"
          >
            Try again
          </button>
        </div>
      )}
      <div class="space-y-1.5">
        {items.map((t) => (
          <div key={t.id} class="bg-[var(--color-elevated)] border border-[var(--color-border)] rounded p-3">
            <div class="flex items-center gap-2 mb-1">
              <Pill tone={t.status as any}>{t.status}</Pill>
              <span class="text-[10.5px] text-[var(--color-text-faint)] tabular-nums uppercase tracking-wider">{t.id.slice(0, 6)}</span>
              {t.assigned_agent && <span class="text-[11px] text-[var(--color-text-muted)]">@{t.assigned_agent}</span>}
              <span class="ml-auto text-[10.5px] text-[var(--color-text-faint)]">
                {formatRelativeTime(t.completed_at || t.created_at)}
              </span>
            </div>
            <div class="text-[13px] text-[var(--color-text)] mb-1">{t.title}</div>
            {t.result && (
              <div class="text-[11.5px] text-[var(--color-text-muted)] whitespace-pre-wrap line-clamp-3 leading-relaxed">{t.result}</div>
            )}
            {t.error && (
              <div class="text-[11.5px] text-[var(--color-status-failed)] whitespace-pre-wrap line-clamp-2 font-mono">{t.error}</div>
            )}
          </div>
        ))}
      </div>
      {offset < total && (
        <button
          type="button"
          onClick={() => load(offset)}
          disabled={loading}
          class="w-full mt-3 px-3 py-2 rounded border border-[var(--color-border)] text-[12.5px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-elevated)] transition-colors disabled:opacity-40"
        >
          {loading ? 'Loading…' : `Load more (${total - offset} remaining)`}
        </button>
      )}
      {items.length === 0 && !loading && !error && (
        <div class="text-center text-[11.5px] text-[var(--color-text-faint)] py-12">No completed tasks yet</div>
      )}
    </div>
  );
}
