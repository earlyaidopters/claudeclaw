#!/usr/bin/env node
/**
 * Vendasta CRM MCP connector for ClaudeClaw (Nikki)
 * -------------------------------------------------
 * Zero-dependency stdio MCP server. Requires Node >= 18 (global fetch + crypto).
 *
 * Auth: Vendasta 2-legged OAuth (RFC 7523 JWT-bearer) using a service-account key.
 *   1. Build an RS256-signed JWT assertion from the downloaded credential JSON.
 *   2. POST it to token_uri to get a short-lived access token (cached in-memory).
 *   3. Call the CRM REST API with `Authorization: Bearer <token>`.
 *
 * Env:
 *   VENDASTA_CREDENTIALS  absolute path to the service-account JSON (required)
 *   VENDASTA_NAMESPACE    default namespace = PID or AGID (e.g. "0BYD")
 *   VENDASTA_BASE_URL     default "https://prod.apigateway.co/org"
 *   VENDASTA_SCOPE        default "customers"
 *   VENDASTA_AUD          override audience (default taken from credential)
 *
 * CLI: `node server.mjs --selftest` runs auth + a read-only probe and exits.
 */

import fs from 'node:fs';
import crypto from 'node:crypto';

const CREDS_PATH = process.env.VENDASTA_CREDENTIALS;
const DEFAULT_NS = process.env.VENDASTA_NAMESPACE || '';
const BASE_URL = (process.env.VENDASTA_BASE_URL || 'https://prod.apigateway.co/org').replace(/\/+$/, '');
const SCOPE = process.env.VENDASTA_SCOPE || 'customers';
const USERINFO_URL = 'https://sso-api-prod.apigateway.co/oauth2/user-info';

let _creds = null;
function creds() {
  if (_creds) return _creds;
  if (!CREDS_PATH) throw new Error('VENDASTA_CREDENTIALS env var not set');
  _creds = JSON.parse(fs.readFileSync(CREDS_PATH, 'utf-8'));
  return _creds;
}

function b64url(input) {
  return Buffer.from(input).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ---- Access-token cache (JWT-bearer exchange), keyed per scope ----
const _tokens = new Map(); // scope -> { access_token, exp }
async function getAccessToken(scope = SCOPE) {
  const now = Math.floor(Date.now() / 1000);
  const cached = _tokens.get(scope);
  if (cached && cached.exp - 60 > now) return cached.access_token;
  const c = creds();
  const ap = c.assertionPayloadData || {};
  const ah = c.assertionHeaderData || {};
  const aud = process.env.VENDASTA_AUD || ap.aud || 'https://iam-prod.apigateway.co';
  const iss = ap.iss || c.client_email;
  const sub = ap.sub || c.client_email;
  const kid = ah.kid || c.private_key_id;

  const header = { alg: 'RS256', typ: 'JWT', kid };
  const payload = { aud, iss, sub, scope, iat: now, exp: now + 600 };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = b64url(signer.sign(c.private_key));
  const assertion = `${signingInput}.${signature}`;

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });
  const res = await fetch(c.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`token exchange failed (${res.status}): ${text.slice(0, 500)}`);
  const json = JSON.parse(text);
  const ttl = json.expires_in || 3600;
  _tokens.set(scope, { access_token: json.access_token, exp: now + ttl });
  return json.access_token;
}

// ---- Platform API (billing/financial) — different base + per-scope tokens ----
const PLATFORM_BASE = process.env.VENDASTA_PLATFORM_URL || 'https://prod.apigateway.co/platform';
const PARTNER_ID = () => process.env.VENDASTA_NAMESPACE || '0BYD';

async function platformGet(path, scope) {
  const token = await getAccessToken(scope);
  const res = await fetch(PLATFORM_BASE + path, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) { const e = new Error(`Vendasta GET ${path} -> ${res.status}`); e.status = res.status; e.body = data; throw e; }
  return data;
}

function nextCursor(j) {
  const n = j && j.links && j.links.next;
  if (!n) return null;
  const m = String(n).match(/page\[cursor\]=([^&]*)/);
  const cur = m ? decodeURIComponent(m[1]) : null;
  return cur || null;
}

