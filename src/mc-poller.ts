/**
 * MC Poller — wakes agents when Mission Control tasks are assigned.
 *
 * Polls Supabase every 30s for mc_tasks with status='assigned' updated
 * in the last 2 minutes. For each newly-assigned task, injects an
 * immediate wake scheduled-task into the shared SQLite DB for the
 * target agent. The agent's scheduler picks it up within 60s and runs
 * its Session Boot queries.
 *
 * Only runs in the main Janet process (AGENT_ID === 'main').
 */

import { createScheduledTask, deleteScheduledTask, getAllScheduledTasks, type ScheduledTask } from './db.js';
import { readEnvFile } from './env.js';

const envConfig = readEnvFile(['SUPABASE_URL', 'SUPABASE_ANON_KEY']);
const SUPABASE_URL = process.env.SUPABASE_URL || envConfig.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || envConfig.SUPABASE_ANON_KEY || '';

/** V4 compat: find a scheduled task by ID using getAllScheduledTasks */
function getScheduledTask(id: string): ScheduledTask | undefined {
  return getAllScheduledTasks().find((t) => t.id === id);
}
import { logger } from './logger.js';
import { isAgentAlive, nudgeAgent } from './messaging.js';

const POLL_INTERVAL_MS = 30_000;      // Poll every 30 seconds
const LOOK_BACK_MS = 2 * 60 * 1000;  // Look for tasks assigned in last 2 minutes

// Agents that don't need a wake (main Janet is always active)
const SKIP_AGENTS = new Set(['main', 'janet']);

// Map MC agent names (mc_agents.name in Supabase) to ClaudeClaw agent directory IDs.
// Only entries where the names differ need to be listed here.
const MC_TO_CLAW_ID: Record<string, string> = {
  fury: 'nick-fury',
  happy: 'happy-hogan',
  jean: 'jean-grey',
  natasha: 'black-widow',
};

function wakePrompt(taskNumber: number, title: string): string {
  return (
    `You were just assigned Task #${taskNumber}: ${title}. ` +
    'Start with that task first, then work through the rest of your queue by priority. ' +
    'Check your MC task queue for assigned tasks. Run your Session Boot queries. ' +
    'If you have tasks assigned to you, execute ALL of them in sequence by priority ' +
    '(immediate first, then this_week, then when_capacity). ' +
    'If you have NO tasks assigned to you, do absolutely nothing -- stay completely silent.'
  );
}

// Agent ID -> name cache
let agentCache: Map<string, string> | null = null;

// Optional Telegram senders
type Sender = (text: string) => Promise<void>;
let notifySender: Sender | null = null;   // Janet's direct chat (escalations only)
let statusSender: Sender | null = null;   // Status channel (routine notifications)

interface MCTask {
  id: string;
  task_number: number;
  title: string;
  description: string | null;
  updated_at: string;
  assignee_agent_id: string | null;
  department: string | null;
  status: string | null;
}

interface MCAgent {
  id: string;
  name: string;
}

