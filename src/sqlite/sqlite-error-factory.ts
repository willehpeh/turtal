import { DomainEvent } from '../core/event-store/domain-event';
import { EventStoreError } from '../core/event-store/event-store.error';
import { EventStoreErrorFactory } from '../core/event-store/event-store-error-factory';
import { DuplicateEventError } from '../core/event-store/duplicate-event.error';

export class SqliteErrorFactory extends EventStoreErrorFactory {
  protected fromDriverError(error: unknown, message: string, events?: DomainEvent[]): EventStoreError {
    if (events && this.isDuplicateKeyError(error)) {
      return new DuplicateEventError(events.map(e => e.id).join(', '), error);
    }
    return new EventStoreError(message, error);
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return error != null
      && typeof error === 'object'
      && 'code' in error
      && (error as Record<string, unknown>).code === 'SQLITE_CONSTRAINT_UNIQUE';
  }
}
