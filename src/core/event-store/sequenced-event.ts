import { DomainEvent } from './domain-event';

export type SequencedEvent = DomainEvent & { position: number };
