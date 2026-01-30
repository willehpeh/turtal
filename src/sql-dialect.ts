export interface SqlDialect {
  typesClause(types: string[], tableName: string): string;
  tagsClause(tags: string[], tableName: string): string;
  positionAfterClause(position: number, tableName: string): string;
}
