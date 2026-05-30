#!/usr/bin/env node
/**
 * ClickUp MCP connector for ClaudeClaw (Nikki)
 * --------------------------------------------
 * Zero-dependency stdio MCP server. Requires Node >= 18 (global fetch).
 *
 * Auth: ClickUp personal API token (pk_...). ClickUp uses the raw token in the
 * Authorization header (no "Bearer" prefix). Base: https://api.clickup.com/api/v2
 *
 * Token resolution order:
 *   1. process.env.CLICKUP_API_TOKEN
 *   2. CLICKUP_API_TOKEN in claudeclaw/.env (so the secret stays in the
 *      gitignored .env, not in settings.json)
 *
 * Optional env:
 *   CLICKUP_TEAM_ID   default workspace/team id (so team-scoped tools don't
 *                     need it passed every call)
 *
 * CLI: `node server.mjs --selftest` runs auth + a read-only probe and exits.
 *      `node server.mjs --call <tool> '<jsonArgs>'` invokes one tool.
 */

import fs from 'node:fs';

const BASE = 'https://api.clickup.com/api/v2';
const DEFAULT_TEAM = process.env.CLICKUP_TEAM_ID || '';

let _token = null;
function token() {
  if (_token) return _token;
  if (process.env.CLICKUP_API_TOKEN && process.env.CLICKUP_API_TOKEN.trim()) {
    _token = process.env.CLICKUP_API_TOKEN.trim();
    return _token;
  }
  // Fallback: read from claudeclaw/.env (this file lives at
  // connectors/clickup/server.mjs, so ../../.env is the project root .env).
  try {
    const envPath = new URL('../../.env', import.meta.url);
    const txt = fs.readFileSync(envPath, 'utf-8');
    for (const line of txt.split('\n')) {
      const m = line.match(/^\s*CLICKUP_API_TOKEN\s*=\s*(.+?)\s*$/);
      if (m) {
        _token = m[1].replace(/^["']|["']$/g, '').trim();
        if (_token) return _token;
      }
    }
  } catch { /* ignore */ }
  throw new Error('CLICKUP_API_TOKEN not set (env or claudeclaw/.env)');
}

async function api(method, path, { query, body } = {}) {
  let url = BASE + path;
  if (query) {
    const qs = new URLSearchParams(
      Object.entries(query).filter(([, v]) => v !== undefined && v !== null),
    ).toString();
    if (qs) url += `?${qs}`;
  }
  const headers = { Authorization: token(), Accept: 'application/json' };
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
    const err = new Error(`ClickUp ${method} ${path} -> ${res.status}`);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

function team(args) {
  const t = (args && args.team_id) || DEFAULT_TEAM;
  if (!t) throw new Error('team_id required: pass team_id or set CLICKUP_TEAM_ID (use clickup_get_workspaces to find it)');
  return t;
}
const enc = encodeURIComponent;

const tools = [
  {
    name: 'clickup_get_workspaces',
    description: 'List ClickUp workspaces (the API calls these "teams"). Returns each workspace id + name. Start here to get a team_id.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'clickup_get_spaces',
    description: 'List spaces in a workspace.',
    inputSchema: { type: 'object', properties: { team_id: { type: 'string', description: 'Workspace id; defaults to CLICKUP_TEAM_ID' }, archived: { type: 'boolean' } } },
  },
  {
    name: 'clickup_get_folders',
    description: 'List folders within a space.',
    inputSchema: { type: 'object', properties: { space_id: { type: 'string' }, archived: { type: 'boolean' } }, required: ['space_id'] },
  },
  {
    name: 'clickup_get_lists',
    description: 'List task lists. Pass folder_id for lists in a folder, or space_id for folderless lists in a space.',
    inputSchema: { type: 'object', properties: { folder_id: { type: 'string' }, space_id: { type: 'string' }, archived: { type: 'boolean' } } },
  },
  {
    name: 'clickup_get_tasks',
    description: 'Get tasks in a list. Supports status filter, assignees, paging, and including closed tasks.',
    inputSchema: {
      type: 'object',
      properties: {
        list_id: { type: 'string' },
        statuses: { type: 'array', items: { type: 'string' }, description: 'Filter by status names' },
        include_closed: { type: 'boolean' },
        assignees: { type: 'array', items: { type: 'string' }, description: 'Filter by assignee user ids' },
        page: { type: 'integer' },
      },
      required: ['list_id'],
    },
  },
  {
    name: 'clickup_get_task',
    description: 'Get a single task by id (with full detail).',
    inputSchema: { type: 'object', properties: { task_id: { type: 'string' } }, required: ['task_id'] },
  },
  {
    name: 'clickup_search_tasks',
    description: 'Search/filter tasks across an entire workspace (not just one list). Supports statuses, assignees, paging.',
    inputSchema: {
      type: 'object',
      properties: {
        team_id: { type: 'string', description: 'Workspace id; defaults to CLICKUP_TEAM_ID' },
        statuses: { type: 'array', items: { type: 'string' } },
        assignees: { type: 'array', items: { type: 'string' } },
        include_closed: { type: 'boolean' },
        page: { type: 'integer' },
      },
    },
  },
  {
    name: 'clickup_create_task',
    description: 'Create a task in a list (WRITE). Required: list_id, name. Optional: description, status, assignees (user ids), priority (1=urgent..4=low), due_date (ms epoch).',
    inputSchema: {
      type: 'object',
      properties: {
        list_id: { type: 'string' },
        name: { type: 'string' },
        description: { type: 'string' },
        status: { type: 'string' },
        assignees: { type: 'array', items: { type: 'integer' } },
        priority: { type: 'integer', description: '1 urgent, 2 high, 3 normal, 4 low' },
        due_date: { type: 'integer', description: 'Unix ms epoch' },
        tags: { type: 'array', items: { type: 'string' } },
      },
      required: ['list_id', 'name'],
    },
  },
  {
    name: 'clickup_update_task',
    description: 'Update a task by id (WRITE). Provide any of: name, description, status, priority, due_date.',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'string' },
        name: { type: 'string' },
        description: { type: 'string' },
        status: { type: 'string' },
        priority: { type: 'integer' },
        due_date: { type: 'integer' },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'clickup_create_comment',
    description: 'Add a comment to a task (WRITE).',
    inputSchema: {
      type: 'object',
      properties: { task_id: { type: 'string' }, comment_text: { type: 'string' }, notify_all: { type: 'boolean' } },
      required: ['task_id', 'comment_text'],
    },
  },
  {
    name: 'clickup_add_tag',
    description: 'Add an existing/auto-created tag to a task (WRITE). Tags are space-level and auto-create on first use.',
    inputSchema: {
      type: 'object',
      properties: { task_id: { type: 'string' }, tag_name: { type: 'string' } },
      required: ['task_id', 'tag_name'],
    },
  },
  {
    name: 'clickup_remove_tag',
    description: 'Remove a tag from a task (WRITE). No-op if the tag is not present.',
    inputSchema: {
      type: 'object',
      properties: { task_id: { type: 'string' }, tag_name: { type: 'string' } },
      required: ['task_id', 'tag_name'],
    },
  },
];

async function callTool(name, args) {
  args = args || {};
  switch (name) {
    case 'clickup_get_workspaces':
      return api('GET', '/team');
    case 'clickup_get_spaces':
      return api('GET', `/team/${enc(team(args))}/space`, { query: { archived: args.archived ?? false } });
    case 'clickup_get_folders':
      return api('GET', `/space/${enc(args.space_id)}/folder`, { query: { archived: args.archived ?? false } });
    case 'clickup_get_lists':
      if (args.folder_id) return api('GET', `/folder/${enc(args.folder_id)}/list`, { query: { archived: args.archived ?? false } });
      if (args.space_id) return api('GET', `/space/${enc(args.space_id)}/list`, { query: { archived: args.archived ?? false } });
      throw new Error('clickup_get_lists requires folder_id or space_id');
    case 'clickup_get_tasks': {
      const query = { include_closed: args.include_closed ?? false, page: args.page ?? 0 };
      if (Array.isArray(args.statuses)) args.statuses.forEach((s, i) => { query[`statuses[${i}]`] = s; });
      if (Array.isArray(args.assignees)) args.assignees.forEach((a, i) => { query[`assignees[${i}]`] = a; });
      return api('GET', `/list/${enc(args.list_id)}/task`, { query });
    }
    case 'clickup_get_task':
      return api('GET', `/task/${enc(args.task_id)}`);
    case 'clickup_search_tasks': {
      const query = { include_closed: args.include_closed ?? false, page: args.page ?? 0 };
      if (Array.isArray(args.statuses)) args.statuses.forEach((s, i) => { query[`statuses[${i}]`] = s; });
      if (Array.isArray(args.assignees)) args.assignees.forEach((a, i) => { query[`assignees[${i}]`] = a; });
      return api('GET', `/team/${enc(team(args))}/task`, { query });
    }
    case 'clickup_create_task': {
      const body = { name: args.name };
      for (const k of ['description', 'status', 'assignees', 'priority', 'due_date', 'tags']) {
        if (args[k] !== undefined) body[k] = args[k];
      }
      return api('POST', `/list/${enc(args.list_id)}/task`, { body });
    }
    case 'clickup_update_task': {
      const body = {};
      for (const k of ['name', 'description', 'status', 'priority', 'due_date']) {
        if (args[k] !== undefined) body[k] = args[k];
      }
      return api('PUT', `/task/${enc(args.task_id)}`, { body });
    }
    case 'clickup_create_comment':
      return api('POST', `/task/${enc(args.task_id)}/comment`, {
        body: { comment_text: args.comment_text, notify_all: args.notify_all ?? false },
      });
    case 'clickup_add_tag':
      return api('POST', `/task/${enc(args.task_id)}/tag/${enc(args.tag_name)}`);
    case 'clickup_remove_tag':
      return api('DELETE', `/task/${enc(args.task_id)}/tag/${enc(args.tag_name)}`);
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
    return ok(id, { protocolVersion: PROTOCOL, capabilities: { tools: {} }, serverInfo: { name: 'clickup', version: '1.0.0' } });
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

async function selfTest() {
  const log = (...a) => console.error('[selftest]', ...a);
  try {
    log('Auth check: GET /team (workspaces) ...');
    const teams = await callTool('clickup_get_workspaces', {});
    const list = (teams && teams.teams) || [];
    log(`OK: ${list.length} workspace(s):`, list.map((t) => `${t.id}:${t.name}`).join(', ') || '(none)');
    const teamId = DEFAULT_TEAM || (list[0] && list[0].id);
    if (teamId) {
      log(`spaces in team ${teamId} ->`);
      const spaces = await callTool('clickup_get_spaces', { team_id: teamId });
      const sp = (spaces && spaces.spaces) || [];
      console.error(sp.map((s) => `${s.id}:${s.name}`).join(', ') || '(none)');
      if (sp[0]) {
        log(`folderless lists in space ${sp[0].id} ->`);
        try {
          const lists = await callTool('clickup_get_lists', { space_id: sp[0].id });
          console.error(JSON.stringify((lists.lists || []).map((l) => `${l.id}:${l.name}`)).slice(0, 800));
        } catch (e) { log('lists error:', e.status, JSON.stringify(e.body || e.message).slice(0, 300)); }
      }
    }
  } catch (e) {
    log('FATAL:', e.status || '', (e && e.message) || String(e), e.body ? JSON.stringify(e.body).slice(0, 300) : '');
    process.exit(1);
  }
  process.exit(0);
}

if (process.argv.includes('--selftest')) selfTest();
else if (process.argv.includes('--call')) cliCall();
else startStdio();
