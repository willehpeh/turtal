import type { Pool, PoolClient } from 'pg';
import { EventStore } from '../core/event-store/event-store';
import { AppendCondition } from '../core/event-store/append-condition';
import { EventCriteria } from '../core/event-store/event-criteria';
import { SequencedEvent } from '../core/event-store/sequenced-event';
import { DomainEvent } from '../core/event-store/domain-event';
import { PostgresQueryBuilder, type ParameterizedQuery } from './postgres-query-builder';
import { AppendConditionError } from '../core/event-store/append-condition.error';
import { POSTGRES_SCHEMA_DEF } from './POSTGRES_SCHEMA_DEF';

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

  async append(events: DomainEvent[], appendCondition: AppendCondition = AppendCondition.empty()): Promise<void> {
    await this.withOptimisticLock(async (client) => {
      if (await this.appendShouldFail(client, appendCondition)) {
        throw new AppendConditionError(appendCondition, events);
      }
      for (const event of events) {
        await this.insertEvent(client, event);
      }
    });
  }

  async events(criteria = new EventCriteria()): Promise<SequencedEvent[]> {
    const { text, values } = criteria.appliedTo(this.queryBuilder).build() as ParameterizedQuery;
    const result = await this.pool.query(
      `SELECT id, position, type, payload, tags FROM events ${text} ORDER BY position`,
      values
    );
    return result.rows.map((row) => ({
      id: row.id,
      position: Number(row.position),
      type: row.type,
      payload: row.payload,
      tags: row.tags,
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

  private async insertEvent(client: PoolClient, event: DomainEvent): Promise<void> {
    await client.query(
      'INSERT INTO events (id, type, payload, tags) VALUES ($1, $2, $3, $4)',
      [event.id, event.type, JSON.stringify(event.payload), event.tags]
    );
  }

  private async withOptimisticLock(fn: (client: PoolClient) => Promise<void>): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE');
      await fn(client);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }
}
