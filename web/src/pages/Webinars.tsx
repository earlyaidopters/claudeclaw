import { useMemo } from 'preact/hooks';
import { RefreshCw, Calendar, ExternalLink, Users, MapPin, CheckCircle2, MinusCircle, XCircle } from 'lucide-preact';
import { PageHeader } from '@/components/PageHeader';
import { PageState } from '@/components/PageState';
import { useFetch } from '@/lib/useFetch';
import { apiPost } from '@/lib/api';

interface Attendee {
  email: string;
  displayName: string | null;
  responseStatus: string | null;
  matchedBid: { entity: string; city: string | null; contact: string | null } | null;
  disposition: 'Endorsed' | 'Pending' | 'Pass' | null;
}
interface WebinarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  location: string | null;
  htmlLink: string | null;
  attendees: Attendee[];
  status: 'upcoming' | 'past';
  bidAttendeeCount: number;
}
interface WebinarsData { generatedAt: number; events: WebinarEvent[]; }

const TONE: Record<string, string> = { good: '#16a34a', warn: '#ca8a04', bad: '#dc2626', faint: 'var(--color-text-faint)' };

const fmtWhen = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

function DispositionPicker({ value, onChange }: { value: 'Endorsed' | 'Pending' | 'Pass' | null; onChange: (v: 'Endorsed' | 'Pending' | 'Pass' | null) => void }) {
  const btn = (v: 'Endorsed' | 'Pending' | 'Pass', tone: string, Icon: any) => (
    <button
      type="button"
      onClick={() => onChange(value === v ? null : v)}
      class={'inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-medium border ' + (value === v ? '' : 'opacity-50')}
      style={{ color: TONE[tone], borderColor: TONE[tone] }}
      title={v}
    >
      <Icon size={11} />{v}
    </button>
  );
  return (
    <div class="inline-flex items-center gap-1">
      {btn('Endorsed', 'good', CheckCircle2)}
      {btn('Pending', 'warn', MinusCircle)}
      {btn('Pass', 'bad', XCircle)}
    </div>
  );
}

