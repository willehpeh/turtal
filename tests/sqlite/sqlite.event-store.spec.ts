import Database from 'better-sqlite3';
import { SqliteEventStore } from '../../src/sqlite.event-store';
import { DomainEvent } from '../../src/domain-event';
import { AppendCondition } from '../../src/append-condition';
import { EventQuery } from '../../src/event-query';

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
    const appendCondition = AppendCondition.forQuery(new EventQuery().forTypes('TestEvent'))
    const shouldFail = store.append([shouldFailEvent], appendCondition);
    await expect(shouldFail).rejects.toThrowError();
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
    const appendCondition = AppendCondition.forQuery(new EventQuery().forTypes('TestEventDoesNotExist'))
    const shouldNotFail = store.append([event], appendCondition);

    await expect(shouldNotFail).resolves.not.toThrowError();
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
    const appendCondition = AppendCondition.forQuery(new EventQuery().forTypes('RandomTestEvent', 'TestEvent'))
    const shouldFail = store.append([event, shouldFailEvent], appendCondition);
    await expect(shouldFail).rejects.toThrowError();
  });

  it('should fail to append if there is at least one event with ALL OF the provided tags and no position provided', async () => {
    const event: DomainEvent = {
      type: 'TestEvent',
      payload: {
        foo: 'bar',
      },
      tags: [
        'user:test',
        'test:123',
      ]
    };
    await store.append([event]);
    const newEvent: DomainEvent = {
      type: 'TestEvent2',
      payload: {
        buzz: 'bizz',
      },
      tags: [
        'user:test',
        'test:456',
      ]
    };
    const appendCondition = AppendCondition.forQuery(new EventQuery().forTags('test:123', 'user:test'));
    const shouldFail = store.append([newEvent], appendCondition);
    await expect(shouldFail).rejects.toThrowError();
  });

  it('should append if events exist with some but not all of the provided tags', async () => {
    const event: DomainEvent = {
      type: 'TestEvent',
      payload: {
        foo: 'bar',
      },
      tags: [
        'user:test',
        'test:123',
      ]
    };
    await store.append([event]);
    const newEvent: DomainEvent = {
      type: 'TestEvent2',
      payload: {
        buzz: 'bizz',
      },
      tags: [
        'user:test',
        'test:456',
      ]
    };
    const appendCondition = AppendCondition.forQuery(new EventQuery().forTags('test:123', 'other-test-456'));
    await store.append([newEvent], appendCondition);
    const events = await store.events();
    expect(events).toEqual([
      { ...event, position: 1 },
      { ...newEvent, position: 2 },
    ]);
  });

  it('should append if an existing event matches all tags but not the type', async () => {
    const event: DomainEvent = {
      type: 'TestEvent',
      payload: {
        foo: 'bar',
      },
      tags: [
        'user:test',
        'test:123',
      ]
    };
    await store.append([event]);
    const newEvent: DomainEvent = {
      type: 'TestEvent2',
      payload: {
        buzz: 'bizz',
      },
      tags: []
    };
    const appendCondition = AppendCondition.forQuery(new EventQuery()
      .forTags('user:test', 'test:123')
      .forTypes('NotTestEvent')
    );
    await store.append([newEvent], appendCondition);
    const events = await store.events();
    expect(events).toEqual([
      { ...event, position: 1 },
      { ...newEvent, position: 2 },
    ]);
  });

  it('should fail to append if an existing event matches all tags and at least one type', async () => {
    const event: DomainEvent = {
      type: 'TestEvent',
      payload: {
        foo: 'bar',
      },
      tags: [
        'user:test',
        'test:123',
      ]
    };
    await store.append([event]);
    const newEvent: DomainEvent = {
      type: 'TestEvent',
      payload: {
        buzz: 'bizz',
      },
      tags: []
    };
    const appendCondition = AppendCondition.forQuery(new EventQuery()
      .forTags('user:test', 'test:123')
      .forTypes('TestEvent', 'RandomEvent')
    );
    await expect(store.append([newEvent], appendCondition)).rejects.toThrowError();
  })

});
