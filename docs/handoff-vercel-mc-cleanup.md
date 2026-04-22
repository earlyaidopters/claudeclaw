# Claude Code Handoff — Strip Kanban from Vercel Mission Control

Mission Control at `mission-control-ten-jade.vercel.app` is becoming a fragrance-only dashboard. Aditya moved agent task management to ClaudeClaw's in-app dashboard. Remove the kanban/pipeline/agent-task views so the Vercel site only shows fragrance catalog, budget tracker, wishlist, and trading bots.

Paste this into Claude Code on desktop. Use **Sonnet**.

---

```
# Task: Remove kanban/mission-task views from Vercel Mission Control

## Model
Use Sonnet. Front-end refactor + deploy.

## Context
Repo: `/Users/aditya_office_ai_assistant/clawd/repos/mission-control`
Deployed at: https://mission-control-ten-jade.vercel.app
Framework: Next.js 14 (App Router)
Data source: Supabase (reads `fragrance_catalog`, `bot_kv`, `kanban_tasks`, etc.)

Problem: `kanban_tasks` was migrated to ClaudeClaw's local SQLite in v1.2.0. The Vercel site's kanban view now shows stale Supabase data. Aditya is moving agent task management to ClaudeClaw's dashboard. Strip the kanban view so Vercel MC becomes fragrance-only.

## What to keep

- `/` home page (adjust landing cards accordingly)
- `/fragrances` — fragrance catalog
- `/bots` — trading bots page (reads bot_kv, still in Supabase)
- `/dion` — DION pipeline page (if still relevant — confirm before removing)
- Fragrance budget tracker (if a separate route; if not, confirm where it lives)
- Wishlist view (if a separate route)
- `app/api/catalog/`, `app/api/fragrances/`, `app/api/bots/`, `app/api/insights/`, `app/api/fragella/`, `app/api/paper-trading-metrics/`, `app/api/quant-scanner/` — all fragrance/bot-related

## What to remove

- `/pipeline` — pipeline/kanban view (wholesale delete)
- `/agent-hq` — unless it's just a monitoring dashboard unrelated to kanban — confirm with `ls app/agent-hq` and decide
- `app/api/kanban*/` — any kanban endpoints
- `app/api/agent-hq/`, `app/api/maricela-metrics/` — agent-task-related, remove
- `app/api/dashboard/` — if it includes kanban aggregation, strip kanban
- Any `supabase.from('kanban_tasks')` calls in `lib/supabase.ts`, replace with stub or delete
- Nav links in `app/components/Navigation.tsx` to any removed routes

## Steps

1. **Scout first** — list all routes and map which are kanban vs fragrance. Do a dry summary before changes:
```bash
cd /Users/aditya_office_ai_assistant/clawd/repos/mission-control
ls app/
ls app/api/
grep -rn "kanban_tasks" app/ lib/
grep -rn "pipeline\|agent-hq" app/components/Navigation.tsx
```

2. **Remove kanban/pipeline pages:**
```bash
rm -rf app/pipeline
rm -rf app/agent-hq   # if confirmed kanban-related
rm -rf app/api/kanban   # if exists
rm -rf app/api/agent-hq
rm -rf app/api/maricela-metrics
```

3. **Strip from Navigation** (`app/components/Navigation.tsx`) — remove nav items pointing to deleted routes.

4. **Strip from `lib/supabase.ts`** — remove the `kanban_tasks` query (currently: `${SUPA_URL}/rest/v1/kanban_tasks?select=column_id`). If it's part of a larger aggregation, delete just that query.

5. **Update `app/page.tsx`** (the landing page) — remove any cards/widgets pointing to pipeline/agent-hq. Keep: fragrance catalog card, wishlist, budget, bots.

6. **Build + test locally:**
```bash
npm install
npm run build
npm run dev
# Open http://localhost:3000 and verify:
# - Home page loads, no broken links
# - /fragrances loads
# - /bots loads
# - /pipeline returns 404 (expected)
# - /agent-hq returns 404 (if removed)
```

7. **Deploy:**
```bash
# If linked to Vercel via git:
git add -A
git commit -m "feat(mc): strip kanban/pipeline views, keep fragrance + bots only

ClaudeClaw now owns agent task management via its local dashboard.
Vercel MC becomes a fragrance-focused business dashboard.

Co-Authored-By: Oz <oz-agent@warp.dev>"
git push

# Otherwise:
npx vercel --prod
```

## Constraints

- Do NOT touch fragrance, wishlist, budget, or bot routes/APIs
- Do NOT commit if `npm run build` fails
- Do NOT deploy without local verification first
- Preserve the supabase client in `lib/supabase.ts` — just remove kanban query
- If a route is ambiguous (e.g. `/dion`), ASK before removing

## Report back

- Files deleted (list)
- Files modified (list)
- Local build passed: yes/no
- Vercel deployment URL + status
- Any ambiguous routes you flagged
```

---

## Summary for human driver

- **Model:** Sonnet
- **Duration:** 30-60 min
- **Risk:** low (front-end refactor, easy to roll back via git)
- **Deploy:** auto if Vercel is linked to the repo's git remote; otherwise `npx vercel --prod`
