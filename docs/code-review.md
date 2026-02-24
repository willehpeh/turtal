# Code Review

## PostgreSQL concurrency

### 3. No retry on SERIALIZABLE 40001

Under any concurrent writes, some appends will fail with raw PostgreSQL serialization errors. Without internal retry, the PostgreSQL implementation is effectively single-writer only. This is listed as "should add" in `v1-requirements.md` but is blocking for any multi-writer use.

### 4. `withOptimisticLock` is misnamed

The method runs a `SERIALIZABLE` transaction (SSI with predicate locking), not optimistic locking (read version, write with version check). The name actively misleads.

### 5. SERIALIZABLE is broader than needed

SSI serializes all reads and writes against all concurrent transactions. Two appends with non-overlapping criteria can still cause serialization failures because SSI conservatively flags phantom reads on the shared `events` table. Advisory-lock-based OCC scoped to the criteria would eliminate these false-positive aborts.

### 6. No concurrency tests

The test suite is entirely single-threaded. The PostgreSQL SERIALIZABLE behavior is untested.

---

## Design debt

### 7. ~~`EventCriteria` is mutable but looks immutable~~ (resolved)

`EventCriteria` now uses a private constructor with `readonly` fields. `forTypes` and `forTags` return new instances, matching the `QueryBuilder` pattern. Construction uses `EventCriteria.create()`.

### 8. `EventCriteria` cannot express `afterPosition`

Position-based filtering is only available through `AppendCondition`. There is no way to query events after a position, which the projections catch-up design requires and pagination would also need.

### 9. `onAppend` hook supports only one listener

The projections design specifies `onAppend(callback)` which replaces any previous callback. Multiple projectors or user hooks would silently overwrite each other. Needs a listener list.

---

## Projections plan

### 10. Catch-up loads all events into memory

The design processes all matching events in memory before writing state changes. Catching up from position 0 on a large event history could exhaust memory. Needs chunked batch processing.

### 11. `key()` returning undefined will crash at runtime

The example `event.tags.find(t => t.startsWith('cart:'))!` throws if an event matches the criteria but lacks the expected tag. The design should define behavior for undefined keys — skip the event or throw a descriptive error.

### 12. LMDB adds a second native dependency

The project already has `better-sqlite3`. Adding `lmdb-js` doubles the native compilation surface, affecting installation reliability and CI complexity.
