# Projection Registration and Updating Design

This document outlines 4 possible approaches for implementing projection registration and updating with eventual consistency in the Turtal event store.

## Background

Projections are denormalized read models built by processing events. They require:

1. **Registration** - Declaring interest in specific events (by type, tags, or criteria)
2. **Updating** - Processing events to build/update the read model
3. **Position Tracking** - Knowing which events have been processed
4. **Rebuild Capability** - Replaying events from the beginning
5. **Eventual Consistency** - Processing new events as they are appended

The existing `EventCriteria` and `SequencedEvent.position` abstractions provide a foundation for all approaches.

---

## Approach 1: Polling-Based Projections

### Overview

Projections periodically poll the event store for new events since their last processed position. This is a pull-based model where projections are responsible for fetching their own updates.

### Key Components

```typescript
interface Projection<TState> {
  readonly name: string;
  readonly criteria: EventCriteria;
  readonly initialState: TState;
  apply(state: TState, event: SequencedEvent): TState;
}

interface ProjectionState<TState> {
  readonly name: string;
  readonly state: TState;
  readonly lastPosition: number;
}

class PollingProjectionRunner<TState> {
  constructor(
    private readonly eventStore: EventStore,
    private readonly projection: Projection<TState>,
    private readonly stateStore: ProjectionStateStore,
    private readonly pollingIntervalMs: number
  ) {}

  async start(): Promise<void>;
  async stop(): Promise<void>;
  async rebuild(): Promise<void>;
}
```

### Flow

1. Projection runner loads last processed position from state store
2. Polls event store: `events(criteria.afterPosition(lastPosition))`
3. Applies each event to projection state via `apply()`
4. Persists updated state and new position
5. Waits for polling interval, repeats

### Advantages

- **Simple implementation** - No complex subscription infrastructure
- **Resilient** - Survives restarts naturally (position persisted)
- **Backpressure built-in** - Projection controls its own pace
- **Easy debugging** - Clear, linear flow

### Disadvantages

- **Latency** - Updates delayed by polling interval
- **Inefficient** - Queries even when no new events exist
- **Resource usage** - CPU/DB cycles spent on empty polls

### Best For

- Development and testing environments
- Low-throughput systems
- Projections where latency tolerance is high (reports, analytics)

---

## Approach 2: Push-Based Observer Pattern

### Overview

The event store notifies registered projections immediately when events are appended. This is a push-based model using the observer pattern (similar to Node.js EventEmitter).

### Key Components

```typescript
interface ProjectionHandler {
  readonly name: string;
  readonly criteria: EventCriteria;
  handle(event: SequencedEvent): Promise<void>;
}

interface ProjectionRegistry {
  register(handler: ProjectionHandler): void;
  unregister(name: string): void;
}

// Extended EventStore
abstract class EventStore {
  abstract append(events: DomainEvent[], condition: AppendCondition): Promise<void>;
  abstract events(criteria: EventCriteria): Promise<SequencedEvent[]>;

  // New: Observer registration
  abstract onEventsAppended(handler: (events: SequencedEvent[]) => void): () => void;
}

class ObservableEventStore extends EventStore {
  private readonly handlers: Set<(events: SequencedEvent[]) => void>;

  async append(events: DomainEvent[], condition: AppendCondition): Promise<void> {
    const sequenced = await this.doAppend(events, condition);
    this.handlers.forEach(h => h(sequenced));
  }
}
```

### Flow

1. Projection registers with event store via `onEventsAppended()`
2. Event store appends events
3. Event store synchronously notifies all registered handlers
4. Each handler filters events by its criteria
5. Matching events are processed immediately

### Advantages

- **Real-time updates** - Minimal latency between append and projection update
- **Efficient** - No wasted queries; only processes when events exist
- **Simple mental model** - Familiar observer/pub-sub pattern

### Disadvantages

- **In-process only** - Doesn't work across processes or services
- **No persistence** - Handlers lost on restart; requires replay
- **Blocking risk** - Slow handlers delay append acknowledgment
- **Memory pressure** - All handlers kept in memory

### Best For

- Single-process applications
- In-memory projections (caches, real-time UI state)
- Scenarios where projection latency is critical

---

## Approach 3: Subscription-Based with Checkpoint Store

### Overview

Projections subscribe to named event streams. A dedicated checkpoint store tracks progress separately from projection state. Subscriptions can be paused, resumed, and distributed across processes.

### Key Components

