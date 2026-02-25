import { EventStore } from '../../src';
import { buildEvent } from './helpers';

export function duplicateEventTests(getStore: () => EventStore) {
  it('should throw DuplicateEventError when appending an event with an existing ID', async () => {
    await getStore().append([buildEvent('duplicate-id')]);
    const expectedError = {
      name: 'DuplicateEventError',
      isEventStoreError: true,
    };
    await expect(getStore().append([buildEvent('duplicate-id', { type: 'TestEvent2' })])).rejects.toMatchObject(expectedError);
  });
}
