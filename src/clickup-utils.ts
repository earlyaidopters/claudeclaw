// ClickUp helpers.
//
// Today this exists for the BID Outreach auto-close flow: when the Gmail
// watcher detects a reply from a contact, we close any open task whose
// title mentions that contact in the "BID Outreach - NC Campaign" list.
//
// Every call here is wrapped so ClickUp downtime never breaks the caller
// (the watcher in particular runs on a timer and must stay resilient).

import { CLICKUP_API_TOKEN } from './config.js';
import { logger } from './logger.js';

/** ClickUp list that houses the BID Outreach - NC Campaign tasks. */
export const BID_OUTREACH_LIST_ID = '901327407565';

const CLICKUP_API = 'https://api.clickup.com/api/v2';

interface ClickUpTask {
  id: string;
  name: string;
  status?: { status?: string };
}

interface ListTasksResponse {
  tasks?: ClickUpTask[];
}

/**
 * Close every open task in `listId` whose `name` contains `contactName`.
 * Posts a short "auto-closed" comment on each match so the trail is auditable.
 *
 * Returns the number of tasks successfully closed. Never throws — any
 * ClickUp failure is logged and the function returns 0 (or the count of
 * tasks closed before the failure).
 */
export async function closeClickUpTasksForContact(
  contactName: string,
  contactEmail: string,
  listId: string = BID_OUTREACH_LIST_ID,
): Promise<number> {
  if (!CLICKUP_API_TOKEN) {
    logger.warn('closeClickUpTasksForContact: CLICKUP_API_TOKEN not set, skipping');
    return 0;
  }
  if (!contactName || !contactName.trim()) {
    logger.warn({ contactEmail }, 'closeClickUpTasksForContact: empty contactName, skipping');
    return 0;
  }

  const name = contactName.trim();
  let tasks: ClickUpTask[] = [];
  try {
    const res = await fetch(
      `${CLICKUP_API}/list/${encodeURIComponent(listId)}/task?include_closed=false`,
      { headers: { Authorization: CLICKUP_API_TOKEN } },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.warn(
        { status: res.status, body: body.slice(0, 200), contactEmail },
        'ClickUp list/task request failed',
      );
      return 0;
    }
    const json = (await res.json()) as ListTasksResponse;
    tasks = json.tasks || [];
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err), contactEmail },
      'ClickUp list/task request threw',
    );
    return 0;
  }

  const matches = tasks.filter((t) => typeof t.name === 'string' && t.name.includes(name));
  if (matches.length === 0) {
    logger.info({ name, contactEmail, scanned: tasks.length }, 'auto-close: no ClickUp tasks matched');
    return 0;
  }

  let closed = 0;
  for (const task of matches) {
    try {
      const putRes = await fetch(`${CLICKUP_API}/task/${encodeURIComponent(task.id)}`, {
        method: 'PUT',
        headers: {
          Authorization: CLICKUP_API_TOKEN,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'complete' }),
      });
      if (!putRes.ok) {
        const body = await putRes.text().catch(() => '');
        logger.warn(
          { taskId: task.id, status: putRes.status, body: body.slice(0, 200) },
          'ClickUp task status update failed',
        );
        continue;
      }
    } catch (err) {
      logger.warn(
        { taskId: task.id, err: err instanceof Error ? err.message : String(err) },
        'ClickUp task status update threw',
      );
      continue;
    }

    // Comment is best-effort: if it fails, the task is still closed and
    // we still count it as a success.
    try {
      const commentRes = await fetch(
        `${CLICKUP_API}/task/${encodeURIComponent(task.id)}/comment`,
        {
          method: 'POST',
          headers: {
            Authorization: CLICKUP_API_TOKEN,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ comment_text: 'Auto-closed: contact replied via email' }),
        },
      );
      if (!commentRes.ok) {
        const body = await commentRes.text().catch(() => '');
        logger.warn(
          { taskId: task.id, status: commentRes.status, body: body.slice(0, 200) },
          'ClickUp task comment failed (task still closed)',
        );
      }
    } catch (err) {
      logger.warn(
        { taskId: task.id, err: err instanceof Error ? err.message : String(err) },
        'ClickUp task comment threw (task still closed)',
      );
    }

    closed++;
  }

  logger.info(
    { contact: name, contactEmail, matched: matches.length, closed, list: listId },
    'auto-close: ClickUp tasks closed for contact reply',
  );
  return closed;
}
