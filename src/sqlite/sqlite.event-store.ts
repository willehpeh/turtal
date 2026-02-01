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

  private buildAppendTransaction(appendCondition: AppendCondition, events: DomainEvent[]) {
    return this.db.transaction(() => {
      if (this.appendConditionShouldFail(appendCondition)) {
        throw new AppendConditionError(appendCondition, events);
      }
      events.forEach((event) => this.insertEvent(event));
    });
  }

  events(query: EventQuery = new EventQuery()): Promise<SequencedEvent[]> {
    return Promise.resolve(
      this.eventDbRows(query).map((row) => ({
        position: row.position,
        type: row.type,
        payload: JSON.parse(row.payload),
        tags: row.tags ? row.tags.split(',') : [],
      }))
    );
  }

  private eventDbRows(query: EventQuery): SqliteEvent[] {
    const generator = new SqliteQueryGenerator('e');
    const whereClause = query.generateDbQuery(generator);
    //language=SQLite
    return this.db
      .prepare(this.eventSqlQuery(whereClause))
      .all() as SqliteEvent[];
  }

  private eventSqlQuery(whereClause: string) {
    const wherePrefix = whereClause ? `WHERE ${whereClause}` : '';
    //language=SQLite
    return `
        SELECT e.position, e.type, e.payload, GROUP_CONCAT(t.tag) as tags
        FROM events e
                 LEFT JOIN event_tags t ON e.position = t.event_position
            ${ wherePrefix }
        GROUP BY e.position
        ORDER BY e.position
    `;
  }

  private appendConditionShouldFail(appendCondition: AppendCondition): boolean {
    if (appendCondition.isEmpty()) {
      return false;
    }
    const whereClause = appendCondition.generateDbQuery(new SqliteQueryGenerator('events'));
    const events = this.db.prepare(`
        SELECT 1
        FROM events WHERE ${whereClause}
        LIMIT 1
    `).get();

    return !!events;
  }

  private ensureSchema(): void {
    // language=SQLite
    this.db.exec(`
        CREATE TABLE IF NOT EXISTS events
        (
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
    const transaction = this.db.prepare<[string, string]>(
      'INSERT INTO events (type, payload) VALUES (?, ?)'
    );
    const { lastInsertRowid } = transaction.run(event.type, JSON.stringify(event.payload));
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
