#!/usr/bin/env node
/**
 * Plaid MCP connector for ClaudeClaw
 * -----------------------------------
 * Zero-dependency stdio MCP server. Requires Node >= 18 (global fetch).
 *
 * Auth:
 *   Plaid uses client_id + secret in the request body, not a header.
 *   Env vars:
 *     PLAID_CLIENT_ID       Your Plaid client id
 *     PLAID_SECRET          Secret matching the env you target
 *     PLAID_ENV             "sandbox" | "development" | "production"  (default: development)
 *     PLAID_ACCESS_TOKEN    Stored access token after first connection
 *
 *   Token resolution falls back to reading ../../.env (claudeclaw/.env).
 *
 * CLI:
 *   node server.mjs --selftest                           # ping Plaid + verify creds
 *   node server.mjs --call <tool> '<jsonArgs>'           # invoke one tool
 *
 * Tools exposed:
 *   plaid_create_link_token     Generate a short-lived link_token to open Plaid Link
 *   plaid_exchange_public_token Exchange the Link return value for a permanent access_token
 *   plaid_list_accounts         All linked accounts with balances
 *   plaid_get_balances          Fresh balance refresh (calls /accounts/balance/get)
 *   plaid_list_transactions     Transactions in a date range
 *   plaid_list_items            All access_tokens currently stored
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const TOKEN_STORE = path.join(PROJECT_ROOT, 'store', 'plaid-items.json');

// ---- env loading (claudeclaw/.env fallback) ----
function loadEnvFile() {
  const out = {};
  try {
    const txt = fs.readFileSync(path.join(PROJECT_ROOT, '.env'), 'utf-8');
    for (const line of txt.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* ignore */ }
  return out;
}
const ENV_FILE = loadEnvFile();
function envVal(k) {
  if (process.env[k] && process.env[k].trim()) return process.env[k].trim();
  return ENV_FILE[k] || '';
}

const PLAID_ENV = (envVal('PLAID_ENV') || 'development').toLowerCase();
const BASE = PLAID_ENV === 'production'
  ? 'https://production.plaid.com'
  : PLAID_ENV === 'sandbox'
    ? 'https://sandbox.plaid.com'
    : 'https://development.plaid.com';

function creds() {
  const cid = envVal('PLAID_CLIENT_ID');
  const sec = envVal('PLAID_SECRET');
  if (!cid || !sec) throw new Error('PLAID_CLIENT_ID and PLAID_SECRET must be set');
  return { client_id: cid, secret: sec };
}

async function api(path_, body) {
  const c = creds();
  const res = await fetch(BASE + path_, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Plaid-Version': '2020-09-14',
    },
    body: JSON.stringify({ ...c, ...body }),
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) {
    const err = new Error(`Plaid ${path_} failed: ${res.status} ${data?.error_message || text.slice(0, 400)}`);
    err.plaid = data;
    throw err;
  }
  return data;
}

// ---- token store ----
// Multi-item: a single user can have several Plaid items (Novo, Chase, etc.).
// Each item is keyed by item_id and holds the access_token plus institution name.
function loadItems() {
  try { return JSON.parse(fs.readFileSync(TOKEN_STORE, 'utf-8')); }
  catch { return {}; }
}
function saveItems(items) {
  fs.mkdirSync(path.dirname(TOKEN_STORE), { recursive: true });
  fs.writeFileSync(TOKEN_STORE, JSON.stringify(items, null, 2));
}
function allAccessTokens() {
  // Fallback: also accept a single PLAID_ACCESS_TOKEN env var for users who
  // prefer to keep the token in .env rather than the JSON store.
  const tokens = Object.values(loadItems()).map(v => ({
    access_token: v.access_token,
    item_id: v.item_id,
    institution: v.institution_name || null,
  }));
  const env = envVal('PLAID_ACCESS_TOKEN');
  if (env && !tokens.some(t => t.access_token === env)) {
    tokens.push({ access_token: env, item_id: 'env', institution: 'env' });
  }
  return tokens;
}

