import { useState, useEffect } from 'preact/hooks';
import { lazy, Suspense } from 'preact/compat';
import { useLocation, useRoute } from 'wouter-preact';
import { Save, RotateCcw, ArrowLeft, AlertTriangle, RefreshCw, Power, History as HistoryIcon, Eye, Undo2 } from 'lucide-preact';
import { PageHeader, Tab } from '@/components/PageHeader';
import { PageState } from '@/components/PageState';
import { Drawer } from '@/components/Modal';
import { apiGet, apiPost, apiPut } from '@/lib/api';
import { pushToast } from '@/lib/toasts';
import { theme } from '@/lib/theme';
import { formatRelativeTime } from '@/lib/format';

// Monaco is ~400KB gzipped — lazy-load it so the dashboard's main bundle
// stays small. The editor page is rarely visited; users who never edit
// agent files never download Monaco.
const MonacoEditor = lazy(() => import('@monaco-editor/react').then((m) => ({ default: m.default })));

interface FilesResponse {
  agent_id: string;
  claude_md: string;
  agent_yaml: string;
  bot_token_redacted: boolean;
  // false for main (no agent.yaml) — UI hides the Config tab and the
  // Restart button. Backend rejects PUT /agent-yaml for main with 400.
  config_editable?: boolean;
  claude_md_path?: string;
}

type TabKey = 'persona' | 'config';