async function fetchAgentMap(): Promise<Map<string, string>> {
  if (agentCache) return agentCache;

  const url = `${SUPABASE_URL}/rest/v1/mc_agents?select=id,name`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Agent map fetch failed: HTTP ${res.status}`);
  }

  const agents = (await res.json()) as MCAgent[];
  agentCache = new Map(agents.map((a) => [a.id, a.name]));
  return agentCache;
}

/**
 * Poll for build tasks in 'review' status and wake Jarvis to run verification.
 *
 * Jarvis is the central QA verification agent. When a builder marks a task as
 * 'review', Jarvis picks it up, runs the full verification pipeline (commit on
 * main, Vercel deploy, behavioral checks), and either passes it to Janet for
 * final approval or sends it back to the builder with diagnostics.
 *
 * Flow: Builder -> review -> Jarvis (QA) -> Janet (approval) -> Denver
 *
 * Runs every 30s alongside the assignment poller. ~30s worst-case latency is
 * fine for build verification.
 */
async function pollReviewTasks(): Promise<void> {
  try {
    const params = new URLSearchParams({
      select: 'id,task_number,title,description,updated_at,assignee_agent_id,department,status',
      status: 'eq.review',
      department: 'eq.build',
    });

    const url = `${SUPABASE_URL}/rest/v1/mc_tasks?${params.toString()}`;
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    if (!res.ok) {
      logger.warn({ status: res.status }, 'MC poller: review task fetch failed');
      return;
    }

    const tasks = (await res.json()) as MCTask[];
    if (tasks.length === 0) return;

    const agentMap = await fetchAgentMap();

    for (const task of tasks) {
      const taskId = `verify-${task.task_number}-poll`;

      // Dedup: skip if verification wake is currently running or hasn't executed yet.
      // Allow re-dispatch if the previous attempt completed (success, timeout, or failed) --
      // the task being back in 'review' means it was re-submitted and needs fresh verification.
      // This fixes re-review tasks (e.g. MC #747) becoming invisible after first dispatch.
      const existing = getScheduledTask(taskId);
      if (existing) {
        if (existing.last_status === 'timeout' || existing.last_status === 'failed' || existing.last_status === 'success') {
          deleteScheduledTask(taskId);
          // Fall through to create new wake
        } else if (existing.status === 'active' || existing.status === 'running') {
          continue;
        }
      }

      // Extract deploy URL from description
      const description = task.description || '';
      const urlMatch = description.match(/https?:\/\/[^\s"']+/);
      const deployUrl = urlMatch ? urlMatch[0] : '';

      // Resolve builder name
      const builderName = task.assignee_agent_id
        ? agentMap.get(task.assignee_agent_id) || 'Unknown builder'
        : 'Unknown builder';

      // Jarvis verification prompt -- Jarvis runs the QA pipeline autonomously
      const verifyPrompt = [
        `BUILD VERIFICATION REQUIRED -- Task #${task.task_number}: ${task.title || 'Untitled'}.`,
        `Builder: ${builderName}.`,
        deployUrl ? `Deploy URL: ${deployUrl}.` : '',
        '',
        'You are the QA verification gate. Run the full Build Verification Pipeline from your CLAUDE.md:',
        '',
        '1. Query MC for this task\'s details and latest comment (contains deploy URL and what to verify)',
        '2. Verify the commit is on origin/main (if not, REJECT immediately)',
        '3. Verify Vercel production deployment is READY',
        `4. Run behavioral verification: bash ~/Documents/Dev/SynologyDrive/Dev/Workspace/janet/scripts/handle-build-review.sh ${task.task_number}${deployUrl ? ' "' + deployUrl + '"' : ''}`,
        '5. Based on the result:',
        '   - PASS: Add VERIFICATION PASS comment to MC, log to HiveMind as verification_pass, signal Janet via HiveMind for final approval',
        '   - FAIL: Add VERIFICATION FAIL comment to MC with diagnostics, set task back to assigned for the builder, log to HiveMind as verification_fail',
        '6. If this is the 3rd failure cycle for this task, escalate to Janet instead of sending back to builder.',
        '7. Do NOT notify Denver directly. Janet handles that after reviewing your report.',
        '8. Do NOT ask Denver for help. Handle the full verification loop autonomously.',
      ].filter(Boolean).join('\n');

      const now = Math.floor(Date.now() / 1000);

      try {
        // Route to Jarvis (QA agent), not main (Janet)
        createScheduledTask(taskId, verifyPrompt, '0 0 1 1 *', now, 'jarvis');

        // Send SIGUSR1 for near-instant wake
        const nudged = nudgeAgent('jarvis');

        logger.info(
          { taskNumber: task.task_number, taskId, deployUrl, builderName, nudged },
          'MC poller: verification wake task created for Jarvis (QA)',
        );

        // Status channel notification: verification triggered
        const verifyNotify = statusSender || notifySender;
        if (verifyNotify) {
          void verifyNotify(
            `\u{1F50D} Verification triggered for Task #${task.task_number}: ${task.title || 'Untitled'} (builder: ${builderName}) -- routed to Jarvis`,
          ).catch(() => {});
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes('UNIQUE')) {
          logger.warn({ err, taskNumber: task.task_number }, 'MC poller: failed to create verification wake');
        }
      }
    }
  } catch (err) {
    logger.error({ err }, 'MC poller: review poll error');
  }
}

