import Database from 'better-sqlite3';
import { SqliteEventStore } from '../../src/sqlite.event-store';
import { DomainEvent } from '../../src/domain-event';

describe('SQLite Event Store', () => {
  let db: Database.Database;
  let store: SqliteEventStore;

  beforeEach(() => {
    db = new Database(':memory:');
    store = new SqliteEventStore(db);
  });

  it('should be empty on creation', async () => {
    const events = await store.events();
    expect(events).toEqual([]);
  });

  it('should append the event', async () => {
    const event: DomainEvent = {
      type: 'TestEvent',
      payload: {
        foo: 'bar',
        buzz: 'bizz',
      },
      tags: [
        'user:test',
        'test:123',
      ]
    };
    await store.append([event]);

    const events = await store.events();
    expect(events).toEqual([{ ...event, position: 1 }]);
  });

  it('should append multiple events', async () => {
    const newEvents: DomainEvent[] = [
      {
        type: 'TestEvent1',
        payload: {
          foo: 'bar',
        },
        tags: [
          'user:test',
        ]
      },
      {
        type: 'TestEvent2',
        payload: {
          buzz: 'bizz',
        },
        tags: [
          'test:123',
        ] },
    ];
    await store.append(newEvents);

    const events = await store.events();
    expect(events).toEqual([
      { ...events[0], position: 1 },
      { ...events[1], position: 2 },
    ]);
  });

  it('should fail to append if the event type already exists', async () => {
    const event: DomainEvent = {
      type: 'TestEvent',
      payload: {
        foo: 'bar',
      },
      tags: [
        'user:test',
      ]
    };
    await store.append([event]);
    const shouldFailEvent: DomainEvent = {
      type: 'TestEvent',
      payload: {
        foo: 'bar',
      },
      tags: [
        'user:test',
      ]
    };
    const shouldFail = store.append([shouldFailEvent], { failIfMatch: { types: ['TestEvent'], tags: [] } });
    expect(shouldFail).rejects.toThrowError();
  });

  it('should not fail to append if the event type does not exist', async () => {
    const event: DomainEvent = {
      type: 'TestEvent',
      payload: {
        foo: 'bar',
      },
      tags: [
        'user:test',
      ]
    };
    const shouldNotFail = store.append([event], { failIfMatch: { types: ['TestEventDoesNotExist'], tags: [] } });

    expect(shouldNotFail).resolves.not.toThrowError();
  });

  it('should fail to append if at least one event type matches', async () => {
    const event: DomainEvent = {
      type: 'TestEvent',
      payload: {
        foo: 'bar',
      },
      tags: [
        'user:test',
      ]
    };
    await store.append([event]);
    const shouldFailEvent: DomainEvent = {
      type: 'TestEvent1',
      payload: {
        foo: 'bar',
      },
      tags: []
    };
    const shouldFail = store.append([event, shouldFailEvent], { failIfMatch: { types: ['RandomTestEvent', 'TestEvent'], tags: [] } });
    expect(shouldFail).rejects.toThrowError();
  })

});
