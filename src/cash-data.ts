// Cash data layer for Mission Control.
//
// Reads from the Plaid stdio connector (connectors/plaid/server.mjs) and
// rewrites Plaid's category labels into business-meaningful buckets that
// reflect how Dante actually operates:
//
//   - Vendasta deposits (e.g. "Vendasta Transfer Id St ...") are AR collections
//     from his clients via the Vendasta billing engine → Revenue: Vendasta
//   - Vendasta charges (e.g. "Vendasta" $12/$47/$91) are wholesale costs he
//     pays Vendasta per client/per service → COGS: Vendasta
//   - PayPal inbound transfers are typically client payments → Revenue: Direct
//   - PayPal outbound transfers are typically expenses or owner draws → Transfers
//   - Software subscriptions (OpenAI, ClickUp, Replit, etc.) → SaaS Stack
//   - Utilities (AT&T, GoDaddy) → Utilities
//   - Dining/Travel/Entertainment → personal pass-through (own buckets)
//   - Capital One / Credit One payments → Credit Card Payments
//   - Anything unmatched stays in Plaid's category for visibility.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import { PROJECT_ROOT } from './config.js';
import { logger } from './logger.js';
import { loadManualAccounts, loadManualTransactions } from './manual-cash-data.js';

const execFileAsync = promisify(execFile);
const PLAID_SERVER = path.join(PROJECT_ROOT, 'connectors', 'plaid', 'server.mjs');
const CACHE_FILE = path.join(PROJECT_ROOT, 'store', 'cash-cache.json');
const TTL_MS = 5 * 60 * 1000; // 5 min cache to avoid hammering Plaid rate limits

export interface CashAccount {
  account_id: string;
  item_id: string;
  institution: string | null;
  name: string;
  official_name: string | null;
  mask: string | null;
  type: string | null;
  subtype: string | null;
  balanceCurrent: number | null;
  balanceAvailable: number | null;
  currency: string;
}

export interface CashTransaction {
  transaction_id: string;
  account_id: string;
  date: string;
  name: string;
  merchant: string | null;
  amount: number;           // positive = outflow, negative = inflow (Plaid convention)
  direction: 'in' | 'out';
  bucket: string;           // our business-meaningful category
  plaidCategory: string[] | null;
  pending: boolean;
}

export interface CashSummary {
  asOf: number;
  totalCashCents: number;
  accounts: CashAccount[];
  mtd: { revenueCents: number; cogsCents: number; saasCents: number; otherSpendCents: number; netCents: number };
  last30: { revenueCents: number; cogsCents: number; saasCents: number; otherSpendCents: number; netCents: number };
  recent: CashTransaction[];
  bucketBreakdown: Array<{ bucket: string; inflowCents: number; outflowCents: number; count: number }>;
  runwayDays: number | null;     // cash / average daily burn (last 30d, net of revenue)
  configured: boolean;            // false if Plaid creds missing
  connectionStatus: 'ok' | 'no-credentials' | 'no-items' | 'error';
  connectionMessage: string | null;
}

