import { useEffect, useMemo, useState } from 'preact/hooks';
import { Plus, X, Sliders } from 'lucide-preact';
import {
  describeCron,
  parseSchedule,
  buildSchedule,
  type SchedModel,
  type SchedTime,
  type SchedDays,
} from '@/lib/cron';

// Visual schedule editor for the common case: a list of times of day
// plus a day-of-week chooser. Anything cron can express but the picker
// can't (steps, day-of-month, month) is reachable via "Advanced (cron)".
//
// Emits a cron expression to `onChange` whenever the underlying model
// changes. The parent component's source of truth is still the cron
// string — this is purely a more usable surface on top of it.

interface Props {
  cron: string;
  onChange: (cron: string) => void;
  /** Validation message from the parent (server-side cron error). */
  externalError?: string | null;
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_TITLES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function timeToInputValue(t: SchedTime): string {
  return `${String(t.h).padStart(2, '0')}:${String(t.m).padStart(2, '0')}`;
}

function inputValueToTime(v: string): SchedTime | null {
  const m = v.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return { h, m: min };
}

export function ScheduleBuilder({ cron, onChange, externalError }: Props) {
  const initial = useMemo(() => parseSchedule(cron), []);
  const [model, setModel] = useState<SchedModel | null>(initial);
  const [advanced, setAdvanced] = useState<boolean>(initial === null);
  const [rawCron, setRawCron] = useState(cron);

  // When the parent cron changes from outside (preset chips), re-sync.
  useEffect(() => {
    if (cron !== rawCron) {
      setRawCron(cron);
      const parsed = parseSchedule(cron);
      if (parsed) {
        setModel(parsed);
        setAdvanced(false);
      } else {
        setModel(null);
        setAdvanced(true);
      }
    }
  }, [cron]);

  function pushModel(next: SchedModel) {
    setModel(next);
    const { cron: built } = buildSchedule(next);
    setRawCron(built);
    onChange(built);
  }

  function pushRaw(next: string) {
    setRawCron(next);
    onChange(next);
    const parsed = parseSchedule(next);
    if (parsed) setModel(parsed);
  }

  const built = model ? buildSchedule(model) : { cron: rawCron, warning: undefined };
  const preview = describeCron(rawCron);

  if (advanced) {
    return (
      <div>
        <input
          value={rawCron}
          onInput={(e) => pushRaw((e.target as HTMLInputElement).value)}
          spellcheck={false}
          class="w-full px-3 py-2 rounded bg-[var(--color-bg)] border border-[var(--color-border)] focus:border-[var(--color-accent)] focus:outline-none text-[12.5px] text-[var(--color-text)] font-mono"
        />
        <div class="mt-1.5 flex items-center justify-between gap-2">
          <span class={'text-[11px] ' + (preview.ok && !externalError ? 'text-[var(--color-text-faint)]' : 'text-[var(--color-status-failed)]')}>
            {externalError || preview.text}
          </span>
          <button
            type="button"
            onClick={() => {
              const parsed = parseSchedule(rawCron);
              if (parsed) {
                setModel(parsed);
                setAdvanced(false);
              }
            }}
            disabled={!parseSchedule(rawCron)}
            class="text-[10.5px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] disabled:opacity-40 disabled:cursor-not-allowed"
            title="Switch back to the visual picker"
          >
            ← Visual picker
          </button>
        </div>
      </div>
    );
  }

  if (!model) return null;

  function setTimeAt(idx: number, value: string) {
    const t = inputValueToTime(value);
    if (!t) return;
    pushModel({ ...model!, times: model!.times.map((x, i) => (i === idx ? t : x)) });
  }

  function addTime() {
    const last = model!.times[model!.times.length - 1];
    const next: SchedTime = last ? { h: Math.min(23, last.h + 1), m: last.m } : { h: 9, m: 0 };
    pushModel({ ...model!, times: [...model!.times, next] });
  }

  function removeTime(idx: number) {
    if (model!.times.length === 1) return; // keep at least one time
    pushModel({ ...model!, times: model!.times.filter((_, i) => i !== idx) });
  }

  function setDays(days: SchedDays) {
    pushModel({ ...model!, days });
  }

  function toggleCustomDay(d: number) {
    const cur = model!.days.kind === 'custom' ? model!.days.dows : [];
    const next = cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort((a, b) => a - b);
    setDays({ kind: 'custom', dows: next });
  }

  const customDows = model.days.kind === 'custom' ? model.days.dows : [];

  return (
    <div class="space-y-3">
      <div>
        <div class="flex items-center justify-between mb-1.5">
          <span class="text-[10.5px] uppercase tracking-wider text-[var(--color-text-faint)]">
            Times of day
          </span>
          <button
            type="button"
            onClick={addTime}
            class="inline-flex items-center gap-1 text-[10.5px] text-[var(--color-text-muted)] hover:text-[var(--color-accent)]"
          >
            <Plus size={10} /> Add time
          </button>
        </div>
        <div class="flex flex-wrap gap-1.5">
          {model.times.map((t, idx) => (
            <div
              key={idx}
              class="inline-flex items-center bg-[var(--color-elevated)] border border-[var(--color-border)] rounded pl-1.5 pr-0.5"
            >
              <input
                type="time"
                value={timeToInputValue(t)}
                onInput={(e) => setTimeAt(idx, (e.target as HTMLInputElement).value)}
                class="bg-transparent text-[12px] text-[var(--color-text)] font-mono py-1 outline-none cursor-pointer"
                style={{ colorScheme: 'dark' }}
              />
              <button
                type="button"
                onClick={() => removeTime(idx)}
                disabled={model.times.length === 1}
                class="p-1 text-[var(--color-text-faint)] hover:text-[var(--color-status-failed)] disabled:opacity-30 disabled:cursor-not-allowed"
                title="Remove this time"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div class="text-[10.5px] uppercase tracking-wider text-[var(--color-text-faint)] mb-1.5">
          Days
        </div>
        <div class="inline-flex bg-[var(--color-elevated)] border border-[var(--color-border)] rounded p-0.5 mb-1.5">
          <DayKindButton active={model.days.kind === 'every'} label="Every day" onClick={() => setDays({ kind: 'every' })} />
          <DayKindButton active={model.days.kind === 'weekdays'} label="Weekdays" onClick={() => setDays({ kind: 'weekdays' })} />
          <DayKindButton active={model.days.kind === 'weekends'} label="Weekends" onClick={() => setDays({ kind: 'weekends' })} />
          <DayKindButton active={model.days.kind === 'custom'} label="Custom" onClick={() => setDays({ kind: 'custom', dows: customDows.length ? customDows : [1, 2, 3, 4, 5] })} />
        </div>
        {model.days.kind === 'custom' && (
          <div class="inline-flex gap-1">
            {DAY_LABELS.map((label, d) => {
              const on = customDows.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleCustomDay(d)}
                  title={DAY_TITLES[d]}
                  class={[
                    'w-7 h-7 rounded text-[11px] font-medium transition-colors',
                    on
                      ? 'bg-[var(--color-accent)] text-white'
                      : 'bg-[var(--color-elevated)] text-[var(--color-text-muted)] border border-[var(--color-border)] hover:text-[var(--color-text)]',
                  ].join(' ')}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div class="flex items-center justify-between gap-2 pt-1">
        <span class={'text-[11px] ' + (externalError ? 'text-[var(--color-status-failed)]' : 'text-[var(--color-text-faint)]')}>
          {externalError || (built.warning ? built.warning : preview.text)}
        </span>
        <button
          type="button"
          onClick={() => setAdvanced(true)}
          class="inline-flex items-center gap-1 text-[10.5px] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          title="Switch to raw cron syntax"
        >
          <Sliders size={10} /> Advanced (cron)
        </button>
      </div>
    </div>
  );
}

function DayKindButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      class={[
        'px-2.5 py-1 rounded text-[11.5px] transition-colors',
        active ? 'bg-[var(--color-accent)] text-white' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
      ].join(' ')}
    >
      {label}
    </button>
  );
}
