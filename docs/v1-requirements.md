# V1 Production Readiness Requirements

Single-instance, single-process. Projections (live and persistent) tracked separately in [projections-design.md](./projections-design.md).

---

## Must add

### 4. Pagination / streaming for `events()`

`events()` returns `SequencedEvent[]`, loading all matching events into memory. With any meaningful event volume this will exhaust memory. Needs either cursor-based pagination (`limit` to complement the existing `afterPosition`) or an async iterator (`AsyncIterable<SequencedEvent>`).

### 5. Connection lifecycle

No `close()` or `dispose()` method on `EventStore`. PostgreSQL pool connections leak without cleanup. SQLite's `better-sqlite3` database handle also needs explicit closing. Required for graceful shutdown.

### 6. Schema initialization

No `initialize()` or `ensureSchema()` method. Users have no documented way to create the required tables. Either constructors should auto-create tables, or there must be an explicit setup step.

### 7. `afterAppend` hook on EventStore

The [projections design](./projections-design.md) specifies an `afterAppend` callback on `EventStore` but it is not yet implemented. Projections depend on it for on-append scheduling.

---

## Should add

### 8. PostgreSQL serialization retry

`SERIALIZABLE` isolation causes `40001` serialization failures under concurrent appends. The store should retry these internally with a bounded retry count rather than surfacing opaque database errors.

### 9. Event metadata

At minimum `correlationId` and `causationId` for tracing cause-and-effect across appends. Could be an optional `metadata` bag on `DomainEvent` rather than dedicated fields.

### 10. Error wrapping

Database-specific errors (constraint violations, connection failures, serialization errors) currently propagate raw. Wrapping them in turtal-specific error types (e.g., `ConnectionError`, `SerializationError`) decouples users from `pg` and `better-sqlite3` internals.

---

## Nice to have

### 11. Event validation on append

No runtime check that events have a valid `id`, `type`, or non-empty `tags`. Malformed events silently insert and cause downstream confusion.

### 12. Idempotent append

Use the event `id` for deduplication (upsert / ignore on conflict) so that retried appends don't create duplicates. Particularly relevant for PostgreSQL where network issues can leave the client unsure whether an append succeeded.
