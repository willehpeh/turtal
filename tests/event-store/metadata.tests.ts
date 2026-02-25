import { AppendOptions, DomainEvent, EventStore } from '../../src';

export function metadataTests(getStore: () => EventStore) {
  it('should return metadata on events appended with metadata', async () => {
    const event: DomainEvent = {
      id: 'event-1',
      type: 'TestEvent',
      payload: { foo: 'bar' },
      tags: ['user:test'],
    };
    const metadata = { correlationId: 'corr-1', causationId: 'cause-1', userId: 'user-42' };
    await getStore().append([event], new AppendOptions({ metadata }));

    const events = await getStore().events();
    expect(events).toHaveLength(1);
    expect(events[0].metadata).toEqual(metadata);
  });

  it('should return empty metadata on events appended without metadata', async () => {
    const event: DomainEvent = {
      id: 'event-1',
      type: 'TestEvent',
      payload: { foo: 'bar' },
      tags: ['user:test'],
    };
    await getStore().append([event]);

    const events = await getStore().events();
    expect(events).toHaveLength(1);
    expect(events[0].metadata).toEqual({});
  });
}
