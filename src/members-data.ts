// BID Member sub-pipeline (Tier 2 — the actual revenue).
//
// Each endorsed BID gets a roster of member businesses signing up at the
// BID-discounted price ($169/mo standard). We track signups, MRR, and
// pricing-tier math from Final BID Pricing.xlsx.
//
// Source of truth (manual for now): store/members.json. The Outreach
// Tracker's "Endorsed" status is the gate that adds a BID to this view.
// A future iteration can sync member rosters from Vendasta or QuickBooks.

import fs from 'node:fs';
import path from 'node:path';
import { PROJECT_ROOT } from './config.js';

const MEMBERS_FILE = path.join(PROJECT_ROOT, 'store', 'members.json');
const ROSTER_FILE = path.join(PROJECT_ROOT, 'store', 'bid-roster.json');
const STATUS_FILE = path.join(PROJECT_ROOT, 'store', 'outreach-status.json');

// BID-member discounted price (cents).
export const BID_MEMBER_PRICE_CENTS = 16900;

// Ads pricing tiers from Final BID Pricing.xlsx (member count -> monthly price cents).
// Used when a BID purchases bundled volume rather than per-member.
export const ADS_TIERS: Array<{ accounts: number; priceCents: number }> = [
  { accounts: 1, priceCents: 2500 },
  { accounts: 2, priceCents: 4900 },
  { accounts: 3, priceCents: 7000 },
  { accounts: 5, priceCents: 11500 },
  { accounts: 7, priceCents: 15500 },
  { accounts: 10, priceCents: 20000 },
  { accounts: 13, priceCents: 26000 },
  { accounts: 15, priceCents: 30000 },
  { accounts: 20, priceCents: 40000 },
  { accounts: 25, priceCents: 50000 },
  { accounts: 35, priceCents: 70000 },
  { accounts: 50, priceCents: 100000 },
];
export const BOTS_TIERS: Array<{ accounts: number; priceCents: number }> = [
  { accounts: 1, priceCents: 2000 },
  { accounts: 2, priceCents: 3900 },
  { accounts: 3, priceCents: 5700 },
  { accounts: 5, priceCents: 9000 },
  { accounts: 7, priceCents: 11900 },
  { accounts: 10, priceCents: 16000 },
  { accounts: 13, priceCents: 19500 },
  { accounts: 15, priceCents: 22500 },
  { accounts: 20, priceCents: 30000 },
  { accounts: 25, priceCents: 37500 },
  { accounts: 35, priceCents: 52500 },
  { accounts: 50, priceCents: 75000 },
];
// Additional after 50: $20 each (ads) / $15 each (bots).
const ADS_OVERAGE_CENTS = 2000;
const BOTS_OVERAGE_CENTS = 1500;

export function priceForAds(accounts: number): number {
  let last = ADS_TIERS[0];
  for (const t of ADS_TIERS) { if (t.accounts <= accounts) last = t; }
  if (accounts <= 50) return last.priceCents;
  return ADS_TIERS[ADS_TIERS.length - 1].priceCents + (accounts - 50) * ADS_OVERAGE_CENTS;
}
export function priceForBots(accounts: number): number {
  let last = BOTS_TIERS[0];
  for (const t of BOTS_TIERS) { if (t.accounts <= accounts) last = t; }
  if (accounts <= 50) return last.priceCents;
  return BOTS_TIERS[BOTS_TIERS.length - 1].priceCents + (accounts - 50) * BOTS_OVERAGE_CENTS;
}

export interface Member {
  id: string;                  // local id (uuid-ish)
  bidEmail: string;            // the BID director's email this member belongs to
  businessName: string;
  contactName: string | null;
  contactEmail: string | null;
  productMix: 'Ads' | 'Bots' | 'Ads+Bots';
  monthlyPriceCents: number;   // typically $169 ($16,900 cents)
  status: 'Trial' | 'Active' | 'Paused' | 'Churned';
  signedUpAt: number;          // ms epoch
  notes: string | null;
}

interface MembersStore {
  generatedAt: number;
  members: Member[];
}

interface BidContact { email: string; entity: string; city: string | null; contact: string | null; members?: number | null; }

function readJson<T>(p: string, fallback: T): T {
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); }
  catch { return fallback; }
}
function writeJson(p: string, v: unknown): void {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(v, null, 2));
}
function loadStore(): MembersStore {
  return readJson<MembersStore>(MEMBERS_FILE, { generatedAt: 0, members: [] });
}
function saveStore(s: MembersStore): void { writeJson(MEMBERS_FILE, s); }
function loadRoster(): BidContact[] {
  const r = readJson<{ bids?: BidContact[] }>(ROSTER_FILE, { bids: [] });
  return r.bids ?? [];
}
function loadOutreachStatus(): Record<string, string> {
  return readJson<Record<string, string>>(STATUS_FILE, {});
}

