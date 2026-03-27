---
name: cw-knowledge-base
description: |
  Claim Warriors knowledge base creation pipeline. Extracts call recordings
  from GoHighLevel for completed-contract customers, transcribes them via
  Groq Whisper, and inserts transcripts into Supabase.

  Use this skill when user says:
  - "run the transcription pipeline"
  - "transcribe CW calls"
  - "run knowledge base extraction"
  - "run a batch of transcriptions"
  - "extract and transcribe calls"
---

# CW Knowledge Base Pipeline

End-to-end pipeline: GHL completed contracts -> contact IDs -> call recordings -> Groq Whisper transcription -> Supabase storage.

## Prerequisites

- Python: `C:\Users\benelk\AppData\Local\Programs\Python\Python312\python.exe`
- Scripts: `C:\Users\benelk\Documents\claimwarriors-claude-code-hub\src\`
- Env file: `C:\Users\benelk\Documents\claudeclaw\.env` (needs `CLAIM_WARRIOR_GHL_API_KEY`, `GROQ_API_KEY`)
- Supabase project: `upbbqaqnegncoetxuhwk` (Claim Warrior)
- Supabase table: `GHL Call Transcripts`

## How to Run

When invoked, ask the user for a batch size (default 50) and then execute all three phases in sequence. Do not stop between phases unless there's an error.

### Phase 1: Extract Contact IDs

Extract contact IDs from completed contracts in GHL. This generates the filtered list of customers to process.

```bash
cd C:\Users\benelk\Documents\claimwarriors-claude-code-hub\src && C:\Users\benelk\AppData\Local\Programs\Python\Python312\python.exe extract_contract_contacts.py "%CLAIM_WARRIOR_GHL_API_KEY%" > C:\Users\benelk\AppData\Local\Temp\ghl_completed_contract_contacts.txt
```

The `CLAIM_WARRIOR_GHL_API_KEY` env var must include the `Bearer ` prefix. Read it from the .env file:

```bash
set /p GHL_KEY=<nul
for /f "tokens=2 delims==" %%a in ('findstr "CLAIM_WARRIOR_GHL_API_KEY" C:\Users\benelk\Documents\claudeclaw\.env') do set GHL_KEY=%%a
```

**Actually -- just read the .env file with the Read tool, extract the key value, and pass it directly to the Python command.** That's simpler and more reliable than shell variable parsing on Windows.

After Phase 1 completes, report how many unique contact IDs were extracted.

### Phase 2: Transcribe Calls

Run the transcription pipeline with the requested batch size. The script outputs JSON lines to stdout -- one per transcribed call.

```bash
cd C:\Users\benelk\Documents\claimwarriors-claude-code-hub\src && C:\Users\benelk\AppData\Local\Programs\Python\Python312\python.exe transcribe_calls.py --env-file C:\Users\benelk\Documents\claudeclaw\.env --contact-ids C:\Users\benelk\AppData\Local\Temp\ghl_completed_contract_contacts.txt --batch-size <BATCH_SIZE> --processed-ids C:\Users\benelk\AppData\Local\Temp\ghl_processed_ids.txt --processed-contacts C:\Users\benelk\AppData\Local\Temp\ghl_processed_contacts.txt
```

**Important:** Redirect stdout to a JSONL file so you can parse results:

```bash
... > C:\Users\benelk\AppData\Local\Temp\ghl_transcription_batch.jsonl
```

Progress logs go to stderr (visible in terminal). The script handles:
- Rate limiting (auto-retry with backoff)
- Skipping voicemails and non-completed calls
- Skipping already-processed messages (via processed-ids file)
- Deleting WAV files after transcription

After Phase 2 completes, report how many calls were transcribed.

### Phase 3: Insert into Supabase

Read the JSONL output file and insert each row into the `GHL Call Transcripts` table using the Supabase MCP.

For each JSON line, use `mcp__Supabase-claim-warrior__execute_sql` with project_id `upbbqaqnegncoetxuhwk`:

```sql
INSERT INTO "GHL Call Transcripts" (ghl_contact_id, call_date, transcript, ghl_message_id, duration, direction, call_status, conversation_id)
VALUES ('<ghl_contact_id>', '<call_date>', '<transcript>', '<ghl_message_id>', <duration>, '<direction>', '<call_status>', '<conversation_id>')
ON CONFLICT (ghl_message_id) DO NOTHING;
```

**Escape single quotes** in transcript text (replace `'` with `''`).

After Phase 3, report:
- Total calls inserted
- Any duplicates skipped (ON CONFLICT)
- Current totals in Supabase (run a COUNT query)

## Resumability

Everything is resumable. Re-running the skill:
- Phase 1: Re-extracts the full contact list (fast, ~1-2 min)
- Phase 2: Skips already-processed messages via tracking files
- Phase 3: Supabase dedup via ON CONFLICT on ghl_message_id

## Tracking Files

| File | Purpose |
|------|---------|
| `ghl_completed_contract_contacts.txt` | Contact IDs from completed contracts (regenerated each run) |
| `ghl_processed_ids.txt` | Message IDs already processed (append-only) |
| `ghl_processed_contacts.txt` | Contacts fully scanned (all their calls done) |
| `ghl_transcription_batch.jsonl` | Latest batch output (overwritten each run) |

All in `C:\Users\benelk\AppData\Local\Temp\`.

## Supabase Table Schema

| Column | Type | Notes |
|--------|------|-------|
| id | bigint | Auto-increment PK |
| ghl_contact_id | text | NOT NULL |
| call_date | timestamptz | NOT NULL |
| transcript | text | nullable |
| created_at | timestamptz | default now() |
| ghl_message_id | text | UNIQUE constraint -- dedup key |
| duration | integer | seconds |
| direction | text | inbound/outbound |
| call_status | text | "completed" |
| conversation_id | text | GHL conversation ID |

## Full Runbook

For background context, methodology, and the full 6-step pipeline plan (including Gemini Flash extraction and Claude synthesis -- steps 4-6 not yet implemented), see:
`C:\Users\benelk\Documents\claimwarriors-claude-code-hub\02-Projects\knowledge-base-creation.md`
