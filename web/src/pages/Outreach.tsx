import { useState, useMemo } from 'preact/hooks';
import { RefreshCw, ExternalLink, Mail, Users, MapPin, Send, Eye, MessageSquareReply, Building2 } from 'lucide-preact';
import { PageHeader } from '@/components/PageHeader';
import { PageState } from '@/components/PageState';
import { useFetch } from '@/lib/useFetch';
import { apiPost } from '@/lib/api';

interface OutreachRow {
  email: string; entity: string; city: string | null; contact: string | null; website: string | null; members: number | null;
  status: string;
  lastSentAt: number | null; lastSentSubject: string | null;
  lastOpenedAt: number | null; lastRepliedAt: number | null;
  daysSinceLastTouch: number | null; nextAction: string;
}
interface OutreachData { generatedAt: number; rows: OutreachRow[]; statuses: string[]; }

const TONE: Record<string, string> = { good: '#16a34a', warn: '#ca8a04', bad: '#dc2626', faint: 'var(--color-text-faint)' };
const STATUS_TONE: Record<string, string> = {
  'not contacted': 'faint',
  emailed: 'warn',
  opened: 'warn',
  replied: 'good',
  'webinar booked': 'good',
  'webinar held': 'good',
  endorsed: 'good',
  declined: 'bad',
};

