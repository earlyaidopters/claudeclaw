import { useState } from 'preact/hooks';
import { Check, Pipette, RotateCcw } from 'lucide-preact';
import { PageHeader } from '@/components/PageHeader';
import { PageState } from '@/components/PageState';
import { Toggle } from '@/components/Toggle';
import { useFetch } from '@/lib/useFetch';
import { apiPost } from '@/lib/api';
import { pushToast } from '@/lib/toasts';
import {
  theme, themeMeta, setTheme, type ThemeName,
  customAccent, setCustomAccent,
  uiScale, setUiScale,
  showCosts, setShowCosts,
} from '@/lib/theme';
import {
  workspaceName,
  setWorkspaceName,
  hotkeyMod,
  setHotkeyMod,
  type HotkeyMod,
} from '@/lib/personalization';

interface Health {
  killSwitches: Record<string, boolean>;
  killSwitchRefusals: Record<string, number>;
  model: string;
  contextPct: number;
}

interface SecurityStatus { [key: string]: any; }

const KILL_SWITCH_LABELS: Record<string, { label: string; description: string }> = {
  WARROOM_TEXT_ENABLED: {
    label: 'Text War Room',
    description: 'Allow multi-agent text meetings via /api/warroom/text/*',
  },
  WARROOM_VOICE_ENABLED: {
    label: 'Voice War Room',
    description: 'Allow voice meetings via Pipecat',
  },
  LLM_SPAWN_ENABLED: {
    label: 'LLM spawn',
    description: 'Allow Claude SDK calls (master switch)',
  },
  DASHBOARD_MUTATIONS_ENABLED: {
    label: 'Dashboard mutations',
    description: 'Allow non-GET requests (set to false to lock dashboard read-only)',
  },
  MISSION_AUTO_ASSIGN_ENABLED: {
    label: 'Mission auto-assign',
    description: 'Allow Haiku/Gemini classifier on /api/mission/tasks/auto-assign',
  },
  SCHEDULER_ENABLED: {
    label: 'Scheduler',
    description: 'Allow scheduled cron tasks to fire',
  },
};

const THEME_ORDER: ThemeName[] = ['graphite', 'midnight', 'crimson'];

