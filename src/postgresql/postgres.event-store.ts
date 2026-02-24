import type { Pool, PoolClient } from 'pg';
import { DatabaseError } from 'pg-protocol';
import { EventStore } from '../core/event-store/event-store';
import { AppendCondition } from '../core/event-store/append-condition';
import { AppendOptions } from '../core/event-store/append-options';
import { EventCriteria } from '../core/event-store/event-criteria';
import { SequencedEvent } from '../core/event-store/sequenced-event';
import { DomainEvent } from '../core/event-store/domain-event';
import { PostgresQueryBuilder, type ParameterizedQuery } from './postgres-query-builder';
import { AppendConditionError } from '../core/event-store/append-condition.error';
import { POSTGRES_SCHEMA_DEF } from './POSTGRES_SCHEMA_DEF';

const MAX_SERIALIZATION_RETRIES = 3;

function isSerializationError(error: unknown): boolean {
  return error instanceof DatabaseError && error.code === '40001';
}

export class PostgresEventStore extends EventStore {
  private readonly queryBuilder = new PostgresQueryBuilder();

  private constructor(private readonly pool: Pool) {
    super();
  }

  static async create(pool: Pool): Promise<PostgresEventStore> {
    const store = new PostgresEventStore(pool);
    await store.pool.query(POSTGRES_SCHEMA_DEF);
    return store;
  }

  async append(events: DomainEvent[], options: AppendOptions = {}): Promise<void> {
    const condition = options.condition ?? AppendCondition.empty();
    const metadata = options.metadata ?? {};
    await this.withOptimisticLock(async (client) => {
      if (await this.appendShouldFail(client, condition)) {
        throw new AppendConditionError(condition, events);
      }
      for (const event of events) {
        await this.insertEvent(client, event, metadata);
      }
    });
  }

  async events(criteria = EventCriteria.create()): Promise<SequencedEvent[]> {
    const { text, values } = criteria.appliedTo(this.queryBuilder).build() as ParameterizedQuery;
    const result = await this.pool.query(
      `SELECT id, position, type, payload, tags, metadata, timestamp FROM events ${text} ORDER BY position`,
      values
    );
    return result.rows.map((row) => ({
      id: row.id,
      position: Number(row.position),
      type: row.type,
      payload: row.payload,
      tags: row.tags,
      metadata: row.metadata,
      timestamp: new Date(row.timestamp),
    }));
  }

  private async appendShouldFail(client: PoolClient, appendCondition: AppendCondition): Promise<boolean> {
    if (appendCondition.isEmpty()) {
      return false;
    }
    const { text, values } = this.queryBuilder.forCondition(appendCondition) as ParameterizedQuery;
    const result = await client.query(
      `SELECT 1 FROM events ${text} LIMIT 1`,
      values
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  private async insertEvent(client: PoolClient, event: DomainEvent, metadata: Record<string, string>): Promise<void> {
    await client.query(
      'INSERT INTO events (id, type, payload, tags, metadata) VALUES ($1, $2, $3, $4, $5)',
      [event.id, event.type, JSON.stringify(event.payload), event.tags, JSON.stringify(metadata)]
    );
  }

  private async withOptimisticLock(fn: (client: PoolClient) => Promise<void>): Promise<void> {
    const client = await this.pool.connect();
    try {
      for (let attempt = 1; attempt <= MAX_SERIALIZATION_RETRIES; attempt++) {
        try {
          await client.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE');
          await fn(client);
          await client.query('COMMIT');
          return;
        } catch (error) {
          await client.query('ROLLBACK').catch(() => {});
          if (!isSerializationError(error) || attempt === MAX_SERIALIZATION_RETRIES) {
            throw error;
          }
        }
      }
    } finally {
      client.release();
    }
  }
}