// Aggregate per-account retail (orders) + wholesale (purchases) for a partner.
// Amounts are returned in cents. retailMRR = sum of monthly line-item amounts
// (annual normalized to /12). wholesaleLifetime = all purchase line totals;
// wholesaleMonthly = purchase line totals in the trailing 31 days.
async function revenueByAccount(partnerId) {
  const acct = {};
  const ensure = (id) => (acct[id] ||= { name: null, retailMRR: 0, wholesaleLifetime: 0, wholesaleMonthly: 0 });
  const pidQ = `filter[partner.id]=${encodeURIComponent(partnerId)}`;

  // Retail — orders (scope: order)
  let cursor = '';
  for (let pg = 0; pg < 50; pg++) {
    const q = `${pidQ}&page[limit]=100${cursor ? `&page[cursor]=${encodeURIComponent(cursor)}` : ''}`;
    const j = await platformGet(`/orders?${q}`, 'order');
    for (const o of (j.data || [])) {
      const a = o.attributes || {};
      let agid = (o.relationships && o.relationships.businessLocation && o.relationships.businessLocation.data && o.relationships.businessLocation.data.id) || null;
      let name = null;
      for (const form of (a.orderForms || [])) {
        for (const f of (form.fields || [])) {
          if (!agid && f.id === 'business_account_group_id') agid = String(f.value || '').replace(/"/g, '');
          if (f.id === 'business_name') name = String(f.value || '').replace(/"/g, '');
        }
      }
      if (!agid && o.id) { const m = String(o.id).match(/^(AG-[A-Z0-9]+):/); if (m) agid = m[1]; }
      if (!agid) continue;
      const e = ensure(agid);
      if (name) e.name = name;
      for (const li of (a.lineItems || [])) {
        let amt = li.amount || 0;
        const iv = (li.intervalCode || 'monthly').toLowerCase();
        if (iv === 'annually' || iv === 'yearly') amt = Math.round(amt / 12);
        e.retailMRR += amt;
      }
    }
    cursor = nextCursor(j);
    if (!cursor) break;
  }

  // Wholesale — purchases (scope: financial)
  const monthAgo = Date.now() - 31 * 24 * 3600 * 1000;
  cursor = '';
  for (let pg = 0; pg < 50; pg++) {
    const q = `${pidQ}&page[limit]=100${cursor ? `&page[cursor]=${encodeURIComponent(cursor)}` : ''}`;
    const j = await platformGet(`/purchases?${q}`, 'financial');
    for (const p of (j.data || [])) {
      const a = p.attributes || {};
      const created = a.createdAt ? Date.parse(a.createdAt) : 0;
      for (const li of (a.lineItems || [])) {
        const cid = li.customerId;
        if (!cid || !String(cid).startsWith('AG-')) continue;
        const e = ensure(cid);
        const t = li.total || 0;
        e.wholesaleLifetime += t;
        if (created >= monthAgo) e.wholesaleMonthly += t;
      }
    }
    cursor = nextCursor(j);
    if (!cursor) break;
  }

  let totRetailMRR = 0, totWholesaleMonthly = 0;
  for (const id of Object.keys(acct)) { totRetailMRR += acct[id].retailMRR; totWholesaleMonthly += acct[id].wholesaleMonthly; }
  return {
    byAccount: acct,
    totals: { retailMRR: totRetailMRR, wholesaleMonthly: totWholesaleMonthly, accounts: Object.keys(acct).length },
    currency: 'USD', unit: 'cents',
  };
}

// ---- Sales opportunities (deal pipeline) — Connect/gRPC endpoint, scope sales.opportunity ----
const SALES_OPP_URL = 'https://sales-opportunities-prod.apigateway.co/salesopportunities.v1.SalesOpportunities/ListOpportunities';
async function listOpportunities(partnerId) {
  const token = await getAccessToken('sales.opportunity');
  let all = [];
  let cursor = '';
  for (let pg = 0; pg < 30; pg++) {
    const body = cursor ? { partnerId, cursor } : { partnerId };
    const res = await fetch(SALES_OPP_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Connect-Protocol-Version': '1' },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) { const e = new Error(`ListOpportunities -> ${res.status}`); e.status = res.status; e.body = text.slice(0, 300); throw e; }
    const j = JSON.parse(text);
    all = all.concat(j.results || []);
    cursor = j.nextCursor;
    if (!cursor) break;
  }
  return { results: all, count: all.length };
}

// ---- Generic CRM API call ----
async function api(method, path, { query, body } = {}) {
  const token = await getAccessToken();
  let url = BASE_URL + path;
  if (query) {
    const qs = new URLSearchParams(query).toString();
    if (qs) url += `?${qs}`;
  }
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  let payload;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(url, { method, headers, body: payload });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const err = new Error(`Vendasta ${method} ${path} -> ${res.status}`);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

function ns(args) {
  const n = (args && args.namespace) || DEFAULT_NS;
  if (!n) throw new Error('namespace required: set VENDASTA_NAMESPACE or pass `namespace`');
  return n;
}
function rt(args) { return (args && args.resourceTypeCode) || 'contacts'; }
const enc = encodeURIComponent;

// ---- Tool definitions ----
const tools = [
  {
    name: 'vendasta_whoami',
    description: 'Validate Vendasta auth and return the service-account user-info. Use to confirm the connector is working.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'vendasta_list_field_schema',
    description: 'List the field schema (field ids, names, types) for a CRM resource type. Call this first to discover valid field ids before filtering or writing.',
    inputSchema: {
      type: 'object',
      properties: {
        resourceTypeCode: { type: 'string', description: 'contacts | companies | activities (default contacts)' },
        namespace: { type: 'string', description: 'PID or AGID; defaults to configured namespace' },
      },
    },
  },
  {
    name: 'vendasta_list_field_options',
    description: 'List the allowed options for a single-select field (e.g. lifecycle stage) on a CRM resource type. Use to get the exact configured pipeline stages for this account.',
    inputSchema: {
      type: 'object',
      properties: {
        fieldId: { type: 'string', description: 'Field id, e.g. standard__company_lifecycle_stage' },
        resourceTypeCode: { type: 'string' },
        namespace: { type: 'string' },
      },
      required: ['fieldId'],
    },
  },
  {
    name: 'vendasta_revenue_by_account',
    description: 'Per-client financials for the partner: retail MRR (from orders) + wholesale monthly/lifetime cost (from purchases), keyed by account-group id (AG-...). Amounts in cents.',
    inputSchema: { type: 'object', properties: { partnerId: { type: 'string', description: 'Partner ID; defaults to configured namespace' } } },
  },
  {
    name: 'vendasta_list_opportunities',
    description: 'List sales opportunities (deals) for the partner. Returns name, accountGroupId, pipelineStage (open/closed-won/closed-lost), projectedFirstYearValue + probableFirstYearValue (cents), probability, expectedCloseDate, salesPersonId.',
    inputSchema: { type: 'object', properties: { partnerId: { type: 'string', description: 'Partner ID; defaults to configured namespace' } } },
  },
  {
    name: 'vendasta_list_records',
    description: 'List/search CRM records (contacts, companies, activities). Supports field filters, selecting return fields, and cursor pagination. Returns { objects, next_cursor, total_objects, has_more }.',
    inputSchema: {
      type: 'object',
      properties: {
        resourceTypeCode: { type: 'string', description: 'contacts | companies | activities (default contacts)' },
        namespace: { type: 'string' },
        subtype: { type: 'string' },
        filters: {
          type: 'array',
          description: 'Filter clauses. Each: { id: fieldId, value, operation }. operation is a Vendasta filter op (e.g. EQUALS, CONTAINS).',
          items: {
            type: 'object',
            properties: { id: { type: 'string' }, value: {}, operation: { type: 'string' } },
            required: ['id', 'operation'],
          },
        },
        returnFields: { type: 'array', items: { type: 'string' }, description: 'Field ids to include in the response' },
        limit: { type: 'integer', description: 'Page size' },
        cursor: { type: 'string', description: 'Pagination cursor from a prior next_cursor' },
      },
    },
  },
  {
    name: 'vendasta_get_record',
    description: 'Get a single CRM record by id. Returns { type, id, attributes }.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        resourceTypeCode: { type: 'string' },
        namespace: { type: 'string' },
      },
      required: ['id'],
    },
  },
  {
    name: 'vendasta_update_record',
    description: 'Update a single CRM record by id (WRITE). Provide `fields` as [{id, value}] to change on the record.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        fields: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, value: {} }, required: ['id', 'value'] } },
        resourceTypeCode: { type: 'string' },
        namespace: { type: 'string' },
      },
      required: ['id', 'fields'],
    },
  },
  {
    name: 'vendasta_upsert_record',
    description: 'Create or update a CRM record (WRITE). Matches existing records via `searchExisting` lookup fields (e.g. ["standard__email"]); updates the match if found, otherwise creates a new record. Provide `fields` as an array of { id, value }. Call vendasta_list_field_schema first for valid field ids. Defaults searchExisting to ["standard__email"] when an email field is present.',
    inputSchema: {
      type: 'object',
      properties: {
        fields: {
          type: 'array',
          description: 'Values to set. Each: { id: fieldId, value }.',
          items: { type: 'object', properties: { id: { type: 'string' }, value: {} }, required: ['id', 'value'] },
        },
        searchExisting: {
          type: 'array',
          items: { type: 'string' },
          description: 'Field ids used to find an existing record to update (e.g. ["standard__email"]). Match -> update; no match -> create.',
        },
        returnFields: { type: 'array', items: { type: 'string' } },
        subtype: { type: 'string' },
        resourceTypeCode: { type: 'string' },
        namespace: { type: 'string' },
      },
      required: ['fields'],
    },
  },
];