export function Webinars() {
  const { data, loading, error, refresh } = useFetch<WebinarsData>('/api/webinars');

  const summary = useMemo(() => {
    if (!data) return null;
    const upcoming = data.events.filter(e => e.status === 'upcoming');
    const past = data.events.filter(e => e.status === 'past');
    const bidsBooked = new Set<string>();
    const bidsHeld = new Set<string>();
    let endorsed = 0, pending = 0, passed = 0;
    for (const e of data.events) {
      for (const a of e.attendees) {
        if (!a.matchedBid) continue;
        if (e.status === 'upcoming') bidsBooked.add(a.email);
        else bidsHeld.add(a.email);
        if (a.disposition === 'Endorsed') endorsed++;
        else if (a.disposition === 'Pending') pending++;
        else if (a.disposition === 'Pass') passed++;
      }
    }
    return { upcoming: upcoming.length, past: past.length, bidsBooked: bidsBooked.size, bidsHeld: bidsHeld.size, endorsed, pending, passed };
  }, [data]);

  async function setDisposition(eventId: string, email: string, disposition: 'Endorsed' | 'Pending' | 'Pass' | null) {
    await apiPost('/api/webinars/disposition', { eventId, email, disposition });
    refresh();
  }

  if (loading && !data) return <PageState>Loading webinars…</PageState>;
  if (error) return <PageState>Error: {String(error)}</PageState>;
  if (!data) return null;

  return (
    <div class="flex h-full flex-col">
      <PageHeader
        title="Webinars"
        subtitle="BID Discovery Webinars — bi-weekly conversion event"
        actions={<button type="button" onClick={() => refresh()} class="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-2.5 py-1 text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-elevated)]"><RefreshCw size={12} /> Refresh</button>}
      />

      {summary && (
        <div class="px-4 pt-3 pb-2 border-b border-[var(--color-border)] flex flex-wrap items-end gap-6">
          <div><div class="text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]">Upcoming</div><div class="text-[15px] font-semibold tabular-nums">{summary.upcoming}</div></div>
          <div><div class="text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]">Past</div><div class="text-[15px] font-semibold tabular-nums">{summary.past}</div></div>
          <div><div class="text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]">BIDs Booked</div><div class="text-[15px] font-semibold tabular-nums">{summary.bidsBooked}</div></div>
          <div><div class="text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]">BIDs Held</div><div class="text-[15px] font-semibold tabular-nums">{summary.bidsHeld}</div></div>
          <div><div class="text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]">Endorsed</div><div class="text-[15px] font-semibold tabular-nums" style={{ color: TONE.good }}>{summary.endorsed}</div></div>
          <div><div class="text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]">Pending</div><div class="text-[15px] font-semibold tabular-nums" style={{ color: TONE.warn }}>{summary.pending}</div></div>
          <div><div class="text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]">Passed</div><div class="text-[15px] font-semibold tabular-nums" style={{ color: TONE.bad }}>{summary.passed}</div></div>
        </div>
      )}

      <div class="flex-1 overflow-auto p-4 space-y-4">
        {data.events.length === 0 && (
          <PageState>
            No webinars found in the last 30 / next 60 days. Create a calendar event with "Webinar" in the title to populate this view.
          </PageState>
        )}
        {data.events.map(e => (
          <div key={e.id} class="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-3">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <Calendar size={14} class="text-[var(--color-text-faint)] shrink-0" />
                  <div class="text-[14px] font-semibold text-[var(--color-text)] truncate">{e.summary}</div>
                  <span
                    class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{
                      color: e.status === 'upcoming' ? TONE.good : TONE.faint,
                      background: e.status === 'upcoming'
                        ? `color-mix(in srgb, ${TONE.good} 14%, transparent)`
                        : 'var(--color-elevated)',
                    }}
                  >{e.status}</span>
                </div>
                <div class="mt-1 text-[11px] text-[var(--color-text-muted)] flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>{fmtWhen(e.start)}</span>
                  {e.location && <span class="inline-flex items-center gap-1"><MapPin size={10} />{e.location}</span>}
                  <span class="inline-flex items-center gap-1"><Users size={10} />{e.attendees.length} invited · {e.bidAttendeeCount} BID</span>
                  {e.htmlLink && (
                    <a href={e.htmlLink} target="_blank" rel="noreferrer" class="inline-flex items-center gap-1 hover:underline">
                      <ExternalLink size={10} />Open in Calendar
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Attendees */}
            {e.attendees.length > 0 && (
              <div class="mt-3 border-t border-[var(--color-border)] pt-3">
                <table class="w-full text-[11px]">
                  <thead>
                    <tr class="text-left text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]">
                      <th class="pb-1.5 pr-2">Attendee</th>
                      <th class="pb-1.5 pr-2">BID</th>
                      <th class="pb-1.5 pr-2">RSVP</th>
                      <th class="pb-1.5">Disposition</th>
                    </tr>
                  </thead>
                  <tbody>
                    {e.attendees.map(a => (
                      <tr key={a.email} class="border-t border-[var(--color-border)]/40">
                        <td class="py-1.5 pr-2">
                          <div class="text-[var(--color-text)]">{a.displayName || a.email}</div>
                          {a.displayName && <div class="text-[10px] text-[var(--color-text-faint)]">{a.email}</div>}
                        </td>
                        <td class="py-1.5 pr-2 text-[var(--color-text-muted)]">
                          {a.matchedBid ? (
                            <div>
                              <div>{a.matchedBid.entity}</div>
                              {a.matchedBid.city && <div class="text-[10px] text-[var(--color-text-faint)]">{a.matchedBid.city}</div>}
                            </div>
                          ) : '—'}
                        </td>
                        <td class="py-1.5 pr-2 text-[var(--color-text-muted)] capitalize">{a.responseStatus || '—'}</td>
                        <td class="py-1.5">
                          {a.matchedBid ? (
                            <DispositionPicker
                              value={a.disposition}
                              onChange={(v) => setDisposition(e.id, a.email, v)}
                            />
                          ) : <span class="text-[10px] text-[var(--color-text-faint)]">Not a BID contact</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>

      <div class="px-4 py-2 border-t border-[var(--color-border)] text-[10px] text-[var(--color-text-faint)]">
        Last refreshed {new Date(data.generatedAt).toLocaleTimeString()} · Events pulled from Google Calendar matching "webinar" / "BID Traffic". BID attendees auto-promote outreach status.
      </div>
    </div>
  );
}
