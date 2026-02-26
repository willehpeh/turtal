# Test Gaps

## Unit Tests (missing entirely)

These classes contain real logic but are only tested indirectly through integration tests. A query builder change could mask a criteria bug, and the integration tests wouldn't catch it.

- **EventCriteria** — `isEmpty()`, immutability (chaining returns new instances), `afterPosition(0)` behavior, `types()`/`tags()` return defensive copies.
- **AppendCondition** — `forCriteria()` with empty criteria ignoring position, `forCriteria()` with `after=0` (falsy) vs `after > 0`, `isEmpty()`.
- **AppendOptions** — default values when constructed with no arguments (condition is empty, metadata is `{}`).
- **SqliteQueryBuilder / PostgresQueryBuilder** — SQL generation, parameter indexing, empty criteria producing no WHERE clause, combined type+tag+position clauses. This is the most security-sensitive code in the project.
- **SqliteErrorFactory / PostgresErrorFactory** — error code branching, pass-through of existing `EventStoreError` instances (the `isEventStoreError` path in the base class is never exercised by any test).
- **SerializableTransaction** — retry loop, exponential backoff, serialization error detection (`code === '40001'`), client release on success and failure. This is the most complex control flow in the codebase and has zero direct tests.

## Weak Assertions in Existing Tests

- **Error assertions only check `{ name, isEventStoreError }`** — no test verifies error messages, `cause` chains, or `instanceof` checks. The error classes could return wrong messages and tests would still pass.
- **`expectEventsEqual` strips `timestamp` and `metadata`** — timestamps are only tested once (`toBeInstanceOf(Date)`) and never for ordering or reasonableness. A bug returning `new Date(0)` or misordered timestamps would go undetected.
- **No negative query tests** — no test queries for a type or tag that doesn't exist to verify an empty result. This is a basic filter-correctness check that's missing.

## Edge Cases

- Appending an empty event array (`store.append([])`).
- Events with empty tags `[]` round-tripping correctly (the SQLite `JSON_GROUP_ARRAY` null-filter at `sqlite.event-store.ts:44` is untested).
- Events with empty payload `{}`, nested payloads, array payloads, or exotic JSON values (every test uses `payload: {}`).
- Special characters in type names, tag values, or payloads (SQL injection / escaping).
- Large payloads or many tags.
- Querying with a bare `EventCriteria.create()` after data exists — implicitly tested but no explicit "returns all events" assertion.
- `afterPosition(0)` is silently a no-op because both query builders use `if (this._after)` which treats 0 as falsy. This works by accident, not by design. Needs a test and a design decision.
- `afterPosition` combined with type AND tag filters — tested in append-conditions but never in query tests.

## Concurrency (PostgreSQL)

- The "concurrent appends without data loss" test is non-deterministic — two concurrent appends may serialize naturally without triggering the retry path.
- The "exactly one append" test doesn't distinguish between serialization retry exhaustion and append condition failure. Both could produce the rejected results but through different code paths.
- No test for retry exhaustion (all `MAX_RETRIES` attempts fail with serialization errors).
- No test that specifically triggers and verifies the serialization retry path (40001 error → backoff → retry → success).

## Structural Gaps

- No SQLite-specific tests beyond the shared suite (PostgreSQL has two additional concurrency tests).
- No idempotent schema creation test (calling `createSync`/`create` twice with `IF NOT EXISTS`).
- No test for the duplicate event error when appending a batch where the duplicate is not the first event.
