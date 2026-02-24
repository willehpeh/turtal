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
import { SerializableTransaction } from './serializable-transaction';

export class PostgresEventStore extends EventStore {
  private readonly queryBuilder = new PostgresQueryBuilder();
  private readonly errorFactory = new PostgresErrorFactory();
  private readonly transaction: SerializableTransaction;

  private constructor(private readonly pool: Pool) {
    super();
    this.transaction = new SerializableTransaction(pool);
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

  async append(events: DomainEvent[], options = new AppendOptions()): Promise<void> {
    const { condition, metadata } = options;
    try {
      await this.transaction.execute(async (client) => {
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

}
