import { DbQueryGenerator } from '../core/db-query-generator';

export class SqliteQueryGenerator implements DbQueryGenerator<string> {
  constructor(private readonly tableName: string) {}

  generate(types: string[], tags: string[], after?: number): string {
    const clauses: string[] = [];

    if (types.length > 0) {
      clauses.push(this.typesClause(types));
    }
    if (tags.length > 0) {
      clauses.push(this.tagsClause(tags));
    }
    if (after !== undefined && after > 0) {
      clauses.push(this.positionAfterClause(after));
    }

    return clauses.join(' AND ');
  }

  private typesClause(types: string[]): string {
    const quoted = types.map(type => `'${type}'`).join(',');
    return `${this.tableName}.type IN (${quoted})`;
  }

  private tagsClause(tags: string[]): string {
    return tags
      .map(tag => `EXISTS (SELECT 1 FROM event_tags WHERE event_position = ${this.tableName}.position AND tag = '${tag}')`)
      .join(' AND ');
  }

  private positionAfterClause(position: number): string {
    return `${this.tableName}.position > ${position}`;
  }
}
