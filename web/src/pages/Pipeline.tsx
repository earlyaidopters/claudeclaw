import { useState } from 'preact/hooks';
import { RefreshCw, ExternalLink, Users, Building2, Target, Wallet, TrendingUp, Trophy, Pencil, X, Calendar } from 'lucide-preact';
import { PageHeader, Tab } from '@/components/PageHeader';
import { PageState } from '@/components/PageState';
import { useFetch } from '@/lib/useFetch';
import { apiPost } from '@/lib/api';

interface DealCard {
  id: string; name: string; accountName: string | null; accountGroupId: string | null;
  value: number; weighted: number; probability: number | null; expectedCloseDate: string | null; stage: string;
}
interface AccountCard {
  id: string; accountGroupId: string | null; name: string; website: string | null;
  reviewScore: number | null; reviewCount: number | null; websiteGrade: string | null; listingsAccuracy: number | null;
  notes: string | null; outreachStatus: string; retailMRR: number | null; wholesaleMonthly: number | null; wholesaleLifetime: number | null; margin: number | null;
}
interface StageTotal { count: number; value: number; weighted: number; }
interface PipelineData {
  generatedAt: number;
  deals: { open: DealCard[]; won: DealCard[]; lost: DealCard[] };
  dealTotals: { open: StageTotal; won: StageTotal; lost: StageTotal };
  customers: AccountCard[];
  revenue: { ready: boolean; currency: string; totalRetailMRR: number | null; totalWholesaleMonthly: number | null; asOf: number | null };
  outreachStatuses: string[];
}

const TONE: Record<string, string> = { good: '#16a34a', warn: '#ca8a04', bad: '#dc2626', faint: 'var(--color-text-faint)' };
const gradeTone = (g: string | null) => !g ? 'faint' : (['A', 'B'].includes(g.trim().toUpperCase()[0]) ? 'good' : g.trim().toUpperCase()[0] === 'C' ? 'warn' : 'bad');
const pctTone = (p: number | null) => p == null ? 'faint' : p >= 0.8 ? 'good' : p >= 0.5 ? 'warn' : 'bad';
const reviewTone = (s: number | null) => s == null ? 'faint' : s >= 4.3 ? 'good' : s >= 3.5 ? 'warn' : 'bad';
const probTone = (p: number | null) => p == null ? 'faint' : p >= 0.6 ? 'good' : p >= 0.3 ? 'warn' : 'bad';
const fmtPct = (p: number | null) => p == null ? '—' : Math.round(p * 100) + '%';
const fmtReview = (s: number | null, n: number | null) => s == null ? 'no reviews' : `${s.toFixed(1)} (${n || 0})`;
const money = (cents: number | null) => cents == null ? '—' : '$' + (cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 });
const fmtDate = (d: string | null) => {
  if (!d) return null;
  const t = new Date(d); if (isNaN(t.getTime())) return null;
  return t.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
};
const inpCls = 'w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-[12px] text-[var(--color-text)]';

function Chip({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <span class="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium bg-[var(--color-elevated)]" style={{ color: TONE[tone] }}>
      <span class="text-[var(--color-text-faint)] font-normal">{label}</span>{value}
    </span>
  );
}

const STATUS_TONE: Record<string, string> = {
  'not contacted': 'faint',
  emailed: 'warn',
  opened: 'warn',
  replied: 'good',
  'webinar booked': 'good',
  'webinar held': 'good',
  endorsed: 'good',
  declined: 'bad',
  // legacy values (kept for backward compatibility with existing records)
  called: 'warn',
  'follow-up': 'warn',
  'meeting set': 'good',
};
function StatusPill({ status }: { status: string }) {
  const tone = STATUS_TONE[(status || '').toLowerCase()] ?? 'faint';
  return <span class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize" style={{ color: TONE[tone], background: `color-mix(in srgb, ${TONE[tone]} 14%, transparent)` }}>{status}</span>;
}

function RevenueRow({ c }: { c: AccountCard }) {
  if (c.retailMRR == null) return null;
  const mtone = c.margin == null ? 'faint' : c.margin > 0 ? 'good' : c.margin < 0 ? 'bad' : 'faint';
  return (
    <div class="mt-2 pt-2 border-t border-[var(--color-border)] flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
      <span class="font-semibold text-[var(--color-text)]">{money(c.retailMRR)}<span class="text-[var(--color-text-faint)] font-normal">/mo</span></span>
      <span class="text-[var(--color-text-faint)]">cost {money(c.wholesaleMonthly)}</span>
      <span class="font-medium" style={{ color: TONE[mtone] }}>{money(c.margin)} margin</span>
      <span class="text-[var(--color-text-faint)] ml-auto">LTV {money(c.wholesaleLifetime)}</span>
    </div>
  );
}

