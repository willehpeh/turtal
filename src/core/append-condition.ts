import { EventQuery } from './event-query';
import { SqlDialect } from './sql-dialect';

export class AppendCondition {

  private constructor(
    private readonly query: EventQuery = new EventQuery(),
    private _after = 0
  ) {}

  static empty(): AppendCondition {
    return new AppendCondition();
  }

  static forQuery(query: EventQuery, after = 0): AppendCondition {
    return new AppendCondition(query, after);
  }

  isEmpty(): boolean {
    return this.query.types().length === 0 && this.query.tags().length === 0;
  }

  whereClause(dialect: SqlDialect, tableName: string): string {
    const queryClause = this.query.whereClause(dialect, tableName);
    if (this._after === 0) {
      return queryClause;
    }
    const positionClause = dialect.positionAfterClause(this._after, tableName);
    return `${queryClause} AND ${positionClause}`;
  }
}
