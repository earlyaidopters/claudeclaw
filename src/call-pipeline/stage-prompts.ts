/**
 * Call Pipeline — Stage Prompts
 *
 * Four scoped prompts that replace the old monolithic call-processor.
 * Each stage does ONE job, writes ONE GHL note, terminates. Why plain
 * text only: bot.ts renders mission status with HTML parse mode, so
 * angle brackets would break truncation. All templates use square
 * brackets / parentheses instead.
 *
 * Vars substituted by the orchestrator before handoff to the agent:
 *   {{CONTACT_ID}}, {{CALL_MSG_ID}}, {{CALL_CONV_ID}}
 */

export type StageId = 'A' | 'B' | 'C' | 'D';

export interface StagePrompt {
  stage: StageId;
  title: string;
  priority: number;
  assignedAgent: string;
  template: string;
  acceptanceCriteria: string;
}

const PLAIN_TEXT_RULE =
  'FORMATTING RULE. Use plain text only. Do NOT emit angle brackets anywhere ' +
  'in notes, tags, tool arguments, or the final reply. Angle brackets break ' +
  'the Telegram HTML parser in bot.ts and truncate mission status lines. Use ' +
  'square brackets, parentheses, or quotes instead.';

const footer = (stage: StageId) =>
  `\n${PLAIN_TEXT_RULE}\n\nOn completion, reply with one line:\nSTAGE_${stage}_DONE call_msg_id={{CALL_MSG_ID}}`;

// ── Stage A: Extract facts from transcript ───────────────────────────
const STAGE_A_TEMPLATE = `Stage A — Extract Facts.

Context:
  contact_id   = {{CONTACT_ID}}
  call_msg_id  = {{CALL_MSG_ID}}
  conv_id      = {{CALL_CONV_ID}}

Steps:
1. Fetch the transcript. The call-worker already wrote a CALL_TRANSCRIPT
   note on the contact containing the full text. Read that note.
2. Extract these facts. If a field is not mentioned, write "unknown":
     - borrower_name, phone, email
     - loan_purpose (purchase | refi_rate_term | refi_cashout | heloc | other)
     - property_type (SFR | condo | multi | commercial | other)
     - property_value_estimate, requested_loan_amount
     - credit_score_self_reported, income_type
       (W2 | 1099 | self_employed | retiree | rental | mixed)
     - timeline (urgent | 30d | 60d | 90d_plus | unknown)
     - veteran_status (yes | no | unknown)
     - pain_points (short bullet list)
     - next_action (promised follow-up, callback time, etc.)
3. Write a single GHL contact note on {{CONTACT_ID}} with this exact
   structure (plain text, NO angle brackets):
     STAGE_A_FACTS call_msg_id={{CALL_MSG_ID}}
     borrower_name: ...
     phone: ...
     ... (all fields above, one per line)
     pain_points:
       - ...
     next_action: ...
4. Update GHL custom fields and tags where you have high confidence. Do
   NOT overwrite existing fields with "unknown".

Do NOT do RAG research. Do NOT draft emails. That is stages B, C, D.
${footer('A')}`;

// ── Stage B: Loan product RAG + rule-based rerank ────────────────────
const STAGE_B_TEMPLATE = `Stage B — Loan Product Recommendation.

Context:
  contact_id   = {{CONTACT_ID}}
  call_msg_id  = {{CALL_MSG_ID}}

Steps:
1. Read STAGE_A_FACTS from {{CONTACT_ID}}. Key fields: loan_purpose,
   income_type, credit_score_self_reported, property_type,
   property_value_estimate, requested_loan_amount.
2. Pinecone shortlist: query the loan-atlas index with a concise
   natural-language query from the facts above. Pull top 10.
3. Rule-based rerank against JSMN lender matrix:
     - income_type in (1099, self_employed) AND credit >= 660
       -> boost Non-QM bank statement programs.
     - requested_loan_amount <= asset_value and liquid assets implied
       -> boost asset depletion.
     - loan_purpose = refi_cashout AND credit >= 680 AND W2
       -> boost conventional cash-out.
4. Pick top 3. For each: program_name, lender, why_it_fits (one
   sentence), key_guideline_hits.
5. Write a GHL note on {{CONTACT_ID}} with body:
     STAGE_B_RECOMMENDATION call_msg_id={{CALL_MSG_ID}}
     top_programs:
       1. ...
       2. ...
       3. ...
     notes_for_ae: ...

Keep the note under 2000 characters. Plain text only.
${footer('B')}`;

// ── Stage C: Borrower follow-up email draft ──────────────────────────
const STAGE_C_TEMPLATE = `Stage C — Borrower Follow-Up Draft.

Context:
  contact_id   = {{CONTACT_ID}}
  call_msg_id  = {{CALL_MSG_ID}}

Steps:
1. Read STAGE_A_FACTS and STAGE_B_RECOMMENDATION from the contact.
2. Draft a short, warm follow-up email to the borrower:
     - Thank them for the call (reference something specific).
     - Recap the goal you heard.
     - Name one or two program paths you are exploring.
     - Ask for the 2-3 documents needed to move forward.
     - Propose a concrete next step (time for a call, apply link).
   Tone: conversational, confident, no jargon, no em dashes. Under 180
   words.
3. Create a Gmail draft via the gmail-personal MCP. From
   aditya@jsmninvestments.com. To the borrower email captured in
   STAGE_A_FACTS. If email is unknown, terminate FAIL and note the
   missing field.
4. Capture the returned draftId.
5. Write a GHL note on {{CONTACT_ID}} with body:
     STAGE_C_BORROWER call_msg_id={{CALL_MSG_ID}} draftId=[ID]
     to: ...
     subject: ...
     preview: (first 240 chars of body)
   (Literal word draftId followed by equals followed by the Gmail
   identifier. Do NOT wrap the ID in angle brackets.)

Do NOT send the email. Draft only.
${footer('C')}`;