export function AgentFiles() {
  const [, params] = useRoute<{ id: string }>('/agents/:id/files');
  const [, navigate] = useLocation();
  const agentId = params?.id || '';
  const [tab, setTab] = useState<TabKey>('persona');
  const [files, setFiles] = useState<FilesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edited values, dirty flags, save state.
  const [personaDraft, setPersonaDraft] = useState('');
  const [configDraft, setConfigDraft] = useState('');
  const [personaDirty, setPersonaDirty] = useState(false);
  const [configDirty, setConfigDirty] = useState(false);
  const [saving, setSaving] = useState<TabKey | null>(null);
  const [restarting, setRestarting] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Load files once, then again whenever the agent id changes.
  useEffect(() => { void load(); }, [agentId]);

  // If we're on main and on the Config tab when files load, snap back
  // to Persona — main has no agent.yaml.
  useEffect(() => {
    if (files && files.config_editable === false && tab === 'config') {
      setTab('persona');
    }
  }, [files, tab]);

  async function load() {
    if (!agentId) return;
    setLoading(true); setError(null);
    try {
      const data = await apiGet<FilesResponse>(`/api/agents/${encodeURIComponent(agentId)}/files`);
      setFiles(data);
      setPersonaDraft(data.claude_md);
      setConfigDraft(data.agent_yaml);
      setPersonaDirty(false);
      setConfigDirty(false);
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally { setLoading(false); }
  }

  async function savePersona() {
    setSaving('persona');
    try {
      await apiPut(`/api/agents/${encodeURIComponent(agentId)}/files/claudemd`, { content: personaDraft });
      pushToast({ tone: 'success', title: 'Persona saved', description: 'Takes effect on the next message.' });
      setPersonaDirty(false);
      void load();
    } catch (err: any) {
      pushToast({ tone: 'error', title: 'Save failed', description: extractError(err), durationMs: 7000 });
    } finally { setSaving(null); }
  }

  async function saveConfig() {
    setSaving('config');
    try {
      await apiPut(`/api/agents/${encodeURIComponent(agentId)}/files/agent-yaml`, { content: configDraft });
      pushToast({
        tone: 'warn',
        title: 'Config saved',
        description: 'Restart agent to apply.',
        durationMs: 8000,
      });
      setConfigDirty(false);
      void load();
    } catch (err: any) {
      pushToast({ tone: 'error', title: 'Save failed', description: extractError(err), durationMs: 7000 });
    } finally { setSaving(null); }
  }

  function extractError(err: any): string {
    // ApiError surfaces the body — pull a server-side error message
    // when present so YAML validation feedback reaches the toast.
    const body = err?.body;
    if (body && typeof body === 'object' && typeof body.error === 'string') return body.error;
    return err?.message || String(err);
  }

  async function restart() {
    if (!confirm(`Restart agent "${agentId}"? This will interrupt any in-flight tasks and reload its config.`)) return;
    setRestarting(true);
    try {
      await apiPost(`/api/agents/${encodeURIComponent(agentId)}/restart`);
      pushToast({ tone: 'success', title: 'Restarting', description: 'Agent will be back in ~5s.' });
    } catch (err: any) {
      pushToast({ tone: 'error', title: 'Restart failed', description: err?.message || String(err), durationMs: 7000 });
    } finally {
      setTimeout(() => setRestarting(false), 5000);
    }
  }

  function reset(which: TabKey) {
    if (!files) return;
    if (which === 'persona') { setPersonaDraft(files.claude_md); setPersonaDirty(false); }
    else { setConfigDraft(files.agent_yaml); setConfigDirty(false); }
  }

  const dirty = tab === 'persona' ? personaDirty : configDirty;
  const draft = tab === 'persona' ? personaDraft : configDraft;
  const language = tab === 'persona' ? 'markdown' : 'yaml';
  const monacoTheme = monacoThemeFor(theme.value);

  return (
    <div class="flex flex-col h-full">
      <PageHeader
        title={`Agent files · ${agentId}`}
        breadcrumb="Agents"
        tabs={
          <>
            <button
              type="button"
              onClick={() => navigate('/agents')}
              class="text-[12px] text-[var(--color-text-faint)] hover:text-[var(--color-text-muted)] mr-3 inline-flex items-center gap-1"
            >
              <ArrowLeft size={12} /> Back
            </button>
            <Tab label="Persona (CLAUDE.md)" active={tab === 'persona'} onClick={() => setTab('persona')} />
            {files?.config_editable !== false && (
              <Tab label="Config (agent.yaml)" active={tab === 'config'} onClick={() => setTab('config')} />
            )}
          </>
        }
        actions={
          <>
            {tab === 'config' && files?.bot_token_redacted && (
              <span class="text-[10.5px] text-[var(--color-text-muted)] inline-flex items-center gap-1 mr-1">
                <AlertTriangle size={11} class="text-[var(--color-status-failed)]" />
                bot_token redacted
              </span>
            )}
            <span class={'text-[11.5px] tabular-nums mr-1 ' + (dirty ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-faint)]')}>
              {dirty ? '● modified' : 'saved'}
            </span>
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-elevated)] border border-[var(--color-border)] transition-colors"
              title="View prior versions of this file (stored in SQLite)"
            >
              <HistoryIcon size={12} /> History
            </button>
            <button
              type="button"
              onClick={() => reset(tab)}
              disabled={!dirty || saving !== null}
              class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-elevated)] border border-[var(--color-border)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RotateCcw size={12} /> Reset
            </button>
            <button
              type="button"
              onClick={tab === 'persona' ? savePersona : saveConfig}
              disabled={!dirty || saving !== null}
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-medium bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Save size={13} /> {saving === tab ? 'Saving…' : 'Save'}
            </button>
            {tab === 'config' && files?.config_editable !== false && (
              <button
                type="button"
                onClick={restart}
                disabled={restarting || saving !== null}
                class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[12px] bg-[var(--color-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] border border-[var(--color-border)] transition-colors disabled:opacity-40"
                title="Restart this agent — required for agent.yaml changes to apply"
              >
                {restarting ? <RefreshCw size={12} class="animate-spin" /> : <Power size={12} />}
                {restarting ? 'Restarting…' : 'Restart agent'}
              </button>
            )}
          </>
        }
      />

      {error && <PageState error={error} />}
      {loading && <PageState loading />}

      {files && (
        <>
          <div class="px-6 py-2 border-b border-[var(--color-border)] text-[11.5px] text-[var(--color-text-muted)] leading-snug">
            {tab === 'persona' ? (
              <>
                <strong class="text-[var(--color-text)]">CLAUDE.md</strong> is the agent's persona/instructions. The Agent SDK re-reads it from disk on every turn, so saves take effect on the next message — no restart needed.
              </>
            ) : (
              <>
                <strong class="text-[var(--color-text)]">agent.yaml</strong> is editable. Edit any field, hit Save, then Restart agent for changes to apply. Only the <code class="font-mono text-[var(--color-text-faint)]">bot_token</code> line is masked as <code class="font-mono text-[var(--color-text-faint)]">***REDACTED***</code> for safety; if you don't touch that line, your real token is preserved on save.
              </>
            )}
          </div>
          <div class="flex-1 min-h-0">
            <Suspense fallback={<div class="p-6 text-[var(--color-text-faint)] text-[12px]">Loading editor…</div>}>
              <MonacoEditor
                key={`${agentId}-${tab}`}
                height="100%"
                language={language}
                value={draft}
                theme={monacoTheme}
                options={{
                  // Explicit so a Monaco internal default flip never makes
                  // this editor inadvertently read-only again. Earlier
                  // builds shipped a regression where the YAML tab loaded
                  // text but the keystrokes did nothing — pinning the flag
                  // here is the cheapest fix.
                  readOnly: false,
                  minimap: { enabled: false },
                  fontSize: 13.5,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
                  lineNumbers: 'on',
                  wordWrap: tab === 'persona' ? 'on' : 'off',
                  scrollBeyondLastLine: false,
                  tabSize: 2,
                  padding: { top: 12, bottom: 12 },
                  automaticLayout: true,
                  domReadOnly: false,
                }}
                onChange={(v) => {
                  const next = v ?? '';
                  if (tab === 'persona') {
                    setPersonaDraft(next);
                    setPersonaDirty(next !== files.claude_md);
                  } else {
                    setConfigDraft(next);
                    setConfigDirty(next !== files.agent_yaml);
                  }
                }}
              />
            </Suspense>
          </div>
        </>
      )}

      <Drawer open={historyOpen} onClose={() => setHistoryOpen(false)} title={`History · ${agentId} · ${tab === 'persona' ? 'CLAUDE.md' : 'agent.yaml'}`}>
        {/* Remount on each open so the version list is fresh — and so a
            previous error doesn't leave the drawer stuck on stale data. */}
        {historyOpen && (
          <FileHistoryList
            agentId={agentId}
            kind={tab === 'persona' ? 'claudemd' : 'agent-yaml'}
            onRestored={() => { setHistoryOpen(false); void load(); }}
          />
        )}
      </Drawer>
    </div>
  );
}

