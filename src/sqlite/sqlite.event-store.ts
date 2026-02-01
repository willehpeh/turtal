import type { Database } from 'better-sqlite3';
import { EventStore } from '../core/event-store';
import { AppendCondition } from '../core/append-condition';
import { EventCriteria } from '../core/event-criteria';
import { SequencedEvent } from '../core/sequenced-event';
import { DomainEvent } from '../core/domain-event';
import { SqliteEvent } from './sqlite-event';
import { SqliteQueryBuilder } from './sqlite-query-builder';
import { AppendConditionError } from '../core/append-condition.error';
import { SQLITE_SCHEMA_DEF } from './SQLITE_SCHEMA_DEF';

export class SqliteEventStore extends EventStore {

  constructor(private readonly db: Database) {
    super();
    this.ensureSchema();
  }

  append(events: DomainEvent[], appendCondition: AppendCondition = AppendCondition.empty()): Promise<void> {
    const transaction = this.buildAppendTransaction(appendCondition, events);

    try {
      transaction();
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  }

  events(criteria = new EventCriteria()): Promise<SequencedEvent[]> {
    return Promise.resolve(
      this.eventDbRows(criteria).map((row) => ({
        id: row.id,
        position: row.position,
        type: row.type,
        payload: JSON.parse(row.payload),
        tags: row.tags ? row.tags.split(',') : [],
      }))
    );
  }

  private buildAppendTransaction(appendCondition: AppendCondition, events: DomainEvent[]) {
    return this.db.transaction(() => {
      if (this.appendShouldFail(appendCondition)) {
        throw new AppendConditionError(appendCondition, events);
      }
      events.forEach((event) => this.insertEvent(event));
    });
  }

  private eventDbRows(criteria: EventCriteria): SqliteEvent[] {
    //language=SQLite
    return this.db
      .prepare(`
          SELECT events.id, events.position, events.type, events.payload, GROUP_CONCAT(t.tag) as tags
          FROM events
                   LEFT JOIN event_tags t ON events.position = t.event_position
              ${ criteria.buildQuery(new SqliteQueryBuilder()) }
          GROUP BY events.position
          ORDER BY events.position
      `)
      .all() as SqliteEvent[];
  }

  private appendShouldFail(appendCondition: AppendCondition): boolean {
    if (appendCondition.isEmpty()) {
      return false;
    }
    const events = this.db.prepare(`
        SELECT 1
        FROM events ${ (appendCondition.buildQuery(new SqliteQueryBuilder())) }
        LIMIT 1
    `).get();

    return !!events;
  }

  private ensureSchema(): void {
    this.db.exec(SQLITE_SCHEMA_DEF);
  }

  private insertEvent(event: DomainEvent) {
    const { lastInsertRowid } = this.db
      .prepare<[string, string, string]>(
        'INSERT INTO events (id, type, payload) VALUES (?, ?, ?)'
      )
      .run(event.id, event.type, JSON.stringify(event.payload));
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
