#!/usr/bin/env node
/**
 * Anti-Idle Auto-Dispatcher (claudeclaw port)
 *
 * Layer 1 of 2. Pure decision engine — NO side effects on the Kanban.
 * - stdout: strict JSON (dispatcher contract, version 2)
 * - stderr: diagnostics only
 *
 * Ported from /Users/aditya_office_ai_assistant/clawd/scripts/check-kanban-todo.mjs
 * Differences vs /clawd:
 * - Default Kanban source is local SQLite (claudeclaw.db.kanban_tasks), per the
 *   2026-04-19 "Kanban migrated from Supabase" decision. Opt in to Supabase with
 *   ANTI_IDLE_KANBAN_SOURCE=supabase.
 * - Deterministic-only selection; no OpenAI call (user spec: "pure logic").
 * - No live task claim here. Claim happens in the orchestrator when the mission
 *   task is created, so this script is idempotent + easy to dry-run.
 * - Routing targets map to claudeclaw agents: builder / content / research / ops.
 *
 * Env:
 *   ANTI_IDLE_DRY_RUN=1             — dry run (no state writes)
 *   ANTI_IDLE_KANBAN_SOURCE=supabase — scan Supabase REST instead of SQLite
 *   ANTI_IDLE_MOCK_DATA_FILE=path   — load {todo:[],inprogress:[]} from JSON
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';

// ── Constants ─────────────────────────────────────────────────────
const ROOT_DIR = '/Users/aditya_office_ai_assistant/claudeclaw';
const DB_PATH = `${ROOT_DIR}/store/claudeclaw.db`;
const STATE_DIR = `${ROOT_DIR}/store/anti-idle`;
const STATE_PATH = `${STATE_DIR}/state.json`;
const LOCK_PATH = `${STATE_DIR}/dispatcher.lock`;
const AUDIT_LOG_PATH = `${STATE_DIR}/dispatcher-events.jsonl`;

const NOW = Date.now();
const WIP_CAP = 3;
const STALE_HIGH_HOURS = 2;
const STALE_NORMAL_HOURS = 4;
const INPROGRESS_LEASE_HOURS = 8;
const BOUNCE_WINDOW_MS = 24 * 60 * 60 * 1000;
const BOUNCE_THRESHOLD = 2;
const FAILURE_BACKOFF_MS = 15 * 60 * 1000;
const LOCK_STALE_MS = 8 * 60 * 1000;
const LEGACY_GRANDFATHER_COUNT = 22;
const CANDIDATE_CAP = 5;

const DRY_RUN = process.env.ANTI_IDLE_DRY_RUN === '1';
const KANBAN_SOURCE = (process.env.ANTI_IDLE_KANBAN_SOURCE || 'sqlite').toLowerCase();
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';

// ── Helpers ───────────────────────────────────────────────────────
const isoNow = () => new Date().toISOString();
const dispatchRunId = () => `dispatch_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

function toMs(v) {
  if (!v) return null;
  const n = typeof v === 'number' ? (v < 10_000_000_000 ? v * 1000 : v) : Date.parse(v);
  return Number.isFinite(n) ? n : null;
}

function clampHours(h) {
  if (!Number.isFinite(h) || h < 0) return 0;
  return Number(h.toFixed(2));
}

function sanitizeText(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function safeJsonParse(text, fallback = null) {
  try { return JSON.parse(text); } catch { return fallback; }
}

function parseTags(raw) {
  if (Array.isArray(raw)) return raw;
  if (!raw) return [];
  const parsed = safeJsonParse(raw, null);
  return Array.isArray(parsed) ? parsed : [];
}

function priorityScore(priority) {
  const p = String(priority || '').toLowerCase();
  if (['urgent', 'critical', 'p0', 'high'].includes(p)) return 3;
  if (['medium', 'normal', 'p1'].includes(p)) return 2;
  if (['low', 'p2', 'p3'].includes(p)) return 1;
  // numeric fallbacks (seen in current DB): "1" is high, "2" medium, "3+" low
  const n = Number(p);
  if (Number.isFinite(n)) {
    if (n <= 1) return 3;
    if (n === 2) return 2;
    return 1;
  }
  return 0;
}

function priorityBucket(priority) {
  const s = priorityScore(priority);
  if (s >= 3) return 'high';
  if (s === 2) return 'medium';
  if (s === 1) return 'low';
  return 'unspecified';
}

function getTaskTimestamp(task) {
  // kanban_tasks in SQLite uses unix-seconds; Supabase uses ISO strings
  return task.updated_at || task.created_at || task.inserted_at || null;
}

function getAgeHours(task) {
  const ts = getTaskTimestamp(task);
  const ms = toMs(ts);
  if (!ms) return 0;
  return clampHours((NOW - ms) / 3_600_000);
}

function getText(task) {
  const tags = parseTags(task.tags).join(' ');
  const text = [task.title, task.description, task.notes, tags].filter(Boolean).join('\n');
  return { text, lower: text.toLowerCase() };
}

function hasExplicitIndependence(task) {
  const tags = new Set(parseTags(task.tags).map((t) => String(t || '').toLowerCase().trim()));
  return tags.has('independent') || tags.has('no-dependencies-detected');
}

function hasHighRiskSignal(task) {
  const { lower } = getText(task);
  return /\b(deploy|production|prod|credential|secret|auth|delete|drop table|migration|schema|infra|terraform|billing|spend|payment|financial)\b/i.test(lower);
}

function parseSop(task) {
  const { text, lower } = getText(task);
  const tags = new Set(parseTags(task.tags).map((t) => String(t || '').trim().toLowerCase()));

  const headingValue = (labels) => {
    for (const label of labels) {
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`(?:^|\\n)\\s*${escaped}\\s*:\\s*([^\\n]+)`, 'i');
      const m = text.match(re);
      if (m && m[1]) return sanitizeText(m[1]);
    }
    return '';
  };

  const isPlaceholder = (v) => /^(tbd|todo|n\/?a|na|none|unknown|\?|-)$/i.test(String(v || '').trim());

  const field = (canonical, labels, tagAliases = []) => {
    const v = headingValue(labels);
    const fromHeading = Boolean(v) && !isPlaceholder(v);
    const fromTag = [canonical, ...tagAliases].some((tag) => tags.has(tag));
    return { present: fromHeading || fromTag, value: fromHeading ? v : '' };
  };

  const why = field('why', ['WHY', 'REASON']);
  const objective = field('objective', ['OBJECTIVE', 'GOAL']);
  const desiredOutcome = field('desired_outcome', ['DESIRED OUTCOME', 'OUTCOME', 'SUCCESS CRITERIA']);
  const blocker = field('blocker', ['BLOCKER', 'BLOCKED BY']);
  const nextStep = field('next_step', ['NEXT STEP', 'NEXT ACTION']);

  const fields = {
    why: why.present,
    objective: objective.present,
    desired_outcome: desiredOutcome.present,
    blocker: blocker.present,
    next_step: nextStep.present,
  };
  const presentCount = Object.values(fields).filter(Boolean).length;
  const missingFields = Object.entries(fields).filter(([, v]) => !v).map(([k]) => k);

  const blockerSummary = (() => {
    if (blocker.value && !/^(none|n\/?a|na|clear)$/i.test(blocker.value)) return blocker.value;
    const m = text.match(/(?:^|\n)\s*BLOCKER\s*:\s*([^\n]+)/i);
    if (!m?.[1]) return null;
    const s = sanitizeText(m[1]);
    if (!s || /^(none|n\/?a|na|clear)$/i.test(s)) return null;
    return s;
  })();

  const blockedSignal = /\b(blocked|waiting on|needs approval|needs access|need decision|waiting for)\b/i.test(lower) || !!blockerSummary;
  const userNeedsSignal = /\b(aditya|approval|access|credential|decision|unblock|user)\b/i.test(lower + ' ' + (blockerSummary || ''));

  return { presentCount, nextStepPresent: fields.next_step, missingFields, blockerSummary, blockedSignal, userNeedsSignal };
}

// Routing → claudeclaw agent IDs
function routingTarget(task) {
  const { lower } = getText(task);
  if (/\b(write|copy|newsletter|landing page|content|post|caption|tiktok|carousel|blog)\b/i.test(lower)) return 'content';
  if (/\b(research|analyze|investigate|benchmark|competitor|market|compare)\b/i.test(lower)) return 'research';
  if (/\b(ops|calendar|admin|process|inbox|scheduling|triage)\b/i.test(lower)) return 'ops';
  if (/\b(code|bug|fix|debug|build|repo|script|api|database|sql|test|pipeline|automation|deploy|migration|schema)\b/i.test(lower)) return 'builder';
  return 'coordinator_review';
}

function routeConfidence(task, target) {
  const { lower } = getText(task);
  if (target === 'coordinator_review') return 0.5;
  const map = {
    builder: /(code|bug|fix|debug|build|repo|script|api|database|sql|test|pipeline|automation|deploy|migration|schema)/i,
    content: /(write|copy|newsletter|landing page|content|post|caption|tiktok|carousel|blog)/i,
    research: /(research|analyze|investigate|benchmark|competitor|market|compare)/i,
    ops: /(ops|calendar|admin|process|inbox|scheduling|triage)/i,
  };
  return map[target]?.test(lower) ? 0.9 : 0.65;
}

function buildTaskRecord(task, state) {
  const ageHours = getAgeHours(task);
  const pScore = priorityScore(task.priority);
  const pBucket = priorityBucket(task.priority);
  const sop = parseSop(task);
  const tags = parseTags(task.tags);

  const grandfathered = Array.isArray(state.legacyGrandfatheredTaskIds) && state.legacyGrandfatheredTaskIds.includes(task.id);
  const sopOk = grandfathered || (sop.nextStepPresent && sop.presentCount >= 4);
  const highRisk = hasHighRiskSignal(task);

  const explicitBlocked = sop.blockedSignal;
  const needsUser = explicitBlocked && sop.userNeedsSignal;
  const stale = (pBucket === 'high' && ageHours >= STALE_HIGH_HOURS) || ageHours >= STALE_NORMAL_HOURS;

  const route = routingTarget(task);
  const routeConf = routeConfidence(task, route);

  return {
    ...task,
    title_clean: sanitizeText(task.title || 'Untitled task'),
    age_hours: ageHours,
    priority_bucket: pBucket,
    priority_score: pScore,
    tags,
    sop_present_count: sop.presentCount,
    sop_missing_fields: sop.missingFields,
    sop_next_step_present: sop.nextStepPresent,
    blocker_summary: sop.blockerSummary,
    is_blocked: explicitBlocked,
    needs_user_blocker: needsUser,
    is_stale: stale,
    is_doc_incomplete: !sopOk,
    high_risk: highRisk,
    route_target: route,
    route_confidence: routeConf,
    independent: hasExplicitIndependence(task),
    grandfathered,
  };
}

function deterministicRank(a, b) {
  return (
    (b.priority_score - a.priority_score) ||
    (Number(b.is_stale) - Number(a.is_stale)) ||
    (b.sop_present_count - a.sop_present_count) ||
    (b.age_hours - a.age_hours)
  );
}

function buildSignature(tasks) {
  const canon = [...tasks]
    .map((t) => `${t.id}|${t.priority_bucket}|${t.is_stale ? 'stale' : 'fresh'}|${t.is_doc_incomplete ? 'doc_bad' : 'doc_ok'}|${t.needs_user_blocker ? 'blocked_user' : 'clear'}`)
    .sort();
  return crypto.createHash('sha256').update(canon.join('\n')).digest('hex');
}

// ── State persistence ─────────────────────────────────────────────
async function ensureStateDir() {
  await fs.mkdir(STATE_DIR, { recursive: true });
}

async function readState() {
  try {
    const raw = await fs.readFile(STATE_PATH, 'utf8');
    const parsed = safeJsonParse(raw, {});
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function atomicWriteJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  await fs.rename(tmp, filePath);
}

async function appendJsonl(filePath, obj) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.appendFile(filePath, `${JSON.stringify(obj)}\n`, 'utf8');
}

async function acquireLock() {
  try {
    const fd = await fs.open(LOCK_PATH, 'wx');
    await fd.writeFile(JSON.stringify({ pid: process.pid, startedAt: isoNow() }));
    await fd.close();
    return true;
  } catch {
    try {
      const raw = await fs.readFile(LOCK_PATH, 'utf8');
      const lock = safeJsonParse(raw, {});
      const startedMs = toMs(lock.startedAt);
      if (!startedMs || NOW - startedMs > LOCK_STALE_MS) {
        await fs.unlink(LOCK_PATH).catch(() => {});
        return acquireLock();
      }
    } catch {
      await fs.unlink(LOCK_PATH).catch(() => {});
      return acquireLock();
    }
    return false;
  }
}

async function releaseLock() {
  await fs.unlink(LOCK_PATH).catch(() => {});
}

// ── Kanban sources ────────────────────────────────────────────────
function openDbReadOnly() {
  return new Database(DB_PATH, { readonly: true, fileMustExist: true });
}

function fetchKanbanFromSqlite() {
  const db = openDbReadOnly();
  try {
    // Normalize column_id: `in_progress` legacy → `inprogress`
    const todo = db.prepare(`
      SELECT id, title, description, priority, tags, column_id, notes,
             created_at, updated_at, created_by
      FROM kanban_tasks
      WHERE column_id = 'todo'
      ORDER BY created_at DESC
    `).all();
    const inprogress = db.prepare(`
      SELECT id, title, description, priority, tags, column_id, notes,
             created_at, updated_at, created_by
      FROM kanban_tasks
      WHERE column_id IN ('inprogress', 'in_progress')
      ORDER BY created_at DESC
    `).all();
    return { todo, inprogress };
  } finally {
    db.close();
  }
}

async function fetchKanbanFromSupabase() {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('SUPABASE_CREDENTIALS_MISSING');
  const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const [todoRes, inprogRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/kanban_tasks?column_id=eq.todo&order=updated_at.asc.nullslast,created_at.asc.nullslast`, { headers, signal: ctrl.signal }),
      fetch(`${SUPABASE_URL}/rest/v1/kanban_tasks?column_id=eq.inprogress&order=updated_at.asc.nullslast,created_at.asc.nullslast`, { headers, signal: ctrl.signal }),
    ]);
    if (!todoRes.ok) throw new Error(`SUPABASE_TODO_${todoRes.status}`);
    if (!inprogRes.ok) throw new Error(`SUPABASE_INPROG_${inprogRes.status}`);
    const [todo, inprogress] = await Promise.all([todoRes.json(), inprogRes.json()]);
    return { todo, inprogress };
  } finally {
    clearTimeout(t);
  }
}

async function fetchKanbanFromMock() {
  const raw = await fs.readFile(process.env.ANTI_IDLE_MOCK_DATA_FILE, 'utf8');
  const parsed = safeJsonParse(raw, {});
  return {
    todo: Array.isArray(parsed?.todo) ? parsed.todo : (Array.isArray(parsed) ? parsed : []),
    inprogress: Array.isArray(parsed?.inprogress) ? parsed.inprogress : [],
  };
}

async function fetchKanban() {
  if (process.env.ANTI_IDLE_MOCK_DATA_FILE) return fetchKanbanFromMock();
  if (KANBAN_SOURCE === 'supabase') return fetchKanbanFromSupabase();
  return fetchKanbanFromSqlite();
}

// ── Bounce + quarantine ───────────────────────────────────────────
function updateBounceState(state, todoIds, inprogressIds) {
  const nowIso = isoNow();
  state.prevInprogressTaskIds = Array.isArray(state.prevInprogressTaskIds) ? state.prevInprogressTaskIds : [];
  state.bounceEvents = state.bounceEvents && typeof state.bounceEvents === 'object' ? state.bounceEvents : {};
  state.quarantinedTaskIds = state.quarantinedTaskIds && typeof state.quarantinedTaskIds === 'object' ? state.quarantinedTaskIds : {};

  const prevSet = new Set(state.prevInprogressTaskIds);
  const todoSet = new Set(todoIds);
  for (const taskId of prevSet) {
    if (todoSet.has(taskId)) {
      const arr = Array.isArray(state.bounceEvents[taskId]) ? state.bounceEvents[taskId] : [];
      const recent = arr.filter((ts) => {
        const ms = toMs(ts);
        return ms && (NOW - ms <= BOUNCE_WINDOW_MS);
      });
      recent.push(nowIso);
      state.bounceEvents[taskId] = recent;
      if (recent.length >= BOUNCE_THRESHOLD) {
        state.quarantinedTaskIds[taskId] = {
          reason: 'bounce_threshold',
          since: nowIso,
          bounce_count_24h: recent.length,
        };
      }
    }
  }
  state.prevInprogressTaskIds = [...new Set(inprogressIds)];
}

const isQuarantined = (state, id) => Boolean(state.quarantinedTaskIds?.[id]);

// ── Output ────────────────────────────────────────────────────────
function publicTask(task) {
  return {
    id: task.id,
    title: task.title_clean,
    priority: task.priority_bucket,
    age_hours: task.age_hours,
    route_target: task.route_target,
    independent: task.independent,
    classification: task.needs_user_blocker
      ? 'blocked_needs_user'
      : task.is_doc_incomplete
        ? 'documentation_incomplete'
        : task.high_risk
          ? 'high_risk_needs_review'
          : 'candidate_executable',
    missing_fields: task.sop_missing_fields,
    blocker_summary: task.blocker_summary,
  };
}

function buildOutput(base) {
  return {
    version: 2,
    schema_version: 2,
    timestamp: isoNow(),
    dispatch_run_id: base.dispatch_run_id,
    status: base.status || 'healthy',
    decision: base.decision || 'silent',
    reason_code: base.reason_code || 'queue_healthy',
    should_alert: Boolean(base.should_alert),
    kanban_source: base.kanban_source || KANBAN_SOURCE,
    todo_count: base.todo_count ?? 0,
    inprogress_count: base.inprogress_count ?? 0,
    stale_count: base.stale_count ?? 0,
    blocked_count: base.blocked_count ?? 0,
    doc_incomplete_count: base.doc_incomplete_count ?? 0,
    available_wip_slots: base.available_wip_slots ?? 0,
    selected_task_ids: base.selected_task_ids || [],
    selected_tasks: base.selected_tasks || [],
    routing_targets: base.routing_targets || {},
    blocker_summary: base.blocker_summary || null,
    fallback_used: Boolean(base.fallback_used),
    confidence: base.confidence ?? null,
    signature: base.signature || null,
    display_tasks: base.display_tasks || [],
    quarantined_task_ids: base.quarantined_task_ids || [],
    stale_inprogress_ids: base.stale_inprogress_ids || [],
    dry_run: DRY_RUN,
    error_code: base.error_code || null,
  };
}

// ── Main ──────────────────────────────────────────────────────────
async function main() {
  const runId = dispatchRunId();
  let locked = false;
  let state = {};
  const audit = {
    timestamp: isoNow(),
    dispatch_run_id: runId,
    kanban_source: KANBAN_SOURCE,
    fallback_used: true, // deterministic-only; fallback is the selector now
    errors: [],
    recovery_action: null,
  };

  try {
    await ensureStateDir();
    locked = await acquireLock();
    if (!locked) {
      console.log(JSON.stringify(buildOutput({
        dispatch_run_id: runId,
        status: 'healthy',
        decision: 'silent',
        reason_code: 'lock_active',
        should_alert: false,
        error_code: 'lock_active',
      })));
      return;
    }

    state = await readState();

    if (state.failureBackoffUntil && toMs(state.failureBackoffUntil) && NOW < toMs(state.failureBackoffUntil)) {
      console.log(JSON.stringify(buildOutput({
        dispatch_run_id: runId,
        status: 'healthy',
        decision: 'silent',
        reason_code: 'failure_backoff_active',
        should_alert: false,
      })));
      return;
    }

    const { todo: todoRaw, inprogress: inprogressRaw } = await fetchKanban();
    const todo = Array.isArray(todoRaw) ? todoRaw : [];
    const inprogress = Array.isArray(inprogressRaw) ? inprogressRaw : [];

    if (!Array.isArray(state.legacyGrandfatheredTaskIds)) {
      state.legacyGrandfatheredTaskIds = [...todo]
        .sort((a, b) => (toMs(a.created_at) || 0) - (toMs(b.created_at) || 0))
        .slice(0, LEGACY_GRANDFATHER_COUNT)
        .map((t) => t.id);
    }

    updateBounceState(state, todo.map((t) => t.id), inprogress.map((t) => t.id));

    const staleInprogress = inprogress.filter((t) => getAgeHours(t) >= INPROGRESS_LEASE_HOURS).map((t) => t.id);
    const records = todo.map((t) => buildTaskRecord(t, state));
    const blockedNeedsUser = records.filter((t) => t.needs_user_blocker);
    const docIncomplete = records.filter((t) => t.is_doc_incomplete && !t.grandfathered);

    const executable = records.filter((t) => (
      !t.needs_user_blocker &&
      !t.is_doc_incomplete &&
      !t.high_risk &&
      !isQuarantined(state, t.id) &&
      t.route_target !== 'coordinator_review'
    ));

    const signature = buildSignature(records);
    const availableSlots = Math.max(0, WIP_CAP - inprogress.length);
    const staleCount = records.filter((t) => t.is_stale).length;

    const reasonCode = (() => {
      if (inprogress.length >= WIP_CAP && staleInprogress.length > 0) return 'wip_capped_stale_inprogress';
      if (availableSlots <= 0) return 'wip_cap_reached';
      if (blockedNeedsUser.length > 0 && executable.length === 0) return 'blocked_waiting_on_user';
      if (docIncomplete.length > 0 && executable.length === 0) return 'documentation_incomplete';
      if (executable.length === 0) return 'no_safe_executable';
      return 'dispatch_candidate_available';
    })();

    const ranked = [...executable].sort(deterministicRank).slice(0, CANDIDATE_CAP);

    let decision = 'silent';
    let selectedTaskIds = [];
    let selectedReason = '';
    let blockerSummary = null;
    let confidence = null;

    if (availableSlots <= 0 || ranked.length === 0) {
      decision = blockedNeedsUser.length > 0 ? 'escalate' : 'silent';
      blockerSummary = blockedNeedsUser[0]?.blocker_summary || null;
      selectedReason = availableSlots <= 0
        ? 'WIP cap reached'
        : (blockedNeedsUser.length > 0 ? 'Blocked; needs user' : 'No safe candidate');
    } else {
      // Deterministic selection: take top-ranked, serial (1 task) unless all top
      // candidates explicitly tagged independent, up to available slots.
      const topK = ranked.slice(0, availableSlots);
      const allIndependent = topK.length > 1 && topK.every((c) => c.independent);
      const pick = allIndependent ? topK : ranked.slice(0, 1);
      decision = 'dispatch';
      selectedTaskIds = pick.map((c) => c.id);
      selectedReason = allIndependent
        ? 'Deterministic rank; multi-select (all independent)'
        : 'Deterministic rank; serial (top candidate)';
      confidence = 1;
    }

    const selectedRecords = ranked.filter((c) => selectedTaskIds.includes(c.id));
    const routingTargets = {};
    for (const r of selectedRecords) routingTargets[r.id] = r.route_target;

    state.lastRunAt = isoNow();
    state.lastDispatchRunId = runId;
    state.lastSeenSignature = signature;
    state.lastDecision = decision;
    state.failureBackoffUntil = null;

    const shouldAlert = decision === 'dispatch' || decision === 'escalate';
    const displayTasks = [...records].sort(deterministicRank).slice(0, 5).map(publicTask);

    audit.decision = decision;
    audit.task_ids = selectedTaskIds;
    audit.candidate_count = ranked.length;
    audit.reason = selectedReason;
    audit.routing_target = routingTargets;
    audit.confidence = confidence;

    if (!DRY_RUN) {
      await atomicWriteJson(STATE_PATH, state);
      await appendJsonl(AUDIT_LOG_PATH, audit);
    }

    console.log(JSON.stringify(buildOutput({
      dispatch_run_id: runId,
      status: selectedTaskIds.length ? 'alert' : 'healthy',
      decision,
      reason_code: reasonCode,
      should_alert: shouldAlert,
      kanban_source: KANBAN_SOURCE,
      todo_count: todo.length,
      inprogress_count: inprogress.length,
      stale_count: staleCount,
      blocked_count: blockedNeedsUser.length,
      doc_incomplete_count: docIncomplete.length,
      available_wip_slots: availableSlots,
      selected_task_ids: selectedTaskIds,
      selected_tasks: selectedRecords.map((t) => ({
        id: t.id,
        title: t.title_clean,
        priority: t.priority_bucket,
        age_hours: t.age_hours,
        route_target: t.route_target,
        independent: t.independent,
        prev_updated_at: t.updated_at,
      })),
      routing_targets: routingTargets,
      blocker_summary: blockerSummary,
      fallback_used: true, // no LLM selector; deterministic is the path
      confidence,
      signature,
      display_tasks: displayTasks,
      quarantined_task_ids: Object.keys(state.quarantinedTaskIds || {}),
      stale_inprogress_ids: staleInprogress,
    })));
  } catch (error) {
    const errText = String(error?.message || error);
    audit.errors.push(errText);
    try {
      state.lastRunAt = isoNow();
      state.lastRunStatus = 'error';
      state.lastError = errText;
      state.failureBackoffUntil = new Date(Date.now() + FAILURE_BACKOFF_MS).toISOString();
      if (!DRY_RUN) {
        await atomicWriteJson(STATE_PATH, state);
        await appendJsonl(AUDIT_LOG_PATH, { ...audit, decision: 'escalate', reason: 'dispatcher_failure' });
      }
    } catch (nested) {
      console.error('[anti-idle-check] failure-workflow error:', nested?.message || nested);
    }
    console.log(JSON.stringify(buildOutput({
      dispatch_run_id: runId,
      status: 'error',
      decision: 'escalate',
      reason_code: 'dispatcher_failure',
      should_alert: true,
      error_code: errText,
      fallback_used: true,
    })));
  } finally {
    if (locked) await releaseLock();
  }
}

main();
