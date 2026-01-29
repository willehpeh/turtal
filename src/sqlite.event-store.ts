import type { Database, Transaction } from 'better-sqlite3';
import { EventStore } from './event-store';
import { AppendCondition } from './append-condition';
import { EventQuery } from './event-query';
import { SequencedEvent } from './sequenced-event';
import { DomainEvent } from './domain-event';
import { SqliteEvent } from './sqlite-event';

export class SqliteEventStore extends EventStore {
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

  events(_query: EventQuery = new EventQuery()): Promise<SequencedEvent[]> {
    return Promise.resolve(
      this.eventDbRows().map((row) => ({
        position: row.position,
        type: row.type,
        payload: JSON.parse(row.payload),
        tags: row.tags ? row.tags.split(',') : [],
      }))
    );
  }

  private eventDbRows(): SqliteEvent[] {
    return this.db
      .prepare(`
          SELECT e.position, e.type, e.payload, GROUP_CONCAT(t.tag) as tags
          FROM events e
                   LEFT JOIN event_tags t ON e.position = t.event_position
          GROUP BY e.position
          ORDER BY e.position
      `)
      .all() as SqliteEvent[];
  }

  private appendConditionShouldFail(appendCondition: AppendCondition) {
    if (appendCondition.isEmpty()) {
      return false;
    }
    return this.db.prepare(`
        SELECT 1
        FROM events ${ this.buildWhereClause(appendCondition) }
        LIMIT 1
    `).get();
  }

  private buildWhereClause(condition: AppendCondition): string {
    const clauses: string[] = [];

    if (condition.types().length > 0) {
      clauses.push(this.typesClause(condition.types()));
    }

    if (condition.tags().length > 0) {
      clauses.push(this.tagsClause(condition.tags()));
    }

    if (clauses.length === 0) {
      return '';
    }

    return `WHERE ${ clauses.join(' AND ') }`;
  }

  private typesClause(types: string[]): string {
    const quoted = types.map(type => `'${ type }'`).join(',');
    return `type IN (${ quoted })`;
  }

  private tagsClause(tags: string[]): string {
    return tags
      .map(tag => `EXISTS (SELECT 1 FROM event_tags WHERE event_position = events.position AND tag = '${ tag }')`)
      .join(' AND ');
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