/**
 * Recover orphaned in_progress tasks on startup.
 *
 * When an agent crashes or restarts, MC tasks it was working on stay stuck at
 * in_progress. The poller only dispatches tasks with status=assigned, so these
 * orphaned tasks sit forever. This function finds in_progress tasks where the
 * assigned agent's process is no longer running and resets them to assigned,
 * allowing the poller to re-dispatch on its next cycle.
 *
 * Also cleans up any stale wake tasks in SQLite to prevent dedup collisions.
 */
async function recoverOrphanedTasks(): Promise<void> {
  try {
    const params = new URLSearchParams({
      select: 'id,task_number,title,updated_at,assignee_agent_id',
      status: 'eq.in_progress',
    });

    const url = `${SUPABASE_URL}/rest/v1/mc_tasks?${params.toString()}`;
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    if (!res.ok) {
      logger.warn({ status: res.status }, 'MC poller: orphan recovery fetch failed');
      return;
    }

    const tasks = (await res.json()) as MCTask[];
    if (tasks.length === 0) return;

    const agentMap = await fetchAgentMap();
    let recovered = 0;

    for (const task of tasks) {
      if (!task.assignee_agent_id) continue;

      const mcName = agentMap.get(task.assignee_agent_id);
      if (!mcName) continue;
      if (SKIP_AGENTS.has(mcName)) continue;

      const clawId = MC_TO_CLAW_ID[mcName] ?? mcName;

      // Agent still running -- task is legitimately in progress
      if (isAgentAlive(clawId)) continue;

      // Agent not running -- reset MC task to assigned for re-dispatch
      const resetUrl = `${SUPABASE_URL}/rest/v1/mc_tasks?id=eq.${task.id}`;
      const resetRes = await fetch(resetUrl, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          status: 'assigned',
          started_at: null,
          updated_at: new Date().toISOString(),
        }),
      });

      if (resetRes.ok) {
        recovered++;

        // Clean up stale wake task to prevent dedup collision on re-dispatch
        const wakeTaskId = `mc-wake-${task.id.slice(0, 8)}`;
        const existingWake = getScheduledTask(wakeTaskId);
        if (existingWake) {
          deleteScheduledTask(wakeTaskId);
        }

        logger.info(
          { taskNumber: task.task_number, mcName, clawId },
          'MC poller: recovered orphaned in_progress task -- reset to assigned',
        );
      } else {
        logger.warn(
          { taskNumber: task.task_number, status: resetRes.status },
          'MC poller: failed to reset orphaned task',
        );
      }
    }

    if (recovered > 0) {
      const recoveryNotify = statusSender || notifySender;
      if (recoveryNotify) {
        void recoveryNotify(
          `♻️ Recovered ${recovered} orphaned task${recovered > 1 ? 's' : ''} -- reset to assigned for re-dispatch`,
        ).catch(() => {});
      }
      logger.info({ recovered }, 'MC poller: orphan recovery complete');
    }
  } catch (err) {
    logger.error({ err }, 'MC poller: orphan recovery error');
  }
}

