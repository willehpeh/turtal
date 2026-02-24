import type { Database } from 'better-sqlite3';
import { EventStore } from '../core/event-store/event-store';
import { AppendCondition } from '../core/event-store/append-condition';
import { AppendOptions } from '../core/event-store/append-options';
import { EventCriteria } from '../core/event-store/event-criteria';
import { SequencedEvent } from '../core/event-store/sequenced-event';
import { DomainEvent } from '../core/event-store/domain-event';
import { SqliteEvent } from './sqlite-event';
import { SqliteQueryBuilder } from './sqlite-query-builder';
import { AppendConditionError } from '../core/event-store/append-condition.error';
import { SQLITE_SCHEMA_DEF } from './SQLITE_SCHEMA_DEF';

export class SqliteEventStore extends EventStore {
  private readonly queryBuilder: SqliteQueryBuilder = new SqliteQueryBuilder();

  private constructor(private readonly db: Database) {
    super();
  }

  static createSync(db: Database): SqliteEventStore {
    const store = new SqliteEventStore(db);
    store.ensureSchema();
    return store;
  }

  append(events: DomainEvent[], options: AppendOptions = {}): Promise<void> {
    const condition = options.condition ?? AppendCondition.empty();
    const metadata = options.metadata ?? {};
    try {
      this.buildAppendTransaction(condition, events, metadata)();
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  }

  events(criteria = EventCriteria.create()): Promise<SequencedEvent[]> {
    return Promise.resolve(
      this.eventDbRows(criteria).map((row) => ({
        ...row,
        payload: JSON.parse(row.payload),
        tags: (JSON.parse(row.tags) as (string | null)[]).filter((t): t is string => t !== null),
        metadata: JSON.parse(row.metadata),
        timestamp: new Date(row.timestamp),
      }))
    );
  }

  private buildAppendTransaction(appendCondition: AppendCondition, events: DomainEvent[], metadata: Record<string, string>) {
    return this.db.transaction(() => {
      if (this.appendShouldFail(appendCondition)) {
        throw new AppendConditionError(appendCondition, events);
      }
      events.forEach((event) => this.insertEvent(event, metadata));
    });
  }

  private eventDbRows(criteria: EventCriteria): SqliteEvent[] {
    const { text, values } = criteria.appliedTo(this.queryBuilder).build();
    //language=SQLite
    return this.db
      .prepare(`
          SELECT events.id, events.position, events.type, events.payload, events.metadata, events.timestamp, JSON_GROUP_ARRAY(t.tag) as tags
          FROM events
                   LEFT JOIN event_tags t ON events.position = t.event_position
              ${text}
          GROUP BY events.position
          ORDER BY events.position
      `)
      .all(...values) as SqliteEvent[];
  }

  private appendShouldFail(appendCondition: AppendCondition): boolean {
    if (appendCondition.isEmpty()) {
      return false;
    }
    const { text, values } = this.queryBuilder.forCondition(appendCondition);
    const events = this.db.prepare(`
        SELECT 1
        FROM events ${text}
        LIMIT 1
    `).get(...values);

    return !!events;
  }

  private ensureSchema(): void {
    this.db.exec(SQLITE_SCHEMA_DEF);
  }

  private insertEvent(event: DomainEvent, metadata: Record<string, string>) {
    const { lastInsertRowid } = this.db
      .prepare<[string, string, string, string]>(
        'INSERT INTO events (id, type, payload, metadata) VALUES (?, ?, ?, ?)'
      )
      .run(event.id, event.type, JSON.stringify(event.payload), JSON.stringify(metadata));
    this.insertTags(event.tags, lastInsertRowid as number);
  }

  private insertTags(tags: string[], lastInsertRowid: number): void {
    tags.forEach(tag => {
      this.db
        .prepare<[number, string]>(
          'INSERT INTO event_tags (event_position, tag) VALUES (?, ?)'
        ).run(lastInsertRowid, tag);
    });
  }
}
