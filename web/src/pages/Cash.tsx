import { useMemo, useState } from 'preact/hooks';
import { RefreshCw, Wallet, TrendingUp, TrendingDown, Link2, AlertTriangle, ExternalLink, ArrowDownToLine, ArrowUpFromLine, Upload, X } from 'lucide-preact';
import { PageHeader } from '@/components/PageHeader';
import { PageState } from '@/components/PageState';
import { useFetch } from '@/lib/useFetch';
import { dashboardToken, apiPost } from '@/lib/api';

// The /cash/connect HTML page lives outside the SPA but still needs the
// dashboard token to call /api/cash/link-token and /api/cash/exchange.
// We pass the token via ?token= so the page can pick it up.
const connectUrl = () => '/cash/connect' + (dashboardToken ? '?token=' + encodeURIComponent(dashboardToken) : '');

interface CashAccount {
  account_id: string; item_id: string; institution: string | null;
  name: string; official_name: string | null; mask: string | null;
  type: string | null; subtype: string | null;
  balanceCurrent: number | null; balanceAvailable: number | null; currency: string;
}
interface CashTx {
  transaction_id: string; account_id: string; date: string; name: string; merchant: string | null;
  amount: number; direction: 'in' | 'out'; bucket: string; plaidCategory: string[] | null; pending: boolean;
}
interface BucketRow { bucket: string; inflowCents: number; outflowCents: number; count: number; }
interface CashSummary {
  asOf: number; totalCashCents: number; accounts: CashAccount[];
  mtd: { revenueCents: number; cogsCents: number; saasCents: number; otherSpendCents: number; netCents: number };
  last30: { revenueCents: number; cogsCents: number; saasCents: number; otherSpendCents: number; netCents: number };
  recent: CashTx[]; bucketBreakdown: BucketRow[];
  runwayDays: number | null;
  configured: boolean; connectionStatus: 'ok' | 'no-credentials' | 'no-items' | 'error'; connectionMessage: string | null;
}

const TONE: Record<string, string> = { good: '#16a34a', warn: '#ca8a04', bad: '#dc2626', faint: 'var(--color-text-faint)' };
const money = (c: number) => '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const moneySigned = (c: number) => (c >= 0 ? '+' : '') + '$' + Math.abs(c / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function BucketTone(b: string): string {
  if (b.startsWith('Revenue')) return 'good';
  if (b.startsWith('COGS')) return 'warn';
  if (b.startsWith('SaaS')) return 'warn';
  if (b.startsWith('Credit Card')) return 'warn';
  if (b.startsWith('Transfers')) return 'faint';
  if (b.startsWith('Inflow')) return 'good';
  return 'faint';
}

function StatusCallout({ s }: { s: CashSummary }) {
  if (s.connectionStatus === 'ok') return null;
  const Icon = AlertTriangle;
  return (
    <div class="m-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4 flex items-start gap-3">
      <Icon size={18} class="shrink-0 mt-0.5" style={{ color: TONE.warn }} />
      <div class="flex-1">
        {s.connectionStatus === 'no-credentials' && (
          <>
            <div class="font-semibold mb-1">Plaid not configured</div>
            <p class="text-[12px] text-[var(--color-text-muted)]">Add <code>PLAID_CLIENT_ID</code> and <code>PLAID_SECRET</code> to your <code>.env</code>. See <code>docs/CASH-SETUP-RUNBOOK.md</code>.</p>
          </>
        )}
        {s.connectionStatus === 'no-items' && (
          <>
            <div class="font-semibold mb-1">No banks connected</div>
            <p class="text-[12px] text-[var(--color-text-muted)] mb-2">Click below to open Plaid Link and connect your Novo account.</p>
            <a href={connectUrl()} target="_blank" rel="noreferrer"
               class="inline-flex items-center gap-1 rounded-md bg-[var(--color-text)] text-[var(--color-bg)] px-3 py-1.5 text-[12px] font-semibold">
              <Link2 size={12} />Connect a Bank
            </a>
          </>
        )}
        {s.connectionStatus === 'error' && (
          <>
            <div class="font-semibold mb-1" style={{ color: TONE.bad }}>Plaid connection error</div>
            <p class="text-[12px] text-[var(--color-text-muted)]">{s.connectionMessage}</p>
          </>
        )}
      </div>
    </div>
  );
}

function UploadStatementModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [institution, setInstitution] = useState('Apple Card');
  const [accountName, setAccountName] = useState('Apple Card');
  const [mask, setMask] = useState('');
  const [accountType, setAccountType] = useState<'credit' | 'depository' | 'loan'>('credit');
  const [statementBalance, setStatementBalance] = useState<string>('');
  const [availableCredit, setAvailableCredit] = useState<string>('');
  const [billingStart, setBillingStart] = useState<string>('');
  const [billingEnd, setBillingEnd] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ inserted: number; updated: number; skipped_invalid: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function onFile(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    setFileName(f.name);
    const reader = new FileReader();
    reader.onload = () => { setCsvText(String(reader.result || '')); };
    reader.readAsText(f);
    // Best-effort: auto-detect month from filename pattern Apple uses, e.g.
    // "Apple Card Transactions - August 2025.csv".
    const m = f.name.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);
    if (m) {
      const monthIdx = ['january','february','march','april','may','june','july','august','september','october','november','december'].indexOf(m[1].toLowerCase());
      if (monthIdx >= 0) {
        const yy = parseInt(m[2], 10);
        const start = new Date(yy, monthIdx, 1);
        const end = new Date(yy, monthIdx + 1, 0);
        setBillingStart(start.toISOString().slice(0, 10));
        setBillingEnd(end.toISOString().slice(0, 10));
      }
    }
  }

  async function submit() {
    setErr(null);
    if (!csvText) { setErr('Pick a CSV file first.'); return; }
    if (!mask || mask.length < 3) { setErr('Last 4 digits of the card are required.'); return; }
    setBusy(true);
    try {
      const r = await apiPost<{ ok: boolean; inserted: number; updated: number; skipped_invalid: number }>('/api/cash/import-csv', {
        institution_name: institution,
        account_name: accountName,
        mask: mask.slice(-4),
        account_type: accountType,
        statement_balance: statementBalance ? Number(statementBalance) : undefined,
        available_credit: availableCredit ? Number(availableCredit) : undefined,
        billing_period_start: billingStart || undefined,
        billing_period_end: billingEnd || undefined,
        csv_text: csvText,
      });
      setResult({ inserted: r.inserted, updated: r.updated, skipped_invalid: r.skipped_invalid });
      onImported();
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally { setBusy(false); }
  }

  return (
    <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div class="flex items-center justify-between mb-3">
          <div class="font-semibold">Upload Statement (CSV)</div>
          <button onClick={onClose} class="text-[var(--color-text-faint)]"><X size={16} /></button>
        </div>

        <p class="text-[11px] text-[var(--color-text-muted)] mb-3">
          For Apple Card: in Wallet → Apple Card → tap a monthly statement → Export Transactions → CSV.
          Save to Files, then upload here. Same flow works for any institution's CSV export.
        </p>

        <div class="space-y-2 text-[12px]">
          <label class="block">
            <span class="text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]">CSV file</span>
            <input type="file" accept=".csv,text/csv" onChange={onFile} class="block mt-1 text-[11px]" />
            {fileName && <span class="block text-[10px] text-[var(--color-text-faint)] mt-1">{fileName} · {csvText.length.toLocaleString()} bytes</span>}
          </label>

          <div class="grid grid-cols-2 gap-2">
            <label class="block">
              <span class="text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]">Institution</span>
              <input class="w-full mt-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5" value={institution} onInput={(e) => setInstitution((e.target as HTMLInputElement).value)} />
            </label>
            <label class="block">
              <span class="text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]">Account name</span>
              <input class="w-full mt-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5" value={accountName} onInput={(e) => setAccountName((e.target as HTMLInputElement).value)} />
            </label>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <label class="block">
              <span class="text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]">Card last 4</span>
              <input class="w-full mt-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5" placeholder="1234" value={mask} onInput={(e) => setMask((e.target as HTMLInputElement).value)} maxLength={4} />
            </label>
            <label class="block">
              <span class="text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]">Account type</span>
              <select class="w-full mt-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5" value={accountType} onChange={(e) => setAccountType((e.target as HTMLSelectElement).value as any)}>
                <option value="credit">Credit card</option>
                <option value="depository">Bank account</option>
                <option value="loan">Loan</option>
              </select>
            </label>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <label class="block">
              <span class="text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]">Statement balance ($)</span>
              <input type="number" step="0.01" class="w-full mt-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5" placeholder="e.g. 543.21" value={statementBalance} onInput={(e) => setStatementBalance((e.target as HTMLInputElement).value)} />
            </label>
            {accountType === 'credit' && (
              <label class="block">
                <span class="text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]">Available credit ($)</span>
                <input type="number" step="0.01" class="w-full mt-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5" placeholder="optional" value={availableCredit} onInput={(e) => setAvailableCredit((e.target as HTMLInputElement).value)} />
              </label>
            )}
          </div>

          <div class="grid grid-cols-2 gap-2">
            <label class="block">
              <span class="text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]">Billing period start</span>
              <input type="date" class="w-full mt-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5" value={billingStart} onInput={(e) => setBillingStart((e.target as HTMLInputElement).value)} />
            </label>
            <label class="block">
              <span class="text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]">Billing period end</span>
              <input type="date" class="w-full mt-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5" value={billingEnd} onInput={(e) => setBillingEnd((e.target as HTMLInputElement).value)} />
            </label>
          </div>
          <p class="text-[10px] text-[var(--color-text-faint)]">Billing dates are optional but recommended — re-uploading the same period replaces those transactions instead of duplicating.</p>
        </div>

        {err && <div class="mt-3 text-[11px] p-2 rounded-md" style={{ color: '#dc2626', background: 'color-mix(in srgb, #dc2626 14%, transparent)' }}>{err}</div>}
        {result && (
          <div class="mt-3 text-[11px] p-2 rounded-md" style={{ color: '#16a34a', background: 'color-mix(in srgb, #16a34a 14%, transparent)' }}>
            Imported. <strong>{result.inserted}</strong> transactions added{result.updated > 0 ? ', ' + result.updated + ' replaced' : ''}{result.skipped_invalid > 0 ? '. ' + result.skipped_invalid + ' rows skipped (invalid)' : ''}.
          </div>
        )}

        {/* Status line: shows exactly what's missing if submit is disabled. */}
        <div class="mt-3 text-[10px] text-[var(--color-text-faint)]">
          {!csvText && <span>Waiting on CSV file… </span>}
          {csvText && !mask && <span style={{ color: '#ca8a04' }}>Enter the last 4 of the card to enable Import. </span>}
          {csvText && mask && <span>Ready to import. CSV: {csvText.length.toLocaleString()} bytes, account ••{mask}.</span>}
        </div>

        <div class="mt-3 flex justify-end gap-2">
          <button type="button" onClick={onClose}
            class="text-[12px] px-3 py-1.5 rounded-md border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-elevated)]">
            Close
          </button>
          <button type="button" onClick={submit} disabled={busy || !csvText || !mask}
            class="text-[12px] font-semibold px-4 py-1.5 rounded-md text-white shadow-sm transition-opacity"
            style={{
              background: '#2563eb',
              opacity: (busy || !csvText || !mask) ? 0.5 : 1,
              cursor: (busy || !csvText || !mask) ? 'not-allowed' : 'pointer',
            }}>
            {busy ? 'Importing…' : (result ? 'Import again' : 'Import')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Cash() {
  const { data, loading, error, refresh } = useFetch<CashSummary>('/api/cash');
  const [uploadOpen, setUploadOpen] = useState(false);

  const accountSummary = useMemo(() => {
    if (!data) return null;
    const cash = data.accounts.filter(a => ['depository', 'cash'].includes((a.type || '').toLowerCase()));
    const liabilities = data.accounts.filter(a => ['loan', 'credit'].includes((a.type || '').toLowerCase()));
    const totalLiabCents = liabilities.reduce((s, a) => s + Math.round(((a.balanceCurrent ?? 0)) * 100), 0);
    return { cash, liabilities, totalLiabCents };
  }, [data]);

  if (loading && !data) return <PageState>Loading cash position…</PageState>;
  if (error) return <PageState>Error: {String(error)}</PageState>;
  if (!data) return null;

  const netMtdTone = data.mtd.netCents >= 0 ? 'good' : 'bad';
  const netLast30Tone = data.last30.netCents >= 0 ? 'good' : 'bad';

  return (
    <div class="flex h-full flex-col">
      <PageHeader
        title="Cash"
        subtitle="Live bank balances, MTD income/expenses, runway"
        actions={<>
          <button type="button" onClick={() => window.open(connectUrl(), '_blank')}
            class="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-2.5 py-1 text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-elevated)]">
            <Link2 size={12} /> Connect bank
          </button>
          <button type="button" onClick={() => setUploadOpen(true)}
            class="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-2.5 py-1 text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-elevated)]">
            <Upload size={12} /> Upload statement
          </button>
          <button type="button" onClick={() => refresh()}
            class="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-2.5 py-1 text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-elevated)]">
            <RefreshCw size={12} /> Refresh
          </button>
        </>}
      />

      <StatusCallout s={data} />

      {data.connectionStatus === 'ok' && (
        <>
          {/* Top stats band */}
          <div class="px-4 pt-3 pb-2 border-b border-[var(--color-border)] flex flex-wrap items-end gap-6">
            <div>
              <div class="text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]">Total Cash</div>
              <div class="text-[20px] font-bold tabular-nums" style={{ color: TONE.good }}>{money(data.totalCashCents)}</div>
              <div class="text-[10px] text-[var(--color-text-faint)]">Across {accountSummary?.cash.length || 0} account{(accountSummary?.cash.length || 0) === 1 ? '' : 's'}</div>
            </div>
            <div>
              <div class="text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]">MTD Revenue</div>
              <div class="text-[15px] font-semibold tabular-nums" style={{ color: TONE.good }}>{money(data.mtd.revenueCents)}</div>
            </div>
            <div>
              <div class="text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]">MTD COGS</div>
              <div class="text-[15px] font-semibold tabular-nums" style={{ color: TONE.warn }}>{money(data.mtd.cogsCents)}</div>
            </div>
            <div>
              <div class="text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]">MTD SaaS</div>
              <div class="text-[15px] font-semibold tabular-nums" style={{ color: TONE.warn }}>{money(data.mtd.saasCents)}</div>
            </div>
            <div>
              <div class="text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]">MTD Other Spend</div>
              <div class="text-[15px] font-semibold tabular-nums text-[var(--color-text-muted)]">{money(data.mtd.otherSpendCents)}</div>
            </div>
            <div>
              <div class="text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]">MTD Net</div>
              <div class="text-[15px] font-semibold tabular-nums" style={{ color: TONE[netMtdTone] }}>{moneySigned(data.mtd.netCents)}</div>
            </div>
            <div>
              <div class="text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]">Runway</div>
              <div class="text-[15px] font-semibold tabular-nums">
                {data.runwayDays == null
                  ? <span style={{ color: TONE.good }}>Cash flow positive</span>
                  : data.runwayDays > 90 ? <span style={{ color: TONE.good }}>{data.runwayDays}d</span>
                    : data.runwayDays > 30 ? <span style={{ color: TONE.warn }}>{data.runwayDays}d</span>
                      : <span style={{ color: TONE.bad }}>{data.runwayDays}d</span>}
              </div>
              <div class="text-[10px] text-[var(--color-text-faint)]">at 30-day burn rate</div>
            </div>
          </div>

          {/* Last 30 strip */}
          <div class="px-4 py-2 border-b border-[var(--color-border)] flex flex-wrap items-center gap-x-6 gap-y-1 text-[11px] text-[var(--color-text-muted)]">
            <span class="font-semibold text-[var(--color-text-faint)] uppercase text-[10px]">Last 30 days:</span>
            <span><span class="text-[var(--color-text-faint)]">Revenue</span> <span style={{ color: TONE.good }} class="font-medium tabular-nums">{money(data.last30.revenueCents)}</span></span>
            <span><span class="text-[var(--color-text-faint)]">COGS</span> <span style={{ color: TONE.warn }} class="font-medium tabular-nums">{money(data.last30.cogsCents)}</span></span>
            <span><span class="text-[var(--color-text-faint)]">SaaS</span> <span style={{ color: TONE.warn }} class="font-medium tabular-nums">{money(data.last30.saasCents)}</span></span>
            <span><span class="text-[var(--color-text-faint)]">Other</span> <span class="font-medium tabular-nums">{money(data.last30.otherSpendCents)}</span></span>
            <span><span class="text-[var(--color-text-faint)]">Net</span> <span style={{ color: TONE[netLast30Tone] }} class="font-medium tabular-nums">{moneySigned(data.last30.netCents)}</span></span>
          </div>

          {/* Body: two columns */}
          <div class="flex-1 overflow-auto grid grid-cols-1 lg:grid-cols-3 gap-4 p-4">
            {/* Accounts + buckets */}
            <div class="space-y-4">
              <div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-3">
                <div class="text-[11px] uppercase tracking-wide text-[var(--color-text-faint)] mb-2">Accounts</div>
                {accountSummary?.cash.map(a => (
                  <div key={a.account_id} class="flex items-center justify-between text-[12px] py-1">
                    <div>
                      <div class="text-[var(--color-text)]">{a.name}</div>
                      <div class="text-[10px] text-[var(--color-text-faint)]">{a.institution} · {a.subtype || a.type}{a.mask ? ' ••' + a.mask : ''}</div>
                    </div>
                    <div class="tabular-nums font-semibold" style={{ color: TONE.good }}>{money(Math.round(((a.balanceAvailable ?? a.balanceCurrent) || 0) * 100))}</div>
                  </div>
                ))}
                {accountSummary?.liabilities && accountSummary.liabilities.length > 0 && (
                  <>
                    <div class="mt-3 pt-2 border-t border-[var(--color-border)] text-[11px] uppercase tracking-wide text-[var(--color-text-faint)] mb-2">Liabilities</div>
                    {accountSummary.liabilities.map(a => (
                      <div key={a.account_id} class="flex items-center justify-between text-[12px] py-1">
                        <div>
                          <div class="text-[var(--color-text)]">{a.name}</div>
                          <div class="text-[10px] text-[var(--color-text-faint)]">{a.institution} · {a.subtype || a.type}{a.mask ? ' ••' + a.mask : ''}</div>
                        </div>
                        <div class="tabular-nums" style={{ color: TONE.bad }}>{money(Math.round((a.balanceCurrent || 0) * 100))}</div>
                      </div>
                    ))}
                  </>
                )}
              </div>

              <div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-3">
                <div class="text-[11px] uppercase tracking-wide text-[var(--color-text-faint)] mb-2">30-day breakdown by category</div>
                <table class="w-full text-[11px]">
                  <tbody>
                    {data.bucketBreakdown.map(b => {
                      const tone = BucketTone(b.bucket);
                      const net = b.inflowCents - b.outflowCents;
                      return (
                        <tr key={b.bucket} class="border-t border-[var(--color-border)]/40 first:border-t-0">
                          <td class="py-1 text-[var(--color-text)]" style={{ color: TONE[tone] }}>{b.bucket}</td>
                          <td class="py-1 text-right tabular-nums text-[var(--color-text-muted)]">{b.count}</td>
                          <td class="py-1 text-right tabular-nums" style={{ color: TONE[tone] }}>
                            {b.inflowCents > 0 && money(b.inflowCents)}
                            {b.outflowCents > 0 && (b.inflowCents > 0 ? ' / ' : '') + money(b.outflowCents)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent transactions */}
            <div class="lg:col-span-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-3">
              <div class="flex items-center justify-between mb-2">
                <div class="text-[11px] uppercase tracking-wide text-[var(--color-text-faint)]">Recent transactions (corrected categories)</div>
                <div class="text-[10px] text-[var(--color-text-faint)]">{data.recent.length} shown</div>
              </div>
              <table class="w-full text-[11px]">
                <thead>
                  <tr class="text-left text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]">
                    <th class="pb-1.5">Date</th>
                    <th class="pb-1.5">Description</th>
                    <th class="pb-1.5">Bucket</th>
                    <th class="pb-1.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map(tx => {
                    const tone = BucketTone(tx.bucket);
                    const Icon = tx.direction === 'in' ? ArrowDownToLine : ArrowUpFromLine;
                    return (
                      <tr key={tx.transaction_id} class="border-t border-[var(--color-border)]/40">
                        <td class="py-1.5 pr-2 text-[var(--color-text-muted)] tabular-nums">{tx.date}</td>
                        <td class="py-1.5 pr-2">
                          <div class="text-[var(--color-text)]">{tx.name}{tx.pending && <span class="ml-1 text-[10px] text-[var(--color-text-faint)]">(pending)</span>}</div>
                          {tx.merchant && tx.merchant !== tx.name && <div class="text-[10px] text-[var(--color-text-faint)]">{tx.merchant}</div>}
                        </td>
                        <td class="py-1.5 pr-2">
                          <span class="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium"
                            style={{ color: TONE[tone], background: `color-mix(in srgb, ${TONE[tone]} 14%, transparent)` }}>
                            <Icon size={9} />{tx.bucket}
                          </span>
                        </td>
                        <td class="py-1.5 text-right tabular-nums font-semibold" style={{ color: TONE[tone] }}>
                          {moneySigned(Math.round(-tx.amount * 100))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div class="px-4 py-2 border-t border-[var(--color-border)] text-[10px] text-[var(--color-text-faint)] flex items-center justify-between">
            <span>Last refreshed {new Date(data.asOf).toLocaleTimeString()} · Categorization tuned for Vendasta-based agency. Edit rules in src/cash-data.ts.</span>
            <a href={connectUrl()} target="_blank" rel="noreferrer" class="inline-flex items-center gap-1 hover:underline">
              <ExternalLink size={10} />Connect another bank
            </a>
          </div>
        </>
      )}

      {uploadOpen && <UploadStatementModal onClose={() => setUploadOpen(false)} onImported={() => refresh()} />}
    </div>
  );
}
