import { EventCriteria } from '../core/event-store/event-criteria';
import { QueryBuilder } from '../core/event-store/query-builder';

export type SqliteParameterizedQuery = {
  text: string;
  values: unknown[];
};

export class SqliteQueryBuilder implements QueryBuilder<SqliteParameterizedQuery> {
  constructor(
    private readonly _types: string[] = [],
    private readonly _tags: string[] = [],
    private readonly _after: number = 0
  ) {}

  withCriteria(criteria: EventCriteria): QueryBuilder<SqliteParameterizedQuery> {
    return new SqliteQueryBuilder(criteria.types(), criteria.tags(), criteria.after());
  }

  build(): SqliteParameterizedQuery {
    const clauses: string[] = [];
    const values: unknown[] = [];

    if (this._types.length) {
      const placeholders = this._types.map(() => '?').join(',');
      clauses.push(`events.type IN (${placeholders})`);
      values.push(...this._types);
    }

    if (this._tags.length) {
      for (const tag of this._tags) {
        clauses.push(`EXISTS (SELECT 1 FROM event_tags WHERE event_position = events.position AND tag = ?)`);
        values.push(tag);
      }
    }

    if (this._after) {
      clauses.push(`events.position > ?`);
      values.push(this._after);
    }

    return {
      text: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
      values,
    };
  }
}
