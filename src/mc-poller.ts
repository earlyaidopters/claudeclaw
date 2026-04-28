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

import fs from 'fs';
import os from 'os';
import path from 'path';

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

/**
 * Resolve the Codex CLI path by finding the latest installed plugin version.
 * Returns the full path to codex-companion.mjs, or null if not installed.
 */
function resolveCodexCliPath(): string | null {
  try {
    const pluginBase = path.join(
      os.homedir(),
      '.claude',
      'plugins',
      'cache',
      'codex-plugin-cc',
      'codex',
    );

    if (!fs.existsSync(pluginBase)) return null;

    const versions = fs.readdirSync(pluginBase)
      .filter(d => fs.statSync(path.join(pluginBase, d)).isDirectory())
      .sort((a, b) => {
        // Semver sort: split on '.', compare numerically, highest first
        const pa = a.split('.').map(Number);
        const pb = b.split('.').map(Number);
        for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
          const diff = (pb[i] || 0) - (pa[i] || 0);
          if (diff !== 0) return diff;
        }
        return 0;
      });

    if (versions.length === 0) return null;

    // Iterate all sorted versions until one has the companion script
    for (const ver of versions) {
      const scriptPath = path.join(pluginBase, ver, 'scripts', 'codex-companion.mjs');
      if (fs.existsSync(scriptPath)) return scriptPath;
    }

    return null;
  } catch (err) {
    logger.warn({ err }, 'resolveCodexCliPath: fs error while resolving Codex CLI -- returning null');
    return null;
  }
}

// Map MC agent names (mc_agents.name in Supabase) to ClaudeClaw agent directory IDs.
// Complete mapping -- explicit for auditability, no fallback reliance.
const MC_TO_CLAW_ID: Record<string, string> = {
  // Name differs between MC and ClaudeClaw directory
  fury: 'nick-fury',
  jean: 'jean-grey',
  natasha: 'black-widow',
  // Name matches -- explicit for auditability, no fallback reliance
  jarvis: 'jarvis',
  loki: 'loki',
  pepper: 'pepper',
  'peter-parker': 'peter-parker',
  'tony-stark': 'tony-stark',
  vision: 'vision',
  wanda: 'wanda',
};

function wakePrompt(taskNumber: number, title: string, verificationContext?: string): string {
  let prompt =
    `You were just assigned Task #${taskNumber}: ${title}. ` +
    'Start with that task first, then work through the rest of your queue by priority. ' +
    'Check your MC task queue for assigned tasks. Run your Session Boot queries. ' +
    'If you have tasks assigned to you, execute ALL of them in sequence by priority ' +
    '(immediate first, then this_week, then when_capacity). ' +
    'If you have NO tasks assigned to you, do absolutely nothing -- stay completely silent.';

  if (verificationContext) {
    prompt +=
      '\n\n--- VERIFICATION FAILURE CONTEXT ---\n' +
      'This task was returned after verification failed. The latest failure report:\n\n' +
      verificationContext + '\n' +
      '--- END VERIFICATION CONTEXT ---\n\n' +
      'IMPORTANT: Read this failure context carefully. Your previous attempt was rejected. ' +
      'Address the specific issues identified above before submitting for review again.';
  }

  return prompt;
}

// Agent ID -> name cache
let agentCache: Map<string, string> | null = null;

// Optional Telegram senders
type Sender = (text: string) => Promise<void>;
let notifySender: Sender | null = null;   // Janet's direct chat (escalations only)
let statusSender: Sender | null = null;   // Status channel (routine notifications)

