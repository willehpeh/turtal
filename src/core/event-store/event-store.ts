import { SequencedEvent } from './sequenced-event';
import { EventCriteria } from './event-criteria';
import { DomainEvent } from './domain-event';
import { AppendOptions } from './append-options';

export abstract class EventStore {
  abstract events(criteria?: EventCriteria): Promise<SequencedEvent[]>;
  abstract append(events: DomainEvent[], options?: AppendOptions): Promise<void>;
}
