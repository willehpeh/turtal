# Test Gaps

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

## Concurrency (PostgreSQL)

- "retry on serialization failure" test (line 28) is non-deterministic — two concurrent appends may not actually conflict, so the retry path may never execute.
- No test for retry exhaustion (all `MAX_RETRIES` attempts fail with serialization errors).
