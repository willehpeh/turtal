import { EventCriteria } from './event-criteria';
import { QueryBuilder } from './query-builder';

export class AppendCondition {

  private constructor(
    private readonly criteria: EventCriteria = new EventCriteria(),
    private readonly after = 0
  ) {}

  static empty(): AppendCondition {
    return new AppendCondition();
  }

  /**
   * If criteria is empty, position is ignored.
   */
  static forCriteria(criteria: EventCriteria, after = 0): AppendCondition {
    if (criteria.isEmpty()) {
      return AppendCondition.empty();
    }
    return new AppendCondition(criteria, after);
  }

  isEmpty(): boolean {
    return this.criteria.isEmpty();
  }

  buildQuery<T>(builder: QueryBuilder<T>): T {
    return this.criteria.applyTo(builder).afterPosition(this.after).build();
  }
}