const fmtRel = (ts: number | null) => {
  if (!ts) return '—';
  const d = Math.floor((Date.now() - ts) / (24 * 3600 * 1000));
  if (d === 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

function StatusPill({ status }: { status: string }) {
  const tone = STATUS_TONE[(status || '').toLowerCase()] ?? 'faint';
  return (
    <span class="inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize"
      style={{ color: TONE[tone], background: `color-mix(in srgb, ${TONE[tone]} 14%, transparent)` }}>{status}</span>
  );
}

function StatusSelect({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <select
      class="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-1.5 py-1 text-[11px] text-[var(--color-text)]"
      value={value}
      onChange={(e) => onChange((e.target as HTMLSelectElement).value)}
    >
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function MetricBlock({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div class="flex flex-col">
      <div class="text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]">{label}</div>
      <div class="text-[15px] font-semibold tabular-nums" style={tone ? { color: TONE[tone] } : undefined}>{value}</div>
    </div>
  );
}

export function Outreach() {
  const { data, loading, error, refresh } = useFetch<OutreachData>('/api/outreach');
  const [filter, setFilter] = useState<string>('all');
  const [query, setQuery] = useState('');

  const summary = useMemo(() => {
    if (!data) return null;
    const buckets: Record<string, number> = {};
    let members = 0;
    for (const r of data.rows) {
      buckets[r.status] = (buckets[r.status] || 0) + 1;
      if (r.members) members += r.members;
    }
    return { total: data.rows.length, buckets, members };
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.toLowerCase().trim();
    return data.rows.filter(r => {
      if (filter !== 'all' && r.status !== filter) return false;
      if (q && !(r.entity?.toLowerCase().includes(q) || r.city?.toLowerCase().includes(q) || r.email?.toLowerCase().includes(q) || r.contact?.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [data, filter, query]);

  async function updateStatus(email: string, status: string) {
    await apiPost('/api/outreach/status', { email, status });
    refresh();
  }

  if (loading && !data) return <PageState>Loading outreach…</PageState>;
  if (error) return <PageState>Error: {String(error)}</PageState>;
  if (!data) return null;

  return (
    <div class="flex h-full flex-col">
      <PageHeader
        title="Outreach Tracker"
        subtitle="BID Traffic Partnership — North Carolina"
        actions={<button type="button" onClick={() => refresh()} class="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-2.5 py-1 text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-elevated)]"><RefreshCw size={12} /> Refresh</button>}
      />

      {/* Summary band */}
      {summary && (
        <div class="px-4 pt-3 pb-2 border-b border-[var(--color-border)] flex flex-wrap items-end gap-6">
          <MetricBlock label="BIDs" value={summary.total} />
          <MetricBlock label="Members behind them" value={summary.members.toLocaleString()} />
          <MetricBlock label="Not contacted" value={summary.buckets['Not contacted'] || 0} tone="faint" />
          <MetricBlock label="Emailed" value={summary.buckets['Emailed'] || 0} tone="warn" />
          <MetricBlock label="Replied" value={summary.buckets['Replied'] || 0} tone="good" />
          <MetricBlock label="Webinar Booked" value={summary.buckets['Webinar Booked'] || 0} tone="good" />
          <MetricBlock label="Endorsed" value={summary.buckets['Endorsed'] || 0} tone="good" />
          <MetricBlock label="Declined" value={summary.buckets['Declined'] || 0} tone="bad" />
        </div>
      )}

      {/* Filter bar */}
      <div class="px-4 py-2 border-b border-[var(--color-border)] flex flex-wrap items-center gap-2">
        <input
          class="flex-1 min-w-[200px] rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-[12px] text-[var(--color-text)]"
          placeholder="Filter by BID, city, contact, or email…"
          value={query}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
        />
        <select
          class="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-[12px] text-[var(--color-text)]"
          value={filter}
          onChange={(e) => setFilter((e.target as HTMLSelectElement).value)}
        >
          <option value="all">All statuses</option>
          {data.statuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Rows */}
      <div class="flex-1 overflow-auto">
        <table class="w-full text-[12px]">
          <thead class="sticky top-0 bg-[var(--color-bg)] border-b border-[var(--color-border)]">
            <tr class="text-left text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]">
              <th class="px-3 py-2">BID / Director</th>
              <th class="px-3 py-2">Contact</th>
              <th class="px-3 py-2 text-right">Members</th>
              <th class="px-3 py-2">Status</th>
              <th class="px-3 py-2">Sent</th>
              <th class="px-3 py-2">Opened</th>
              <th class="px-3 py-2">Replied</th>
              <th class="px-3 py-2">Next action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.email} class="border-b border-[var(--color-border)] hover:bg-[var(--color-elevated)]">
                <td class="px-3 py-2">
                  <div class="font-semibold text-[var(--color-text)]">{r.entity}</div>
                  <div class="mt-0.5 flex items-center gap-2 text-[10px] text-[var(--color-text-muted)]">
                    {r.city && <span class="inline-flex items-center gap-1"><MapPin size={10} />{r.city}</span>}
                    {r.contact && <span>· {r.contact}</span>}
                  </div>
                </td>
                <td class="px-3 py-2">
                  <a href={`mailto:${r.email}`} class="text-[var(--color-text)] hover:underline inline-flex items-center gap-1">
                    <Mail size={11} />{r.email}
                  </a>
                  {r.website && (
                    <div class="mt-0.5">
                      <a href={`https://${r.website}`} target="_blank" rel="noreferrer"
                         class="text-[10px] text-[var(--color-text-faint)] hover:underline inline-flex items-center gap-1">
                        <ExternalLink size={10} />{r.website}
                      </a>
                    </div>
                  )}
                </td>
                <td class="px-3 py-2 text-right tabular-nums text-[var(--color-text-muted)]">{r.members ?? '—'}</td>
                <td class="px-3 py-2">
                  <div class="flex items-center gap-2">
                    <StatusPill status={r.status} />
                    <StatusSelect value={r.status} options={data.statuses} onChange={(v) => updateStatus(r.email, v)} />
                  </div>
                </td>
                <td class="px-3 py-2 text-[var(--color-text-muted)]">
                  {r.lastSentAt ? (
                    <div>
                      <div class="inline-flex items-center gap-1"><Send size={10} />{fmtRel(r.lastSentAt)}</div>
                      {r.lastSentSubject && <div class="text-[10px] text-[var(--color-text-faint)] truncate max-w-[180px]" title={r.lastSentSubject}>{r.lastSentSubject}</div>}
                    </div>
                  ) : '—'}
                </td>
                <td class="px-3 py-2 text-[var(--color-text-muted)]">
                  {r.lastOpenedAt ? <span class="inline-flex items-center gap-1"><Eye size={10} />{fmtRel(r.lastOpenedAt)}</span> : '—'}
                </td>
                <td class="px-3 py-2 text-[var(--color-text-muted)]">
                  {r.lastRepliedAt ? <span class="inline-flex items-center gap-1" style={{ color: TONE.good }}><MessageSquareReply size={10} />{fmtRel(r.lastRepliedAt)}</span> : '—'}
                </td>
                <td class="px-3 py-2 text-[var(--color-text-muted)]">{r.nextAction}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colspan={8} class="px-3 py-8 text-center text-[var(--color-text-faint)]">No BIDs match this filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div class="px-4 py-2 border-t border-[var(--color-border)] text-[10px] text-[var(--color-text-faint)]">
        Last refreshed {new Date(data.generatedAt).toLocaleTimeString()} · Status auto-updates from Gmail watcher every 5 min · Manual override via dropdown.
      </div>
    </div>
  );
}
