import { useState, useEffect } from 'preact/hooks';
import { Plus, Power, RotateCcw, Trash2, Copy, Check, FileText, Lightbulb, RefreshCw } from 'lucide-preact';
import { Link } from 'wouter-preact';
import { PageHeader } from '@/components/PageHeader';
import { Pill, StatusDot } from '@/components/Pill';
import { PageState } from '@/components/PageState';
import { Modal } from '@/components/Modal';
import { ModelPicker } from '@/components/ModelPicker';
import { AgentAvatar } from '@/components/AgentAvatar';
import { AgentDetail } from '@/components/AgentDetail';
import { AgentSuggestionBadge, AgentSuggestionModal, useAgentSuggestions, type AgentSuggestion } from '@/components/AgentSuggestions';
import { useFetch } from '@/lib/useFetch';
import { useDebouncedValue } from '@/lib/useDebounce';
import { apiPost, apiPatch, apiDelete } from '@/lib/api';
import { formatCost } from '@/lib/format';
import { showCosts } from '@/lib/theme';
import { pushToast } from '@/lib/toasts';

interface Agent {
  id: string;
  name: string;
  description: string;
  model: string;
  running: boolean;
  todayTurns: number;
  todayCost: number;
}

interface Template { id: string; name: string; description: string; }

export function Agents() {
  const { data, loading, error, refresh } = useFetch<{ agents: Agent[] }>('/api/agents', 30_000);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [bulkModel, setBulkModel] = useState<string>('');
  const [detailAgent, setDetailAgent] = useState<Agent | null>(null);
  const [openedSuggestion, setOpenedSuggestion] = useState<AgentSuggestion | null>(null);
  const [suggestionPrefill, setSuggestionPrefill] = useState<AgentSuggestion | null>(null);
  const [refreshingSuggestions, setRefreshingSuggestions] = useState(false);
  const suggestionsFetch = useAgentSuggestions();
  const suggestions = suggestionsFetch.data?.suggestions ?? [];
  const agents = data?.agents ?? [];

  async function refreshSuggestions() {
    setRefreshingSuggestions(true);
    try {
      const res = await apiPost<{ inserted: number; skipped: number; reason?: string }>('/api/agents/suggestions/refresh');
      suggestionsFetch.refresh();
      if (res.reason) {
        pushToast({ tone: 'warn', title: 'Not enough activity yet', description: res.reason, durationMs: 6000 });
      } else if (res.inserted === 0) {
        pushToast({ tone: 'success', title: 'No new suggestions', description: 'Your agents look well-scoped.' });
      } else {
        pushToast({
          tone: 'success',
          title: `${res.inserted} suggestion${res.inserted === 1 ? '' : 's'}`,
          description: 'Look for the lightbulb icon on each agent card.',
        });
      }
    } catch (err: any) {
      pushToast({ tone: 'error', title: 'Refresh failed', description: err?.message || String(err), durationMs: 7000 });
    } finally { setRefreshingSuggestions(false); }
  }

  function actOnSuggestion(s: AgentSuggestion) {
    setOpenedSuggestion(null);
    setSuggestionPrefill(s);
    setWizardOpen(true);
  }

  async function setAllModels(model: string) {
    setPendingAction('bulk-model');
    try {
      const res = await apiPatch<{ ok: boolean; updated: string[]; restartRequired: string[] }>('/api/agents/model', { model });
      setBulkModel(model);
      const restartCount = res.restartRequired?.length || 0;
      if (restartCount > 0) {
        pushToast({
          tone: 'warn',
          title: `${restartCount} agent${restartCount === 1 ? '' : 's'} need restart`,
          description: 'Yaml updated, but running processes still use the old model: ' + res.restartRequired.join(', '),
          durationMs: 0,
          action: {
            label: 'Restart all',
            run: async () => {
              await Promise.all(res.restartRequired.map((id) => apiPost(`/api/agents/${id}/restart`).catch(() => null)));
              pushToast({ tone: 'success', title: 'Restarting agents', description: restartCount + ' processes bouncing.' });
              setTimeout(refresh, 3000);
            },
          },
        });
      } else {
        pushToast({ tone: 'success', title: 'Model set for all agents', description: 'Now running on ' + model });
      }
      refresh();
    } catch (err: any) {
      pushToast({ tone: 'error', title: 'Bulk model change failed', description: err?.message || String(err), durationMs: 6000 });
    } finally { setPendingAction(null); }
  }

  return (
    <div class="flex flex-col h-full">
      <PageHeader
        title="Agents"
        actions={
          <>
            <span class="text-[11px] text-[var(--color-text-muted)] tabular-nums mr-2">
              {agents.filter((a) => a.running).length} live · {agents.length} total
            </span>
            <ModelPicker
              size="md"
              value={bulkModel}
              onSelect={setAllModels}
              disabled={pendingAction === 'bulk-model'}
            />
            {suggestions.length > 0 ? (
              // Cached on mount via useAgentSuggestions — clicking is
              // INSTANT, not a scan. Opens the first suggestion's modal
              // directly. The refresh icon next to it is the only path
              // that triggers Haiku.
              <div class="inline-flex">
                <button
                  type="button"
                  onClick={() => setOpenedSuggestion(suggestions[0])}
                  title={`View ${suggestions.length} active suggestion${suggestions.length === 1 ? '' : 's'}`}
                  class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-l text-[12px] border border-r-0 transition-colors bg-[var(--color-accent-soft)] text-[var(--color-accent)] border-[var(--color-accent-soft)] hover:bg-[var(--color-accent)] hover:text-white"
                >
                  <Lightbulb size={13} />
                  {suggestions.length} suggestion{suggestions.length === 1 ? '' : 's'}
                </button>
                <button
                  type="button"
                  onClick={refreshSuggestions}
                  disabled={refreshingSuggestions}
                  title="Re-scan hive_mind for new suggestions (~30–90s)"
                  class="inline-flex items-center justify-center px-2 py-1.5 rounded-r text-[12px] border bg-[var(--color-accent-soft)] text-[var(--color-accent)] border-[var(--color-accent-soft)] hover:bg-[var(--color-accent)] hover:text-white disabled:opacity-40 transition-colors"
                >
                  <RefreshCw size={12} class={refreshingSuggestions ? 'animate-spin' : ''} />
                </button>
              </div>
            ) : (
              // No active suggestions — only path is the explicit scan.
              <button
                type="button"
                onClick={refreshSuggestions}
                disabled={refreshingSuggestions}
                title="Scan hive_mind for agents that should be split (~30–90s)"
                class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-elevated)] border border-[var(--color-border)] transition-colors disabled:opacity-40"
              >
                <Lightbulb size={13} />
                {refreshingSuggestions ? 'Scanning…' : 'Scan for suggestions'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors"
            >
              <Plus size={14} /> New Agent
            </button>
          </>
        }
      />

      {error && <PageState error={error} />}
      {loading && !data && <PageState loading />}
      {!loading && !error && agents.length === 0 && (
        <PageState empty emptyTitle="No agents configured" emptyDescription="Click New Agent to create your first one." />
      )}

      {agents.length > 0 && (
        <div class="flex-1 overflow-y-auto p-6">
          <div class="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
            {agents.map((a) => (
              <AgentCard
                key={a.id}
                agent={a}
                onChange={refresh}
                onOpen={() => setDetailAgent(a)}
                suggestions={suggestions}
                onOpenSuggestion={(s) => setOpenedSuggestion(s)}
              />
            ))}
          </div>
        </div>
      )}

      <CreateAgentWizard
        open={wizardOpen}
        onClose={() => { setWizardOpen(false); setSuggestionPrefill(null); }}
        onCreated={refresh}
        prefill={suggestionPrefill ? {
          id: suggestionPrefill.suggested_id,
          name: suggestionPrefill.suggested_name,
          description: suggestionPrefill.suggested_description,
        } : undefined}
      />
      <AgentDetail agent={detailAgent} onClose={() => setDetailAgent(null)} />
      <AgentSuggestionModal
        suggestion={openedSuggestion}
        onClose={() => setOpenedSuggestion(null)}
        onActed={actOnSuggestion}
        onChange={suggestionsFetch.refresh}
      />
    </div>
  );
}

function AgentCard({ agent, onChange, onOpen, suggestions, onOpenSuggestion }: {
  agent: Agent;
  onChange: () => void;
  onOpen: () => void;
  suggestions: AgentSuggestion[];
  onOpenSuggestion: (s: AgentSuggestion) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  async function run(action: 'restart' | 'stop' | 'start' | 'delete') {
    if (action === 'delete' && !confirm(`Delete agent "${agent.id}"? This unloads the service, removes its config, deletes its bot token from .env, and removes log files.`)) return;
    setBusy(action);
    try {
      if (action === 'restart') await apiPost(`/api/agents/${agent.id}/restart`);
      if (action === 'stop') await apiPost(`/api/agents/${agent.id}/deactivate`);
      if (action === 'start') await apiPost(`/api/agents/${agent.id}/activate`);
      if (action === 'delete') await apiDelete(`/api/agents/${agent.id}/full`);
      setTimeout(onChange, action === 'delete' ? 200 : 1500);
    } catch (err: any) {
      alert(action + ' failed: ' + (err?.message || err));
    } finally {
      setBusy(null);
    }
  }

  async function setModel(model: string) {
    setBusy('model');
    try {
      const res = await apiPatch<{ ok: boolean; restartRequired: boolean }>(`/api/agents/${agent.id}/model`, { model });
      if (res.restartRequired) {
        pushToast({
          tone: 'warn',
          title: agent.id + ' needs a restart',
          description: `Model is now ${model}, but the running process is still on the old one.`,
          durationMs: 0,
          action: {
            label: 'Restart now',
            run: async () => {
              await apiPost(`/api/agents/${agent.id}/restart`);
              pushToast({ tone: 'success', title: agent.id + ' restarting', description: 'Should be live again in a few seconds.' });
              setTimeout(onChange, 2500);
            },
          },
        });
      } else {
        pushToast({ tone: 'success', title: 'Model set to ' + model, description: 'Takes effect on the next message.' });
      }
      onChange();
    } catch (err: any) {
      pushToast({ tone: 'error', title: 'Model change failed', description: err?.message || String(err), durationMs: 6000 });
    } finally { setBusy(null); }
  }

  const isMain = agent.id === 'main';

  return (
    <div
      class="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg p-4 hover:border-[var(--color-border-strong)] transition-colors cursor-pointer"
      onClick={onOpen}
    >
      <div class="flex items-start gap-3 mb-3">
        <AgentAvatar agentId={agent.id} name={agent.name} running={agent.running} size={36} />
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5 mb-0.5">
            <StatusDot tone={agent.running ? 'done' : 'cancelled'} />
            <span class="text-[13px] font-medium text-[var(--color-text)] truncate">
              {agent.name || agent.id}
            </span>
            <AgentSuggestionBadge agentId={agent.id} suggestions={suggestions} onOpen={onOpenSuggestion} />
          </div>
          <div class="text-[10px] text-[var(--color-text-faint)] uppercase tracking-wider">
            {agent.id}
          </div>
        </div>
      </div>

      {agent.description && (
        <div class="text-[12px] text-[var(--color-text-muted)] leading-snug mb-3 line-clamp-2 min-h-[2.4em]">
          {agent.description}
        </div>
      )}

      <div class="flex items-center gap-2 mb-3 flex-wrap" onClick={(e) => e.stopPropagation()}>
        <ModelPicker value={agent.model} onSelect={setModel} disabled={busy === 'model'} />
        {agent.running ? <Pill tone="done">running</Pill> : <Pill tone="cancelled">offline</Pill>}
      </div>

      <div
        class={(showCosts.value ? 'grid grid-cols-2' : 'grid grid-cols-1') + ' gap-3 border-t border-[var(--color-border)] pt-2.5 mb-3'}
      >
        <div>
          <div class="text-[var(--color-text-faint)] text-[10px] uppercase tracking-wider mb-0.5">Today turns</div>
          <div class="text-[var(--color-text)] tabular-nums text-[12px]">{agent.todayTurns ?? 0}</div>
        </div>
        {showCosts.value && (
          <div class="text-right">
            <div class="text-[var(--color-text-faint)] text-[10px] uppercase tracking-wider mb-0.5">Today cost</div>
            <div class="text-[var(--color-text)] tabular-nums text-[12px]">{formatCost(agent.todayCost ?? 0)}</div>
          </div>
        )}
      </div>

      <div class="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        {agent.running ? (
          <button
            type="button"
            onClick={() => run('stop')}
            disabled={busy !== null || isMain}
            class="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[11px] bg-[var(--color-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-card)] border border-[var(--color-border)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title={isMain ? 'Main agent cannot be stopped from the dashboard' : 'Stop this agent'}
          >
            <Power size={11} /> {busy === 'stop' ? 'Stopping…' : 'Stop'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => run('start')}
            disabled={busy !== null || isMain}
            class="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[11px] bg-[var(--color-accent-soft)] text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-white border border-[var(--color-accent-soft)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Power size={11} /> {busy === 'start' ? 'Starting…' : 'Start'}
          </button>
        )}
        <Link
          href={`/agents/${agent.id}/files`}
          class="inline-flex items-center justify-center px-2 py-1.5 rounded text-[11px] bg-[var(--color-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] border border-[var(--color-border)] transition-colors"
          title="Edit persona + config"
        >
          <FileText size={11} />
        </Link>
        <button
          type="button"
          onClick={() => run('restart')}
          disabled={busy !== null || isMain}
          class="inline-flex items-center justify-center px-2 py-1.5 rounded text-[11px] bg-[var(--color-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] border border-[var(--color-border)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title="Restart"
        >
          <RotateCcw size={11} class={busy === 'restart' ? 'animate-spin' : ''} />
        </button>
        <button
          type="button"
          onClick={() => run('delete')}
          disabled={busy !== null || isMain}
          class="inline-flex items-center justify-center px-2 py-1.5 rounded text-[11px] bg-[var(--color-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-status-failed)] border border-[var(--color-border)] hover:border-[var(--color-status-failed)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title="Delete"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}

// ── Wizard ───────────────────────────────────────────────────────────

interface CreateAgentWizardProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  /** Optional pre-fill from a suggestion ("spin off X" flow). When set,
   *  the wizard opens to step 1 with id/name/description already filled. */
  prefill?: { id: string; name: string; description: string };
}

function CreateAgentWizard({ open, onClose, onCreated, prefill }: CreateAgentWizardProps) {
  const [step, setStep] = useState(1);
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [model, setModel] = useState('claude-sonnet-4-6');
  const [template, setTemplate] = useState('');
  const [botToken, setBotToken] = useState('');
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [createdSummary, setCreatedSummary] = useState<{ envKey: string; agentDir: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedId = useDebouncedValue(id, 350);
  const debouncedToken = useDebouncedValue(botToken, 600);

  // Apply suggestion-driven prefill when the wizard opens with one.
  // We watch on open transition to avoid clobbering user edits if they
  // tweak the prefilled fields before clicking Next.
  useEffect(() => {
    if (open && prefill) {
      setId(prefill.id);
      setName(prefill.name);
      setNameTouched(true); // suppress the auto-generate-name effect
      setDescription(prefill.description);
    }
  }, [open, prefill?.id]);

  // Reset on close.
  function close() {
    setStep(1); setId(''); setName(''); setNameTouched(false); setDescription('');
    setModel('claude-sonnet-4-6'); setTemplate(''); setBotToken('');
    setCreatedId(null); setCreatedSummary(null); setError(null);
    onClose();
  }

  // Live ID validation.
  const idCheck = useFetch<{ ok: boolean; error?: string }>(
    debouncedId ? `/api/agents/validate-id?id=${encodeURIComponent(debouncedId)}` : null
  );

  // Live token validation.
  const [tokenStatus, setTokenStatus] = useState<{ ok?: boolean; error?: string; username?: string } | null>(null);
  useEffect(() => {
    if (!debouncedToken || !debouncedToken.includes(':')) { setTokenStatus(null); return; }
    let cancelled = false;
    apiPost<{ ok: boolean; error?: string; botInfo?: { username?: string } }>('/api/agents/validate-token', { token: debouncedToken })
      .then((r) => { if (!cancelled) setTokenStatus({ ok: r.ok, error: r.error, username: r.botInfo?.username }); })
      .catch((e) => { if (!cancelled) setTokenStatus({ ok: false, error: e?.message || String(e) }); });
    return () => { cancelled = true; };
  }, [debouncedToken]);

  // Templates list.
  const templates = useFetch<{ templates: Template[] }>('/api/agents/templates');

  // Sync auto name from id when user hasn't edited name.
  if (!nameTouched && id && !name) {
    const auto = id.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    if (name !== auto) setTimeout(() => setName(auto), 0);
  }

  const idValid = !!debouncedId && idCheck.data?.ok === true;
  const tokenValid = tokenStatus?.ok === true;
  const suggestedBotName = `ClaudeClaw ${name || 'Agent'}`;
  const suggestedBotUsername = `claudeclaw_${id || 'agent'}_bot`;

  async function create() {
    setCreating(true); setError(null);
    try {
      const res = await apiPost<any>('/api/agents/create', {
        id, name, description, model, template, botToken,
      });
      setCreatedId(res.agentId);
      setCreatedSummary({ envKey: res.envKey, agentDir: res.agentDir });
      setStep(3);
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally { setCreating(false); }
  }

  async function activate() {
    if (!createdId) return;
    setActivating(true); setError(null);
    try {
      const res = await apiPost<any>(`/api/agents/${createdId}/activate`);
      if (!res.ok) throw new Error(res.error || 'Activation failed');
      onCreated();
      setTimeout(close, 800);
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally { setActivating(false); }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="New Agent"
      width={520}
      footer={
        <>
          {step === 1 && (
            <>
              <button type="button" onClick={close} class="px-3 py-1.5 rounded text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">Cancel</button>
              <button
                type="button"
                onClick={() => { if (idValid && name && description) setStep(2); }}
                disabled={!idValid || !name || !description}
                class="ml-auto px-3 py-1.5 rounded text-[12px] font-medium bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next: Bot token →
              </button>
            </>
          )}
          {step === 2 && (
            <>
              <button type="button" onClick={() => setStep(1)} class="px-3 py-1.5 rounded text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">← Back</button>
              <button
                type="button"
                onClick={create}
                disabled={!tokenValid || creating}
                class="ml-auto px-3 py-1.5 rounded text-[12px] font-medium bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {creating ? 'Creating…' : 'Create Agent'}
              </button>
            </>
          )}
          {step === 3 && (
            <>
              <button type="button" onClick={close} class="px-3 py-1.5 rounded text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">Done</button>
              <button
                type="button"
                onClick={activate}
                disabled={activating}
                class="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded text-[12px] font-medium bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-40"
              >
                <Power size={12} /> {activating ? 'Activating…' : 'Activate (start service)'}
              </button>
            </>
          )}
        </>
      }
    >
      <div class="flex items-center gap-2 mb-4 text-[10px] uppercase tracking-wider">
        {[1, 2, 3].map((n) => (
          <div key={n} class="flex items-center gap-2">
            <div
              class="w-5 h-5 rounded-full flex items-center justify-center font-semibold"
              style={{
                backgroundColor: step >= n ? 'var(--color-accent-soft)' : 'var(--color-elevated)',
                color: step >= n ? 'var(--color-accent)' : 'var(--color-text-faint)',
                fontSize: '10px',
              }}
            >
              {step > n ? '✓' : n}
            </div>
            <span class={step === n ? 'text-[var(--color-text)]' : 'text-[var(--color-text-faint)]'}>
              {n === 1 ? 'Basics' : n === 2 ? 'Bot token' : 'Activate'}
            </span>
            {n < 3 && <span class="text-[var(--color-border)]">·</span>}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div class="space-y-3">
          <Field label="Agent ID" hint="Lowercase letters, numbers, dash/underscore. 30 chars max.">
            <input
              type="text"
              value={id}
              onInput={(e) => setId((e.target as HTMLInputElement).value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
              placeholder="research"
              autoFocus
              class="w-full bg-[var(--color-elevated)] border border-[var(--color-border)] rounded px-2.5 py-1.5 text-[12.5px] text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
            />
            {debouncedId && idCheck.data && !idCheck.data.ok && (
              <div class="text-[var(--color-status-failed)] text-[11px] mt-1">{idCheck.data.error}</div>
            )}
            {debouncedId && idCheck.data?.ok && (
              <div class="text-[var(--color-status-done)] text-[11px] mt-1">✓ Available</div>
            )}
          </Field>

          <Field label="Display name">
            <input
              type="text"
              value={name}
              onInput={(e) => { setNameTouched(true); setName((e.target as HTMLInputElement).value); }}
              placeholder="Research"
              class="w-full bg-[var(--color-elevated)] border border-[var(--color-border)] rounded px-2.5 py-1.5 text-[12.5px] text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
            />
          </Field>

          <Field label="Description" hint="What this agent is responsible for. Used by Gemini auto-assign.">
            <textarea
              value={description}
              onInput={(e) => setDescription((e.target as HTMLTextAreaElement).value)}
              rows={3}
              placeholder="Deep web research, competitive intel, trend research"
              class="w-full bg-[var(--color-elevated)] border border-[var(--color-border)] rounded px-2.5 py-1.5 text-[12.5px] text-[var(--color-text)] outline-none focus:border-[var(--color-accent)] resize-none"
            />
          </Field>

          <div class="grid grid-cols-2 gap-3">
            <Field label="Model">
              <select
                value={model}
                onChange={(e) => setModel((e.target as HTMLSelectElement).value)}
                class="w-full bg-[var(--color-elevated)] border border-[var(--color-border)] rounded px-2.5 py-1.5 text-[12.5px] text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
              >
                <option value="claude-opus-4-6">Opus 4.6</option>
                <option value="claude-sonnet-4-6">Sonnet 4.6</option>
                <option value="claude-sonnet-4-5">Sonnet 4.5</option>
                <option value="claude-haiku-4-5">Haiku 4.5</option>
              </select>
            </Field>
            <Field label="Template">
              <select
                value={template}
                onChange={(e) => setTemplate((e.target as HTMLSelectElement).value)}
                class="w-full bg-[var(--color-elevated)] border border-[var(--color-border)] rounded px-2.5 py-1.5 text-[12.5px] text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
              >
                <option value="">Blank</option>
                {templates.data?.templates?.filter((t) => t.id !== '_template').map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </Field>
          </div>
        </div>
      )}

      {step === 2 && (
        <div class="space-y-3">
          <div class="bg-[var(--color-elevated)] border border-[var(--color-border)] rounded p-3 text-[12px] leading-relaxed">
            <div class="font-semibold text-[var(--color-text)] mb-2">Create the bot in Telegram</div>
            <ol class="list-decimal list-inside space-y-1 text-[var(--color-text-muted)]">
              <li>Open <span class="font-mono text-[var(--color-accent)]">@BotFather</span> in Telegram</li>
              <li>Send <span class="font-mono text-[var(--color-accent)]">/newbot</span></li>
              <li>
                Name it: <CopyButton text={suggestedBotName} />
              </li>
              <li>
                Username: <CopyButton text={suggestedBotUsername} />
              </li>
              <li>Copy the token BotFather returns</li>
              <li>
                Set a profile photo: send <span class="font-mono text-[var(--color-accent)]">/setuserpic</span> to BotFather, pick this bot, then upload an image. Skipping this is fine; the dashboard will fall back to initials.
              </li>
            </ol>
          </div>

          <Field label="Paste bot token">
            <input
              type="text"
              value={botToken}
              onInput={(e) => setBotToken((e.target as HTMLInputElement).value.trim())}
              placeholder="123456789:ABC..."
              class="w-full bg-[var(--color-elevated)] border border-[var(--color-border)] rounded px-2.5 py-1.5 text-[12.5px] font-mono text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
            />
            {tokenStatus?.error && (
              <div class="text-[var(--color-status-failed)] text-[11px] mt-1">{tokenStatus.error}</div>
            )}
            {tokenStatus?.ok && tokenStatus.username && (
              <div class="text-[var(--color-status-done)] text-[11px] mt-1">✓ Verified: @{tokenStatus.username}</div>
            )}
          </Field>

          {error && <div class="text-[var(--color-status-failed)] text-[11px]">{error}</div>}
        </div>
      )}

      {step === 3 && createdId && (
        <div class="space-y-3 text-[12.5px]">
          <div class="text-[var(--color-status-done)] text-[14px] font-medium">✓ Agent created</div>
          <div class="bg-[var(--color-elevated)] border border-[var(--color-border)] rounded p-3 space-y-1.5 font-mono text-[11px]">
            <div><span class="text-[var(--color-text-faint)]">id:</span> {createdId}</div>
            <div><span class="text-[var(--color-text-faint)]">env:</span> {createdSummary?.envKey}</div>
            <div><span class="text-[var(--color-text-faint)]">dir:</span> {createdSummary?.agentDir}</div>
          </div>
          <div class="text-[var(--color-text-muted)]">
            Click activate to install the launchd service and start the agent process. Once activated,
            send it a message in Telegram and you're live.
          </div>
          {error && <div class="text-[var(--color-status-failed)] text-[11px]">{error}</div>}
        </div>
      )}
    </Modal>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: any }) {
  return (
    <div>
      <label class="block text-[10px] uppercase tracking-wider text-[var(--color-text-faint)] mb-1">{label}</label>
      {children}
      {hint && <div class="text-[10.5px] text-[var(--color-text-faint)] mt-1">{hint}</div>}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async (e) => {
        e.preventDefault();
        try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
      }}
      class="inline-flex items-center gap-1 font-mono text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors"
    >
      <span>{text}</span>
      {copied ? <Check size={11} /> : <Copy size={11} />}
    </button>
  );
}

