# Test Gaps

## Resolved

- **AppendCondition error type assertions** — failure tests now assert `AppendConditionError` by name instead of generic `toThrowError()`.

## AppendCondition

- No test where events exist _after_ a given position, causing the condition to fail. Only the passing case (line 438) is tested.
- Line 153: appends `event` (id `event-1`) which was already inserted on line 143. This likely throws `DuplicateEventError` before the condition is even checked. Test passes because _some_ error is thrown, but it's testing the wrong thing.

## Unit Tests (missing entirely)

- **EventCriteria** — `isEmpty()`, immutability (chaining returns new instances), `afterPosition(0)` behavior.
- **AppendCondition** — `forCriteria()` with empty criteria ignoring position, `isEmpty()`.
- **AppendOptions** — default values when constructed with no arguments.
- **SqliteQueryBuilder / PostgresQueryBuilder** — SQL generation, parameter indexing, empty criteria producing no WHERE clause.
- **SqliteErrorFactory / PostgresErrorFactory** — error code branching, pass-through of existing `EventStoreError` instances.

## Edge Cases

- Appending an empty event array (`store.append([])`).
- Events with empty tags `[]`, empty payload `{}`, or exotic payload values.
- Special characters in type names, tag values, or payloads (SQL injection / escaping).
- Large payloads or many tags.
- Querying with a bare `EventCriteria.create()` after data exists (no filters).
- `afterPosition(0)` should return everything.
- `afterPosition` combined with type and/or tag filters.

## Metadata

- No test that metadata is per-append-call (not leaked across separate calls).
- No test that all events in a single `append()` batch receive the same metadata.

## Concurrency (PostgreSQL)

- "retry on serialization failure" test (line 28) is non-deterministic — two concurrent appends may not actually conflict, so the retry path may never execute.
- No test for retry exhaustion (all `MAX_RETRIES` attempts fail with serialization errors).

## Structure / Readability

- No `describe` blocks in the shared suite — 20+ flat `it()` calls.
- Heavy duplication in event construction; a `buildEvent(overrides)` factory would reduce noise.
- Misleading test name on line 71: "should fail to append if the event type already exists" reads like a uniqueness constraint on `type`, but it's actually about `AppendCondition` matching.