// ---- Plaid CLI bridge ----
async function plaidCall(tool: string, args: Record<string, unknown> = {}): Promise<any> {
  const { stdout } = await execFileAsync('node', [PLAID_SERVER, '--call', tool, JSON.stringify(args)], {
    env: { ...process.env },
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(stdout);
}

// ---- Categorization rules ----
// Tuned to Dante's actual transactions seen on 2026-05-25. Rules are checked
// in order; the first match wins. Each rule returns a bucket string.

interface Rule {
  bucket: string;
  match: (tx: { name: string; merchant: string | null; amount: number; plaidCat: string[] | null }) => boolean;
}

const VENDASTA_INFLOW_PATTERNS = [
  /vendasta\s*transfer/i,
  /vendasta.*transfer\s*id/i,
];
const VENDASTA_OUTFLOW_PATTERN = /^vendasta\b/i;
const PAYPAL_TRANSFER_PATTERNS = [/paypal\s*transfer/i, /paypal\s*instant\s*transfer/i];
const VENMO_PATTERN = /venmo/i;

const SAAS_MERCHANTS = new Set([
  'openai', 'clickup', 'replit', 'lindy', 'gamma app', 'perplexity ai', 'apify',
  'pickaxeproject', 'paddle', 'loom subscription', 'recall', 'netflix', 'amazon prime',
  'patreon', 'medium monthly', 'electronic arts', 'wispr', 'banksync', 'skywork ai',
  'the daily wire', 'alexa skills', 'amazon digital services', 'pockethealth',
  'rmtly', 'yyz relay', 'extension mobile first', 'recolor paints', 'lilt',
]);

const UTILITIES_MERCHANTS = new Set([
  'at&t', 'att', 'godaddy', 'verizon',
]);

const CREDIT_CARD_PAYMENT_PATTERNS = [
  /capital one/i, /credit one bank/i, /chase credit card/i, /amex/i, /discover.*payment/i,
];

const RULES: Rule[] = [
  // Inflows
  { bucket: 'Revenue: Vendasta', match: (t) => t.amount < 0 && VENDASTA_INFLOW_PATTERNS.some(re => re.test(t.name)) },
  { bucket: 'Revenue: Vendasta', match: (t) => t.amount < 0 && /vendasta/i.test(t.name) && /transfer/i.test(t.name) },
  { bucket: 'Revenue: Direct',   match: (t) => t.amount < 0 && PAYPAL_TRANSFER_PATTERNS.some(re => re.test(t.name)) },
  { bucket: 'Revenue: Direct',   match: (t) => t.amount < 0 && VENMO_PATTERN.test(t.name) },
  { bucket: 'Revenue: Direct',   match: (t) => t.amount < 0 && /retry\s*payment/i.test(t.name) },
  { bucket: 'Revenue: Other',    match: (t) => t.amount < 0 && (t.plaidCat?.includes('Transfer') || t.plaidCat?.includes('Deposit') || false) },

  // Outflows — COGS first (most specific)
  { bucket: 'COGS: Vendasta',    match: (t) => t.amount > 0 && VENDASTA_OUTFLOW_PATTERN.test(t.name) && !VENDASTA_INFLOW_PATTERNS.some(re => re.test(t.name)) },

  // Outflows — credit card payments
  { bucket: 'Credit Card Payment', match: (t) => t.amount > 0 && CREDIT_CARD_PAYMENT_PATTERNS.some(re => re.test(t.name)) },

  // Outflows — SaaS / business tools
  { bucket: 'SaaS Stack', match: (t) => {
      if (t.amount <= 0) return false;
      const n = (t.merchant || t.name || '').toLowerCase();
      for (const m of SAAS_MERCHANTS) if (n.includes(m)) return true;
      return false;
  } },

  // Outflows — utilities
  { bucket: 'Utilities', match: (t) => {
      if (t.amount <= 0) return false;
      const n = (t.merchant || t.name || '').toLowerCase();
      for (const m of UTILITIES_MERCHANTS) if (n.includes(m)) return true;
      return false;
  } },

  // Outflows — PayPal / Venmo (when outbound)
  { bucket: 'Transfers Out: PayPal/Venmo', match: (t) => t.amount > 0 && (PAYPAL_TRANSFER_PATTERNS.some(re => re.test(t.name)) || VENMO_PATTERN.test(t.name)) },

  // Outflows — dining / travel passthrough
  { bucket: 'Dining',        match: (t) => t.amount > 0 && (t.plaidCat?.includes('Food and Drink') || /restaurant|king crab|trading compa/i.test(t.name)) },
  { bucket: 'Travel',        match: (t) => t.amount > 0 && (t.plaidCat?.includes('Travel') || /best western|hotel|airline/i.test(t.name)) },
  { bucket: 'Entertainment', match: (t) => t.amount > 0 && (t.plaidCat?.includes('Entertainment') || /nate ai|patreon|netflix|spotify/i.test(t.name)) },
];

function categorize(name: string, merchant: string | null, amount: number, plaidCat: string[] | null): string {
  for (const r of RULES) {
    if (r.match({ name, merchant, amount, plaidCat })) return r.bucket;
  }
  // Fallbacks
  if (amount < 0) return 'Inflow: Uncategorized';
  if (plaidCat && plaidCat.length) return 'Spend: ' + plaidCat[0];
  return 'Spend: Uncategorized';
}

const REVENUE_BUCKETS = new Set(['Revenue: Vendasta', 'Revenue: Direct', 'Revenue: Other']);
const COGS_BUCKETS = new Set(['COGS: Vendasta']);
const SAAS_BUCKETS = new Set(['SaaS Stack']);

// ---- Cache ----
function readCache(): { asOf: number; data: CashSummary } | null {
  try {
    const j = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    if (Date.now() - j.asOf < TTL_MS) return j;
  } catch { /* ignore */ }
  return null;
}
function writeCache(data: CashSummary): void {
  try {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ asOf: data.asOf, data }, null, 2));
  } catch (e) {
    logger.warn({ err: String((e as Error)?.message || e) }, 'cash: cache write failed');
  }
}

