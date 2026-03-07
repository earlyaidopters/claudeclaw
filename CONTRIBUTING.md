# Contributing to ClaudeClaw

## Personal Configuration

ClaudeClaw keeps your personal assistant configuration — your name, Obsidian vault path, AI persona, and custom context — **outside the repository** in a dedicated config folder (default: `~/.claudeclaw`).

**Why?** The `CLAUDE.md` file is a personalised system prompt. Committing it to a public repo would expose who you are, what you do, and how your assistant is configured. The config folder pattern keeps the repo generic and safe to share, while your setup stays private.

**How it works:**
- `CLAUDE.md.example` in the repo is a generic template with `[BRACKETED]` placeholders.
- On first run, `npm run setup` asks for a config folder path and copies the example to `<config>/workspace/CLAUDE.md`.
- You then edit that file to personalise it.
- `CLAUDECLAW_CONFIG` in `.env` points ClaudeClaw to your config folder.
- At startup, ClaudeClaw uses `<config>/workspace/` as the working directory for the Claude Agent SDK, so `CLAUDE.md` is loaded from there directly — no symlinks involved.

**For contributors:** Never add personal details (real names, file paths, usernames, email addresses) to any file that is committed to the repo. Use generic placeholders (`CLAUDECLAW_CONFIG`, `/path/to/`, `your-name`) in examples and tests.

## Adding a new env variable

When a feature needs a new runtime setting, update all of these in one PR:

1. **`src/env.ts`** — no change needed; `readEnvFile` is call-site driven.

2. **`src/config.ts`** — add the key to the `readEnvFile([...])` call and export a typed constant:
   ```ts
   // in the readEnvFile([...]) array
   'MY_NEW_VAR',

   // export
   export const MY_NEW_VAR = process.env.MY_NEW_VAR || envConfig.MY_NEW_VAR || '';
   ```

3. **`.env.example`** — add an entry with a comment explaining what it is and where to get it:
   ```
   # ── My feature ─────────────────────────────────────────────────────────────
   # Short description. Get it at: example.com/api-keys
   MY_NEW_VAR=
   ```

4. **`scripts/setup.ts`** — if the wizard should collect the value interactively, add a prompt in the right section and include the key in both the `lines` array and the `known` set so it is preserved across re-runs.

5. **`README.md` — Configuration reference table** — add a row:
   ```md
   | `MY_NEW_VAR` | No | What it does and where to get it |
   ```

6. **`CHANGELOG.md`** — note the new variable under `### Added` in the current version block.

## Adding a migration

Use the `add-migration` skill from within Claude Code:

```
/add-migration
```

or write a prompt like `add a new migration`.

The skill will walk you through picking a version bump (current / patch / minor / major),
naming the migration, and will create the migration file, update `migrations/version.json`,
sync `package.json`, and add an entry to `CHANGELOG.md`.

After the skill finishes, open the generated file and implement the `run()` function.

## Running tests

Tests use [Vitest](https://vitest.dev). Make sure dependencies are installed first:

```bash
npm install
```

Run the full test suite once:

```bash
npm test
```

Run in watch mode during development:

```bash
npm run test:watch
```

Run with coverage report:

```bash
npm run test:coverage
```

Run a specific test file:

```bash
npx vitest run src/migrations.test.ts
```

## Test layout

Tests live next to the source files they cover:

```
src/
  migrations.ts
  migrations.test.ts
  db.ts
  db.test.ts
  ...
```

Integration tests that hit external APIs (Telegram, etc.) are in files ending with `.integration.test.ts`. They are included in the normal test run but skip automatically when the required credentials are absent.

## Writing tests

- Use `describe` / `it` blocks. Nest `describe` blocks to group related cases.
- Use `beforeEach` / `afterEach` for setup and teardown; clean up any temp files or mocks.
- Mock `process.exit` with `vi.spyOn` when testing guard functions — do not let tests actually exit the process.
- Test files that touch the file system should create a temp directory via `fs.mkdtempSync` and remove it in `afterEach`.
- Match the style of existing tests: short, focused assertions, no commented-out code.