interface VersionRow {
  id: number;
  agent_id: string;
  file_kind: string;
  byte_size: number;
  sha256: string;
  author: string;
  created_at: number;
}

function FileHistoryList({
  agentId, kind, onRestored,
}: {
  agentId: string;
  kind: 'claudemd' | 'agent-yaml';
  onRestored: () => void;
}) {
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [previewContent, setPreviewContent] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<number | null>(null);

  useEffect(() => { void load(); }, [agentId, kind]);

  async function load() {
    setLoading(true); setError(null);
    try {
      const data = await apiGet<{ versions: VersionRow[] }>(
        `/api/agents/${encodeURIComponent(agentId)}/files/history?kind=${kind}&limit=100`,
      );
      setVersions(data.versions);
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally { setLoading(false); }
  }

  async function preview(id: number) {
    setPreviewId(id); setPreviewLoading(true); setPreviewContent('');
    try {
      const data = await apiGet<{ version: VersionRow & { content: string } }>(
        `/api/agents/${encodeURIComponent(agentId)}/files/history/${id}`,
      );
      setPreviewContent(data.version.content);
    } catch (err: any) {
      setPreviewContent('// Failed to load: ' + (err?.message || err));
    } finally { setPreviewLoading(false); }
  }

  async function restore(id: number) {
    if (!confirm('Restore this version? The current on-disk content will be saved as a new version first, so you can undo by restoring the snapshot that was just taken.')) return;
    setRestoringId(id);
    try {
      const res = await apiPost<{ ok: boolean; takes_effect: string }>(
        `/api/agents/${encodeURIComponent(agentId)}/files/history/${id}/restore`,
      );
      pushToast({
        tone: 'success',
        title: 'Version restored',
        description: res.takes_effect === 'next-turn' ? 'Takes effect on next message.' : 'Restart agent to apply.',
        durationMs: 6000,
      });
      onRestored();
    } catch (err: any) {
      pushToast({ tone: 'error', title: 'Restore failed', description: err?.message || String(err), durationMs: 7000 });
    } finally { setRestoringId(null); }
  }

  if (error) {
    return (
      <div class="px-6 py-4">
        <div class="bg-[var(--color-card)] border border-[var(--color-status-failed)] rounded p-3">
          <div class="text-[12px] text-[var(--color-status-failed)] font-medium mb-1">Failed to load history</div>
          <div class="text-[11.5px] text-[var(--color-text-muted)] font-mono break-all">{error}</div>
          <button type="button" onClick={() => load()} class="mt-2 text-[11.5px] text-[var(--color-accent)] hover:underline">Try again</button>
        </div>
      </div>
    );
  }
  if (loading) return <div class="px-6 py-8 text-[12px] text-[var(--color-text-faint)]">Loading…</div>;
  if (versions.length === 0) {
    return (
      <div class="px-6 py-12 text-center">
        <div class="text-[13px] text-[var(--color-text-muted)] mb-1">No prior versions yet</div>
        <div class="text-[11.5px] text-[var(--color-text-faint)]">Versions are saved automatically every time you Save the file.</div>
      </div>
    );
  }
  return (
    <div class="flex h-full">
      <div class="w-[360px] shrink-0 overflow-y-auto border-r border-[var(--color-border)]">
        <div class="px-4 py-2.5 text-[11px] uppercase tracking-wider text-[var(--color-text-faint)] border-b border-[var(--color-border)]">
          {versions.length} version{versions.length === 1 ? '' : 's'}
        </div>
        {versions.map((v) => {
          const active = previewId === v.id;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => void preview(v.id)}
              class={[
                'w-full text-left px-4 py-3 border-b border-[var(--color-border)] transition-colors',
                active ? 'bg-[var(--color-accent-soft)]' : 'hover:bg-[var(--color-elevated)]',
              ].join(' ')}
            >
              <div class="flex items-center gap-2 mb-1">
                <span class="text-[12.5px] text-[var(--color-text)] font-medium">{formatRelativeTime(v.created_at)}</span>
                <span class="ml-auto text-[10.5px] text-[var(--color-text-faint)] tabular-nums">v{v.id}</span>
              </div>
              <div class="flex items-center gap-2 text-[11px] text-[var(--color-text-muted)] tabular-nums">
                <span>{v.byte_size.toLocaleString()} bytes</span>
                <span class="text-[var(--color-text-faint)]">·</span>
                <span class="font-mono text-[10.5px]">{v.sha256.slice(0, 7)}</span>
                <span class="ml-auto text-[10.5px]">{v.author}</span>
              </div>
            </button>
          );
        })}
      </div>
      <div class="flex-1 min-w-0 flex flex-col">
        {previewId === null ? (
          <div class="flex-1 flex items-center justify-center text-[12px] text-[var(--color-text-faint)]">
            Pick a version to preview
          </div>
        ) : (
          <>
            <div class="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--color-border)]">
              <Eye size={13} class="text-[var(--color-text-muted)]" />
              <span class="text-[12.5px] text-[var(--color-text)]">Preview · v{previewId}</span>
              <button
                type="button"
                onClick={() => void restore(previewId)}
                disabled={restoringId !== null}
                class="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded text-[12px] font-medium bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-40 transition-colors"
              >
                <Undo2 size={12} /> {restoringId === previewId ? 'Restoring…' : 'Restore this version'}
              </button>
            </div>
            <div class="flex-1 min-h-0 overflow-auto">
              {previewLoading ? (
                <div class="p-4 text-[12px] text-[var(--color-text-faint)]">Loading…</div>
              ) : (
                <pre class="p-4 text-[12px] font-mono whitespace-pre-wrap text-[var(--color-text)] leading-relaxed">{previewContent}</pre>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Map our three workspace themes to Monaco's bundled palette. We could
// register a custom Monaco theme to match exactly, but vs-dark is close
// enough and avoids a per-theme JSON definition file.
function monacoThemeFor(name: string): string {
  switch (name) {
    case 'midnight': return 'vs-dark';
    case 'crimson': return 'vs-dark';
    default: return 'vs-dark';
  }
}