export interface MCTask {
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
 * Fetch the latest verification failure comment for a task from mc_task_comments.
 * Used to provide context when re-dispatching a task that was sent back after
 * Codex review failure, so the agent knows WHY it was returned.
 *
 * Returns the comment body if a failure comment exists, null otherwise.
 */
async function fetchVerificationContext(taskUuid: string): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      select: 'body,author_name,created_at',
      task_id: `eq.${taskUuid}`,
      or: '(comment_type.eq.verification,comment_type.eq.verification_failure)',
      order: 'created_at.desc',
      limit: '1',
    });

    const url = `${SUPABASE_URL}/rest/v1/mc_task_comments?${params.toString()}`;
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    if (!res.ok) return null;

    const comments = (await res.json()) as Array<{ body: string; author_name: string; created_at: string }>;
    if (comments.length === 0) return null;

    const comment = comments[0];
    // Only include failure context -- a PASS means the task shouldn't be back in assigned
    if (comment.body.toUpperCase().includes('FAIL')) {
      return comment.body;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Handle build tasks in 'review' status -- routes to Janet for Codex verification.
 *
 * When a builder marks a task as 'review', Janet picks it up and runs a Codex
 * review via the Codex CLI. On clean result, Janet marks done and notifies Denver.
 * On findings, Janet classifies severity -- P1 goes back to the builder with an
 * MC comment; P2 gets documented and task moves to done.
 *
 * Flow: Builder -> review -> Janet (Codex review) -> done / back to builder
 */
export async function handleBuildReviewTasks(tasks: MCTask[], agentMap: Map<string, string>): Promise<void> {
  for (const task of tasks) {
    const taskId = `verify-${task.task_number}-poll`;

    // Guard nullable assignee_agent_id
    const builderName = task.assignee_agent_id
      ? (agentMap.get(task.assignee_agent_id) || 'Unknown builder')
      : 'Unknown builder';

    // Dedup: skip if Codex review wake is currently running or hasn't executed yet.
    // When a previous review PASSED, check if this is a genuine re-review
    // (task re-submitted after fixes) or a stale poll cycle. If Codex already
    // passed this task and the MC status hasn't changed, close the loop -- don't
    // re-dispatch. This prevents redundant review cycles that burn tokens
    // when the MC status update to 'done' failed or is still being processed.
    const existing = getScheduledTask(taskId);
    if (existing) {
      if (existing.last_status === 'success') {
        // Codex review already passed this. Check if it was re-submitted (updated_at changed)
        // or if we're just cycling on a stale review status.
        const lastRun = existing.last_run || 0;
        const taskUpdatedAt = task.updated_at
          ? Math.floor(new Date(task.updated_at).getTime() / 1000)
          : 0;

        if (taskUpdatedAt <= lastRun) {
          // Task hasn't been re-submitted since Codex last passed it.
          // Close the loop: try to update MC to 'done' directly and stop cycling.
          logger.info(
            { taskNumber: task.task_number, taskId },
            'MC poller: verification already passed, closing loop (no re-dispatch)',
          );

          // Attempt to move MC task to 'done' since Codex review already passed
          try {
            const patchUrl = `${SUPABASE_URL}/rest/v1/mc_tasks?task_number=eq.${task.task_number}`;
            const patchRes = await fetch(patchUrl, {
              method: 'PATCH',
              headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                Prefer: 'return=minimal',
              },
              body: JSON.stringify({
                status: 'done',
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }),
            });

            if (patchRes.ok) {
              logger.info({ taskNumber: task.task_number }, 'MC poller: auto-closed verified task to done');
              deleteScheduledTask(taskId);
            } else {
              logger.warn(
                { taskNumber: task.task_number, status: patchRes.status },
                'MC poller: failed to auto-close verified task -- keeping dedup guard to prevent re-dispatch',
              );
              // DO NOT delete the scheduled task -- keep it as a dedup guard.
              // Next poll cycle will retry auto-close. This prevents the
              // re-verification loop where the review gets triggered 12+ times.
            }
          } catch (err) {
            logger.warn({ err, taskNumber: task.task_number }, 'MC poller: error auto-closing verified task -- keeping dedup guard');
            // Same: keep scheduled task for dedup to prevent re-dispatch loop
          }
          continue;
        }

        // Task was re-submitted after Codex passed -- legitimate re-review
        deleteScheduledTask(taskId);
        // Fall through to create new wake
      } else if (existing.last_status === 'timeout' || existing.last_status === 'failed') {
        deleteScheduledTask(taskId);
        // Fall through to create new wake
      } else if (existing.last_status === 'completed_empty') {
        // Agent produced no output on verification -- do not retry unless re-submitted.
        // Mirror the success branch's freshness check: if the MC task was updated
        // after Codex last ran, treat as a legitimate re-review and re-dispatch.
        const lastRun = existing.last_run || 0;
        const taskUpdatedAt = task.updated_at
          ? Math.floor(new Date(task.updated_at).getTime() / 1000)
          : 0;

        if (taskUpdatedAt <= lastRun) {
          // Not re-submitted -- keep the scheduled task as a dedup guard.
          logger.warn(
            { taskId, taskNumber: task.task_number },
            'MC poller: verify task completed with no output -- not retrying (completed_empty)',
          );
          continue;
        }

        // Task was re-submitted after empty output -- legitimate re-review
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

    // Resolve Codex CLI path dynamically -- skip task if not found
    const codexCliPath = resolveCodexCliPath();
    if (!codexCliPath) {
      logger.error(
        { taskNumber: task.task_number },
        'Codex CLI not found -- cannot create verification task. Install or update the Codex plugin.',
      );
      continue;
    }

    const verifyPrompt = [
      `CODEX REVIEW REQUIRED -- Task #${task.task_number}: ${task.title || 'Untitled'}.`,
      `Builder: ${builderName}.`,
      deployUrl ? `Deploy URL: ${deployUrl}.` : '',
      '',
      'Run Codex verification per the Codex Integration Protocol (ops/protocols/codex-integration-protocol.md).',
      '',
      '1. Query MC for this task\'s latest comment to understand what was changed.',
      '2. Run the Codex CLI directly via Bash:',
      '   node "' + codexCliPath + '" task --fresh "Review the latest commit(s) for MC task #' + task.task_number + '. Check for correctness issues, error handling gaps, and deviations from the fix brief. Report CLEAN if no discrete correctness issues found, or list each finding with severity (P1=blocking, P2=non-blocking)."',
      '3. Read the Codex output and evaluate:',
      '   - CLEAN (no discrete correctness issues):',
      '     Add a CODEX PASS comment to MC, then IMMEDIATELY update MC task status:',
      '     UPDATE mc_tasks SET status = \'done\', completed_at = now(), updated_at = now() WHERE task_number = ' + task.task_number + ';',
      '     This status update is MANDATORY -- without it, the poller re-dispatches in an infinite loop.',
      '     Log to HiveMind as verification_pass. Notify Denver that the task is verified and done.',
      '   - P1 FINDING (blocking correctness issue):',
      '     Add an MC comment with the Codex finding translated into an actionable fix instruction.',
      '     IMMEDIATELY update MC task status:',
      '     UPDATE mc_tasks SET status = \'assigned\', updated_at = now() WHERE task_number = ' + task.task_number + ';',
      '     Log to HiveMind as verification_fail.',
      '   - P2 FINDING (non-blocking, cosmetic, or minor):',
      '     Document the finding in an MC comment. Mark task done. Proceed.',
      '4. If this is the 2nd consecutive failure on the same finding, escalate to Denver.',
      '5. Do NOT skip the MC status update. The poller uses it to close the loop.',
    ].filter(Boolean).join('\n');

    const now = Math.floor(Date.now() / 1000);

    try {
      createScheduledTask(taskId, verifyPrompt, '0 0 1 1 *', now, 'main');

      // Send SIGUSR1 for near-instant wake
      const nudged = nudgeAgent('main');

      logger.info(
        { taskNumber: task.task_number, taskId, deployUrl, builderName, nudged },
        'MC poller: Codex review task created for Janet',
      );

      // Status channel notification: verification triggered
      const verifyNotify = statusSender || notifySender;
      if (verifyNotify) {
        void verifyNotify(
          `\u{1F50D} Codex review triggered for Task #${task.task_number}: ${task.title || 'Untitled'} (builder: ${builderName}) -- routed to Janet`,
        ).catch(() => {});
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('UNIQUE')) {
        logger.warn({ err, taskNumber: task.task_number }, 'MC poller: failed to create verification wake');
      }
    }
  }
}

/**
 * Handle non-build tasks in 'review' status (including department=null).
 * Routes to Janet (main process) for quality review.
 */
export async function handleContentReviewTasks(tasks: MCTask[], agentMap: Map<string, string>): Promise<void> {
  for (const task of tasks) {
    const taskId = `content-review-${task.id.slice(0, 8)}`;
    const now = Math.floor(Date.now() / 1000);

    // Dedup: mirrors handleBuildReviewTasks() branch order.
    // updateTaskAfterRun() always resets status to 'active' -- outcome lives in last_status.
    // Checking status alone would silently skip all completed reviews forever.
    const existing = getScheduledTask(taskId);
    if (existing) {
      if (existing.last_status === 'success') {
        // Janet already reviewed this task. Check freshness:
        // if MC task was re-submitted (updated_at > last_run), re-dispatch.
        // Otherwise keep the dedup guard -- the review is done.
        const lastRun = existing.last_run || 0;
        const taskUpdatedAt = task.updated_at
          ? Math.floor(new Date(task.updated_at).getTime() / 1000)
          : 0;
        if (taskUpdatedAt <= lastRun) {
          // Janet already reviewed and task hasn't changed. Keep dedup guard.
          continue;
        }
        deleteScheduledTask(taskId);
        // Fall through to create new review wake
      } else if (existing.last_status === 'completed_empty') {
        // Janet produced no output on review -- same freshness check.
        const lastRun = existing.last_run || 0;
        const taskUpdatedAt = task.updated_at
          ? Math.floor(new Date(task.updated_at).getTime() / 1000)
          : 0;
        if (taskUpdatedAt <= lastRun) {
          logger.warn(
            { taskId, taskNumber: task.task_number },
            'MC poller: content review completed with no output -- not retrying (completed_empty)',
          );
          continue;
        }
        deleteScheduledTask(taskId);
        // Fall through to create new review wake
      } else if (existing.last_status === 'timeout' || existing.last_status === 'failed') {
        // Review failed or timed out -- delete and re-dispatch
        deleteScheduledTask(taskId);
        // Fall through to create new review wake
      } else if (existing.status === 'active' || existing.status === 'running') {
        // Task is queued or currently executing -- skip
        continue;
      }
    }

    // Per-task error isolation: one failed create should not abort remaining tasks
    try {
      // Guard nullable assignee_agent_id
      const builderName = task.assignee_agent_id
        ? (agentMap.get(task.assignee_agent_id) ?? 'unknown agent')
        : 'unknown agent';

      const reviewPrompt =
        `Non-build task #${task.task_number} is ready for quality review.\n\n` +
        `Title: ${task.title}\n` +
        `Department: ${task.department ?? '(unset)'}\n` +
        `Builder: ${builderName}\n` +
        `Description: ${task.description ?? '(none)'}\n\n` +
        `Review this deliverable for quality, completeness, and alignment with Denver's standards.\n\n` +
        `1. Read the task description and any attached deliverables (query mc_task_deliverables for task_number ${task.task_number}).\n` +
        `2. Read the latest mc_task_comments for context.\n` +
        `3. If the deliverable meets quality standards:\n` +
        `   - Add an approval comment to the task\n` +
        `   - Mark the task done: UPDATE mc_tasks SET status = 'done', completed_at = now(), updated_at = now() WHERE task_number = ${task.task_number};\n` +
        `   - Notify Denver that the deliverable is approved\n` +
        `4. If the deliverable needs revision:\n` +
        `   - Add a detailed comment explaining what needs to change\n` +
        `   - Set status back to assigned: UPDATE mc_tasks SET status = 'assigned', updated_at = now() WHERE task_number = ${task.task_number};\n` +
        `   - The original builder will be re-woken with the feedback\n\n` +
        `Do NOT auto-approve. Read the actual deliverable content before deciding.`;

      // Route to main (Janet) for quality review
      createScheduledTask(taskId, reviewPrompt, '0 0 1 1 *', now, 'main');
      logger.info(
        { taskNumber: task.task_number, department: task.department, builder: builderName },
        'Non-build review task routed to Janet',
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('UNIQUE')) {
        logger.warn({ err, taskNumber: task.task_number }, 'MC poller: failed to create content review wake');
      }
    }
  }
}

/**
 * Poll for ALL tasks in 'review' status and route by department.
 *
 * Single fetch with no department filter -- avoids the PostgREST three-valued
 * logic gap where department=null rows are missed by both eq.build and neq.build.
 * Build tasks route to Codex review, everything else (including null department)
 * routes to Janet for quality review.
 *
 * Replaces the former pollReviewTasks() + pollContentReviewTasks() pair.
 */
export async function pollAllReviewTasks(): Promise<void> {
  try {
    const params = new URLSearchParams({
      select: 'id,task_number,title,description,updated_at,assignee_agent_id,department,status',
      status: 'eq.review',
    });
    // NOTE: No 'department' param -- fetches ALL review tasks regardless of department

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

    // Partition: build tasks -> Codex review, everything else -> Janet quality review
    // department=null falls to nonBuildTasks (correct -- null !== 'build')
    const buildTasks = tasks.filter(t => t.department === 'build');
    const nonBuildTasks = tasks.filter(t => t.department !== 'build');

    // Log null-department tasks for visibility
    for (const task of nonBuildTasks) {
      if (task.department === null || task.department === undefined) {
        logger.warn(
          { taskNumber: task.task_number, title: task.title },
          'Review task has null department -- routing to Janet quality review as fallback',
        );
      }
    }

    // Route build tasks through Codex review logic
    if (buildTasks.length > 0) {
      const agentMap = await fetchAgentMap();
      await handleBuildReviewTasks(buildTasks, agentMap);
    }

    // Route non-build tasks (including department=null) through quality review
    if (nonBuildTasks.length > 0) {
      const agentMap = await fetchAgentMap();
      await handleContentReviewTasks(nonBuildTasks, agentMap);
    }
  } catch (err) {
    logger.error({ err }, 'MC poller: review task poll error');
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
      if (!mcName) {
        logger.warn(
          { taskNumber: task.task_number, assigneeId: task.assignee_agent_id },
          'MC poller: orphan recovery -- task assigned to unknown agent UUID -- skipping',
        );
        const unknownUuidSender = statusSender || notifySender;
        if (unknownUuidSender) {
          void unknownUuidSender(
            `⚠️ MC Poller: orphan task #${task.task_number} assigned to unknown agent UUID ${task.assignee_agent_id}. Not in mc_agents. Add to agent registry.`,
          ).catch(() => {});
        }
        continue;
      }
      if (SKIP_AGENTS.has(mcName)) continue;

      const clawId = MC_TO_CLAW_ID[mcName] ?? mcName;

      if (!MC_TO_CLAW_ID[mcName]) {
        logger.warn(
          { mcName, clawId, taskNumber: task.task_number },
          'MC poller: orphan recovery -- agent name not in MC_TO_CLAW_ID mapping -- using fallback. Add explicit entry.',
        );
        const fallbackSender = statusSender || notifySender;
        if (fallbackSender) {
          void fallbackSender(
            `⚠️ MC Poller: agent '${mcName}' not in MC_TO_CLAW_ID. Using fallback '${clawId}'. Add mapping to prevent silent failures.`,
          ).catch(() => {});
        }
      }

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
      if (!mcName) {
        logger.warn(
          { taskNumber: task.task_number, assigneeId: task.assignee_agent_id },
          'MC poller: task assigned to unknown agent UUID -- skipping',
        );
        const unknownUuidSender = statusSender || notifySender;
        if (unknownUuidSender) {
          void unknownUuidSender(
            `⚠️ MC Poller: task #${task.task_number} assigned to unknown agent UUID ${task.assignee_agent_id}. Not in mc_agents. Add to agent registry.`,
          ).catch(() => {});
        }
        continue;
      }
      if (SKIP_AGENTS.has(mcName)) continue;

      // Resolve to ClaudeClaw directory ID
      const clawId = MC_TO_CLAW_ID[mcName] ?? mcName;

      if (!MC_TO_CLAW_ID[mcName]) {
        logger.warn(
          { mcName, clawId, taskNumber: task.task_number },
          'MC poller: agent name not in MC_TO_CLAW_ID mapping -- using fallback. Add explicit entry.',
        );
        const fallbackSender = statusSender || notifySender;
        if (fallbackSender) {
          void fallbackSender(
            `⚠️ MC Poller: agent '${mcName}' not in MC_TO_CLAW_ID. Using fallback '${clawId}'. Add mapping to prevent silent failures.`,
          ).catch(() => {});
        }
      }

      const taskId = `mc-wake-${task.id.slice(0, 8)}`;
      const now = Math.floor(Date.now() / 1000);

      // SQLite-based dedup: skip if wake task is currently running or hasn't executed yet.
      // If the previous wake completed (success, timeout, or failed), delete it and
      // allow re-dispatch -- the MC task still being 'assigned' means it needs attention.
      // Preserve resume_session_id from the previous run for session persistence.
      const existing = getScheduledTask(taskId);
      let previousSessionId: string | undefined;
      if (existing) {
        if (['timeout', 'failed', 'success', 'completed_empty'].includes(existing.last_status ?? '')) {
          previousSessionId = existing.resume_session_id ?? undefined;
          deleteScheduledTask(taskId);
          // Fall through to create new wake
        } else if (existing.status === 'active' || existing.status === 'running') {
          continue;
        }
      }

      try {
        // Check for verification failure context (re-dispatch after Codex review failed)
        const verificationContext = await fetchVerificationContext(task.id);

        // Write wake task directly to shared SQLite -- the target agent's
        // scheduler picks it up within 60s (agents all share the same DB).
        createScheduledTask(
          taskId,
          wakePrompt(task.task_number, task.title || 'Untitled', verificationContext ?? undefined),
          '0 0 1 1 *',
          now,
          clawId,
          previousSessionId,
        );

        // Send SIGUSR1 for near-instant wake (drops latency from ~60s to <5s)
        const nudged = nudgeAgent(clawId);

        const isRedispatch = !!verificationContext || !!previousSessionId;
        logger.info(
          { mcName, clawId, taskNumber: task.task_number, taskId, nudged, isRedispatch, hasVerificationContext: !!verificationContext, hasSessionResume: !!previousSessionId },
          isRedispatch
            ? 'MC poller: RE-DISPATCH wake task injected (with verification context + session resume)'
            : 'MC poller: wake task injected for agent',
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

// ── Escalation comment polling ──────────────────────────────────────
// When Janet (or Denver) adds an escalation comment to an in_progress task,
// the assigned agent should be nudged immediately via SIGUSR1 rather than
// waiting for the next 30s poll cycle. This poller checks for recent
// escalation comments and nudges the affected agents.

/** Track the last escalation comment timestamp we've processed. */
let lastEscalationCheck = new Date(Date.now() - 2 * 60 * 1000).toISOString();

interface MCComment {
  id: string;
  task_id: string;
  body: string;
  author_name: string;
  comment_type: string;
  created_at: string;
}

async function pollEscalationComments(): Promise<void> {
  try {
    // Query for escalation comments created since our last check.
    // Escalation comments have comment_type = 'escalation', or are notes
    // from Janet/Denver that contain escalation-related keywords.
    const params = new URLSearchParams({
      select: 'id,task_id,body,author_name,comment_type,created_at',
      or: '(comment_type.eq.escalation,and(comment_type.eq.note,author_name.in.(Janet,Denver,janet,denver)))',
      order: 'created_at.asc',
      limit: '10',
    });
    // Filter by time: only comments created after our last check
    params.append('created_at', `gt.${lastEscalationCheck}`);

    const url = `${SUPABASE_URL}/rest/v1/mc_task_comments?${params.toString()}`;
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    if (!res.ok) return;

    const comments = (await res.json()) as MCComment[];
    if (comments.length === 0) return;

    // Update our watermark to the latest comment we've seen
    lastEscalationCheck = comments[comments.length - 1].created_at;

    // Filter: only process comments that contain escalation signals
    const escalationKeywords = ['ESCALATION', 'URGENT', 'IMMEDIATE', 'SCOPE CHANGE', 'RE-ASSIGN', 'PRIORITY CHANGE'];
    const escalationComments = comments.filter((c) =>
      c.comment_type === 'escalation' ||
      escalationKeywords.some((kw) => c.body.toUpperCase().includes(kw)),
    );

    if (escalationComments.length === 0) return;

    const agentMap = await fetchAgentMap();

    // For each escalation comment, find the task's assigned agent and nudge them
    for (const comment of escalationComments) {
      // Fetch the task to get the assigned agent
      const taskParams = new URLSearchParams({
        select: 'id,task_number,title,assignee_agent_id,status',
        id: `eq.${comment.task_id}`,
      });

      const taskUrl = `${SUPABASE_URL}/rest/v1/mc_tasks?${taskParams.toString()}`;
      const taskRes = await fetch(taskUrl, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      });

      if (!taskRes.ok) continue;

      const tasks = (await taskRes.json()) as MCTask[];
      if (tasks.length === 0) continue;

      const task = tasks[0];
      if (!task.assignee_agent_id) continue;

      const mcName = agentMap.get(task.assignee_agent_id);
      if (!mcName) {
        logger.warn(
          { taskNumber: task.task_number, assigneeId: task.assignee_agent_id },
          'MC poller: escalation -- task assigned to unknown agent UUID -- skipping',
        );
        const unknownUuidSender = statusSender || notifySender;
        if (unknownUuidSender) {
          void unknownUuidSender(
            `⚠️ MC Poller: escalation on task #${task.task_number} targets unknown agent UUID ${task.assignee_agent_id}. Not in mc_agents. Add to agent registry.`,
          ).catch(() => {});
        }
        continue;
      }
      if (SKIP_AGENTS.has(mcName)) continue;

      const clawId = MC_TO_CLAW_ID[mcName] ?? mcName;

      if (!MC_TO_CLAW_ID[mcName]) {
        logger.warn(
          { mcName, clawId, taskNumber: task.task_number },
          'MC poller: escalation -- agent name not in MC_TO_CLAW_ID mapping -- using fallback. Add explicit entry.',
        );
        const fallbackSender = statusSender || notifySender;
        if (fallbackSender) {
          void fallbackSender(
            `⚠️ MC Poller: agent '${mcName}' not in MC_TO_CLAW_ID. Using fallback '${clawId}'. Add mapping to prevent silent failures.`,
          ).catch(() => {});
        }
      }

      // Nudge the agent for immediate wake
      const nudged = nudgeAgent(clawId);

      logger.info(
        {
          taskNumber: task.task_number,
          mcName,
          clawId,
          nudged,
          commentType: comment.comment_type,
          authorName: comment.author_name,
        },
        'MC poller: escalation comment detected -- nudged agent immediately',
      );

      // Notify status channel
      const escalationNotify = statusSender || notifySender;
      if (escalationNotify) {
        void escalationNotify(
          `⚡ Escalation on Task #${task.task_number}: ${task.title || 'Untitled'} -- ` +
          `${comment.author_name} added ${comment.comment_type} comment, nudged ${mcName}`,
        ).catch(() => {});
      }
    }
  } catch (err) {
    logger.warn({ err }, 'MC poller: escalation comment poll error');
  }
}

export function initMCPoller(send?: Sender, sendStatus?: Sender): void {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    logger.warn('MC poller: SUPABASE_URL or SUPABASE_ANON_KEY not set -- agent auto-wake disabled');
    return;
  }

  if (send) notifySender = send;
  if (sendStatus) statusSender = sendStatus;

  // Codex CLI health check at startup (non-fatal -- transient fs errors must not block the poller)
  try {
    const codexPath = resolveCodexCliPath();
    if (codexPath) {
      logger.info({ codexCliPath: codexPath }, 'Codex CLI resolved');
    } else {
      logger.warn('Codex CLI not found at startup -- verification tasks will fail until plugin is installed');
    }
  } catch (err) {
    logger.warn({ err }, 'Codex CLI health check failed -- poller continuing without Codex');
  }

  // Startup sequence: recover orphans first, then run full catch-up poll.
  // Recovery resets in_progress tasks for dead agents back to assigned,
  // so the catch-up poll can immediately re-dispatch them.
  void recoverOrphanedTasks().then(() => pollMCAssignments({ startup: true }));

  // Subsequent polls use the 2-min rolling window (avoids full-table scans every 30s).
  setInterval(() => void pollMCAssignments(), POLL_INTERVAL_MS);

  // Poll for ALL tasks in 'review' status -- single fetch, routes by department in code.
  // Replaces separate pollReviewTasks() + pollContentReviewTasks() to fix the null-department gap.
  void pollAllReviewTasks();
  setInterval(() => void pollAllReviewTasks(), POLL_INTERVAL_MS);

  // Poll for escalation comments -- nudge agents immediately on scope changes
  setInterval(() => void pollEscalationComments(), POLL_INTERVAL_MS);

  // Run stuck detection every 60s (since pg_cron is not available)
  setInterval(() => void runStuckDetection(), 60_000);
  void runStuckDetection(); // Initial run

  logger.info('MC poller started -- polling every 30s (assignments + review + escalations), stuck detection every 60s');
}
