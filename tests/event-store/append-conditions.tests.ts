import { AppendCondition, AppendOptions, DomainEvent, EventCriteria, EventStore } from '../../src';
import { buildEvent, expectEventsEqual } from './helpers';

export function appendConditionTests(getStore: () => EventStore) {
  it('should fail to append if the event type already exists', async () => {
    await getStore().append([buildEvent('event-1')]);
    const appendCondition = AppendCondition.forCriteria(
      EventCriteria.create().forTypes('TestEvent')
    );
    const expectedError = {
      name: 'AppendConditionError',
      isEventStoreError: true,
    };
    const appendOp = () => getStore().append(
      [buildEvent('event-2')],
      new AppendOptions({ condition: appendCondition })
    );
    await expect(appendOp()).rejects.toMatchObject(expectedError);
  });

  it('should not fail to append if the event type does not exist', async () => {
    const appendCondition = AppendCondition.forCriteria(EventCriteria.create().forTypes('TestEventDoesNotExist'))
    const appendOp = () => getStore().append([buildEvent('event-1')], new AppendOptions({ condition: appendCondition }))
    await expect(appendOp()).resolves.not.toThrowError();
  });

  it('should fail to append if at least one event type matches', async () => {
    await getStore().append([buildEvent('event-1')]);
    const appendCondition = AppendCondition.forCriteria(EventCriteria.create().forTypes('RandomTestEvent', 'TestEvent'))
    const expectedError = {
      name: 'AppendConditionError',
      isEventStoreError: true,
    };
    const appendOp = () => getStore().append(
      [buildEvent('event-2', { type: 'TestEvent1' })],
      new AppendOptions({ condition: appendCondition })
    );
    await expect(appendOp()).rejects.toMatchObject(expectedError);
  });

  it('should fail to append if there is at least one event with ALL OF the provided tags and no position provided', async () => {
    const event = buildEvent('event-1', { tags: ['user:test', 'test:123'] });
    await getStore().append([event]);
    const newEvent = buildEvent('event-2', { type: 'TestEvent2', tags: ['user:test', 'test:456'] });
    const appendCondition = AppendCondition.forCriteria(EventCriteria.create().forTags('test:123', 'user:test'));
    const expectedError = {
      name: 'AppendConditionError',
      isEventStoreError: true,
    };
    const appendOp = () => getStore().append([newEvent], new AppendOptions({ condition: appendCondition }));
    await expect(appendOp()).rejects.toMatchObject(expectedError);
  });

  it('should append if events exist with some but not all of the provided tags', async () => {
    const event = buildEvent('event-1', { tags: ['user:test', 'test:123'] });
    await getStore().append([event]);
    const newEvent = buildEvent('event-2', { type: 'TestEvent2', tags: ['user:test', 'test:456'] });
    const appendCondition = AppendCondition.forCriteria(EventCriteria.create().forTags('test:123', 'other-test-456'));
    await getStore().append([newEvent], new AppendOptions({ condition: appendCondition }));
    const events = await getStore().events();
    expectEventsEqual(events, [
      { ...event, position: 1 },
      { ...newEvent, position: 2 },
    ]);
  });

  it('should append if an existing event matches all tags but not the type', async () => {
    const event = buildEvent('event-1', { tags: ['user:test', 'test:123'] });
    await getStore().append([event]);
    const newEvent = buildEvent('event-2', { type: 'TestEvent2' });
    const appendCondition = AppendCondition.forCriteria(EventCriteria.create()
      .forTags('user:test', 'test:123')
      .forTypes('NotTestEvent')
    );
    await getStore().append([newEvent], new AppendOptions({ condition: appendCondition }));
    const events = await getStore().events();
    expectEventsEqual(events, [
      { ...event, position: 1 },
      { ...newEvent, position: 2 },
    ]);
  });

  it('should fail to append if an existing event matches all tags and at least one type', async () => {
    const event = buildEvent('event-1', { tags: ['user:test', 'test:123'] });
    await getStore().append([event]);
    const newEvent = buildEvent('event-2');
    const appendCondition = AppendCondition.forCriteria(EventCriteria.create()
      .forTags('user:test', 'test:123')
      .forTypes('TestEvent', 'RandomEvent')
    );
    const expectedError = {
      name: 'AppendConditionError',
      isEventStoreError: true,
    };
    const appendOp = () => getStore().append(
      [newEvent],
      new AppendOptions({ condition: appendCondition })
    );
    await expect(appendOp()).rejects.toMatchObject(expectedError);
  });

  it('should append if no event exists after the latest observed position', async () => {
    const storedEvents: DomainEvent[] = [
      buildEvent('event-1', { tags: ['user:test', 'test:123'] }),
      buildEvent('event-2', { tags: ['user:test', 'test:345'] }),
    ];
    await getStore().append(storedEvents);
    const query = EventCriteria.create().forTypes('TestEvent').forTags('user:test');
    const appendCondition = AppendCondition.forCriteria(query, 2);
    const newEvent = buildEvent('event-3');
    await getStore().append([newEvent], new AppendOptions({ condition: appendCondition }));
    const events = await getStore().events();
    expectEventsEqual(events, [
      { ...storedEvents[0], position: 1 },
      { ...storedEvents[1], position: 2 },
      { ...newEvent, position: 3 },
    ])
  });

  it('should fail to append if an event exists after the latest observed position', async () => {
    const storedEvents: DomainEvent[] = [
      buildEvent('event-1', { tags: ['user:test'] }),
      buildEvent('event-2', { tags: ['user:test'] }),
    ];
    await getStore().append(storedEvents);
    const query = EventCriteria.create().forTypes('TestEvent').forTags('user:test');
    const appendCondition = AppendCondition.forCriteria(query, 1);
    const newEvent = buildEvent('event-3');
    const expectedError = {
      name: 'AppendConditionError',
      isEventStoreError: true,
    };
    const appendOp = () => getStore().append(
      [newEvent],
      new AppendOptions({ condition: appendCondition }),
    );
    await expect(appendOp()).rejects.toMatchObject(expectedError);
  });
}
