import { DomainEvent, SequencedEvent } from '../../src';

export function buildEvent(id: string, overrides: Partial<Omit<DomainEvent, 'id'>> = {}): DomainEvent {
  return { id, type: 'TestEvent', payload: {}, tags: [], ...overrides };
}

function sortTags<T extends { tags: string[] }>(event: T): T {
  return { ...event, tags: [...event.tags].sort() };
}

function withoutGenerated({ timestamp, metadata, ...rest }: SequencedEvent) {
  return rest;
}

export function expectEventsEqual(actual: SequencedEvent[], expected: Omit<SequencedEvent, 'timestamp' | 'metadata'>[]) {
  expect(actual.map(withoutGenerated).map(sortTags)).toEqual(expected.map(sortTags));
}
