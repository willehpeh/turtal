import { DomainEvent } from '../core/event-store/domain-event';
import { EventStoreError } from '../core/event-store/event-store.error';
import { EventStoreErrorFactory } from '../core/event-store/event-store-error-factory';
import { DuplicateEventError } from '../core/event-store/duplicate-event.error';

export class PostgresErrorFactory extends EventStoreErrorFactory {
  protected fromDriverError(error: unknown, message: string, events?: DomainEvent[]): EventStoreError {
    if (events && this.hasCode(error, '23505')) {
      return new DuplicateEventError(events.map(e => e.id).join(', '), error);
    }
    return new EventStoreError(message, error);
  }

  private hasCode(error: unknown, code: string): boolean {
    return error != null
      && typeof error === 'object'
      && 'code' in error
      && (error as Record<string, unknown>).code === code;
  }
}
