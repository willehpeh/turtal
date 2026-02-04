import { SequencedEvent } from '../event-store/sequenced-event';

export abstract class Projector {
  abstract project(events: SequencedEvent[]): void;
}
