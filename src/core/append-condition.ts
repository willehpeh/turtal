import { EventQuery } from './event-query';
import { DbQueryGenerator } from './db-query-generator';

export class AppendCondition {

  private constructor(
    private readonly query: EventQuery = new EventQuery(),
    private _after = 0
  ) {}

  static empty(): AppendCondition {
    return new AppendCondition();
  }

  /**
   * If query is empty, position is ignored.
   * @param query
   * @param after
   */
  static forQuery(query: EventQuery, after = 0): AppendCondition {
    if (this.isEmptyQuery(query)) {
      return AppendCondition.empty();
    }
    return new AppendCondition(query, after);
  }

  private static isEmptyQuery(query: EventQuery) {
    return query.types().length === 0 && query.tags().length === 0;
  }

  isEmpty(): boolean {
    return this.query.types().length === 0 && this.query.tags().length === 0;
  }

  generateDbQuery<T>(generator: DbQueryGenerator<T>): T {
    return generator.generate(
      this.query.types(),
      this.query.tags(),
      this._after
    );
  }
}
