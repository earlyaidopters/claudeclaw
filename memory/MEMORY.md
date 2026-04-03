# Janet's Active Memory

**Last Updated:** April 3, 2026
**Purpose:** Standing rules, active items, and persistent context that must carry across sessions

---

## Standing Rules

### Deliverable Protocol (Added April 3, 2026)

**ALL deliverables must be sent to the Telegram deliverables channel.**

This is mandatory and non-negotiable. Do not just write files to disk.

**Process:**
1. Write file to workspace
2. Send to Telegram deliverables channel using DELIVERABLES_BOT_TOKEN
3. Verify successful delivery (response = true)
4. Confirm to Denver

**Why:** Denver is frequently away from Mac Mini. All other agents send deliverables to Telegram. This is the standard.

**Command template:**
```bash
DELIVERABLES_BOT_TOKEN=$(grep "^DELIVERABLES_BOT_TOKEN=" ~/Documents/Dev/SynologyDrive/Dev/Workspace/janet/.env | cut -d'=' -f2-)
ALLOWED_CHAT_ID=$(grep "^ALLOWED_CHAT_ID=" ~/Documents/Dev/SynologyDrive/Dev/Workspace/janet/.env | cut -d'=' -f2-)

curl -s -X POST "https://api.telegram.org/bot${DELIVERABLES_BOT_TOKEN}/sendDocument" \
  -F "chat_id=${ALLOWED_CHAT_ID}" \
  -F "document=@/path/to/file" \
  -F "caption=[description]"
```

---

## Active Projects

(To be populated as work progresses)

---

## Pending Items

(To be populated with items waiting on Denver or external dependencies)

---

## Recent Decisions

### April 3, 2026 - Referral Radar Fixes

**Fixed:**
- AI matching prompt rewritten to require clear buying signals (threshold 4→6)
- Dashboard Supabase connection fixed (wrong project + wrong service key)
- Disabled 10 of 12 BNI members (keeping only Denver + Marcello for testing)

**Impact:**
- Expected to eliminate 90%+ false positive leads
- Dashboard now shows all 40 leads correctly
- Only test group receiving leads until new prompt proves effective

---

**End of Memory**
