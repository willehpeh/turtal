import { AppendCondition, AppendOptions, DomainEvent, EventCriteria, EventStore } from '../../src';
import { expectEventsEqual } from './helpers';

export function appendConditionTests(getStore: () => EventStore) {
  it('should fail to append if the event type already exists', async () => {
    const event: DomainEvent = {
      id: 'event-1',
      type: 'TestEvent',
      payload: {
        foo: 'bar',
      },
      tags: [
        'user:test',
      ]
    };
    await getStore().append([event]);
    const shouldFailEvent: DomainEvent = {
      id: 'event-2',
      type: 'TestEvent',
      payload: {
        foo: 'bar',
      },
      tags: [
        'user:test',
      ]
    };
    const appendCondition = AppendCondition.forCriteria(
      EventCriteria.create().forTypes('TestEvent')
    );
    const expectedError = {
      name: 'AppendConditionError',
      isEventStoreError: true,
    };
    const appendOp = () => getStore().append(
      [shouldFailEvent],
      new AppendOptions({ condition: appendCondition })
    );
    await expect(appendOp()).rejects.toMatchObject(expectedError);
  });

  it('should not fail to append if the event type does not exist', async () => {
    const event: DomainEvent = {
      id: 'event-1',
      type: 'TestEvent',
      payload: {
        foo: 'bar',
      },
      tags: [
        'user:test',
      ]
    };
    const appendCondition = AppendCondition.forCriteria(EventCriteria.create().forTypes('TestEventDoesNotExist'))
    const appendOp = () => getStore().append([event], new AppendOptions({ condition: appendCondition }))
    await expect(appendOp()).resolves.not.toThrowError();
  });

  it('should fail to append if at least one event type matches', async () => {
    const event: DomainEvent = {
      id: 'event-1',
      type: 'TestEvent',
      payload: {
        foo: 'bar',
      },
      tags: [
        'user:test',
      ]
    };
    await getStore().append([event]);
    const shouldFailEvent: DomainEvent = {
      id: 'event-2',
      type: 'TestEvent1',
      payload: {
        foo: 'bar',
      },
      tags: []
    };
    const appendCondition = AppendCondition.forCriteria(EventCriteria.create().forTypes('RandomTestEvent', 'TestEvent'))
    const expectedError = {
      name: 'AppendConditionError',
      isEventStoreError: true,
    };
    const appendOp = () => getStore().append(
      [event, shouldFailEvent],
      new AppendOptions({ condition: appendCondition })
    );
    await expect(appendOp()).rejects.toMatchObject(expectedError);
  });

  it('should fail to append if there is at least one event with ALL OF the provided tags and no position provided', async () => {
    const event: DomainEvent = {
      id: 'event-1',
      type: 'TestEvent',
      payload: {
        foo: 'bar',
      },
      tags: [
        'user:test',
        'test:123',
      ]
    };
    await getStore().append([event]);
    const newEvent: DomainEvent = {
      id: 'event-2',
      type: 'TestEvent2',
      payload: {
        buzz: 'bizz',
      },
      tags: [
        'user:test',
        'test:456',
      ]
    };
    const appendCondition = AppendCondition.forCriteria(EventCriteria.create().forTags('test:123', 'user:test'));
    const expectedError = {
      name: 'AppendConditionError',
      isEventStoreError: true,
    };
    const appendOp = () => getStore().append([newEvent], new AppendOptions({ condition: appendCondition }));
    await expect(appendOp()).rejects.toMatchObject(expectedError);
  });

  it('should append if events exist with some but not all of the provided tags', async () => {
    const event: DomainEvent = {
      id: 'event-1',
      type: 'TestEvent',
      payload: {
        foo: 'bar',
      },
      tags: [
        'user:test',
        'test:123',
      ]
    };
    await getStore().append([event]);
    const newEvent: DomainEvent = {
      id: 'event-2',
      type: 'TestEvent2',
      payload: {
        buzz: 'bizz',
      },
      tags: [
        'user:test',
        'test:456',
      ]
    };
    const appendCondition = AppendCondition.forCriteria(EventCriteria.create().forTags('test:123', 'other-test-456'));
    await getStore().append([newEvent], new AppendOptions({ condition: appendCondition }));
    const events = await getStore().events();
    expectEventsEqual(events, [
      { ...event, position: 1 },
      { ...newEvent, position: 2 },
    ]);
  });

  it('should append if an existing event matches all tags but not the type', async () => {
    const event: DomainEvent = {
      id: 'event-1',
      type: 'TestEvent',
      payload: {
        foo: 'bar',
      },
      tags: [
        'user:test',
        'test:123',
      ]
    };
    await getStore().append([event]);
    const newEvent: DomainEvent = {
      id: 'event-2',
      type: 'TestEvent2',
      payload: {
        buzz: 'bizz',
      },
      tags: []
    };
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
    const event: DomainEvent = {
      id: 'event-1',
      type: 'TestEvent',
      payload: {
        foo: 'bar',
      },
      tags: [
        'user:test',
        'test:123',
      ]
    };
    await getStore().append([event]);
    const newEvent: DomainEvent = {
      id: 'event-2',
      type: 'TestEvent',
      payload: {
        buzz: 'bizz',
      },
      tags: []
    };
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
          foo: 'buzz',
        },
        tags: [
          'user:test',
          'test:345',
        ]
      },
    ];
    await getStore().append(storedEvents);
    const query = EventCriteria.create().forTypes('TestEvent').forTags('user:test');
    const appendCondition = AppendCondition.forCriteria(query, 2);
    const newEvent: DomainEvent = {
      id: 'event-3',
      type: 'TestEvent',
      payload: {
        buzz: 'bizz',
      },
      tags: []
    };
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
    ];
    await getStore().append(storedEvents);
    const query = EventCriteria.create().forTypes('TestEvent').forTags('user:test');
    const appendCondition = AppendCondition.forCriteria(query, 1);
    const newEvent: DomainEvent = {
      id: 'event-3',
      type: 'TestEvent',
      payload: { buzz: 'bizz' },
      tags: [],
    };
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
