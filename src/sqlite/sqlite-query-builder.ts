import { QueryBuilder } from '../core/query-builder';

export class SqliteQueryBuilder implements QueryBuilder<string> {
  constructor(
    private readonly _types: string[] = [],
    private readonly _tags: string[] = [],
    private readonly _after: number = 0
  ) {}

  withTypes(types: string[]): QueryBuilder<string> {
    return new SqliteQueryBuilder(types, this._tags, this._after);
  }

  withTags(tags: string[]): QueryBuilder<string> {
    return new SqliteQueryBuilder(this._types, tags, this._after);
  }

  afterPosition(position: number): QueryBuilder<string> {
    return new SqliteQueryBuilder(this._types, this._tags, position);
  }

  build(): string {
    const clauses = [
      this.typesClause(),
      this.tagsClause(),
      this.positionClause(),
    ].filter(Boolean);

    if (!clauses.length) return '';
    return `WHERE ${clauses.join(' AND ')}`;
  }

  private typesClause(): string {
    if (!this._types.length) return '';
    const quoted = this._types.map(type => `'${type}'`).join(',');
    return `events.type IN (${quoted})`;
  }

  private tagsClause(): string {
    if (!this._tags.length) return '';
    return this._tags
      .map(tag => `EXISTS (SELECT 1 FROM event_tags WHERE event_position = events.position AND tag = '${tag}')`)
      .join(' AND ');
  }

  private positionClause(): string {
    if (!this._after) return '';
    return `events.position > ${this._after}`;
  }
}
