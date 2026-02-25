import { EventStore } from '../src';
import { appendTests } from './event-store/append.tests';
import { appendConditionTests } from './event-store/append-conditions.tests';
import { duplicateEventTests } from './event-store/duplicate-event.tests';
import { queryTests } from './event-store/query.tests';
import { metadataTests } from './event-store/metadata.tests';

export function eventStoreTests(getStore: () => EventStore) {
  describe('append', () => appendTests(getStore));
  describe('append conditions', () => appendConditionTests(getStore));
  describe('duplicate events', () => duplicateEventTests(getStore));
  describe('query', () => queryTests(getStore));
  describe('metadata', () => metadataTests(getStore));
}
