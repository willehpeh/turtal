import Database from 'better-sqlite3';
import { SqliteEventStore } from '../../src';
import { eventStoreTests } from '../event-store.tests';

describe('SQLite Event Store', () => {
  let store: SqliteEventStore;

  beforeEach(() => {
    const db = new Database(':memory:');
    store = SqliteEventStore.createSync(db);
  });

  eventStoreTests(() => store);
});