// ---- Public API ----
export async function getCashData(force = false): Promise<CashSummary> {
  if (!force) {
    const c = readCache();
    if (c) return c.data;
  }

  // Detect configuration state up-front so the UI can show a clean
  // "Connect a bank" CTA rather than an opaque error.
  if (!process.env.PLAID_CLIENT_ID && !fs.readFileSync(path.join(PROJECT_ROOT, '.env'), 'utf-8').includes('PLAID_CLIENT_ID')) {
    return emptySummary('no-credentials', 'PLAID_CLIENT_ID not set. See docs/CASH-SETUP-RUNBOOK.md.');
  }

  // Load manual (CSV-imported) accounts + transactions up-front so we can
  // include them even if Plaid has zero items connected.
  const manualAccountsRaw = loadManualAccounts();
  const manualTxnsRaw = loadManualTransactions();

  let accountsRaw: any, transactionsRaw: any;
  try {
    accountsRaw = await plaidCall('plaid_list_accounts', {});
  } catch (e) {
    // If Plaid fails but we have manual data, continue with manual only.
    if (manualAccountsRaw.length > 0) {
      accountsRaw = { accounts: [] };
    } else {
      return emptySummary('error', String((e as Error)?.message || e));
    }
  }
  const plaidAccountCount = (accountsRaw.accounts || []).filter((a: any) => !a.error).length;
  if (plaidAccountCount === 0 && manualAccountsRaw.length === 0) {
    return emptySummary('no-items', 'No banks connected yet. Open /cash/connect to link your Novo account via Plaid Link, or upload a CSV statement.');
  }

  const now = new Date();
  const start = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
  const startISO = start.toISOString().slice(0, 10);
  const endISO = now.toISOString().slice(0, 10);
  if (plaidAccountCount > 0) {
    try {
      transactionsRaw = await plaidCall('plaid_list_transactions', { start_date: startISO, end_date: endISO, count: 500 });
    } catch (e) {
      transactionsRaw = { transactions: [], count: 0 };
      logger.warn({ err: String((e as Error)?.message || e) }, 'cash: transactions fetch failed');
    }
  } else {
    transactionsRaw = { transactions: [], count: 0 };
  }

  const plaidAccounts: CashAccount[] = (accountsRaw.accounts || [])
    .filter((a: any) => !a.error)
    .map((a: any) => ({
      account_id: a.account_id,
      item_id: a.item_id,
      institution: a.institution || null,
      name: a.name,
      official_name: a.official_name || null,
      mask: a.mask || null,
      type: a.type || null,
      subtype: a.subtype || null,
      balanceCurrent: a.balances?.current ?? null,
      balanceAvailable: a.balances?.available ?? null,
      currency: a.balances?.iso_currency_code || 'USD',
    }));

  // Map manual accounts into the same CashAccount shape.
  const manualAccounts: CashAccount[] = manualAccountsRaw.map(a => ({
    account_id: a.account_id,
    item_id: 'manual',
    institution: a.institution_name,
    name: a.name,
    official_name: a.name,
    mask: a.mask,
    type: a.type,
    subtype: a.subtype,
    balanceCurrent: a.balance_current,
    balanceAvailable: a.balance_available,
    currency: a.currency,
  }));

  const accounts: CashAccount[] = [...plaidAccounts, ...manualAccounts];

  // Total cash = sum of CHECKING + SAVINGS available balances. Lending/loan
  // accounts excluded (they're liabilities, not cash).
  const totalCashCents = accounts
    .filter(a => ['depository', 'cash'].includes((a.type || '').toLowerCase()))
    .reduce((s, a) => s + Math.round(((a.balanceAvailable ?? a.balanceCurrent) || 0) * 100), 0);

  // Plaid transactions, then manual transactions, both fed through the same
  // categorize() so Vendasta-aware rules apply uniformly.
  const plaidTransactions: CashTransaction[] = (transactionsRaw.transactions || [])
    .filter((tx: any) => !tx.error)
    .map((tx: any) => {
      const bucket = categorize(tx.name || '', tx.merchant_name || null, tx.amount, tx.category || null);
      return {
        transaction_id: tx.transaction_id,
        account_id: tx.account_id,
        date: tx.date,
        name: tx.name,
        merchant: tx.merchant_name || null,
        amount: tx.amount,
        direction: tx.amount < 0 ? 'in' : 'out',
        bucket,
        plaidCategory: tx.category || null,
        pending: !!tx.pending,
      } as CashTransaction;
    });

  // Manual transactions — apply the same categorize(). DO NOT filter by
  // date: manual imports are explicitly user-driven (monthly statements
  // covering multiple months), so showing the full imported history is
  // the whole point. The MTD/last30 windowed totals below still only
  // count in-window transactions, so the metric math stays correct.
  const manualTransactions: CashTransaction[] = manualTxnsRaw
    .map(tx => {
      const bucket = categorize(tx.name || '', tx.merchant || null, tx.amount, tx.category || null);
      return {
        transaction_id: tx.transaction_id,
        account_id: tx.account_id,
        date: tx.date,
        name: tx.name,
        merchant: tx.merchant,
        amount: tx.amount,
        direction: tx.amount < 0 ? 'in' : 'out',
        bucket,
        plaidCategory: tx.category,
        pending: tx.pending,
      } as CashTransaction;
    });

  const transactions: CashTransaction[] = [...plaidTransactions, ...manualTransactions];

  // Bucketed totals — MTD and last-30.
  const mtdStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const last30Start = startISO;

  function totalsFor(periodStart: string) {
    let revenue = 0, cogs = 0, saas = 0, otherSpend = 0;
    for (const tx of transactions) {
      if (tx.date < periodStart) continue;
      const cents = Math.round(Math.abs(tx.amount) * 100);
      if (REVENUE_BUCKETS.has(tx.bucket)) revenue += cents;
      else if (COGS_BUCKETS.has(tx.bucket)) cogs += cents;
      else if (SAAS_BUCKETS.has(tx.bucket)) saas += cents;
      else if (tx.direction === 'out') otherSpend += cents;
    }
    return {
      revenueCents: revenue,
      cogsCents: cogs,
      saasCents: saas,
      otherSpendCents: otherSpend,
      netCents: revenue - cogs - saas - otherSpend,
    };
  }
  const mtd = totalsFor(mtdStart);
  const last30 = totalsFor(last30Start);

  // Bucket breakdown for the page UI.
  const bucketMap = new Map<string, { inflowCents: number; outflowCents: number; count: number }>();
  for (const tx of transactions) {
    const m = bucketMap.get(tx.bucket) ?? { inflowCents: 0, outflowCents: 0, count: 0 };
    const cents = Math.round(Math.abs(tx.amount) * 100);
    if (tx.direction === 'in') m.inflowCents += cents; else m.outflowCents += cents;
    m.count++;
    bucketMap.set(tx.bucket, m);
  }
  const bucketBreakdown = [...bucketMap.entries()]
    .map(([bucket, v]) => ({ bucket, ...v }))
    .sort((a, b) => (b.inflowCents + b.outflowCents) - (a.inflowCents + a.outflowCents));

  // Runway: cash / daily burn (last 30 days, net of revenue).
  // Burn = (cogs + saas + otherSpend - revenue) / 30 days.
  let runwayDays: number | null = null;
  const dailyBurnCents = (last30.cogsCents + last30.saasCents + last30.otherSpendCents - last30.revenueCents) / 30;
  if (dailyBurnCents > 0 && totalCashCents > 0) {
    runwayDays = Math.floor(totalCashCents / dailyBurnCents);
  } else if (dailyBurnCents <= 0) {
    runwayDays = null; // Net positive — runway is "infinite" given current trajectory.
  }

  const result: CashSummary = {
    asOf: Date.now(),
    totalCashCents,
    accounts,
    mtd,
    last30,
    recent: transactions.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 200),
    bucketBreakdown,
    runwayDays,
    configured: true,
    connectionStatus: 'ok',
    connectionMessage: null,
  };
  writeCache(result);
  return result;
}

