import { AppendOptions, EventStore } from '../../src';
import { buildEvent } from './helpers';

export function metadataTests(getStore: () => EventStore) {
  it('should return metadata on events appended with metadata', async () => {
    const event = buildEvent('event-1');
    const metadata = { correlationId: 'corr-1', causationId: 'cause-1', userId: 'user-42' };
    await getStore().append([event], new AppendOptions({ metadata }));

    const events = await getStore().events();
    expect(events).toHaveLength(1);
    expect(events[0].metadata).toEqual(metadata);
  });

  it('should return empty metadata on events appended without metadata', async () => {
    const event = buildEvent('event-1');
    await getStore().append([event]);

    const events = await getStore().events();
    expect(events).toHaveLength(1);
    expect(events[0].metadata).toEqual({});
  });
}