```typescript
interface Subscription {
  readonly id: string;
  readonly criteria: EventCriteria;
  readonly checkpointId: string;
}

interface Checkpoint {
  readonly id: string;
  readonly position: number;
  readonly updatedAt: Date;
}

interface CheckpointStore {
  get(id: string): Promise<Checkpoint | null>;
  save(checkpoint: Checkpoint): Promise<void>;
}

interface SubscriptionHandler<TState> {
  readonly subscriptionId: string;
  handle(event: SequencedEvent, state: TState): Promise<TState>;
}

class SubscriptionManager {
  constructor(
    private readonly eventStore: EventStore,
    private readonly checkpointStore: CheckpointStore
  ) {}

  createSubscription(id: string, criteria: EventCriteria): Subscription;

  async process<TState>(
    subscription: Subscription,
    handler: SubscriptionHandler<TState>,
    initialState: TState,
    batchSize?: number
  ): Promise<TState>;

  async catchUp(subscription: Subscription, handler: SubscriptionHandler): Promise<void>;
}
```

### Database Schema Extension

```sql
CREATE TABLE IF NOT EXISTS projection_checkpoints (
  id TEXT PRIMARY KEY,
  position INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);
```

### Flow

1. Create subscription with criteria and checkpoint ID
2. Load checkpoint to get last processed position
3. Query events after checkpoint position (with optional batch size)
4. Process each event through handler
5. Periodically save checkpoint (after each event or batch)
6. Support catch-up mode for rebuilding

### Advantages

- **Distributed** - Checkpoint store enables multi-process coordination
- **Resumable** - Survives restarts; continues from checkpoint
- **Batch processing** - Can process events in configurable batches
- **Separation of concerns** - Checkpoint tracking decoupled from projection logic

### Disadvantages

- **More complex** - Additional infrastructure (checkpoint store)
- **Checkpoint overhead** - Extra writes for position tracking
- **Ordering challenges** - Must ensure checkpoint saved after state

### Best For

- Production systems requiring reliability
- Distributed deployments
- Projections that need rebuild capability
- Systems with multiple projection consumers

---

## Approach 4: Projection Manager with Lifecycle Control

### Overview

A central projection manager orchestrates all projections, handling registration, scheduling, error recovery, dependencies, and lifecycle events. This is the most comprehensive approach, suitable for complex systems.

### Key Components

```typescript
interface ProjectionDefinition<TState = unknown> {
  readonly name: string;
  readonly version: number;
  readonly criteria: EventCriteria;
  readonly initialState: TState;
  readonly retryPolicy?: RetryPolicy;
  readonly dependencies?: string[]; // Other projection names

  apply(state: TState, event: SequencedEvent): TState | Promise<TState>;
  serialize(state: TState): unknown;
  deserialize(data: unknown): TState;
}

interface ProjectionStatus {
  readonly name: string;
  readonly version: number;
  readonly state: 'running' | 'paused' | 'error' | 'rebuilding';
  readonly position: number;
  readonly lag: number; // Events behind head
  readonly lastError?: Error;
  readonly lastUpdated: Date;
}

interface RetryPolicy {
  readonly maxRetries: number;
  readonly backoffMs: number;
  readonly backoffMultiplier: number;
}

class ProjectionManager {
  constructor(
    private readonly eventStore: EventStore,
    private readonly stateStore: ProjectionStateStore,
    private readonly options: ProjectionManagerOptions
  ) {}

  // Registration
  register<TState>(definition: ProjectionDefinition<TState>): void;
  unregister(name: string): void;

  // Lifecycle
  async start(name?: string): Promise<void>;  // Start one or all
  async stop(name?: string): Promise<void>;
  async pause(name: string): Promise<void>;
  async resume(name: string): Promise<void>;

  // Rebuild
  async rebuild(name: string): Promise<void>;
  async rebuildAll(): Promise<void>;

  // Monitoring
  status(name: string): ProjectionStatus;
  allStatuses(): ProjectionStatus[];

  // Events
  onError(handler: (name: string, error: Error, event: SequencedEvent) => void): void;
  onProgress(handler: (name: string, position: number) => void): void;
}

interface ProjectionManagerOptions {
  readonly pollIntervalMs: number;
  readonly batchSize: number;
  readonly defaultRetryPolicy: RetryPolicy;
  readonly concurrency: number; // Max projections processing simultaneously
}
```

### State Store Schema Extension

```sql
CREATE TABLE IF NOT EXISTS projections (
  name TEXT PRIMARY KEY,
  version INTEGER NOT NULL,
  state TEXT NOT NULL,           -- 'running' | 'paused' | 'error' | 'rebuilding'
  position INTEGER NOT NULL,
  projection_state TEXT,         -- Serialized projection state (JSON)
  last_error TEXT,
  updated_at TEXT NOT NULL
);
```

### Flow

1. **Registration**: Define projections with criteria, apply function, and policies
2. **Startup**: Manager loads all projection states, determines which need catch-up
3. **Processing Loop**:
   - Query events for all active projections (batched)
   - Route events to appropriate projections based on criteria
   - Apply events, update state, handle errors with retry policy
   - Persist state periodically
