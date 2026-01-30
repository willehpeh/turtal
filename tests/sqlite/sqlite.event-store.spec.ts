import Database from 'better-sqlite3';
import { SqliteEventStore } from '../../src/sqlite.event-store';
import { DomainEvent } from '../../src/domain-event';
import { AppendCondition } from '../../src/append-condition';
import { EventQuery } from '../../src/event-query';
import { SequencedEvent } from '../../src/sequenced-event';

function sortTags<T extends { tags: string[] }>(event: T): T {
  return { ...event, tags: [...event.tags].sort() };
}

function expectEventsEqual(actual: SequencedEvent[], expected: SequencedEvent[]) {
  expect(actual.map(sortTags)).toEqual(expected.map(sortTags));
}

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
    expectEventsEqual(events, [{ ...event, position: 1 }]);
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
    await expect(store.append([shouldFailEvent], appendCondition)).rejects.toThrowError();
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
    await expect(store.append([event], appendCondition)).resolves.not.toThrowError();
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
    await expect(store.append([event, shouldFailEvent], appendCondition)).rejects.toThrowError();
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
    await expect(store.append([newEvent], appendCondition)).rejects.toThrowError();
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
    expectEventsEqual(events, [
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
    expectEventsEqual(events, [
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
  });

  it('should only return events that match the types in the query', async () => {
    const storedEvents: DomainEvent[] = [
      {
        type: 'TestEvent',
        payload: {
          foo: 'bar',
        },
        tags: [
          'user:test',
          'test:123',
        ]
      },
      {
        type: 'TestEvent2',
        payload: {
          buzz: 'bizz',
        },
        tags: []
      },
      {
        type: 'TestEvent',
        payload: {
          foo: 'buzz',
        },
        tags: [
          'user:test',
          'test:443',
        ]
      },
      {
        type: 'TestEvent3',
        payload: {
          foo: 'bazz',
        },
        tags: []
      }
    ];
    await store.append(storedEvents);
    const query = new EventQuery().forTypes('TestEvent', 'TestEvent3');
    const events = await store.events(query);
    expectEventsEqual(events, [
      { ...storedEvents[0], position: 1 },
      { ...storedEvents[2], position: 3 },
      { ...storedEvents[3], position: 4 },
    ]);
  });

  it('should only return events that match the tags in the query', async () => {
    const storedEvents: DomainEvent[] = [
      {
        type: 'TestEvent',
        payload: {
          foo: 'bar',
        },
        tags: [
          'user:test',
          'test:123',
        ]
      },
      {
        type: 'TestEvent2',
        payload: {
          buzz: 'bizz',
        },
        tags: []
      },
      {
        type: 'TestEvent',
        payload: {
          foo: 'bazz',
        },
        tags: [
          'user:test',
          'test:443',
        ]
      }
    ];
    await store.append(storedEvents);
    const query = new EventQuery().forTags('user:test');
    const events = await store.events(query);
    expectEventsEqual(events, [
      { ...storedEvents[0], position: 1 },
      { ...storedEvents[2], position: 3 },
    ]);
  })

});
