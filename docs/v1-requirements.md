# V1 Production Readiness Requirements

Single-instance, single-process. Projections (live and persistent) tracked separately in [projections-design.md](./projections-design.md).

---

## Must add

### `afterAppend` hook on EventStore

The [projections design](./projections-design.md) specifies an `afterAppend` callback on `EventStore` but it is not yet implemented. Projections depend on it for on-append scheduling. The design should support multiple listeners — a single-callback `onAppend` would silently overwrite previous registrations.

---

## Should add

### `EventCriteria` cannot express `afterPosition`

Position-based filtering is only available through `AppendCondition`. There is no way to query events after a position, which the projections catch-up design requires and pagination would also need.

### Rename `withOptimisticLock`

The method runs a `SERIALIZABLE` transaction (SSI with predicate locking), not optimistic locking (read version, write with version check). The name actively misleads.

### SERIALIZABLE isolation is broader than needed

SSI serializes all reads and writes against all concurrent transactions. Two appends with non-overlapping criteria can still cause serialization failures because SSI conservatively flags phantom reads on the shared `events` table. Advisory-lock-based OCC scoped to the criteria would eliminate these false-positive aborts.

### Concurrency tests

The test suite is entirely single-threaded. The PostgreSQL SERIALIZABLE behavior is untested.

---

## Nice to have

### Event validation on append

No runtime check that events have a valid `id`, `type`, or non-empty `tags`. Malformed events silently insert and cause downstream confusion.

### Idempotent append

Use the event `id` for deduplication (upsert / ignore on conflict) so that retried appends don't create duplicates. Particularly relevant for PostgreSQL where network issues can leave the client unsure whether an append succeeded.

### Pagination / streaming for `events()`

`events()` returns `SequencedEvent[]`, loading all matching events into memory. With any meaningful event volume this will exhaust memory. Needs either cursor-based pagination (`limit` to complement the existing `afterPosition`) or an async iterator (`AsyncIterable<SequencedEvent>`). This also affects projections catch-up, which processes all matching events in memory before writing state changes. In practice, normal usage (projections, DCB decisions) is already bounded by `afterPosition` and `EventCriteria`.

### Projections `key()` returning undefined

The example `event.tags.find(t => t.startsWith('cart:'))!` throws if an event matches the criteria but lacks the expected tag. The design should define behavior for undefined keys — skip the event or throw a descriptive error.

### LMDB adds a second native dependency

The project already has `better-sqlite3`. Adding `lmdb-js` doubles the native compilation surface, affecting installation reliability and CI complexity.