// ---- tools ----
const TOOLS = [
  { name: 'plaid_create_link_token', description: 'Create a short-lived link_token that the Plaid Link UI uses to open a connection flow. Required: client_name. Optional: products (default: ["transactions"]), country_codes (default: ["US"]).' },
  { name: 'plaid_exchange_public_token', description: 'Exchange a public_token from Plaid Link for a permanent access_token. Required: public_token, institution_name.' },
  { name: 'plaid_list_accounts', description: 'List all accounts across all linked items, with cached balances. No args.' },
  { name: 'plaid_get_balances', description: 'Force a fresh balance fetch (calls /accounts/balance/get). Slower but realtime. Optional: item_id to limit to one item.' },
  { name: 'plaid_list_transactions', description: 'List transactions for a date range across all linked items. Required: start_date (YYYY-MM-DD), end_date (YYYY-MM-DD). Optional: count (default 250).' },
  { name: 'plaid_list_items', description: 'List all linked Plaid items (institutions). No args.' },
];

async function callTool(name, args) {
  args = args || {};
  switch (name) {
    case 'plaid_create_link_token': {
      const body = {
        client_name: args.client_name || 'ClaudeClaw Mission Control',
        language: 'en',
        country_codes: args.country_codes || ['US'],
        user: { client_user_id: 'claudeclaw-' + (envVal('USER') || 'main') },
        products: args.products || ['transactions'],
      };
      // OAuth-only banks (Novo, Chase, etc.) require a redirect_uri that
      // matches an entry in the Plaid dashboard's "Allowed redirect URIs"
      // list. We pass it through so the same connector works for both
      // OAuth and credential-based institutions.
      if (args.redirect_uri) body.redirect_uri = args.redirect_uri;
      return api('/link/token/create', body);
    }
    case 'plaid_exchange_public_token': {
      if (!args.public_token) throw new Error('public_token required');
      const r = await api('/item/public_token/exchange', { public_token: args.public_token });
      const items = loadItems();
      items[r.item_id] = {
        access_token: r.access_token,
        item_id: r.item_id,
        institution_name: args.institution_name || null,
        connected_at: new Date().toISOString(),
      };
      saveItems(items);
      return { item_id: r.item_id, institution_name: args.institution_name || null, stored: true };
    }
    case 'plaid_list_accounts': {
      const out = [];
      for (const t of allAccessTokens()) {
        try {
          const r = await api('/accounts/get', { access_token: t.access_token });
          for (const a of (r.accounts || [])) {
            out.push({
              item_id: t.item_id,
              institution: t.institution || r.item?.institution_id || null,
              account_id: a.account_id,
              name: a.name,
              official_name: a.official_name,
              mask: a.mask,
              type: a.type,
              subtype: a.subtype,
              balances: a.balances,
            });
          }
        } catch (e) {
          out.push({ item_id: t.item_id, error: String(e?.message || e) });
        }
      }
      return { accounts: out };
    }
    case 'plaid_get_balances': {
      const out = [];
      for (const t of allAccessTokens()) {
        if (args.item_id && t.item_id !== args.item_id) continue;
        const r = await api('/accounts/balance/get', { access_token: t.access_token });
        for (const a of (r.accounts || [])) {
          out.push({
            item_id: t.item_id,
            account_id: a.account_id,
            name: a.name,
            mask: a.mask,
            balances: a.balances,
          });
        }
      }
      return { accounts: out, as_of: new Date().toISOString() };
    }
    case 'plaid_list_transactions': {
      if (!args.start_date || !args.end_date) throw new Error('start_date and end_date required (YYYY-MM-DD)');
      const out = [];
      for (const t of allAccessTokens()) {
        try {
          // Plaid paginates at 500 per request. Pull pages until we've got everything.
          let total = null, offset = 0;
          const collected = [];
          while (total === null || collected.length < total) {
            const r = await api('/transactions/get', {
              access_token: t.access_token,
              start_date: args.start_date,
              end_date: args.end_date,
              options: { count: Math.min(500, args.count || 500), offset },
            });
            total = r.total_transactions;
            for (const tx of (r.transactions || [])) collected.push(tx);
            if ((r.transactions || []).length === 0) break;
            offset += (r.transactions || []).length;
            if (offset >= total) break;
          }
          for (const tx of collected) {
            out.push({
              item_id: t.item_id,
              transaction_id: tx.transaction_id,
              account_id: tx.account_id,
              name: tx.name,
              merchant_name: tx.merchant_name,
              amount: tx.amount,            // Plaid: positive = outflow, negative = inflow
              iso_currency_code: tx.iso_currency_code,
              date: tx.date,
              authorized_date: tx.authorized_date,
              pending: tx.pending,
              category: tx.category,
              personal_finance_category: tx.personal_finance_category,
              payment_channel: tx.payment_channel,
            });
          }
        } catch (e) {
          out.push({ item_id: t.item_id, error: String(e?.message || e) });
        }
      }
      return { transactions: out, count: out.length };
    }
    case 'plaid_list_items': {
      const items = loadItems();
      const out = Object.values(items).map(v => ({
        item_id: v.item_id,
        institution_name: v.institution_name,
        connected_at: v.connected_at,
        has_token: !!v.access_token,
      }));
      return { items: out };
    }
    default:
      throw new Error(`unknown tool: ${name}`);
  }
}

