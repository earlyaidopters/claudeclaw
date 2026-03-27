# Decision Tree Template

For: Complex processes with conditional paths.

```markdown
---
title: [Decision Process Name]
owner: [Person or team]
last_updated: YYYY-MM-DD
---

# [Decision Process Name]

> **TL;DR:** How to handle [situation type]. Start at top, follow the path.

## Definition of Done

This process is complete when:
- [ ] Correct path identified and followed
- [ ] [Primary action completed]
- [ ] [Outcome verified]
- [ ] [Any notification/handoff done]

---

## Start Here

**What are you dealing with?**

| Situation | Go to |
|-----------|-------|
| [Situation A] | [Path A](#path-a) |
| [Situation B] | [Path B](#path-b) |
| [Situation C] | [Path C](#path-c) |
| Not sure | [Assessment](#assessment) |

---

## Assessment

**Question: [What to determine first]**

- If **[Answer A]** → Go to [Path A](#path-a)
- If **[Answer B]** → Go to [Path B](#path-b)
- If **unclear** → [Who to ask]

---

## Path A

**You're here because:** [Condition]

### Do this:

1. [Action]
2. [Action]
3. [Action]

**Done when:** [Completion criteria]

→ Go to [Verify Completion](#verify-completion)

---

## Path B

**You're here because:** [Condition]

### First, check [factor]:

| If | Then |
|----|------|
| [Condition 1] | [Action] |
| [Condition 2] | [Action] |
| None of above | Escalate to [contact] |

**Done when:** [Completion criteria]

→ Go to [Verify Completion](#verify-completion)

---

## Path C

**You're here because:** [Condition]

> **Warning:** [Important caution if applicable]

1. [Action]
2. [Action]
3. **Check:** [Verification point]
   - OK → [Next action]
   - NOT OK → Escalate to [contact]

**Done when:** [Completion criteria]

→ Go to [Verify Completion](#verify-completion)

---

## Verify Completion

Return to Definition of Done and confirm:
- [ ] Correct path identified and followed
- [ ] [Primary action completed]
- [ ] [Outcome verified]
- [ ] [Any notification/handoff done]

## Escalation

**Escalate if:**
- Stuck for more than [timeframe]
- [Other trigger]

**Contact:** [Person/channel]
```
