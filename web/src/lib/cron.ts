// ── Schedule builder model ──────────────────────────────────────────
// Subset of cron the visual picker can edit. Anything outside this
// (e.g. `*/15`, day-of-month, month) goes through the raw cron field.

export interface SchedTime { h: number; m: number }
export type SchedDays =
  | { kind: 'every' }
  | { kind: 'weekdays' }
  | { kind: 'weekends' }
  | { kind: 'custom'; dows: number[] }; // 0=Sun..6=Sat

export interface SchedModel { times: SchedTime[]; days: SchedDays }

function parseList(field: string, min: number, max: number): number[] | null {
  if (field === '*') {
    const out: number[] = [];
    for (let i = min; i <= max; i++) out.push(i);
    return out;
  }
  if (/^\*\/\d+$/.test(field)) return null; // step — picker can't represent
  const out: number[] = [];
  for (const part of field.split(',')) {
    const range = part.match(/^(\d+)-(\d+)$/);
    if (range) {
      const lo = parseInt(range[1], 10);
      const hi = parseInt(range[2], 10);
      if (isNaN(lo) || isNaN(hi) || lo < min || hi > max || lo > hi) return null;
      for (let i = lo; i <= hi; i++) out.push(i);
    } else {
      const v = parseInt(part, 10);
      if (isNaN(v) || v < min || v > max) return null;
      out.push(v);
    }
  }
  return out.length ? Array.from(new Set(out)).sort((a, b) => a - b) : null;
}

/**
 * Parse a cron expression into the visual model. Returns null when the
 * expression uses syntax the picker can't represent — caller should
 * fall back to the raw cron field.
 */
export function parseSchedule(cron: string): SchedModel | null {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [mField, hField, dom, mon, dowField] = parts;
  if (dom !== '*' || mon !== '*') return null;
  if (mField === '*') return null; // "every minute" — not a fixed time
  const minutes = parseList(mField, 0, 59);
  const hours = parseList(hField, 0, 23);
  if (!minutes || !hours) return null;
  const times: SchedTime[] = [];
  for (const h of hours) for (const m of minutes) times.push({ h, m });

  let days: SchedDays;
  if (dowField === '*') days = { kind: 'every' };
  else if (dowField === '1-5') days = { kind: 'weekdays' };
  else if (dowField === '0,6' || dowField === '6,0') days = { kind: 'weekends' };
  else {
    const dows = parseList(dowField, 0, 7);
    if (!dows) return null;
    const norm = Array.from(new Set(dows.map((d) => (d === 7 ? 0 : d)))).sort((a, b) => a - b);
    if (norm.length === 7) days = { kind: 'every' };
    else if (norm.length === 5 && norm.join(',') === '1,2,3,4,5') days = { kind: 'weekdays' };
    else if (norm.length === 2 && norm.join(',') === '0,6') days = { kind: 'weekends' };
    else days = { kind: 'custom', dows: norm };
  }
  return { times, days };
}

/**
 * Render the model back into a cron expression. May emit a warning if
 * the user mixed minutes and hours in a way that produces extra firing
 * times (cron generates the cross product).
 */