function emptySummary(status: CashSummary['connectionStatus'], message: string | null): CashSummary {
  return {
    asOf: Date.now(),
    totalCashCents: 0,
    accounts: [],
    mtd: { revenueCents: 0, cogsCents: 0, saasCents: 0, otherSpendCents: 0, netCents: 0 },
    last30: { revenueCents: 0, cogsCents: 0, saasCents: 0, otherSpendCents: 0, netCents: 0 },
    recent: [],
    bucketBreakdown: [],
    runwayDays: null,
    configured: status !== 'no-credentials',
    connectionStatus: status,
    connectionMessage: message,
  };
}

/** Exchange a public_token from Plaid Link for a permanent access_token. */
export async function exchangePublicToken(publicToken: string, institutionName: string): Promise<{ item_id: string }> {
  if (!publicToken) throw new Error('public_token required');
  const r = await plaidCall('plaid_exchange_public_token', { public_token: publicToken, institution_name: institutionName });
  // Invalidate cache so the new bank shows up immediately.
  try { fs.unlinkSync(CACHE_FILE); } catch { /* ignore */ }
  return { item_id: r.item_id };
}

/** Create a link_token for the Plaid Link UI. The redirect_uri must match an
 *  entry in the Plaid dashboard's "Allowed redirect URIs" — required for
 *  OAuth banks like Novo. */
export async function createLinkToken(
  clientName = 'ClaudeClaw Mission Control',
  redirectUri?: string,
): Promise<{ link_token: string }> {
  const args: Record<string, unknown> = { client_name: clientName, products: ['transactions'] };
  if (redirectUri) args.redirect_uri = redirectUri;
  const r = await plaidCall('plaid_create_link_token', args);
  return { link_token: r.link_token };
}
