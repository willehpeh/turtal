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

  withTypes(types: string[]): QueryBuilder<ParameterizedQuery> {
    return new PostgresQueryBuilder(types, this._tags, this._after);
  }

  withTags(tags: string[]): QueryBuilder<ParameterizedQuery> {
    return new PostgresQueryBuilder(this._types, tags, this._after);
  }

  afterPosition(position: number): QueryBuilder<ParameterizedQuery> {
    return new PostgresQueryBuilder(this._types, this._tags, position);
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
