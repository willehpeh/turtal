import { DomainEvent } from './domain-event';
import { EventStoreError } from './event-store.error';

export abstract class EventStoreErrorFactory {
  from(error: unknown, message: string, events?: DomainEvent[]): EventStoreError {
    if (this.isEventStoreError(error)) {
      return error;
    }
    return this.fromDriverError(error, message, events);
  }

  protected abstract fromDriverError(error: unknown, message: string, events?: DomainEvent[]): EventStoreError;

  private isEventStoreError(error: unknown): error is EventStoreError {
    return error != null
      && typeof error === 'object'
      && 'isEventStoreError' in error
      && (error as Record<string, unknown>).isEventStoreError === true;
  }
}
