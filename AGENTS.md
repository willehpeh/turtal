# AGENTS.md

## Commands
- Build: `npm run build` (tsup)
- Lint: `npm run lint` / `npm run lint:fix`
- Test all: `npm test` (vitest watch) or `npm run test:run` (single run)
- Single test: `npx vitest run tests/sqlite/sqlite.event-store.spec.ts`
- Single test by name: `npx vitest run -t "test name"`

## Architecture
DCB-enabled Event Store library for Node.js. Two layers:
- `src/core/event-store/` — abstract `EventStore` class, types (`DomainEvent`, `SequencedEvent`, `AppendCondition`, `EventCriteria`), and `QueryBuilder` interface
- `src/sqlite/` — `SqliteEventStore` implementation using `better-sqlite3`, with `SqliteQueryBuilder` and schema definition
- `tests/` — vitest specs (globals enabled, pattern `tests/**/*.spec.ts`)

## Code Style
- TypeScript strict mode, ES2022 target, ESNext modules
- Types use `type` keyword (not `interface`); abstract classes for contracts
- Imports: relative paths, `type` imports where applicable
- Naming: PascalCase classes/types, camelCase methods/vars, dot-separated filenames (e.g. `sqlite.event-store.ts`)
- ESLint: strict typescript-eslint; unused vars prefixed with `_`
- No comments unless necessary; keep code concise
- Errors: custom error classes (e.g. `AppendConditionError`)