export function Settings() {
  const health = useFetch<Health>('/api/health', 30_000);
  const security = useFetch<SecurityStatus>('/api/security/status', 60_000);

  const error = health.error || security.error;

  return (
    <div class="flex flex-col h-full">
      <PageHeader title="Settings" />

      {error && <PageState error={error} />}
      {(health.loading || security.loading) && !health.data && <PageState loading />}

      {health.data && (
        <div class="flex-1 overflow-y-auto p-6 space-y-5 max-w-3xl">

          <Section
            title="Workspace"
            subtitle="Identity for this dashboard. Stored in the database so it shows up in any browser pointed at this server."
          >
            <Card>
              <Row label="Name" hint="Up to 32 characters. Empty resets to ClaudeClaw.">
                <WorkspaceNameField />
              </Row>
              <Divider />
              <Row label="Theme" hint="Switches CSS variables across the app.">
                <ThemePicker />
              </Row>
              <Divider />
              <Row label="Custom accent" hint="Override the theme's accent with any hex. Reset clears it.">
                <AccentPicker />
              </Row>
            </Card>
          </Section>

          <Section
            title="Display"
            subtitle="Per-browser display preferences. Stored in localStorage, not per-workspace."
          >
            <Card>
              <Row label="UI scale" hint="Zooms the whole app proportionally so layout stays correct.">
                <ScalePicker />
              </Row>
              <Divider />
              <Row label="Show costs" hint="Hide if you're on a Claude Code subscription — costs only matter on the API path.">
                <Toggle
                  on={showCosts.value}
                  onChange={() => setShowCosts(!showCosts.value)}
                  ariaLabel="Show costs"
                />
              </Row>
            </Card>
          </Section>

          <Section
            title="Keyboard"
            subtitle="Pick which modifier opens the command palette and quick-jump search."
          >
            <Card>
              <Row label="Search shortcut" hint="Auto matches your platform — pick a value to override.">
                <HotkeyPicker />
              </Row>
            </Card>
          </Section>

          <Section
            title="Kill switches"
            subtitle="Runtime feature gates. Toggling writes the flag to .env atomically; the runtime re-reads it within 1.5s so changes take effect without a restart."
          >
            <div class="space-y-2">
              {Object.entries(health.data.killSwitches).map(([key, on]) => {
                const meta = KILL_SWITCH_LABELS[key] || { label: key, description: '' };
                const refusals = health.data!.killSwitchRefusals[key] || 0;
                return (
                  <KillSwitchRow
                    key={key}
                    switchKey={key}
                    label={meta.label}
                    description={meta.description}
                    on={on}
                    refusals={refusals}
                    onChange={() => health.refresh()}
                  />
                );
              })}
            </div>
          </Section>

          <Section title="Read-only" subtitle="Settings that need an .env edit + restart to change.">
            <Card>
              <ReadOnlyRow label="Default model" value={health.data.model || '—'} />
              <Divider />
              <ReadOnlyRow label="Context window" value={health.data.contextPct + '%'} />
              <div class="text-[11px] text-[var(--color-text-faint)] pt-3 mt-1 border-t border-[var(--color-border)] leading-snug">
                To toggle a kill switch, edit <code class="font-mono text-[var(--color-text-muted)]">.env</code> and set the relevant flag to <code class="font-mono text-[var(--color-text-muted)]">true</code> or <code class="font-mono text-[var(--color-text-muted)]">false</code>. The change takes effect within 1.5 seconds without a process restart.
              </div>
            </Card>
          </Section>

          <Section title="Acknowledgements">
            <Card>
              <ReadOnlyRow label="3D brain model" value="Detailed Human Brain Model, NIH 3D 3DPX-021161, CC-BY" />
            </Card>
          </Section>

        </div>
      )}
    </div>
  );
}

// ── Workspace name field ──────────────────────────────────────────────

function WorkspaceNameField() {
  const [savedTick, setSavedTick] = useState(false);
  const value = workspaceName.value;
  function onInput(e: Event) {
    const next = (e.target as HTMLInputElement).value;
    setWorkspaceName(next);
    setSavedTick(true);
    // Brief checkmark cue. The signal updates instantly; the PATCH is
    // debounced 600ms inside personalization.ts.
    window.setTimeout(() => setSavedTick(false), 1500);
  }
  return (
    <div class="flex items-center gap-2">
      <input
        type="text"
        value={value}
        onInput={onInput}
        maxLength={32}
        placeholder="ClaudeClaw"
        class="bg-[var(--color-elevated)] border border-[var(--color-border)] rounded px-2.5 py-1.5 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-accent)] w-[200px]"
      />
      {savedTick && <Check size={14} class="text-[var(--color-status-done)] shrink-0" />}
    </div>
  );
}

// ── Theme picker ──────────────────────────────────────────────────────

function ThemePicker() {
  return (
    <div class="flex items-center gap-1.5">
      {THEME_ORDER.map((name) => {
        const active = theme.value === name;
        const meta = themeMeta[name];
        return (
          <button
            key={name}
            type="button"
            onClick={() => setTheme(name)}
            class={[
              'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12.5px] border transition-colors',
              active
                ? 'bg-[var(--color-accent-soft)] border-[var(--color-accent)] text-[var(--color-text)]'
                : 'bg-[var(--color-card)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)]',
            ].join(' ')}
          >
            <div
              class="w-3.5 h-3.5 rounded-sm shrink-0"
              style={{ background: meta.swatch, border: '1px solid var(--color-border)' }}
            />
            {meta.label}
            {active && <Check size={12} class="text-[var(--color-accent)]" />}
          </button>
        );
      })}
    </div>
  );
}