async function callTool(name, args) {
  args = args || {};
  switch (name) {
    case 'vendasta_whoami': {
      const token = await getAccessToken();
      const res = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${token}` } });
      const text = await res.text();
      if (!res.ok) throw new Error(`user-info ${res.status}: ${text.slice(0, 300)}`);
      return JSON.parse(text);
    }
    case 'vendasta_list_field_schema':
      return api('GET', `/${enc(ns(args))}/${enc(rt(args))}/meta/fields`);
    case 'vendasta_list_field_options':
      return api('GET', `/${enc(ns(args))}/${enc(rt(args))}/meta/fields/${enc(args.fieldId)}/options`);
    case 'vendasta_revenue_by_account':
      return revenueByAccount(args.partnerId || PARTNER_ID());
    case 'vendasta_list_opportunities':
      return listOpportunities(args.partnerId || PARTNER_ID());
    case 'vendasta_list_records': {
      const body = {};
      if (args.subtype) body.subtype = args.subtype;
      if (args.filters) body.fields = args.filters;
      if (args.returnFields) body.returnFields = args.returnFields;
      const page = {};
      if (args.limit) page.limit = args.limit;
      if (args.cursor) page.cursor = args.cursor;
      if (Object.keys(page).length) body.page = page;
      return api('POST', `/list/${enc(ns(args))}/${enc(rt(args))}`, { body });
    }
    case 'vendasta_get_record':
      return api('GET', `/${enc(ns(args))}/${enc(rt(args))}/${enc(args.id)}`);
    case 'vendasta_update_record':
      return api('PATCH', `/${enc(ns(args))}/${enc(rt(args))}/${enc(args.id)}`, { body: { data: { fields: args.fields } } });
    case 'vendasta_upsert_record': {
      const body = { fields: args.fields };
      let se = args.searchExisting;
      if (!se) {
        const hasEmail = (args.fields || []).some((f) => f.id === 'standard__email');
        if (hasEmail) se = ['standard__email'];
      }
      if (se) body.searchExisting = se;
      if (args.returnFields) body.returnFields = args.returnFields;
      if (args.subtype) body.subtype = args.subtype;
      return api('PATCH', `/${enc(ns(args))}/${enc(rt(args))}`, { body });
    }
    default:
      throw new Error(`unknown tool: ${name}`);
  }
}

// ---- Minimal MCP stdio server (JSON-RPC 2.0, newline-delimited) ----
const PROTOCOL = '2024-11-05';
function send(msg) { process.stdout.write(`${JSON.stringify(msg)}\n`); }
function ok(id, result) { send({ jsonrpc: '2.0', id, result }); }
function fail(id, code, message) { send({ jsonrpc: '2.0', id, error: { code, message } }); }

async function handle(msg) {
  const { id, method, params } = msg;
  if (method === 'initialize') {
    return ok(id, { protocolVersion: PROTOCOL, capabilities: { tools: {} }, serverInfo: { name: 'vendasta-crm', version: '1.0.0' } });
  }
  if (method === 'notifications/initialized' || method === 'initialized') return;
  if (method === 'ping') return ok(id, {});
  if (method === 'tools/list') return ok(id, { tools });
  if (method === 'tools/call') {
    const { name, arguments: a } = params || {};
    try {
      const out = await callTool(name, a);
      return ok(id, { content: [{ type: 'text', text: typeof out === 'string' ? out : JSON.stringify(out, null, 2) }] });
    } catch (e) {
      const detail = e && e.body ? `${e.message}: ${JSON.stringify(e.body).slice(0, 800)}` : (e && e.message) || String(e);
      return ok(id, { content: [{ type: 'text', text: `ERROR: ${detail}` }], isError: true });
    }
  }
  if (id !== undefined) fail(id, -32601, `Method not found: ${method}`);
}

function startStdio() {
  let buf = '';
  process.stdin.setEncoding('utf-8');
  process.stdin.on('data', (chunk) => {
    buf += chunk;
    let idx;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch { continue; }
      Promise.resolve(handle(msg)).catch((err) => {
        if (msg && msg.id !== undefined) fail(msg.id, -32603, String((err && err.message) || err));
      });
    }
  });
  process.stdin.on('end', () => process.exit(0));
}

async function selfTest() {
  const log = (...a) => console.error('[selftest]', ...a);
  try {
    log('Requesting access token...');
    await getAccessToken();
    log('OK: token acquired.');
    log('whoami -> (optional; needs openid/email/profile scope)');
    try {
      console.error(JSON.stringify(await callTool('vendasta_whoami', {}), null, 2));
    } catch (e) { log('whoami skipped:', (e && e.message) || String(e)); }
    log(`field schema for contacts (namespace=${DEFAULT_NS || '(unset)'}) ->`);
    try {
      const fs2 = await callTool('vendasta_list_field_schema', { resourceTypeCode: 'contacts' });
      console.error(JSON.stringify(fs2, null, 2).slice(0, 2000));
    } catch (e) { log('field schema error:', e.status, JSON.stringify(e.body || e.message).slice(0, 500)); }
    log('list contacts (limit 3) ->');
    try {
      const recs = await callTool('vendasta_list_records', { resourceTypeCode: 'contacts', limit: 3 });
      console.error(JSON.stringify(recs, null, 2).slice(0, 2500));
    } catch (e) { log('list error:', e.status, JSON.stringify(e.body || e.message).slice(0, 500)); }
  } catch (e) {
    log('FATAL:', (e && e.message) || String(e));
    process.exit(1);
  }
  process.exit(0);
}

async function cliCall() {
  const i = process.argv.indexOf('--call');
  const name = process.argv[i + 1];
  let args = {};
  try { args = JSON.parse(process.argv[i + 2] || '{}'); }
  catch { console.error('--call: second arg must be valid JSON'); process.exit(1); }
  try {
    const out = await callTool(name, args);
    const text = (typeof out === 'string' ? out : JSON.stringify(out, null, 2)) + '\n';
    // Flush before exit — process.exit(0) right after console.log truncates
    // large stdout on a pipe (~64KB), which breaks programmatic callers.
    process.stdout.write(text, () => process.exit(0));
  } catch (e) {
    process.stderr.write(`ERROR ${e.status || ''} ${JSON.stringify(e.body || e.message || String(e))}\n`, () => process.exit(1));
  }
}

if (process.argv.includes('--selftest')) selfTest();
else if (process.argv.includes('--call')) cliCall();
else startStdio();
