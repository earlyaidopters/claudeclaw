// Founder Dashboard data layer.
//
// Single read that fans out to Cash + Pipeline + Outreach + Members and
// composes a unified "what matters today" view. Failure of one source
// doesn't kill the page — every section is independently nullable so the
// dashboard degrades gracefully when something is offline.

import { getCashData, type CashSummary } from './cash-data.js';
import { getPipelineData } from './pipeline-data.js';
import { getOutreachData } from './outreach-data.js';
import { getMembersData } from './members-data.js';
import { logger } from './logger.js';

export interface FounderDashboardSection<T> {
  ok: boolean;
  error: string | null;
  data: T | null;
}

export interface AttentionItem {
  severity: 'critical' | 'warn' | 'info';
  source: 'cash' | 'pipeline' | 'outreach' | 'members';
  title: string;
  detail: string;
  href: string;       // Mission Control route the user should jump to
}

export interface FounderDashboard {
  generatedAt: number;

  // Cash snapshot
  cash: FounderDashboardSection<{
    totalCashCents: number;
    mtdRevenueCents: number;
    mtdNetCents: number;
    runwayDays: number | null;
    last30NetCents: number;
    connectionStatus: CashSummary['connectionStatus'];
  }>;

  // Pipeline snapshot (Vendasta deals + customers)
  pipeline: FounderDashboardSection<{
    openDealsCount: number;
    openDealsValueCents: number;
    openDealsWeightedCents: number;
    customersCount: number;
    customersMRRCents: number | null;
    customersWholesaleMonthlyCents: number | null;
  }>;

  // Outreach snapshot (BID campaign)
  outreach: FounderDashboardSection<{
    totalBids: number;
    membersBehindThem: number;
    notContacted: number;
    emailed: number;
    replied: number;
    webinarBooked: number;
    endorsed: number;
    declined: number;
    needsFollowupCount: number;     // any row whose nextAction starts with "Follow-up"
    topPriority: Array<{ entity: string; city: string | null; email: string; status: string; daysSinceLastTouch: number | null; nextAction: string }>;
  }>;

  // BID Members snapshot (tier 2 revenue)
  members: FounderDashboardSection<{
    bidsEndorsed: number;
    activeMembers: number;
    totalMRRCents: number;
    pipelineCeilingCents: number;
  }>;

  // The single most important thing right now, computed from all four
  // sources. May be null on a healthy day.
  primaryAttention: AttentionItem | null;

  // Everything else that needs attention, sorted by severity.
  attentionList: AttentionItem[];
}

const DAY = 24 * 3600 * 1000;

function safe<T>(label: string, fn: () => Promise<T> | T): Promise<FounderDashboardSection<T>> {
  return Promise.resolve()
    .then(fn)
    .then((data) => ({ ok: true, error: null, data }))
    .catch((e) => {
      logger.warn({ section: label, err: String((e as Error)?.message || e) }, 'founder dashboard section failed');
      return { ok: false, error: String((e as Error)?.message || e), data: null };
    });
}

