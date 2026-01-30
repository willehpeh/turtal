import { SqlDialect } from './sql-dialect';

export class EventQuery {

  private _types: string[] = [];
  private _tags: string[] = [];

  types(): string[] {
    return this._types.slice();
  }

  tags(): string[] {
    return this._tags.slice();
  }

  forTypes(...types: string[]): EventQuery {
    this._types.push(...types);
    return this;
  }

  forTags(...tags: string[]): EventQuery {
    this._tags.push(...tags);
    return this;
  }

  toWhereClause(dialect: SqlDialect, tableName: string): string {
    const clauses: string[] = [];

    if (this._types.length > 0) {
      clauses.push(dialect.typesClause(this._types, tableName));
    }

    if (this._tags.length > 0) {
      clauses.push(dialect.tagsClause(this._tags, tableName));
    }

    if (clauses.length === 0) {
      return '';
    }

    return `WHERE ${clauses.join(' AND ')}`;
  }
}
