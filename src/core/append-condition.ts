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

  static forQuery(query: EventQuery): AppendCondition {
    return new AppendCondition(query);
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
    if (queryClause === '') {
      return `WHERE ${positionClause}`;
    }
    return `${queryClause} AND ${positionClause}`;
  }

  after(position: number): AppendCondition {
    this._after = position;
    return this;
  }
}
