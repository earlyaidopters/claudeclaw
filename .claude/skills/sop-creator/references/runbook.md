# Runbook Template

For: Incident response, on-call, emergency fixes.

```markdown
---
title: [Service] [Issue Type] Runbook
owner: [team-name]
oncall: "#[oncall-channel]"
last_tested: YYYY-MM-DD
---

# [Service] [Issue Type] Runbook

> **TL;DR:** [One sentence: what this fixes and when to use it]

## Definition of Done

You're done when ALL of these are true:
- [ ] [Primary success indicator - e.g., "Alert resolved"]
- [ ] [Secondary indicator - e.g., "Error rate < 0.1%"]
- [ ] [Verification step - e.g., "Health check returns 200"]
- [ ] [Cleanup step - e.g., "Incident ticket updated"]

## Symptoms

You're here because:
- [ ] Alert: `[alert-name]` firing
- [ ] [Error message or log pattern]
- [ ] [Dashboard showing X metric above/below Y]

## Quick Diagnosis

```bash
# Check service status
kubectl get pods -n [namespace] -l app=[service-name]

# Check logs
kubectl logs -n [namespace] deployment/[service-name] --tail=100 | grep -i error
```

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| [Symptom 1] | [Cause] | [Action] |
| [Symptom 2] | [Cause] | [Action] |

## Mitigation Steps

### 1. [First thing to try]

```bash
[command]
```

**Done when:** [How you know this step worked]

### 2. [Second thing to try]

```bash
[command]
```

**Done when:** [Completion criteria]

### 3. [If nothing else works]

```bash
[command]
```

**Done when:** [Completion criteria]

## Escalation

**Escalate if:**
- Quick fixes don't work after [X] minutes
- [Other escalation trigger]

**Contact:** [Person/channel] via [method]

## Post-Resolution

- [ ] Verify Definition of Done checklist above
- [ ] Update incident ticket with timeline
- [ ] Schedule postmortem if needed
```
