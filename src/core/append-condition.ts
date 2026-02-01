import { EventCriteria } from './event-criteria';
import { QueryBuilder } from './query-builder';

export class AppendCondition {

  private constructor(
    private readonly criteria: EventCriteria = new EventCriteria(),
    private _after = 0
  ) {}

  static empty(): AppendCondition {
    return new AppendCondition();
  }

  /**
   * If criteria is empty, position is ignored.
   * @param criteria
   * @param after
   */
  static forCriteria(criteria: EventCriteria, after = 0): AppendCondition {
    if (this.isEmptyCriteria(criteria)) {
      return AppendCondition.empty();
    }
    return new AppendCondition(criteria, after);
  }

  private static isEmptyCriteria(criteria: EventCriteria) {
    return criteria.types().length === 0 && criteria.tags().length === 0;
  }

  isEmpty(): boolean {
    return this.criteria.types().length === 0 && this.criteria.tags().length === 0;
  }

  buildQuery<T>(builder: QueryBuilder<T>): T {
    return builder.generate(
      this.criteria.types(),
      this.criteria.tags(),
      this._after
    );
  }
}
