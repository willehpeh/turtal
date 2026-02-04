import { SequencedEvent } from '../event-store/sequenced-event';

export class Projector {
  project(events: SequencedEvent[]): void {}
}
