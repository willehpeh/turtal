import { Pool } from 'pg';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { AppendCondition, AppendOptions, EventCriteria, PostgresEventStore } from '../../src';
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

  it('should handle concurrent appends without data loss', async () => {
    const event1 = { id: 'e1', type: 'TestEvent', payload: {}, tags: ['stream:1'] };
    const event2 = { id: 'e2', type: 'TestEvent', payload: {}, tags: ['stream:1'] };

    await Promise.all([
      store.append([event1]),
      store.append([event2]),
    ]);

    const events = await store.events();
    expect(events).toHaveLength(2);
  });

  it('should allow exactly one append when concurrent appends have the same condition', async () => {
    const criteria = EventCriteria.create().forTypes('UniqueEvent');
    const condition = AppendCondition.forCriteria(criteria);

    const results = await Promise.allSettled(
      Array.from({ length: 10 }, (_, i) =>
        store.append(
          [{ id: `event-${i}`, type: 'UniqueEvent', payload: {}, tags: [] }],
          new AppendOptions({ condition })
        )
      )
    );

    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(9);

    const events = await store.events();
    expect(events).toHaveLength(1);
  });
});