// ---- Deal card (Open / Won / Lost) — read-only from Vendasta opportunities ----
function DealCardView({ d }: { d: DealCard }) {
  return (
    <div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-3 hover:border-[var(--color-border-strong)] transition-colors">
      <div class="text-[13px] font-semibold text-[var(--color-text)] leading-snug">{d.name}</div>
      {d.accountName && (
        <div class="mt-0.5 flex items-center gap-1 text-[11px] text-[var(--color-text-muted)] truncate">
          <Building2 size={11} class="text-[var(--color-text-faint)] shrink-0" />{d.accountName}
        </div>
      )}
      <div class="mt-2 flex items-baseline gap-2">
        <span class="text-[15px] font-bold text-[var(--color-text)] tabular-nums">{money(d.value)}</span>
        {d.weighted > 0 && d.weighted !== d.value && (
          <span class="text-[11px] text-[var(--color-text-faint)] tabular-nums">{money(d.weighted)} weighted</span>
        )}
      </div>
      <div class="mt-2 flex flex-wrap items-center gap-1.5">
        {d.probability != null && (
          <span class="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium bg-[var(--color-elevated)]" style={{ color: TONE[probTone(d.probability)] }}>
            <span class="text-[var(--color-text-faint)] font-normal">P</span>{fmtPct(d.probability)}
          </span>
        )}
        {fmtDate(d.expectedCloseDate) && (
          <span class="inline-flex items-center gap-1 text-[10px] text-[var(--color-text-faint)]">
            <Calendar size={10} />{fmtDate(d.expectedCloseDate)}
          </span>
        )}
      </div>
    </div>
  );
}

