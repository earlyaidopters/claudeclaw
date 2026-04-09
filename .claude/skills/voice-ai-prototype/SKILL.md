---
name: voice-ai-prototype
description: Generates a complete, deployment-ready voice AI agent prompt for a potential client. Use when Ben provides a client description, call transcript, website, or any context about a business interested in a voice AI agent. The skill extracts the business context, determines the use case (inbound receptionist, outbound cold caller, appointment setter, or hybrid), and builds a full structured prompt following proven patterns from real deployed agents. Saves the output to /Users/benelk/Documents/AI-OS/AI-Agency/Clients/[ClientName]/. Triggers on phrases like "build a prompt for [client]", "create an agent for [business]", "prototype for [client]", "voice agent for [company]".
---

# Voice AI Prototype Skill

Generates a complete, structured voice AI agent prompt for a potential client using battle-tested patterns from deployed agents.

## Resources

- **[references/speech-patterns.md](references/speech-patterns.md)** — Filler words, language to avoid, verbatim speech examples, response length guidelines. Read before writing any speech examples.
- **[references/qualification-framework.md](references/qualification-framework.md)** — IF/ONLY IF conditional patterns, transfer authorization blocks, info collection structure, variable strategy. Read when designing Steps 2-4.
- **[references/appointment-setting.md](references/appointment-setting.md)** — Complete appointment scheduling flow. Read when the use case includes booking.
- **[assets/voice-agent-template.md](assets/voice-agent-template.md)** — The master template. Always use this as the base. Replace all [PLACEHOLDER] tokens.

---

## Step 1: Extract Client Information

Read the provided input and extract:

| What | Why |
|---|---|
| Agent name | What the AI calls itself |
| Company name | Client's business name |
| Industry / service | What they sell or do |
| Agent mode | Inbound, outbound, appointment setter, or hybrid |
| Primary objective | What a successful call looks like |
| Qualification criteria | Good lead vs. turn away |
| Info to collect | Fields to gather during the call |
| Transfer conditions | When to escalate + any restrictions |
| Appointment setting | Yes/no, which calendar functions |
| Business hours + timezone | Operating hours |
| Key objections | Common pushbacks |

If a critical piece is missing, make a reasonable inference and flag it at the end. Do NOT ask Ben questions before starting — generate the prompt first.

---

## Step 2: Determine Agent Mode

**Inbound Receptionist** (Florida Oasis pattern)
- Caller reaches out to the business
- Emphasis: qualification gate, info collection, warm handoff or callback
- Heavy use of: qualification-framework.md

**Outbound Cold Caller** (Cold Caller AI Receptionist pattern)
- Agent initiates calls; may need two personas (gatekeeper + decision-maker)
- Emphasis: natural speech, referral hook, pain creation, booking
- Heavy use of: speech-patterns.md

**Appointment Setter / Speed-to-Lead** (Speed to Lead pattern)
- Following up on expressed interest, booking calls fast
- Emphasis: objection handling, confirming interest, full booking flow
- Heavy use of: appointment-setting.md

**Hybrid** — combine as needed.

---

## Step 3: Build the Prompt

Read [assets/voice-agent-template.md](assets/voice-agent-template.md) fully. Then build the prompt section by section:

1. **Global header rules** — copy verbatim (FIXED)
2. **Role** — agent name, role description, company
3. **Skills** — 3-5 relevant to this specific business
4. **Personality** — warm/empathetic (inbound), casual/genuine (outbound), direct/confident (setter)
5. **Speech Rules** — copy verbatim (FIXED)
6. **Speech Examples** — read speech-patterns.md, pull 3-5 examples adapted to this industry. Use real terms (e.g., "roofing estimate" not just "service")
7. **Info Collection Guidelines** — copy verbatim + add business-specific verification if needed
8. **Context** — company background, service, key pain point, key contacts
9. **Task + Success Criteria**
10. **Steps** — follow this order:
    - Step 1: Greeting (adapt for inbound vs. outbound)
    - Step 2: Info collection (one field at a time, named variables)
    - Step 3: Qualification (IF/ONLY IF pattern from qualification-framework.md)
    - Step 4: Core value delivery (use-case specific)
    - Step 5: Appointment setting (ONLY if needed — use appointment-setting.md template)
    - Closing step
11. **Objection Handling** — 5-10 objections specific to this business
12. **Notes** — copy RULES TO NEVER BREAK verbatim + business-specific rules

### Quality Checklist

- [ ] All decision trees max 4 levels deep (e.g., Step 3.2.1.4 is the limit)
- [ ] Qualification conditions use IF/ONLY IF pattern
- [ ] Transfer block has explicit conditions + business hours gate
- [ ] At least 3 speech examples with filler words
- [ ] "Language to NEVER USE" list is in Notes
- [ ] All RULES TO NEVER BREAK are present in Notes
- [ ] One-question-at-a-time rule is in Notes
- [ ] Variable names defined for all collected fields
- [ ] Pushy caller rescue block is present
- [ ] Appointment setting has timezone + AM/PM rules (if applicable)

---

## Step 4: Save the Prompt

Save to:
```
/Users/benelk/Documents/AI-OS/AI-Agency/Clients/[client-name]/[client-name]-voice-agent-prompt.md
```

Client folder name: company name, lowercased, hyphenated (e.g., `florida-oasis`, `acme-plumbing`).

Create the directory if it doesn't exist.

After saving, confirm: "Saved to AI-Agency/Clients/[ClientName]/. [2-sentence summary of what was built.]"

Then flag any gaps: "Assumed X because Y — confirm and I'll update."

---

## Key Notes

- The appointment-setting.md block is nearly complete — preserve the calendar error handling and AM/PM rules intact, they prevent real no-shows.
- Qualification IF/ONLY IF conditions must be strict and unambiguous — vague conditions cause expensive mistakes.
- Always include the pushy caller rescue block from qualification-framework.md in every prompt.
- If the input is a call transcript, focus on what the caller/prospect needed — that's the agent you're building.
- Output folder uses Mac paths. Obsidian vault root is `/Users/benelk/Documents/AI-OS`.
