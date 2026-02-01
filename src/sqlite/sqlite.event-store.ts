import type { Database } from 'better-sqlite3';
import { EventStore } from '../core/event-store';
import { AppendCondition } from '../core/append-condition';
import { EventQuery } from '../core/event-query';
import { SequencedEvent } from '../core/sequenced-event';
import { DomainEvent } from '../core/domain-event';
import { SqliteEvent } from './sqlite-event';
import { SqliteQueryGenerator } from './sqlite-query-generator';
import { AppendConditionError } from '../core/append-condition.error';

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

  events(query: EventQuery = new EventQuery()): Promise<SequencedEvent[]> {
    return Promise.resolve(
      this.eventDbRows(query).map((row) => ({
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
      if (this.appendConditionShouldFail(appendCondition)) {
        throw new AppendConditionError(appendCondition, events);
      }
      events.forEach((event) => this.insertEvent(event));
    });
  }

  private eventDbRows(query: EventQuery): SqliteEvent[] {
    const whereClause = query.generateDbQuery(new SqliteQueryGenerator());
    //language=SQLite
    return this.db
      .prepare(`
          SELECT events.id, events.position, events.type, events.payload, GROUP_CONCAT(t.tag) as tags
          FROM events
                   LEFT JOIN event_tags t ON events.position = t.event_position
              ${ whereClause }
          GROUP BY events.position
          ORDER BY events.position
      `)
      .all() as SqliteEvent[];
  }
  private appendConditionShouldFail(appendCondition: AppendCondition): boolean {
    if (appendCondition.isEmpty()) {
      return false;
    }
    const whereClause = appendCondition.generateDbQuery(new SqliteQueryGenerator());
    const events = this.db.prepare(`
        SELECT 1
        FROM events
        ${whereClause}
        LIMIT 1
    `).get();

    return !!events;
  }

  private ensureSchema(): void {
    // language=SQLite
    this.db.exec(`
        CREATE TABLE IF NOT EXISTS events
        (
            id       TEXT NOT NULL UNIQUE COLLATE NOCASE,
            position INTEGER PRIMARY KEY AUTOINCREMENT,
            type     TEXT NOT NULL,
            payload  JSON NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_events_type ON events (type);

        CREATE TABLE IF NOT EXISTS event_tags
        (
            event_position INTEGER NOT NULL,
            tag            TEXT    NOT NULL,
            PRIMARY KEY (event_position, tag),
            FOREIGN KEY (event_position) REFERENCES events (position)
        );
        CREATE INDEX IF NOT EXISTS idx_event_tags_tag ON event_tags (tag);
    `);
  }

  private insertEvent(event: DomainEvent) {
    const transaction = this.db.prepare<[string, string, string]>(
      'INSERT INTO events (id, type, payload) VALUES (?, ?, ?)'
    );
    const { lastInsertRowid } = transaction.run(event.id, event.type, JSON.stringify(event.payload));
    this.insertTags(event.tags, lastInsertRowid as number);
  }

  private insertTags(tags: string[], lastInsertRowid: number): void {
    tags.forEach(tag => {
      const transaction = this.db.prepare<[number, string]>(
        'INSERT INTO event_tags (event_position, tag) VALUES (?, ?)'
      );
      transaction.run(lastInsertRowid, tag);
    });
  }
}
