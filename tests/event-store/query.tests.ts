import { DomainEvent, EventCriteria, EventStore } from '../../src';
import { buildEvent, expectEventsEqual } from './helpers';

export function queryTests(getStore: () => EventStore) {
  it('should only return events that match the types in the query', async () => {
    const storedEvents: DomainEvent[] = [
      buildEvent('event-1', { tags: ['user:test', 'test:123'] }),
      buildEvent('event-2', { type: 'TestEvent2' }),
      buildEvent('event-3', { tags: ['user:test', 'test:443'] }),
      buildEvent('event-4', { type: 'TestEvent3' }),
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
      buildEvent('event-1', { tags: ['user:test', 'test:123'] }),
      buildEvent('event-2', { type: 'TestEvent2' }),
      buildEvent('event-3', { tags: ['user:test', 'test:443'] }),
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
      buildEvent('event-1', { tags: ['user:test', 'test:123'] }),
      buildEvent('event-2'),
      buildEvent('event-3', { tags: ['user:test', 'test:443'] }),
      buildEvent('event-4', { tags: ['user:test', 'test:123'] }),
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
      buildEvent('event-1', { tags: ['user:test'] }),
      buildEvent('event-2', { tags: ['user:test'] }),
      buildEvent('event-3', { tags: ['user:test'] }),
    ];
    await getStore().append(storedEvents);
    const query = EventCriteria.create().afterPosition(2);
    const events = await getStore().events(query);
    expectEventsEqual(events, [
      { ...storedEvents[2], position: 3 },
    ]);
  });
}
