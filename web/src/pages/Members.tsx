import { useMemo, useState } from 'preact/hooks';
import { RefreshCw, Plus, Building2, Users, MapPin, X } from 'lucide-preact';
import { PageHeader } from '@/components/PageHeader';
import { PageState } from '@/components/PageState';
import { useFetch } from '@/lib/useFetch';
import { apiPost } from '@/lib/api';

interface Member {
  id: string; bidEmail: string; businessName: string;
  contactName: string | null; contactEmail: string | null;
  productMix: 'Ads' | 'Bots' | 'Ads+Bots';
  monthlyPriceCents: number;
  status: 'Trial' | 'Active' | 'Paused' | 'Churned';
  signedUpAt: number; notes: string | null;
}
interface Rollup {
  bidEmail: string; entity: string; city: string | null; contact: string | null;
  status: string; membersTarget: number | null; membersActive: number; membersTrial: number; membersChurned: number;
  monthlyRevenueCents: number; penetrationPct: number | null; members: Member[];
}
interface MembersData {
  generatedAt: number; rollups: Rollup[];
  totals: { bidsEndorsed: number; activeMembers: number; totalMRRCents: number; pipelineCeilingCents: number };
}

const TONE: Record<string, string> = { good: '#16a34a', warn: '#ca8a04', bad: '#dc2626', faint: 'var(--color-text-faint)' };
const money = (c: number) => '$' + Math.round(c / 100).toLocaleString();
const moneyFull = (c: number) => '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const pct = (p: number | null) => p == null ? '—' : Math.round(p * 100) + '%';

const STATUS_TONE: Record<string, string> = {
  Active: 'good', Trial: 'warn', Paused: 'faint', Churned: 'bad',
};

function StatusPill({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? 'faint';
  return (
    <span class="inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{ color: TONE[tone], background: `color-mix(in srgb, ${TONE[tone]} 14%, transparent)` }}>{status}</span>
  );
}

function AddMemberDialog({ bid, onClose, onAdded }: { bid: Rollup; onClose: () => void; onAdded: () => void }) {
  const [businessName, setBusinessName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [productMix, setProductMix] = useState<'Ads' | 'Bots' | 'Ads+Bots'>('Ads+Bots');
  const [price, setPrice] = useState(169);
  const [status, setStatus] = useState<Member['status']>('Trial');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!businessName.trim()) return;
    setBusy(true);
    try {
      await apiPost('/api/members', {
        bidEmail: bid.bidEmail,
        businessName: businessName.trim(),
        contactName: contactName || undefined,
        contactEmail: contactEmail || undefined,
        productMix,
        monthlyPriceCents: Math.round(price * 100),
        status,
      });
      onAdded();
      onClose();
    } finally { setBusy(false); }
  }

  return (
    <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div class="flex items-center justify-between mb-3">
          <div class="font-semibold">Add Member to {bid.entity}</div>
          <button onClick={onClose} class="text-[var(--color-text-faint)]"><X size={16} /></button>
        </div>
        <div class="space-y-2 text-[12px]">
          <input class="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5" placeholder="Business name *" value={businessName} onInput={(e) => setBusinessName((e.target as HTMLInputElement).value)} />
          <input class="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5" placeholder="Contact name" value={contactName} onInput={(e) => setContactName((e.target as HTMLInputElement).value)} />
          <input class="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5" placeholder="Contact email" value={contactEmail} onInput={(e) => setContactEmail((e.target as HTMLInputElement).value)} />
          <div class="grid grid-cols-2 gap-2">
            <select class="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5" value={productMix} onChange={(e) => setProductMix((e.target as HTMLSelectElement).value as any)}>
              <option value="Ads">Ads only</option>
              <option value="Bots">Bots only</option>
              <option value="Ads+Bots">Ads + Bots</option>
            </select>
            <input type="number" class="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5" placeholder="$/mo" value={price} onInput={(e) => setPrice(Number((e.target as HTMLInputElement).value))} />
          </div>
          <select class="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5" value={status} onChange={(e) => setStatus((e.target as HTMLSelectElement).value as any)}>
            <option value="Trial">Trial</option>
            <option value="Active">Active</option>
            <option value="Paused">Paused</option>
            <option value="Churned">Churned</option>
          </select>
        </div>
        <div class="mt-3 flex justify-end gap-2">
          <button onClick={onClose} class="text-[12px] px-3 py-1.5 rounded-md border border-[var(--color-border)]">Cancel</button>
          <button onClick={submit} disabled={busy || !businessName.trim()} class="text-[12px] px-3 py-1.5 rounded-md bg-[var(--color-text)] text-[var(--color-bg)] disabled:opacity-50">{busy ? 'Adding…' : 'Add member'}</button>
        </div>
      </div>
    </div>
  );
}

