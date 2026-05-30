// Manually-imported cash data (for Apple Card and any other institution
// Plaid can't reach). Stores virtual "accounts" + their transactions in
// store/manual-accounts.json and store/manual-transactions.json, and
// exposes the same shape that cash-data.ts uses for Plaid items so the
// two can be merged at read time.
//
// Apple Card CSV format (iOS 17.4+ Wallet export):
//   Transaction Date,Clearing Date,Description,Merchant,Category,Type,Amount (USD),Purchased By
//   04/15/2025,04/16/2025,APPLE.COM/BILL 866-712-7753 CA,Apple,Services,Purchase,9.99,Primary
//
// Apple Card amounts: POSITIVE for purchases (outflows), NEGATIVE for credits
// and payments (inflows). We normalize to Plaid's convention internally so
// the downstream categorization logic works without special-casing.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PROJECT_ROOT } from './config.js';
import { logger } from './logger.js';

const ACCOUNTS_FILE = path.join(PROJECT_ROOT, 'store', 'manual-accounts.json');
const TXNS_FILE = path.join(PROJECT_ROOT, 'store', 'manual-transactions.json');

export interface ManualAccount {
  account_id: string;
  institution_name: string;
  name: string;
  mask: string | null;
  type: 'depository' | 'credit' | 'loan' | 'investment';
  subtype: string | null;
  balance_current: number | null;        // dollars; positive for cash, positive (owed) for credit
  balance_available: number | null;       // for credit cards, this is the available credit
  currency: string;
  source: 'manual-csv';
  last_imported_at: string;               // ISO datetime
}

export interface ManualTransaction {
  transaction_id: string;                 // deterministic hash of date + description + amount
  account_id: string;
  date: string;                           // YYYY-MM-DD
  name: string;
  merchant: string | null;
  amount: number;                         // Plaid convention: positive = outflow, negative = inflow
  iso_currency_code: string;
  category: string[] | null;              // raw category from CSV if available
  pending: boolean;
  source: 'manual-csv';
  billing_period_start: string | null;    // YYYY-MM-DD, set when imported as part of a statement
  billing_period_end: string | null;
}

function readJson<T>(p: string, fallback: T): T {
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); }
  catch { return fallback; }
}
function writeJson(p: string, v: unknown): void {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(v, null, 2));
}

export function loadManualAccounts(): ManualAccount[] {
  return readJson<ManualAccount[]>(ACCOUNTS_FILE, []);
}
export function loadManualTransactions(): ManualTransaction[] {
  return readJson<ManualTransaction[]>(TXNS_FILE, []);
}

function saveManualAccounts(v: ManualAccount[]): void { writeJson(ACCOUNTS_FILE, v); }
function saveManualTransactions(v: ManualTransaction[]): void { writeJson(TXNS_FILE, v); }

function txnHash(accountId: string, date: string, name: string, amount: number): string {
  const h = crypto.createHash('sha256');
  h.update(accountId + '|' + date + '|' + name + '|' + amount.toFixed(2));
  return 'csv_' + h.digest('hex').slice(0, 16);
}