async function pollMCAssignments(opts: { startup?: boolean } = {}): Promise<void> {
  try {
    const params = new URLSearchParams({
      select: 'id,task_number,title,updated_at,assignee_agent_id',
      status: 'eq.assigned',
    });

    // Always query ALL assigned tasks. The dedup logic (SQLite wake task check)
    // prevents duplicate dispatches, so there's no cost to scanning the full set.
    // A rolling time window caused tasks to become permanently invisible if not
    // dispatched within 2 minutes of creation -- that's unacceptable.

    const url = `${SUPABASE_URL}/rest/v1/mc_tasks?${params.toString()}`;
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    if (!res.ok) {
      logger.warn({ status: res.status }, 'MC poller: Supabase request failed');
      return;
    }

    const tasks = (await res.json()) as MCTask[];
    if (tasks.length === 0) return;

    const agentMap = await fetchAgentMap();

    for (const task of tasks) {
      if (!task.assignee_agent_id) continue;

      const mcName = agentMap.get(task.assignee_agent_id);
      if (!mcName) continue;
      if (SKIP_AGENTS.has(mcName)) continue;

      // Resolve to ClaudeClaw directory ID (falls back to mcName if no mapping needed)
      const clawId = MC_TO_CLAW_ID[mcName] ?? mcName;

      const taskId = `mc-wake-${task.id.slice(0, 8)}`;
      const now = Math.floor(Date.now() / 1000);

      // SQLite-based dedup: skip if wake task is currently running or hasn't executed yet.
      // If the previous wake completed (success, timeout, or failed), delete it and
      // allow re-dispatch -- the MC task still being 'assigned' means it needs attention.
      const existing = getScheduledTask(taskId);
      if (existing) {
        if (existing.last_status === 'timeout' || existing.last_status === 'failed' || existing.last_status === 'success') {
          deleteScheduledTask(taskId);
          // Fall through to create new wake
        } else if (existing.status === 'active' || existing.status === 'running') {
          continue;
        }
      }

      try {
        // Write wake task directly to shared SQLite -- the target agent's
        // scheduler picks it up within 60s (agents all share the same DB).
        createScheduledTask(taskId, wakePrompt(task.task_number, task.title || 'Untitled'), '0 0 1 1 *', now, clawId);

        // Send SIGUSR1 for near-instant wake (drops latency from ~60s to <5s)
        const nudged = nudgeAgent(clawId);

        logger.info(
          { mcName, clawId, taskNumber: task.task_number, taskId, nudged },
          'MC poller: wake task injected for agent',
        );

        // Status channel notification: agent picking up task
        const wakeNotify = statusSender || notifySender;
        if (wakeNotify) {
          const title = task.title || 'Untitled';
          void wakeNotify(`\u{1F504} <b>${mcName}</b> waking for Task #${task.task_number}: ${title}`).catch(() => {});
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes('UNIQUE')) {
          logger.warn({ err, mcName, clawId }, 'MC poller: failed to inject wake task');
        }
      }
    }
  } catch (err) {
    // Log but never throw -- a poll failure should not crash the main process
    logger.error({ err }, 'MC poller: unhandled error');
  }
}

/**
 * Run stuck detection by calling the detect_stuck_agents() Supabase function.
 * Marks agents as 'stuck' if heartbeat is stale while status='working',
 * and 'offline' if heartbeat is stale > 10 min.
 */
async function runStuckDetection(): Promise<void> {
  try {
    const url = `${SUPABASE_URL}/rest/v1/rpc/detect_stuck_agents`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });

    if (!res.ok) {
      logger.warn({ status: res.status }, 'MC poller: stuck detection failed');
    }
  } catch (err) {
    logger.warn({ err }, 'MC poller: stuck detection error');
  }
}

export function initMCPoller(send?: Sender, sendStatus?: Sender): void {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    logger.warn('MC poller: SUPABASE_URL or SUPABASE_ANON_KEY not set -- agent auto-wake disabled');
    return;
  }

  if (send) notifySender = send;
  if (sendStatus) statusSender = sendStatus;

  // Startup sequence: recover orphans first, then run full catch-up poll.
  // Recovery resets in_progress tasks for dead agents back to assigned,
  // so the catch-up poll can immediately re-dispatch them.
  void recoverOrphanedTasks().then(() => pollMCAssignments({ startup: true }));

  // Subsequent polls use the 2-min rolling window (avoids full-table scans every 30s).
  setInterval(() => void pollMCAssignments(), POLL_INTERVAL_MS);

  // Poll for build tasks in 'review' status -- routes to Jarvis for QA verification
  void pollReviewTasks();
  setInterval(() => void pollReviewTasks(), POLL_INTERVAL_MS);

  // Run stuck detection every 60s (since pg_cron is not available)
  setInterval(() => void runStuckDetection(), 60_000);
  void runStuckDetection(); // Initial run

  logger.info('MC poller started -- polling every 30s (assignments + review -> Jarvis), stuck detection every 60s');
}
