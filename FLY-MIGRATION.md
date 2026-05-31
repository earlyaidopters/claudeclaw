# Fly.io Migration Runbook

How to move ClaudeClaw + Nikki off your Mac and onto Fly.io.

The whole thing is wrapped in three scripts. You should be able to do this in under an hour.

---

## What you're getting

- ClaudeClaw runs 24/7 on Fly.io — no dependency on your Mac being awake
- Same Nikki, same memory, same voice (SQLite + state files copy intact)
- `claw.impactworks.com` keeps working — DNS just gets re-pointed
- Audra (and you, from any device) can hit Mission Control from anywhere

Cost: ~$5–8/month for a `shared-cpu-1x` Fly machine + 3GB volume.

---

## Prerequisites

```bash
brew install flyctl
fly auth login                # opens a browser
fly auth whoami               # should print your email
```

Make sure your `.env` is current and complete — every key in there gets uploaded as a Fly secret.

---

## Step 1: Bootstrap the Fly app

```bash
cd ~/claudeclaw
chmod +x scripts/fly-setup.sh scripts/fly-migrate-data.sh scripts/fly-cutover.sh
./scripts/fly-setup.sh
```

This:

1. Creates the Fly app `claudeclaw`
2. Provisions a 3GB persistent volume `claudeclaw_store` in `iad`
3. Reads every key from your local `.env` and pushes them as Fly secrets (in staging mode so they're applied on first deploy)

It's idempotent — safe to re-run.

---

## Step 2: First deploy (empty container)

```bash
fly deploy
```

This builds the Docker image, ships it to Fly, and boots a machine with the volume mounted at `/app/store` (still empty). The bot will start polling Telegram but it has no memory yet — don't message Nikki here.

Verify the container is alive:

```bash
fly status -a claudeclaw
fly logs -a claudeclaw          # ctrl-C to exit
```

You should see `Daily brief scheduled (7am local)` and `Memory consolidation enabled` in the logs.

---

## Step 3: Migrate Nikki's memory

```bash
./scripts/fly-migrate-data.sh
```

This:

1. Stops the Fly machine briefly (so we don't copy mid-write)
2. SQLite checkpoint on the local DB (forces WAL → main file)
3. Uploads `claudeclaw.db`, `bid-roster.json`, `plaid-items.json`, `manual-accounts.json`, `manual-transactions.json`, `outreach-status.json`
4. Starts the machine back up
5. Verifies that remote memory count matches local

If the verification at the end shows matching memory counts, you've successfully transplanted Nikki.

You can also test her here BEFORE cutover by hitting the Fly URL directly:

```bash
open https://claudeclaw.fly.dev/?token=<YOUR_DASHBOARD_TOKEN>
```

But don't message Nikki on Telegram yet — both her Mac instance AND her Fly instance will be polling and you'll get double-replies.

---

## Step 4: Cutover

When you're ready to flip the switch:

```bash
./scripts/fly-cutover.sh
```

This:

1. Asks for confirmation
2. Stops the Mac launchd job (`com.claudeclaw.main`)
3. Runs one final data sync (catches any writes between step 3 and now)
4. Smoke tests `https://claudeclaw.fly.dev/api/health`
5. Prints DNS instructions and waits for you to update Cloudflare:
   - Delete the existing `claw` CNAME pointing at your tunnel
   - Add new CNAME: `claw` → `claudeclaw.fly.dev`, **Proxy OFF** (DNS only)
6. Provisions the TLS cert via `fly certs add claw.impactworks.com`
7. Verifies `https://claw.impactworks.com/api/health` returns 200

After it finishes: send Nikki a message in Telegram. She should reply from Fly, remembering everything (ZAGG, Ralph, BID, your Q3 plan, the whole memory bank).

---

## Step 5: Verify Audra can access it

Send her:

```
https://claw.impactworks.com/?token=<YOUR_DASHBOARD_TOKEN>
```

She opens it once, browser caches the token, future visits to `claw.impactworks.com` just work for her on any device.

---

## Obsidian vault (the one footnote)

The cloud Nikki can't read your Mac's Obsidian vault by default. Two ways to fix it:

### Option A: Syncthing (recommended)

1. Install Syncthing on Mac: `brew install syncthing && brew services start syncthing`
2. SSH into Fly, install Syncthing: `fly ssh console -a claudeclaw` then `apt-get install -y syncthing` (or add it to the Dockerfile)
3. Pair the two devices via the Syncthing web UI
4. Share the `Obsidian Brain` folder from Mac → set destination on Fly to `/app/store/obsidian`
5. Update Nikki's CLAUDE.md to point at the new path

### Option B: Skip it for now

If Audra and you don't actually ask Nikki to read live Obsidian notes often, you can defer this. Her memory of past Obsidian reads is already in SQLite and survived the migration.

---

## Operations cheat sheet

```bash
# Watch logs in real time
fly logs -a claudeclaw

# SSH into the machine
fly ssh console -a claudeclaw

# Restart (e.g. after a code change)
git push                       # if using GH Actions
# or manually:
fly deploy

# Inspect the volume
fly ssh console -a claudeclaw -C "ls -lah /app/store"

# Backup SQLite to your Mac
fly ssh sftp shell -a claudeclaw <<< "get /app/store/claudeclaw.db ./backups/claudeclaw-fly-$(date +%Y%m%d).db"

# Rotate a secret
fly secrets set GOOGLE_API_KEY=new_key_here -a claudeclaw

# Scale memory if needed
fly scale memory 2048 -a claudeclaw

# Check what's in your secrets (names only, never values)
fly secrets list -a claudeclaw
```

---

## Rollback procedure

If something goes wrong AFTER you've cut over and you need to go back to the Mac:

```bash
# 1. In Cloudflare DNS:
#    Swap claw CNAME back to your tunnel (proxy back ON)

# 2. Restart the Mac launchd job:
launchctl kickstart -k "gui/$(id -u)/com.claudeclaw.main"

# 3. Wait ~30s for tunnel to come up
curl -I https://claw.impactworks.com/api/health   # expect 200
```

Your Mac SQLite was the source of truth at cutover time, so nothing's lost. Any messages Nikki processed on Fly between cutover and rollback would be on the Fly DB — to recover those, run a reverse migration:

```bash
fly ssh sftp shell -a claudeclaw <<< "get /app/store/claudeclaw.db ./store/claudeclaw.db"
```

(stop the launchd job first, obviously)

---

## What this does NOT migrate

- `agent-*.pid` files (PIDs from your Mac — meaningless on Fly)
- `agent-*-conn.json` (regenerated by the Fly boot)
- `logs/` (logs from before migration stay on your Mac — Fly starts fresh)
- The launchd plist itself (Fly uses its own process supervisor)
- Local backups in `store/backups/` — included if you want them, but you can also keep them on your Mac

---

## When to come back to this doc

- Adding a new secret: `fly secrets set KEY=value -a claudeclaw` (also add to local `.env` for parity)
- Deploying a code change: `fly deploy`
- Bumping volume size: `fly volumes extend <vol_id> --size 5 -a claudeclaw`
- Adding a second region (multi-region SQLite is tricky — talk to me first)
