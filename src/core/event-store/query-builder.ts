import { EventCriteria } from './event-criteria';

export interface QueryBuilder<T> {
  withCriteria(criteria: EventCriteria): QueryBuilder<T>;
  build(): T;
}
