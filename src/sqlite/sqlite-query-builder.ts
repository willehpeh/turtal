import { QueryBuilder } from '../core/query-builder';

export class SqliteQueryBuilder implements QueryBuilder<string> {
  build(types: string[], tags: string[], after?: number): string {
    const clauses = [
      this.typesClause(types),
      this.tagsClause(tags),
      this.positionAfterClause(after),
    ].filter(Boolean);

    if (!clauses.length) return '';
    return `WHERE ${clauses.join(' AND ')}`;
  }

  private typesClause(types: string[]): string {
    if (!types.length) return '';
    const quoted = types.map(type => `'${type}'`).join(',');
    return `events.type IN (${quoted})`;
  }

  private tagsClause(tags: string[]): string {
    if (!tags.length) return '';
    return tags
      .map(tag => `EXISTS (SELECT 1 FROM event_tags WHERE event_position = events.position AND tag = '${tag}')`)
      .join(' AND ');
  }

  private positionAfterClause(after?: number): string {
    if (!after) return '';
    return `events.position > ${after}`;
  }
}
