# V1 Production Readiness Requirements

Single-instance, single-process. Projections (live and persistent) tracked separately in [projections-design.md](./projections-design.md).

---

## Must add

### `afterAppend` hook on EventStore

The [projections design](./projections-design.md) specifies an `afterAppend` callback on `EventStore` but it is not yet implemented. Projections depend on it for on-append scheduling. The design should support multiple listeners — a single-callback `onAppend` would silently overwrite previous registrations.

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