4. **Error Handling**: Retry with backoff, pause on max retries, emit error events
5. **Monitoring**: Expose status, lag metrics, progress events

### Dependency Resolution

```typescript
// Example: UserProfileProjection depends on UserEventsProjection
const manager = new ProjectionManager(eventStore, stateStore, options);

manager.register({
  name: 'UserEvents',
  version: 1,
  criteria: EventCriteria.forTypes('UserCreated', 'UserUpdated'),
  // ...
});

manager.register({
  name: 'UserProfile',
  version: 1,
  criteria: EventCriteria.forTypes('UserCreated', 'UserUpdated', 'OrderPlaced'),
  dependencies: ['UserEvents'], // Waits for UserEvents to process first
  // ...
});
```

### Advantages

- **Comprehensive** - Handles all projection lifecycle concerns
- **Observable** - Built-in monitoring and progress tracking
- **Resilient** - Automatic retry, error recovery, pause/resume
- **Versioned** - Schema migrations via version field
- **Coordinated** - Dependency management between projections

### Disadvantages

- **Complex** - Significant implementation effort
- **Overhead** - More infrastructure, more state to manage
- **Single point of coordination** - Manager becomes critical component
- **Learning curve** - More concepts for library users

### Simplified API Design

The complexity of Approach 4 can be hidden behind a developer-friendly API using **progressive disclosure** - simple defaults for common cases, with advanced features available when needed.

#### Minimal Configuration (Common Case)

```typescript
// Helper function with sensible defaults
function defineProjection<TState>(config: {
  name: string;
  criteria: EventCriteria;
  initialState: TState;
  apply: (state: TState, event: SequencedEvent) => TState;
}): ProjectionDefinition<TState>;

// Usage: Only 4 required fields
const orderTotals = defineProjection({
  name: 'OrderTotals',
  criteria: EventCriteria.forTypes('OrderPlaced', 'OrderCancelled'),
  initialState: {} as Record<string, number>,

  apply(state, event) {
    if (event.type === 'OrderPlaced') {
      const userId = event.payload.userId;
      state[userId] = (state[userId] ?? 0) + event.payload.total;
    }
    return state;
  }
});

// One-liner setup
const manager = createProjectionManager(eventStore);
manager.register(orderTotals);
manager.start();
```

#### Advanced Options (Opt-in)

```typescript
const orderTotals = defineProjection({
  name: 'OrderTotals',
  criteria: EventCriteria.forTypes('OrderPlaced', 'OrderCancelled'),
  initialState: {} as Record<string, number>,
  apply(state, event) { /* ... */ return state; },

  // All optional - only specify when needed
  version: 2,                              // Triggers rebuild on change
  retry: { maxRetries: 5 },                // Custom retry policy
  dependencies: ['UserAccounts'],          // Wait for other projections
  onError: (err, event) => log(err),       // Custom error handling
});
```

#### What Gets Hidden by Defaults

| Concern | Default Behavior |
|---------|------------------|
| Serialization | JSON.stringify/parse automatically |
| Checkpoint storage | Same SQLite database as events |
| Retry policy | 3 retries with exponential backoff |
| Batch size | 100 events per batch |
| Poll interval | 100ms |
| Version | 1 (no auto-rebuild) |

#### API Comparison

```typescript
// VERBOSE: Full interface as documented above
manager.register({
  name: 'OrderTotals',
  version: 1,
  criteria: EventCriteria.forTypes('OrderPlaced'),
  initialState: {},
  retryPolicy: { maxRetries: 3, backoffMs: 1000, backoffMultiplier: 2 },
  apply(state, event) { return state; },
  serialize(state) { return JSON.stringify(state); },
  deserialize(data) { return JSON.parse(data as string); },
});

// SIMPLE: Developer-friendly equivalent
manager.register(defineProjection({
  name: 'OrderTotals',
  criteria: EventCriteria.forTypes('OrderPlaced'),
  initialState: {},
  apply(state, event) { return state; },
}));
```

This design ensures that **90% of use cases require only 4 fields**, while the full power of Approach 4 remains accessible for complex scenarios.

### Best For

- Large-scale production systems
- Systems with many interdependent projections
- Scenarios requiring operational visibility
- Teams needing built-in error handling and retry logic

---

## Comparison Matrix

| Aspect | Polling | Push/Observer | Subscription | Manager |
|--------|---------|---------------|--------------|---------|
| **Complexity** | Low | Low | Medium | High |
| **Latency** | High | Very Low | Low-Medium | Low-Medium |
| **Reliability** | Medium | Low | High | Very High |
| **Multi-process** | Yes | No | Yes | Yes |
| **Error Handling** | Manual | Manual | Manual | Built-in |
| **Monitoring** | None | None | Basic | Comprehensive |
| **Rebuild Support** | Manual | Manual | Built-in | Built-in |
| **Dependencies** | No | No | No | Yes |

