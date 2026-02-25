import { DomainEvent, EventCriteria, EventStore } from '../../src';
import { expectEventsEqual } from './helpers';

export function queryTests(getStore: () => EventStore) {
  it('should only return events that match the types in the query', async () => {
    const storedEvents: DomainEvent[] = [
      {
        id: 'event-1',
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
        id: 'event-2',
        type: 'TestEvent2',
        payload: {
          buzz: 'bizz',
        },
        tags: []
      },
      {
        id: 'event-3',
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
        id: 'event-4',
        type: 'TestEvent3',
        payload: {
          foo: 'bazz',
        },
        tags: []
      }
    ];
    await getStore().append(storedEvents);
    const query = EventCriteria.create().forTypes('TestEvent', 'TestEvent3');
    const events = await getStore().events(query);
    expectEventsEqual(events, [
      { ...storedEvents[0], position: 1 },
      { ...storedEvents[2], position: 3 },
      { ...storedEvents[3], position: 4 },
    ]);
  });

  it('should only return events that match the tags in the query', async () => {
    const storedEvents: DomainEvent[] = [
      {
        id: 'event-1',
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
        id: 'event-2',
        type: 'TestEvent2',
        payload: {
          buzz: 'bizz',
        },
        tags: []
      },
      {
        id: 'event-3',
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
    await getStore().append(storedEvents);
    const query = EventCriteria.create().forTags('user:test');
    const events = await getStore().events(query);
    expectEventsEqual(events, [
      { ...storedEvents[0], position: 1 },
      { ...storedEvents[2], position: 3 },
    ]);
  });

  it('should only return events that match the tags and types in the query', async () => {
    const storedEvents: DomainEvent[] = [
      {
        id: 'event-1',
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
        id: 'event-2',
        type: 'TestEvent',
        payload: {
          buzz: 'bizz',
        },
        tags: []
      },
      {
        id: 'event-3',
        type: 'TestEvent',
        payload: {
          foo: 'bazz',
        },
        tags: [
          'user:test',
          'test:443',
        ]
      },
      {
        id: 'event-4',
        type: 'TestEvent',
        payload: {
          foo: 'bazz',
        },
        tags: [
          'user:test',
          'test:123',
        ]
      }
    ];
    await getStore().append(storedEvents);
    const query = EventCriteria.create().forTypes('TestEvent').forTags('user:test', 'test:123');
    const events = await getStore().events(query);
    expectEventsEqual(events, [
      { ...storedEvents[0], position: 1 },
      { ...storedEvents[3], position: 4 },
    ]);
  });

  it('should only return events after the given position', async () => {
    const storedEvents: DomainEvent[] = [
      {
        id: 'event-1',
        type: 'TestEvent',
        payload: { foo: 'bar' },
        tags: ['user:test'],
      },
      {
        id: 'event-2',
        type: 'TestEvent',
        payload: { foo: 'buzz' },
        tags: ['user:test'],
      },
      {
        id: 'event-3',
        type: 'TestEvent',
        payload: { foo: 'bazz' },
        tags: ['user:test'],
      },
    ];
    await getStore().append(storedEvents);
    const query = EventCriteria.create().afterPosition(2);
    const events = await getStore().events(query);
    expectEventsEqual(events, [
      { ...storedEvents[2], position: 3 },
    ]);
  });
}
