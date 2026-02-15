# V1 Production Readiness Requirements

Single-instance, single-process. Projections (live and persistent) tracked separately in [projections-design.md](./projections-design.md).

---

## Must fix

### 1. SQL injection in SQLite query builder

`SqliteQueryBuilder` interpolates tag values directly into SQL strings via template literals. The PostgreSQL implementation correctly uses parameterized queries. This must be fixed before any use with user-influenced tags.

**File:** `src/sqlite/sqlite-query-builder.ts`

### 2. Missing public exports

`EventCriteria`, `AppendCondition`, `DomainEvent`, `SequencedEvent`, and `AppendConditionError` are not exported from `index.ts`. Users cannot construct queries or conditions without reaching into internal paths.

**File:** `src/index.ts`

---

## Must add

### 3. Pagination / streaming for `events()`

`events()` returns `SequencedEvent[]`, loading all matching events into memory. With any meaningful event volume this will exhaust memory. Needs either cursor-based pagination (`limit` to complement the existing `afterPosition`) or an async iterator (`AsyncIterable<SequencedEvent>`).

### 4. Connection lifecycle

No `close()` or `dispose()` method on `EventStore`. PostgreSQL pool connections leak without cleanup. SQLite's `better-sqlite3` database handle also needs explicit closing. Required for graceful shutdown.

### 5. Schema initialization

No `initialize()` or `ensureSchema()` method. Users have no documented way to create the required tables. Either constructors should auto-create tables, or there must be an explicit setup step.

### 6. `afterAppend` hook on EventStore

The [projections design](./projections-design.md) specifies an `afterAppend` callback on `EventStore` but it is not yet implemented. Projections depend on it for on-append scheduling.

---

## Should add

### 7. PostgreSQL serialization retry

`SERIALIZABLE` isolation causes `40001` serialization failures under concurrent appends. The store should retry these internally with a bounded retry count rather than surfacing opaque database errors.

### 8. Error wrapping

Database-specific errors (constraint violations, connection failures, serialization errors) currently propagate raw. Wrapping them in turtal-specific error types (e.g., `ConnectionError`, `SerializationError`) decouples users from `pg` and `better-sqlite3` internals.

---

## Nice to have

### 9. Event validation on append

No runtime check that events have a valid `id`, `type`, or non-empty `tags`. Malformed events silently insert and cause downstream confusion.

### 10. Idempotent append

Use the event `id` for deduplication (upsert / ignore on conflict) so that retried appends don't create duplicates. Particularly relevant for PostgreSQL where network issues can leave the client unsure whether an append succeeded.