// ── Stage D: AE (account exec) Outlook draft ─────────────────────────
const STAGE_D_TEMPLATE = `Stage D — AE Desk Draft (Non-QM).

Context:
  contact_id   = {{CONTACT_ID}}
  call_msg_id  = {{CALL_MSG_ID}}

Steps:
1. Read STAGE_A_FACTS and STAGE_B_RECOMMENDATION from the contact.
2. Draft an internal scenario email to the C21 Non-QM AE desk:
     - Subject: "Scenario: [loan_purpose] [property_type] credit ~[score]"
     - Body: borrower summary, scenario numbers (LTV, DTI if known),
       two or three program candidates from Stage B, the specific
       guideline question you need confirmed.
   Tone: concise, LO-to-AE, no fluff.
3. Create an Outlook draft via the c21-outlook MCP. From the lending
   account. To the Non-QM desk distribution list configured in
   ref/tools.md. Capture draftId.
4. Write a GHL note on {{CONTACT_ID}} with body:
     STAGE_D_AE call_msg_id={{CALL_MSG_ID}} draftId=[ID]
     to: (desk address)
     subject: ...
     preview: (first 240 chars of body)
   (Literal word draftId followed by equals followed by the Outlook
   identifier. Do NOT wrap the ID in angle brackets.)

Do NOT send. Draft only.
${footer('D')}`;

// ── Acceptance criteria strings (stored in mission_tasks.acceptance_criteria) ──

export const STAGE_A_ACCEPTANCE =
  'GHL contact note with body containing token STAGE_A_FACTS and the ' +
  'matching call_msg_id={{CALL_MSG_ID}} must exist on contact {{CONTACT_ID}}. ' +
  'call_pipeline_runs row for this call_msg_id stage A status completed.';

export const STAGE_B_ACCEPTANCE =
  'GHL contact note with body containing token STAGE_B_RECOMMENDATION and ' +
  'the matching call_msg_id={{CALL_MSG_ID}} must exist on contact ' +
  '{{CONTACT_ID}}. At least one program listed in top_programs.';

export const STAGE_C_ACCEPTANCE =
  'GHL contact note body matching regex: STAGE_C_BORROWER .* draftId=.+ ' +
  'must exist on contact {{CONTACT_ID}}. Referenced Gmail draft retrievable.';

export const STAGE_D_ACCEPTANCE =
  'GHL contact note body matching regex: STAGE_D_AE .* draftId=.+ must exist ' +
  'on contact {{CONTACT_ID}}. Referenced Outlook draft retrievable.';

// ── Registry ─────────────────────────────────────────────────────────

export const STAGE_A: StagePrompt = {
  stage: 'A', title: 'Call pipeline A: extract facts',
  priority: 7, assignedAgent: 's2l',
  template: STAGE_A_TEMPLATE, acceptanceCriteria: STAGE_A_ACCEPTANCE,
};
export const STAGE_B: StagePrompt = {
  stage: 'B', title: 'Call pipeline B: loan product RAG',
  priority: 7, assignedAgent: 's2l',
  template: STAGE_B_TEMPLATE, acceptanceCriteria: STAGE_B_ACCEPTANCE,
};
export const STAGE_C: StagePrompt = {
  stage: 'C', title: 'Call pipeline C: borrower email draft',
  priority: 7, assignedAgent: 's2l',
  template: STAGE_C_TEMPLATE, acceptanceCriteria: STAGE_C_ACCEPTANCE,
};
export const STAGE_D: StagePrompt = {
  stage: 'D', title: 'Call pipeline D: AE desk draft',
  priority: 7, assignedAgent: 's2l',
  template: STAGE_D_TEMPLATE, acceptanceCriteria: STAGE_D_ACCEPTANCE,
};

export const STAGE_REGISTRY: Record<StageId, StagePrompt> = {
  A: STAGE_A, B: STAGE_B, C: STAGE_C, D: STAGE_D,
};

/** Substitute {{CONTACT_ID}} etc. into a template. */
export function buildPrompt(
  template: string,
  vars: { contactId: string; callMsgId: string; ghlConvId?: string | null },
): string {
  return template
    .replace(/\{\{CONTACT_ID\}\}/g, vars.contactId)
    .replace(/\{\{CALL_MSG_ID\}\}/g, vars.callMsgId)
    .replace(/\{\{CALL_CONV_ID\}\}/g, vars.ghlConvId ?? 'unknown');
}

/** Substitute vars into the acceptance-criteria string. */
export function buildAcceptance(
  acceptance: string,
  vars: { contactId: string; callMsgId: string },
): string {
  return acceptance
    .replace(/\{\{CONTACT_ID\}\}/g, vars.contactId)
    .replace(/\{\{CALL_MSG_ID\}\}/g, vars.callMsgId);
}

/** Next stage in the pipeline, or null if D is terminal. */
export function nextStage(stage: StageId): StageId | null {
  return ({ A: 'B', B: 'C', C: 'D', D: null } as const)[stage];
}
