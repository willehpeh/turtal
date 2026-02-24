import { EventCriteria } from '../core/event-store/event-criteria';
import { QueryBuilder } from '../core/event-store/query-builder';

export type ParameterizedQuery = {
  text: string;
  values: unknown[];
};

export class PostgresQueryBuilder implements QueryBuilder<ParameterizedQuery> {
  constructor(
    private readonly _types: string[] = [],
    private readonly _tags: string[] = [],
    private readonly _after: number = 0
  ) {}

  withCriteria(criteria: EventCriteria): QueryBuilder<ParameterizedQuery> {
    return new PostgresQueryBuilder(criteria.types(), criteria.tags(), criteria.after());
  }

  build(): ParameterizedQuery {
    const clauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (this._types.length) {
      clauses.push(`type = ANY($${paramIndex})`);
      values.push(this._types);
      paramIndex++;
    }

    if (this._tags.length) {
      clauses.push(`tags @> $${paramIndex}`);
      values.push(this._tags);
      paramIndex++;
    }

    if (this._after) {
      clauses.push(`position > $${paramIndex}`);
      values.push(this._after);
    }

    return {
      text: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
      values,
    };
  }
}
