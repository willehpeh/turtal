import { DomainEvent, EventStore } from '../../src';
import { expectEventsEqual } from './helpers';

export function appendTests(getStore: () => EventStore) {
  it('should be empty on creation', async () => {
    const events = await getStore().events();
    expect(events).toEqual([]);
  });

  it('should append the event', async () => {
    const event: DomainEvent = {
      id: 'event-1',
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
    await getStore().append([event]);

    const events = await getStore().events();
    expectEventsEqual(events, [{ ...event, position: 1 }]);
  });

  it('should append multiple events', async () => {
    const newEvents: DomainEvent[] = [
      {
        id: 'event-1',
        type: 'TestEvent1',
        payload: {
          foo: 'bar',
        },
        tags: [
          'user:test',
        ]
      },
      {
        id: 'event-2',
        type: 'TestEvent2',
        payload: {
          buzz: 'bizz',
        },
        tags: [
          'test:123',
        ] },
    ];
    await getStore().append(newEvents);

    const events = await getStore().events();
    expectEventsEqual(events, [
      { ...newEvents[0], position: 1 },
      { ...newEvents[1], position: 2 },
    ]);
  });

  it('should set a timestamp on appended events', async () => {
    const event: DomainEvent = {
      id: 'event-1',
      type: 'TestEvent',
      payload: { foo: 'bar' },
      tags: ['user:test'],
    };
    await getStore().append([event]);

    const events = await getStore().events();
    expect(events).toHaveLength(1);
    expect(events[0].timestamp).toBeInstanceOf(Date);
  });
}
