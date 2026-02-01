import { SqlDialect } from '../core/sql-dialect';

export class SqliteDialect implements SqlDialect {
  typesClause(types: string[], tableName: string): string {
    const quoted = types.map(type => `'${type}'`).join(',');
    return `${tableName}.type IN (${quoted})`;
  }

  tagsClause(tags: string[], tableName: string): string {
    return tags
      .map(tag => `EXISTS (SELECT 1 FROM event_tags WHERE event_position = ${tableName}.position AND tag = '${tag}')`)
      .join(' AND ');
  }

  positionAfterClause(position: number, tableName: string): string {
    return `${tableName}.position > ${position}`;
  }
}
