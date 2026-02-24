import { Pool } from 'pg';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PostgresEventStore } from '../../src';
import { eventStoreTests } from '../event-store.tests';

describe('PostgreSQL Event Store', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let store: PostgresEventStore;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17-alpine').start();
    pool = new Pool({ connectionString: container.getConnectionUri() });
    store = await PostgresEventStore.create(pool);
  }, 60_000);

  afterAll(async () => {
    await pool.end();
    await container.stop();
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE events RESTART IDENTITY');
  });

  eventStoreTests(() => store);

  it('should retry on serialization failure', async () => {
    const event1 = { id: 'e1', type: 'TestEvent', payload: {}, tags: ['stream:1'] };
    const event2 = { id: 'e2', type: 'TestEvent', payload: {}, tags: ['stream:1'] };

    // Two concurrent appends with overlapping conditions force a serialization conflict.
    // One will succeed immediately; the other will hit a 40001 and retry.
    await Promise.all([
      store.append([event1]),
      store.append([event2]),
    ]);

    const events = await store.events();
    expect(events).toHaveLength(2);
  });
});
