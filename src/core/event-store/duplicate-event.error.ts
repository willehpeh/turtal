import { EventStoreError } from './event-store.error';

export class DuplicateEventError extends EventStoreError {
  constructor(eventId: string, cause?: unknown) {
    super(`Event with ID '${eventId}' already exists`, cause);
    this.name = 'DuplicateEventError';
  }
}