---

## Recommendation

For Turtal, a phased approach is recommended:

1. **Phase 1**: Implement **Approach 3 (Subscription-Based)** as the foundation
   - Provides the right balance of simplicity and capability
   - Checkpoint store integrates naturally with existing SQLite infrastructure
   - Enables reliable, resumable projections

2. **Phase 2**: Add **Approach 2 (Push-Based)** as an optimization layer
   - Optional real-time notifications for low-latency needs
   - Can trigger subscription catch-up immediately on append

3. **Phase 3**: Evolve toward **Approach 4 (Manager)** as needs grow
   - Build on subscription infrastructure
   - Add lifecycle management, monitoring, error policies incrementally

This progression allows the library to start simple while maintaining a path to sophisticated projection management.

---

## Open Question: Projection State Persistence

A key architectural decision is whether Turtal should provide built-in persistence for projection state, or leave this as a consumer concern.

### Option A: Library-Provided Persistence

The library manages projection state storage internally, using the same SQLite database as events.

```typescript
// Library handles everything
const manager = createProjectionManager(eventStore);
manager.register(orderTotals);
manager.start();

// State automatically persisted and recovered on restart
const state = manager.getState('OrderTotals');
```

#### Advantages

- **Zero configuration** - Works out of the box
- **Consistency** - State and checkpoints stored atomically
- **Simpler mental model** - One system to understand
- **Rebuild safety** - Library coordinates state clearing and replay

#### Disadvantages

- **Opinionated** - Forces JSON serialization, SQLite storage
- **Schema coupling** - Library owns more of the database
- **Limited flexibility** - Can't easily use Redis, Postgres, etc.
- **Scalability ceiling** - SQLite may not suit all workloads

### Option B: Consumer-Provided Persistence

The library only manages checkpoints (position tracking). Consumers bring their own state storage.

```typescript
// Consumer provides state store
const stateStore = new RedisProjectionStateStore(redis);
const manager = createProjectionManager(eventStore, { stateStore });

// Or: fully manual
const checkpoint = await checkpointStore.get('OrderTotals');
const events = await eventStore.events(criteria.afterPosition(checkpoint));
const newState = events.reduce(apply, loadStateFromMyDatabase());
await saveStateToMyDatabase(newState);
await checkpointStore.save({ id: 'OrderTotals', position: lastEvent.position });
```

#### Advantages

- **Flexible** - Use any storage backend (Redis, Postgres, MongoDB, memory)
- **Optimal storage** - Choose the right tool for each projection's access patterns
- **Separation of concerns** - Library focuses on event delivery
- **No schema intrusion** - Library only needs checkpoint table

#### Disadvantages

- **More work for consumers** - Must implement state persistence
- **Consistency risk** - Consumer must coordinate state + checkpoint updates
- **Rebuild complexity** - Consumer must handle state clearing

### Option C: Hybrid Approach (Recommended)

Provide optional built-in persistence with an escape hatch for custom implementations.

```typescript
// Simple case: use built-in SQLite storage (default)
const manager = createProjectionManager(eventStore);

// Advanced: bring your own state store
const manager = createProjectionManager(eventStore, {
  stateStore: new RedisProjectionStateStore(redis)
});

// Expert: fully custom with just checkpoint tracking
const manager = createProjectionManager(eventStore, {
  stateStore: null  // Disable built-in state persistence
});
```

#### Interface for Custom State Stores

```typescript
interface ProjectionStateStore {
  get<TState>(name: string): Promise<{ state: TState; position: number } | null>;
  save<TState>(name: string, state: TState, position: number): Promise<void>;
  clear(name: string): Promise<void>;
}

// Built-in implementation
class SqliteProjectionStateStore implements ProjectionStateStore {
  constructor(private readonly db: Database) {}
  // Uses same DB as event store
}
```

#### Why Hybrid Works

| User Type | What They Use |
|-----------|---------------|
| **Getting started** | Built-in SQLite, zero config |
| **Production SQLite** | Built-in SQLite, just works |
| **Custom storage needs** | Implement `ProjectionStateStore` interface |
| **Existing infrastructure** | Adapt their DB to the interface |
| **Full control** | Disable state persistence, manage manually |

### Recommendation

**Option C (Hybrid)** provides the best balance:

1. **Built-in SQLite state store as default** - Enables the simple API without configuration
2. **`ProjectionStateStore` interface** - Clear contract for custom implementations
3. **Checkpoint-only mode** - For users who want full control

This aligns with the library's existing pattern: `SqliteEventStore` is the concrete implementation, but `EventStore` is the abstract interface that could have other implementations.