// ── Accent picker ─────────────────────────────────────────────────────

function AccentPicker() {
  const current = customAccent.value;
  const [draft, setDraft] = useState(current ?? '#');
  function commit(next: string) {
    if (/^#[0-9a-fA-F]{6}$/.test(next)) setCustomAccent(next);
  }
  return (
    <div class="flex items-center gap-2">
      <label
        class="relative inline-flex items-center justify-center w-8 h-8 rounded border border-[var(--color-border)] cursor-pointer overflow-hidden"
        style={{ backgroundColor: current || 'var(--color-elevated)' }}
        title="Pick a color"
      >
        <Pipette size={13} class={current ? 'text-white mix-blend-difference' : 'text-[var(--color-text-faint)]'} />
        <input
          type="color"
          value={current || '#8b8af0'}
          onInput={(e) => {
            const v = (e.target as HTMLInputElement).value.toLowerCase();
            setDraft(v); commit(v);
          }}
          class="absolute inset-0 opacity-0 cursor-pointer"
        />
      </label>
      <input
        type="text"
        value={draft}
        onInput={(e) => {
          const v = (e.target as HTMLInputElement).value;
          setDraft(v);
          if (/^#[0-9a-fA-F]{6}$/.test(v)) setCustomAccent(v);
        }}
        placeholder="#8b8af0"
        maxLength={7}
        class="bg-[var(--color-elevated)] border border-[var(--color-border)] rounded px-2.5 py-1.5 text-[12.5px] font-mono text-[var(--color-text)] outline-none focus:border-[var(--color-accent)] w-[110px]"
      />
      {current && (
        <button
          type="button"
          onClick={() => { setCustomAccent(null); setDraft('#'); }}
          class="inline-flex items-center gap-1 px-2 py-1.5 rounded text-[11.5px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-elevated)] border border-[var(--color-border)] transition-colors"
          title="Restore theme accent"
        >
          <RotateCcw size={11} /> Reset
        </button>
      )}
    </div>
  );
}

// ── UI scale picker ───────────────────────────────────────────────────

const SCALE_PRESETS: Array<{ value: number; label: string }> = [
  { value: 0.95, label: '95%' },
  { value: 1.00, label: '100%' },
  { value: 1.10, label: '110%' },
  { value: 1.25, label: '125%' },
  { value: 1.50, label: '150%' },
];

function ScalePicker() {
  const current = uiScale.value;
  return (
    <div class="flex flex-wrap items-center gap-1.5">
      {SCALE_PRESETS.map((p) => {
        const active = Math.abs(current - p.value) < 0.001;
        return (
          <button
            key={p.value}
            type="button"
            onClick={() => setUiScale(p.value)}
            class={[
              'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[12.5px] border transition-colors tabular-nums',
              active
                ? 'bg-[var(--color-accent-soft)] border-[var(--color-accent)] text-[var(--color-text)]'
                : 'bg-[var(--color-card)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)]',
            ].join(' ')}
          >
            {p.label}
            {active && <Check size={12} class="text-[var(--color-accent)]" />}
          </button>
        );
      })}
    </div>
  );
}

// ── Hotkey picker ─────────────────────────────────────────────────────

function HotkeyPicker() {
  const current = hotkeyMod.value;
  const opts: { v: HotkeyMod; label: string; hint: string }[] = [
    { v: 'auto', label: 'Auto', hint: '⌘ on Mac, Ctrl elsewhere' },
    { v: 'meta', label: '⌘ Cmd / Meta', hint: 'Mac standard' },
    { v: 'ctrl', label: 'Ctrl', hint: 'Windows / Linux standard' },
  ];
  return (
    <div class="flex flex-wrap items-center gap-1.5">
      {opts.map((o) => {
        const active = current === o.v;
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => setHotkeyMod(o.v)}
            class={[
              'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12.5px] border transition-colors',
              active
                ? 'bg-[var(--color-accent-soft)] border-[var(--color-accent)] text-[var(--color-text)]'
                : 'bg-[var(--color-card)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)]',
            ].join(' ')}
            title={o.hint}
          >
            {o.label}
            {active && <Check size={12} class="text-[var(--color-accent)]" />}
          </button>
        );
      })}
    </div>
  );
}

