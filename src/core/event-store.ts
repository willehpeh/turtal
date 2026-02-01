import { SequencedEvent } from './sequenced-event';
import { EventCriteria } from './event-criteria';
import { AppendCondition } from './append-condition';
import { DomainEvent } from './domain-event';

export abstract class EventStore {
  abstract events(criteria: EventCriteria): Promise<SequencedEvent[]>;
  abstract append(events: DomainEvent[], appendCondition: AppendCondition): Promise<void>;
}