// ---- MCP stdio server ----
const PROTOCOL = '2024-11-05';
function send(msg) { process.stdout.write(`${JSON.stringify(msg)}\n`); }
function ok(id, result) { send({ jsonrpc: '2.0', id, result }); }
function fail(id, code, message) { send({ jsonrpc: '2.0', id, error: { code, message } }); }

async function handle(req) {
  if (req.method === 'initialize') {
    return ok(req.id, { protocolVersion: PROTOCOL, capabilities: { tools: {} }, serverInfo: { name: 'plaid', version: '0.1.0' } });
  }
  if (req.method === 'tools/list') return ok(req.id, { tools: TOOLS.map(t => ({ name: t.name, description: t.description, inputSchema: { type: 'object' } })) });
  if (req.method === 'tools/call') {
    try {
      const result = await callTool(req.params?.name, req.params?.arguments || {});
      return ok(req.id, { content: [{ type: 'text', text: JSON.stringify(result) }] });
    } catch (e) {
      return fail(req.id, -32000, String(e?.message || e));
    }
  }
  return fail(req.id, -32601, `unknown method: ${req.method}`);
}

async function selftest() {
  try {
    creds();
    // Use institutions/get as a cheap "are we authed" probe.
    const r = await api('/institutions/get', { count: 1, offset: 0, country_codes: ['US'] });
    const count = (r.institutions || []).length;
    console.log(`Plaid OK (${PLAID_ENV}): /institutions/get returned ${count} entries`);
    const items = loadItems();
    console.log(`Stored items: ${Object.keys(items).length}`);
    process.exit(0);
  } catch (e) {
    console.error('Selftest failed:', e.message);
    process.exit(1);
  }
}

async function cliCall() {
  const i = process.argv.indexOf('--call');
  const tool = process.argv[i + 1];
  let args = {};
  try { args = JSON.parse(process.argv[i + 2] || '{}'); }
  catch { console.error('--call: third arg must be valid JSON'); process.exit(1); }
  try {
    const result = await callTool(tool, args);
    process.stdout.write(JSON.stringify(result) + '\n');
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

if (process.argv.includes('--selftest')) selftest();
else if (process.argv.includes('--call')) cliCall();
else {
  // stdio loop
  let buf = '';
  process.stdin.on('data', (c) => {
    buf += c.toString();
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      try { handle(JSON.parse(line)); }
      catch (e) { send({ jsonrpc: '2.0', error: { code: -32700, message: 'Parse error: ' + e.message } }); }
    }
  });
}