// ── Kill switch row ──────────────────────────────────────────────────

interface KillSwitchRowProps {
  switchKey: string;
  label: string;
  description: string;
  on: boolean;
  refusals: number;
  onChange: () => void;
}

function KillSwitchRow({ switchKey, label, description, on, refusals, onChange }: KillSwitchRowProps) {
  const [busy, setBusy] = useState(false);
  async function toggle() {
    const newValue = !on;
    if (!newValue && switchKey === 'DASHBOARD_MUTATIONS_ENABLED') {
      if (!confirm('Disabling dashboard mutations will lock this dashboard read-only. Every non-GET request will return 503 until you re-enable it (which means you cannot use this UI to turn it back on — you have to edit .env directly). Continue?')) {
        return;
      }
    }
    if (!newValue && switchKey === 'LLM_SPAWN_ENABLED') {
      if (!confirm('Disabling LLM_SPAWN_ENABLED will stop every Claude SDK call across all agents. Mission tasks, scheduled tasks, and agent replies will all stop firing. Continue?')) {
        return;
      }
    }
    setBusy(true);
    try {
      await apiPost('/api/security/kill-switch', { key: switchKey, enabled: newValue });
      pushToast({
        tone: newValue ? 'success' : 'warn',
        title: label + ' ' + (newValue ? 'enabled' : 'disabled'),
        description: 'Takes effect within 1.5s.',
      });
      // Wait a tick for the kill-switches re-read window so the next
      // refresh shows the new state.
      setTimeout(onChange, 1700);
    } catch (err: any) {
      pushToast({ tone: 'error', title: 'Toggle failed', description: err?.message || String(err), durationMs: 6000 });
    } finally { setBusy(false); }
  }
  return (
    <div class="flex items-start gap-3 bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg px-4 py-3.5">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-0.5">
          <span class="text-[13.5px] font-medium text-[var(--color-text)]">{label}</span>
          <code class="text-[10.5px] text-[var(--color-text-faint)] font-mono">{switchKey}</code>
        </div>
        <div class="text-[12px] text-[var(--color-text-muted)] leading-snug">{description}</div>
        {refusals > 0 && (
          <div class="text-[11px] text-[var(--color-status-failed)] mt-1 tabular-nums">
            {refusals} refusals since startup
          </div>
        )}
      </div>
      <Toggle on={on} onChange={toggle} disabled={busy} ariaLabel={label} />
    </div>
  );
}

// ── Layout primitives ─────────────────────────────────────────────────

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: any }) {
  return (
    <div>
      <div class="mb-2.5">
        <h2 class="text-[14px] font-semibold text-[var(--color-text)]">{title}</h2>
        {subtitle && <p class="text-[12px] text-[var(--color-text-muted)] leading-snug mt-1">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Card({ children }: { children: any }) {
  return (
    <div class="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg p-4 space-y-1">{children}</div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: any }) {
  return (
    <div class="flex items-center gap-4 py-1.5">
      <div class="flex-1 min-w-0">
        <div class="text-[13px] text-[var(--color-text)]">{label}</div>
        {hint && <div class="text-[11px] text-[var(--color-text-faint)] mt-0.5">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function Divider() {
  return <div class="border-t border-[var(--color-border)] my-1" />;
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div class="flex items-center justify-between py-1.5">
      <span class="text-[13px] text-[var(--color-text-muted)]">{label}</span>
      <span class="font-mono text-[12.5px] text-[var(--color-text)] tabular-nums">{value}</span>
    </div>
  );
}