export function Members() {
  const { data, loading, error, refresh } = useFetch<MembersData>('/api/members');
  const [addingFor, setAddingFor] = useState<Rollup | null>(null);

  async function updateMemberStatus(id: string, status: Member['status']) {
    await apiPost(`/api/members/${id}`, { status });
    refresh();
  }

  if (loading && !data) return <PageState>Loading members…</PageState>;
  if (error) return <PageState>Error: {String(error)}</PageState>;
  if (!data) return null;

  const t = data.totals;

  return (
    <div class="flex h-full flex-col">
      <PageHeader
        title="BID Members"
        subtitle="Tier 2 — member businesses at the BID-discounted price ($169/mo standard)"
        actions={<button type="button" onClick={() => refresh()} class="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-2.5 py-1 text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-elevated)]"><RefreshCw size={12} /> Refresh</button>}
      />

      <div class="px-4 pt-3 pb-2 border-b border-[var(--color-border)] flex flex-wrap items-end gap-6">
        <div><div class="text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]">BIDs Endorsed</div><div class="text-[15px] font-semibold tabular-nums">{t.bidsEndorsed}</div></div>
        <div><div class="text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]">Active Members</div><div class="text-[15px] font-semibold tabular-nums">{t.activeMembers}</div></div>
        <div><div class="text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]">Current MRR</div><div class="text-[15px] font-semibold tabular-nums" style={{ color: TONE.good }}>{money(t.totalMRRCents)}</div></div>
        <div><div class="text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]">Pipeline Ceiling</div><div class="text-[15px] font-semibold tabular-nums text-[var(--color-text-muted)]">{money(t.pipelineCeilingCents)}</div></div>
        <div class="text-[10px] text-[var(--color-text-faint)] max-w-xs">
          Ceiling = sum of (estimated members × $169) across the NC BID roster. Real-world penetration varies.
        </div>
      </div>

      <div class="flex-1 overflow-auto p-4 space-y-4">
        {data.rollups.length === 0 && (
          <PageState>
            No endorsed BIDs yet. Once a BID's outreach status hits "Endorsed", a member roster will appear here.
          </PageState>
        )}
        {data.rollups.map(r => (
          <div key={r.bidEmail} class="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-3">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <Building2 size={14} class="text-[var(--color-text-faint)] shrink-0" />
                  <div class="text-[14px] font-semibold text-[var(--color-text)] truncate">{r.entity}</div>
                  {r.status === 'Endorsed' && <span class="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ color: TONE.good, background: `color-mix(in srgb, ${TONE.good} 14%, transparent)` }}>Endorsed</span>}
                </div>
                <div class="mt-1 text-[11px] text-[var(--color-text-muted)] flex flex-wrap items-center gap-x-3 gap-y-1">
                  {r.city && <span class="inline-flex items-center gap-1"><MapPin size={10} />{r.city}</span>}
                  {r.contact && <span>· {r.contact}</span>}
                  <span class="inline-flex items-center gap-1"><Users size={10} />{r.membersActive} active / {r.membersTrial} trial / {r.membersChurned} churned</span>
                  {r.membersTarget && <span class="text-[var(--color-text-faint)]">target ~{r.membersTarget} members</span>}
                </div>
                <div class="mt-1 flex flex-wrap items-center gap-3 text-[12px]">
                  <span class="font-semibold tabular-nums" style={{ color: TONE.good }}>{moneyFull(r.monthlyRevenueCents)}<span class="text-[var(--color-text-faint)] font-normal">/mo MRR</span></span>
                  <span class="text-[var(--color-text-muted)]">Penetration: {pct(r.penetrationPct)}</span>
                  {r.membersTarget && (
                    <span class="text-[var(--color-text-faint)]">
                      Ceiling: {moneyFull(r.membersTarget * 16900)}/mo
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => setAddingFor(r)} class="text-[12px] px-2 py-1 rounded-md border border-[var(--color-border)] inline-flex items-center gap-1 hover:bg-[var(--color-elevated)]">
                <Plus size={12} />Add member
              </button>
            </div>

            {r.members.length > 0 && (
              <div class="mt-3 border-t border-[var(--color-border)] pt-3">
                <table class="w-full text-[11px]">
                  <thead>
                    <tr class="text-left text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]">
                      <th class="pb-1.5 pr-2">Business</th>
                      <th class="pb-1.5 pr-2">Contact</th>
                      <th class="pb-1.5 pr-2">Mix</th>
                      <th class="pb-1.5 pr-2 text-right">$/mo</th>
                      <th class="pb-1.5 pr-2">Status</th>
                      <th class="pb-1.5">Signed up</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.members.map(m => (
                      <tr key={m.id} class="border-t border-[var(--color-border)]/40">
                        <td class="py-1.5 pr-2 text-[var(--color-text)] font-medium">{m.businessName}</td>
                        <td class="py-1.5 pr-2 text-[var(--color-text-muted)]">
                          {m.contactName || '—'}
                          {m.contactEmail && <div class="text-[10px] text-[var(--color-text-faint)]">{m.contactEmail}</div>}
                        </td>
                        <td class="py-1.5 pr-2 text-[var(--color-text-muted)]">{m.productMix}</td>
                        <td class="py-1.5 pr-2 text-right tabular-nums">{moneyFull(m.monthlyPriceCents)}</td>
                        <td class="py-1.5 pr-2">
                          <div class="flex items-center gap-2">
                            <StatusPill status={m.status} />
                            <select class="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-1.5 py-1 text-[10px]"
                              value={m.status}
                              onChange={(e) => updateMemberStatus(m.id, (e.target as HTMLSelectElement).value as Member['status'])}>
                              <option value="Trial">Trial</option>
                              <option value="Active">Active</option>
                              <option value="Paused">Paused</option>
                              <option value="Churned">Churned</option>
                            </select>
                          </div>
                        </td>
                        <td class="py-1.5 text-[var(--color-text-muted)]">{new Date(m.signedUpAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>

      {addingFor && <AddMemberDialog bid={addingFor} onClose={() => setAddingFor(null)} onAdded={refresh} />}

      <div class="px-4 py-2 border-t border-[var(--color-border)] text-[10px] text-[var(--color-text-faint)]">
        Last refreshed {new Date(data.generatedAt).toLocaleTimeString()} · BIDs appear here once outreach status = Endorsed. Pricing tiers from Final BID Pricing.xlsx.
      </div>
    </div>
  );
}