export interface BidMemberRollup {
  bidEmail: string;
  entity: string;
  city: string | null;
  contact: string | null;
  status: string;             // Outreach status — only Endorsed BIDs show member columns
  membersTarget: number | null;     // Approx. Businesses from roster
  membersActive: number;
  membersTrial: number;
  membersChurned: number;
  monthlyRevenueCents: number;      // sum of active member MRR
  penetrationPct: number | null;    // active / target
  members: Member[];
}

export interface MembersDataView {
  generatedAt: number;
  rollups: BidMemberRollup[];
  totals: {
    bidsEndorsed: number;
    activeMembers: number;
    totalMRRCents: number;
    pipelineCeilingCents: number;     // sum of (members target × $169) across all NC BIDs
  };
}

export function getMembersData(): MembersDataView {
  const store = loadStore();
  const roster = loadRoster();
  const statuses = loadOutreachStatus();

  const byBid = new Map<string, Member[]>();
  for (const m of store.members) {
    const arr = byBid.get(m.bidEmail) ?? [];
    arr.push(m);
    byBid.set(m.bidEmail, arr);
  }

  const rollups: BidMemberRollup[] = [];
  let totalMRR = 0;
  let activeMembers = 0;
  let pipelineCeiling = 0;
  let endorsedCount = 0;
  for (const b of roster) {
    const email = b.email.toLowerCase();
    const status = statuses[email] || 'Not contacted';
    const list = byBid.get(email) || [];
    const active = list.filter(m => m.status === 'Active');
    const trial = list.filter(m => m.status === 'Trial');
    const churned = list.filter(m => m.status === 'Churned');
    const mrr = active.reduce((s, m) => s + m.monthlyPriceCents, 0);
    if (status === 'Endorsed') endorsedCount++;
    activeMembers += active.length;
    totalMRR += mrr;
    if (typeof b.members === 'number') pipelineCeiling += b.members * BID_MEMBER_PRICE_CENTS;

    // Only surface a rollup row if endorsed OR has at least one member already.
    if (status !== 'Endorsed' && list.length === 0) continue;

    rollups.push({
      bidEmail: email,
      entity: b.entity,
      city: b.city,
      contact: b.contact,
      status,
      membersTarget: typeof b.members === 'number' ? b.members : null,
      membersActive: active.length,
      membersTrial: trial.length,
      membersChurned: churned.length,
      monthlyRevenueCents: mrr,
      penetrationPct: typeof b.members === 'number' && b.members > 0 ? active.length / b.members : null,
      members: list.sort((a, c) => c.signedUpAt - a.signedUpAt),
    });
  }

  rollups.sort((a, b) => b.monthlyRevenueCents - a.monthlyRevenueCents);

  return {
    generatedAt: Date.now(),
    rollups,
    totals: {
      bidsEndorsed: endorsedCount,
      activeMembers,
      totalMRRCents: totalMRR,
      pipelineCeilingCents: pipelineCeiling,
    },
  };
}

/** Add a new member to a BID. Defaults to $169/mo, Trial status. */
export function addMember(args: {
  bidEmail: string;
  businessName: string;
  contactName?: string;
  contactEmail?: string;
  productMix?: 'Ads' | 'Bots' | 'Ads+Bots';
  monthlyPriceCents?: number;
  status?: Member['status'];
  notes?: string;
}): Member {
  const store = loadStore();
  const m: Member = {
    id: `mem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    bidEmail: args.bidEmail.toLowerCase(),
    businessName: args.businessName.trim(),
    contactName: args.contactName ?? null,
    contactEmail: args.contactEmail ?? null,
    productMix: args.productMix ?? 'Ads+Bots',
    monthlyPriceCents: args.monthlyPriceCents ?? BID_MEMBER_PRICE_CENTS,
    status: args.status ?? 'Trial',
    signedUpAt: Date.now(),
    notes: args.notes ?? null,
  };
  store.members.push(m);
  store.generatedAt = Date.now();
  saveStore(store);
  return m;
}

/** Update a member's status. Used when Trial → Active, Active → Paused, etc. */
export function updateMember(id: string, updates: Partial<Pick<Member, 'status' | 'monthlyPriceCents' | 'productMix' | 'notes' | 'contactName' | 'contactEmail'>>): Member | null {
  const store = loadStore();
  const m = store.members.find(x => x.id === id);
  if (!m) return null;
  Object.assign(m, updates);
  store.generatedAt = Date.now();
  saveStore(store);
  return m;
}
