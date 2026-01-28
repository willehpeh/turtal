import { EventQuery } from './event-query';

export type AppendCondition = {
  failIfMatch: EventQuery,
  after?: number
};
