# Projections Design Decisions

## Overview

Turtal will support two types of projections:

1. **Live projections** — on-demand, transient folds for DCB decision-making
2. **Persistent projections** — eventually consistent read models backed by an embedded KV store

---

## Live Projections

### Purpose

Used in the DCB workflow: project current state from events, make a business decision, append new events with an `AppendCondition` referencing the last seen position.

### Design

A standalone `project` function (not a method on `EventStore`) that takes a store and a projection definition:

```typescript
type ProjectionDefinition<S> = {
  criteria: EventCriteria;
  initialState: S;
  when: Record<string, (state: S, event: DomainEvent) => S>;
};

type ProjectionResult<S> = {
  state: S;
  position: number;
  appendCondition: AppendCondition;
};

async function project<S>(store: EventStore, definition: ProjectionDefinition<S>): Promise<ProjectionResult<S>>;
```

### Usage

```typescript
const { state: cart, appendCondition } = await project(store, {
  criteria: new EventCriteria().forTypes('ItemAdded', 'ItemRemoved').forTags(`cart:${cartId}`),
  initialState: { items: [] as Item[] },
  when: {
    ItemAdded: (state, event) => ({ items: [...state.items, event.payload as Item] }),
    ItemRemoved: (state, event) => ({ items: state.items.filter(i => i.id !== (event.payload as { id: string }).id) }),
  },
});

// Make a decision based on projected state
if (cart.items.length >= 10) throw new Error('Cart full');

// Append with position-aware condition from the projection
await store.append([newItemEvent], appendCondition);
```

### Key decisions

- **Standalone function, not on `EventStore`** — keeps the event store focused on storage; projections are a separate concern.
- **`ProjectionResult` includes a pre-built `appendCondition`** — makes the DCB workflow seamless (project → decide → append).
- **`initialState` is a value, not a factory** — live projections create a single state per call, so no shared-reference risk.

---

## Persistent Projections

### Purpose

Eventually consistent read models. A projection processes events incrementally from a checkpoint, applies them to state, and persists the result for later retrieval.

### Architecture

```
Event Store (relational, user provides)  ──reads──►  Projection Store (LMDB, Turtal provides)
     source of truth                                   derived read models
     SQLite / Postgres                                 one LMDB environment per projection
```

- **Event Store is only read from** during catch-up — no cross-DB write consistency issues.
- **Checkpoint and state are stored together** in the same LMDB environment, enabling atomic writes.
- **Explicitly eventually consistent** — Turtal does not pretend projections are strongly consistent.

### Design

Projections are class-based, extending an abstract `Projection<S>` base class. This provides type safety (the state type `S` is carried by the instance, not manually asserted at retrieval), discoverability (each projection is a file you can import), and consistency with the existing `EventStore` abstract class pattern.

#### Typed events

`DomainEvent` is generic with backwards-compatible defaults:

```typescript
type DomainEvent<TType extends string = string, TPayload = unknown> = {
  id: string;
  type: TType;
  payload: TPayload;
  tags: string[];
};
```

Users define typed events that narrow `type` and `payload`:

```typescript
type ItemAdded = DomainEvent<'ItemAdded', { item: Item }>;
type ItemRemoved = DomainEvent<'ItemRemoved', { id: string }>;
```

The `Projection` base class accepts an optional event map generic that provides compile-time type safety in `when` handlers — each handler receives the correctly-typed event for its key, eliminating manual casts.

#### Defining projections

```typescript
// User-defined event map
type CartEvents = {
  ItemAdded: ItemAdded;
  ItemRemoved: ItemRemoved;
};

// Entity-keyed projection: one state document per cart
class CartProjection extends Projection<CartState, CartEvents> {
  name = 'cart';
  criteria = new EventCriteria().forTypes('ItemAdded', 'ItemRemoved');
  initialState = () => ({ items: [] as Item[] });

  key(event: DomainEvent): string {
    return event.tags.find(t => t.startsWith('cart:'))!;
  }

  when = {
    ItemAdded: (state, event) => ({ items: [...state.items, event.payload.item] }),  // event.payload typed as { item: Item }
    ItemRemoved: (state, event) => ({ items: state.items.filter(i => i.id !== event.payload.id) }),  // event.payload typed as { id: string }
  };
}

// Singleton projection: key omitted, all events fold into one state
class OrderStatsProjection extends Projection<OrderStats> {
  name = 'order-stats';
  criteria = new EventCriteria().forTypes('OrderPlaced', 'OrderCancelled');
  initialState = () => ({ total: 0, cancelled: 0 });

  when = {
    OrderPlaced: (state: OrderStats) => ({ ...state, total: state.total + 1 }),
    OrderCancelled: (state: OrderStats) => ({ ...state, cancelled: state.cancelled + 1 }),
  };
}
```

#### Registration and retrieval

```typescript
const projector = Projector.create(eventStore, { dir: './projections' });

const cartProjection = new CartProjection();
const orderStatsProjection = new OrderStatsProjection();

projector.register(cartProjection);
projector.register(orderStatsProjection);

// User controls when catch-up happens
await projector.catchUp();

// Type-safe retrieval: return type inferred from the projection instance, no manual generic
const cart = await projector.get(cartProjection, 'cart:123');  // entity-keyed
const stats = await projector.get(orderStatsProjection);       // singleton
```

### Entity-keyed vs singleton projections

Projections come in two forms based on whether the subclass overrides `key`:

- **Entity-keyed** (`key` overridden): One state document per entity. The `key` method (`(event: DomainEvent) => string`) extracts an entity identifier from each event so Turtal can load, apply the relevant `when` handler to, and save the correct document independently. Without this, either every entity lives in one giant document (loaded entirely to read one entity) or the user must register projections dynamically per entity ID (impractical).
- **Singleton** (`key` not overridden): All events fold into a single state document, stored under a well-known internal key. Used for global aggregates (e.g., total order count, system-wide statistics).

In both cases, `initialState` is a factory function (`() => S`) — entity-keyed projections create multiple independent instances that must not share the same object reference, and using a factory for singletons maintains a consistent API.

### Catch-up flow

1. Fetch events matching the projection's `criteria` after the global checkpoint
2. For each event, call `key(event)` to get the entity identifier (or use the well-known singleton key if `key` is not defined)
3. Load state for that key from the projection's LMDB environment, or call `initialState()` if first encounter
4. Look up the handler in `when[event.type]` and call it with the current state and event to produce new state (unmatched types return current state unchanged)
5. After the batch is fully processed in memory, write all state changes AND advance the checkpoint in a **single atomic LMDB transaction**

### Scheduling

By default, the Projector automatically catches up whenever events are appended to the EventStore. This is achieved via a lightweight callback hook on the `EventStore` abstract class:

```typescript
abstract class EventStore {
  abstract events(criteria?: EventCriteria): Promise<SequencedEvent[]>;
  abstract append(events: DomainEvent[], appendCondition?: AppendCondition): Promise<void>;

  protected afterAppend?: () => void;

  onAppend(callback: () => void): void {
    this.afterAppend = callback;
  }
}
```

Each EventStore implementation calls `this.afterAppend?.()` after a successful append. The Projector registers itself during `create()` and triggers an **async, debounced** catch-up — appends are never blocked, and rapid successive appends are batched into a single catch-up pass.

`catchUp()` also remains available for manual use — on startup to process events missed while the process was down, or in scenarios where the user wants explicit control.

**Same-process only (v1)**: This mechanism notifies the Projector within the same process. If events are appended by a separate service, this Projector won't know. Cross-process notification (e.g., PostgreSQL LISTEN/NOTIFY) can layer on top later without changing the API.

### Failure recovery

**Gap between event append and projection update** is minimal in practice due to on-append scheduling, but projections remain explicitly eventually consistent. On restart, the user should call `catchUp()` to process any events appended while the process was down. The event store is the source of truth.

**Crash during catch-up** is handled by atomic LMDB transactions. All state writes and the checkpoint advance are committed in a single transaction. If the process crashes mid-transaction, LMDB automatically rolls back on next open — no partial state, no double-applied events:

```
Begin LMDB transaction
  → write cart:123 new state
  → write cart:456 new state
  → write __checkpoint__ = 100
Commit (all-or-nothing)
```

Without this atomicity, a crash after writing some entity states but before advancing the checkpoint would cause those events to be reprocessed against already-updated state on the next `catchUp()`, producing incorrect results (e.g., a counter incremented twice).

**Corruption recovery** is simple: delete the projection's LMDB environment directory and call `catchUp()`. The projection rebuilds from scratch against the event store. Projections are disposable and rebuildable — this is the definitive recovery path.

### Key decisions

- **LMDB as the projection store** — embedded, zero-config, memory-mapped KV store via `lmdb-js`. Chosen because projections are pure KV (load by key, save by key, no cross-document queries). Using a relational DB (SQLite) for KV-only operations would be unnecessary overhead — SQL parsing and query planning for simple `get`/`put`. LMDB is purpose-built for this.
- **One LMDB environment per projection** — each projection gets its own directory under the configured `dir` path (e.g., `./projections/cart/`, `./projections/order/`). This provides independent lifecycle (rebuild by deleting a directory), no cross-projection interference, and natural size visibility.
- **Atomic catch-up transactions** — all state changes and checkpoint advancement within a single `catchUp()` batch are committed in one LMDB transaction. This guarantees crash consistency without requiring idempotent apply functions.
- **No queries across projections** — if you need a different view of the data, create another projection against the event store. The event store is the queryable source; projections are derived, purpose-built read models.
- **`when` event-map over `apply`** — projections define a `when` property mapping event types to handlers, rather than a single `apply` function with a switch statement. Less boilerplate, self-documenting (handler keys mirror event types), and Turtal handles unmatched types internally by returning current state. All handlers are pure folds — Turtal manages all persistence.
- **Typed events via generic `DomainEvent<TType, TPayload>`** — `DomainEvent` is generic with backwards-compatible defaults (`string`, `unknown`). Users define typed events (e.g., `type ItemAdded = DomainEvent<'ItemAdded', { item: Item }>`) and provide an event map generic on `Projection<S, E>`. This gives compile-time type safety in `when` handlers — each handler receives the correctly-typed payload for its event, eliminating manual casts. Handlers receive `DomainEvent` (not `SequencedEvent`) because position is an infrastructure concern that handlers don't need.
- **On-append scheduling by default** — the Projector registers an `onAppend` callback on the EventStore and triggers async, debounced catch-up after each successful append. This provides near-real-time projection updates without blocking appends. `catchUp()` remains available for manual use (e.g., on startup). Same-process only for v1; cross-process notification (e.g., PostgreSQL LISTEN/NOTIFY) can be added later.
- **Checkpoint is per projection name** (global across all entity keys for that projection), not per entity key.

---

## Open Questions

- **Tag-prefix shorthand for `key`** — e.g., `key: 'cart'` as sugar for `(event) => event.tags.find(t => t.startsWith('cart:'))!`. Defer until the pattern proves common enough.
- **Snapshot support for live projections** — caching intermediate state to avoid re-folding the entire event stream on every read. An optimization, not a requirement for v1.
