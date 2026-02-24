import type { Pool, PoolClient } from 'pg';
import { EventStore } from '../core/event-store/event-store';
import { AppendCondition } from '../core/event-store/append-condition';
import { AppendOptions } from '../core/event-store/append-options';
import { EventCriteria } from '../core/event-store/event-criteria';
import { SequencedEvent } from '../core/event-store/sequenced-event';
import { DomainEvent } from '../core/event-store/domain-event';
import { PostgresQueryBuilder, type ParameterizedQuery } from './postgres-query-builder';
import { AppendConditionError } from '../core/event-store/append-condition.error';
import { POSTGRES_SCHEMA_DEF } from './POSTGRES_SCHEMA_DEF';
import { PostgresErrorFactory } from './postgres-error-factory';

const MAX_SERIALIZATION_RETRIES = 3;

export class PostgresEventStore extends EventStore {
  private readonly queryBuilder = new PostgresQueryBuilder();
  private readonly errorFactory = new PostgresErrorFactory();

  private constructor(private readonly pool: Pool) {
    super();
  }

  static async create(pool: Pool): Promise<PostgresEventStore> {
    const store = new PostgresEventStore(pool);
    try {
      await store.pool.query(POSTGRES_SCHEMA_DEF);
    } catch (error) {
      throw store.errorFactory.from(error, 'Failed to initialize schema');
    }
    return store;
  }

  async append(events: DomainEvent[], options: AppendOptions = {}): Promise<void> {
    const condition = options.condition ?? AppendCondition.empty();
    const metadata = options.metadata ?? {};
    try {
      await this.withOptimisticLock(async (client) => {
        if (await this.appendShouldFail(client, condition)) {
          throw new AppendConditionError(condition, events);
        }
        for (const event of events) {
          await this.insertEvent(client, event, metadata);
        }
      });
    } catch (error) {
      throw this.errorFactory.from(error, 'Failed to append events', events);
    }
  }

  async events(criteria = EventCriteria.create()): Promise<SequencedEvent[]> {
    try {
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
    } catch (error) {
      throw this.errorFactory.from(error, 'Failed to read events');
    }
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

  private isSerializationError(error: unknown): boolean {
    return error != null
      && typeof error === 'object'
      && 'code' in error
      && (error as Record<string, unknown>).code === '40001';
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
          if (!this.isSerializationError(error) || attempt === MAX_SERIALIZATION_RETRIES) {
            throw error;
          }
        }
      }
    } finally {
      client.release();
    }
  }
}
