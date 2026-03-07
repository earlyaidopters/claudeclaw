# Contributing to ClaudeClaw

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
