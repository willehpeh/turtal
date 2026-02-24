import { AppendCondition } from './append-condition';
import { DomainEvent } from './domain-event';

export class AppendConditionError extends Error {
  constructor(appendCondition: AppendCondition,
              events: DomainEvent[]) {
    super(`The following events could not be appended:
    ${events.map(event => JSON.stringify(event)).join('\n')}
    The append condition was: ${JSON.stringify(appendCondition)}.
    `);
    this.name = 'AppendConditionError';
  }
}
