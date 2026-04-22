/**
 * Stage A integration test — runs a live-ish round-trip against GHL
 * for Ashley's 4/20 5:59 PM call, the canonical failure case that
 * motivated the pipeline refactor.
 *
 *   contactId  = 0u6nz7UKk6k0ReuXrVr3
 *   callMsgId  = VTzIVbxKXAfN6gYxDWwa
 *
 * What this test does (explicitly NOT the full LLM pipeline):
 *   1. Build a deterministic STAGE_A_FACTS note body. We don't run the
 *      agent — the goal is to prove that the Stage A acceptance path
 *      (GHL note containing the STAGE_A_FACTS token) works end to end.
 *   2. POST the note to GHL.
 *   3. Re-fetch the contact's notes and assert one of them contains
 *      the STAGE_A_FACTS token plus our unique test marker.
 *
 * The test is skipped automatically when GHL credentials are not
 * available in the environment (e.g. CI without secrets). This keeps
 * `npm test` green for other developers without forcing them to wire
 * up GHL.
 *
 * Env vars (read from process.env or ~/clawd/.env):
 *   GHL_API_TOKEN (or GHL_API_KEY or GOHIGHLEVEL_API_TOKEN)
 *   GHL_LOCATION_ID (optional — not required for /contacts/:id/notes)
 */
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

import { buildPrompt, STAGE_A } from './stage-prompts.js';

const ASHLEY_CONTACT_ID = '0u6nz7UKk6k0ReuXrVr3';
const ASHLEY_CALL_MSG_ID = 'VTzIVbxKXAfN6gYxDWwa';
const GHL_BASE = 'https://services.leadconnectorhq.com';
const API_VERSION = '2021-07-28';
const FETCH_TIMEOUT_MS = 10_000;

/**
 * Read one or more possible env var names from process.env first,
 * falling back to ~/clawd/.env (where the shared GHL token lives).
 * We don't pollute process.env — just return the value.
 */
function readGhlToken(): string | null {
  const direct =
    process.env.GHL_API_TOKEN ??
    process.env.GHL_API_KEY ??
    process.env.GOHIGHLEVEL_API_TOKEN;
  if (direct) return direct;

  const clawdEnv = path.join(
    process.env.HOME || '/Users/aditya_office_ai_assistant',
    'clawd',
    '.env',
  );
  if (!fs.existsSync(clawdEnv)) return null;

  try {
    const content = fs.readFileSync(clawdEnv, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      if (
        key === 'GHL_API_TOKEN' ||
        key === 'GHL_API_KEY' ||
        key === 'GOHIGHLEVEL_API_TOKEN'
      ) {
        let value = trimmed.slice(eq + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (value) return value;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function ghlFetch(
  endpoint: string,
  token: string,
  init: RequestInit = {},
): Promise<Response> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(`${GHL_BASE}${endpoint}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Version: API_VERSION,
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
      signal: ctl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

const token = readGhlToken();
const runLive = Boolean(token) && process.env.SKIP_GHL_INTEGRATION !== '1';

// Use `describe.skipIf` so the tests are visibly skipped in the output,
// not silently omitted. Vitest 2+ supports this.
describe.skipIf(!runLive)(
  'Stage A integration (Ashley, live GHL)',
  () => {
    // Unique marker per run so re-running the test doesn't collide with
    // prior runs and so we can assert our exact write round-tripped.
    const marker = `TEST_RUN_${Date.now()}`;

    it('builds a prompt that references both IDs and the STAGE_A_FACTS token', () => {
      const prompt = buildPrompt(STAGE_A.template, {
        contactId: ASHLEY_CONTACT_ID,
        callMsgId: ASHLEY_CALL_MSG_ID,
        ghlConvId: null,
      });
      expect(prompt).toContain(ASHLEY_CONTACT_ID);
      expect(prompt).toContain(ASHLEY_CALL_MSG_ID);
      expect(prompt).toContain('STAGE_A_FACTS');
      expect(prompt).not.toMatch(/[<>]/);
    });

    it(
      'writes a STAGE_A_FACTS note on Ashley and reads it back',
      async () => {
        const body = [
          `STAGE_A_FACTS call_msg_id=${ASHLEY_CALL_MSG_ID} ${marker}`,
          'borrower_name: Ashley (integration test)',
          'phone: unknown',
          'email: unknown',
          'loan_purpose: unknown',
          'property_type: unknown',
          'property_value_estimate: unknown',
          'requested_loan_amount: unknown',
          'credit_score_self_reported: unknown',
          'income_type: unknown',
          'timeline: unknown',
          'veteran_status: unknown',
          'pain_points:',
          '  - (test row — not extracted)',
          'next_action: Follow-up scheduled after integration test.',
        ].join('\n');

        const postRes = await ghlFetch(
          `/contacts/${encodeURIComponent(ASHLEY_CONTACT_ID)}/notes`,
          token!,
          { method: 'POST', body: JSON.stringify({ body }) },
        );
        expect(postRes.ok).toBe(true);
        const postJson = (await postRes.json()) as {
          note?: { id?: string; body?: string };
        };
        expect(postJson.note?.body ?? '').toContain('STAGE_A_FACTS');
        expect(postJson.note?.body ?? '').toContain(marker);

        // Round-trip: list the contact's notes and confirm our marker
        // is present. This proves Stage A's acceptance path can see
        // the note it just wrote.
        const listRes = await ghlFetch(
          `/contacts/${encodeURIComponent(ASHLEY_CONTACT_ID)}/notes`,
          token!,
          { method: 'GET' },
        );
        expect(listRes.ok).toBe(true);
        const listJson = (await listRes.json()) as {
          notes?: Array<{ body?: string }>;
        };
        const notes = listJson.notes ?? [];
        const match = notes.find(
          (n) =>
            (n.body ?? '').includes('STAGE_A_FACTS') &&
            (n.body ?? '').includes(marker),
        );
        expect(match, 'STAGE_A_FACTS note with marker should be retrievable').toBeDefined();
      },
      30_000,
    );
  },
);

describe.skipIf(runLive)('Stage A integration (offline — credentials missing)', () => {
  // When GHL creds are not available we still run a dry-run assertion
  // that proves the prompt contract holds. This keeps the suite green
  // for contributors who don't have GHL access.
  it('builds a valid Stage A prompt without live credentials', () => {
    const prompt = buildPrompt(STAGE_A.template, {
      contactId: ASHLEY_CONTACT_ID,
      callMsgId: ASHLEY_CALL_MSG_ID,
      ghlConvId: null,
    });
    expect(prompt).toContain(ASHLEY_CONTACT_ID);
    expect(prompt).toContain(ASHLEY_CALL_MSG_ID);
    expect(prompt).toContain('STAGE_A_FACTS');
    expect(prompt).not.toMatch(/[<>]/);
  });
});
