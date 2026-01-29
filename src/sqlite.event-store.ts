import type { Database, Transaction } from 'better-sqlite3';
import { EventStore } from './event-store';
import { AppendCondition } from './append-condition';
import { EventQuery } from './event-query';
import { SequencedEvent } from './sequenced-event';
import { DomainEvent } from './domain-event';

export class SqliteEventStore extends EventStore {
  constructor(private readonly db: Database) {
    super();
    this.ensureSchema();
  }

  append(events: DomainEvent[], appendCondition: AppendCondition = AppendCondition.empty()): Promise<void> {
    if (this.appendConditionShouldFail(appendCondition)) {
      return Promise.reject();
    }
    const insertAll = this.appendTransaction();
    insertAll(events);

    return Promise.resolve();
  }

  events(_query: EventQuery = new EventQuery()): Promise<SequencedEvent[]> {
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

  private appendConditionShouldFail(appendCondition: AppendCondition) {
    if (appendCondition.isEmpty()) {
      return false;
    }
    const sql = `
        SELECT 1
        FROM events
        WHERE type IN (${ appendCondition.typesAsString() })
        LIMIT 1
    `;
    return this.db.prepare(sql).get();
  }

  private ensureSchema(): void {
    // language=SQLite
    this.db.exec(`
        CREATE TABLE IF NOT EXISTS events
        (
            position INTEGER PRIMARY KEY AUTOINCREMENT,
            type     TEXT NOT NULL,
            payload  JSON NOT NULL,
            tags     TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_events_type ON events (type);
    `);
  }

  private appendTransaction(): Transaction<(events: DomainEvent[]) => void> {
    return this.db.transaction((events: DomainEvent[]) => {
      const insert = this.db.prepare<[string, string, string]>('INSERT INTO events (type, payload, tags) VALUES (?, ?, ?)');
      events.forEach((event) => {
        insert.run(event.type, JSON.stringify(event.payload), JSON.stringify(event.tags));
      });
    });
  }
}
