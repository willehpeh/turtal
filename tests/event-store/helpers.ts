import { SequencedEvent } from '../../src';

function sortTags<T extends { tags: string[] }>(event: T): T {
  return { ...event, tags: [...event.tags].sort() };
}

function withoutGenerated({ timestamp, metadata, ...rest }: SequencedEvent) {
  return rest;
}

export function expectEventsEqual(actual: SequencedEvent[], expected: Omit<SequencedEvent, 'timestamp' | 'metadata'>[]) {
  expect(actual.map(withoutGenerated).map(sortTags)).toEqual(expected.map(sortTags));
}