// ---- Customer card (kept the way it was) ----
function CustomerCardView({ c, onEdit }: { c: AccountCard; onEdit: (c: AccountCard) => void }) {
  return (
    <div class="group rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-3 hover:border-[var(--color-border-strong)] transition-colors">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <div class="text-[13px] font-semibold text-[var(--color-text)] truncate">{c.name}</div>
          {c.website && (
            <a href={c.website} target="_blank" rel="noreferrer" class="inline-flex items-center gap-1 text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] truncate max-w-[180px]">
              {c.website.replace(/^https?:\/\//, '')}<ExternalLink size={10} />
            </a>
          )}
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <StatusPill status={c.outreachStatus} />
          <button type="button" onClick={() => onEdit(c)} title="Edit" class="opacity-0 group-hover:opacity-100 transition-opacity rounded p-1 text-[var(--color-text-faint)] hover:text-[var(--color-text)] hover:bg-[var(--color-elevated)]">
            <Pencil size={12} />
          </button>
        </div>
      </div>
      <div class="mt-2 flex flex-wrap gap-1">
        <Chip label="WEB" value={c.websiteGrade || '—'} tone={gradeTone(c.websiteGrade)} />
        <Chip label="LIST" value={fmtPct(c.listingsAccuracy)} tone={pctTone(c.listingsAccuracy)} />
        <Chip label="★" value={fmtReview(c.reviewScore, c.reviewCount)} tone={reviewTone(c.reviewScore)} />
      </div>
      <RevenueRow c={c} />
      {c.notes && <div class="mt-2 text-[11px] text-[var(--color-text-muted)] italic border-l-2 border-[var(--color-border-strong)] pl-2">{c.notes}</div>}
    </div>
  );
}

const COL_ACCENT: Record<string, string> = { Open: '#8b8af0', Won: '#16a34a', Lost: '#dc2626', Customer: '#0ea5e9' };
function Column({ name, count, total, children }: { name: string; count: number; total?: number | null; children: any }) {
  return (
    <div class="flex flex-col min-w-[300px] w-[320px] shrink-0">
      <div class="flex items-center gap-2 px-1 pb-2">
        <span class="h-2 w-2 rounded-full" style={{ background: COL_ACCENT[name] || 'var(--color-accent)' }} />
        <span class="text-[12px] font-semibold text-[var(--color-text)]">{name}</span>
        <span class="text-[11px] text-[var(--color-text-faint)] tabular-nums">{count}</span>
        {total != null && <span class="ml-auto text-[11px] font-medium text-[var(--color-text-muted)] tabular-nums">{money(total)}</span>}
      </div>
      <div class="flex flex-col gap-2 overflow-y-auto pr-1" style={{ maxHeight: 'calc(100vh - 230px)' }}>
        {count === 0 && <div class="rounded-lg border border-dashed border-[var(--color-border)] p-4 text-center text-[11px] text-[var(--color-text-faint)]">No records</div>}
        {children}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, accent }: { icon: any; label: string; value: string | number; sub?: string; accent?: string }) {
  const Icon = icon;
  return (
    <div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 flex items-center gap-3">
      <div class="rounded-lg p-2" style={{ background: 'var(--color-accent-soft)', color: accent || 'var(--color-accent)' }}><Icon size={16} /></div>
      <div>
        <div class="text-[20px] font-bold text-[var(--color-text)] tabular-nums leading-none">{value}</div>
        <div class="text-[11px] text-[var(--color-text-muted)] mt-1">{label}{sub && <span class="text-[var(--color-text-faint)]"> · {sub}</span>}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: any }) {
  return <label class="block"><span class="text-[11px] text-[var(--color-text-muted)] mb-1 block">{label}</span>{children}</label>;
}

function EditModal({ card, statuses, onClose, onSaved }: { card: AccountCard; statuses: string[]; onClose: () => void; onSaved: () => void }) {
  const [stage, setStage] = useState('');
  const [status, setStatus] = useState(card.outreachStatus);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [notes, setNotes] = useState(card.notes || '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    setSaving(true); setErr(null);
    const payload: any = { companyId: card.id, companyName: card.name, notes };
    if (stage) payload.stage = stage;
    if (status !== card.outreachStatus) payload.outreachStatus = status;
    if (contactName.trim()) payload.contactName = contactName.trim();
    if (contactEmail.trim()) payload.contactEmail = contactEmail.trim();
    try { await apiPost('/api/pipeline/card', payload); onSaved(); }
    catch (e: any) { setErr(e?.message || String(e)); setSaving(false); }
  };
  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div class="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5" onClick={(e) => e.stopPropagation()}>
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-[14px] font-semibold text-[var(--color-text)] truncate">Edit · {card.name}</h2>
          <button type="button" onClick={onClose} class="text-[var(--color-text-faint)] hover:text-[var(--color-text)]"><X size={16} /></button>
        </div>
        <div class="space-y-3">
          <Field label="Outreach status">
            <select value={status} onChange={(e: any) => setStatus(e.currentTarget.value)} class={inpCls}>
              {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Lifecycle stage (Vendasta)">
            <select value={stage} onChange={(e: any) => setStage(e.currentTarget.value)} class={inpCls}>
              <option value="">(unchanged)</option>
              <option>Lead</option><option>Prospect</option><option>Customer</option>
            </select>
          </Field>
          <Field label="Contact name"><input value={contactName} placeholder="add / update primary contact" onInput={(e: any) => setContactName(e.currentTarget.value)} class={inpCls} /></Field>
          <Field label="Contact email"><input value={contactEmail} placeholder="contact@company.com" onInput={(e: any) => setContactEmail(e.currentTarget.value)} class={inpCls} /></Field>
          <Field label="Notes (internal)"><textarea value={notes} onInput={(e: any) => setNotes(e.currentTarget.value)} rows={3} class={inpCls} /></Field>
          {err && <div class="text-[11px] text-[var(--color-status-failed)]">{err}</div>}
        </div>
        <div class="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} class="rounded-md px-3 py-1.5 text-[12px] text-[var(--color-text-muted)] hover:bg-[var(--color-elevated)]">Cancel</button>
          <button type="button" disabled={saving} onClick={save} class="rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

function Accounts({ rows, onEdit }: { rows: AccountCard[]; onEdit: (c: AccountCard) => void }) {
  const sorted = [...rows].sort((a, b) => (b.retailMRR || 0) - (a.retailMRR || 0));
  return (
    <div class="rounded-xl border border-[var(--color-border)] overflow-hidden">
      <table class="w-full text-[12px]">
        <thead>
          <tr class="bg-[var(--color-elevated)] text-[var(--color-text-muted)] text-left">
            <th class="px-4 py-2 font-medium">Account</th>
            <th class="px-4 py-2 font-medium">Status</th>
            <th class="px-4 py-2 font-medium text-right">MRR</th>
            <th class="px-4 py-2 font-medium text-right">Cost/mo</th>
            <th class="px-4 py-2 font-medium text-right">Margin/mo</th>
            <th class="px-4 py-2 font-medium text-right">Lifetime cost</th>
            <th class="px-4 py-2 font-medium">Reviews</th>
            <th class="px-4 py-2 font-medium">Web</th>
            <th class="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const mtone = r.margin == null ? 'faint' : r.margin > 0 ? 'good' : r.margin < 0 ? 'bad' : 'faint';
            return (
              <tr key={r.id} class="group border-t border-[var(--color-border)] hover:bg-[var(--color-card)]">
                <td class="px-4 py-2 text-[var(--color-text)] font-medium">{r.name}
                  {r.website && <a href={r.website} target="_blank" rel="noreferrer" class="ml-1 text-[var(--color-text-faint)] hover:text-[var(--color-accent)]"><ExternalLink size={10} class="inline" /></a>}</td>
                <td class="px-4 py-2"><StatusPill status={r.outreachStatus} /></td>
                <td class="px-4 py-2 text-right tabular-nums font-semibold text-[var(--color-text)]">{money(r.retailMRR)}</td>
                <td class="px-4 py-2 text-right tabular-nums text-[var(--color-text-muted)]">{money(r.wholesaleMonthly)}</td>
                <td class="px-4 py-2 text-right tabular-nums font-medium" style={{ color: TONE[mtone] }}>{money(r.margin)}</td>
                <td class="px-4 py-2 text-right tabular-nums text-[var(--color-text-muted)]">{money(r.wholesaleLifetime)}</td>
                <td class="px-4 py-2 tabular-nums" style={{ color: TONE[reviewTone(r.reviewScore)] }}>{fmtReview(r.reviewScore, r.reviewCount)}</td>
                <td class="px-4 py-2 font-medium" style={{ color: TONE[gradeTone(r.websiteGrade)] }}>{r.websiteGrade || '—'}</td>
                <td class="px-2 py-2"><button type="button" onClick={() => onEdit(r)} class="opacity-0 group-hover:opacity-100 rounded p-1 text-[var(--color-text-faint)] hover:text-[var(--color-text)]"><Pencil size={12} /></button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function Pipeline() {
  const { data, loading, error, refresh } = useFetch<PipelineData>('/api/pipeline', 120_000);
  const [view, setView] = useState<'pipeline' | 'accounts'>('pipeline');
  const [editing, setEditing] = useState<AccountCard | null>(null);

  const rev = data?.revenue;
  const totalMargin = rev && rev.totalRetailMRR != null && rev.totalWholesaleMonthly != null ? rev.totalRetailMRR - rev.totalWholesaleMonthly : null;
  const t = data?.dealTotals;

  return (
    <div class="flex flex-col h-full">
      <PageHeader
        title="Sales Pipeline" breadcrumb="Workspace"
        actions={<button type="button" onClick={refresh} class="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-2.5 py-1 text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-elevated)]"><RefreshCw size={12} /> Refresh</button>}
        tabs={<>
          <Tab label="Pipeline" active={view === 'pipeline'} count={t?.open.count} onClick={() => setView('pipeline')} />
          <Tab label="Accounts" active={view === 'accounts'} count={data?.customers.length} onClick={() => setView('accounts')} />
        </>}
      />
      <div class="flex-1 overflow-auto p-6">
        {(loading || error) && <PageState loading={loading} error={error} />}
        {data && !error && (
          <>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <StatCard icon={Target} label="Open pipeline" value={t ? money(t.open.value) : '—'} sub={t ? `${t.open.count} deals · ${money(t.open.weighted)} weighted` : undefined} accent="#8b8af0" />
              <StatCard icon={Trophy} label="Won" value={t ? money(t.won.value) : '—'} sub={t ? `${t.won.count} deals` : undefined} accent="#16a34a" />
              <StatCard icon={TrendingUp} label="Monthly recurring revenue" value={rev?.totalRetailMRR != null ? money(rev.totalRetailMRR) : '—'} sub={rev?.ready ? `margin ${money(totalMargin)}/mo` : 'updating…'} accent="#16a34a" />
              <StatCard icon={Users} label="Customers" value={data.customers.length} />
            </div>
            {view === 'pipeline' ? (
              <div class="flex gap-4 overflow-x-auto pb-2">
                <Column name="Open" count={data.deals.open.length} total={t?.open.value}>
                  {data.deals.open.map((d) => <DealCardView key={d.id} d={d} />)}
                </Column>
                <Column name="Won" count={data.deals.won.length} total={t?.won.value}>
                  {data.deals.won.map((d) => <DealCardView key={d.id} d={d} />)}
                </Column>
                <Column name="Lost" count={data.deals.lost.length} total={t?.lost.value}>
                  {data.deals.lost.map((d) => <DealCardView key={d.id} d={d} />)}
                </Column>
                <Column name="Customer" count={data.customers.length}>
                  {data.customers.map((c) => <CustomerCardView key={c.id} c={c} onEdit={setEditing} />)}
                </Column>
              </div>
            ) : (
              <Accounts rows={data.customers} onEdit={setEditing} />
            )}
            <div class="mt-4 text-[11px] text-[var(--color-text-faint)] flex items-center gap-1.5">
              <Wallet size={11} /> Live from Vendasta · deals {new Date(data.generatedAt).toLocaleTimeString()}
              {rev?.ready && rev.asOf ? ` · revenue ${new Date(rev.asOf).toLocaleTimeString()}` : ' · revenue updating…'}
            </div>
          </>
        )}
      </div>
      {editing && <EditModal card={editing} statuses={data?.outreachStatuses || []} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />}
    </div>
  );
}
