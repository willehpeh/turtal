# V1 Production Readiness Requirements

Single-instance, single-process. Projections (live and persistent) tracked separately in [projections-design.md](./projections-design.md).

---

## Must add

### 7. `afterAppend` hook on EventStore

The [projections design](./projections-design.md) specifies an `afterAppend` callback on `EventStore` but it is not yet implemented. Projections depend on it for on-append scheduling.

---

## Should add

### 8. PostgreSQL serialization retry

`SERIALIZABLE` isolation causes `40001` serialization failures under concurrent appends. The store should retry these internally with a bounded retry count rather than surfacing opaque database errors.

### 10. Error wrapping

Database-specific errors (constraint violations, connection failures, serialization errors) currently propagate raw. Wrapping them in turtal-specific error types (e.g., `ConnectionError`, `SerializationError`) decouples users from `pg` and `better-sqlite3` internals.

---

## Nice to have

### 11. Event validation on append

No runtime check that events have a valid `id`, `type`, or non-empty `tags`. Malformed events silently insert and cause downstream confusion.

### 12. Idempotent append

Use the event `id` for deduplication (upsert / ignore on conflict) so that retried appends don't create duplicates. Particularly relevant for PostgreSQL where network issues can leave the client unsure whether an append succeeded.

### 13. Pagination / streaming for `events()`

`events()` returns `SequencedEvent[]`, loading all matching events into memory. With any meaningful event volume this will exhaust memory. Needs either cursor-based pagination (`limit` to complement the existing `afterPosition`) or an async iterator (`AsyncIterable<SequencedEvent>`). In practice, normal usage (projections, DCB decisions) is already bounded by `afterPosition` and `EventCriteria`.
