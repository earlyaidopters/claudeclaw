// Sales pipeline + accounts data for Mission Control.
//
// Pipeline columns mirror Vendasta's opportunity pipeline by high-level stage:
//   Open / Won / Lost  (the configured funnel sub-stages — Lead/Contact/
//   Qualified/Proposal — are not exposed by the opportunities API).
// Plus a Customer column (lifecycle Customer accounts) kept with revenue.
//
// Deals come from the sales-opportunities Connect API (scope sales.opportunity)
// via the stdio connector. Customers come from the CRM companies (lifecycle
// Customer). Revenue (retail MRR + wholesale) is background-refreshed and
// overlaid on customers. Notes are a local store; edits write via updateCard.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';

import { readEnvFile } from './env.js';
import { PROJECT_ROOT } from './config.js';
import { logger } from './logger.js';

const execFileAsync = promisify(execFile);
const VENDASTA_SERVER = path.join(PROJECT_ROOT, 'connectors', 'vendasta', 'server.mjs');
const NOTES_FILE = path.join(PROJECT_ROOT, 'store', 'pipeline-notes.json');
const STATUS_FILE = path.join(PROJECT_ROOT, 'store', 'pipeline-status.json');
const TTL_MS = 3 * 60 * 1000;
const REVENUE_TTL_MS = 30 * 60 * 1000;

// Per-customer outreach status (account-management touches). Local store, like notes.
// Extended for BID Traffic Partnership campaign: 8-stage funnel ending at Endorsed.
export const OUTREACH_STATUSES = [
  'Not contacted',
  'Emailed',
  'Opened',
  'Replied',
  'Webinar Booked',
  'Webinar Held',
  'Endorsed',
  'Declined',
] as const;
const DEFAULT_STATUS = 'Not contacted';

function env() { return readEnvFile(['VENDASTA_CREDENTIALS', 'VENDASTA_NAMESPACE']); }

async function vendastaCall(tool: string, args: Record<string, unknown>): Promise<any> {
  const e = env();
  const creds = e.VENDASTA_CREDENTIALS || path.join(PROJECT_ROOT, 'secrets', 'vendasta-nikki-service-account.json');
  const ns = e.VENDASTA_NAMESPACE || '0BYD';
  const { stdout } = await execFileAsync('node', [VENDASTA_SERVER, '--call', tool, JSON.stringify(args)], {
    env: { ...process.env, VENDASTA_CREDENTIALS: creds, VENDASTA_NAMESPACE: ns },
    maxBuffer: 32 * 1024 * 1024,
  });
  return JSON.parse(stdout);
}

function obj(o: any): Record<string, any> {
  const out: Record<string, any> = {};
  for (const f of (o.fields || [])) out[f.id] = f.value;
  return out;
}

// ---- ClickUp mirror (outreach status -> ImpactWorks ▸ CRM ▸ Accounts task tags) ----
const CLICKUP_SERVER = path.join(PROJECT_ROOT, 'connectors', 'clickup', 'server.mjs');
const CLICKUP_ACCOUNTS_LIST_ID = '901326621325';
const TAG_PREFIX = 'outreach:';
const CU_MAP_TTL_MS = 10 * 60 * 1000;

function clickupEnv() { return readEnvFile(['CLICKUP_API_TOKEN', 'CLICKUP_TEAM_ID']); }
async function clickupCall(tool: string, args: Record<string, unknown>): Promise<any> {
  const e = clickupEnv();
  const { stdout } = await execFileAsync('node', [CLICKUP_SERVER, '--call', tool, JSON.stringify(args)], {
    env: {
      ...process.env,
      CLICKUP_API_TOKEN: e.CLICKUP_API_TOKEN || process.env.CLICKUP_API_TOKEN || '',
      CLICKUP_TEAM_ID: e.CLICKUP_TEAM_ID || process.env.CLICKUP_TEAM_ID || '10584109',
    },
    maxBuffer: 32 * 1024 * 1024,
  });
  return JSON.parse(stdout);
}