export function buildSchedule(model: SchedModel): { cron: string; warning?: string } {
  const seen = new Set<string>();
  const times = model.times
    .filter((t) => {
      const k = `${t.h}:${t.m}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => (a.h * 60 + a.m) - (b.h * 60 + b.m));
  if (times.length === 0) return { cron: '0 9 * * *', warning: 'No times selected' };

  const minutes = Array.from(new Set(times.map((t) => t.m))).sort((a, b) => a - b);
  const hours = Array.from(new Set(times.map((t) => t.h))).sort((a, b) => a - b);

  let warning: string | undefined;
  if (minutes.length > 1 && hours.length > 1 && times.length !== minutes.length * hours.length) {
    const extra = minutes.length * hours.length - times.length;
    warning = `Cron will also fire at ${extra} extra combination${extra === 1 ? '' : 's'}. Switch to advanced cron for exact control.`;
  }

  const m = minutes.join(',');
  const h = hours.join(',');

  let dow = '*';
  switch (model.days.kind) {
    case 'every': dow = '*'; break;
    case 'weekdays': dow = '1-5'; break;
    case 'weekends': dow = '0,6'; break;
    case 'custom':
      if (model.days.dows.length === 0) {
        warning = (warning ? warning + ' ' : '') + 'No days selected, defaulting to every day.';
        dow = '*';
      } else dow = model.days.dows.join(',');
      break;
  }

  return { cron: `${m} ${h} * * ${dow}`, warning };
}

// Plain-English description of a 5-field cron expression. Covers the
// shapes ClaudeClaw users actually write: fixed times, comma-lists,
// step values, weekday ranges. Falls back to the raw cron string when
// it sees something it doesn't recognize so we never lie about
// behavior.

export interface CronDescription {
  ok: boolean;
  /** Human description ("Every day at 7:30 AM") or an error hint. */
  text: string;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatHour(h: number, m: number): string {
  const period = h < 12 || h === 24 ? 'AM' : 'PM';
  let hh = h % 12;
  if (hh === 0) hh = 12;
  if (m === 0) return `${hh} ${period}`;
  return `${hh}:${String(m).padStart(2, '0')} ${period}`;
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join('');
  if (items.length === 2) return items.join(' and ');
  return items.slice(0, -1).join(', ') + ', and ' + items[items.length - 1];
}

// Parse a cron field like "5", "5,10,15", "1-5", "*/4", "*". Returns
// the explicit list of values it represents, or null if the shape
// isn't supported.
function expandField(field: string, min: number, max: number): number[] | null {
  if (field === '*') {
    const out: number[] = [];
    for (let i = min; i <= max; i++) out.push(i);
    return out;
  }
  const stepMatch = field.match(/^\*\/(\d+)$/);
  if (stepMatch) {
    const step = parseInt(stepMatch[1], 10);
    if (!step) return null;
    const out: number[] = [];
    for (let i = min; i <= max; i += step) out.push(i);
    return out;
  }
  const out: number[] = [];
  for (const part of field.split(',')) {
    const range = part.match(/^(\d+)-(\d+)$/);
    if (range) {
      const lo = parseInt(range[1], 10);
      const hi = parseInt(range[2], 10);
      if (isNaN(lo) || isNaN(hi) || lo < min || hi > max || lo > hi) return null;
      for (let i = lo; i <= hi; i++) out.push(i);
      continue;
    }
    const single = parseInt(part, 10);
    if (isNaN(single) || single < min || single > max) return null;
    out.push(single);
  }
  return out.length ? out.sort((a, b) => a - b) : null;
}

function isAllValues(values: number[], min: number, max: number): boolean {
  if (values.length !== max - min + 1) return false;
  return values.every((v, i) => v === min + i);
}

function describeWeekdays(dow: number[]): string {
  // Normalize Sunday=0 and Sunday=7 to a single representation.
  const normalized = Array.from(new Set(dow.map((d) => (d === 7 ? 0 : d)))).sort((a, b) => a - b);
  if (normalized.length === 7) return ''; // every day
  if (normalized.length === 5 && normalized.join(',') === '1,2,3,4,5') return 'on weekdays';
  if (normalized.length === 2 && normalized.join(',') === '0,6') return 'on weekends';
  if (normalized.length === 1) return `on ${DAY_NAMES[normalized[0]]}s`;
  return 'on ' + joinList(normalized.map((d) => DAY_SHORT[d]));
}

export function describeCron(cron: string): CronDescription {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) {
    return { ok: false, text: 'Cron must be 5 fields: minute hour day-of-month month day-of-week' };
  }
  const [mField, hField, domField, monField, dowField] = parts;
  const mins = expandField(mField, 0, 59);
  const hours = expandField(hField, 0, 23);
  const doms = expandField(domField, 1, 31);
  const months = expandField(monField, 1, 12);
  const dows = expandField(dowField, 0, 7);
  if (!mins || !hours || !doms || !months || !dows) {
    return { ok: false, text: 'Unsupported cron syntax — try a simpler form like "0 9 * * *"' };
  }

  const everyDom = isAllValues(doms, 1, 31);
  const everyMonth = isAllValues(months, 1, 12);
  const everyDow = dows.length === 7 || (dows.length === 8 && dows.includes(0) && dows.includes(7));

  // "Every N minutes" / "Every minute"
  if (mField.startsWith('*/') && hField === '*' && everyDom && everyMonth && everyDow) {
    const step = parseInt(mField.slice(2), 10);
    return { ok: true, text: step === 1 ? 'Every minute' : `Every ${step} minutes` };
  }
  if (mField === '*' && hField === '*' && everyDom && everyMonth && everyDow) {
    return { ok: true, text: 'Every minute' };
  }

  // "Every N hours [at :MM]"
  if (hField.startsWith('*/') && everyDom && everyMonth && everyDow && mins.length === 1) {
    const step = parseInt(hField.slice(2), 10);
    const minute = mins[0];
    const at = minute === 0 ? '' : ` at :${String(minute).padStart(2, '0')}`;
    return { ok: true, text: step === 1 ? `Every hour${at}` : `Every ${step} hours${at}` };
  }

  // Fixed times: enumerate every (hour, minute) combination.
  if (mins.length === 1 || hours.length === 1) {
    const times: string[] = [];
    for (const h of hours) {
      for (const m of mins) {
        times.push(formatHour(h, m));
      }
    }
    const timeStr = joinList(times);
    let dayPart = '';
    if (!everyDow) {
      dayPart = describeWeekdays(dows);
    } else if (!everyDom) {
      dayPart = `on day ${joinList(doms.map(String))} of the month`;
    }
    if (!everyMonth) {
      dayPart += (dayPart ? ' ' : '') + `in ${joinList(months.map((m) => MONTH_NAMES[m - 1]))}`;
    }
    const prefix = dayPart ? '' : 'Every day ';
    const suffix = dayPart ? ` ${dayPart}` : '';
    const text = `${prefix}at ${timeStr}${suffix}`.trim();
    return { ok: true, text: text[0].toUpperCase() + text.slice(1) };
  }

  // Fall back to raw — multi-minute multi-hour combinations get noisy fast.
  return { ok: true, text: cron };
}
