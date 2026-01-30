import type { Database, Transaction } from 'better-sqlite3';
import { EventStore } from './event-store';
import { AppendCondition } from './append-condition';
import { EventQuery } from './event-query';
import { SequencedEvent } from './sequenced-event';
import { DomainEvent } from './domain-event';
import { SqliteEvent } from './sqlite-event';
import { SqlDialect } from './sql-dialect';
import { SqliteDialect } from './sqlite-dialect';

export class SqliteEventStore extends EventStore {
  private readonly dialect: SqlDialect = new SqliteDialect();

  constructor(private readonly db: Database) {
    super();
    this.ensureSchema();
  }

  append(events: DomainEvent[], appendCondition: AppendCondition = AppendCondition.empty()): Promise<void> {
    if (this.appendConditionShouldFail(appendCondition)) {
      return Promise.reject();
    }
    const insertAllTransaction = this.appendTransaction();
    insertAllTransaction(events);

    return Promise.resolve();
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
    const whereClause = query.whereClause(this.dialect, 'e');
    //language=SQLite
    return this.db
      .prepare(this.eventSqlQuery(whereClause))
      .all() as SqliteEvent[];
  }

  private eventSqlQuery(whereClause: string) {
    return `
          SELECT e.position, e.type, e.payload, GROUP_CONCAT(t.tag) as tags
          FROM events e
                   LEFT JOIN event_tags t ON e.position = t.event_position
          ${ whereClause }
          GROUP BY e.position
          ORDER BY e.position
      `;
  }

  private appendConditionShouldFail(appendCondition: AppendCondition): boolean {
    if (appendCondition.isEmpty()) {
      return false;
    }
    const whereClause = appendCondition.whereClause(this.dialect, 'events');
    const events = this.db.prepare(`
        SELECT 1
        FROM events ${whereClause}
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

  private appendTransaction(): Transaction<(events: DomainEvent[]) => void> {
    return this.db.transaction((events: DomainEvent[]) => {
      events.forEach((event) => this.insertEvent(event))
    });
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
