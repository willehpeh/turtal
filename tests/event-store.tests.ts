import { AppendCondition, DomainEvent, EventCriteria, EventStore, SequencedEvent } from '../src';

function sortTags<T extends { tags: string[] }>(event: T): T {
  return { ...event, tags: [...event.tags].sort() };
}

function withoutGenerated({ timestamp, metadata, ...rest }: SequencedEvent) {
  return rest;
}

function expectEventsEqual(actual: SequencedEvent[], expected: Omit<SequencedEvent, 'timestamp' | 'metadata'>[]) {
  expect(actual.map(withoutGenerated).map(sortTags)).toEqual(expected.map(sortTags));
}

export function eventStoreTests(getStore: () => EventStore) {
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
    const appendCondition = AppendCondition.forCriteria(EventCriteria.create().forTypes('TestEvent'))
    await expect(getStore().append([shouldFailEvent], { condition: appendCondition })).rejects.toThrowError();
  });

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
    await expect(getStore().append([duplicate])).rejects.toMatchObject({
      name: 'DuplicateEventError',
      isEventStoreError: true,
    });
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
    await expect(getStore().append([event], { condition: appendCondition })).resolves.not.toThrowError();
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
    await expect(getStore().append([event, shouldFailEvent], { condition: appendCondition })).rejects.toThrowError();
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
    await expect(getStore().append([newEvent], { condition: appendCondition })).rejects.toThrowError();
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
    await getStore().append([newEvent], { condition: appendCondition });
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
    await getStore().append([newEvent], { condition: appendCondition });
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
    await expect(getStore().append([newEvent], { condition: appendCondition })).rejects.toThrowError();
  });

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

  it('should set a timestamp on appended events', async () => {
    const before = new Date();
    const event: DomainEvent = {
      id: 'event-1',
      type: 'TestEvent',
      payload: { foo: 'bar' },
      tags: ['user:test'],
    };
    await getStore().append([event]);
    const after = new Date();

    const events = await getStore().events();
    expect(events).toHaveLength(1);
    expect(events[0].timestamp).toBeInstanceOf(Date);
    expect(events[0].timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(events[0].timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
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
    await getStore().append([newEvent], { condition: appendCondition });
    const events = await getStore().events();
    expectEventsEqual(events, [
      { ...storedEvents[0], position: 1 },
      { ...storedEvents[1], position: 2 },
      { ...newEvent, position: 3 },
    ])
  });

  it('should return metadata on events appended with metadata', async () => {
    const event: DomainEvent = {
      id: 'event-1',
      type: 'TestEvent',
      payload: { foo: 'bar' },
      tags: ['user:test'],
    };
    const metadata = { correlationId: 'corr-1', causationId: 'cause-1', userId: 'user-42' };
    await getStore().append([event], { metadata });

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
