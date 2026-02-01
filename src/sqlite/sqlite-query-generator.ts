import { DbQueryGenerator } from '../core/db-query-generator';

export class SqliteQueryGenerator implements DbQueryGenerator<string> {
  generate(types: string[], tags: string[], after?: number): string {
    return [
      this.typesClause(types),
      this.tagsClause(tags),
      this.positionAfterClause(after),
    ].filter(Boolean).join(' AND ');
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
