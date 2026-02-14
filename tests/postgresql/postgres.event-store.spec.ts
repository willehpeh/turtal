import { Pool } from 'pg';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PostgresEventStore } from '../../src/postgresql/postgres.event-store';
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
});
