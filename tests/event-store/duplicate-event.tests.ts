import { DomainEvent, EventStore } from '../../src';

export function duplicateEventTests(getStore: () => EventStore) {
  it('should throw DuplicateEventError when appending an event with an existing ID', async () => {
    const event: DomainEvent = {
      id: 'duplicate-id',
      type: 'TestEvent',
      payload: { foo: 'bar' },
      tags: ['user:test'],
    };
    await getStore().append([event]);
    const duplicate: DomainEvent = {
      id: 'duplicate-id',
      type: 'TestEvent2',
      payload: { different: 'data' },
      tags: [],
    };
    const expectedError = {
      name: 'DuplicateEventError',
      isEventStoreError: true,
    };
    await expect(getStore().append([duplicate])).rejects.toMatchObject(expectedError);
  });
}
