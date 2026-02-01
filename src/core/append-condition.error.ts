import { AppendCondition } from './append-condition';
import { DomainEvent } from './domain-event';

export class AppendConditionError extends Error {
  constructor(appendCondition: AppendCondition,
              events: DomainEvent[]) {
    super(`The following events could not be appended:
    ${events.map(event => event.toString()).join('\n')}
    The append condition was: ${appendCondition.toString()}.
    `);
    this.name = 'AppendConditionError';
  }
}
