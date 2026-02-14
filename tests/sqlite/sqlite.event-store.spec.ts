import Database from 'better-sqlite3';
import { SqliteEventStore } from '../../src';
import { eventStoreTests } from '../event-store.tests';

describe('SQLite Event Store', () => {
  let store: SqliteEventStore;

  beforeEach(() => {
    const db = new Database(':memory:');
    store = new SqliteEventStore(db);
  });

  eventStoreTests(() => store);
});