function isoDate(input: string): string | null {
  // Accept MM/DD/YYYY (Apple), YYYY-MM-DD, M/D/YY.
  const s = input.trim();
  let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) {
    return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  }
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/))) {
    const yy = m[3].length === 2 ? (parseInt(m[3], 10) < 50 ? '20' + m[3] : '19' + m[3]) : m[3];
    return `${yy}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  }
  return null;
}

function parseCsvLine(line: string): string[] {
  // Minimal CSV line parser: handles quoted fields with commas inside.
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { cur += c; }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { out.push(cur); cur = ''; }
      else cur += c;
    }
  }
  out.push(cur);
  return out.map(s => s.trim());
}

export interface ImportArgs {
  institution_name: string;               // "Apple Card", "Chase Sapphire", etc.
  account_name: string;                   // "Apple Card", "Chase Sapphire Preferred", etc.
  mask: string;                           // last 4 of card
  account_type?: 'credit' | 'depository' | 'loan';
  account_subtype?: string;
  statement_balance?: number;             // current statement balance (dollars). For credit cards: amount owed.
  available_credit?: number;              // for credit cards
  csv_text: string;
  billing_period_start?: string;          // YYYY-MM-DD, optional but recommended for idempotency
  billing_period_end?: string;
}

export interface ImportResult {
  account_id: string;
  inserted: number;
  updated: number;
  skipped_invalid: number;
  billing_period: { start: string | null; end: string | null };
  errors: string[];
}

/** Import an Apple Card CSV (or any CSV with the expected header). Replaces
 *  any prior transactions for the same account in the same billing period,
 *  so re-uploading the same month is idempotent. */
export function importCsv(args: ImportArgs): ImportResult {
  const errors: string[] = [];
  const lines = args.csv_text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) {
    throw new Error('CSV is empty or missing data rows');
  }

  // Detect header. Apple Card format has "Transaction Date" and "Amount (USD)".
  const headerCells = parseCsvLine(lines[0]).map(s => s.toLowerCase());
  const findCol = (...candidates: string[]) => {
    for (const c of candidates) {
      const idx = headerCells.indexOf(c.toLowerCase());
      if (idx >= 0) return idx;
    }
    return -1;
  };
  const colDate = findCol('transaction date', 'date');
  const colDesc = findCol('description', 'name', 'memo');
  const colMerchant = findCol('merchant');
  const colCategory = findCol('category');
  const colType = findCol('type');                // Apple: 'Purchase' | 'Payment' | 'Refund'
  const colAmount = findCol('amount (usd)', 'amount');

  if (colDate < 0 || colDesc < 0 || colAmount < 0) {
    throw new Error('CSV missing required columns. Need at least Date, Description, Amount. Found: ' + headerCells.join(', '));
  }

  // Establish/update the virtual account.
  const accountId = 'manual_' + crypto.createHash('sha1')
    .update(args.institution_name + '|' + args.account_name + '|' + args.mask)
    .digest('hex').slice(0, 16);

  const accounts = loadManualAccounts();
  let acc = accounts.find(a => a.account_id === accountId);
  if (!acc) {
    acc = {
      account_id: accountId,
      institution_name: args.institution_name,
      name: args.account_name,
      mask: args.mask || null,
      type: args.account_type || 'credit',
      subtype: args.account_subtype || (args.account_type === 'credit' ? 'credit card' : null),
      balance_current: args.statement_balance ?? null,
      balance_available: args.available_credit ?? null,
      currency: 'USD',
      source: 'manual-csv',
      last_imported_at: new Date().toISOString(),
    };
    accounts.push(acc);
  } else {
    if (args.statement_balance !== undefined) acc.balance_current = args.statement_balance;
    if (args.available_credit !== undefined) acc.balance_available = args.available_credit;
    acc.last_imported_at = new Date().toISOString();
  }
  saveManualAccounts(accounts);

  // Parse rows.
  const newTxns: ManualTransaction[] = [];
  let skipped = 0;
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    if (cells.length < headerCells.length - 2) { skipped++; continue; } // tolerant on trailing missing cols
    const date = isoDate(cells[colDate] || '');
    if (!date) { skipped++; continue; }
    const desc = cells[colDesc] || '';
    const merchant = colMerchant >= 0 ? (cells[colMerchant] || null) : null;
    const category = colCategory >= 0 && cells[colCategory] ? [cells[colCategory]] : null;
    const type = colType >= 0 ? (cells[colType] || '').toLowerCase() : '';
    let amountRaw = (cells[colAmount] || '0').replace(/[$,]/g, '').trim();
    if (amountRaw === '' || isNaN(Number(amountRaw))) { skipped++; continue; }
    let amount = Number(amountRaw);
    // Apple Card sign convention: positive purchases, negative credits/payments.
    // Plaid convention: positive = outflow, negative = inflow. Apple matches Plaid for purchases.
    // BUT some CSV exports use negative for outflow (debit) and positive for inflow.
    // Heuristic: if "Type" column says Payment or Refund or Credit, treat amount as inflow regardless of sign.
    if (/payment|refund|credit|return/.test(type)) {
      amount = -Math.abs(amount);
    }
    // Apple's CSV with a "Type=Purchase" row keeps the positive value, which is correct for Plaid convention.

    newTxns.push({
      transaction_id: txnHash(accountId, date, desc, amount),
      account_id: accountId,
      date,
      name: desc,
      merchant,
      amount,
      iso_currency_code: 'USD',
      category,
      pending: false,
      source: 'manual-csv',
      billing_period_start: args.billing_period_start || null,
      billing_period_end: args.billing_period_end || null,
    });
  }

  // Idempotency: if billing_period given, replace all prior txns for the same
  // account in that period. Otherwise, upsert by transaction_id (dedupe).
  const existing = loadManualTransactions();
  let kept: ManualTransaction[];
  if (args.billing_period_start && args.billing_period_end) {
    kept = existing.filter(t => !(t.account_id === accountId &&
      t.billing_period_start === args.billing_period_start &&
      t.billing_period_end === args.billing_period_end));
  } else {
    const newIds = new Set(newTxns.map(t => t.transaction_id));
    kept = existing.filter(t => !(t.account_id === accountId && newIds.has(t.transaction_id)));
  }
  const updated = existing.length - kept.length;
  const merged = [...kept, ...newTxns];
  saveManualTransactions(merged);

  return {
    account_id: accountId,
    inserted: newTxns.length,
    updated,
    skipped_invalid: skipped,
    billing_period: { start: args.billing_period_start ?? null, end: args.billing_period_end ?? null },
    errors,
  };
}

/** Delete a manual account and all its transactions (e.g. user wants to disconnect Apple Card). */
export function deleteManualAccount(accountId: string): void {
  const accounts = loadManualAccounts().filter(a => a.account_id !== accountId);
  const txns = loadManualTransactions().filter(t => t.account_id !== accountId);
  saveManualAccounts(accounts);
  saveManualTransactions(txns);
  logger.info({ accountId }, 'manual: account deleted');
}