// Map a status to a single space-free tag slug. Default status = no tag.
function statusSlug(status: string): string | null {
  if (!status || status === DEFAULT_STATUS) return null;
  return TAG_PREFIX + status.toLowerCase().replace(/\s+/g, '-');
}
// Normalize a company name for cross-system matching.
function normName(s: string | null | undefined): string {
  return (s || '').toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\b(llc|inc|co|corp|ltd|the|company|group)\b/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

// Cached normalized-name -> ClickUp Accounts task id map.
let cuMap: { at: number; byName: Record<string, string> } | null = null;
async function clickupAccountsMap(): Promise<Record<string, string>> {
  if (cuMap && Date.now() - cuMap.at < CU_MAP_TTL_MS) return cuMap.byName;
  const byName: Record<string, string> = {};
  try {
    for (let page = 0; page < 10; page++) {
      const res = await clickupCall('clickup_get_tasks', { list_id: CLICKUP_ACCOUNTS_LIST_ID, include_closed: true, page });
      const tasks: any[] = res.tasks || [];
      for (const t of tasks) { const n = normName(t.name); if (n && !byName[n]) byName[n] = t.id; }
      if (tasks.length < 100 || res.last_page) break;
    }
    cuMap = { at: Date.now(), byName };
  } catch (e) {
    logger.warn({ err: String((e as Error)?.message || e) }, 'pipeline: clickup accounts map failed');
    return cuMap?.byName || {};
  }
  return byName;
}

async function mirrorToClickup(companyName: string | null, status: string): Promise<'updated' | 'no-match' | 'error'> {
  if (!companyName) return 'no-match';
  try {
    const map = await clickupAccountsMap();
    const taskId = map[normName(companyName)];
    if (!taskId) return 'no-match';
    const task = await clickupCall('clickup_get_task', { task_id: taskId });
    const stale: string[] = (task.tags || []).map((t: any) => t.name).filter((n: string) => typeof n === 'string' && n.startsWith(TAG_PREFIX));
    for (const tag of stale) { try { await clickupCall('clickup_remove_tag', { task_id: taskId, tag_name: tag }); } catch { /* ignore */ } }
    const slug = statusSlug(status);
    if (slug) await clickupCall('clickup_add_tag', { task_id: taskId, tag_name: slug });
    return 'updated';
  } catch (e) {
    logger.warn({ err: String((e as Error)?.message || e) }, 'pipeline: clickup status mirror failed');
    return 'error';
  }
}

// Mirror outreach status to Vendasta (company tag) and ClickUp (Accounts task tag).
// Reads the company once to merge tags and recover the name if not supplied.
async function mirrorStatus(companyId: string, nameHint: string | null, status: string): Promise<string[]> {
  const applied: string[] = [];
  let name = nameHint;
  try {
    const r = await vendastaCall('vendasta_list_records', {
      resourceTypeCode: 'companies',
      filters: [{ id: 'system__company_id', value: companyId, operation: 'IS' }],
      returnFields: ['standard__company_name', 'standard__company_tags'],
      limit: 1,
    });
    const cur = (r.objects && r.objects[0]) ? obj(r.objects[0]) : {};
    if (!name) name = cur.standard__company_name ?? null;
    const raw = cur.standard__company_tags;
    const existing: string[] = Array.isArray(raw) ? raw : (raw ? [raw] : []);
    const kept = existing.filter((t) => typeof t === 'string' && !t.startsWith(TAG_PREFIX));
    const slug = statusSlug(status);
    const next = slug ? [...kept, slug] : kept;
    await vendastaCall('vendasta_upsert_record', {
      resourceTypeCode: 'companies',
      searchExisting: ['system__company_id'],
      fields: [
        { id: 'system__company_id', value: companyId },
        { id: 'standard__company_tags', value: next },
      ],
    });
    applied.push('vendasta');
  } catch (e) {
    logger.warn({ err: String((e as Error)?.message || e) }, 'pipeline: vendasta status mirror failed');
  }
  const cu = await mirrorToClickup(name, status);
  if (cu === 'updated') applied.push('clickup');
  else if (cu === 'no-match') applied.push('clickup:no-match');
  return applied;
}

function loadNotes(): Record<string, string> {
  try { return JSON.parse(fs.readFileSync(NOTES_FILE, 'utf-8')); } catch { return {}; }
}
function saveNote(id: string, note: string): void {
  const n = loadNotes();
  if (note && note.trim()) n[id] = note; else delete n[id];
  try { fs.mkdirSync(path.dirname(NOTES_FILE), { recursive: true }); } catch { /* ignore */ }
  fs.writeFileSync(NOTES_FILE, JSON.stringify(n, null, 2));
}

function loadStatuses(): Record<string, string> {
  try { return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8')); } catch { return {}; }
}
function saveStatus(id: string, status: string): void {
  const s = loadStatuses();
  if (status && status.trim() && status !== DEFAULT_STATUS) s[id] = status; else delete s[id];
  try { fs.mkdirSync(path.dirname(STATUS_FILE), { recursive: true }); } catch { /* ignore */ }
  fs.writeFileSync(STATUS_FILE, JSON.stringify(s, null, 2));
}

// ---- Revenue (background-refreshed) ----
interface RevenueRow { retailMRR: number; wholesaleMonthly: number; wholesaleLifetime: number; }
interface RevenueData { byAccount: Record<string, RevenueRow>; totals: { retailMRR: number; wholesaleMonthly: number; accounts: number }; }
let revenueState: { at: number; data: RevenueData | null; refreshing: boolean } = { at: 0, data: null, refreshing: false };
async function refreshRevenue() {
  if (revenueState.refreshing) return;
  revenueState.refreshing = true;
  try {
    const r = await vendastaCall('vendasta_revenue_by_account', {});
    revenueState = { at: Date.now(), data: r, refreshing: false };
  } catch (e) {
    revenueState.refreshing = false;
    logger.warn({ err: String((e as Error)?.message || e) }, 'pipeline: revenue refresh failed');
  }
}
function getRevenue(): RevenueData | null {
  const fresh = revenueState.data && Date.now() - revenueState.at < REVENUE_TTL_MS;
  if (!fresh && !revenueState.refreshing) { void refreshRevenue(); }
  return revenueState.data;
}

export interface DealCard {
  id: string;
  name: string;
  accountName: string | null;
  accountGroupId: string | null;
  value: number;          // projected first-year value, cents
  weighted: number;       // probable first-year value, cents
  probability: number | null;
  expectedCloseDate: string | null;
  stage: string;          // raw pipelineStage
}

export interface AccountCard {
  id: string;
  accountGroupId: string | null;
  name: string;
  website: string | null;
  reviewScore: number | null;
  reviewCount: number | null;
  websiteGrade: string | null;
  listingsAccuracy: number | null;
  notes: string | null;
  outreachStatus: string;
  retailMRR: number | null;
  wholesaleMonthly: number | null;
  wholesaleLifetime: number | null;
  margin: number | null;
}

interface StageTotal { count: number; value: number; weighted: number; }

export interface PipelineData {
  generatedAt: number;
  deals: { open: DealCard[]; won: DealCard[]; lost: DealCard[] };
  dealTotals: { open: StageTotal; won: StageTotal; lost: StageTotal };
  customers: AccountCard[];
  revenue: { ready: boolean; currency: string; totalRetailMRR: number | null; totalWholesaleMonthly: number | null; asOf: number | null };
  outreachStatuses: string[];
}

let cache: { at: number; data: PipelineData } | null = null;

async function byStage(stage: string, limit = 100): Promise<any[]> {
  const res = await vendastaCall('vendasta_list_records', {
    resourceTypeCode: 'companies',
    filters: [{ id: 'standard__company_lifecycle_stage', value: stage, operation: 'IS' }],
    limit,
  });
  return (res.objects || []).map(obj);
}

async function build(): Promise<PipelineData> {
  // Opportunities (deals)
  const oppRes = await vendastaCall('vendasta_list_opportunities', {});
  const opps: any[] = oppRes.results || [];
  const dealAgs = [...new Set(opps.map((o) => o.accountGroupId).filter(Boolean))];

  // Resolve deal account names
  const agName: Record<string, string> = {};
  if (dealAgs.length) {
    try {
      const r = await vendastaCall('vendasta_list_records', {
        resourceTypeCode: 'companies',
        filters: [{ id: 'platform__company_account_group_id', value: dealAgs, operation: 'IS_ANY' }],
        returnFields: ['standard__company_name', 'platform__company_account_group_id'],
        limit: 200,
      });
      for (const o of (r.objects || [])) {
        const f = obj(o);
        if (f.platform__company_account_group_id) agName[f.platform__company_account_group_id] = f.standard__company_name;
      }
    } catch (e) {
      logger.warn({ err: String((e as Error)?.message || e) }, 'pipeline: deal account name lookup failed');
    }
  }

  const toDeal = (o: any): DealCard => ({
    id: o.opportunityId,
    name: o.name || '(unnamed deal)',
    accountName: (o.accountGroupId && agName[o.accountGroupId]) || null,
    accountGroupId: o.accountGroupId || null,
    value: Number(o.projectedFirstYearValue || 0),
    weighted: Number(o.probableFirstYearValue || 0),
    probability: o.probability != null ? o.probability : null,
    expectedCloseDate: o.expectedCloseDate || null,
    stage: o.pipelineStage || 'open',
  });

  const open: DealCard[] = [], won: DealCard[] = [], lost: DealCard[] = [];
  for (const o of opps) {
    const st = (o.pipelineStage || '').toLowerCase();
    const card = toDeal(o);
    if (st === 'closed-won') won.push(card);
    else if (st === 'closed-lost') lost.push(card);
    else open.push(card);
  }
  const sortByVal = (a: DealCard, b: DealCard) => b.value - a.value;
  open.sort(sortByVal); won.sort(sortByVal); lost.sort(sortByVal);
  const sum = (arr: DealCard[]): StageTotal => ({
    count: arr.length,
    value: arr.reduce((s, c) => s + c.value, 0),
    weighted: arr.reduce((s, c) => s + c.weighted, 0),
  });

  // Customers (lifecycle Customer accounts)
  const customerRecs = await byStage('Customer');
  const notes = loadNotes();
  const statuses = loadStatuses();
  const customers: AccountCard[] = customerRecs.map((r: any) => ({
    id: r.system__company_id,
    accountGroupId: r.platform__company_account_group_id ?? null,
    name: r.standard__company_name,
    website: r.standard__company_website ?? null,
    reviewScore: r.standard__company_average_review_score ?? null,
    reviewCount: r.standard__company_number_of_reviews ?? null,
    websiteGrade: r.standard__company_website_grade ?? null,
    listingsAccuracy: r.standard__company_listings_percentage_of_accurate_listings ?? null,
    notes: notes[r.system__company_id] ?? null,
    outreachStatus: statuses[r.system__company_id] ?? DEFAULT_STATUS,
    retailMRR: null, wholesaleMonthly: null, wholesaleLifetime: null, margin: null,
  }));

  return {
    generatedAt: Date.now(),
    deals: { open, won, lost },
    dealTotals: { open: sum(open), won: sum(won), lost: sum(lost) },
    customers,
    revenue: { ready: false, currency: 'USD', totalRetailMRR: null, totalWholesaleMonthly: null, asOf: null },
    outreachStatuses: [...OUTREACH_STATUSES],
  };
}

function overlayRevenue(data: PipelineData): void {
  const rev = getRevenue();
  const map = rev?.byAccount || {};
  for (const c of data.customers) {
    const r = c.accountGroupId ? map[c.accountGroupId] : undefined;
    c.retailMRR = r ? r.retailMRR : null;
    c.wholesaleMonthly = r ? r.wholesaleMonthly : null;
    c.wholesaleLifetime = r ? r.wholesaleLifetime : null;
    c.margin = r ? r.retailMRR - r.wholesaleMonthly : null;
  }
  data.revenue = {
    ready: !!rev, currency: 'USD',
    totalRetailMRR: rev?.totals?.retailMRR ?? null,
    totalWholesaleMonthly: rev?.totals?.wholesaleMonthly ?? null,
    asOf: revenueState.at || null,
  };
}

export async function getPipelineData(force = false): Promise<PipelineData> {
  if (force || !cache || Date.now() - cache.at >= TTL_MS) {
    const data = await build();
    cache = { at: Date.now(), data };
  }
  overlayRevenue(cache.data);
  return cache.data;
}

// ---- Writes (Customer accounts: notes + contact; stage optional) ----
export interface CardUpdate {
  companyId: string;
  companyName?: string;
  stage?: string;
  contactName?: string;
  contactEmail?: string;
  notes?: string;
  outreachStatus?: string;
}

export async function updateCard(u: CardUpdate): Promise<{ ok: true; applied: string[] }> {
  const applied: string[] = [];
  if (!u.companyId) throw new Error('companyId required');

  if (u.stage) {
    await vendastaCall('vendasta_upsert_record', {
      resourceTypeCode: 'companies',
      searchExisting: ['system__company_id'],
      fields: [
        { id: 'system__company_id', value: u.companyId },
        { id: 'standard__company_lifecycle_stage', value: u.stage },
      ],
    });
    applied.push('stage');
  }
  if (u.contactName !== undefined || u.contactEmail !== undefined) {
    const fields: any[] = [{ id: 'standard__contact_primary_company_id', value: u.companyId }];
    if (u.contactName !== undefined) {
      const parts = String(u.contactName).trim().split(/\s+/);
      fields.push({ id: 'standard__first_name', value: parts.shift() || '' });
      fields.push({ id: 'standard__last_name', value: parts.join(' ') });
    }
    if (u.contactEmail !== undefined) fields.push({ id: 'standard__email', value: u.contactEmail });
    await vendastaCall('vendasta_upsert_record', { resourceTypeCode: 'contacts', searchExisting: ['standard__contact_primary_company_id'], fields });
    applied.push('contact');
  }
  if (u.notes !== undefined) { saveNote(u.companyId, u.notes); applied.push('notes'); }
  if (u.outreachStatus !== undefined) {
    saveStatus(u.companyId, u.outreachStatus);
    applied.push('status');
    // Best-effort mirror to the systems of record (does not block the local save).
    const mirrored = await mirrorStatus(u.companyId, u.companyName ?? null, u.outreachStatus);
    applied.push(...mirrored);
  }

  cache = null;
  return { ok: true, applied };
}
