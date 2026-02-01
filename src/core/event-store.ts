import { SequencedEvent } from './sequenced-event';
import { EventQuery } from './event-query';
import { AppendCondition } from './append-condition';
import { DomainEvent } from './domain-event';

export abstract class EventStore {
  abstract events(query: EventQuery): Promise<SequencedEvent[]>;
  abstract append(events: DomainEvent[], appendCondition: AppendCondition): Promise<void>;
}

