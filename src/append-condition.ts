import { EventQuery } from './event-query';
import { SqlDialect } from './sql-dialect';

export class AppendCondition {

  private constructor(
    private readonly query: EventQuery = new EventQuery(),
    private readonly _after = 0
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

  toWhereClause(dialect: SqlDialect, tableName: string): string {
    return this.query.toWhereClause(dialect, tableName);
  }

}