export async function getFounderDashboard(): Promise<FounderDashboard> {
  // Fan out in parallel — these are independent IO calls.
  const [cashS, pipelineS, outreachS, membersS] = await Promise.all([
    safe('cash', async () => {
      const c = await getCashData(false);
      return {
        totalCashCents: c.totalCashCents,
        mtdRevenueCents: c.mtd.revenueCents,
        mtdNetCents: c.mtd.netCents,
        runwayDays: c.runwayDays,
        last30NetCents: c.last30.netCents,
        connectionStatus: c.connectionStatus,
      };
    }),
    safe('pipeline', async () => {
      const p = await getPipelineData();
      const customers = p.customers || [];
      let mrr = 0, wholesale = 0;
      let mrrSeen = false;
      for (const c of customers) {
        if (typeof c.retailMRR === 'number') { mrr += c.retailMRR; mrrSeen = true; }
        if (typeof c.wholesaleMonthly === 'number') wholesale += c.wholesaleMonthly;
      }
      return {
        openDealsCount: p.dealTotals?.open?.count ?? 0,
        openDealsValueCents: p.dealTotals?.open?.value ?? 0,
        openDealsWeightedCents: p.dealTotals?.open?.weighted ?? 0,
        customersCount: customers.length,
        customersMRRCents: mrrSeen ? mrr : null,
        customersWholesaleMonthlyCents: wholesale || null,
      };
    }),
    safe('outreach', async () => {
      const o = getOutreachData();
      const buckets: Record<string, number> = {};
      let membersBehind = 0, followups = 0;
      for (const r of o.rows) {
        buckets[r.status] = (buckets[r.status] || 0) + 1;
        if (r.members) membersBehind += r.members;
        if (r.nextAction.toLowerCase().startsWith('follow-up')) followups++;
      }
      // Top priority list: not-contacted first, then anyone needing follow-up sorted by days since touch.
      const sortable = [...o.rows].filter(r => r.status !== 'Endorsed' && r.status !== 'Declined');
      sortable.sort((a, b) => {
        if (a.status === 'Not contacted' && b.status !== 'Not contacted') return -1;
        if (b.status === 'Not contacted' && a.status !== 'Not contacted') return 1;
        return (b.daysSinceLastTouch ?? 0) - (a.daysSinceLastTouch ?? 0);
      });
      return {
        totalBids: o.rows.length,
        membersBehindThem: membersBehind,
        notContacted: buckets['Not contacted'] || 0,
        emailed: buckets['Emailed'] || 0,
        replied: buckets['Replied'] || 0,
        webinarBooked: buckets['Webinar Booked'] || 0,
        endorsed: buckets['Endorsed'] || 0,
        declined: buckets['Declined'] || 0,
        needsFollowupCount: followups,
        topPriority: sortable.slice(0, 5).map(r => ({
          entity: r.entity, city: r.city, email: r.email, status: r.status,
          daysSinceLastTouch: r.daysSinceLastTouch, nextAction: r.nextAction,
        })),
      };
    }),
    safe('members', async () => {
      const m = getMembersData();
      return {
        bidsEndorsed: m.totals.bidsEndorsed,
        activeMembers: m.totals.activeMembers,
        totalMRRCents: m.totals.totalMRRCents,
        pipelineCeilingCents: m.totals.pipelineCeilingCents,
      };
    }),
  ]);

  // Build attention list.
  const attention: AttentionItem[] = [];

  // Cash signals
  if (cashS.ok && cashS.data) {
    const c = cashS.data;
    if (c.connectionStatus !== 'ok') {
      attention.push({ severity: 'warn', source: 'cash', title: 'Cash not connected', detail: 'Connect a bank via Plaid to populate the Cash page.', href: '/cash' });
    }
    if (c.runwayDays != null && c.runwayDays <= 30) {
      attention.push({ severity: 'critical', source: 'cash', title: `Runway: ${c.runwayDays} days`, detail: 'At current 30-day burn rate, cash runs out in less than a month.', href: '/cash' });
    } else if (c.runwayDays != null && c.runwayDays <= 60) {
      attention.push({ severity: 'warn', source: 'cash', title: `Runway: ${c.runwayDays} days`, detail: 'Less than two months of runway at current burn rate.', href: '/cash' });
    }
    if (c.last30NetCents < 0 && Math.abs(c.last30NetCents) > 500000) {
      attention.push({ severity: 'warn', source: 'cash', title: 'Net negative >$5K last 30 days', detail: 'Spending materially exceeded revenue. Investigate SaaS Stack and COGS.', href: '/cash' });
    }
  }

  // Outreach signals
  if (outreachS.ok && outreachS.data) {
    const o = outreachS.data;
    if (o.totalBids === 0) {
      attention.push({ severity: 'info', source: 'outreach', title: 'BID roster empty', detail: 'Run scripts/import-bids-to-clickup.mjs to load the 41 NC BIDs.', href: '/outreach' });
    } else if (o.notContacted === o.totalBids) {
      attention.push({ severity: 'warn', source: 'outreach', title: `${o.notContacted} BIDs awaiting first outreach`, detail: 'No emails sent yet. Top priority: Charlotte, Raleigh, Greensboro (highest member counts).', href: '/outreach' });
    } else if (o.notContacted > 0) {
      attention.push({ severity: 'info', source: 'outreach', title: `${o.notContacted} BIDs still uncontacted`, detail: 'Get to inbox-zero on the outreach roster.', href: '/outreach' });
    }
    if (o.needsFollowupCount > 0) {
      attention.push({ severity: 'warn', source: 'outreach', title: `${o.needsFollowupCount} BIDs need follow-up`, detail: 'Initial email sent but no reply yet — time for follow-up #1.', href: '/outreach' });
    }
    if (o.replied > 0 && o.webinarBooked === 0) {
      attention.push({ severity: 'critical', source: 'outreach', title: `${o.replied} replies pending webinar booking`, detail: 'Director(s) replied but no Discovery Webinar booked yet. This is where deals die.', href: '/outreach' });
    }
  }

  // Pipeline signals
  if (pipelineS.ok && pipelineS.data) {
    const p = pipelineS.data;
    if (p.openDealsCount === 0) {
      attention.push({ severity: 'info', source: 'pipeline', title: 'Pipeline empty', detail: 'No open deals in Vendasta. Create opportunities from the Sales Pipeline page.', href: '/pipeline' });
    }
  }

  // Sort by severity (critical > warn > info), stable within each tier.
  const rank: Record<AttentionItem['severity'], number> = { critical: 0, warn: 1, info: 2 };
  attention.sort((a, b) => rank[a.severity] - rank[b.severity]);
  const primary = attention[0] ?? null;

  return {
    generatedAt: Date.now(),
    cash: cashS,
    pipeline: pipelineS,
    outreach: outreachS,
    members: membersS,
    primaryAttention: primary,
    attentionList: attention,
  };
}
