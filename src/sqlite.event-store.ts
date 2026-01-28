import type { Database } from 'better-sqlite3';
import { EventStore } from './event-store';
import { AppendCondition } from './append-condition';
import { EventQuery } from './event-query';
import { SequencedEvent } from './sequenced-event';
import { EMPTY_EVENT_QUERY } from './empty.event-query';
import { DomainEvent } from './domain-event';

export class SqliteEventStore extends EventStore {
  constructor(private readonly db: Database) {
    super();
    this.ensureSchema();
  }

  private ensureSchema(): void {
    // language=SQLite
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        position INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        payload JSON NOT NULL,
        tags TEXT NOT NULL
      )
    `);
  }

  append(events: DomainEvent[], _appendCondition: AppendCondition = { failIfMatch: EMPTY_EVENT_QUERY }): Promise<void> {
    const insert = this.db.prepare('INSERT INTO events (type, payload, tags) VALUES (?, ?, ?)');

    const insertAll = this.db.transaction((events: DomainEvent[]) => {
      for (const event of events) {
        insert.run(event.type, JSON.stringify(event.payload), JSON.stringify(event.tags));
      }
    });

    insertAll(events);

    return Promise.resolve();
  }

  events(_query: EventQuery = EMPTY_EVENT_QUERY): Promise<SequencedEvent[]> {
    const rows = this.db.prepare('SELECT position, type, payload, tags FROM events').all() as {
      position: number;
      type: string;
      payload: string;
      tags: string;
    }[];

    return Promise.resolve(
      rows.map((row) => ({
        position: row.position,
        type: row.type,
        payload: JSON.parse(row.payload),
        tags: JSON.parse(row.tags),
      }))
    );
  }
}
